'use strict';

window.c = console ? log : _.noop
littb = angular.module('littbApp')

littb.filter "formatAuthors", (authors) ->
    (authorlist, authorsById, makeLink) ->
        if not authorlist or not authorlist.length or not authorsById then return

        stringify = (auth) ->
            suffix = {
                editor : " (red.)"
                translator : " (övers.)"
                illustrator : " (ill.)"
                # scholar : " (red.)"


            }[auth.type] or ""
            authorsById[auth.id].fullname + suffix
        
        linkify = (auth) ->
            $("<a>").attr "href", "/#!/forfattare/#{auth.id}"
                .text stringify auth
                .outerHTML()

        if makeLink
            strings = _.map authorlist, linkify
        else
            strings = _.map authorlist, stringify
        

        firsts = strings[...-1]
        last = _.last strings



        if firsts.length then return "#{firsts.join(', ')} och #{last}"
        else return last
        

        

c.time = angular.noop
c.timeEnd = angular.noop

littb.filter "authorYear", () ->
    (obj) ->
        unless obj then return
        # c.log "obj", obj
        isFalsy = (val) ->
            not val or (val == "0000")
        death = obj.death # or obj.datestring.split("–")[1]
        if (isFalsy obj.birth) and (isFalsy death) then return ""
        if isFalsy death then return "f. #{obj.birth}"
        if isFalsy obj.birth then return "d. #{death}"
        return "#{obj.birth}–#{death}"


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
        s.data = data

