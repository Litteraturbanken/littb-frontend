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
        c.log "onAuthSelectRender"
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
        searchData.resetMod().then ([sentsWithHeaders]) ->
            # s.kwic = kwic
            s.sentsWithHeaders = sentsWithHeaders

    s.setAuthorFilter = (author_id) ->
        # $location.search("navigator_filter", author_id)
        s.nav_filter = author_id


    s.authorChange = () ->
        $location.search("titel", null)
        s.selected_title = ""

    s.titleSort = util.titleSort
        
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
                        s.searching = true
                        searchData.modifySearch({authors: author_id, from: 0, to: s.num_hits - 1}).then ([sentsWithHeaders]) ->
                            c.log "modifySearch args", arguments
                            s.searching = false
                            s.sentsWithHeaders = sentsWithHeaders



        ]


    s.searching = false
    s.num_hits = searchData.NUM_HITS
    s.current_page = 0

    s.nextPage = () ->
        # if (s.current_page  * s.num_hits) + s.kwic.length < s.doc_hits
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
                prefix = if prefix then "*" else ""
                suffix = if suffix then "*" else ""
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


    # s.save_search = (currentIndex) ->
    #     c.log "save_search", $location.url()
        s.$root.prevSearchState = "/#!" + $location.url()


    s.getSetVal = (sent, val) ->
        _.str.trim( sent.structs[val], "|").split("|")[0]

    s.selectLeft = (sentence) ->
        if not sentence.match then return
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
        unless searchData.data?.length then return
        Math.min s.doc_hits, ((s.current_page + 1) * s.num_hits)

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

    ]

    s.options = {
        sortSelected : 'lastname'
    }

    s.onSearchSubmit = (query) ->
        $anchorScroll("results")
        # s.resetAuthorFilter()
        s.nav_filter = null
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
        def.then ([sentsWithHeaders, author_aggs]) ->
            c.log "search data slice", searchData.total_hits

            s.doc_hits = searchData.total_doc_hits
            s.total_pages = Math.ceil(s.doc_hits / s.num_hits)

            # TODO: silly, silly hack
            # c.log "$location.search().sok_filter", $location.search().sok_filter
            # unless $location.search().sok_filter
            s.sentsWithHeaders = _.flatten sentsWithHeaders
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

