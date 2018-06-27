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
        for key in ["markee_from", "markee_to", "x", "y", "height", "width"]
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
        s.resetHitMarkings()
        s.show_search_work = false

    onKeyDown = (event) ->
        if event.metaKey or event.ctrlKey or event.altKey then return
        s.$apply () ->
            switch event.which
                when 39 
                    if navigator.userAgent.indexOf("Firefox") != -1 or $rootElement.prop("scrollWidth") - $window.scrollX == $($window).width()
                        s.nextPage()
                when 37 
                    if $window.scrollX == 0
                        s.prevPage()

    $document.on "keydown", onKeyDown

    s.getPage = () ->
        if s.isEditor
            $route.current.pathParams.ix
        else
            $route.current.pathParams.pagename or s.startpage
    

    s.setPage = (ix) ->
        s.pageix = ix
        s.pageToLoad = s.pagemap["ix_" + s.pageix]

    s.getStep = () ->
        s.workinfo?.stepmap[s.pageix] or s.workinfo?.pagestep or 1

    
    s.nextPage = (event) ->
        event?.preventDefault()
        if s.isEditor
            s.pageix = s.pageix + s.getStep()
            # s.pageix = s.pageix + 1
            s.pageToLoad = s.pageix
            return
        unless s.endpage then return
        newix = s.pageix + s.getStep()
        # newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        # else
        #     s.setPage(0)
    
    s.prevPage = (event) ->
        event?.preventDefault()
        # unless s.pagemap then return
        if s.isEditor
            s.pageix = s.pageix - s.getStep()
            # s.pageix = s.pageix - 1
            s.pageToLoad = s.pageix
            return
        newix = s.pageix - s.getStep()
        # newix = s.pageix - 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)

    
    s.isBeforeStartpage = (pageix) ->
        if s.isEditor then return false
        unless s.pagemap then return
        startix = s.pagemap["page_" + s.startpage]
        pageix <= startix

    s.getFirstPageUrl = () ->
        search = window.location.search
        if s.isEditor
            "/editor/#{$routeParams.lbid}/ix/0/#{$routeParams.mediatype}" + search
        else
            "/forfattare/#{author}/titlar/#{title}/sida/#{s.startpage}/#{mediatype}" + search
    
    s.getPrevPageUrl = () ->
        unless s.pagemap then return
        newix = s.pageix - s.getStep()
        # newix = s.pageix - 1
        if "ix_" + newix of s.pagemap
            page = s.pagemap["ix_" + newix]
            "/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{mediatype}"
        else
            ""
    
    s.getNextPageUrl = () ->
        unless s.endpage then return
        if s.pageix == s.pagemap["page_" + s.endpage] then return
        newix = s.pageix + s.getStep()
        # newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            page = s.pagemap["ix_" + newix]
            "/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{mediatype}"
        else
            ""
    
    s.getLastPageUrl = () ->
        if s.isEditor
            "/editor/#{$routeParams.lbid}/ix/#{s.endIx}/#{$routeParams.mediatype}"
        else
            "/forfattare/#{author}/titlar/#{title}/sida/#{s.endpage}/#{mediatype}"

    s.getPageUrl = (page) ->
        unless page then return ""
        search = $location.url().split("?")?[1]
        suffix = ""
        if search
            suffix = "?" + search

        "/forfattare/#{author}/titlar/#{title}/sida/#{page}/#{s.mediatype}" + suffix

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

    partStartsOnPage = (part) ->
        return s.pagemap["page_" + part.startpagename] == s.pageix

    getAllCurrentParts = () ->
        unless s.workinfo then return
        _.filter s.workinfo.parts, (part) ->
            startix = s.pagemap["page_" + part.startpagename] 
            endix = s.pagemap["page_" + part.endpagename] 
            return (s.pageix <= endix) and (s.pageix >= startix)

    findShortest = (parts) ->
        _.min parts, (part) ->
            startix = s.pagemap["page_" + part.startpagename] 
            endix = s.pagemap["page_" + part.endpagename] 
            return endix - startix

    getLastSeenPart = (findIndex, filterEnded, ignoreCurrent) ->
        maybePart = _.last _.dropRightWhile s.workinfo.partStartArray, ([startix, part]) -> 
            if part == ignoreCurrent then return true # always go back a part
            endix = s.pagemap["page_" + part.endpagename] 
            if findIndex is endix then return false # shortcut
            if filterEnded and (endix < findIndex) then return true # toss out ended parts
            return (startix > findIndex) #or (endix <= findIndex) 

        if maybePart then return maybePart[1]

        # we're could be on a page between two parts
        # so find the last part that ended
        decorated = _.map s.workinfo.partStartArray, ([i, part]) -> 
            [findIndex - s.pagemap["page_" + part.endpagename], part]

        [diff, part] = _.min decorated, ([num, part]) ->
            if num < 0 then return 10000
            else return num

        return part




    s.getCurrentPart = () ->
        unless s.workinfo then return

        # there are no parts on this page
        unless getAllCurrentParts().length then return 

        partStartingHere = _.find s.workinfo.partStartArray, ([i, part]) -> 
            i == s.pageix

        return partStartingHere?[1] or getLastSeenPart(s.pageix, true)


    s.getNextPartUrl = () ->
        if not s.workinfo then return

        findIndex = s.pageix + 1 # should always go one page fwd

        next = _.first _.dropWhile s.workinfo.partStartArray, ([i, part]) -> i < findIndex

        unless next then return ""
        [i, newPart] = next

        return s.getPageUrl newPart.startpagename

    s.getPrevPartUrl = () ->
        if not s.workinfo then return
        if not s.workinfo.partStartArray.length then return

        [i, firstpart] = s.workinfo.partStartArray[0]
        if s.pageix <= i then return # disable prev if we're before first part

        ###
        firstParts = _.filter s.workinfo.partStartArray, ([startix]) ->
            # all parts that start at the same page as the first part
            s.workinfo.partStartArray[0][0] == startix

        shortestFirstpart = findShortest(_.map(firstParts, _.last))

        # are we at the first part?
        # i.e are we before the end of the first part?
        if (s.pageix <= s.pagemap["page_" + shortestFirstpart.endpagename])
            return null
        current = s.getCurrentPart()
        ###
        prev = getLastSeenPart(s.pageix - 1, false)

        unless prev then return ""

        return s.getPageUrl prev.startpagename


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
            default: "no"
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

    initSourceInfo = () ->
        if s.isEditor
            params = {
                lbworkid : $routeParams.lbid
            }
        else
            params = {
                "titlepath" : title,
                "authorid" : author
            }

        def = backend.getSourceInfo(params, mediatype)
        s.workinfoPromise = def 
        def.then (workinfo) ->
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap
            steps = []
            s.etextPageMapping ?= {}

            if mediatype == "faksimil"

                s.sizes = new Array(5)
                for i in s.workinfo.faksimil_sizes
                    s.sizes[i] = true


            s.startpage = workinfo.startpagename
            s.endpage = workinfo.endpagename
            if not pagename?
                s.pagename = pagename = s.startpage
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
            xmlSerializer = new XMLSerializer()
            childNodes = []
            for child in html.data.firstChild.childNodes
                childNodes.push xmlSerializer.serializeToString(child)
            s.etext_html = childNodes.join("").replace(/­/g, "-") # there's a soft hyphen in there, trust me
            return s.etext_html

        return def


    infoDef = initSourceInfo()
    fetchPage = (ix) ->
        if mediatype == "etext"
            return downloadPage(ix)
        else
            id = $routeParams.lbid or s.workinfo.lbworkid
            if s.isEditor
                basename = ix + 1
            else
                basename = s.workinfo.filenameMap[ix]
            filename = _.str.lpad(basename, 4, "0")
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

            if mediatype == "faksimil" and s.workinfo.searchable
                backend.fetchOverlayData(s.workinfo.lbworkid, s.pageix).then ([overlayHtml, overlayFactors]) ->
                    s.overlayFactors = overlayFactors
                    s.overlayHtml = overlayHtml

        , (err) ->
            c.log "page load error", err, $location.path()


            if s.isEditor
                fetchPage(Number(val)).then () ->
                s.loading = false
                s.first_load = true

            else
                s.error = true
                if not isDev
                    backend.logError "reader", {
                        path: $location.path()
                    }

    s.setSize = (index) ->
        c.log "setsize", index
        s.size = index
        loadPage(s.getPage())

    s.isSizeDisabled = (isIncrement) ->
        if s.isEditor then return false
        if isIncrement
            !s.sizes?[((s.size - 1) or 0) + 1]
        else
            !s.sizes?[((s.size - 1) or 0) - 1]


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



    ## START SEARCH

    s.getCleanUrl = () ->
        $location.url().split("?")[0]

    s.hasActiveSearch = () ->
        $location.search().s_query and not searchData?.isSearching

    s.searchData = searchData = new SearchWorkData(s)

    c.log "outside params", $location.search()
    query = $location.search().s_query
    if query
        args = {
            mediatype : mediatype
        }
        s.search_query = query
        getScopeVars = (args) ->
            output = {}
            if args.word_form_only
                output.lemma = true
            if args.prefix
                output.prefix = true
            if args.suffix
                output.suffix = true
            if args.prefix and args.suffix
                args.infix = true
            return output

        for key, val of $location.search()
            if _.str.startsWith key, "s_"
                k = key[2..]
                args[k] = val

        # _.extend s, getScopeVars(args)

            
        searchData.newSearch(args)
        searchData.current = Number($location.search().hit_index or 0)
        searchData.get(searchData.current).then changeHit

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
        searchData.current = hit
        searchData.get(hit).then changeHit



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
            lbworkid : s.workinfo.lbworkid
            prefix: $location.search().prefix
            suffix: $location.search().suffix
            # infix: $location.search().infix
            mediatype : mediatype
        }
        if not $location.search().lemma
            args.word_form_only = true
        searchArgs = {}
        for key, val of args
            searchArgs["s_" + key] = val


        prevArgs = {}
        for key, val of $location.search()
            if not (_.str.startsWith key, "s_") then prevArgs[key] = val

        $location.search(_.extend {}, prevArgs, searchArgs)
        c.log "searchArgs", searchArgs, prevArgs


        searchData.newSearch(args)
        searchData.current = 0
        searchData.get(0).then (hit) ->
            c.log "hit", hit
            unless hit then return
            changeHit(hit)
