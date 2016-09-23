window.c = console ? log : _.noop
littb = angular.module('littbApp')

littb.filter "formatAuthors", (authors) ->
    (authorlist, authorsById, makeLink) ->
        if not authorlist or not authorlist.length or not authorsById then return

        stringify = (auth) ->
            suffix = {
                editor : " <span class='authortype'>red.</span>"
                translator : " <span class='authortype'>övers.</span>"
                illustrator : " <span class='authortype'>ill.</span>"
                photographer : " <span class='authortype'>fotogr.</span>"
                # scholar : " (red.)"


            }[auth.type] or ""
            authorsById[auth.author_id].full_name + suffix
        
        linkify = (auth) ->
            $("<a>").attr "href", "/#!/forfattare/#{auth.author_id}"
                .html stringify auth
                .outerHTML()

        if makeLink
            strings = _.map authorlist, linkify
        else
            strings = _.map authorlist, stringify
        

        firsts = strings[...-1]
        last = _.last strings



        if firsts.length then return "#{firsts.join(', ')} <em style='font-family: Requiem'>&</em> #{last}"
        else return last
        

        

c.time = angular.noop
c.timeEnd = angular.noop

littb.filter "authorYear", () ->
    (obj) ->
        unless obj then return
        isFalsy = (val) ->
            not val or (val == "0000")
        birth = obj.birth?.plain
        death = obj.death?.plain
        if (isFalsy birth) and (isFalsy death) then return ""
        if isFalsy death then return "f. #{birth}"
        if isFalsy obj.birth?.date then return "d. #{death}"
        return "#{birth}-#{death}"


titleSort = (a) ->
    _.map a.shorttitle.split(/(\d+)/), (item) -> 
        if Number(item)
            zeroes = (_.map [0..(10 - item.toString().length)], () -> "0").join("")

            return zeroes + item.toString()
        else 
            return item

littb.controller "startCtrl", ($scope, $location) ->

    $scope.gotoTitle = (query) ->
        unless query
            url = "/titlar"
        else
            url = "/titlar?filter=#{query}&selectedLetter=#{query[0].toUpperCase()}"

        $scope.goto url



littb.controller "contactFormCtrl", ($scope, backend, $timeout, $location) ->
    s = $scope

    fromSchool = $location.search().skola?

    s.showContact = false
    s.showNewsletter = false
    s.showError = false

    done = () ->
        $timeout( () ->
            s.showContact = false
            s.showNewsletter = false
        , 4000)

    err = () ->
        s.showError = true
        s.showContact = false
        s.showNewsletter = false

        $timeout( () ->
            s.showError = false
        , 4000)

    s.submitContactForm = () ->
        if fromSchool
            msg = "[skola] " + s.message
        else
            msg = s.message
        backend.submitContactForm(s.name, s.email, msg).then( () ->
            s.showContact = true
            done()
        , err
        )
    s.subscribe = () ->
        msg = s.newsletterEmail + " vill bli tillagd på utskickslistan."
        backend.submitContactForm("Utskickslista", s.newsletterEmail, msg).then( () ->
            s.showNewsletter = true
            done()
        , err
        )


    

littb.controller "statsCtrl", ($scope, backend) ->
    s = $scope




    backend.getStats().then (data) ->
        s.statsData = data

    backend.getTitles(false, null, "popularity|desc").then (titleArray) ->
        s.titleList = titleArray

    backend.getEpub(30).then (titleArray) ->
        s.epubList = titleArray




getAuthorSelectSetup = (s, $filter) ->
    return {
        formatNoMatches: "Inga resultat",
        formatResult : (data) ->
            # return data.text
            author = s.authorsById[data.id]

            firstname = ""
            unless author.name_for_index
                c.warn("no name_for_index for author", author)
            if author.name_for_index?.split(",").length > 1
                firstname = "<span class='firstname'>, #{author.name_for_index.split(',')[1]}</span>"

            return """
            <span>
                <span class="surname sc">#{author.surname}</span>#{firstname} <span class="year">#{$filter('authorYear')(author)}</span>
            </span>
            """

        formatSelection : (item) ->
            return s.authorsById[item.id].surname
            # item.text

    }

