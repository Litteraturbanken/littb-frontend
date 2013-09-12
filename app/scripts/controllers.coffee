'use strict';

window.c = console ? log : _.noop

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

littb.controller "searchCtrl", ($scope, backend, $location, util, searchData) ->
    s = $scope
    s.open = false
    s.searchProofread = true
    s.searchNonProofread = true

    initTitle = _.once (titlesById) ->
        unless $location.search().titel then return

        s.selected_title = titlesById[$location.search().titel]

    s.titleChange = () ->
        # $location.search("titel", s.selected_title?.titlepath.split("/")[0] or null)
        $location.search("titel", s.selected_title?.titlepath or null)

    s.checkProof = () ->

        if s.searchProofread and s.searchNonProofread
            out = null

        else if !s.searchProofread and s.searchNonProofread
            out = 'false'
        # else if searchProofread and !s.searchNonProofread

        else
            out = 'true'

        c.log "out", out
        return out


        # unless bool
        #     return 'true'


    s.authorChange = () ->
        $location.search("titel", null)


    s.authors = backend.getAuthorList()
    s.authors.then (authors) ->
        authorsById = _.object _.map authors, (item) -> [item.authorid, item]
            
        change = (newAuthor) ->
            return unless newAuthor
            backend.getTitlesByAuthor(newAuthor).then (data) ->
                s.titles = data
                titlesById = _.object _.map data, (item) -> [item.titlepath, item]    
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
        mediatype = [s.searchProofread and "etext", s.searchNonProofread and "faksimil"]
        # if not _.any mediatype then VALIDATION_ERROR
        if _.all mediatype
            mediatype = "all"
        else 
            mediatype = _.filter mediatype, Boolean

        return mediatype
    


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
            key : "pf"
            scope_name : "searchProofread"
            default : true
            val_in : (val) ->
                if val == 'false'
                    return false
                return val
            val_out : (val) ->
                if !val
                    return 'false'
                return val
        ,   
            key : "npf"
            scope_name : "searchNonProofread"
            default : true
            val_in : (val) ->
                if val == 'false'
                    return false
                return val
            val_out : (val) ->
                if !val
                    return 'false'
                return val
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
        s.entries?[s.showHit + 1] && s.showHit++
    s.decrement = () ->
        limit = true
        s.showHit && s.showHit--

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





littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams) ->
    s = $scope
    # [s.author, s.showtitles] = $routeParams.author.split("/")
    _.extend s, $routeParams

    refreshRoute = () ->
        s.showtitles = (_.last $location.path().split("/")) == "titlar"

    refreshTitle = () ->
        suffix = if s.showtitles then "Verk i LB" else "Introduktion"
        s.setTitle "#{s.authorInfo.fullName} - " + suffix

    refreshBreadcrumb = () ->
        if s.showtitles
            s.appendCrumb "titlar"
        else
            delete $rootScope.breadcrumb[2] 

    refreshRoute()

    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        c.log "change error", current
        _.extend s, current.pathParams

        refreshRoute()  
        refreshTitle()



    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data

        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "lbworkid"
        $rootScope.appendCrumb data.surname
        refreshTitle()



littb.controller "titleListCtrl", ($scope, backend, util, $timeout, $location, $q) ->
    s = $scope
    s.searching = false
    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.showtitle == attrs.title

    # s.titlesort = "itemAttrs.workshorttitle || itemAttrs.showtitle"
    s.titlesort = "itemAttrs.showtitle"

    
    s.sorttuple = [s.titlesort, false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    s.getTitleId = (row) ->
        [collection, title] = row.itemAttrs.titlepath.split('/')
        collection

    s.selectWork = () ->
        c.log "selectWork", s.workFilter
        if s.workFilter == "titles"
            s.authorFilter = null
            s.mediatypeFilter = ""
            # s.selectedLetter = null
            s.filter = null
        fetchWorks()

    authorDef = backend.getAuthorList().then (data) ->
        # s.authorIdGroup = _.groupBy data, (item) ->
        #     return item.authorid

        s.authorsById = _.object _.map data, (item) ->
            [item.authorid, item]

        s.authorData = data
        #     item.authorid

    # s.getRows = (letter) ->
    #     if s.workFilter == "works"
    #         return s.rowByLetter?[s.selectedLetter or "A"]
    #     else
    #         fetchWorks()

    fetchWorks = () ->
        s.searching = true
        #TODO: what about titles that start with strange chars or non lower case letters?
        titleDef = backend.getTitles(s.workFilter == "titles", s.selectedLetter or "A").then (titleArray) ->
            s.searching = false
            # c.log "getTitles", titleArray
            # titleArray should be like [{author : ..., mediatype : [...], title : ...} more...]
            window.titleArray = titleArray
            s.rowByLetter = _.groupBy titleArray, (item) ->
                item.itemAttrs.showtitle[0]
            if s.workFilter == "titles"
                s.currentLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("")
            else
                s.currentLetters = _.keys s.rowByLetter
                

            # authors = _.pluck titleArray, "author"

            # s.authorData = _.unique authors, false, (item) ->
            #     item.authorid

            # s.authorById = _.groupBy()

        $q.all([titleDef, authorDef]).then ([titleData, authorData]) ->





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
        ,
            key : "niva"
            scope_name : "workFilter"
            default : "works"
        ,
            key : "mediatypeFilter"
        ,
            key : "index",
            scope_name : "selectedLetter"
            default: "A"
            post_change : (val) ->
                c.log "val_in", val
                if s.workFilter == "titles"
                    fetchWorks()
                return val

        ]

    # timeout in order to await the setupHashComplex watch firing.
    # $timeout () ->
    unless s.selectedLetter then s.selectedLetter = "A"
    c.log "workfilter", s.workFilter
    fetchWorks()

