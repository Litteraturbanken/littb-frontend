'use strict';

window.c = console ? log : _.noop
littb = angular.module('littbApp')
littb.controller "startCtrl", ($scope, $location) ->

    $scope.gotoTitle = (query) ->
        unless query
            url = "/titlar"
        else
            url = "/titlar?filter=#{query}&selectedLetter=#{query[0].toUpperCase()}"

        $scope.goto url



littb.controller "contactFormCtrl", ($scope, backend, $timeout) ->
    s = $scope

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
        backend.submitContactForm(s.name, s.email, s.message).then( () ->
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

littb.controller "searchCtrl", ($scope, backend, $location, util, searchData, authors) ->
    s = $scope
    s.open = false
    s.proofread = 'all'

    initTitle = _.once (titlesById) ->
        unless $location.search().titel then return

        s.selected_title = titlesById[$location.search().titel]

    s.titleChange = () ->
        # $location.search("titel", s.selected_title?.titlepath.split("/")[0] or null)
        $location.search("titel", s.selected_title?.titlepath or null)


    s.checkProof = () ->
        if s.proofread == 'all'
            return null
        else if s.proofread == 'no'
            return 'false'
        else
            return 'true'


    s.authorChange = () ->
        $location.search("titel", null)
        s.selected_title = ""

    authors.then ([authorList, authorsById]) ->
        s.authors = authorList
        change = (newAuthor) ->
            return unless newAuthor
            c.log "change", newAuthor
            backend.getTitlesByAuthor(newAuthor).then (data) ->
                filteredTitles = _.filter data, (item) -> "/" not in item.titlepath
                s.titles = filteredTitles
                titlesById = _.object _.map filteredTitles, (item) -> [item.titlepath, item]    
                initTitle titlesById

        
        if $location.search().forfattare
            s.selected_author = authorsById[$location.search().forfattare]
        
        util.setupHashComplex s, [
            key : "forfattare"
            expr : "selected_author.pseudonymfor || selected_author.authorid"
            # val_in : (val) ->
            #     authorsById[val]
            post_change : change
        ]


    s.searching = false
    s.num_hits = 20
    s.current_page = 0

    
    getMediatypes = () ->
        {
            yes : "etext"
            no : "faksimil"
            all : "all"
        }[s.proofread]


    s.nextPage = () ->
        s.current_page++
        s.search(s.query)
    s.prevPage = () ->
        s.current_page--
        s.search(s.query)

    s.firstPage = () ->
        s.current_page = 0
        s.search(s.query)
    s.lastPage = () ->
        s.current_page = s.total_pages
        s.search(s.query)
    

    s.save_search = (startIndex, currentIndex, data) ->
        c.log "save_search", startIndex, currentIndex, data
        searchData.save(startIndex, currentIndex, data, [s.query, getMediatypes()])


    s.getItems = () ->
        _.pluck "item", data.kwic


    s.search = (query) ->
        q = query or s.query
        $location.search("fras", q) if q

        s.query = q
        s.searching = true
        
        mediatype = getMediatypes()
        c.log "search mediatype", mediatype

        backend.searchWorks(s.query, mediatype, s.current_page  * s.num_hits, s.num_hits, $location.search().forfattare, $location.search().titel).then (data) ->
            s.data = data
            s.total_pages = Math.ceil(data.count / s.num_hits)
            s.searching = false

            for row in data.kwic
                row.href = searchData.parseUrls row





    queryvars = $location.search()

    util.setupHashComplex s,
        [
            scope_name : "current_page"
            key : "traffsida"
            val_in : Number
        ,   
            key : "open"
        ,   
            key : "proofread"
            default : "all"

        ]

    if "fras" of queryvars
        s.search(queryvars.fras)



littb.controller "lagerlofCtrl", ($scope, $rootScope, backend) ->
    s = $scope
    s.author = "LagerlofS"
    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data
        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "lbworkid"
        $rootScope.appendCrumb data.surname


littb.controller "biblinfoCtrl", ($scope, backend) ->
    s = $scope
    limit = true
    s.showHit = 0
    s.searching = false

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





littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, util) ->
    s = $scope
    # [s.author, s.showtitles] = $routeParams.author.split("/")
    _.extend s, $routeParams
    s.showpage = null
    refreshRoute = () ->
        # s.showtitles = (_.last $location.path().split("/")) == "titlar"
        s.showpage = (_.last $location.path().split("/")) 
        s.showpage = "introduktion" if s.author == s.showpage

    refreshTitle = () ->
        suffix = if s.showpage == "titlar" then "Verk i LB" else _.str.capitalize s.showpage
        s.setTitle "#{s.authorInfo.fullName} - " + suffix



    refreshBreadcrumb = () ->
        if s.showpage != "introduktion"
            if $rootScope.breadcrumb.length > 2
                $rootScope.breadcrumb.pop()
            s.appendCrumb s.showpage
        else
            $rootScope.breadcrumb.pop()

             

    s.getUnique = (worklist) ->
        _.filter worklist, (item) ->
            "/" not in item.titlepath 

    s.getPageTitle = (page) ->
        {
            "semer" : "Mera om"
        }[page] or _.str.capitalize page

    s.getAllTitles = () ->
        [].concat s.groupedTitles, s.groupedWorks

    s.getUrl = (work) ->
        url = "#!/forfattare/#{work.workauthor or s.author}/titlar/#{work.titlepath.split('/')[0]}/"
        if work.mediatype == "epub" or work.mediatype == "pdf"
            url += "info/#{work.mediatype}"
        else
            url += "sida/#{work.startpagename}/#{work.mediatype}"
        return url

    refreshExternalDoc = (page) ->
        c.log "page", page
        url = s.authorInfo[page]
        # because the livereload snippet is inserted into the html
        if location.hostname == "localhost"
            url = "http://demolittb.spraakdata.gu.se" + s.authorInfo[page]

        unless s.showpage in ["introduktion", "titlar"]
            $http.get(url).success (xml) ->
                # c.log $("<div>").html(xml).html()
                from = xml.indexOf "<body>"
                to = xml.indexOf "</body>"
                xml = xml[from..to + "</body>".length]
                # c.log "xml", xml
                s.externalDoc =   _.str.trim xml
                # c.log "success", s.externalDoc



    refreshRoute()

    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        c.log "change error", current
        _.extend s, current.pathParams

        refreshRoute()  
        refreshTitle()
        refreshExternalDoc(s.showpage)
        refreshBreadcrumb()
    



    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data


        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "titlepath"
        s.groupedTitles = _.values _.groupBy s.authorInfo.titles, "titlepath"
        c.log "data.surname", data.surname
        $rootScope.appendCrumb 
            label : data.surname
            url : "#!/forfattare/" + s.author
        if s.showpage != "introduktion"
            refreshBreadcrumb()
        refreshTitle()
        refreshExternalDoc(s.showpage)