littb.controller "searchCtrl", ($scope, backend, $location, $document, $window, $rootElement, $q, $timeout, util, SearchData, authors, debounce, $filter, $anchorScroll) ->
    s = $scope
    s.open = true
    hasSearchInit = false
    s.auth_select_rendered = false
    s.onAuthSelectRender = () ->
        s.auth_select_rendered = true
    # s.proofread = 'all'

    s.searchData = searchData = new SearchData()

    s.authorSelectSetup = getAuthorSelectSetup(s, $filter)

    $timeout( () ->
        s.$broadcast "focus"
    , 100)

    s.titleSelectSetup = {
        formatNoMatches: "Inga resultat",
        formatResult : (data) ->
            return "<span class='title'>#{data.text}</span>"

        formatSelection : (item) ->
            item.text
    }
    

    initTitle = _.once (titlesById) ->
        unless $location.search().titel then return

        s.selected_title = titlesById[$location.search().titel]

    s.titleChange = () ->
        # $location.search("titel", s.selected_title?.work_title_id or null)
        $location.search("titel", s.selected_title?.lbworkid or null)

    s.resetAuthorFilter = () ->
        s.nav_filter = null
        searchData.resetMod().then ([kwic, sentsWithHeaders]) ->
            # s.kwic = kwic
            s.sentsWithHeaders = sentsWithHeaders

    s.setAuthorFilter = (author_id) ->
        # $location.search("navigator_filter", author_id)
        s.nav_filter = author_id


    s.authorChange = () ->
        $location.search("titel", null)
        s.selected_title = ""

    s.titleSort = titleSort
        
    # for the author / about author search check
    s.isAuthorSearch = true


    aboutDef = backend.getTitles(false, null, null, null, true, true)

    $q.all([aboutDef, authors]).then ([titleArray, [authorList, authorsById]]) ->
        titleArray = _.filter titleArray, (title) ->
            title.searchable
        aboutAuthorIds = _.compact _.pluck titleArray, "authorkeyword"
        s.aboutAuthors = _.uniq _.map aboutAuthorIds, (id) ->
            authorsById[id]

    s.getAuthorDatasource = () ->
        if s.isAuthorAboutSearch
            return s.aboutAuthors
        else
            return s.authors

    authors.then ([authorList, authorsById]) ->
        s.authors = authorList
        s.authorsById = authorsById
        change = (newAuthors) ->
            return unless newAuthors
            backend.getTextByAuthor(newAuthors, "etext,faksimil", null, s.isAuthorAboutSearch).then (titles) ->
                s.titles = titles
            # $q.all _.map newAuthors.split(","), (auth) -> 
            # backend.getTitlesByAuthor(auth, true, s.isAuthorAboutSearch)
            # .then (results) ->
            #     filteredTitles = _.filter (_.flatten results), (item) -> 

            #         "/" not in item.titlepath

            #     filteredTitles = _.uniq filteredTitles, (item) -> item.lbworkid
            #     s.titles = filteredTitles
        
        if $location.search().forfattare
            auth = $location.search().forfattare?.split(",")
            s.selectedAuthors = auth
            c.log "s.selectedAuthors", s.selectedAuthors
        
        if $location.search().titlar
            titles = $location.search().titlar?.split(",")
            s.selectedTitles = titles
        if $location.search().sok_filter
            s.nav_filter = $location.search().sok_filter

        util.setupHashComplex s, [
                key : "forfattare"
                # expr : "selected_author.pseudonymfor || selected_author.author_id"
                expr : "selectedAuthors"
                val_in : (val) ->
                    val?.split(",")
                val_out : (val) ->
                    val?.join(",")
                post_change : change
            ,
                key : "titlar"
                # expr : "selected_author.pseudonymfor || selected_author.author_id"
                expr : "selectedTitles"
                val_in : (val) ->
                    val?.split(",")
                val_out : (val) ->
                    val?.join(",")

            , 
                key : "sok_filter"
                expr : "nav_filter"
                post_change : (author_id) ->
                    if author_id
                        c.log "do modifySearch", author_id
                        searchData.modifySearch({authors: author_id, from: 0, to: s.num_hits - 1}).then ([kwic, sentsWithHeaders]) ->
                            s.sentsWithHeaders = sentsWithHeaders



        ]


    s.searching = false
    s.num_hits = searchData.NUM_HITS
    s.current_page = 0

    # s.rowHeights = []

    # s.getRowHeight = () ->
    #     add = (a, b) -> a+b
        
    #     return (_.foldr s.rowHeights, add) / (s.rowHeights.length)


    # s.tableRenderComplete = () ->
    #     s.searching = false
    #     $timeout(() ->
    #         s.getTotalHeight()
    #     , 0)

    # s.getTotalHeight = () ->
    #     s.totalHeight = s.hits * s.getRowHeight()


    # s.updateOnScrollEvents = (evt, isEnd) ->
    #     if not isEnd then return

    #     top = $(evt.currentTarget).offset().top

    #     topMost = _.min $("tr", evt.currentTarget), (tr) ->
    #         if $(tr).offset().top < top then 9999 else $(tr).offset().top
    #     c.log "topMost", topMost, $(topMost).scope()



    #     top = evt.currentTarget.scrollTop
    #     rowHeight = s.getRowHeight()
    #     if $(topMost).scope().sent.index
    #         from = $(topMost).scope().sent.index + s.from_index
    #         c.log "tr index", from
    #     else 
    #         from = Math.floor(top / rowHeight)
    #         c.log "rowheight from", from
    #     n_rows = Math.ceil($(evt.currentTarget).height() / rowHeight)


    #     s.search(from, (from + n_rows)).then () ->
    #         s.table_top = top
            

    
    # getMediatypes = () ->
    #     {
    #         yes : "etext"
    #         no : "faksimil"
    #         all : "all"
    #     }[s.proofread]


    s.nextPage = () ->
        if (s.current_page  * s.num_hits) + s.kwic.length < s.doc_hits
            s.current_page++
            s.gotoPage s.current_page
    s.prevPage = () ->
        if not s.current_page or s.current_page == 0 then return
        s.current_page--
        s.gotoPage s.current_page
        

    s.firstPage = () ->
        s.gotoPage 0
    s.lastPage = () ->
        
        s.gotoPage(s.total_pages - 1)

    s.gotoPage = (page) ->
        if page > (s.total_pages - 1) then return
        s.showGotoHitInput = false
        s.current_page = page
        # n_rows = Math.ceil($(evt.currentTarget).height() / rowHeight)
        # $(".table_viewport").scrollTop(s.getRowHeight() * page)
        from = s.current_page * s.num_hits
        s.search(from, from + s.num_hits)


    s.onGotoHitInput = () ->
        if s.total_pages == 1 then return
        if s.showGotoHitInput
            s.showGotoHitInput = false
            return
        s.showGotoHitInput = true
        $timeout(() ->
            s.$broadcast("focus")
        0)

    
    getSearchArgs = (from, to) ->
        
        filter_params = []
        unless s.filterOpts[0].selected # search all texts is false
            # searchAnom = _.find(s.filterOpts, {key: "is_anom"}).selected
            for groupKey, group of (_.groupBy s.filterOpts, "group")
                if groupKey == "undefined" then continue
                selected = _.filter group, "selected"
                if selected.length == 1
                    filter_params.push selected[0].param


        filter_params = _.object filter_params

        
        args = {
            query : s.query
            # mediatype: getMediatypes()
            from: from
            to: to
        }
        prefix = $location.search().prefix
        suffix = $location.search().suffix
        infix = $location.search().infix
        if prefix or suffix or infix
            args.phrase = false
            if prefix or suffix
                prefix = if prefix then ".*" else ""
                suffix = if suffix then ".*" else ""
                args.query = suffix + args.query + prefix
        _.extend args, filter_params

        if $location.search().sok_om
            args.about_author = true
        if $location.search().forfattare
            args.authors = $location.search().forfattare
        if $location.search().titlar
            args.work_ids = $location.search().titlar


        # if searchAnom
        #     args.anonymous = false

        return args


    s.save_search = (currentIndex) ->
        c.log "save_search", $location.url()
        s.$root.prevSearchState = "/#!" + $location.url()
        # TODO: fix me
        # c.log "save_search", startIndex, currentIndex, data
        # c.log "searchData", searchData

        # searchData.save(startIndex, currentIndex + s.current_page  * s.num_hits, data, getSearchArgs())


    s.getSetVal = (sent, val) ->
        _.str.trim( sent.structs[val], "|").split("|")[0]

    s.selectLeft = (sentence) ->
        if not sentence.match then return
        # c.log "left", sentence.tokens.slice 0, sentence.match.start
        sentence.tokens.slice 0, sentence.match.start

    s.selectMatch = (sentence) ->
        if not sentence.match then return
        from = sentence.match.start
        sentence.tokens.slice from, sentence.match.end

    s.selectRight = (sentence) ->
        if not sentence.match then return
        from = sentence.match.end
        len = sentence.tokens.length
        sentence.tokens.slice from, len

    s.setPageNum = (num) ->
        c.log "setPageNum", num
        s.current_page = num
        s.search()

    s.getMaxHit = () ->
        unless s.kwic then return
        Math.min searchData.total_hits, (s.current_page  * s.num_hits) + s.kwic.length

    onKeyDown = (event) ->
        if event.metaKey or event.ctrlKey or event.altKey or $("input:focus").length then return
        s.$apply () ->
            switch event.which
                when 39 
                    if navigator.userAgent.indexOf("Firefox") != -1 or $rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft") == $($window).width()
                        s.nextPage()
                when 37 
                    if $rootElement.prop("scrollLeft") == 0
                        s.prevPage()

    $document.on "keydown", onKeyDown

    s.$on "$destroy", () ->
        $document.off "keydown", onKeyDown


    # s.sortStruct = [
    #     {label: "SÖK I ALLA TEXTER", val: "lastname", selected: true}
    #     {label: "INKLUDERA KOMMENTARER OCH", val: "imprintyear", selected: false}
    #     {label: "SORTERA EFTER SÖKORDET I ALFABETISK ORDNING", val: "hit", selected: false}
    # ]

    # {label: "Inkludera <span class='sc'>KOMMENTARER & FÖRKLARINGAR</span>", val: "all_texts", selected: true}
    # {label: 'Sök i <span class="sc">svenska</span> orginalverk', val: "lang_swedish", selected: true}
    # {label: 'Sök i texter <span class="sc">översatta</span> från andra språk', val: "trans_from", selected: true}
    # {label: 'Sök i texter <span class="sc">översatta</span> till andra språk', val: "trans_to", selected: true}
    s.filterOpts =  [
        {
            label: "Sök i <span class='sc'>ALLA TEXTER</span>",
            # param: "all_texts",
            selected: true
            key : "all_texts"
        }
        {
            label: 'Sök i <span class="sc">moderniserade</span> texter',
            param: ["modernized", true],
            selected: true
            group : 0
            key : "is_modernized"
        }
        {
            label: 'Sök i <span class="sc">ej moderniserade</span> texter',
            param: ["modernized", false],
            selected: true
            group : 0
            key : "not_modernized"
        }
        {
            label: 'Sök i <span class="sc">korrekturlästa</span> texter',
            param: ["proofread", true],
            selected: true
            group : 1
            key : "is_proofread"
        }
        {
            label: 'Sök i <span class="sc">ej korrekturlästa</span> texter',
            param: ["proofread", false],
            selected: true
            group : 1
            key : "not_proofread"
        }
        {
            label: 'Sök i texter skrivna av <span class="sc">kvinnor</span>',
            param: ["gender", "female"],
            selected: true
            group : 2
            key : "gender_female"
        }
        {
            label: 'Sök i texter skrivna av <span class="sc">män</span>',
            param: ["gender", "male"],
            selected: true
            group : 2
            key : "gender_male"
        }
        # {
        #     label: 'Sök i texter skrivna av <span class="sc">anonyma författare</span>',
        #     selected: true
        #     group : 2
        #     key : "is_anom"
        # }

    ]

    



    s.options = {
        sortSelected : 'lastname'
    }

    s.onSearchSubmit = (query) ->
        $anchorScroll("results")
        # s.resetAuthorFilter()
        s.newSearch(query)        

    s.searchAllInWork = (sentenceObj, index) ->
        searchData.getMoreHighlights(sentenceObj).then (sents) ->
            startIndex = null
            # find section start index
            for i in [index-1..0]
                row = s.sentsWithHeaders[i]
                if row.isHeader
                    startIndex = i
                    break

            s.sentsWithHeaders[startIndex..index] = sents


    s.newSearch = (query) ->
        if hasSearchInit
            s.current_page = 0


        c.log "newSearch", query
        q = query or s.query
        unless q then return
        $location.search("fras", q) if q
        s.query = q
        s.pageTitle = q
        from = s.current_page * s.num_hits
        #TODO: eh?
        to = (from + s.num_hits) - 1
        args = getSearchArgs from, to
        searchData.newSearch args
        return s.search from, to


    # s.search = debounce((query, from, to) ->
    s.search = (from, to) ->
        s.searching = true

        args = getSearchArgs(from, to)
        s.from_index = from

        # def = backend.searchWorks(args)
        def = searchData.slice(from, to)
        def.then ([kwic, sentsWithHeaders, author_aggs]) ->
            c.log "search data slice", searchData.total_hits

            s.kwic = kwic
            # s.hits = searchData.total_hits
            s.doc_hits = searchData.total_doc_hits
            s.total_pages = Math.ceil(s.doc_hits / s.num_hits)

            # TODO: silly, silly hack
            unless $location.search().sok_filter
                s.sentsWithHeaders = sentsWithHeaders
            s.authorStatsData = author_aggs
            s.searching = false
            hasSearchInit = true

        return def
    # , 200)

    # queryvars = $location.search()

    s.opt_change = (opt) ->
        commit = () -> 
            s.search_filter_opts = _.map (_.pluck s.filterOpts, "selected"), Number
        if opt.val == "all_texts" 
            for o in s.filterOpts
                o.selected = true
            commit()
            return

        # isDeselect = opt.selected
        opt.selected = !opt.selected


        group = _.filter s.filterOpts, (o) -> o.group == opt.group
        c.log "group", group

        if not _.any group, "selected"
            i = _.indexOf group, opt
            (group[i + 1] or group[0]).selected = true

            commit()
            return 



        if not _.all s.filterOpts, "selected"
            s.filterOpts[0].selected = false
        if not (_.filter s.filterOpts, "selected").length
            opt.selected = true
        
        if _.all s.filterOpts[1..], "selected"
            s.filterOpts[0].selected = true




        commit()

        




    util.setupHashComplex s,
        [
            scope_name : "current_page"
            key : "traffsida"
            val_in : (val) ->
                Number(val) - 1
            val_out : (val) ->
                val + 1
            default : 1
        ,   
            key : "avancerad"
            scope_name : "advanced"
        ,
            key : "filter"
            scope_name : "search_filter_opts"
            val_in : (val) ->
                for bool, i in val?.split(",")
                    bool = Boolean Number bool
                    s.filterOpts[i].selected = bool

                return val?.split(",")

            val_out : (val) ->
                val?.join(",")


        # ,   
        #     key : "proofread"
        #     default : "all"
        ,
            key : "fras"
            post_change : (val) ->
                c.log "fras val", val
                if val
                    s.newSearch(val)
        ,   
            key : "sok_om"
            scope_name : "isAuthorAboutSearch"
            default : false


        ]

    # if "fras" of queryvars
    #     s.search(queryvars.fras)



