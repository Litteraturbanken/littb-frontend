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

    s.titleSort = (a) ->
        _.map a.shorttitle.split(/(\d+)/), (item) -> 
            if Number(item)
                zeroes = (_.map [0..(10 - item.toString().length)], () -> "0").join("")

                return zeroes + item.toString()
            else 
                return item
        

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
        s.current_page = 0
        if s.data
          s.search()  

    authors.then ([authorList, authorsById]) ->
        s.authors = authorList
        change = (newAuthor) ->
            return unless newAuthor
            backend.getTitlesByAuthor(newAuthor).then (data) ->
                filteredTitles = _.filter data, (item) -> "/" not in item.titlepath
                s.titles = filteredTitles
                titlesById = _.object _.map filteredTitles, (item) -> [item.lbworkid, item]    
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
    
    getSearchArgs = () ->
        from = s.current_page  * s.num_hits
        to = (from + s.num_hits) - 1
        
        [s.query,
        getMediatypes(),
        from,
        to,
        $location.search().forfattare,
        $location.search().titel,
        s.prefix,
        s.suffix,
        s.infix]    

    s.save_search = (startIndex, currentIndex, data) ->
        c.log "save_search", startIndex, currentIndex, data

        c.log "searchData", searchData

        searchData.save(startIndex, currentIndex + s.current_page  * s.num_hits, data, getSearchArgs())


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
        s.pageTitle = q
        s.searching = true
        


        from = s.current_page  * s.num_hits
        to = (from + s.num_hits) - 1

        args = getSearchArgs()
        backend.searchWorks(args...).then (data) ->
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
        ,
            key : "fras"
            post_change : (val) ->
                if val
                    s.search val


        ]

    # if "fras" of queryvars
    #     s.search(queryvars.fras)