littb.controller "searchCtrl", ($scope, backend, $location, $document, $window, $rootElement, $q, util, searchData, authors, debounce) ->
    s = $scope
    s.open = true
    s.proofread = 'all'

    s.groupSetup = {
        formatSelection : (item) ->
            item.text.split(",")[0]

    }
    

    initTitle = _.once (titlesById) ->
        unless $location.search().titel then return

        s.selected_title = titlesById[$location.search().titel]

    s.titleChange = () ->
        # $location.search("titel", s.selected_title?.titlepath.split("/")[0] or null)
        $location.search("titel", s.selected_title?.lbworkid or null)


    s.checkProof = (obj) ->
        if obj.searchable != 'true' then return false
        if s.proofread == 'all'
            return true
        else if s.proofread == "no" and obj.proofread == "false"
            return true
        else if s.proofread == "yes" and obj.proofread == "true"
            return true
        else
            return false


    s.authorChange = () ->
        $location.search("titel", null)
        s.selected_title = ""

    s.titleSort = (a) ->
        _.map a.shorttitle.split(/(\d+)/), (item) -> 
            if Number(item)
                zeroes = (_.map [0..(10 - item.toString().length)], () -> "0").join("")

                return zeroes + item.toString()
            else 
                return item
        

    # util.setupHashComplex s, [
    #         scope_name : "num_hits"
    #         key : "per_sida"
    #         val_in : Number
    #         default : 20
    #     ,
    #         key: "prefix"
    #     ,   
    #         key : "suffix"
    #     ,   
    #         key : "infix"
    # ]

    # s.nHitsChange = () ->
    #     s.current_page = 0
    #     if s.data
    #         s.search()  

    authors.then ([authorList, authorsById]) ->
        s.authors = authorList
        s.authorsById = authorsById
        change = (newAuthors) ->
            return unless newAuthors
            $q.all _.map newAuthors.split(","), (auth) -> 
                backend.getTitlesByAuthor(auth, true)
            .then (results) ->
                filteredTitles = _.filter (_.flatten results), (item) -> "/" not in item.titlepath
                s.titles = filteredTitles



            # for auth in newAuthors.split(",")
            #     backend.getTitlesByAuthor(auth, true).then (data) ->
            #         filteredTitles = _.filter data, (item) -> "/" not in item.titlepath
            #         s.titles = filteredTitles
            #         titlesById = _.object _.map filteredTitles, (item) -> [item.lbworkid, item]    
            #         initTitle titlesById

        
        if $location.search().forfattare
            s.selected_author = authorsById[$location.search().forfattare]
        
        util.setupHashComplex s, [
                key : "forfattare"
                # expr : "selected_author.pseudonymfor || selected_author.authorid"
                expr : "selectedAuthors"
                val_in : (val) ->
                    val?.split(",")
                val_out : (val) ->
                    val?.join(",")
                post_change : change

        ]


    s.searching = false
    s.num_hits ?= 15
    # s.current_page = 0

    s.rowHeights = []

    s.getRowHeight = () ->
        add = (a, b) -> a+b
        
        return (_.foldr s.rowHeights, add) / (s.rowHeights.length)


    s.tableRenderComplete = () ->
        c.log "tableRenderComplete"
        s.getTotalHeight()
        s.searching = false

    s.getTotalHeight = () ->
        s.totalHeight = s.hits * s.getRowHeight()


    s.updateOnScrollEvents = (evt, isEnd) ->
        if not isEnd then return
        top = evt.currentTarget.scrollTop
        rowHeight = s.getRowHeight()
        c.log "rowHeight", rowHeight
        from = Math.floor(top / rowHeight)
        c.log "from", from
        n_rows = Math.ceil($(evt.currentTarget).height() / rowHeight)


        s.search(from, (from + n_rows)).then () ->
            s.table_top = top
            




    getVisibleRows = () ->


    
    getMediatypes = () ->
        {
            yes : "etext"
            no : "faksimil"
            all : "all"
        }[s.proofread]


    # s.nextPage = () ->
    #     if (s.current_page  * s.num_hits) + s.kwic.length < s.hits
    #         s.current_page++
    #         c.log "nextpage search"
    #         s.search(s.query)
    # s.prevPage = () ->
    #     if not s.current_page or s.current_page == 0 then return
    #     s.current_page--
    #     s.search(s.query)

    # s.firstPage = () ->
    #     s.current_page = 0
    #     s.search(s.query)
    # s.lastPage = () ->
    #     s.current_page = s.total_pages - 1
    #     s.search(s.query)

    # s.gotoPage = (page) ->
    #     s.current_page = page
    #     s.search(s.query)        
    
    getSearchArgs = (from, to) ->
        # from = s.current_page  * s.num_hits
        # to = (from + s.num_hits) - 1
        
        return {
            query : s.query
            mediatype: getMediatypes()
            from: from
            to: to
            selectedAuthor: $location.search().forfattare
            selectedTitle : $location.search().titel
            prefix: s.prefix
            suffix: s.suffix
            infix: s.infix
        }


    s.save_search = (currentIndex) ->
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

    # s.setPageNum = (num) ->
    #     c.log "setPageNum", num
    #     s.current_page = num
    #     s.search()

    s.getMaxHit = () ->
        Math.min s.hits, (s.current_page  * s.num_hits) + s.kwic.length

    # DATA GRID
    # s.keys = _.keys
    # getTmpl = (key) ->
    #     """
    #     <div class="ui-grid-cell-contents">
    #         <span ng-repeat='token in row.entity.#{key}'>{{token.word}} </span> 
    #     </div>
    #     """

    # s.gridOptions = {
    #     showHeader : false
    #     init : (gridCtrl, gridScope) ->
    #         gridScope.$on 'ngGridEventData', () ->
    #             $scope.gridOptions.ngGrid.buildColumns()

    #     columnDefs: [
    #         { 
    #             name: 'left',
    #             cellTemplate: getTmpl("left")
    #         }
    #         { 
    #             name: 'match',
    #             cellTemplate: getTmpl("match")
    #             width: "*"
    #         }
    #         { 
    #             name: 'right',
    #             cellTemplate: getTmpl("right")
    #         }
    #         # { field: 'match' },
    #         # { field: 'right' }
    #     ]

    # }
        

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

    s.filterOpts =  [
        {label: "Sök i <span class='sc'>ALLA TEXTER</span>", val: "all_texts", selected: true}
        {label: "Inkludera <span class='sc'>KOMMENTARER & FÖRKLARINGAR</span>", val: "all_texts", selected: true}
    ]

    s.searchOptionsMenu = [
        {label: "SÖK EFTER HELT ORD ELLER FRAS", val: "default", selected: true}
        {label: "SÖK EFTER ORDBÖRJAN", val: "prefix", selected: false}
        {label: "SÖK EFTER ORDSLUT", val: "suffix", selected: false}
        {label: "SÖK EFTER DEL AV ORD", val: "infix", selected: false}
    ]



    s.options = {
        sortSelected : 'lastname'
    }
    groupSents = (kwic) ->
        # _.groupBy kwic, (item) ->
        i = 0
        output = []
        prevAuth = null
        for item in kwic
            if not item? then continue
            auth = item.structs.text_authorid.split("|")[1]
            shorttitle = item.structs.text_shorttitle

            if (prevAuth != auth) or (shorttitle != prevShortTitle)
                output.push {isHeader : true, authorid : auth, shorttitle: shorttitle}

            item.index = i
            output.push item

            prevAuth = auth
            prevShortTitle = shorttitle
            i++

        return output

    getGridData = (row) ->
        return {
            left : s.selectLeft row
            match : s.selectMatch row
            right : s.selectRight row
        }

    s.newSearch = (query) ->
        q = query or s.query
        unless q then return
        $location.search("fras", q) if q

        s.query = q
        s.pageTitle = q
        from = 0
        to = (s.num_hits - 1)
        args = getSearchArgs from, to
        searchData.newSearch args
        s.search from, to


    # s.search = debounce((query, from, to) ->
    s.search = (from, to) ->
        s.searching = true

        args = getSearchArgs(from, to)
        # args.from = from
        s.from_index = from

        # args.to = to

        backend.getAuthorsInSearch(args).then (data) ->
            c.log "getAuthorsInSearch then", data

            n = 0
            for auth in (_.sortBy (_.keys data).sort())
                val = data[auth]
                # c.log "item", key, val
                data[auth] = Math.floor(n / s.num_hits)
                # data[auth] = n
                n += val
                # c.log "n", n

            s.authorStatsData = data

        # def = backend.searchWorks(args)
        def = searchData.slice(from, to)
        def.then (kwic) ->
            c.log "search data", kwic
            # s.gridOptions.totalServerItems = data.count
            # s.gridOptions.data = _.map data.kwic, getGridData

            # s.data = data
            s.kwic = kwic
            s.hits = searchData.total_hits
            # s.total_pages = Math.ceil(s.hits / s.num_hits)

            # for row in (data.kwic or [])
            #     row.href = searchData.parseUrls row

            s.sentsWithHeaders = groupSents(kwic)
            s.searching = false

            # s.searching = false

        return def
    # , 200)

    queryvars = $location.search()

    util.setupHashComplex s,
        [
            # scope_name : "current_page"
            # key : "traffsida"
            # val_in : (val) ->
            #     Number(val) - 1
            # val_out : (val) ->
            #     val + 1
            # default : 1
        # ,   
            key : "avancerad"
            scope_name : "advanced"
        ,   
            key : "proofread"
            default : "all"
        ,
            key : "fras"
            post_change : (val) ->
                if val
                    s.newSearch val


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


littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q) ->
    s = $scope
    _.extend s, $routeParams

    if $route.current.$$route.isSla
        s.slaMode = true
        s.author = "LagerlofS"
        
    s.showpage = null
    s.show_large = false
    s.show_more = false

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById

        normalize = (auth) ->
            from = "ÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöøùúûüýÿ".split("") 
            to = "AAAAACEEEEIIIINOOOOOOUUUUYaaaaaaceeeeiiiinoooooouuuuyy".split("") 
            trans = (letter) ->
                i = _.indexOf from, letter
                to[i] or letter

            (_.map auth.split(""), trans).join("")
                
        c.log "s.author", s.author, normalize s.author

        s.authorError = (normalize s.author) not of s.authorsById

    s.showLargeImage = ($event) ->
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
        # s.showpage = "introduktion" if s.author == s.showpage

    # refreshTitle = () ->
        # suffix = if s.showpage == "titlar" then "Verk i LB" else _.str.capitalize s.showpage
        # s.setTitle "#{s.authorInfo.fullName} - " + suffix

    # refreshBreadcrumb = () ->
        # if s.showpage != "introduktion"
        #     if $rootScope.breadcrumb.length > 2
        #         $rootScope.breadcrumb.pop()
        #     s.appendCrumb s.showpage
        # else
        #     $rootScope.breadcrumb.pop()

    s.getUnique = (worklist) ->
        _.filter worklist, (item) ->
            "/" not in item.titlepath 
    
    s.getPageTitle = (page) ->
        {
           "titlar": "Verk i LB"
           "semer": "Mera om"
           "biblinfo": "Bibliografisk databas"
           "jamfor": "Textkritisk verkstad"
           "omtexterna": "Om texterna"
        }[page] or _.str.capitalize page

    s.getAllTitles = () ->
        [].concat s.groupedTitles, s.groupedWorks, s.groupedEditorWorks

    s.getUrl = (work) ->
        auth = work.authors[0].workauthor or work.workauthor or s.author
        url = "/#!/forfattare/#{auth}/titlar/#{work.titlepath.split('/')[0]}/"
        if work.mediatype == "epub" or work.mediatype == "pdf"
            url += "info"
        else
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
                url = s.authorInfo[page]
        else    
            url = s.authorInfo[page]
        
        return unless url
        
        # because the livereload snippet is inserted into the html
        # if location.hostname == "localhost"
        #     url = "http://demolittb.spraakdata.gu.se" + s.authorInfo[page]

        unless s.showpage in ["introduktion", "titlar"]
            getHtml(url).then (xml) ->
                s.externalDoc = xml
                c.log "s.showpage", s.showpage
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
    


    s.hasTitles = () ->
        _.any [
            s.authorInfo?.works.length
            s.authorInfo?.titles.length
            s.authorInfo?.editorWorks.length
            s.authorInfo?.translatorWorks.length
        ]

    s.getWorkAuthor = (authors) ->
        wa = authors[0].workauthor
        if wa
            return s.authorsById[wa]
        else return authors[0]

    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data
        
        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "titlepath"
        s.groupedTitles = _.values _.groupBy s.authorInfo.titles, "titlepath"
        s.groupedEditorWorks = _.values _.groupBy s.authorInfo.editorWorks, "titlepath"
        s.groupedTranslatorWorks = _.values _.groupBy s.authorInfo.translatorWorks, "titlepath"

        s.titleStruct = [
                label : "Verk"
                data : s.groupedWorks
                showAuthor : false
            ,
                label : "Titlar som ingår i andra verk"
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
    
    
    
littb.controller "titleListCtrl", ($scope, backend, util, $timeout, $location, authors, $rootElement) ->
    s = $scope
    s.searching = false
    s.rowByLetter = {}
    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.showtitle == attrs.title

    s.filterTitle = (row) ->    
        if not s.rowfilter then return true
        filter = (s.rowfilter || '')
        return new RegExp(filter, "i").test((row.itemAttrs.title + " " + row.itemAttrs.shorttitle))

    s.filterAuthor = (author) ->
        if not s.rowfilter then return true
        filter = (s.rowfilter || '')
        return new RegExp(filter, "i").test((author.fullname))

    titlesort = "itemAttrs.sortkey"
    
    s.sorttuple = [[titlesort, 'author[0].nameforindex'], false]
    s.setSort = ([sortstr]) ->

        alternate = _.object([
            [titlesort, "author[0].nameforindex"],
            ["author[0].nameforindex", titlesort]
        ])[sortstr]

        s.sorttuple[0] = [sortstr, alternate]

    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    s.sortMedia = (list) ->
        order = ['etext', 'faksimil', 'epub', 'pdf']
        return _.intersection(order,list).concat(_.difference(list, order))

    s.getTitleId = (row) ->
        row.itemAttrs.titlepath.split('/')[0]

    s.selectWork = () ->
        c.log "selectWork", s.workFilter
        if s.workFilter == "titles"
            # s.authorFilter = null
            s.mediatypeFilter = ""
            if s.filter
                s.selectedLetter = null
            if s.selectedLetter
                s.filter = null
            # unless s.filter or s.selectedLetter then s.selectedLetter = "A"

            # s.selectedLetter = null
            # s.filter = null
        if not s.authorFilter and not s.filter and not s.selectedLetter 
            s.selectedLetter = "A"
        fetchWorks()

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById
        s.authorData = authorList


    s.searchTitle = () ->
        c.log "searchTitle", s.workFilter
        if s.workFilter == 'titles'
            s.selectedLetter = null

            fetchWorks()
        else
            unless s.filter then s.selectedLetter = "A" else s.selectedLetter = null

        s.rowfilter = s.filter

    s.authorChange = () ->
        s.selectedLetter = null
        unless s.authorFilter and not s.selectedLetter
            s.selectedLetter = "A"
        if s.workFilter == "titles"
            fetchWorks()

    fetchWorks = () ->
        s.searching = true
        backend.getTitles(s.workFilter == "titles", s.authorFilter, s.selectedLetter, s.filter).then (titleArray) ->
            s.searching = false
            s.titleArray = titleArray
            s.rowByLetter = _.groupBy titleArray, (item) ->
                firstletter = item.itemAttrs.sortkey[0]
                if firstletter == "Æ"
                    firstletter = "A"
                return firstletter.toUpperCase()



            if s.workFilter == "titles"
                s.currentLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("")
            else
                s.currentLetters = _.keys s.rowByLetter
                

    s.getUrl = (row, mediatype) ->
        # unless row then return
        url = "/#!/forfattare/#{row.author[0].workauthor or row.author[0].authorid}/titlar/#{s.getTitleId(row)}/"
        if mediatype == "epub" or mediatype == "pdf"
            url += "info/#{mediatype}"
        else
            url += "sida/#{row.itemAttrs.startpagename}/#{mediatype}"
        return url

    s.getSource = () -> 
        if s.selectedLetter 
            return s.rowByLetter[s.selectedLetter]
        else
            return s.titleArray


    s.authorClick = ($event, author) ->
        if author == s.selectedAuth
            s.selectedTitle = null
            return
        s.selectedTitle = null
        s.selectedAuth = author
        $event.stopPropagation()

        c.log "author.authorid", author.authorid
        backend.getAuthorInfo(author.authorid).then (data) ->
            s.authorInfo = data

    
    getWorkIntro = (author, titlepath) ->
        s.sourcedesc = null
        infoDef = backend.getSourceInfo(author, titlepath.split("/")[0])
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


    s.getWorkAuthor = (authors) ->
        wa = authors[0].workauthor
        if wa
            return s.authorsById[wa]
        else return authors[0]


    s.titleClick = ($event, title) ->
        if title == s.selectedTitle
            s.selectedTitle = null
            return
        s.selectedAuth = null
        s.selectedTitle = title

        # getWorkIntro(s.getWorkAuthor(title.author).authorid, title.itemAttrs.titlepath)

        $event.stopPropagation()

    onRootClick = (event) ->
        s.$apply () ->
            s.selectedAuth = null
            s.selectedTitle = null
    $rootElement.on "click", onRootClick


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : titlesort + ",author[0].nameforindex"
            val_in : (val) ->
                val?.split(",")
            val_out : (val) ->
                val?.join(",")
            # post_change : () ->
            replace : false
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
            #replace : false
        ,
            key : "filter"
            scope_name : "rowfilter"
            replace : false
        ,
            key : "niva"
            scope_name : "workFilter"
            default : "works"
            replace : false
        ,
            # TODO: history recall issue with back btn
            key : "mediatypeFilter"
            replace : false

        ,
            key : "forfattare"
            scope_name : "authorFilter"
            replace : false
        ,
            key : "index",
            scope_name : "selectedLetter"
            # default: "A"
            replace : false
            post_change : (val) ->
                if val
                    s.filter = "" 
                    s.rowfilter = ""
                if s.workFilter == "titles" and val
                    fetchWorks()
                return val

        ]

    # timeout in order to await the setupHashComplex watch firing.
    # $timeout () ->
    if not (s.authorFilter or s.rowfilter or s.selectedLetter or s.mediatypeFilter) 
        s.selectedLetter = "A"
    if s.rowfilter then s.filter = s.rowfilter
    c.log "workfilter", s.workFilter
    fetchWorks()

    s.$on "$destroy", () ->
        $rootElement.off "click", onRootClick