littb.controller "biblinfoCtrl", ($scope, backend) ->
    s = $scope
    limit = true
    s.showHit = 0
    s.searching = false
    s.wf = ""

    s.showAll = () ->
        limit = false
    
    s.increment = () ->
        limit = true
        s.entries?[s.showHit + 1] and s.showHit++
    s.decrement = () ->
        limit = true
        s.showHit and s.showHit--

    s.getEntries = () ->
        if limit
            return [s.entries?[s.showHit]]
        else 
            s.entries

    s.getColumn1 = (entry) ->
        pairs = _.pairs entry
        splitAt = Math.floor pairs.length / 2
        _.object pairs[0..splitAt]

    s.getColumn2 = (entry) ->
        pairs = _.pairs entry
        splitAt = Math.floor pairs.length / 2
        _.object pairs[(splitAt + 1)..]
    
    s.submit = () ->
        names = ["manus", "tryckt_material", "annat_tryckt", "forskning"]
        params = ("resurs=" + x for x in names when s[x])
        wf = s.wf if wf
        s.searching = true

        backend.getBiblinfo(params.join("&"), wf).then (data) ->
            s.entries = data
            s.num_hits = data.length
            s.searching = false
            
    s.submit()


littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter) ->
    s = $scope
    _.extend s, $routeParams

    if $route.current.$$route.isSla
        s.slaMode = true
        s.author = "LagerlofS"
        
    s.showpage = null
    s.show_large = false
    s.show_more = true

    s.normalizeAuthor = $filter('normalizeAuthor')

    s.titleSort = titleSort

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById

        s.authorError = (s.normalizeAuthor s.author) not of s.authorsById

    s.showLargeImage = ($event) ->
        c.log "showLargeImage", s.show_large
        if s.show_large then return 
        s.show_large = true
        $event.stopPropagation()

        $document.one "click", (event) ->
            if event.button != 0 then return
            s.$apply () ->
                s.show_large = false
        return

    refreshRoute = () ->
        s.showpage = $location.path().split("/")[3]
        unless s.showpage then s.showpage = "introduktion"
        # if s.showpage == ("titlar" or "mer") then s.showpage = "titlar_mer"
        # s.showpage = "introduktion" if s.author == s.showpage


    # s.getPrimaryMediatype = (works) ->
    #     (s.sortMedia (_.pluck works, "mediatype"))[0]

    # s.mediaOrder = (work) ->
    #     _.indexOf ['etext', 'faksimil', 'epub', 'pdf'], work.mediatype


    # s.sortMedia = (list) ->
    #     order = ['etext', 'faksimil', 'epub', 'pdf']
    #     return _.intersection(order,list).concat(_.difference(list, order))

    # s.getPrimaryUrl = (works) ->
    #     (s.sortMedia works)[0]


    s.getUnique = (worklist) ->
        _.filter worklist, (item) ->
            "/" not in item.titlepath 
    
    s.getPageTitle = (page) ->
        {
           "titlar": "Verk i Litteraturbanken"
           "semer": "Mera om"
           "biblinfo": "Bibliografisk databas"
           "jamfor": "Textkritisk verkstad"
           "omtexterna": "Om texterna"
        }[page] or _.str.capitalize page

    s.getAllTitles = () ->
        [].concat s.groupedTitles, s.groupedWorks, s.groupedEditorWorks

    s.getSearchableTitles = () ->
        titles = s.getAllTitles()

        _.filter (_.flatten titles), (title) -> 
            title?.searchable == "true"

    s.getUrl = (work) ->
        auth = (s.getWorkAuthor work.authors).author_id
        if work.mediatype == "epub" 
            url = "txt/epub/" + auth + "_" + work.work_title_id + ".epub"
        else if work.mediatype == "pdf"
            # url += "info"
            url = "txt/#{work.lbworkid}/#{work.lbworkid}.pdf"

        else
            url = "/#!/forfattare/#{auth}/titlar/#{work.work_title_id}/"
            url += "sida/#{work.startpagename}/#{work.mediatype}"
        return url


    getHtml = (url) ->
        def = $q.defer()
        $http.get(url).success (xml) ->
            from = xml.indexOf "<body>"
            to = xml.indexOf "</body>"
            xml = xml[from...to + "</body>".length]
            def.resolve(_.str.trim xml)
        return def.promise


    if s.slaMode
        getHtml('/red/sla/OmSelmaLagerlofArkivet.html').then (xml) ->
            s.slaIntro = xml

    refreshExternalDoc = (page, routeParams) ->
        # sla hack
        c.log "refreshExternalDoc", page, routeParams.omtexternaDoc
        if s.slaMode
            if page == 'omtexterna' and not routeParams.omtexternaDoc
                doc = 'omtexterna.html'
            else if _.str.endsWith routeParams.omtexternaDoc, ".html"
                doc = routeParams.omtexternaDoc
            if doc
                url = '/red/sla/' + doc
            else 
                url = "/red/forfattare/#{s.author}/#{page}/index.html"
        else    
            # url = s.authorInfo[page]
            if page == "mer" then page = "semer"
            url = "/red/forfattare/#{s.author}/#{page}/index.html"
            c.log "url", url


        return unless url
        
        unless s.showpage in ["introduktion", "titlar"]
            getHtml(url).then (xml) ->
                s.externalDoc = xml
                if s.showpage == "omtexterna"
                    s.pagelinks = harvestLinks(s.externalDoc)
                else
                    s.pagelinks = null



    harvestLinks = (doc) ->
        elemsTuples = for elem in $(".footnotes .footnote[id^=ftn]", doc)
            [$(elem).attr("id"), $(elem).html()]

        s.noteMapping = _.object elemsTuples




    refreshRoute()

    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        _.extend s, current.pathParams

        refreshRoute()  
        # refreshTitle()
        refreshExternalDoc(s.showpage, current.pathParams)
        # refreshBreadcrumb()
    


    # s.hasTitles = () ->
    #     _.any [
    #         s.authorInfo?.works.length
    #         s.authorInfo?.titles.length
    #         s.authorInfo?.editorWorks.length
    #         s.authorInfo?.translatorWorks.length
    #     ]

    # s.getWorkAuthor = (authors) ->
    #     wa = authors[0].workauthor
    #     if wa
    #         return s.authorsById[wa]
    #     else return authors[0]

    s.getDataSource = () ->
        if s.showpage == "titlar"
            s.titleStruct
        else if s.showpage == "mer"
            c.log "showpage mer"
            s.moreStruct


    s.sortOrder = (works) ->
        works[0].sortkey

    s.hasMore = () ->
        (_.flatten _.pluck s.moreStruct, "data").length

    s.titleStruct = [
            label : "Tillgängliga verk"
            data : null
            showAuthor : ""
        ,
            label : "Dikter, noveller, essäer, etc. som ingår i andra verk"
            data : null
            showAuthor : "work_authors"
        ,
            label : "Som utgivare"
            data : null
            showAuthor : "authors"
        ,
            label : "Som översättare"
            data : null
            showAuthor : "authors"
    ]

    backend.getTextByAuthor(s.author, "etext,faksimil,pdf").then (data) ->
        c.log "getWorksByAuthor", data
        s.titleStruct[0].data = data

    backend.getPartsInOthersWorks(s.author, "part").then (data) ->
        c.log "getWorksByAuthor part", data
        s.titleStruct[1].data = data

    backend.getTextByAuthor(s.author, "etext,faksimil,pdf,part", "editor").then (data) ->
        c.log "editor works", data
        s.titleStruct[2].data = data
    
    backend.getTextByAuthor(s.author, "etext,faksimil,pdf,part", "translator").then (data) ->
        c.log "translator works", data
        s.titleStruct[3].data = data

    



    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data

        refreshExternalDoc(s.showpage, $routeParams)



        s.moreStruct = [
                label : "Verk om #{s.authorInfo.full_name}"
                data : null
                showAuthor : "authors"
            ,
                label : "Kortare texter om #{s.authorInfo.full_name}"
                data : null
                showAuthor : "work_authors"
            ,
                label : "Som utgivare"
                data : null
                showAuthor : "authors"
            ,
                label : "Som översättare"
                data : null
                showAuthor : "authors"
        ]

        # TODO: this doesn't work at all.
        backend.getTextByAuthor(s.author, "etext,faksimil,pdf", null, true).then (data) ->
            c.log "about getWorksByAuthor", data
            s.moreStruct[0].data = data

        backend.getPartsInOthersWorks(s.author, true).then (data) ->
            c.log "about getPartsInOthersWorks", data
            s.moreStruct[1].data = data

        backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "editor", true).then (data) ->
            c.log "about editor works", data
            s.moreStruct[2].data = data
        
        backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "translator", true).then (data) ->
            c.log "about translator works", data
            s.moreStruct[3].data = data    


    ###
    # backend.getAuthorInfo(s.author).then (data) ->
    #     s.authorInfo = data
        
        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "titlepath"
        s.groupedTitles = _.values _.groupBy s.authorInfo.titles, "titlepath"
        s.groupedEditorWorks = _.values _.groupBy s.authorInfo.editorWorks, "titlepath"
        s.groupedTranslatorWorks = _.values _.groupBy s.authorInfo.translatorWorks, "titlepath"
        
        s.groupedAboutWorks = _.values _.groupBy s.authorInfo.aboutWorks, "titlepath"
        s.groupedAboutTitles = _.values _.groupBy s.authorInfo.aboutTitles, "titlepath"
        s.groupedAboutEditorTitles = _.values _.groupBy s.authorInfo.aboutEditorTitles, "titlepath"
        s.groupedAboutTranslatorTitles = _.values _.groupBy s.authorInfo.aboutTranslatorTitles, "titlepath"


        s.titleStruct = [
                label : "Tillgängliga verk"
                data : s.groupedWorks
                showAuthor : false
            ,
                label : "Dikter, noveller, essäer, etc. som ingår i andra verk"
                data : s.groupedTitles
                showAuthor : true
            ,
                label : "Som utgivare"
                data : s.groupedEditorWorks
                showAuthor : true
            ,
                label : "Som översättare"
                data : s.groupedTranslatorWorks
                showAuthor : true
        ]

        # gen_author = if _.str.endsWith("s") then s.authorInfo.fullName else s.authorInfo.fullName + "s"

        s.moreStruct = [
                label : "Verk om #{s.authorInfo.fullName}"
                data : s.groupedAboutWorks
                showAuthor : true
            ,
                label : "Kortare texter om #{s.authorInfo.fullName}"
                data : s.groupedAboutTitles
                showAuthor : true
            ,
                label : "Som utgivare"
                data : s.groupedAboutEditorTitles
                showAuthor : true
            ,
                label : "Som översättare"
                data : s.groupedAboutTranslatorTitles
                showAuthor : true
        ]

        c.log "data.surname", data.surname
        # $rootScope.appendCrumb 
        #     label : data.surname
        #     url : "#!/forfattare/" + s.author
        # if s.showpage != "introduktion"
        #     refreshBreadcrumb()
        # refreshTitle()
        refreshExternalDoc(s.showpage, $routeParams)

        if not s.authorInfo.intro and s.showpage == "introduktion"
            $location.path("/forfattare/#{s.author}/titlar").replace()
    
        ###
    