littb.controller "textjamforelseCtrl", ($scope, $animate, $rootScope, $location, $modal, backend, $window, $timeout) ->
    s = $scope
    s.loading = false
    s.error = false
    s.work = null
    s.works = null
    s.worksToCompare = []
    s.showBulk = false
    s.witTitles = []
    s.contextVersions = null
    myWits = []
    contextVersionsContext = null
    showInTextContext = null
    
    backend.getKollatWorks().then (works) ->
        s.works = works
    
    $animate.enabled(false)
    
    makeHTMLold = (data, myWits) ->
        cleanAppsNew = (data, myWits) ->
            # build wit filter and split cache
            filterCache = {}
            splitCache = {}
            makeCache = (k0, v0, i0, stop) ->
              i = i0
              while i <= stop
                wit = 'w' + i
                k = k0.concat wit
                v = if wit in myWits then v0.concat wit else v0
                kstr = ('#'+w for w in k).join(' ')
                filterCache[kstr] = v.join(' ')
                splitCache[k.join(' ')] = k
                makeCache k, v, i+1, stop
                i++
              return
            makeCache([], [], 1, s.work.works.length)
            
            appPat = /^\s*<app>/
            endAppPat = /^\s*<\/app>/
            rdgPat = /^\s*<rdg wit="(.*?)"(?: rend="(.*?)")?(?:>(.*?)<\/rdg>)?/
            anchorPat = /^\s*<anchor type="(.*?)" ref="(.*?)"\/>/
            pbPat = /^\s*<pb n="(.*?)" ref="(.*?)"\/>/
            wPat = /^[\wåäöÅÄÖ]/
            
            app = null
            apps = []
            pages = []
            appPages = []
            anchors = []
            prevApp = []
            myWitsStr = myWits.join(' ')
            myWitsLen = myWits.length
            skipToAppEnd = false
            c0 = c1 = c2 = c3 = c4 = c5 = c6 = 0
                
            mergeApps = (app1, app2) ->
                app1len = app1.length
                app2len = app2.length
                if app1len == 1 == app2len # both not diff. can merge
                    c0++
                    app1[0].text += app2[0].text
                else if app2len > 1 and app2len == app1len and (
                  app2len == 2 or ( ->
                    for rdg1 in app1
                        appHasWit = false
                        for rdg2 in app2
                            if rdg1.wit == rdg2.wit
                                appHasWit = true
                                break
                        return false if not appHasWit
                    return true
                  )()
                  )
                    c5++
                    for rdg1 in app1
                        for rdg2 in app2
                            if rdg1.wit == rdg2.wit
                                rdg1.text += rdg2.text
                                break
                else if app2len > 1 and app1len > 1 # both are diff. can merge
                    c1++
                    merged = []
                    for rdg1 in app1
                        rdg1text = rdg1.text
                        wit1 = rdg1.wit
                        if (rdg2 = _.find(app2, (rdg)-> rdg.wit == wit1)) != undefined
                            c2++
                            # the simple merge
                            merged.push {'wit': wit1, 'text': rdg1text + rdg2.text}
                        else
                            c3++
                            w1split = splitCache[wit1]
                            for rdg2 in app2    
                                # maybe can check for equality before split?, if w1split.length == 1 ...
                                w2split = splitCache[rdg2.wit]
                                # partition rdg1 and rdg2 wits into common and uncommon wits
                                commonWits = []
                                uncommonWits = []
                                for w in w1split
                                    if w in w2split
                                        commonWits.push w
                                    else
                                        uncommonWits.push w
                                        
                                w1split = uncommonWits # keep uncommon for next iteration
                                
                                if commonWits.length != 0
                                    merged.push
                                        'wit': commonWits.join(' ')
                                        'text': rdg1text + rdg2.text
                                
                                if w1split.length == 0
                                    break # found all wits of w1
                            
                            if w1split.length > 0
                                c.log app1, merged, app2
                                throw 'w1split.length != 0'
                     
                     # replace app1's rdgs with the new merged apps
                     for rdg,i in merged
                         app1[i] = rdg
                     app1len = merged.length
                     
                else # can not merge
                    return false
                return true
            
            lastIndex = 0
            index = -1
            dataLen = data.length
            while lastIndex < dataLen
                index = data.indexOf('\n', lastIndex)
                if index == -1
                    index = dataLen
                line = data.substr(lastIndex, index - lastIndex)
                lastIndex = index + 1
                
                if app == null 
                    if appPat.test(line)#line.indexOf('<app>') != -1
                        app = []
                else
                    if !skipToAppEnd and result = rdgPat.exec(line) # rdg
                        wits = result[1]
                        if (wits = filterCache[wits]) != ''
                            rend = result[2]
                            text = result[3]
                            # if this reading contains all our choosen wits (should be most of the time)
                            # then we're done with his app
                            if wits == myWitsStr
                                c6++
                                skipToAppEnd = true
                                if text is undefined # check for empty reading
                                    #app = null # skip this app completely
                                    continue # dont add reading
                            
                            if text is undefined
                                text = ''
                            else if wPat.test(text)
                                if rend != undefined
                                    if rend == 'italic'
                                        text = '<i>' + text + '</i>'
                                    else if rend == 'bold'
                                        text = '<b>' + text + '</b>'
                                    else 
                                        c.error 'unknown rend=', rend
                                text = ' ' + text
                            
                            # add reading to app
                            app.push {'wit': wits, 'text': text}
                    
                    else if endAppPat.test(line) #line.indexOf('</app>') != -1
                        skipToAppEnd = false
                        # first join any anchors (paragraphs)
                        dontMerge = false
                        if anchors.length != 0
                            wits = anchors.join(' ')
                            anchorApp = []
                            anchorApp.wit = wits
                            anchorApp.text = '<p class="koll-p wit ' + wits + '"></p>'
                            anchorApp.anchor = 'p'
                            apps.push anchorApp
                            anchorApp = null
                            dontMerge = true
                            anchors.length = 0
                        
                        if appPages.length != 0
                            for page in appPages
                                apps.push page
                            appPages.length = 0
                            dontMerge = true
                        
                        # try to merge with previous app
                        if app.length != 0 and (dontMerge or !mergeApps(prevApp, app))
                            # didnt merge, push new app
                            c4++
                            
                            if app.length > 1
                                # attach pagename to diff
                                app.pages = []
                                for wit, n of pages
                                    hasPage = false
                                    for page in app.pages
                                        if n == page.n
                                            page.wit += ' ' + wit
                                            hasPage = true
                                            break
                                    if not hasPage
                                        app.pages.push {'wit': wit, 'n': n}
                                
                            apps.push app
                            prevApp = app
                        
                        app = null
                        
                    else if (result = anchorPat.exec(line)) != null
                        # type = result[1]
                        wits = result[2]
                        if (wits = filterCache[wits]) != ''
                            for wit in splitCache[wits]
                                anchors.push wit
                    
                    else if (result = pbPat.exec(line)) != null
                        n = result[1]
                        wits = result[2]
                        if (wits = filterCache[wits]) != ''
                            appPages.push
                                page: true
                                wit: wits
                                n: n
                                
                        
            c.log 'c0', c0, 'c1', c1, 'c2', c2, 'c3', c3, 'c4', c4, 'c5', c5, 'c6', c6
            return apps
            
        makeHtmlFromApps = (apps) ->
            # make html
            html = ''
            
            myWitsStr = myWits.join(' ')
            
            # how many words to show before and after in context
            nWords = 3
            
            hasContext = false
            
            appsLen = apps.length
            
            oddContext = false
            
            doAddPageToContext = false
            
            startContext = () ->
                oddContext = !oddContext
                if oddContext
                    html += "<span class='koll-context odd'>"
                else
                    html += "<span class='koll-context'>"
                hasContext = true
                doAddPageToContext = true
            
            endContext = () ->
                html += "</span>"
                hasContext = false
            
            pages = ({wit: wit, n: null, usedInContext: true} for wit in myWits)
            
            for app, appIndex in apps
                
                if app.anchor == 'p'
                    if app.wit == myWitsStr
                        if hasContext
                            endContext()
                    html += app.text
                
                else if app.page
                    # html += app[0].text
                    html += '<span class="koll-pb wit '+app.wit+'">'+app.n+'</span>'
                    for page in pages
                        if app.wit is page.wit
                            page.n = app.n
                            page.usedInContext = false
                            break
                    
                else if app.length > 1  # diff
                    if !hasContext
                        startContext()
                    
                    # context-pb is for showing page numbers in hide-bulk view
                    # pb is for showing page numbers in show-bulk view
                    if doAddPageToContext # only add one context-pb per context
                        doAddPageToContext = false
                        for page in pages
                            if !page.usedInContext
                                html += '<span class="koll-context-pb wit '+page.wit+'">'+page.n+'</span>'
                                page.usedInContext = true
                    html += "<span class='koll-changed'>"
                    for rdg in app
                        html += "<span class='wit #{rdg.wit}'>"
                        html += rdg.text || '&nbsp;'
                        html += "</span>"
                    html += "</span>" # .koll-changed
                    
                else # no diff
                    text = app[0].text
                    
                    prevIsDiff = hasContext
                    pre = bulk = post = null
                    
                    nextIsDiff = appIndex+1 != appsLen and apps[appIndex+1].length > 1
                    
                    if !prevIsDiff and !nextIsDiff
                        # all is bulk
                        bulk = text
                    else if (prevIsDiff and nextIsDiff)
                        # create pre + bulk + post
                        if (bulkStartIndex = nthIndexOf(text, ' ', nWords+1)) != -1 and
                           (bulkEndIndex = lastNthIndexOf(text, ' ', nWords)) > bulkStartIndex
                            pre = text.substr(0, bulkStartIndex)
                            bulk = text.substr(bulkStartIndex, bulkEndIndex - bulkStartIndex)
                            post = text.substr(bulkEndIndex)
                        else
                            # text has too few words to put in bulk. add to context
                            html += text
                    else if prevIsDiff #and !nextIsDiff
                        # create pre + (bulk)
                        bulkStartIndex = nthIndexOf(text, ' ', nWords+1)
                        if bulkStartIndex != -1
                            pre = text.substr(0, bulkStartIndex)
                            bulk = text.substr(bulkStartIndex)
                        else
                            pre = text
                    else # !prevIsDiff and nextIsDiff
                        # create (bulk) + post
                        bulkEndIndex = lastNthIndexOf(text, ' ', nWords)
                        if bulkEndIndex > 0 # if has bulk
                            bulk = text.substr(0, bulkEndIndex)
                            post = text.substr(bulkEndIndex)
                        else # all post
                            post = text
                    
                    if pre != null
                        html += pre
                        endContext()
                    if bulk != null
                        html += "<span class='bulk'>" + bulk + "</span>"
                    if post != null
                        startContext()
                        html += post
            
            if hasContext
                endContext()
            
            return html
            
        #c.time 'cleanApps'
        # c.profile 'cleanApps'
        apps = cleanAppsNew(data, myWits)
        # c.profileEnd 'cleanApps'
        # c.timeEnd 'cleanApps'
        
        # c.time 'make html'
        html = makeHtmlFromApps(apps)
        # c.timeEnd 'make html'
        
        return html
    
    s.submit = () ->
        c.log "submit textjamforelse"
        c.log "title", s.work.title
        c.log "workgroup", s.work.workgroup
        c.log "utgåvor:"
        c.log ((w.title + ", id:" + w.id) for w in s.worksToCompare).join("\n")
        
        workgroup = s.work.workgroup
        ids = []
        s.witTitles = {}
        s.witUrls = {}
        myWits = []
        for work, i in s.work.works
            if work in s.worksToCompare
                wit = 'w' + (i+1)
                myWits.push wit
                ids.push work.id
                s.witTitles[wit] = work.title
                s.witUrls[wit] = "/#!/forfattare/LagerlofS/titlar/#{work.path}/info/"
        
        s.haveText = false
        $('#koll-text').html('') # do this while getDiff is loading 
        s.loading = true
        s.error = false
        
        backend.getDiff( workgroup, myWits, ids... ).then (data) ->
            # c.time 'makeHTML all'
            #c.profile 'makeHTML all'
            
            html = makeHTMLold data, myWits
            s.loading = false
            s.haveText = true
            
            # c.time 'parse html'
            $('#koll-text').html(html)
            # snippet = substr10bulks(0, html)
            # $('#koll-text')[0].innerHTML = snippet
            # c.timeEnd 'parse html'
            
            #c.profileEnd 'makeHTML all'
            # c.timeEnd('makeHTML all');
            
        , (reason) ->
            s.loading = false
            s.error = true
        
        # $('#koll-text').fadeOut 500, () ->
        
        if s.baseWit not in myWits # reset baseWit?
            s.baseWit = myWits[0]
        # s.showBulk = false # reset showBulk
        
    substr10bulks = (startIndex, html) ->
        start = nthIndexOf(html, '<span class=\'bulk\'', startIndex)
        end = nthIndexOf(html, '<span class=\'bulk\'', startIndex + 50)
        if start == -1
            1
        if end == -1
            1
        
        return html.substr(start, end)
        
    nthIndexOf = (str, subStr, n) ->
        c = 0
        i = -1
        while true
            i = str.indexOf(subStr, i+1)
            if ++c >= n || i == -1
                return i
                
    lastNthIndexOf = (str, subStr, n) ->
        c = 0
        i = str.length
        while true
            i = str.lastIndexOf(subStr, i-1)
            if ++c >= n || i == -1
                return i
    
    s.changeBaseWit = (wit) ->
        if contextVersionsContext
            # keep track of the context offset to adjust window scrollTop after change
            preWitChangeOffset = getViewportOffset contextVersionsContext
            #$('#context-versions-div')
            # interested in top or bottom of context? or middle of context
        
        s.baseWit = wit
        
        if contextVersionsContext
            # adjust scrollTop after base wit change takes place
            $timeout () ->
                # scroll context at same offset as before
                scrollToElem(contextVersionsContext, preWitChangeOffset)
                repositionContextVersionsDiv()
    
    getViewportOffset = (elem) ->
        elem.offset().top - $(window).scrollTop()
    
    scrollToElem = (elem, offset) ->
        $($window).scrollTop elem.offset().top - offset
    
    s.onClickOutsideContextVersionsDiv = (evt) ->
        if s.contextVersions # first click outside
            s.closeContextVersionsDiv()
        else if contextVersionsContext and evt.target != contextVersionsContext[0] # other click outside
            removeContextHighlightStyle(contextVersionsContext[0])
            contextVersionsContext = null
    
    s.closeContextVersionsDiv = () ->
        if s.contextVersions
            $('#context-versions-div').hide()
            s.contextVersions = null
    
    s.showContextVersionsDiv = (contextSpan) ->
        contextVersionsHtml = () ->
            result = ({wit: wit, title: s.witTitles[wit], html: '', url: s.witUrls[wit]} for wit in myWits)
            
            # build version html
            for node in contextSpan[0].childNodes
                $node = $(node)
                if node.nodeType == 3 # text
                    for i in result
                        i.html += node.textContent
                else if node.nodeType == 1 and $node.hasClass 'koll-changed'
                    for i in result
                        i.html += '<span class="koll-changed">' + $node.children('.'+i.wit).html() + '</span>'
            return result
        
        div = $('#context-versions-div')
        contextRect = contextSpan[0].getBoundingClientRect()
        
        contextVersions = contextVersionsHtml()
        
        s.$apply ->
            s.contextVersions = contextVersions
        
        c.log s.contextVersions
        
        repositionContextVersionsDiv (contextRect)
        # div[0].style.display = ""
        # div.show()
        div.fadeIn(200)
    
        # apply highlighting
        if contextVersionsContext
            removeContextHighlightStyle(contextVersionsContext[0])
        applyContextHighlightStyle(contextSpan[0])
        
        contextVersionsContext = contextSpan
    
    ## some browsers recalculate styles for all elems (slow, ~350ms for instance) when changing 
    ## class of context even though the it only changes background-color.
    ## so we do it manually here...
    ## todo: its not very nice; maybe remove 
    applyContextHighlightStyle = (elem) ->
        elem.style.backgroundColor = 'rgba(255, 255, 0, 0.4)'
        # $(elem).addClass('highlight')
    removeContextHighlightStyle = (elem) ->
        elem.style.backgroundColor = ''
        # $(elem).removeClass('highlight')
        
    repositionContextVersionsDiv = (contextRect) ->
        div = $('#context-versions-div')
        if !contextRect
            contextRect = contextVersionsContext[0].getBoundingClientRect()
        
        windowTop = $($window).scrollTop()
        
        kolltextBounds = $('#koll-text')[0].getBoundingClientRect()
        margin = 20;
        # if contextRect.left >= kolltextBounds.left + margin
            # div[0].style.left = contextRect.left + "px"
        # else
        div[0].style.left = kolltextBounds.left + margin + "px"
        # if contextRect.right <= kolltextBounds.right - 30
            # div[0].style.right = $(document).width() - contextRect.right + "px"
        # else 
        div[0].style.right = $(document).width() - kolltextBounds.right + 30 + "px"            
        
        if contextRect.top > $($window).height() - contextRect.bottom
            div[0].style.top = windowTop + contextRect.top - div.outerHeight() + 'px'
        else
            div[0].style.top = windowTop + contextRect.bottom + 'px'
        
    s.highlightVersionsDivChanges = (evt) ->
        i = $(evt.target).index() + 1
        e = $('#context-versions-div').find(".context > :nth-child(#{i})")
        e.toggleClass('highlight')
        
    s.unhighlightVersionsDivChanges = (evt) ->
        $('.koll-changed.highlight').removeClass('highlight')
    
    s.showInText = (evt, doShow=true) ->
        # c.log 'showInText', evt
        showInTextContext = contextVersionsContext
        window = $($window)
        # save selected context offset before it moves
        viewOffset = contextVersionsContext.offset().top - window.scrollTop()
        # c.log contextVersionsContext.offset().top + '-' + window.scrollTop() + '=' + viewOffset
        s.showBulk = doShow
        # s.closeContextVersionsDiv()
        # showInTextContext.addClass 'highlight'
        $timeout () ->
            # scroll to place context at same offset as before
            # c.log contextVersionsContext.offset().top + '-' + viewOffset + '=' + (contextVersionsContext.offset().top - viewOffset)
            window.scrollTop showInTextContext.offset().top - viewOffset
    
    showDiffDiv = (changedSpan) ->
        html = ''
        sorted  = _.sortBy(changedSpan.children(), 'className')
        for witElem in sorted
            for wit in myWits
                if $(witElem).hasClass(wit)
                    html += "<span class='title" + 
                      (if wit == s.baseWit then " base'>" else "'>") +
                      s.witTitles[wit] + "</span>"
            html += "<p>#{ witElem.innerHTML }</p>"
        
        div = $("#diff-div")
        div.html(html)
        # position and show diff-div under the first line of the target span
        position = changedSpan.offset()
        div.css {top: position.top + changedSpan.innerHeight(), left: position.left}
        div.show()
    
    s.saveToFile = () ->
        # order wits but with base wit first
        orderedWits = [s.baseWit]
        for wit in myWits
            if wit != s.baseWit
                orderedWits.push wit
        # prepare html table
        data = '''
            <head>
            <meta charset="utf-8"/>
            <style>
            .marker { font-weight: bold; color: #69698B }
            .page { font-weight: bold; color: #69698B }
            body { padding: 10px; font-size: 17px; font-family: sans-serif; } 
            h1 { font-size: 1.5em; } 
            h2 { font-size: 1.25em; }
            h3 { font-size: 1em; margin: 1em 0em 0em 1em}
            h3 + p { margin-left: 1.5em; }
            .wit { color: #8C1717; }
            a.wit { vertical-align: super; font-size: small; }
            </style>
            </head>
            <body>
            '''
        data += """
            <h1>Kollation av #{s.work.title}</h1>
            <h2 id="om">Om textjämförelsen</h2>
            <p>Kollationen är gjord med eXist-db-appen text-collation som använt
            CollateX för kollationeringssteget.</p>
            <p>Jämförelsen gjordes #{new Date()}</p>
            <h2 id="biblio">Bibliografi</h2>
            """
        # backend.getSourceInfo(s.author, s.worksToCompare[0].path).then (result) ->
            # result.authorFullname
            # result.title
            # result.showTitle
            # result.imported
        # add the ordered wit titles as column headers
        for wit, i in orderedWits
            title = s.witTitles[wit]
            data += '<h3 id="' + ('w'+i) + '">' +
                title + 
                ' <span class=\"wit\">(' + 
                ( if i == 0 then 'Grundutgåva' else ('w'+i) ) +
                ')</a>' +
                '</h3>\n' +
                '<p>' +
                'Författare: ' + s.authorInfo.fullName
                + '</p>'
        data += "<h2 id=\"app\">Textkritisk apparat</h2>\n"
        # add all the rows
        rdgs = {}
        for e in $('.koll-changed, .koll-pb')
            if $(e).hasClass('koll-pb') # for keeping track of what page we are on
                # page = $(change).prev('.koll-pb-pb').text()
                if $(e).hasClass(s.baseWit)
                    page = $(e).text()
            else # koll-changed 
                # add a row for the wit
                for rdg in $(e).children()
                    text = $(rdg).text()
                    for wit in myWits
                        if $(rdg).hasClass(wit)
                            rdgs[wit] = text
                data += '<div class="app">'
                data += "<span class=\"page\">s #{page}</span> "
                for wit, i in orderedWits
                    data += rdgs[wit]
                    if i != 0
                        wstr = 'w' + i
                        data += " <a class=\"wit\" href=\"##{wstr}\">#{wstr}</a>"
                    if i + 1 != orderedWits.length
                        data += '<span class="marker"> | </span>'
                # data += (rdgs[wit] for wit in orderedWits).join('<span class="marker"> |</span>')
                data += "</div>\n"
        data += "</div>\n"
        # save to file
        blob = new Blob([data], {type: "text/plain;charset=utf-8"})
        saveAs blob, 'Kollation - ' + s.work.title + '.html'

    ## setup jquery event handlers for displaying differences in the text, etc.
    $("#koll-text")
        .on("click", ".koll-context", (evt) ->
            target = evt.currentTarget
            if contextVersionsContext == null or contextVersionsContext[0] != target or s.contextVersions == null
                s.showContextVersionsDiv($(target))
                evt.stopPropagation() # keep ContextVersionsDiv from immediately hiding again
        )
        .on("mouseover", ".koll-changed", -> showDiffDiv $(this))
        .on("mouseout", ".koll-changed", -> $("#diff-div").hide())
        # .on 'mouseover', '.koll-context-pb', -> # show tooltip. how?
    # for highlighting differences in #context-versions-div
    $('#context-versions-div')
        .on( "mouseover", '.koll-changed', s.highlightVersionsDivChanges )
        .on( "mouseout", '.koll-changed', s.unhighlightVersionsDivChanges )

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

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById
        s.authorError = s.author not of s.authorsById

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
        url = "/#!/forfattare/#{work.workauthor or s.author}/titlar/#{work.titlepath.split('/')[0]}/"
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
    
    
    
