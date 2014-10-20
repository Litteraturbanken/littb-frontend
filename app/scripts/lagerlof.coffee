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
    

    s.works = [
        title: "Gösta Berlings saga 1"
        workgroup: "GBS1"
        works: [
            title: "Gösta Berlings saga 1 (1891)"
            id: "lb1492249"
            path: "GostaBerling1"
        ,
            title: "Gösta Berlings saga 1 (1895)"
            id: "lb3312560"
            path: "GostaBerlingsSagaForraDelen1895"
        ,
            title: "Gösta Berlings saga (1910)"
            id: "lb3312973"
            path: "GostaBerlingsSaga1910"
        ,
            title: "Gösta Berlings saga (1933)"
            id: "lb491569"
            path: "GostaBerlingsSaga1933"
        ]
    ,
        title: "Gösta Berlings saga 2"
        workgroup: "GBS2"
        works: [
            title:"Gösta Berlings saga 2 (1891)"
            id: "lb1492250"
            path: "GostaBerling2"
        ,
            title:"Gösta Berlings saga 2 (1895)"
            id: "lb3312561"
            path: "GostaBerlingsSagaSenareDelen1895"
        ,
            title: "Gösta Berlings saga (1910)"
            id: "lb3312973"
            path: "GostaBerlingsSaga1910"
        ,
            title: "Gösta Berlings saga (1933)"
            id: "lb491569"
            path: "GostaBerlingsSaga1933"
        ]
    ,
        title: "Osynliga Länkar"
        workgroup: "OL"
        works: [
            title:"Osynliga länkar (1894)"
            id: "lb31869"
            path: "OsynligaLankar"
        ,
            title:"Osynliga länkar (1904)"
            id: "lb2169911"
            path: "OsynligaLankar1904"
        ,
            title: "Osynliga länkar (1909)"
            id: "lb1615111"
            path: "OsynligaLankar1909"
        ,
            title: "Osynliga länkar (1933)"
            id: "lb8233075"
            path: "OsynligaLankar1933"
        ]
    ]
    
    # $animate.enabled(false)
    
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