littb.controller "libraryCtrl", ($scope, backend, util, $timeout, $location, authors, $rootElement, $anchorScroll, $q, $filter) ->
    s = $scope
    s.titleSearching = false
    s.authorSearching = true
    s.showPopular = true
    s.showPopularAuth = true
    s.showInitial = true
    # s.rowByLetter = {}

    s.normalizeAuthor = $filter('normalizeAuthor')

    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.showtitle == attrs.title

    s.filterTitle = (row) ->    
        auths = (_.map row.authors, (auth) ->
            return auth.full_name
        ).join(" ")

        exprs = s.rowfilter.split(" ")

        return _.all exprs, (expr) ->
            new RegExp(expr, "i").test((row.title + " " + row.shorttitle + " " + auths))

        

    s.filterAuthor = (author) ->
        exprs = s.rowfilter?.split(" ")

        return _.all exprs, (expr) ->
            pseudonym = (_.pluck author.pseudonym, "full_name").join(" ")
            new RegExp(expr, "i").test((author.full_name + pseudonym))

    s.resetView = () ->
        s.showInitial = true
        s.showPopularAuth = true
        s.showPopular = true

        s.filter = ""
        s.rowfilter = ""
        s.all_titles = null

    s.mediatypeObj = 
        etext : if $location.search().etext then false else true
        faksimil : if $location.search().faksimil then false else true
        epub : if $location.search().epub then false else true
        pdf : if $location.search().pdf then false else true

    s.mediatypeFilter = (row) ->
        # return true
        # c.log "row.mediatype", row.mediatype
        s.mediatypeObj
        _.any _.map row.mediatypes, (mtObj) -> 
            s.mediatypeObj[mtObj.label]
        

    # s.titleFilter = (row) ->
    #     row.title_path.split("/").length > 1

    s.hasMediatype = (titleobj, mediatype) ->
        mediatype in (_.pluck titleobj.mediatypes, "label")

    s.pickMediatypes = (titleobj, mediatypeLabels) ->
        _.filter titleobj.mediatypes, (item) -> item.label in mediatypeLabels


    s.getTitleUrl = (titleobj) ->
        mediatype = s.sortMedia(titleObj.mediatype)[0]


    s.sortMedia = (list) ->
        order = ['etext', 'faksimil', 'epub', 'pdf']
        return _.intersection(order,list).concat(_.difference(list, order))

    s.getTitleId = (row) ->
        row.work_title_id

    s.getUniqId = (title) ->
        unless title then return
        title.lbworkid + (title.titlepath.split('/')[1] or "")
        

    s.authorRender = () ->
        c.log "authorRender"
        # s.$apply () ->
        if $location.search()['author']
            auth = s.authorsById[$location.search()['author']]
            s.authorClick(null, auth)

            s.$emit("listScroll", $location.search()['author'])


    s.titleRender = () ->
        if $location.search()['title']
            # fetchWorks().then () ->
            title = s.titleByPath?[$location.search()['title']][0]
            s.titleClick(null, title)
            id = s.getUniqId title
            s.$emit("listScroll", id)
                


    # use timeout to make sure the page shows before loading authors
    $timeout () ->
        authors.then ([authorList, authorsById]) ->
            s.authorsById = authorsById
            s.authorData = authorList
            s.authorSearching = false

        backend.getPopularAuthors().then (auths) ->
            s.popularAuthors = auths
        
    , 10

    s.getAuthorData = () ->
        if s.showPopularAuth
            s.popularAuthors
        else
            s.authorData

    s.searchTitle = () ->
        c.log "searchTitle", s.filter
        s.selectedAuth = null
        s.selectedTitle = null
        s.rowfilter = s.filter
        if s.rowfilter
            s.showInitial = false
            s.showPopularAuth = false
            s.showPopular = false
            fetchTitles()
            fetchWorks()
            backend.logLibrary(s.rowfilter)
        else
            s.resetView()



    fetchTitles = () ->
        # unless s.filter then return
        backend.getParts(s.rowfilter).then (titleArray) ->
            s.all_titles = titleArray



    fetchWorks = () ->
        s.titleSearching = true
        def = backend.getTitles(false, s.authorFilter, null, s.filter).then (titleArray) ->
            s.titleSearching = false
            s.titleArray = titleArray
            # s.titleGroups = titleGroups
            s.titleByPath = _.groupBy titleArray, (item) ->
                return item.titlepath

            return titleArray

        return def
    
    s.showAllWorks = () ->
        s.showPopular = false
        s.filter = ""
        s.rowfilter = ""
        fetchWorks()

    s.getUrl = (row, mediatype) ->
        author_id = row.authors[0].workauthor or row.authors[0].author_id

        if mediatype == "epub" 
            url = "txt/epub/" + author_id + "_" + row.work_title_id + ".epub"
        else if mediatype == "pdf"
            url = "txt/#{row.lbworkid}/#{row.lbworkid}.pdf"
        else
            url = "/#!/forfattare/#{author_id}/titlar/#{s.getTitleId(row)}/" +
                 "sida/#{row.startpagename}/#{mediatype}"

        return url


    s.authorClick = ($event, author) ->
        unless s.selectedAuth == author
            s.selectedAuth?._collapsed = false
        
        s.selectedAuth = author

        $location.search("author", author.author_id)
        author._infoSearching = true
        backend.getAuthorInfo(author.author_id).then (data) ->
            author._collapsed = true
            author.data = data
            author._infoSearching = false

    s.authorHeaderClick = ($event, author) ->
        if s.selectedAuth == author and author._collapsed
            author._collapsed = false
            $event?.stopPropagation()

    s.titleHeaderClick = ($event, title) ->
        if s.selectedTitle == title and title._collapsed
            title._collapsed = false
            $event?.stopPropagation()

    s.titleClick = ($event, title) ->
        unless s.selectedTitle == title
            s.selectedTitle?._collapsed = false

        s.selectedTitle = title
        s.selectedTitle._collapsed = true
        $location.search("title", title.titlepath)

    ###
    getWorkIntro = (author, titlepath) ->
        s.sourcedesc = null
        # TODO: i think this broke
        infoDef = backend.getSourceInfo(author, work_title_id)
        infoDef.then (data) ->
            c.log "source", data
            s.workintro = data.workintro
            # s.error = false
            # s.data = data
            # if not s.mediatype
            #     s.mediatype = s.data.mediatypes[0]
        , (reason) -> # reject callback 
            # s.data = {}
            # s.error = true
        return infoDef
    ###

    s.getPartAuthor = (part) ->
        part.authors?[0] or part.work_authors[0]


    if $location.search().filter
        s.filter = $location.search().filter
    s.searchTitle()

    util.setupHashComplex s,
        [
            key : "filter"
            # scope_name : "rowfilter"
            replace : false
        ,
            key : "ej_etext"
            expr : "!mediatypeObj.etext"
            replace : false
        ,
            key : "ej_faksimil"
            expr : "!mediatypeObj.faksimil"
            replace : false
        ,
            key : "ej_epub"
            expr : "!mediatypeObj.epub"
            replace : false
        ,
            key : "ej_pdf"
            expr : "!mediatypeObj.pdf"
            replace : false
        ,
            key : "populara"   
            scope_name : "showPopular"

            key : "forfattare"
            scope_name : "authorFilter"
            replace : false
        ]

    onceFetchWorks = _.once () ->
        fetchWorks()

    s.listVisibleTitles = () ->
        if s.showInitial and s.showPopular
            s.popularTitles
        else
            return s.titleArray

    s.titleSearching = true

    def = backend.getTitles(false, null, "popularity|desc").then (titleArray) ->
        s.titleSearching = false
        s.popularTitles = titleArray
        # s.titleArray = titleArray
        # s.titleGroups = titleGroups
        s.titleByPath = _.groupBy titleArray, (item) ->
            return item.titlepath

        return titleArray