littb.controller "epubListCtrl", ($scope, backend, util) ->
    s = $scope
    s.searching = true
    # TODO: what about the workauthor issue?
    s.sorttuple = [["author[0].nameforindex", "itemAttrs.sortkey"], false]
    s.setSort = ([sortstr]) ->
        alternate = {
            "author[0].nameforindex" : "itemAttrs.sortkey"
            "itemAttrs.sortkey" : "author[0].nameforindex"
        }[sortstr]
        s.sorttuple[0] = [sortstr, alternate]
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    window.has = (one, two) -> one.toLowerCase().indexOf(two.toLowerCase()) != -1
    s.rowFilter = (item) ->
        if "epub" not in item.mediatype then return false
        if s.authorFilter and s.authorFilter.authorid != item.author[0].authorid then return false
        if s.filterTxt
            return false if not ((has item.author[0].fullname, s.filterTxt) or (has item.itemAttrs.showtitle, s.filterTxt))
        return true

    s.getAuthor = (row) ->
        [last, first] = row.author[0].nameforindex.split(",")

        (_.compact [last.toUpperCase(), first]).join ","

    s.letterChange = () ->
        s.filterTxt = ""

    s.log = (filename) ->
        backend.logPage("0", filename, "epub")

    s.getFilename = (row) ->
        row.author[0].authorid + '_' + row.itemAttrs.titlepath.split('/')[0]


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : "author[0].nameforindex,itemAttrs.sortkey"
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

    
    backend.getTitles().then (titleArray) ->
        s.searching = false
        s.rows = _.filter titleArray, (item) -> "epub" in item.mediatype
        authors = _.map s.rows, (row) ->
            row.author[0]

        s.authorData = _.unique authors, false, (item) ->
            item.authorid

        s.currentLetters = _.unique _.map titleArray, (item) ->
            item.author[0].nameforindex[0]

        util.setupHashComplex s, [
            key : "selectedLetter"

        ]