littb.controller "epubListCtrl", ($scope, backend, util) ->
    s = $scope

    # TODO: what about the workauthor issue?
    s.sorttuple = ["author.nameforindex", false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    window.has = (one, two) -> one.toLowerCase().indexOf(two) != -1
    s.rowFilter = (item) ->
        if "epub" not in item.mediatype then return false
        if s.authorFilter and s.authorFilter.authorid != item.author.authorid then return false
        if s.filterTxt
            return false if not ((has item.author.fullname, s.filterTxt) or (has item.itemAttrs.showtitle, s.filterTxt))
        return true

    s.getAuthor = (row) ->
        [last, first] = row.author.nameforindex.split(",")

        [last.toUpperCase(), first].join ","

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
            label : _.str.humanize $(elem).attr("name")
            id : $(elem).attr("id")
            
        
        util.setupHashComplex s, [
            "key" : "ankare"
            post_change : (val) ->
                c.log "post_change", val
                unless val and $("##{val}").length
                    $(window).scrollTop(0)
                    return
                $(window).scrollTop($("##{val}").offset().top)
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


littb.controller "authorListCtrl", ($scope, backend, util) ->
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
    backend.getAuthorList().then (data) ->
        s.authorIdGroup = _.groupBy data, (item) ->
            return item.authorid
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


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams, $q) ->
    s = $scope
    {title, author, mediatype} = $routeParams
    _.extend s, $routeParams


    s.defaultErrataLimit = 8
    s.errataLimit = s.defaultErrataLimit
    s.isOpen = false

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
            return s.data?.epub.url
        else
            return "#!/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"


    infoDef = backend.getSourceInfo(author, title, mediatype)
    infoDef.then (data) ->
        s.init = true
        s.data = data
        if not s.mediatype
            s.mediatype = s.data.mediatypes[0]

    $q.all([backend.getAuthorList(), infoDef]).then ([authorData, infoData]) ->
        c.log "authorData", arguments
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







littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document) ->
    s = $scope
    {title, author, mediatype, pagename} = $routeParams
    _.extend s, (_.omit $routeParams, "traff", "traffslut", "x", "y", "height", "width", "parallel")
    s.searchData = searchData
    s.dict_not_found = false
    thisRoute = $route.current
    s.dict_searching = false
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
    s.pagename = pagename
    s.opts =
        backdropFade: true
        dialogFade:true


    s.closeModal = () ->
        s.lex_article = null
        $location.search("so", null)


    s.saveSearch = (str) ->
        c.log "str", str
        $location.search("so", str)

    s.$on "search_dict", (event, query, searchId) ->
        s.dict_searching = true
        backend.searchLexicon(query, false, searchId, true).then (data) ->
            s.dict_searching = false
            c.log "search_dict", data

            unless data.length
                # nothing found
                s.dict_not_found = true
                $timeout( () ->
                    s.dict_not_found = false
                , 3000)
                return

            result = data[0]
            for obj in data
                if obj.baseform == query
                    result = obj
                    continue

                    
            s.lex_article = result
            $location.search("so", result.baseform)

            

    if $location.search().so
        s.$emit "search_dict", $location.search().so

    $document.on "keydown", (event) ->
        # c.log "keypress", event.key, event.keyCode, event.which
        s.$apply () ->
            # TODO: check scroll location before switching page
            switch event.which
                when 39 then s.nextPage()
                when 37 then s.prevPage()


    s.getPage = () ->
        $route.current.pathParams.pagename
    s.setPage = (ix) ->
        s.pageix = ix
        s.pagename = s.pagemap["ix_" + s.pageix]
    s.nextPage = () ->
        if Number(s.displaynum) == s.endpage then return
        newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)
    s.prevPage = () ->
        newix = s.pageix - 1
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


    s.getWords = (val) ->
        backend.searchLexicon(val, true)

    s.getTooltip = (part) ->
        return part.navtitle if part.navtitle != part.showtitle

    s.toggleParallel = () ->
        s.isParallel = !s.isParallel

    s.supportsParallel = () ->
        unless s.workinfo then return
        'etext' in s.workinfo.mediatypes and 'faksimil' in s.workinfo.mediatypes


    util.setupHashComplex s, [
            scope_name : "markee_from"
            key : "traff"
        ,
            scope_name : "markee_to"
            key : "traffslut"
        ,
            key : "x"
        ,
            key : "y"
        ,
            key : "width"
        ,
            key : "height"
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
    watches.push s.$watch "pagename", (val) ->
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

            


        s.pagename = val
        backend.getPage(author, title, mediatype, s.pagename).then ([data, workinfo]) ->
            # c.log "data, workinfo", data, workinfo
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap
            # c.log "pagemap", s.pagemap
            # c.log "parts", workinfo.parts

            s.startpage = Number(workinfo.startpagename)
            s.endpage = Number(workinfo.endpagename)


            page = $("page[name=#{s.pagename}]", data).last().clone()
            if not page.length
                page = $("page:last", data).clone()
                s.pagename = page.attr("name")

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

            $rootScope.breadcrumb = []
            c.log "write reader breadcrumb", $location.path(), $route.current
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
                url : "#!/forfattare/#{author}/titlar/#{title}"
            ]

            s.setTitle "#{workinfo.title} sidan #{s.pagename} #{s.mediatype}"

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
        $document.off "keydown"
        for w in watches
            w()


