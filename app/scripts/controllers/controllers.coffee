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

    s.authors = backend.getAuthorList()
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
    

    s.$watch "selected_author", (newAuthor, prevVal) ->
        return unless newAuthor
        s.titles = backend.getTitlesByAuthor(newAuthor.authorid)

    


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
        searchData.save(startIndex, currentIndex, data, [s.query, getMediatypes()])


    s.getItems = () ->
        _.pluck "item", data.kwic


    s.search = (query) ->
        q = query or s.query
        $location.search("fras", q) if q

        s.query = q
        s.searching = true
        
        mediatype = getMediatypes()

        backend.searchWorks(s.query, mediatype, s.current_page  * s.num_hits, s.num_hits).then (data) ->
            s.data = data
            s.total_pages = Math.ceil(data.count / s.num_hits)
            s.searching = false

            for row in data.kwic
                itm = row.item
                row.href = "#!/forfattare/#{itm.authorid}/titlar/#{itm.titleidNew}" + 
                    "/sida/#{itm.pagename}/#{itm.mediatype}?#{backend.getHitParams(itm)}"





    queryvars = $location.search()

    util.setupHashComplex s,
        [
            scope_name : "current_page"
            key : "traffsida"
            val_in : Number
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





littb.controller "authorInfoCtrl", ($scope, $rootScope, backend, $routeParams) ->
    s = $scope
    _.extend s, $routeParams
    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data

        s.groupedWorks = _.values _.groupBy s.authorInfo.works, "lbworkid"
        $rootScope.appendCrumb data.surname




littb.controller "titleListCtrl", ($scope, backend, util, $timeout, $location) ->
    s = $scope
    # unless 'wor' $location.search()
    # s.workFilter = "works"
    s.searching = false
    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.showtitle == attrs.title
    
    s.sorttuple = ["itemAttrs.showtitle", false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc


    s.selectWork = () ->
        c.log "selectWork", s.workFilter
        if s.workFilter == "titles"
            s.authorFilter = null
            s.mediatypeFilter = ""
            # s.selectedLetter = null
            s.filter = null
        fetchWorks()

    # s.getRows = (letter) ->
    #     if s.workFilter == "works"
    #         return s.rowByLetter?[s.selectedLetter or "A"]
    #     else
    #         fetchWorks()

    fetchWorks = () ->
        s.searching = true
        #TODO: what about titles that start with strange chars or non lower case letters?
        backend.getTitles(s.workFilter == "titles", s.selectedLetter or "A").then (titleArray) ->
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
                

            authors = _.pluck titleArray, "author"

            s.authorData = _.unique authors, false, (item) ->
                item.authorid


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : "itemAttrs.showtitle"
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

        util.setupHash s, "selectedLetter"





littb.controller "helpCtrl", ($scope, $http, util, $location) ->
    s = $scope
    url = "/red/om/hjalp/hjalp.html"
    $http.get(url).success (data) ->
        s.htmlContent = data
        s.labelArray = for elem in $("[id]", data)
            label : $(elem).text()
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
            key : "authorFilter"
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
            return s.data.epub.url
        else if mediatype == "pdf" 
            return s.data.pdf.url

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
                    label : infoData.titlepath + " info " + (s.mediatype or "")
                    # url : "#!/forfattare/#{author}/titlar/#{infoData.titlepathnorm}"
                ]
                break







littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, searchData, debounce) ->
    s = $scope
    {title, author, mediatype, pagename} = $routeParams
    _.extend s, (_.omit $routeParams, "traff", "traffslut", "x", "y", "height", "width", "parallel")
    s.searchData = searchData

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

    s.$on "search_dict", (event, query) ->
        backend.searchLexicon(query).then (data) ->
            c.log "search_dict", data
            for obj in data
                if obj.baseform == query
                    s.lex_article = obj
                    break


    s.getPage = () ->
        $route.current.pathParams.pagename
    s.setPage = (ix) ->
        s.pageix = ix
        s.pagename = s.pagemap["ix_" + s.pageix]
    s.nextPage = () ->
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
        backend.searchLexicon(val)

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
        c.log "loadPage", val
        # unless val? then return


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

    s.size = 2
    
    s.setSize = (index) ->
        s.sizes = _.map s.sizes, (item) -> if item then false else item
        s.sizes[index] = true
        s.size = index
        loadPage(s.getPage())


    watches.push s.$watch "getPage()", debounce(loadPage, 100, {leading : true})
    # watches.push s.$watch "getPage()", loadPage

    s.$on "$destroy", () ->
        for w in watches
            w()