littb.controller "helpCtrl", ($scope, $http, util, $location) ->
    s = $scope
    url = "/red/om/hjalp/hjalp.html"
    $http.get(url).success (data) ->
        s.htmlContent = data
        s.labelArray = for elem in $("[id]", data)
            label = _.str.humanize($(elem).attr("name").replace(/([A-Z])/g, " $1"))

            label : label
            id : $(elem).attr("id")
            
        
        util.setupHashComplex s, [
            "key" : "ankare"
            post_change : (val) ->
                c.log "post_change", val
                unless val and $("##{val}").length
                    $(window).scrollTop(0)
                    return
                $(window).scrollTop($("##{val}").offset().top)
            replace : false
        ]


littb.controller "presentationCtrl", ($scope, $http, $routeParams, $location, util) ->
    s = $scope
    url = '/red/presentationer/presentationerForfattare.html'
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
    

littb.controller "authorListCtrl", ($scope, backend, util, authors) ->
    s = $scope
    # util.setupHash s, "authorFilter"
    s.sorttuple = [["nameforindex"], false]
    s.setSort = ([sortstr]) ->
        s.sorttuple[0] = [sortstr]
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    s.authorDef = authors

    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            scope_func : "setSort"
            key : "sortering"
            val_in : (val) ->
                val?.split(",")
            val_out : (val) ->
                val?.join(",")
            default : "nameforindex"
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
        ,
            key : "authorFilter",
        ,   
            key : "selectedLetter"
        ]

    authors.then ([data, authorById]) ->
        s.authorIdGroup = authorById
        s.authorIdGroup[""] = ""
        s.rows = data

        s.rowByLetter = _.groupBy data, (item) ->
            item.nameforindex[0]
        s.currentLetters = _.keys s.rowByLetter

    s.getAuthor = (row) ->
        [last, first] = row.nameforindex.split(",")
        last = last.toUpperCase()
        if first
            return last + "," + first
        else 
            return last
    # $scope.