littb.controller "epubListCtrl", ($scope, backend, util, authors, $filter) ->
    s = $scope
    s.searching = true


    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById

    # s.authorSelectSetup = getAuthorSelectSetup(s, $filter)


    s.authorSelectSetup = {
        formatNoMatches: "Inga resultat",
        formatResult : (data) ->
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


    # TODO: what about the workauthor issue?
    s.sorttuple = [["authors[0].name_for_index", "sortkey"], false]
    s.setSort = ([sortstr]) ->
        alternate = {
            "authors[0].name_for_index" : "sortkey"
            "sortkey" : "authors[0].name_for_index"
        }[sortstr]
        s.sorttuple[0] = [sortstr, alternate]
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    window.has = (one, two) -> one.toLowerCase().indexOf(two.toLowerCase()) != -1
    s.rowFilter = (item) ->
        author = s.authorsById?[s.authorFilter]
        if author and author.author_id != item.authors[0].author_id then return false
        if s.filterTxt
            return false if not ((has item.authors[0].full_name, s.filterTxt) or (has item.showtitle, s.filterTxt))
        return true

    s.getAuthor = (row) ->
        [last, first] = row.authors[0].name_for_index.split(",")

        (_.compact [last.toUpperCase(), first]).join ","

    s.log = (filename) ->
        return true

    s.fetchEpub = (row) ->
        filename = s.getFilename(row)
        backend.logDownload(row.authors[0].surname, row.shorttitle, row.lbworkid)
        location.href = "/txt/epub/#{filename}.epub"


    s.getFilename = (row) ->
        row.authors[0].author_id + '_' + row.title_id


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : "authors[0].name_for_index,sortkey"
            val_in : (val) ->
                val?.split(",")
            val_out : (val) ->
                val?.join(",")
            # post_change : () ->
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
        ,
            key : "filter"
            scope_name : "filterTxt"
        ]

    
    backend.getEpub().then (titleArray) ->
        s.searching = false
        s.rows = titleArray
        authors = _.map s.rows, (row) ->
            row.authors[0]

        s.authorData = _.unique authors, false, (item) ->
            item.author_id




littb.controller "helpCtrl", ($scope, $http, util, $location) ->
    s = $scope
    url = "/red/om/hjalp/hjalp.html"
    $http.get(url).success (data) ->
        s.htmlContent = data
        s.labelArray = for elem in $("[id]", data)
            label = _.str.humanize($(elem).attr("name").replace(/([A-Z])/g, " $1"))

            label : label
            id : $(elem).attr("id")
            
        
        # util.setupHashComplex s, [
        #     "key" : "ankare"
        #     post_change : (val) ->
        #         c.log "post_change", val
        #         unless val and $("##{val}").length
        #             $(window).scrollTop(0)
        #             return
        #         $(window).scrollTop($("##{val}").offset().top)
        #     replace : false
        # ]

littb.controller "newCtrl", ($scope, $http, util, $location) ->
littb.controller "aboutCtrl", ($scope, $http, util, $location, $routeParams) ->
    s = $scope
    # s.$watch ( () -> $routeParams.page), () ->
    #     c.log "$routeParams.page", $routeParams.page
    _.extend s, $routeParams
    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        c.log "route change", current.pathParams
        _.extend s, current.pathParams



    s.page = $routeParams.page
    s.getPage = (page) ->
        return {
                "ide" : '/red/om/ide/omlitteraturbanken.html'
                "hjalp" : "views/help.html"
                "kontakt" : 'views/contactForm.html'
                "statistik" : 'views/stats.html'
                "rattigheter" : '/red/om/rattigheter/rattigheter.html'
                "inenglish" : "/red/om/ide/inenglish.html"
            }[page]

littb.controller "presentationCtrl", ($scope, $http, $routeParams, $location, util) ->
    s = $scope
    url = '/red/presentationer/presentationerForfattare.html'
    s.isMain = true
    $http.get(url).success (data) ->
        s.doc = data
        s.currentLetters = for elem in $("[id]", data)
            $(elem).attr("id")
        util.setupHash s, {"ankare" : (val) ->
            unless val
                $(window).scrollTop(0)
                return
            $(window).scrollTop($("##{val}").offset().top)
        }

littb.controller "omtexternaCtrl", ($scope, $routeParams) ->
    docPath = '/red/sla/omtexterna/'
    $scope.doc = docPath + ($routeParams['doc'] or 'omtexterna.html')
    


littb.filter "correctLink", () ->
    (html) ->
        wrapper = $("<div>").append html
        img = $("img", wrapper)
        img.attr "src", "/red/bilder/gemensamt/" + img.attr("src")
        return wrapper.html()


littb.controller "autocompleteCtrl", ($scope, backend, $route, $location, $window, $timeout) ->
    s = $scope
    c.log ($route)
    close = () ->
        s.lbworkid = null
        s.$broadcast("blur")
        s.show_autocomplete = false
        s.completeObj = null


    s.onSelect = (val) ->
        ret = val.action?()
        if ret == false then return
        close()
        if val.url
            $location.url(val.url)
    s.autocomplete = (val) ->
        if val
            return backend.autocomplete(val).then (data) ->
                menu = [
                        label: "/start"
                        url : "/start"
                    ,
                        label: "/bibliotek"
                        url : "/bibliotek"
                    ,
                        label: "/epub"
                        url : "/epub"
                    ,
                        label: "/sök"
                        url : "/sok"
                    ,
                        label: "/sok"
                        url : "/sok"
                    ,
                        label: "/presentationer"
                        url : "/presentationer"
                    ,
                        label: "/nytillkommet"
                        url : "/nytillkommet"
                    ,
                        label: "/skolan"
                        url : "/skolan"
                    ,
                        label: "/skolan/lyrik"
                        url : "/skolan/lyrik"
                    ,
                        label: "/om"
                        url : "/om/ide"
                    ,
                        label: "/statistisk"
                        url : "/om/statistik"

                ]

                if $route.current.$$route.controller == "readingCtrl"
                    menu.push 
                        label : "/id"
                        action : () ->
                            s.lbworkid = $(".reader_main").scope?().workinfo.lbworkid
                            return false


                menu = _.filter menu, (item) ->
                    item.label.match(val)
                c.log "menu", menu
                return data.concat menu




    s.show_autocomplete = false

    $($window).on "keyup", (event) ->
        #tab
        if event.which == 83 and not $("input:focus,textarea:focus,select:focus").length
            s.$apply () ->
                s.show_autocomplete = true
                $timeout () ->
                    s.$broadcast("focus")
                , 0



        else if event.which == 27 # escape
            s.$apply () ->
                close()



littb.controller "idCtrl", ($scope, backend, $routeParams, $location) ->
    s = $scope
    _.extend s, $routeParams
    s.id = s.id?.toLowerCase()
    s.titles = []
    unless _.str.startsWith s.id, "lb"
        s.titles = [s.id]
        s.id = ""

    backend.getTitles().then (titleArray) ->
        s.data = titleArray

    s.idFilter = (row) ->
        unless s.id then return true
        row.lbworkid == s.id

    s.rowFilter = (row) ->
        if not s.titles.length then return true
        return _.any _.map s.titles, (title) ->
            _.str.contains(row.titlepath.toLowerCase(), title?.toLowerCase()) or
                _.str.contains(row.title.toLowerCase(), title?.toLowerCase())


    s.textareaChange = (titles)  ->
        s.id = ''

        s.titles = _.map titles.split("\n"), (row) ->
            _.str.strip(row.split("–")[1] or row)

littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams, $q, authors, $document, $location, $http) ->
    s = $scope
    {title, author} = $routeParams
    # _.extend s, $routeParams
    s.title = $routeParams.title
    s.author = $routeParams.author


    s.defaultErrataLimit = 8
    s.errataLimit = s.defaultErrataLimit
    s.isOpen = false
    s.show_large = false

    s.workinfoPromise.then () ->
        c.log "workinfo", s.workinfo
        prov = backend.getProvenance(s.workinfo)
        lic = backend.getLicense(s.workinfo)

        $q.all([prov, lic]).then ([provData, licenseData]) ->
            s.provenanceData = provData
            s.licenseData = _.template(licenseData)({
                provenance: "<a href='#{provData[0].link}'>#{provData[0].fullname}</a>"
            })




    s.getValidAuthors = () ->
        unless s.authorById then return
        # _.filter s.workinfo?.author_idNorm, (item) ->
        #     item.id of s.authorById
        return s.workinfo?.authors

    s.toggleErrata = () ->
        s.errataLimit = if s.isOpen then 8 else 1000
        s.isOpen = !s.isOpen

    s.getUrl = (mediatype) ->
        if mediatype == "epub" 
            return s.workinfo?.epub.url
            
        else if mediatype == "pdf" 
            return s.workinfo?.pdf.url

        return "/#!/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"

    s.getOtherMediatypes = () ->
        (x for x in (s.workinfo?.mediatypes or []) when x != s.mediatype)

    s.getReadMediatypes = () ->
        read = ['etext', 'faksimil']
        (x for x in (s.workinfo?.mediatypes or []) when x.label in read)
    
    s.getDownloadMediatypes = () ->
        (x for x in (s.workinfo?.mediatypes or []) when x.downloadable)
        

    s.getSourceImage = () ->
        if s.workinfo
            "/txt/#{s.workinfo.lbworkid}/#{s.workinfo.lbworkid}_small.jpeg"

    s.showLargeImage = ($event) ->
        if s.show_large then return 
        s.show_large = true
        $event.stopPropagation()

        $document.one "click", (event) ->
            if event.button != 0 then return
            s.$apply () ->
                s.show_large = false
        return

    
    s.getFileSize = (mediatype) ->
        # TODO: this is broken
        if not (s.workinfo and mediatype) then return
        size = s.workinfo[mediatype].file_size

        kb = size / 1024

        return (Math.round kb) + " KB"

    s.downloadFile = (url) ->
        window.location = url


    if not s.mediatype
        s.mediatype = s.workinfo.mediatypes[0]
    authors.then ([authorData, authorById]) ->
        s.authorById = authorById

littb.controller "lexiconCtrl", ($scope, backend, $location, $rootScope, $q, $timeout, $modal, util, $window) ->
    s = $scope
    s.dict_not_found = null
    s.dict_searching = false

    modal = null

    # $($window).on "keyup", (event) ->
    #     if event.which == 83 and not $("input:focus,textarea:focus,select:focus").length
    #         s.$broadcast "focus"

    s.keydown = (event) ->
        if event.keyCode == 40 # down arrow
            # TODO: this is pretty bad but couldn't be done using the typeahead directive
            if $(".input_container .dropdown-menu").is(":hidden")
                #typeaheadTrigger directive
                s.$broadcast "open", s.lex_article

        else if event.keyCode == 27 # escape
            s.lex_article = null    


    s.showModal = () ->
        c.log "showModal", modal
        s.lexemes = s.lex_article.lexemes
        unless modal
            s.$broadcast "blur"

            modal = $modal.open
                templateUrl : "so_modal_template.html"
                scope : s

            modal.result.then () ->
                s.closeModal()
            , () ->
                s.closeModal()


    s.clickX = () ->
        modal.close()

    s.closeModal = () ->
        s.lex_article = null
        s.lexid = null
        modal = null


    reportDictError = () ->
        s.$emit "notify", "Hittade inget uppslag"
        s.dict_searching = false

    s.lexid = null


    $rootScope.$on "search_dict", (event, lemma, id, doSearchId) ->
        c.log "search_dict event", lemma, id, doSearchId
        if doSearchId then s.lexid = false

        s.dict_searching = true

        def = backend.searchLexicon(lemma, id, false, doSearchId, true)
        def.catch () ->
            c.log "searchLexicon catch"
            reportDictError()

        def.then (data) ->
            c.log "searchLexicon then", data
            s.dict_searching = false

            result = data[0]
            for obj in data
                if obj.baseform == lemma
                    result = obj
                    continue

                    
            # c.log "searchId", id
            # s.lexid = if searchId then searchId else null
            s.lex_article = result
            if id
                s.lexid = id
            s.showModal()
            

    s.getWords = (val) ->
        c.log "getWords", val
        unless val then return
        s.dict_searching = true
        def = backend.searchLexicon(val, null, true)
        timeout = $timeout(angular.noop, 800)
        def.catch () ->
            s.dict_searching = false
            reportDictError()

        $q.all([def, timeout]).then () ->
            s.dict_searching = false
            

        return def



    util.setupHashComplex s, [
        key : "so"
        expr : "lex_article.baseform"
        val_in : (val) ->
            id = $location.search().lex
            # event = if id then "search_id" else "search_dict"
            c.log "val_in", val, id
            s.$emit "search_dict", val, id, false
        replace : false            
    ,
        key : "lex"
        scope_name : "lexid"
        replace : false

    ]



littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, SearchWorkData, debounce, $timeout, $rootScope, $document, $window, $rootElement, authors, $modal, $templateCache, $http, $q, $filter) ->
    s = $scope
    s.isEditor = false
    s._ = {humanize : _.humanize}

    $window.scrollTo(0, 0)
    t = $.now()

        
    {title, author, mediatype, pagename} = $routeParams
    _.extend s, (_.pick $routeParams, "title", "author", "mediatype")

    if "ix" of $routeParams
        s.isEditor = true
        s.pageix = Number $routeParams.ix
        mediatype = s.mediatype = {'f' : 'faksimil', 'e' : 'etext'}[s.mediatype]

    s.pageToLoad = pagename

    s.searchData = searchData = null
    s.loading = true
    s.first_load = false
    onFirstLoad = _.once () ->
        $timeout( () ->
            $("html, body").animate({ scrollLeft: "1000px"}, 1000)
        , 0)
    s.showPopup = false
    s.error = false
    s.show_chapters = false # index modal

    s.normalizeAuthor = $filter('normalizeAuthor')

    h = $(window).height()
    w = $(window).width()

    s.fontSizeFactor = h / 900
    $rootScope._night_mode = false
    s.isFocus = false
    s.showFocusBar = true
    s.isOcr = () ->
        $location.search().ocr?

    s.activateFocus = () ->
        s.isFocus = true
        s.showFocusBar = true

    s.hasSearchable = (authorid) ->
        unless authorid then return
        s.authorById?[author].searchable

    s.closeFocus = (event) ->
        # event.stopPropagation()
        s.isFocus = false


    s.incrFontSize = (event, fac) ->
        event.stopPropagation()
        s.fontSizeFactor += fac

    s.getFontSizeFactor = () ->
        if s.isFocus then s.fontSizeFactor else 1

    s.getTransform = () ->
        unless s.isFocus then return {}
        prefixes = ["", "-webkit-", "-o-", "-moz-", "-ms-"]
        val = "scaleX(#{s.fontSizeFactor}) scaleY(#{s.fontSizeFactor})"
        addPrefixes = (rule) ->
            _.map prefixes, (p) -> p + rule

        out = {}
        for [to, t] in _.zip (addPrefixes "transform-origin"), (addPrefixes "transform")
            out[t] = val
            out[to] = "top"

        return out

    s.openModal = () ->
        s.show_about = true  
        

    s.onPartClick = (startpage) ->
        s.gotopage(startpage)
        s.showPopup = false
        s.show_chapters = false

    s.resetHitMarkings = () ->
        for key in ["traff", "traffslut", "x", "y", "height", "width"]
            s[key] = null
    
    thisRoute = $route.current

    changeHit = (newHit) ->
        c.log "newHit", newHit
        from_id = newHit.highlights[0].wid
        to_id = _.last(newHit.highlights).wid
        s.gotopage(newHit.highlights[0].n)
        s.markee_from = from_id
        s.markee_to = to_id
        $location.search("hit_index", newHit.order)

    s.nextHit = () ->
        searchData.next().then changeHit
    
    s.prevHit = () ->
        searchData.prev().then changeHit

    s.close_hits = () ->
        searchData.reset()
        s.show_search_work = false

    onKeyDown = (event) ->
        if event.metaKey or event.ctrlKey or event.altKey then return
        s.$apply () ->
            switch event.which
                when 39 
                    if navigator.userAgent.indexOf("Firefox") != -1 or $rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft") == $($window).width()
                        s.nextPage()
                when 37 
                    if $rootElement.prop("scrollLeft") == 0
                        s.prevPage()

    $document.on "keydown", onKeyDown

    s.getPage = () ->
        if s.isEditor
            $route.current.pathParams.ix
        else
            $route.current.pathParams.pagename
    

    s.setPage = (ix) ->
        s.pageix = ix
        s.pageToLoad = s.pagemap["ix_" + s.pageix]

    s.getStep = (ix) ->
        s.stepmap[ix] or s.pagestep or 1

    
    s.nextPage = (event) ->
        event?.preventDefault()
        if s.isEditor
            # s.pageix = s.pageix + s.getStep()
            s.pageix = s.pageix + 1
            s.pageToLoad = s.pageix
            return
        unless s.endpage then return
        # newix = s.pageix + s.getStep()
        newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        # else
        #     s.setPage(0)
    
    s.prevPage = (event) ->
        event?.preventDefault()
        unless s.pagemap then return
        if s.isEditor
            # s.pageix = s.pageix - s.getStep()
            s.pageix = s.pageix - 1
            s.pageToLoad = s.pageix
            return
        # newix = s.pageix - s.getStep()
        newix = s.pageix - 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)

    
    s.isBeforeStartpage = () ->
        if s.isEditor then return false
        unless s.pagemap then return
        startix = s.pagemap["page_" + s.startpage]
        s.pageix <= startix

    s.getFirstPageUrl = () ->
        if s.isEditor
            "/#!/editor/#{$routeParams.lbid}/ix/0/#{$routeParams.mediatype}"
        else
            "/#!/forfattare/#{author}/titlar/#{title}/sida/#{s.startpage}/#{mediatype}"
    
    s.getPrevPageUrl = () ->
        unless s.pagemap then return
        # newix = s.pageix - s.getStep()
        newix = s.pageix - 1
        if "ix_" + newix of s.pagemap
            page = s.pagemap["ix_" + newix]
            "/#!/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{mediatype}"
        else
            ""
    
    s.getNextPageUrl = () ->
        unless s.endpage then return
        if s.pageix == s.pagemap["page_" + s.endpage] then return
        # newix = s.pageix + s.getStep()
        newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            page = s.pagemap["ix_" + newix]
            "/#!/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{mediatype}"
        else
            ""
    
    s.getLastPageUrl = () ->
        if s.isEditor
            "/#!/editor/#{$routeParams.lbid}/ix/#{s.endIx}/#{$routeParams.mediatype}"
        else
            "/#!/forfattare/#{author}/titlar/#{title}/sida/#{s.endpage}/#{mediatype}"

    s.getPageUrl = (page) ->
        unless page then return ""
        search = $location.url().split("?")?[1]
        suffix = ""
        if search
            suffix = "?" + search

        "/#!/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{s.mediatype}" + suffix

    s.gotopage = (page, event) ->
        s.showGotoInput = false
        c.log "preventDefault", page
        event?.preventDefault()
        ix = s.pagemap["page_" + page]
        if s.isEditor
            s.pageix = ix
            s.pageToLoad = ix
        else
            s.setPage ix

    s.onGotoClick = () ->
        if s.showGotoInput
            s.showGotoInput = false
            return
        s.showGotoInput = true
        $timeout(() ->
            s.$broadcast("focus")
        0)

    s.toStartPage = (event) ->
        event?.preventDefault()
        if s.isEditor
            s.pageix = 0
            s.pageToLoad = 0
        else
            s.gotopage(s.startpage)

    s.mouseover = (event) ->
        c.log "mouseover"
        s.showPopup = true


    # onClickOutside = () ->
    #     s.$apply () ->
    #         s.showPopup = false

    # $document.on "click", onClickOutside


    s.getTooltip = (part) ->
        return part.showtitle if part.navtitle != part.showtitle

    s.getCurrentPart = () ->
        unless s.workinfo then return
        outputPart = null
        for part in s.workinfo.parts by -1 #backwards
            startix = s.pagemap["page_" + part.startpagename] 
            endix = s.pagemap["page_" + part.endpagename] 
            if (s.pageix <= endix) and (s.pageix >= startix)
                outputPart = part
                break


        return outputPart


    s.getNextPart = () ->
        if not (s.workinfo and s.workinfo.parts.length) then return
        current = s.getCurrentPart()

        if not current
            # is page before first part?
            startix = s.pagemap["page_" + s.workinfo.parts[0].startpagename]
            if s.pageix < startix
                i = -1
            else 
                return
        else
            i = _.indexOf s.workinfo.parts, current

        return s.workinfo?.parts[i + 1]

    s.getPrevPart = () ->
        current = s.getCurrentPart()
        if not s.workinfo or not current then return
        i = _.indexOf s.workinfo.parts, current
        return s.workinfo?.parts[i - 1]

    s.toggleParallel = () ->
        s.isParallel = !s.isParallel

    s.supportsParallel = () ->
        unless s.workinfo then return
        'etext' in s.workinfo.mediatypes and 'faksimil' in s.workinfo.mediatypes

    s.getValidAuthors = () ->
        unless s.authorById then return
        return s.workinfo?.authors
        # _.filter s.workinfo?.authors, (item) ->
        #     item.id of s.authorById

    authors.then ([authorData, authorById]) ->
        s.authorById = authorById


    s.size = $location.search().size or 3
    c.log "s.size", s.size
    
    recalcCoors = (val) ->
        unless s.x then return
        s.coors = for item, i in s.x.split("|")
            pairs = _.pairs _.pick s, "x", "y", "height", "width"
            _.object _.map pairs, ([key, val]) ->
                [key, val.split("|")[i].split(",")[s.size - 1]]
    chapter_modal = null
    about_modal = null
    util.setupHashComplex s, [
            scope_name : "markee_from"
            key : "traff"
            replace : false
        ,
            scope_name : "markee_to"
            key : "traffslut"
            replace : false
        ,
            key : "x"
            replace : false
            post_change: recalcCoors
                
        ,
            key : "y"
            replace : false
            post_change: recalcCoors
        ,
            key : "width"
            replace : false
            post_change: recalcCoors
        ,
            key : "height"
            replace : false
            post_change: recalcCoors
        ,
            key : "parallel"
            scope_name : "isParallel"
        ,   
            key : "fokus"
            scope_name : "isFocus"
            post_change : (val) ->
                $rootScope._focus_mode = val
        ,
            key : "border"
        ,
            key: "show_search_work"
        ,
            key : "om-boken"
            scope_name : "show_about"
            default: "lol"
            post_change : (val) ->
                if val
                    about_modal = $modal.open
                        templateUrl : "sourceInfoModal.html"
                        scope : s
                        windowClass : "about"


                    about_modal.result.then () ->
                        s.show_about = false
                    , () ->
                        s.show_about = false
                else
                    about_modal?.close()
                    about_modal = null
            
        ,
            key : "innehall"
            scope_name : "show_chapters"
            post_change : (val) ->
                if val

                    chapter_modal = $modal.open
                        templateUrl: "chapters.html"
                        scope: s
                        windowClass : "chapters"

                    chapter_modal.result.then () ->
                        s.show_chapters = false
                    , () ->
                        s.show_chapters = false

                else
                    chapter_modal?.close()
                    chapter_modal = null
        # ,
        #     key : "fras"
        #     scope_name : "search_query"
            # post_change : (val) ->
            #     if val

                    

    ]
    
    # s.showFocusBar = s.isFocus
    if mediatype == "faksimil"
        util.setupHashComplex s, [
                key: "storlek"
                scope_name : "size"
                val_in : Number
                # val_out : (val) ->
                #     val + 1
                default : 3
                post_change: recalcCoors
                    
        ]



    watches = []
    watches.push s.$watch "pageToLoad", (val) ->
        # c.log "pagename", val
        unless val? then return
        s.displaynum = val
        if s.isEditor
            url = "/editor/#{$routeParams.lbid}/ix/#{val}/#{$routeParams.mediatype}"
        else
            url = "/forfattare/#{author}/titlar/#{title}/sida/#{val}/#{mediatype}"

        prevpath = $location.path()

        loc = $location.path(url)
        if !s.isEditor and not _.str.contains prevpath, "/sida/"
            c.log "replace", prevpath
            loc.replace()
    # ), 300, {leading:true})

    s.isDefined = angular.isDefined
    s.getOverlayCss = (obj) ->
        unless s.overlayFactors then return {}
        fac = s.overlayFactors[s.size - 1]
        {
            left: (fac * obj.x) + 'px'
            top: fac * obj.y + 'px'
            # width : fac * obj.w
            # height : fac * obj.h
        }

    overlayDef = $q.defer()
    s.onOverlayComplete = () ->
        overlayDef.resolve()
        

    initSourceInfo = () ->
        key = if title then "titlepath" else "lbworkid"
        value = if title then title else $routeParams.lbid
        def = backend.getSourceInfo(key, value)
        s.workinfoPromise = def 
        def.then (workinfo) ->
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap
            steps = []
            s.etextPageMapping ?= {}
            

            # for page in $("page", data)
            #     if $(page).attr("pagestep")
            #         steps.push [($(page).attr "pageix"), Number($(page).attr "pagestep")]


            #     p = $(page).clone()
            #     p.find("*").remove()
            #     etextcontent = _.str.trim $(p).text()
            #     s.etextPageMapping[$(page).attr("name")] = etextcontent

            # # avoid etextPageMapping memory bloat
            # pairs = _.pairs s.etextPageMapping
            # if pairs.length > 100
            #     pairs = pairs[30..]
            #     s.etextPageMapping = _.object pairs



            # s.stepmap = _.object steps
            # s.pagestep = Number $("pagestep", data).text()

            if mediatype == "faksimil"

                s.sizes = new Array(5)
                for i in s.workinfo.faksimil_sizes
                    s.sizes[i] = true


            s.startpage = workinfo.startpagename
            s.endpage = workinfo.endpagename
            s.pageix = s.pagemap["page_" + pagename]
            c.log "s.pagename", pagename

        return def


    

    downloadPage = (pageix) ->
        filename = _.str.lpad(pageix, 5, "0")
        id = $routeParams.lbid or s.workinfo.lbworkid
        url = "txt/#{id}/res_#{filename}.html"
        def = backend.getHtmlFile(url)
        def.then (html) ->
            # since we use hard line breaks, soft hyphen needs to be replaced by actual hyphen
            s.etext_html = html.data.firstChild.innerHTML.replace(/­/g, "-") # there's a soft hyphen in there, trust me
            return s.etext_html

        return def


    infoDef = initSourceInfo()
    fetchPage = (ix) ->
        if mediatype == "etext"
            return downloadPage(ix)
        else
            id = $routeParams.lbid or s.workinfo.lbworkid
            filename = _.str.lpad(ix + 1, 4, "0")
            s.url = "/txt/#{id}/#{id}_#{s.size}/#{id}_#{s.size}_#{filename}.jpeg"
            def = $q.defer()
            def.resolve()
            return def.promise


    loadPage = (val) ->
        infoDef.then () ->
            c.log "loadPage", val
            unless $route.current.controller == 'readingCtrl' 
                c.log "resisted page load"
                return

            s.error = false

            if not s.isEditor and not isDev
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)

            

            s.setTitle "#{s.workinfo.title} sidan #{s.pagename} #{s.mediatype}"

            if $location.search().sok
                s.$broadcast "popper.open.searchPopup"


            
            promise = null
            if s.isEditor
                s.pageix = Number val
                promise = fetchPage(s.pageix)
            else 
                s.pagename = val
                s.pageix = s.pagemap["page_" + s.pagename]
                promise = fetchPage(s.pageix)

            promise.then (html) ->
                c.log "onFirstLoad"
                s.first_load = true
                s.loading = false
                onFirstLoad()

            if mediatype == "faksimil" and s.workinfo.has_ocr
                backend.fetchOverlayData(s.workinfo.lbworkid, s.pageix).then ([overlayHtml, overlayFactors]) ->
                    s.overlayFactors = overlayFactors
                    s.overlayHtml = overlayHtml

        , (err) ->
            c.log "err", err


            if s.isEditor
                fetchPage(val).then () ->
                s.loading = false
                s.first_load = true

            else
                s.error = true



    ###
    loadPageOld = (val) ->
        # take care of state hiccup
        unless $route.current.controller == 'readingCtrl' 
            c.log "resisted page load"
            return

        c.log "loadPage", val
        # if val == s.pagename then return

        s.error = false
        
        if s.isEditor
            params = 
                lbworkid : $routeParams.lbid
                mediatype : mediatype
                pageix : val
            pageQuery = "page[ix='#{val}']"
            setPages = (page) ->
                s.pageix = Number val
                s.displaynum = s.pageix

        else
            pageQuery = "page[name='#{val}']"
            params = 
                author_id : author
                titlepath : title
                mediatype : mediatype

            setPages = (page, data) ->
                if not page.length
                    page = $("page:last", data).clone()
                    s.pagename = page.attr("name")
                else
                    s.pagename = val
                s.pageix = s.pagemap["page_" + s.pagename]
                s.displaynum = s.pagename

                unless s.pageToLoad then s.pageToLoad = s.pagename

                if s.mediatype == "faksimil" and s.workinfo.has_ocr
                    backend.fetchOverlayData(s.workinfo.lbworkid, s.pageix).then ([data, overlayFactors]) ->
                        s.overlaydata = data
                        s.overlayFactors = overlayFactors
                                       
            if val
                params["pagename"] = val
            if val and s.pagemap
                ix = s.pagemap["page_" + val]
                plusFive = s.pagemap["ix_" + (ix + 5)] or s.endpage

                params["pagename"] = [val, plusFive]

        unless s.isEditor
            if s.faksimilPageMapping
                setPages {length : 1}

                filename = s.faksimilPageMapping[s.pageix]
                id = $routeParams.lbid or s.workinfo.lbworkid
                s.url = "/txt/#{id}/#{id}_#{s.size}/#{id}_#{s.size}_#{filename}"
                unless s.isEditor
                    backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)
                return
            else if s.etextPageMapping?[val]
                setPages {length : 1}
                s.etext_html = s.etextPageMapping[val]
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)
                return
            
        s.loading = true

        backend.getPage(params).then (data) ->
            # s.workinfo = workinfo
            

            


            page = $(pageQuery, data).last().clone()

            setPages(page, data)

            if s.mediatype == "faksimil"
                faksimilPageMapping = for item in $("bok sida[src]", data)
                    [$(item).attr("ix"), $(item).attr("src")]

                s.faksimilPageMapping = _.object faksimilPageMapping
            
            ixes = _.map $("sida", data), (item) ->
                Number $(item).attr("ix")

            s.endIx = Math.max ixes...

            # if mediatype == 'faksimil' or isParallel
            s.sizes = new Array(5)
            for url in $("pages faksimil-url", data)
                s.sizes[Number($(url).attr("size")) - 1] = true
            
            c.log "loadpage result", s.size

            s.url = $("faksimil-url[size=#{s.size}]", page).last().text()
            # else
            page.children().remove()
            s.etext_html = _.str.trim page.text()
            unless s.isEditor
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)

            s.loading = false
            s.first_load = true
            onFirstLoad()

            s.setTitle "#{workinfo.title} sidan #{s.pagename} #{s.mediatype}"

            if $location.search().sok
                s.$broadcast "popper.open.searchPopup"





        , (data) ->
            c.log "fail", data
            s.error = true
            s.loading = false
            s.first_load = true
            

    ###

    
    s.setSize = (index) ->
        c.log "setsize", index
        s.size = index
        loadPage(s.getPage())

    watches.push s.$watch "getPage()", debounce(loadPage, 200, {leading : false})

    s.$on "$destroy", () ->
        c.log "destroy reader"
        $document.off "keydown", onKeyDown
        for w in watches
            w()