littb.factory "debounce", ($timeout) ->
    (func, wait, options) ->
        args = null
        inited = null
        result = null
        thisArg = null
        timeoutDeferred = null
        trailing = true
        
        delayed = ->
            inited = timeoutDeferred = null
            result = func.apply(thisArg, args) if trailing
        if options is true
            leading = true
            trailing = false
        else if options and angular.isObject(options)
            leading = options.leading
            trailing = (if "trailing" of options then options.trailing else trailing)
        return () ->
            args = arguments
            thisArg = this
            $timeout.cancel timeoutDeferred
            if not inited and leading
                inited = true
                result = func.apply(thisArg, args)
            else
                timeoutDeferred = $timeout(delayed, wait)
            result


littb.factory "util", ($location) ->
    PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i
    SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g
    MOZ_HACK_REGEXP = /^moz([A-Z])/
    camelCase = (name) ->
        name.replace(SPECIAL_CHARS_REGEXP, (_, separator, letter, offset) ->
            if offset then letter.toUpperCase() else letter
        ).replace MOZ_HACK_REGEXP, "Moz$1"


    xml2Str = (xmlNode) ->
        try
            # Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
            return (new XMLSerializer()).serializeToString(xmlNode)
        catch e
            try

                # Internet Explorer.
                return xmlNode.xml
            catch e
                #Other browsers without XML Serializer
                alert "Xmlserializer not supported"
        false


    getInnerXML : (elem) ->
        if "jquery" of elem
            unless elem.length then return null
            elem = elem.get(0)

        strArray = for child in elem.childNodes
            xml2Str child
        return strArray.join("")

    normalize : (name) ->
        camelCase(name.replace(PREFIX_REGEXP, ''))


    setupHashComplex : (scope, config) ->
        # config = [
        #     expr : "sorttuple[0]"
        #     scope_name : "sortVal"
        #     scope_func : "locChange"
        #     key : "sortering"
        #     val_in : (val) ->
        #         newVal
        #     val_out : (val) ->
        #         newVal
        #     post_change : () ->
        #     default : [val : valval]

        # ]
        onWatch = () ->
            for obj in config
                val = $location.search()[obj.key]
                unless val 
                    if obj.default then val = obj.default else continue
                

                val = (obj.val_in or _.identity)(val)
                

                if "scope_name" of obj
                    scope[obj.scope_name] = val
                else if "scope_func" of obj
                    scope[obj.scope_func](val)
                else
                    scope[obj.key] = val
        onWatch()
        scope.loc = $location
        scope.$watch 'loc.search()', ->
            onWatch()

        for obj in config
            watch = obj.expr or obj.scope_name or obj.key
            scope.$watch watch, do (obj, watch) ->
                (val) ->
                    val = (obj.val_out or _.identity)(val)
                    if val == obj.default then val = null
                    $location.search obj.key, val or null
                    obj.post_change?(val)





    setupHash : (scope, nameConfig...) ->
        names = _.map nameConfig, (item) ->
            if _.isObject(item)
                return (_.head _.pairs item)[0]
            else
                return item
        # c.log "init", _.pick($location.search(), names...)
        _.extend(scope, _.pick($location.search(), names...))
        scope.loc = $location
        scope.$watch 'loc.search()', ->
            _.extend(scope, _.pick($location.search(), names...))

        for name in nameConfig
            if _.isObject name
                [name, callback] = _.head _.pairs name
            scope[name] = $location.search()[name]
            scope.$watch name, do (name) ->
                (val) ->
                    $location.search(name, val or null)
                    callback(val) if callback