littb.filter "correctLink", () ->
    (html) ->
        wrapper = $("<div>").append html
        img = $("img", wrapper)
        img.attr "src", "/red/bilder/gemensamt/" + img.attr("src")
        return wrapper.html()


littb.controller "idCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    _.extend s, $routeParams
    s.id = s.id?.toLowerCase()

    unless _.str.startsWith s.id, "lb"
        s.title = s.id
        s.id = ""
    # else
    #     s.id

    backend.getTitles().then (titleArray) ->
        s.data = titleArray

    s.idFilter = (row) ->
        unless s.id then return true
        row.itemAttrs.lbworkid == s.id

    s.rowFilter = (row) ->
        unless s.title then return true
        _.str.contains(row.itemAttrs.titlepath.toLowerCase(), s.title) or
            _.str.contains(row.itemAttrs.title.toLowerCase(), s.title)


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams, $q, authors, $document, $location) ->
    s = $scope
    {title, author} = $routeParams
    # _.extend s, $routeParams
    s.title = $routeParams.title
    s.author = $routeParams.author


    s.defaultErrataLimit = 8
    s.errataLimit = s.defaultErrataLimit
    s.isOpen = false
    s.show_large = false

    s.getValidAuthors = () ->
        _.filter s.data?.authoridNorm, (item) ->
            item.id of s.authorById

    s.toggleErrata = () ->
        s.errataLimit = if s.isOpen then 8 else 1000
        s.isOpen = !s.isOpen

    s.getUrl = (mediatype) ->
        if mediatype == "epub" 
            return s.data?.epub.url
            
        else if mediatype == "pdf" 
            return s.data?.pdf.url

        return "/#!/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"

    s.getOtherMediatypes = () ->
        (x for x in (s.data?.mediatypes or []) when x != s.mediatype)

    # s.getMediatypeUrl = (mediatype) ->
    #     if mediatype == "epub"
    #         # return s.data?.epub.url
    #         s.getUrl(mediatype)
    #         return "#!/forfattare/#{s.author}/titlar/#{s.title}/info/#{mediatype}"
    #     else
    #         return "#!/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"

    # s.onMediatypeClick = () ->
    #     c.log "onMediatypeClick"
    #     if mediatype == "epub"
    #         window.location.href = s.getUrl(mediatype)

    s.getSourceImage = () ->
        if s.data
            "/txt/#{s.data.lbworkid}/#{s.data.lbworkid}_small.jpeg"

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
        unless s.data then return
        size = s.data[mediatype].file_size

        kb = size / 1024

        return kb



    infoDef = backend.getSourceInfo(author, title) #TODO: REMOVE!
    infoDef.then (data) ->
        s.error = false
        s.data = data
        if not s.mediatype
            s.mediatype = s.data.mediatypes[0]
    , (reason) -> # reject callback 
        s.data = {}
        s.error = true

    $q.all([authors, infoDef]).then ([[authorData, authorById], infoData]) ->
        # c.log "authorData", arguments
        s.authorById = authorById
        for item in authorData
            if item.authorid == author
                s.appendCrumb [
                    label : item.nameforindex.split(",")[0]
                    url : "/#!/forfattare/" + author
                ,
                    label : "titlar"
                    url : "/#!/forfattare/#{author}/titlar"
                ,   
                    label : (infoData.shorttitle or _.str.humanize infoData.titlepath.split("/")[0]) + " info"
                    # url : "#!/forfattare/#{author}/titlar/#{infoData.titlepathnorm}"
                ]
                break