littb.controller "titleListCtrl", ($scope, backend, util, $timeout, $location, $q, authors) ->
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
        


    # s.titlesort = "itemAttrs.workshorttitle || itemAttrs.showtitle"
    s.titlesort = "itemAttrs.sortkey"

    
    s.sorttuple = [s.titlesort, false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

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
        unless s.authorFilter or s.filter or s.selectedLetter then s.selectedLetter = "A"
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

    fetchWorks = () ->
        s.searching = true
        backend.getTitles(s.workFilter == "titles", s.selectedLetter, s.filter).then (titleArray) ->
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
        url = "#!/forfattare/#{row.author.workauthor or row.author.authorid}/titlar/#{s.getTitleId(row)}/"
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


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : s.titlesort
            # val_in : (val) ->
            # val_out : (val) ->
            # post_change : () ->
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
        ,
            key : "filter"
            scope_name : "rowfilter"
        ,
            key : "niva"
            scope_name : "workFilter"
            default : "works"
        ,
            key : "mediatypeFilter"
        ,
            key : "forfattare"
            scope_name : "authorFilter"
        ,
            key : "index",
            scope_name : "selectedLetter"
            # default: "A"
            replace : false
            post_change : (val) ->
                s.filter = "" if val
                if s.workFilter == "titles" and val
                    fetchWorks()
                return val

        ]

    # timeout in order to await the setupHashComplex watch firing.
    # $timeout () ->
    if not (s.rowfilter or s.selectedLetter or s.mediatypeFilter) then s.selectedLetter = "A"
    if s.rowfilter then s.filter = s.rowfilter
    c.log "workfilter", s.workFilter
    fetchWorks()