## ORD OCH SAK
    backend.ordOchSak(author, title).then (ordOchSak) ->
        s.ordOchSakAll = ordOchSak
        s.$watch "pagename", updateOrdOchSak
        updateOrdOchSak()
    , (error) ->
        # c.log 'failed to get ord och sak', error
    
    updateOrdOchSak = () ->
        if not s.ordOchSakAll or not s.pagename then return
        s.ordOchSakPage = (entry for entry in s.ordOchSakAll when entry.forklaring and s.pagename in entry.pages)
    
    ## TODO
    #s.markOosEntry = (entry) ->
    #    for id in entry.ids
    #        fromSpan = $(".etext #"+id.from)
    #        toSpan = $(".etext #"+id.to)
    #        all = fromSpan.nextUntil(toSpan).add(fromSpan).add(toSpan)
    #        all.addClass("markee")
    #
    #s.unmarkOosEntries = () ->
    #    $(".etext .markee").removeClass("markee")
    
## END ORD OCH SAK

    s.$on "img_expand", (evt, src) ->
        c.log "img expand!", src

        s.activeSrc = src
        img_modal = $modal.open
            templateUrl : "img_full.html"
            scope : s
            windowClass : "img_full"
            size : "lg"


        # img_modal.result.then () ->
        #     s.show_about = false
        # , () ->
        #     s.show_about = false






    ## START SEARCH

    # if s.search_query

    s.getCleanUrl = () ->
        "/#!" + $location.path()

    s.hasActiveSearch = () ->
        $location.search().s_query and not searchData?.isSearching

    s.searchData = searchData = new SearchWorkData()

    c.log "outside params", $location.search()
    query = $location.search().s_query
    if query
        args = {}
        for key, val of $location.search()
            if _.str.startsWith key, "s_"
                if key == "s_text_attrs" and val
                    args["text_attrs"] = val.split(",")
                else    
                    args[key[2..]] = val
            
        searchData.newSearch(args)
        searchData.current = Number($location.search().hit_index or 0)
        searchData.get(searchData.current)
        # searchData.slice(0, 10).then (data) ->
        #     c.log "searchdata slice", data

    s.onGotoHitInput = () ->
        if s.showGotoHitInput
            s.showGotoHitInput = false
            return
        s.showGotoHitInput = true
        $timeout(() ->
            s.$broadcast("focus")
        0)


    s.onGotoHit = (hit) ->
        if hit > searchData.total_hits
            return
        s.showGotoHitInput = false
        hit = Number(hit - 1)
        c.log "hit", hit
        # from = if (hit - 5) < 0 then 0 else (hit - 5)
        searchData.current = hit
        searchData.slice(hit, hit + 20).then ([result]) ->
            c.log "result", result
            size = maybeSize()
            $location.url(result[0].href[3...] + size)



    s.openSearchWorks = () ->
        s.show_search_work = !s.show_search_work 
        $timeout () ->
            s.$broadcast('focus.search_work')
        , 0


    s.searchWork = (query) ->
        c.log "searchWork", query

        s.$root.prevSearchState = null
        # size = $location.search().storlek

        args = {
            query : query
            mediatype: mediatype
            # selectedAuthor: s.author
            lbworkid : s.workinfo.lbworkid
            prefix: $location.search().prefix
            suffix: $location.search().suffix
            infix: $location.search().infix
        }
        searchArgs = {}
        for key, val of args
            searchArgs["s_" + key] = val



        $location.search(searchArgs)
        c.log "searchArgs", searchArgs

        searchData.newSearch(args)
        searchData.current = 0
        searchData.get(0).then (hit) ->
            c.log "hit", hit
            # s.show_search_work = false

            # unless kwic.length then return
            unless hit then return
            stateLocVars = ["show_search_work", "prefix", "suffix", "infix", "storlek"]
            stateVars = (_.pick $location.search(), stateLocVars...)

            query = (_.invoke (_.pairs stateVars), "join", "=").join("&")


            $location.url(hit.href[3...] + "&" + query)





# 