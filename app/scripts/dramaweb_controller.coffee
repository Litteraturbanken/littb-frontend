littb.controller "dramawebCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter, $rootElement, $modal, $timeout) ->
    s = $scope

    s.filters = {
        gender : $location.search().gender
        filterTxt : $location.search().filterTxt
        author : $location.search().author
        female_roles : $location.search().female_roles?.split(",")
        male_roles : $location.search().male_roles?.split(",")
        other_roles : $location.search().other_roles?.split(",")
        number_of_acts : $location.search().number_of_acts?.split(",")
        number_of_pages : $location.search().number_of_pages?.split(",")
        number_of_roles : $location.search().number_of_roles?.split(",")
        isChildrensPlay : $location.search().barnlitteratur
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
        console.log("routeChangeError", event, current, prev, rejection)
        # _.extend s, current.pathParams
        updateRoute()
    

    s.filterDirty = {}
    s.onDropdownToggle = (isOpen) ->
        console.log("onDropdownToggle", isOpen)

        if not isOpen and _.keys(s.filterDirty).length
            for key in _.keys(s.filterDirty)
                $location.search(key, s.filters[key].join(",")).replace()

        if not isOpen
            $location.search("barnlitteratur", s.filters.isChildrensPlay or null)


    util.setupHashComplex s,
            [
                key : "visa"
                scope_name : "listType"
                replace : false
                default : "pjäser"
            ,
                key : 'gender'
                expr : "filters.gender"
                default : "all"
            ,
                key : 'author'
                expr : "filters.author"
            ,
                key : 'filterTxt'
                expr: "filters.filterTxt"
            # ,
            #     key : 'filterDirty'
            #     val_in : (val) -> val?.split(",")
            #     val_out : (val) -> val?.join(",")
            ,
            #     key : "female_roles"
            #     expr : "filters.female_roles"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
            #     key : "male_roles"
            #     expr : "filters.male_roles"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
            #     key : "other_roles"
            #     expr : "filters.other_roles"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
            #     key : "number_of_acts"
            #     expr : "filters.number_of_acts"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
            #     key : "number_of_pages"
            #     expr : "filters.number_of_pages"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
            #     key : "number_of_roles"
            #     expr : "filters.number_of_roles"
            #     val_in : (val) -> val.split(",")
            #     val_out : (val) -> val.join(",")
            # ,
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

    s.onAuthorChange = _.once () ->
        console.log("onAuthorChange", $location.search().author)
        if $location.search().author
            s.filters.author = $location.search().author
        
    s.onGenderChange = _.once () ->
        console.log("$location.search().gender", $location.search().gender)
        if $location.search().gender
            s.filters.gender = $location.search().gender

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

    s.getFilteredRows = _.throttle () ->
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
                if not ("Barnlitteratur" in (item.keyword?.split(",") or [])) then return false

            for key in _.keys(s.filterDirty)
                # console.log("key", key)
                value = s.filters[key]
                if (_.isArray value) and value.length
                    [from, to] = value
                    from = from or 0
                    to = to or Infinity
                    if not (item.dramawebben?.hasOwnProperty key) then return false

                    n = Number(item.dramawebben[key])
                    if not (from <= n <= to ) then return false

            return true

        return ret
    , 100
                
    backend.getDramawebTitles().then (data) ->
        s.rows = data.works
        authors.then () ->
            s.authorData = _.map data.authors, (author_id) ->
                s.authorsById[author_id]
            s.authorData = util.sortAuthors(s.authorData)
            

        # s.filters = _.extend s.filters, {
        # }

        findMinMax = ["female_roles", "male_roles", "other_roles", "number_of_acts", "number_of_pages", "number_of_roles"]
        s.filterDirty = _.fromPairs ([key, true] for key in findMinMax when $location.search()[key])
        ranges = _.fromPairs _.map findMinMax, (key) -> [key, [Infinity, 0]]
        for item in s.rows
            if not item.dramawebben then continue
            for key in findMinMax
                n = Number(item.dramawebben[key])
                if n < ranges[key][0]
                    ranges[key][0] = n
                if n > ranges[key][1]
                    ranges[key][1] = n
        s.sliderConf = {}
        
        for key in findMinMax
            [from, to] = ranges[key]
            unless s.filters[key]
                console.log("from, to", from, to)
                s.filters[key] = [from, to]
            s.sliderConf[key] = {
                floor : from,
                ceil: to,
                onEnd : do (key, s) ->
                    () -> 
                        # safeApply(s, () ->
                        $timeout( () ->
                            s.filterDirty[key] = true
                        , 0)
                        # $location.search("ranges", s.filterDirty.join(",")).replace()
                        # )
            }