littb.controller "epubListCtrl", ($scope, backend, util) ->
    s = $scope
    s.searching = true
    # TODO: what about the workauthor issue?
    s.sorttuple = ["author.nameforindex", false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    window.has = (one, two) -> one.toLowerCase().indexOf(two.toLowerCase()) != -1
    s.rowFilter = (item) ->
        if "epub" not in item.mediatype then return false
        if s.authorFilter and s.authorFilter.authorid != item.author.authorid then return false
        if s.filterTxt
            return false if not ((has item.author.fullname, s.filterTxt) or (has item.itemAttrs.showtitle, s.filterTxt))
        return true

    s.getAuthor = (row) ->
        [last, first] = row.author.nameforindex.split(",")

        (_.compact [last.toUpperCase(), first]).join ","

    s.letterChange = () ->
        s.filterTxt = ""


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : "author.nameforindex"
            # val_in : (val) ->
            # val_out : (val) ->
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
        authors = _.pluck s.rows, "author"

        s.authorData = _.unique authors, false, (item) ->
            item.authorid

        s.currentLetters = _.unique _.map titleArray, (item) ->
            item.author.nameforindex[0]

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


littb.controller "authorListCtrl", ($scope, backend, util, authors) ->
    s = $scope
    # util.setupHash s, "authorFilter"
    s.sorttuple = ["nameforindex", false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            scope_func : "setSort"
            key : "sortering"
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

    unless _.str.startsWith s.id, "lb"
        s.title = s.id
        s.id = ""

    backend.getTitles().then (titleArray) ->
        s.data = titleArray


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams, $q, authors, $document) ->
    s = $scope
    {title, author, mediatype} = $routeParams
    _.extend s, $routeParams


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

        return "#!/forfattare/#{s.author}/titlar/#{s.title}/#{s.mediatype}"

    s.getOtherMediatypes = () ->
        (x for x in (s.data?.mediatypes or []) when x != s.mediatype)

    s.getMediatypeUrl = (mediatype) ->
        if mediatype == "epub"
            # return s.data?.epub.url
            return "#!/forfattare/#{s.author}/titlar/#{s.title}/info/#{mediatype}"
        else
            return "#!/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"

    s.onMediatypeClick = () ->
        c.log "onMediatypeClick"
        if mediatype == "epub"
            window.location.href = s.getUrl(mediatype)

    s.getSourceImage = () ->
        if s.data
            "txt/#{s.data.lbworkid}/#{s.data.lbworkid}_small.jpeg"

    s.showLargeImage = ($event) ->
        if s.show_large then return 
        s.show_large = true
        $event.stopPropagation()

        $document.one "click", (event) ->
            if event.button != 0 then return
            s.$apply () ->
                s.show_large = false

        


    infoDef = backend.getSourceInfo(author, title, mediatype)
    infoDef.then (data) ->
        s.data = data
        if not s.mediatype
            s.mediatype = s.data.mediatypes[0]

    $q.all([authors, infoDef]).then ([[authorData, authorById], infoData]) ->
        # c.log "authorData", arguments
        s.authorById = authorById
        for item in authorData
            if item.authorid == author
                s.appendCrumb [
                    label : item.nameforindex.split(",")[0]
                    url : "#!/forfattare/" + author
                ,
                    label : "titlar"
                    url : "#!/forfattare/#{author}/titlar"
                ,   
                    label : (_.str.humanize infoData.titlepath) + " info " + (s.mediatype or "")
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



    s.showModal = () ->
        c.log "showModal", modal
        unless modal
            s.$broadcast "blur"

            modal = $modal.open
                templateUrl : "so_modal_template.html"
                scope : s

            modal.result.then angular.noop, () ->
                s.closeModal()



    s.closeModal = () ->
        modal.close()
        s.lex_article = null
        modal = null


    $rootScope.$on "search_dict", (event, query, searchId) ->
        c.log "search_dict", query, searchId    
        
        
        backend.searchLexicon(query, false, searchId, true).then (data) ->
            c.log "search_dict", data

            unless data.length
                # nothing found
                s.dict_not_found = "Hittade inget uppslag"
                $timeout( () ->
                    s.dict_not_found = null
                , 4000)
                return

            result = data[0]
            for obj in data
                if obj.baseform == query
                    result = obj
                    continue

                    
            s.lex_article = result
            s.showModal()
            

    s.getWords = (val) ->
        c.log "getWords", val
        unless val then return
        s.dict_searching = true
        def = backend.searchLexicon(val, true)
        timeout = $timeout(angular.noop, 800)
        $q.all([def, timeout]).then () ->
            s.dict_searching = false
            

        # def.then () ->

        return def



    util.setupHashComplex s, [
        key : "so"
        expr : "lex_article.baseform"
        val_in : (val) ->
            s.$emit "search_dict", val
        replace : false            
    ]





littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document, $q, $window, $rootElement, authors) ->
    s = $scope
    {title, author, mediatype, pagename} = $routeParams
    # _.extend s, (_.omit $routeParams, "traff", "traffslut", "x", "y", "height", "width", "parallel")
    _.extend s, (_.pick $routeParams, "title", "author", "mediatype")
    s.pageToLoad = pagename
    
    s.searchData = searchData
    s.loading = true
    s.showPopup = false
    s.error = false

    s.onPartClick = (startpage) ->
        s.gotopage(startpage)
        s.showPopup = false

    resetHitMarkings = () ->
        for key in ["traff", "traffslut", "x", "y", "height", "width"]
            s[key] = null
            # $location.search( key, null).replace()
    
    # s.dict_not_found = "Hittade inget uppslag"
    thisRoute = $route.current
    
    s.nextHit = () ->
        searchData.next().then (newUrl) ->
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
        $route.current.pathParams.pagename
    s.setPage = (ix) ->
        s.pageix = ix
        s.pageToLoad = s.pagemap["ix_" + s.pageix]
    s.nextPage = () ->
        resetHitMarkings()
        if s.pageix == s.pagemap["page_" + s.endpage] then return
        newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)
    s.prevPage = () ->
        resetHitMarkings()
        newix = s.pageix - 1
        c.log "newix", newix
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)

    s.firstPage = () ->
        s.setPage(0)
    s.lastPage = () ->
        ix = s.pagemap["page_" + s.endpage]
        s.setPage ix



    s.gotopage = (page) ->
        ix = s.pagemap["page_" + page]
        s.setPage ix

    s.mouseover = () ->
        c.log "mouseover"
        s.showPopup = true



    s.getTooltip = (part) ->
        return part.showtitle if part.navtitle != part.showtitle

    s.toggleParallel = () ->
        s.isParallel = !s.isParallel

    s.supportsParallel = () ->
        unless s.workinfo then return
        'etext' in s.workinfo.mediatypes and 'faksimil' in s.workinfo.mediatypes

    s.getValidAuthors = () ->
        _.filter s.workinfo?.authoridNorm, (item) ->
            item.id of s.authorById

    authors.then ([authorData, authorById]) ->
        s.authorById = authorById



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
        ,
            key : "y"
            replace : false
        ,
            key : "width"
            replace : false
        ,
            key : "height"
            replace : false
        ,
            key : "parallel"
            scope_name : "isParallel"
        # ,   
        #     key : "so"
        #     expr : "lex_article.baseform"
        #     post_change : (val) ->
        #         unless val then return
        #         c.log "val", val
        #         s.$emit "search_dict", val


    ]
        
        

    watches = []
    # watches.push s.$watch "pagename", _.debounce( ( (val) ->
    watches.push s.$watch "pageToLoad", (val) ->
        # c.log "pagename", val
        unless val? then return
        s.displaynum = val
        url = "/forfattare/#{author}/titlar/#{title}/sida/#{val}/#{mediatype}"

        prevpath = $location.path()

        loc = $location.path(url)
        unless _.str.contains prevpath, "/sida/"
            c.log "replace", prevpath
            loc.replace()
    # ), 300, {leading:true})

    s.isDefined = angular.isDefined

    loadPage = (val) ->
        # take care of state hiccup
        unless $route.current.controller == 'readingCtrl' 
            c.log "resisted page load"
            return

        c.log "loadPage", val
        # if val == s.pagename then return

        s.loading = true
        s.error = false
        # s.pagename = val
        backend.getPage(val, 
            authorid : author
            titlepath : title
            mediatype : mediatype
        ).then ([data, workinfo]) ->
            
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap

            s.startpage = workinfo.startpagename
            s.endpage = workinfo.endpagename


            page = $("page[name='#{val}']", data).last().clone()
            if not page.length
                page = $("page:last", data).clone()
                s.pagename = page.attr("name")
            else
                s.pagename = val

            s.displaynum = s.pagename
            s.pageix = s.pagemap["page_" + s.pagename]

            # if mediatype == 'faksimil' or isParallel
            s.sizes = new Array(5)
            for url in $("faksimil-url", page)
                s.sizes[Number($(url).attr("size")) - 1] = false
            
            if s.sizes[s.size] is false
                s.sizes[s.size] = true


            s.url = $("faksimil-url[size=#{s.size + 1}]", page).last().text()
            # else
            page.children().remove()
            s.etext_html = page.text()

            backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)
            s.loading = false
            $rootScope.breadcrumb = []
            s.appendCrumb [
                label : "författare"
                url : "#!/forfattare"
            ,
                label : (_.str.humanize author).split(" ")[0]
                url : "#!/forfattare/" + author
            ,
                label : "titlar"
                url : "#!/forfattare/#{author}/titlar"
            ,   
                label : (_.str.humanize workinfo.titlepath) + " sidan #{s.pagename} " + (s.mediatype or "")
                url : "#!/forfattare/#{author}/titlar/#{title}/info"
            ]

            s.setTitle "#{workinfo.title} sidan #{s.pagename} #{s.mediatype}"
        , (data) ->
            c.log "fail", data
            s.error = true
            s.loading = false
            



    s.size = 2
    
    s.setSize = (index) ->
        s.sizes = _.map s.sizes, (item) -> if item then false else item
        s.sizes[index] = true
        s.size = index
        loadPage(s.getPage())


    watches.push s.$watch "getPage()", debounce(loadPage, 200, {leading : false})
    # watches.push s.$watch "getPage()", loadPage

    # s.$on "$routeChangeSuccess", () ->
    #     c.log "routeChangeSuccess"

    s.$on "$destroy", () ->
        c.log "destroy reader"
        $document.off "keydown", onKeyDown
        for w in watches
            w()


