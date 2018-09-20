// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
littb.controller("textjamforelseCtrl", function(
    $scope,
    $animate,
    $rootScope,
    $location,
    $modal,
    backend,
    $window,
    $timeout
) {
    const s = $scope
    s.loading = false
    s.error = false
    s.work = null
    s.works = null
    s.worksToCompare = []
    s.showBulk = false
    s.witTitles = []
    s.contextVersions = null
    let myWits = []
    let contextVersionsContext = null
    let showInTextContext = null

    s.works = [
        {
            title: "Gösta Berlings saga 1",
            workgroup: "GBS1",
            works: [
                {
                    title: "Gösta Berlings saga 1 (1891)",
                    id: "lb1492249",
                    path: "GostaBerling1"
                },
                {
                    title: "Gösta Berlings saga 1 (1895)",
                    id: "lb3312560",
                    path: "GostaBerlingsSagaForraDelen1895"
                },
                {
                    title: "Gösta Berlings saga (1910)",
                    id: "lb3312973",
                    path: "GostaBerlingsSaga1910"
                },
                {
                    title: "Gösta Berlings saga (1933)",
                    id: "lb491569",
                    path: "GostaBerlingsSaga1933"
                }
            ]
        },
        {
            title: "Gösta Berlings saga 2",
            workgroup: "GBS2",
            works: [
                {
                    title: "Gösta Berlings saga 2 (1891)",
                    id: "lb1492250",
                    path: "GostaBerling2"
                },
                {
                    title: "Gösta Berlings saga 2 (1895)",
                    id: "lb3312561",
                    path: "GostaBerlingsSagaSenareDelen1895"
                },
                {
                    title: "Gösta Berlings saga (1910)",
                    id: "lb3312973",
                    path: "GostaBerlingsSaga1910"
                },
                {
                    title: "Gösta Berlings saga (1933)",
                    id: "lb491569",
                    path: "GostaBerlingsSaga1933"
                }
            ]
        },
        {
            title: "Osynliga Länkar",
            workgroup: "OL",
            works: [
                {
                    title: "Osynliga länkar (1894)",
                    id: "lb31869",
                    path: "OsynligaLankar"
                },
                {
                    title: "Osynliga länkar (1904)",
                    id: "lb2169911",
                    path: "OsynligaLankar1904"
                },
                {
                    title: "Osynliga länkar (1909)",
                    id: "lb1615111",
                    path: "OsynligaLankar1909"
                },
                {
                    title: "Osynliga länkar (1933)",
                    id: "lb8233075",
                    path: "OsynligaLankar1933"
                }
            ]
        }
    ]

    // $animate.enabled(false)

    const makeHTMLold = function(data, myWits) {
        const cleanAppsNew = function(data, myWits) {
            // build wit filter and split cache
            let c1, c2, c3, c4, c5, c6
            const filterCache = {}
            const splitCache = {}
            var makeCache = function(k0, v0, i0, stop) {
                let i = i0
                while (i <= stop) {
                    const wit = `w${i}`
                    const k = k0.concat(wit)
                    const v = Array.from(myWits).includes(wit) ? v0.concat(wit) : v0
                    const kstr = Array.from(k)
                        .map(w => `#${w}`)
                        .join(" ")
                    filterCache[kstr] = v.join(" ")
                    splitCache[k.join(" ")] = k
                    makeCache(k, v, i + 1, stop)
                    i++
                }
            }
            makeCache([], [], 1, s.work.works.length)

            const appPat = /^\s*<app>/
            const endAppPat = /^\s*<\/app>/
            const rdgPat = /^\s*<rdg wit="(.*?)"(?: rend="(.*?)")?(?:>(.*?)<\/rdg>)?/
            const anchorPat = /^\s*<anchor type="(.*?)" ref="(.*?)"\/>/
            const pbPat = /^\s*<pb n="(.*?)" ref="(.*?)"\/>/
            const wPat = /^[\wåäöÅÄÖ]/

            let app = null
            const apps = []
            const pages = []
            const appPages = []
            const anchors = []
            let prevApp = []
            const myWitsStr = myWits.join(" ")
            const myWitsLen = myWits.length
            let skipToAppEnd = false
            let c0 = (c1 = c2 = c3 = c4 = c5 = c6 = 0)

            const mergeApps = function(app1, app2) {
                let rdg1, rdg2
                let app1len = app1.length
                const app2len = app2.length
                if (app1len === 1 && 1 === app2len) {
                    // both not diff. can merge
                    c0++
                    app1[0].text += app2[0].text
                } else if (
                    app2len > 1 &&
                    app2len === app1len &&
                    (app2len === 2 ||
                        (function() {
                            for (let rdg1 of Array.from(app1)) {
                                let appHasWit = false
                                for (let rdg2 of Array.from(app2)) {
                                    if (rdg1.wit === rdg2.wit) {
                                        appHasWit = true
                                        break
                                    }
                                }
                                if (!appHasWit) {
                                    return false
                                }
                            }
                            return true
                        })())
                ) {
                    c5++
                    for (rdg1 of Array.from(app1)) {
                        for (rdg2 of Array.from(app2)) {
                            if (rdg1.wit === rdg2.wit) {
                                rdg1.text += rdg2.text
                                break
                            }
                        }
                    }
                } else if (app2len > 1 && app1len > 1) {
                    // both are diff. can merge
                    c1++
                    const merged = []
                    for (rdg1 of Array.from(app1)) {
                        const rdg1text = rdg1.text
                        var wit1 = rdg1.wit
                        if ((rdg2 = _.find(app2, rdg => rdg.wit === wit1)) !== undefined) {
                            c2++
                            // the simple merge
                            merged.push({ wit: wit1, text: rdg1text + rdg2.text })
                        } else {
                            c3++
                            let w1split = splitCache[wit1]
                            for (rdg2 of Array.from(app2)) {
                                // maybe can check for equality before split?, if w1split.length == 1 ...
                                const w2split = splitCache[rdg2.wit]
                                // partition rdg1 and rdg2 wits into common and uncommon wits
                                const commonWits = []
                                const uncommonWits = []
                                for (let w of Array.from(w1split)) {
                                    if (Array.from(w2split).includes(w)) {
                                        commonWits.push(w)
                                    } else {
                                        uncommonWits.push(w)
                                    }
                                }

                                w1split = uncommonWits // keep uncommon for next iteration

                                if (commonWits.length !== 0) {
                                    merged.push({
                                        wit: commonWits.join(" "),
                                        text: rdg1text + rdg2.text
                                    })
                                }

                                if (w1split.length === 0) {
                                    break // found all wits of w1
                                }
                            }

                            if (w1split.length > 0) {
                                c.log(app1, merged, app2)
                                throw Error("w1split.length != 0")
                            }
                        }
                    }

                    // replace app1's rdgs with the new merged apps
                    for (let i = 0; i < merged.length; i++) {
                        const rdg = merged[i]
                        app1[i] = rdg
                    }
                    app1len = merged.length
                } else {
                    // can not merge
                    return false
                }
                return true
            }

            let lastIndex = 0
            let index = -1
            const dataLen = data.length
            while (lastIndex < dataLen) {
                index = data.indexOf("\n", lastIndex)
                if (index === -1) {
                    index = dataLen
                }
                const line = data.substr(lastIndex, index - lastIndex)
                lastIndex = index + 1

                if (app === null) {
                    if (appPat.test(line)) {
                        //line.indexOf('<app>') != -1
                        app = []
                    }
                } else {
                    var n, page, result, text, wit, wits
                    if (!skipToAppEnd && (result = rdgPat.exec(line))) {
                        // rdg
                        wits = result[1]
                        if ((wits = filterCache[wits]) !== "") {
                            const rend = result[2]
                            text = result[3]
                            // if this reading contains all our choosen wits (should be most of the time)
                            // then we're done with his app
                            if (wits === myWitsStr) {
                                c6++
                                skipToAppEnd = true
                                if (text === undefined) {
                                    // check for empty reading
                                    //app = null # skip this app completely
                                    continue // dont add reading
                                }
                            }

                            if (text === undefined) {
                                text = ""
                            } else if (wPat.test(text)) {
                                if (rend !== undefined) {
                                    if (rend === "italic") {
                                        text = `<i>${text}</i>`
                                    } else if (rend === "bold") {
                                        text = `<b>${text}</b>`
                                    } else {
                                        c.error("unknown rend=", rend)
                                    }
                                }
                                text = ` ${text}`
                            }

                            // add reading to app
                            app.push({ wit: wits, text: text })
                        }
                    } else if (endAppPat.test(line)) {
                        //line.indexOf('</app>') != -1
                        skipToAppEnd = false
                        // first join any anchors (paragraphs)
                        let dontMerge = false
                        if (anchors.length !== 0) {
                            wits = anchors.join(" ")
                            let anchorApp = []
                            anchorApp.wit = wits
                            anchorApp.text = `<p class="koll-p wit ${wits}"></p>`
                            anchorApp.anchor = "p"
                            apps.push(anchorApp)
                            anchorApp = null
                            dontMerge = true
                            anchors.length = 0
                        }

                        if (appPages.length !== 0) {
                            for (page of Array.from(appPages)) {
                                apps.push(page)
                            }
                            appPages.length = 0
                            dontMerge = true
                        }

                        // try to merge with previous app
                        if (app.length !== 0 && (dontMerge || !mergeApps(prevApp, app))) {
                            // didnt merge, push new app
                            c4++

                            if (app.length > 1) {
                                // attach pagename to diff
                                app.pages = []
                                for (wit in pages) {
                                    n = pages[wit]
                                    let hasPage = false
                                    for (page of Array.from(app.pages)) {
                                        if (n === page.n) {
                                            page.wit += ` ${wit}`
                                            hasPage = true
                                            break
                                        }
                                    }
                                    if (!hasPage) {
                                        app.pages.push({ wit: wit, n: n })
                                    }
                                }
                            }

                            apps.push(app)
                            prevApp = app
                        }

                        app = null
                    } else if ((result = anchorPat.exec(line)) !== null) {
                        // type = result[1]
                        wits = result[2]
                        if ((wits = filterCache[wits]) !== "") {
                            for (wit of Array.from(splitCache[wits])) {
                                anchors.push(wit)
                            }
                        }
                    } else if ((result = pbPat.exec(line)) !== null) {
                        n = result[1]
                        wits = result[2]
                        if ((wits = filterCache[wits]) !== "") {
                            appPages.push({
                                page: true,
                                wit: wits,
                                n
                            })
                        }
                    }
                }
            }

            c.log("c0", c0, "c1", c1, "c2", c2, "c3", c3, "c4", c4, "c5", c5, "c6", c6)
            return apps
        }

        const makeHtmlFromApps = function(apps) {
            // make html
            let wit
            let html = ""

            const myWitsStr = myWits.join(" ")

            // how many words to show before and after in context
            const nWords = 3

            let hasContext = false

            const appsLen = apps.length

            let oddContext = false

            let doAddPageToContext = false

            const startContext = function() {
                oddContext = !oddContext
                if (oddContext) {
                    html += "<span class='koll-context odd'>"
                } else {
                    html += "<span class='koll-context'>"
                }
                hasContext = true
                return (doAddPageToContext = true)
            }

            const endContext = function() {
                html += "</span>"
                return (hasContext = false)
            }

            const pages = (() => {
                const result = []
                for (wit of Array.from(myWits)) {
                    result.push({ wit, n: null, usedInContext: true })
                }
                return result
            })()

            for (let appIndex = 0; appIndex < apps.length; appIndex++) {
                var page
                const app = apps[appIndex]
                if (app.anchor === "p") {
                    if (app.wit === myWitsStr) {
                        if (hasContext) {
                            endContext()
                        }
                    }
                    html += app.text
                } else if (app.page) {
                    // html += app[0].text
                    html += `<span class="koll-pb wit ${app.wit}">${app.n}</span>`
                    for (page of Array.from(pages)) {
                        if (app.wit === page.wit) {
                            page.n = app.n
                            page.usedInContext = false
                            break
                        }
                    }
                } else if (app.length > 1) {
                    // diff
                    if (!hasContext) {
                        startContext()
                    }

                    // context-pb is for showing page numbers in hide-bulk view
                    // pb is for showing page numbers in show-bulk view
                    if (doAddPageToContext) {
                        // only add one context-pb per context
                        doAddPageToContext = false
                        for (page of Array.from(pages)) {
                            if (!page.usedInContext) {
                                html += `<span class="koll-context-pb wit ${page.wit}">${
                                    page.n
                                }</span>`
                                page.usedInContext = true
                            }
                        }
                    }
                    html += "<span class='koll-changed'>"
                    for (let rdg of Array.from(app)) {
                        html += `<span class='wit ${rdg.wit}'>`
                        html += rdg.text || "&nbsp;"
                        html += "</span>"
                    }
                    html += "</span>" // .koll-changed
                } else {
                    // no diff
                    var bulk, bulkEndIndex, bulkStartIndex, post
                    const { text } = app[0]

                    const prevIsDiff = hasContext
                    let pre = (bulk = post = null)

                    const nextIsDiff = appIndex + 1 !== appsLen && apps[appIndex + 1].length > 1

                    if (!prevIsDiff && !nextIsDiff) {
                        // all is bulk
                        bulk = text
                    } else if (prevIsDiff && nextIsDiff) {
                        // create pre + bulk + post
                        if (
                            (bulkStartIndex = nthIndexOf(text, " ", nWords + 1)) !== -1 &&
                            (bulkEndIndex = lastNthIndexOf(text, " ", nWords)) > bulkStartIndex
                        ) {
                            pre = text.substr(0, bulkStartIndex)
                            bulk = text.substr(bulkStartIndex, bulkEndIndex - bulkStartIndex)
                            post = text.substr(bulkEndIndex)
                        } else {
                            // text has too few words to put in bulk. add to context
                            html += text
                        }
                    } else if (prevIsDiff) {
                        //and !nextIsDiff
                        // create pre + (bulk)
                        bulkStartIndex = nthIndexOf(text, " ", nWords + 1)
                        if (bulkStartIndex !== -1) {
                            pre = text.substr(0, bulkStartIndex)
                            bulk = text.substr(bulkStartIndex)
                        } else {
                            pre = text
                        }
                    } else {
                        // !prevIsDiff and nextIsDiff
                        // create (bulk) + post
                        bulkEndIndex = lastNthIndexOf(text, " ", nWords)
                        if (bulkEndIndex > 0) {
                            // if has bulk
                            bulk = text.substr(0, bulkEndIndex)
                            post = text.substr(bulkEndIndex)
                        } else {
                            // all post
                            post = text
                        }
                    }

                    if (pre !== null) {
                        html += pre
                        endContext()
                    }
                    if (bulk !== null) {
                        html += `<span class='bulk'>${bulk}</span>`
                    }
                    if (post !== null) {
                        startContext()
                        html += post
                    }
                }
            }

            if (hasContext) {
                endContext()
            }

            return html
        }

        //c.time 'cleanApps'
        // c.profile 'cleanApps'
        const apps = cleanAppsNew(data, myWits)
        // c.profileEnd 'cleanApps'
        // c.timeEnd 'cleanApps'

        // c.time 'make html'
        const html = makeHtmlFromApps(apps)
        // c.timeEnd 'make html'

        return html
    }

    s.submit = function() {
        c.log("submit textjamforelse")
        c.log("title", s.work.title)
        c.log("workgroup", s.work.workgroup)
        c.log("utgåvor:")
        c.log(
            Array.from(s.worksToCompare)
                .map(w => w.title + ", id:" + w.id)
                .join("\n")
        )

        const { workgroup } = s.work
        const ids = []
        s.witTitles = {}
        s.witUrls = {}
        myWits = []
        for (let i = 0; i < s.work.works.length; i++) {
            const work = s.work.works[i]
            if (Array.from(s.worksToCompare).includes(work)) {
                const wit = `w${i + 1}`
                myWits.push(wit)
                ids.push(work.id)
                s.witTitles[wit] = work.title
                s.witUrls[wit] = `/forfattare/LagerlofS/titlar/${work.path}/info/`
            }
        }

        s.haveText = false
        $("#koll-text").html("") // do this while getDiff is loading
        s.loading = true
        s.error = false

        backend.getDiff(workgroup, myWits, ...Array.from(ids)).then(
            function(data) {
                // c.time 'makeHTML all'
                //c.profile 'makeHTML all'

                const html = makeHTMLold(data, myWits)
                s.loading = false
                s.haveText = true

                // c.time 'parse html'
                return $("#koll-text").html(html)
            },
            // snippet = substr10bulks(0, html)
            // $('#koll-text')[0].innerHTML = snippet
            // c.timeEnd 'parse html'

            //c.profileEnd 'makeHTML all'
            // c.timeEnd('makeHTML all');

            function(reason) {
                s.loading = false
                return (s.error = true)
            }
        )

        // $('#koll-text').fadeOut 500, () ->

        if (!Array.from(myWits).includes(s.baseWit)) {
            // reset baseWit?
            return (s.baseWit = myWits[0])
        }
    }
    // s.showBulk = false # reset showBulk

    const substr10bulks = function(startIndex, html) {
        const start = nthIndexOf(html, "<span class='bulk'", startIndex)
        const end = nthIndexOf(html, "<span class='bulk'", startIndex + 50)
        if (start === -1) {
            1
        }
        if (end === -1) {
            1
        }

        return html.substr(start, end)
    }

    var nthIndexOf = function(str, subStr, n) {
        let c = 0
        let i = -1
        while (true) {
            i = str.indexOf(subStr, i + 1)
            if (++c >= n || i === -1) {
                return i
            }
        }
    }

    var lastNthIndexOf = function(str, subStr, n) {
        let c = 0
        let i = str.length
        while (true) {
            i = str.lastIndexOf(subStr, i - 1)
            if (++c >= n || i === -1) {
                return i
            }
        }
    }

    s.changeBaseWit = function(wit) {
        let preWitChangeOffset
        if (contextVersionsContext) {
            // keep track of the context offset to adjust window scrollTop after change
            preWitChangeOffset = getViewportOffset(contextVersionsContext)
        }
        //$('#context-versions-div')
        // interested in top or bottom of context? or middle of context

        s.baseWit = wit

        if (contextVersionsContext) {
            // adjust scrollTop after base wit change takes place
            return $timeout(function() {
                // scroll context at same offset as before
                scrollToElem(contextVersionsContext, preWitChangeOffset)
                return repositionContextVersionsDiv()
            })
        }
    }

    var getViewportOffset = elem => elem.offset().top - $(window).scrollTop()

    var scrollToElem = (elem, offset) => $($window).scrollTop(elem.offset().top - offset)

    s.onClickOutsideContextVersionsDiv = function(evt) {
        if (s.contextVersions) {
            // first click outside
            return s.closeContextVersionsDiv()
        } else if (contextVersionsContext && evt.target !== contextVersionsContext[0]) {
            // other click outside
            removeContextHighlightStyle(contextVersionsContext[0])
            return (contextVersionsContext = null)
        }
    }

    s.closeContextVersionsDiv = function() {
        if (s.contextVersions) {
            $("#context-versions-div").hide()
            return (s.contextVersions = null)
        }
    }

    s.showContextVersionsDiv = function(contextSpan) {
        const contextVersionsHtml = function() {
            let wit
            const result = (() => {
                const result1 = []
                for (wit of Array.from(myWits)) {
                    result1.push({ wit, title: s.witTitles[wit], html: "", url: s.witUrls[wit] })
                }
                return result1
            })()

            // build version html
            for (let node of Array.from(contextSpan[0].childNodes)) {
                var i
                const $node = $(node)
                if (node.nodeType === 3) {
                    // text
                    for (i of Array.from(result)) {
                        i.html += node.textContent
                    }
                } else if (node.nodeType === 1 && $node.hasClass("koll-changed")) {
                    for (i of Array.from(result)) {
                        i.html += `<span class="koll-changed">${$node
                            .children(`.${i.wit}`)
                            .html()}</span>`
                    }
                }
            }
            return result
        }

        const div = $("#context-versions-div")
        const contextRect = contextSpan[0].getBoundingClientRect()

        const contextVersions = contextVersionsHtml()

        s.$apply(() => (s.contextVersions = contextVersions))

        c.log(s.contextVersions)

        repositionContextVersionsDiv(contextRect)
        // div[0].style.display = ""
        // div.show()
        div.fadeIn(200)

        // apply highlighting
        if (contextVersionsContext) {
            removeContextHighlightStyle(contextVersionsContext[0])
        }
        applyContextHighlightStyle(contextSpan[0])

        return (contextVersionsContext = contextSpan)
    }

    //# some browsers recalculate styles for all elems (slow, ~350ms for instance) when changing
    //# class of context even though the it only changes background-color.
    //# so we do it manually here...
    //# todo: its not very nice; maybe remove
    var applyContextHighlightStyle = elem => (elem.style.backgroundColor = "rgba(255, 255, 0, 0.4)")
    // $(elem).addClass('highlight')
    var removeContextHighlightStyle = elem => (elem.style.backgroundColor = "")
    // $(elem).removeClass('highlight')

    var repositionContextVersionsDiv = function(contextRect) {
        const div = $("#context-versions-div")
        if (!contextRect) {
            contextRect = contextVersionsContext[0].getBoundingClientRect()
        }

        const windowTop = $($window).scrollTop()

        const kolltextBounds = $("#koll-text")[0].getBoundingClientRect()
        const margin = 20
        // if contextRect.left >= kolltextBounds.left + margin
        // div[0].style.left = contextRect.left + "px"
        // else
        div[0].style.left = kolltextBounds.left + margin + "px"
        // if contextRect.right <= kolltextBounds.right - 30
        // div[0].style.right = $(document).width() - contextRect.right + "px"
        // else
        div[0].style.right = $(document).width() - kolltextBounds.right + 30 + "px"

        if (contextRect.top > $($window).height() - contextRect.bottom) {
            return (div[0].style.top = windowTop + contextRect.top - div.outerHeight() + "px")
        } else {
            return (div[0].style.top = windowTop + contextRect.bottom + "px")
        }
    }

    s.highlightVersionsDivChanges = function(evt) {
        const i = $(evt.target).index() + 1
        const e = $("#context-versions-div").find(`.context > :nth-child(${i})`)
        return e.toggleClass("highlight")
    }

    s.unhighlightVersionsDivChanges = evt => $(".koll-changed.highlight").removeClass("highlight")

    s.showInText = function(evt, doShow) {
        // c.log 'showInText', evt
        if (doShow == null) {
            doShow = true
        }
        showInTextContext = contextVersionsContext
        const window = $($window)
        // save selected context offset before it moves
        const viewOffset = contextVersionsContext.offset().top - window.scrollTop()
        // c.log contextVersionsContext.offset().top + '-' + window.scrollTop() + '=' + viewOffset
        s.showBulk = doShow
        // s.closeContextVersionsDiv()
        // showInTextContext.addClass 'highlight'
        return $timeout(() =>
            // scroll to place context at same offset as before
            // c.log contextVersionsContext.offset().top + '-' + viewOffset + '=' + (contextVersionsContext.offset().top - viewOffset)
            window.scrollTop(showInTextContext.offset().top - viewOffset)
        )
    }

    const showDiffDiv = function(changedSpan) {
        let html = ""
        const sorted = _.sortBy(changedSpan.children(), "className")
        for (let witElem of Array.from(sorted)) {
            for (let wit of Array.from(myWits)) {
                if ($(witElem).hasClass(wit)) {
                    html +=
                        "<span class='title" +
                        (wit === s.baseWit ? " base'>" : "'>") +
                        s.witTitles[wit] +
                        "</span>"
                }
            }
            html += `<p>${witElem.innerHTML}</p>`
        }

        const div = $("#diff-div")
        div.html(html)
        // position and show diff-div under the first line of the target span
        const position = changedSpan.offset()
        div.css({ top: position.top + changedSpan.innerHeight(), left: position.left })
        return div.show()
    }

    s.saveToFile = function() {
        // order wits but with base wit first
        let i, title
        const orderedWits = [s.baseWit]
        for (var wit of Array.from(myWits)) {
            if (wit !== s.baseWit) {
                orderedWits.push(wit)
            }
        }
        // prepare html table
        let data = `\
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
<body>\
`
        data += `\
<h1>Kollation av ${s.work.title}</h1>
<h2 id="om">Om textjämförelsen</h2>
<p>Kollationen är gjord med eXist-db-appen text-collation som använt
CollateX för kollationeringssteget.</p>
<p>Jämförelsen gjordes ${new Date()}</p>
<h2 id="biblio">Bibliografi</h2>\
`
        // backend.getSourceInfo(s.author, s.worksToCompare[0].path).then (result) ->
        // result.authorFullname
        // result.title
        // result.showTitle
        // result.imported
        // add the ordered wit titles as column headers
        for (i = 0; i < orderedWits.length; i++) {
            wit = orderedWits[i]
            title = s.witTitles[wit]
            data +=
                `<h3 id='w${i}'>` +
                title +
                ' <span class="wit">(' +
                (i === 0 ? "Grundutgåva" : `w${i}`) +
                ")</a>" +
                "</h3>\n" +
                "<p>" +
                "Författare: " +
                s.authorInfo.fullName
            ;+"</p>"
        }
        data += '<h2 id="app">Textkritisk apparat</h2>\n'
        // add all the rows
        const rdgs = {}
        for (let e of Array.from($(".koll-changed, .koll-pb"))) {
            var page
            if ($(e).hasClass("koll-pb")) {
                // for keeping track of what page we are on
                // page = $(change).prev('.koll-pb-pb').text()
                if ($(e).hasClass(s.baseWit)) {
                    page = $(e).text()
                }
            } else {
                // koll-changed
                // add a row for the wit
                for (let rdg of Array.from($(e).children())) {
                    const text = $(rdg).text()
                    for (wit of Array.from(myWits)) {
                        if ($(rdg).hasClass(wit)) {
                            rdgs[wit] = text
                        }
                    }
                }
                data += '<div class="app">'
                data += `<span class=\"page\">s ${page}</span> `
                for (i = 0; i < orderedWits.length; i++) {
                    wit = orderedWits[i]
                    data += rdgs[wit]
                    if (i !== 0) {
                        const wstr = `w${i}`
                        data += ` <a class=\"wit\" href=\"#${wstr}\">${wstr}</a>`
                    }
                    if (i + 1 !== orderedWits.length) {
                        data += '<span class="marker"> | </span>'
                    }
                }
                // data += (rdgs[wit] for wit in orderedWits).join('<span class="marker"> |</span>')
                data += "</div>\n"
            }
        }
        data += "</div>\n"
        // save to file
        const blob = new Blob([data], { type: "text/plain;charset=utf-8" })
        return saveAs(blob, `Kollation - ${s.work.title}.html`)
    }

    //# setup jquery event handlers for displaying differences in the text, etc.
    $("#koll-text")
        .on("click", ".koll-context", function(evt) {
            const target = evt.currentTarget
            if (
                contextVersionsContext === null ||
                contextVersionsContext[0] !== target ||
                s.contextVersions === null
            ) {
                s.showContextVersionsDiv($(target))
                return evt.stopPropagation()
            } // keep ContextVersionsDiv from immediately hiding again
        })
        .on("mouseover", ".koll-changed", function() {
            return showDiffDiv($(this))
        })
        .on("mouseout", ".koll-changed", () => $("#diff-div").hide())
    // .on 'mouseover', '.koll-context-pb', -> # show tooltip. how?
    // for highlighting differences in #context-versions-div
    return $("#context-versions-div")
        .on("mouseover", ".koll-changed", s.highlightVersionsDivChanges)
        .on("mouseout", ".koll-changed", s.unhighlightVersionsDivChanges)
})