littb.controller "titleListCtrl", ($scope, backend, util, $timeout, $location, authors) ->
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
        url = "/#!/forfattare/#{row.author.workauthor or row.author.authorid}/titlar/#{s.getTitleId(row)}/"
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
            replace : false
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
            replace : false
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

littb.controller "omtexternaCtrl", ($scope, $routeParams) ->
    docPath = '/red/sla/omtexterna/'
    $scope.doc = docPath + ($routeParams['doc'] or 'omtexterna.html')
    
    # $scope.$on '$includeContentLoaded', (e) ->
    #     docTitle = $('#omtexterna-doc title').text()
        # $scope.setTitle docTitle
        # c.log $scope
        # $scope.appendCrumb
        #     label: docTitle
        #     url: window.location.hash
        # c.log $scope.breadcrumb
    
    # $http.get(url).success (data) ->
        # s.doc = data
        # s.currentLetters = for elem in $("[id]", data)
            # $(elem).attr("id")
        # util.setupHash s, {"ankare" : (val) ->
            # unless val
                # $(window).scrollTop(0)
                # return
            # $(window).scrollTop($("##{val}").offset().top)
        # }

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





littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document, $window, $rootElement, authors) ->
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

    h = $(window).height()
    w = $(window).width()

    s.fontSizeFactor = h / 900
    $rootScope._night_mode = false
    s.isFocus = false
    s.showFocusBar = true

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



    s.onPartClick = (startpage) ->
        s.gotopage(startpage)
        s.showPopup = false

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
            key : "fokus"
            scope_name : "isFocus"
            post_change : (val) ->
                $rootScope._focus_mode = val


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


        if s.faksimilPageMapping
            setPages {length : 1}

            filename = s.faksimilPageMapping[s.pageix]
            id = s.workinfo.lbworkid
            s.url = "/txt/#{id}/#{id}_#{s.size}/#{id}_#{s.size}_#{filename}"
            unless s.isEditor
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)
            return
            
        s.loading = true

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
                backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype)

            s.loading = false
            $rootScope.breadcrumb = []
            s.appendCrumb [
                label : "författare"
                url : "/#!/forfattare"
            ,
                label : (_.str.humanize author).split(" ")[0]
                url : "/#!/forfattare/" + author
            ,
                label : "titlar"
                url : "/#!/forfattare/#{author}/titlar"
            ,   
                label : (_.str.humanize workinfo.titlepath) + " sidan #{s.pagename} " + (s.mediatype or "")
                url : "/#!/forfattare/#{author}/titlar/#{title}/info"
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

## ORD OCH SAK
    backend.ordOchSak(author, title).then (ordOchSak) ->
        s.ordOchSakAll = ordOchSak
        s.$watch "pagename", updateOrdOchSak
        updateOrdOchSak()
    , (error) ->
        c.log 'failed to get ord och sak', error
    
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

