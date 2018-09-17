littb.controller "dramawebCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter, $rootElement, $modal) ->
    s = $scope

    s.filters = {
        isChildrensPlay : false
    }

    updateRoute = () ->
        s.showpage = $location.path().split("/")[2] or "start"
        s.isStartPage = s.showpage == "start"
        # s.$root.dramasubpage = !s.isStartPage
        $rootScope._stripClass("drama")
        if !s.isStartPage
            $rootElement.addClass("drama-dramasubpage")
        
    updateRoute()
    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        # _.extend s, current.pathParams
        updateRoute()



    util.setupHashComplex s,
            [
                key : "visa"
                scope_name : "listType"
                replace : false
                default : "pjäser"
            ,
                key : "om-boken"
                scope_name : "show_about"
                default: "no"
                post_change : (val) ->
                    if val

                        s.workinfoPromise = backend.getInfopost($location.search().author_id, $location.search().titlepath)

                        s.workinfoPromise.then (workinfo) ->
                            s.workinfo = workinfo
                            about_modal = $modal.open
                                templateUrl : "sourceInfoModal.html"
                                scope : s
                                windowClass : "about"

                            about_modal.result.then () ->
                                s.show_about = false
                                $location.search({'author_id' : null, 'titlepath' : null})
                            , () ->
                                s.show_about = false
                                $location.search({'author_id' : null, 'titlepath' : null})

                    else
                        about_modal?.close()
                        about_modal = null
                
        ]

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById
        s.authorList = authorList
    s.authorSelectSetup = {
        formatNoMatches: "Inga resultat",
        formatResult : (data) ->
            if not s.authorsById then return 
            author = s.authorsById[data.id]
            unless author then return data.text

            firstname = ""
            if author.name_for_index.split(",").length > 1
                firstname = "<span class='firstname'>, #{author.name_for_index.split(',')[1]}</span>"

            return """
            <span>
                <span class="surname sc">#{author.surname}</span>#{firstname} <span class="year">#{$filter('authorYear')(author)}</span>
            </span>
            """

        formatSelection : (item) ->
            try
                return s.authorsById[item.id].surname
            catch e
                return "Välj författare"

    }

    s.onRadioClick = (newType) ->
        c.log "onRadioClick", s.listType
        s.listType = newType

    s.listType = 'pjäser'

    s.formatInterval = ([from, width]) ->
        return "#{from}–#{width + from}"

    s.getAuthor = (author) ->
        [last, first] = author.name_for_index.split(",")

        if first
            first = "<span class='firstname'>#{first}</span>"
        else
            first = ""

        _.compact(["<span class='sc'>#{last}</span>", first]).join ","

    s.authorFilter = (author) ->
        if s.filters.gender and s.filters.gender != "all"
            return s.filters.gender == author.gender


        if s.filters.filterTxt
            searchstr = [author.full_name, author.birth.plain, author.death.plain]
                        .join(" ").toLowerCase()
            for str in s.filters.filterTxt.split(" ")
                if not searchstr.match(str) then return false


        return true

    s.getFilteredRows = () ->
        ret = _.filter s.rows, (item) -> 
            # if not (_.filter item.authors, (auth) -> auth.gender == s.filters.gender).length
            #     # return false
            if s.filters.gender and 
                (s.filters.gender != "all") and 
                item.authors[0].gender isnt s.filters.gender then return false


            if s.filters.author and s.filters.author != "all"
                if item.authors[0].author_id != s.filters.author then return false


            if s.filters.filterTxt 
                fullnames = _.map item.authors, (author) ->
                    [author.full_name, author.birth.plain, author.death.plain].join(" ")
                searchstr = fullnames.join(" ") + (item.title)
                searchstr = searchstr.toLowerCase()
                
                for str in s.filters.filterTxt.split(" ")
                    if not searchstr.match(str) then return false

            if s.filters.isChildrensPlay
                if not ("Barnlitteratur" in (item.keyword? or [])) then return false

            for [key, value] in _.toPairs(s.filters)
                if (_.isArray value) and value.length
                    [from, to] = value
                    from = from or 0
                    to = to or Infinity
                    if not (item.dramawebben?.hasOwnProperty key) then continue
                    n = Number(item.dramawebben[key])
                    if not (from <= n <= to ) then return false

            return true

        return ret
                

    backend.getDramawebTitles().then (data) ->
        s.rows = data

        s.filters = {
            gender : "",
            filterTxt : "",
            female_roles : [Infinity, 0]
            male_roles : [Infinity, 0]
            other_roles : [Infinity, 0]
            number_of_acts : [Infinity, 0]
            number_of_pages : [Infinity, 0]
            number_of_roles : [Infinity, 0]
            isChildrensPlay : false
        }

        findMinMax = ["female_roles", "male_roles", "other_roles", "number_of_acts", "number_of_pages", "number_of_roles"]
        for item in s.rows
            if not item.dramawebben then continue
            for key in findMinMax
                n = Number(item.dramawebben[key])
                if n < s.filters[key][0]
                    s.filters[key][0] = n
                if n > s.filters[key][1]
                    s.filters[key][1] = n
        s.sliderConf = {}
        for key in findMinMax
            [from, to] = s.filters[key]
            s.sliderConf[key] = {floor : from, ceil: to}

        authors = _.map data, (row) ->
            row.authors[0]

        s.authorData = _.uniq authors, false, (item) ->
            item.author_id

        s.authorData = _.sortBy s.authorData, "name_for_index"