littb.factory 'backend', ($http, $q, util) ->
    # $http.defaults.transformResponse = (data, headers) ->

    http = (config) ->
        defaultConfig =
            method : "GET"
            params:
                username : "app"
            transformResponse : (data, headers) ->
                output = new DOMParser().parseFromString(data, "text/xml")
                if $("fel", output).length
                    c.log "fel:", $("fel", output).text()
                return output

        $http(_.merge defaultConfig, config)


    objFromAttrs = (elem) ->
        return null unless elem
        _.object ([util.normalize(attrib.name), attrib.value] for attrib in elem.attributes)

    parseWorkInfo = (root, xml) ->
        useInnerXML = ["sourcedesc", "license-text"]
        asArray = ["mediatypes"]
        output = {}
        for elem in $(root, xml).children()
            if elem.nodeName in useInnerXML
                val = util.getInnerXML elem

            else if elem.nodeName in asArray
                val = _.map $(elem).children(), (child) ->
                    $(child).text()
            else
                val = $(elem).text()

            output[util.normalize(elem.nodeName)] = val
        return output


    getHitParams : (item) ->
        if item.mediatype == "faksimil"
            obj = _.pick item, "x", "y", "width", "height"
            return _(obj).pairs().invoke("join", "=").join("&")
        else 
            return "traff=#{item.nodeid}&traffslut=#{item.endnodeid}"

    getTitles : (allTitles = false, initial = null) ->
        def = $q.defer()
        workAction = "get-works"
        if allTitles
            params = 
                action : "get-titles-by-string-filter"
                initial : initial
        else 
            params = 
                action : "get-works"


        http(
            url : "/query/lb-anthology.xql"
            params: params


        ).success (xml) ->
            # c.log "getTitles success", xml
            workIdGroups = _.groupBy $("item", xml), (item) ->
                $(item).attr("lbworkid")

            rows = {}
            for workid, elemList of workIdGroups
                itm = $(elemList[0])
                if not (objFromAttrs itm.find("author").get(0))
                    c.log "author failed", workid, itm
                rows[workid] =
                    itemAttrs : objFromAttrs elemList[0]
                    author : (objFromAttrs itm.find("author").get(0)) or ""
                    mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))

            rows = _.flatten _.values rows
            def.resolve rows
            # .fail -> def.reject()
        return def.promise

    getAuthorList : ->
        def = $q.defer()
        url = "/query/lb-authors.xql?action=get-authors"
        # url = "authors.xml"
        http(
            url : url
            ).success (xml) ->
            attrArray = for item in $("item", xml)
                objFromAttrs item

            def.resolve attrArray

        return def.promise

    getSourceInfo : (author, title, mediatype) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"
        params = 
            action : "get-work-info-init"
            authorid : author
            titlepath : title

        if mediatype
            params.mediatype = mediatype

        http(
            url : url
            params : params

        ).success (xml) ->
            output = parseWorkInfo("result", xml)

            prov = $("result provenance-data", xml)
            output["provenance"] = {
                text : $("text", prov).text()
                image : $("image", prov).text()
                link : $("link", prov).text()
            }

            sourcedesc = $("sourcedesc", xml)


            errata = $("errata", xml)
            output.errata = for tr in $("tr", errata)
                _($(tr).find("td")).map(util.getInnerXML)
                .map(_.str.strip).value()
            errata.remove()

            output.sourcedesc = (util.getInnerXML sourcedesc) or ""

            epub = $("result epub", xml)
            if epub.length
                output.epub = 
                    file_size: epub.attr("file-size")
                    url : util.getInnerXML epub
            pdf = $("result pdf", xml)
            if pdf.length
                output.pdf = 
                    file_size: pdf.attr("file-size")
                    url : util.getInnerXML pdf

            def.resolve output
        return def.promise

    getPage : (author, title, mediatype, pagenum) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"

        params =
            action : "get-work-data-init"
            authorid : author
            titlepath : title
            navinfo : true
            css : true
            workdb : true
            mediatype: mediatype

        if pagenum then params["pagename"] = pagenum

        http(
            url : url
            params : params
        ).success (xml) ->
            info = parseWorkInfo("LBwork", xml)
            c.log "info", info

            info["authorFullname"] = $("author-fullname", xml).text()
            info["showtitle"] = $("showtitle:first", xml).text()
            info["css"] = $("css", xml).text()
            pgMap = {}
            for page in $("bok sida", xml)
                p = $(page)
                pgMap["ix_" + p.attr("ix")] = p.attr("sidn")
                pgMap["page_" + p.attr("sidn")] = Number p.attr("ix")


            info.pagemap = pgMap

            info.parts = _.map $("parts > part", xml), objFromAttrs


            info.mediatypes = for mediatype in $("mediatypes mediatype", xml)
                util.getInnerXML mediatype
 

            def.resolve [xml, info]

        return def.promise

    getAuthorInfo : (author) ->
        def = $q.defer()
        url = "/query/lb-authors.xql"
        http(
            url : url
            params :
                action : "get-author-data-init"
                authorid : author

        ).success (xml) ->
            authorInfo = {}
            for elem in $("LBauthor", xml).children()
                if elem.nodeName == "intro"
                    val = util.getInnerXML elem
                else
                    val = $(elem).text()

                authorInfo[util.normalize(elem.nodeName)] = val

            works = []
            for item in $("works item", xml)
                obj = objFromAttrs item
                # _.extend obj,
                    # mediatypes : _.unique (_.map $("mediatypes", item).children(), (child) -> $(child).attr("mediatype"))
                works.push obj

            authorInfo.works = works

            authorInfo.smallImage = util.getInnerXML $("image-small-uri", xml)
            authorInfo.largeImage = util.getInnerXML $("image-large-uri", xml)

            def.resolve authorInfo

        return def.promise


    getStats : () ->
        def = $q.defer()
        url = "/query/lb-stats.xql"
        http(

            url : url
            params :
                action : "get-overall-stats"

        ).success (xml) ->
            output = {}
            parseObj = ["pages", "words"]
            # getting two tables for some reason
            if $("table", xml).length > 1
                $("table", xml).last().remove()
            for elem in $("result", xml).children()
                if elem.tagName == "table"
                    c.log "table", elem, $("td:nth-child(2) a", elem)
                    output.titleList = ("<a href='#!/#{$(x).attr('href').slice(3)}'>#{$(x).text()}</a>" for x in $("td:nth-child(2) a", elem))
                    c.log "titleList", output.titleList
                else if elem.tagName in parseObj
                    output[elem.tagName] = _.object _.map $(elem).children(), (child) ->
                        [child.tagName, $(child).text()]
                else
                    output[elem.tagName] = $(elem).text()

            def.resolve output



        return def.promise

    getTitlesByAuthor : (authorid) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"
        http(

            url : url
            params :
                action : "get-titles-by-author"
                authorid : authorid
        ).success (xml) ->
            output = []
            for elem in $("result", xml).children()
                output.push objFromAttrs(elem)

            def.resolve output


        return def.promise

    searchWorks : (query, mediatype, resultitem, resultlength) ->
        def = $q.defer()
        url = "/query/lb-search.xql"

        http(
            method : "POST"
            url : url
            headers : {"Content-Type" : "text/xml; charset=utf-8"}
            params :
                action : "search"
            # <item type="titlepath" mediatype="all">Intradestal1786</item>
            data : """
                    <search>
                        <string-filter>
                            <item type="string">#{query}|</item>
                        </string-filter>
                    <domain-filter>
                    <item type="all-titles" mediatype="#{mediatype}"></item>
                    </domain-filter>
                    <ne-filter>
                        <item type="NUL"></item>
                    </ne-filter>
                    </search>
                """
        ).success((data) ->
            c.log "success", $("result", data).attr("ref")
            ref = $("result", data).attr("ref")


            http(

                url : url
                params :
                    action : "get-result-set"
                    searchref : ref
                    resultlength : resultlength
                    resultitem : resultitem + 1

            ).success (resultset) ->
                c.log "get-result-set success", resultset, $("result", resultset).children()

                output = {kwic : [], count : parseInt($("result", resultset).attr("count"))}

                for elem in $("result", resultset).children()
                    [left, kw, right, work] = _.map $(elem).children(), $
                    # c.log "elem", work.get(0), work.get(0).attributes
                    output.kwic.push
                        left : left.text()
                        kw : kw.text()
                        right : right.text()
                        item : objFromAttrs work.get(0)

                def.resolve output



        ).error (data) ->
            c.log "error", arguments
            def.reject()
        return def.promise

    searchLexicon : (str) ->
        c.log "searchLexicon", str
        def = $q.defer()
        url = "/query/so.xql"
        suffix = if str.length > 3 then "*" else ""

        http(
            url : url
            params :
                word : str + suffix
            # transformResponse : (data, headers) ->
            #     c.log "transformResponse", data, headers

        ).success( (xml) ->
            c.log "searchLexicon success", xml

            output = for article in $("artikel", xml)
                baseform : $("grundform-clean:first", article).text()
                # lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                lexemes : util.getInnerXML article

            def.resolve output
        ).error () ->
            def.reject()



        return def.promise

    getBiblinfo : (params, wf) ->
        def = $q.defer()

        url = "http://demolittb.spraakdata.gu.se/sla-bibliografi/?" + params

        $http(
            url : url
            method : "GET"
            params:
                username : "app"
                wf : wf
        ).success (xml) ->
            output = for entry in $("entry", xml)
                title : util.getInnerXML $("title", entry)
                isbn : util.getInnerXML $("isbn", entry)
                issn : util.getInnerXML $("issn", entry)
                archive : util.getInnerXML $("manusarchive ArchiveID", entry)


            def.resolve output
        return def.promise

    submitContactForm : (name, email, message) ->
        def = $q.defer()

        url = "query/lb-contact.xql"

        params = 
            action : "contact-test"
            lang : "swe"
            ContactName : name
            ContactEmail : email
            ContactMessage : message


        http(
            url : url
            params: params

        ).success(def.resolve)
        .error def.reject
        
        return def.promise