littb.controller "lexiconCtrl", ($scope, backend, $location, $rootScope, $q, $timeout, $modal, util, $window) ->
    s = $scope
    s.dict_not_found = null
    s.dict_searching = false

    modal = null
    # $($window).bind 'mousewheel', (event, delta) ->
    #     if modal then return false

    $($window).on "keyup", (event) ->
        if event.which == 83 and not $("input:focus,textarea:focus,select:focus").length
            s.$broadcast "focus"

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





littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document, $window, $rootElement, authors, $modal) ->
    s = $scope
    s.isEditor = false
    s._ = {humanize : _.humanize}
        
    {title, author, mediatype, pagename} = $routeParams
    _.extend s, (_.pick $routeParams, "title", "author", "mediatype")

    if "ix" of $routeParams
        s.isEditor = true
        s.pageix = Number $routeParams.ix
        mediatype = s.mediatype = {'f' : 'faksimil', 'e' : 'etext'}[s.mediatype]

    s.pageToLoad = pagename

    s.searchData = searchData
    s.loading = true
    s.showPopup = false
    s.error = false
    s.show_chapters = false # index modal

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
        
        modal = $modal.open
            templateUrl : "about.html"
            scope : s

        # modal.result.then () ->
            # s.closeModal()
        # , () ->
            # s.closeModal()

    s.onPartClick = (startpage) ->
        s.gotopage(startpage)
        s.showPopup = false
        s.show_chapters = false

    s.resetHitMarkings = () ->
        for key in ["traff", "traffslut", "x", "y", "height", "width"]
            s[key] = null
    
    thisRoute = $route.current
    
    s.nextHit = () ->
        searchData.next().then (newUrl) ->
            c.log "newUrl", newUrl
            $location.url(newUrl)
    s.prevHit = () ->
        searchData.prev().then (newUrl) ->
            $location.url(newUrl)
    s.close_hits = () ->
        searchData.reset()
        $location.search("traff", null)
        $location.search("traffslut", null)
    # s.pagename = pagename
    

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
            s.pageix = s.pageix + s.getStep()
            s.pageToLoad = s.pageix
            return
        unless s.endpage then return
        newix = s.pageix + s.getStep()
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        # else
        #     s.setPage(0)
    
    s.prevPage = (event) ->
        event?.preventDefault()
        unless s.pagemap then return
        if s.isEditor
            s.pageix = s.pageix - s.getStep()
            s.pageToLoad = s.pageix
            return
        newix = s.pageix - s.getStep()
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
        newix = s.pageix - s.getStep()
        if "ix_" + newix of s.pagemap
            page = s.pagemap["ix_" + newix]
            "/#!/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{mediatype}"
        else
            ""
    
    s.getNextPageUrl = () ->
        unless s.endpage then return
        if s.pageix == s.pagemap["page_" + s.endpage] then return
        newix = s.pageix + s.getStep()
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


    s.gotopage = (page, event) ->
        c.log "preventDefault", page
        event?.preventDefault()
        ix = s.pagemap["page_" + page]
        if s.isEditor
            s.pageix = ix
            s.pageToLoad = ix
        else
            s.setPage ix

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


    onClickOutside = () ->
        s.$apply () ->
            s.showPopup = false

    $document.on "click", onClickOutside


    s.getTooltip = (part) ->
        return part.showtitle if part.navtitle != part.showtitle

    s.toggleParallel = () ->
        s.isParallel = !s.isParallel

    s.supportsParallel = () ->
        unless s.workinfo then return
        'etext' in s.workinfo.mediatypes and 'faksimil' in s.workinfo.mediatypes

    s.getValidAuthors = () ->
        unless s.authorById then return
        _.filter s.workinfo?.authoridNorm, (item) ->
            item.id of s.authorById

    authors.then ([authorData, authorById]) ->
        s.authorById = authorById


    s.size = $location.search().size or 2

    recalcCoors = () ->
        unless s.x then return
        s.coors = for item, i in s.x.split("|")
            pairs = _.pairs _.pick s, "x", "y", "height", "width"
            _.object _.map pairs, ([key, val]) ->
                [key, val.split("|")[i].split(",")[s.size - 1]]
    chapter_modal = null
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
            key : "innehall"
            scope_name : "show_chapters"
            post_change : (val) ->
                if val

                    chapter_modal = $modal.open
                        templateUrl: "chapters.html"
                        scope: s

                    chapter_modal.result.then () ->
                        s.show_chapters = false
                    , () ->
                        s.show_chapters = false

                else
                    chapter_modal?.close()
                    chapter_modal = null

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



    loadPage = (val) ->
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
                authorid : author
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

                if s.mediatype == "faksimil"
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


        backend.getPage(params).then ([data, workinfo]) ->
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap

            steps = []
            s.etextPageMapping ?= {}
            for page in $("page", data)
                if $(page).attr("pagestep")
                    steps.push [($(page).attr "pageix"), Number($(page).attr "pagestep")]


                p = $(page).clone()
                p.find("*").remove()
                etextcontent = _.str.trim $(p).text()
                s.etextPageMapping[$(page).attr("name")] = etextcontent

            # avoid etextPageMapping memory bloat
            pairs = _.pairs s.etextPageMapping
            if pairs.length > 100
                pairs = pairs[30..]
                s.etextPageMapping = _.object pairs



            s.stepmap = _.object steps
            s.pagestep = Number $("pagestep", data).text()

            s.startpage = workinfo.startpagename
            s.endpage = workinfo.endpagename


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
                s.sizes[Number($(url).attr("size"))] = false
            
            if s.sizes[s.size] is false
                s.sizes[s.size] = true

            c.log "loadpage result", s.size

            s.url = $("faksimil-url[size=#{s.size}]", page).last().text()
            # else
            page.children().remove()
            s.etext_html = _.str.trim page.text()
            unless s.isEditor
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)

            s.loading = false

            s.setTitle "#{workinfo.title} sidan #{s.pagename} #{s.mediatype}"
        , (data) ->
            c.log "fail", data
            s.error = true
            s.loading = false
            



    
    s.setSize = (index) ->
        c.log "setsize", index
        s.sizes = _.map s.sizes, (item) -> if item then false else item
        s.sizes[index] = true
        s.size = index
        loadPage(s.getPage())

    watches.push s.$watch "getPage()", debounce(loadPage, 200, {leading : false})

    s.$on "$destroy", () ->
        c.log "destroy reader"
        $document.off "keydown", onKeyDown
        $document.off "click", onClickOutside
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

