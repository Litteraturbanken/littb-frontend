'use strict';

window.c = console ? log : _.noop
littb = angular.module('littbApp')


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
        c.log "data", data
        s.data = data

littb.controller "searchCtrl", ($scope, backend, $location, $document, $window, $rootElement, util, searchData, authors, debounce) ->
    s = $scope
    s.open = false
    s.proofread = 'all'

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


    util.setupHashComplex s, [
            scope_name : "num_hits"
            key : "per_sida"
            val_in : Number
            default : 20
        ,
            key: "prefix"
        ,   
            key : "suffix"
        ,   
            key : "infix"
    ]

    s.nHitsChange = () ->
        c.log "nHitsChange", s.data
        s.current_page = 0
        if s.data
          s.search()  

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
    s.num_hits ?= 20
    s.current_page = 0

    
    getMediatypes = () ->
        {
            yes : "etext"
            no : "faksimil"
            all : "all"
        }[s.proofread]


    s.nextPage = () ->
        if (s.current_page  * s.num_hits) + s.kwic.length < s.hits
            s.current_page++
            c.log "nextpage search"
            s.search(s.query)
    s.prevPage = () ->
        if not s.current_page or s.current_page == 0 then return
        s.current_page--
        s.search(s.query)

    s.firstPage = () ->
        s.current_page = 0
        s.search(s.query)
    s.lastPage = () ->
        s.current_page = s.total_pages - 1
        s.search(s.query)
    

    s.save_search = (startIndex, currentIndex, data) ->
        c.log "save_search", startIndex, currentIndex, data

        c.log "searchData", searchData
        searchData.save(startIndex, currentIndex, data, [s.query, getMediatypes()])


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
        Math.min s.hits, (s.current_page  * s.num_hits) + s.kwic.length


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


    s.search = debounce((query) ->
        q = query or s.query
        unless q then return
        $location.search("fras", q) if q

        s.query = q
        s.searching = true
        
        mediatype = getMediatypes()

        from = s.current_page  * s.num_hits
        to = (from + s.num_hits) - 1

        backend.searchWorks(s.query,
            mediatype,
            from,
            to,
            $location.search().forfattare,
            $location.search().titel,
            s.prefix,
            s.suffix,
            s.infix).then (data) ->
                c.log "search data", data
                s.data = data
                s.kwic = data.kwic or []
                s.hits = data.hits
                s.searching = false
                s.total_pages = Math.ceil(s.hits / s.num_hits)

                for row in (data.kwic or [])
                    row.href = searchData.parseUrls row
    , 200)

    queryvars = $location.search()

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





littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util) ->
    s = $scope
    # [s.author, s.showtitles] = $routeParams.author.split("/")
    _.extend s, $routeParams
    s.showpage = null
    s.show_large = false

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
                from = xml.indexOf "<body>"
                to = xml.indexOf "</body>"
                xml = xml[from..to + "</body>".length]
                s.externalDoc =  _.str.trim xml


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

        c.log "loaded", s.showpage
        if not s.authorInfo.intro and s.showpage == "introduktion"
            $location.path("/forfattare/#{s.author}/titlar").replace()





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

    s.filterAuthor = (row) ->
        unless s.authorFilter then return true
        row.author.authorid == s.authorFilter

        


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

    s.authorDef = authors

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
        return

        


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

    s.keydown = (event) ->
        c.log event.keyCode
        if event.keyCode == 40 # down arrow
            # TODO: this is pretty bad but couldn't be done using the typeahead directive
            if $(".input_container .dropdown-menu").is(":hidden")
                #typeaheadTrigger directive
                s.$broadcast "open", s.lex_article


    s.showModal = () ->
        c.log "showModal", modal
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
        # s.lex_article = null
            



    s.closeModal = () ->
        # modal.close()
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
    s.isEditor = false
        
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

    s.onPartClick = (startpage) ->
        s.gotopage(startpage)
        s.showPopup = false

    s.resetHitMarkings = () ->
        for key in ["traff", "traffslut", "x", "y", "height", "width"]
            s[key] = null
            # $location.search( key, null).replace()
    
    # s.dict_not_found = "Hittade inget uppslag"
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
            key : "isReading"


    ]
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
    # watches.push s.$watch "pagename", _.debounce( ( (val) ->
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


    loadPage = (val) ->
        # take care of state hiccup
        unless $route.current.controller == 'readingCtrl' 
            c.log "resisted page load"
            return

        c.log "loadPage", val
        # if val == s.pagename then return

        s.loading = true
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

            if val then params["pagename"] = val


        # s.pagename = val
        backend.getPage(params).then ([data, workinfo]) ->
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap

            steps = for page in $("page", data) when $(page).attr "pagestep"
                [($(page).attr "pageix"), Number($(page).attr "pagestep")]

            s.stepmap = _.object steps
            s.pagestep = Number $("pagestep", data).text()

            s.startpage = workinfo.startpagename
            s.endpage = workinfo.endpagename


            page = $(pageQuery, data).last().clone()

            c.log "s.pagestep", s.pagestep

            setPages(page, data)
            
            ixes = _.map $("sida", data), (item) ->
                Number $(item).attr("ix")

            s.endIx = Math.max ixes...

            # if mediatype == 'faksimil' or isParallel
            s.sizes = new Array(5)
            for url in $("faksimil-url", page)
                s.sizes[Number($(url).attr("size"))] = false
            
            if s.sizes[s.size] is false
                s.sizes[s.size] = true

            c.log "loadpage result", s.size

            s.url = $("faksimil-url[size=#{s.size}]", page).last().text()
            # else
            page.children().remove()
            s.etext_html = _.str.trim page.text()
            unless s.isEditor
                c.log "log pageix", s.pageix
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
            



    
    s.setSize = (index) ->
        c.log "setsize", index
        s.sizes = _.map s.sizes, (item) -> if item then false else item
        s.sizes[index] = true
        s.size = index
        loadPage(s.getPage())

    # s.size = s.setSize($location.search().size or 2)

    watches.push s.$watch "getPage()", debounce(loadPage, 200, {leading : false})
    # watches.push s.$watch "getPage()", loadPage

    # s.$on "$routeChangeSuccess", () ->
    #     c.log "routeChangeSuccess"

    s.$on "$destroy", () ->
        c.log "destroy reader"
        $document.off "keydown", onKeyDown
        $document.off "click", onClickOutside
        for w in watches
            w()


