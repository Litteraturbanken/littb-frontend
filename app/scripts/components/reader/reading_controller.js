// littb.controller(
//     "readingCtrl",
export default [
    "$scope",
    "backend",
    "$routeParams",
    "$route",
    "$location",
    "util",
    "SearchWorkData",
    "debounce",
    "$timeout",
    "$rootScope",
    "$document",
    "$window",
    "$rootElement",
    "authors",
    "$uibModal",
    "$q",
    "$filter",
    function (
        $scope,
        backend,
        $routeParams,
        $route,
        $location,
        util,
        SearchWorkData,
        debounce,
        $timeout,
        $rootScope,
        $document,
        $window,
        $rootElement,
        authors,
        $uibModal,
        $q,
        $filter
    ) {
        let args, key, searchData, val
        const s = $scope
        s.$routeParams = $routeParams
        s.isEditor = false
        s._ = { humanize: _.humanize }

        $window.scrollTo(0, 0)

        let applyRouteParams = params => {
            _.extend(s, _.pick($routeParams, "title", "author", "mediatype"))

            if ("ix" in $routeParams) {
                s.isEditor = true
                s.pageix = Number($routeParams.ix)
                s.pageToLoad = s.pageix
                s.editorLbWorkId = $routeParams.lbid
                s.mediatype = { f: "faksimil", e: "etext" }[s.mediatype]
            } else {
                s.pagename = $routeParams.pagename
            }
        }
        applyRouteParams($routeParams)
        s.suggestEtext = () => window.location.href.replace("/epub", "/etext")

        // s.pageToLoad = pagename

        s.searchData = searchData = null
        s.loading = true
        s.first_load = false
        const onFirstLoad = _.once(() =>
            $timeout(() => $("html, body").animate({ scrollLeft: "1000px" }, 1000), 0)
        )
        s.showPopup = false
        s.error = false
        s.show_chapters = false // index modal

        s.normalizeAuthor = $filter("normalizeAuthor")

        const h = $(window).height()
        let w = $(window).width()

        s.fontSizeFactor = h / 900
        $rootScope._night_mode = false
        s.isFocus = false
        s.showFocusBar = true
        s.isOcr = () => $location.search().ocr != null

        s.activateFocus = function () {
            s.isFocus = true
            s.showFocusBar = true
        }

        s.hasSearchable = function (authorid) {
            if (!authorid || !s.authorById) {
                return
            }
            return s.authorById[authorid].searchable
        }

        s.closeFocus = event => (s.isFocus = false)

        s.incrFontSize = function (event, fac) {
            event.stopPropagation()
            s.fontSizeFactor += fac
        }

        s.getFontSizeFactor = function () {
            if (s.isFocus) {
                return s.fontSizeFactor
            } else {
                return 1
            }
        }

        s.nyaVagarUrl = require("@/img/lb_logga_nyavägar_2.2021.svg")
        s.dwUrl = require("@/img/dramawebben_svart.svg")

        s.getTransform = function () {
            if (!s.isFocus) {
                return {}
            }
            const prefixes = ["", "-webkit-", "-o-", "-moz-", "-ms-"]
            const val = `scaleX(${s.fontSizeFactor}) scaleY(${s.fontSizeFactor})`
            const addPrefixes = rule => _.map(prefixes, p => p + rule)

            const out = {}
            for (let [to, t] of _.zip(addPrefixes("transform-origin"), addPrefixes("transform"))) {
                out[t] = val
                out[to] = "left top"
            }

            return out
        }

        s.openModal = () => (s.show_about = true)

        s.onPartClick = function (startpage) {
            s.gotopage(startpage)
            s.showPopup = false
            s.show_chapters = false
        }

        s.resetHitMarkings = () =>
            ["markee_from", "markee_to", "x", "y", "height", "width"].map(key => (s[key] = null))

        const changeHit = function (newHit) {
            c.log("newHit", newHit)
            const from_id = newHit.highlights[0].wid
            const to_id = _.last(newHit.highlights).wid
            s.gotopage(newHit.highlights[0].n)
            s.markee_from = from_id
            s.markee_to = to_id
            return $location.search("hit_index", newHit.order)
        }

        s.nextHit = () => searchData.next().then(changeHit)

        s.prevHit = () => searchData.prev().then(changeHit)

        s.isLastHit = () => searchData.current + 1 == searchData.total_hits

        s.close_hits = function () {
            s.search_query = ""
            searchData.reset()
            s.resetHitMarkings()
            s.show_search_work = false
        }

        s.rotateAmount = 0
        s.getRotate = () => `rotate(${s.rotateAmount}deg)`
        s.rotate_left = () => {
            s.rotateAmount -= 90
        }
        s.rotate_right = () => {
            s.rotateAmount += 90
        }

        const onKeyDown = function (event) {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                $("body.modal-open").length ||
                $("input:focus").length
            ) {
                return
            }
            return s.$apply(function () {
                switch (event.which) {
                    case 78: // n
                        s.nextPage()
                        break
                    case 39: // arrow right
                        if (
                            $rootElement.prop("scrollWidth") - $window.scrollX ===
                            $($window).width()
                        ) {
                            s.nextPage()
                        }
                        break
                    case 70: // f
                        s.prevPage()
                        break
                    case 37: // arrow left
                        if ($window.scrollX < 10) {
                            s.prevPage()
                        }
                        break
                    case 126: // f15
                    case 68: // d
                        s.pageix = s.pageix - 10
                        s.pageToLoad = s.pageix
                        break
                    case 127: // f16
                    case 77: // m
                        s.pageix = s.pageix + 10
                        s.pageToLoad = s.pageix
                        break
                }
            })
        }

        $document.on("keydown", onKeyDown)

        s.getPage = function () {
            if (s.isEditor) {
                return s.pageix
            } else {
                return s.pagename || s.startpage
            }
        }

        s.setPage = function (ix) {
            s.pageix = ix
            s.pageToLoad = s.pagemap[`ix_${s.pageix}`]
        }

        s.getStep = () => {
            if (!s.workinfo) return
            return s.workinfo.stepmap[s.pageix] || s.workinfo.pagestep || 1
        }

        s.nextPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            if (s.isEditor) {
                s.pageix = s.pageix + (s.getStep() || 1)
                // s.pageix = s.pageix + 1
                s.pageToLoad = s.pageix
                return
            }
            if (!s.endpage) {
                return
            }
            const newix = s.pageix + s.getStep()
            // newix = s.pageix + 1
            if (`ix_${newix}` in s.pagemap) {
                return s.setPage(newix)
            }
        }
        // else
        //     s.setPage(0)

        s.prevPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            // unless s.pagemap then return
            if (s.isEditor) {
                s.pageix = s.pageix - (s.getStep() || 1)
                // s.pageix = s.pageix - 1
                s.pageToLoad = s.pageix
                return
            }
            const newix = s.pageix - s.getStep()
            // newix = s.pageix - 1
            if (`ix_${newix}` in s.pagemap) {
                return s.setPage(newix)
            } else {
                return s.setPage(0)
            }
        }

        s.isBeforeStartpage = function (pageix) {
            if (s.isEditor) {
                return false
            }
            if (!s.pagemap) {
                return
            }
            const startix = s.pagemap[`page_${s.startpage}`]
            return pageix <= startix
        }

        s.getFirstPageUrl = function () {
            const { search } = window.location
            if (s.isEditor) {
                let startpageix = s.startpage ? s.pagemap[`page_${s.startpage}`] : 0
                return (
                    `/editor/${$routeParams.lbid}/ix/${startpageix}/${$routeParams.mediatype}` +
                    search
                )
            } else {
                return s.getPageUrl(s.startpage)
            }
        }

        s.getPrevPageUrl = function () {
            if (!s.pagemap) {
                return
            }
            const newix = s.pageix - s.getStep()
            // newix = s.pageix - 1
            if (`ix_${newix}` in s.pagemap) {
                const page = s.pagemap[`ix_${newix}`]
                return `/författare/${s.author}/titlar/${s.title}/sida/${page}/${s.mediatype}`
            } else {
                return ""
            }
        }

        s.getNextPageUrl = function () {
            if (!s.endpage) {
                return
            }
            if (s.pageix === s.pagemap[`page_${s.endpage}`]) {
                return
            }
            const newix = s.pageix + s.getStep()
            // newix = s.pageix + 1
            if (`ix_${newix}` in s.pagemap) {
                const page = s.pagemap[`ix_${newix}`]
                return `/författare/${s.author}/titlar/${s.title}/sida/${page}/${s.mediatype}`
            } else {
                return ""
            }
        }

        s.getLastPageUrl = function () {
            if (s.isEditor && !s.workinfo) {
                return ""
            } else if (s.isEditor) {
                return `/editor/${s.workinfo.lbworkid}/ix/${s.workinfo.page_count - 1}/${
                    s.mediatype[0]
                }`
            } else {
                return s.getPageUrl(s.endpage)
            }
        }

        s.getPageUrl = function (page) {
            if (!page) {
                return ""
            }
            const search = $location.url().split("?")
            let suffix = ""
            if (search.length > 1) {
                suffix = `?${search[1]}`
            }

            return `/författare/${s.author}/titlar/${s.title}/sida/${page}/${s.mediatype}` + suffix
        }

        s.gotopage = function (page, event) {
            s.showGotoInput = false
            c.log("preventDefault", page)
            if (event != null) {
                event.preventDefault()
            }
            const ix = s.pagemap[`page_${page}`]
            if (s.isEditor) {
                s.pageix = ix
                s.pageToLoad = ix
            } else {
                s.setPage(ix)
            }
        }

        s.onGotoClick = function () {
            if (s.showGotoInput) {
                s.showGotoInput = false
                return
            }
            s.showGotoInput = true
            $timeout(() => s.$broadcast("focus"), 0)
        }

        s.toStartPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            if (s.isEditor) {
                s.pageix = 0
                s.pageToLoad = 0
            } else {
                s.gotopage(s.startpage)
            }
        }

        s.mouseover = function (event) {
            c.log("mouseover")
            s.showPopup = true
        }

        s.getTooltip = function (part) {
            if (part.navtitle !== part.showtitle) {
                return part.showtitle
            }
        }

        const partStartsOnPage = part => s.pagemap[`page_${part.startpagename}`] === s.pageix

        const getAllCurrentParts = function () {
            if (!s.workinfo) {
                return
            }
            return _.filter(s.workinfo.parts, function (part) {
                const startix = s.pagemap[`page_${part.startpagename}`]
                const endix = s.pagemap[`page_${part.endpagename}`]
                if (_.isUndefined(startix) || _.isUndefined(endix)) {
                    c.warn("Incorrect value, startix", startix, "endix", endix)
                }
                return s.pageix <= endix && s.pageix >= startix
            })
        }

        const findShortest = parts =>
            _.min(parts, function (part) {
                const startix = s.pagemap[`page_${part.startpagename}`]
                const endix = s.pagemap[`page_${part.endpagename}`]
                return endix - startix
            })

        const getLastSeenPart = function (findIndex, filterEnded, ignoreCurrent) {
            const maybePart = _.last(
                _.dropRightWhile(s.workinfo.partStartArray, function ([startix, part]) {
                    if (part === ignoreCurrent) {
                        return true
                    } // always go back a part
                    const endix = s.pagemap[`page_${part.endpagename}`]
                    if (findIndex === endix) {
                        return false
                    } // shortcut
                    if (filterEnded && endix < findIndex) {
                        return true
                    } // toss out ended parts
                    return startix > findIndex
                })
            ) // or (endix <= findIndex)

            if (maybePart) {
                return maybePart[1]
            }

            // we could be on a page between two parts
            // so find the last part that ended
            const decorated = _.map(s.workinfo.partStartArray, function ([i, part]) {
                return [findIndex - s.pagemap[`page_${part.endpagename}`], part]
            })

            const [diff, part] = _.min(decorated, function ([num, part]) {
                if (num < 0) {
                    return 10000
                } else {
                    return num
                }
            })
            return part
        }

        s.getCurrentPart = function () {
            if (!s.workinfo) {
                return
            }

            // there are no parts on this page
            if (!getAllCurrentParts().length) {
                return
            }

            const partStartingHere = _.find(s.workinfo.partStartArray, function ([i, part]) {
                return i === s.pageix
            })

            if (partStartingHere) return partStartingHere[1]
            return getLastSeenPart(s.pageix, true)
        }

        s.getNextPartUrl = function () {
            if (!s.workinfo) {
                return
            }

            const findIndex = s.pageix + 1 // should always go one page fwd

            const next = _.first(
                _.dropWhile(s.workinfo.partStartArray, function ([i, part]) {
                    return i < findIndex
                })
            )

            if (!next) {
                return ""
            }
            const [i, newPart] = next

            if (s.isEditor) {
                return `/editor/${s.workinfo.lbworkid}/ix/${i}/${s.mediatype[0]}`
            }

            return s.getPageUrl(newPart.startpagename)
        }

        s.getPrevPartUrl = function () {
            if (!s.workinfo) {
                return
            }
            if (!s.workinfo.partStartArray.length) {
                return
            }

            const [i, firstpart] = s.workinfo.partStartArray[0]
            if (s.pageix <= i) {
                // disable prev if we're before first part
                return
            }

            /*
        firstParts = _.filter s.workinfo.partStartArray, ([startix]) ->
            * all parts that start at the same page as the first part
            s.workinfo.partStartArray[0][0] == startix

        shortestFirstpart = findShortest(_.map(firstParts, _.last))

        * are we at the first part?
        * i.e are we before the end of the first part?
        if (s.pageix <= s.pagemap["page_" + shortestFirstpart.endpagename])
            return null
        current = s.getCurrentPart()
        */
            const prev = getLastSeenPart(s.pageix - 1, false)

            if (!prev) {
                return ""
            }

            if (s.isEditor) {
                return `/editor/${s.workinfo.lbworkid}/ix/${i}/${s.mediatype[0]}`
            }

            return s.getPageUrl(prev.startpagename)
        }

        s.toggleParallel = () => (s.isParallel = !s.isParallel)

        s.supportsParallel = function () {
            if (!s.workinfo) {
                return
            }
            return (
                s.workinfo.mediatypes.includes("etext") &&
                s.workinfo.mediatypes.includes("faksimil")
            )
        }

        s.getValidAuthors = function () {
            if (!s.authorById || !s.workinfo) {
                return
            }
            return s.workinfo.authors
        }

        authors.then(function ([authorData, authorById]) {
            s.authorById = authorById
        })

        const recalcCoors = function (val) {
            if (!s.x) {
                return
            }
            s.coors = []
            const iterable = s.x.split("|")
            for (var i = 0; i < iterable.length; i++) {
                const item = iterable[i]
                const pairs = _.toPairs(_.pick(s, "x", "y", "height", "width"))
                s.coors.push(
                    _.fromPairs(
                        _.map(pairs, function ([key, val]) {
                            return [key, val.split("|")[i].split(",")[s.size - 1]]
                        })
                    )
                )
            }
        }
        let chapter_modal = null
        let about_modal = null
        util.setupHashComplex(s, [
            {
                scope_name: "markee_from",
                key: "traff",
                replace: false
            },
            {
                scope_name: "markee_to",
                key: "traffslut",
                replace: false
            },
            {
                key: "x",
                replace: false,
                post_change: recalcCoors
            },

            {
                key: "y",
                replace: false,
                post_change: recalcCoors
            },
            {
                key: "width",
                replace: false,
                post_change: recalcCoors
            },
            {
                key: "height",
                replace: false,
                post_change: recalcCoors
            },
            {
                key: "parallel",
                scope_name: "isParallel"
            },
            {
                key: "fokus",
                scope_name: "isFocus",
                post_change(val) {
                    $rootScope._focus_mode = val
                }
            },
            { key: "border" },
            { key: "show_search_work" },
            {
                key: "om-boken",
                scope_name: "show_about",
                default: "no",
                post_change(val) {
                    if (val) {
                        about_modal = $uibModal.open({
                            templateUrl: "sourceInfoModal.html",
                            scope: s,
                            windowClass: "about"
                        })

                        about_modal.result.then(
                            () => (s.show_about = false),
                            () => (s.show_about = false)
                        )
                    } else {
                        if (about_modal != null) {
                            about_modal.close()
                        }
                        about_modal = null
                    }
                }
            },
            {
                key: "innehall",
                scope_name: "show_chapters",
                post_change(val) {
                    if (val) {
                        chapter_modal = $uibModal.open({
                            templateUrl: "chapters.html",
                            scope: s,
                            windowClass: "chapters"
                        })

                        chapter_modal.result.then(
                            () => (s.show_chapters = false),
                            () => (s.show_chapters = false)
                        )
                    } else {
                        if (chapter_modal != null) {
                            chapter_modal.close()
                        }
                        chapter_modal = null
                    }
                }
            }
        ])

        // s.showFocusBar = s.isFocus
        if (s.mediatype === "faksimil") {
            util.setupHashComplex(s, [
                {
                    key: "storlek",
                    scope_name: "size",
                    val_in: Number,
                    // val_out : (val) ->
                    //     val + 1
                    default: 3,
                    post_change: recalcCoors
                }
            ])
        }

        const watches = []
        watches.push(
            s.$watch("pageToLoad", function (val) {
                console.log("🚀 ~ file: reading_controller.js ~ line 667 ~ val", val)
                let url
                if (val == null) {
                    return
                }
                s.displaynum = val
                if (s.isEditor) {
                    url = `/editor/${$routeParams.lbid}/ix/${val}/${$routeParams.mediatype}`
                } else {
                    url = `/författare/${s.author}/titlar/${s.title}/sida/${val}/${s.mediatype}`
                }

                const prevpath = $location.path()

                const loc = $location.path(url)
                if (!s.isEditor && !_.str.contains(prevpath, "/sida/")) {
                    c.log("replace", prevpath)
                    loc.replace()
                }
            })
        )
        // ), 300, {leading:true})

        s.isDefined = angular.isDefined
        // s.getOverlayCss = function(obj) {
        //     console.log("getOverlayCss", s.overlayWidth)
        //     if (!s.overlayWidth) return {}
        //     // if (!s.overlayFactors) {
        //     //     return {}
        //     // }
        //     // const fac = s.overlayFactors[s.size - 1]
        //     const fac = s.imageWidth / s.overlayWidth
        //     console.log("imageWidth", s.imageWidth)
        //     return {
        //         left: fac * obj.x + "px",
        //         top: fac * obj.y + "px"
        //         // width : fac * obj.w
        //         // height : fac * obj.h
        //     }
        // }

        const initSourceInfo = function () {
            let params
            if (s.isEditor) {
                params = {
                    lbworkid: $routeParams.lbid
                }
            } else {
                params = {
                    titlepath: s.title,
                    authorid: s.author
                }
            }

            const def = backend.getSourceInfo(params, s.mediatype)
            s.workinfoPromise = def
            def.then(function (workinfo) {
                s.workinfo = workinfo
                s.pagemap = workinfo.pagemap

                if (s.isEditor) {
                    s.author = workinfo.authors[0].authorid
                    s.title = workinfo.titlepath
                }

                if (s.etextPageMapping == null) {
                    s.etextPageMapping = {}
                }

                if (s.mediatype === "faksimil") {
                    s.sizes = new Array(5)
                    for (let i of s.workinfo.faksimil_sizes) {
                        s.sizes[i] = true
                    }
                }

                s.startpage = workinfo.startpagename
                s.endpage = workinfo.endpagename
                if (s.pagename == null) {
                    s.pagename = s.startpage
                }

                s.isDramaweb = !!workinfo.dramawebben

                $timeout(() => {
                    s.sliderConf = {
                        floor: 0,
                        ceil: s.workinfo.page_count - 1,
                        showSelectionBar: true,
                        translate: val => s.pagemap["ix_" + val],
                        onStart: (sliderId, modelValue, highValue, pointerType) => {
                            s.sliderActive = pointerType
                        },
                        onEnd: () => {
                            s.sliderActive = null
                            // $location.search("intervall", s.filters["sort_date_imprint.date:range"].join(","))
                            // s.change()
                            if (s.isEditor) {
                                s.pageToLoad = s.pageix
                            } else {
                                s.setPage(s.pageix)
                            }
                        }
                    }
                }, 1000)
            })

            return def
        }

        const getDownloadPageUrl = function (pageix, size) {
            const id = $routeParams.lbid || s.workinfo.lbworkid
            if (s.mediatype === "etext") {
                const filename = _.str.lpad(pageix, 5, "0")
                return `/txt/${id}/res_${filename}.html`
            } else {
                if (s.isEditor) {
                    var basename = pageix + 1
                } else {
                    basename = s.workinfo.filenameMap[pageix]
                }
                const filename = _.str.lpad(basename, 4, "0")
                return `/txt/${id}/${id}_${size}/${id}_${size}_${filename}.jpeg`
            }
        }

        const downloadPage = function (pageix) {
            let url = getDownloadPageUrl(pageix)
            $("#prefetch").attr("href", getDownloadPageUrl(pageix + 1))
            const def = backend.getHtmlFile(url)
            def.then(function (html) {
                // since we use hard line breaks, soft hyphen needs to be replaced by actual hyphen
                const xmlSerializer = new XMLSerializer()
                const childNodes = []
                for (let child of html.data.firstChild.childNodes) {
                    childNodes.push(xmlSerializer.serializeToString(child))
                }
                s.etext_html = childNodes.join("").replace(/­/g, "-") // there's a soft hyphen in there, trust me
                return s.etext_html
            })

            return def
        }

        const getSrcsetSize = () => {
            if (s.size < 4 && s.sizes && s.sizes[s.size + 2 - 1]) {
                return s.size + 2
            }
        }

        s.getHeightConstraint = () => {
            return [625, 750, 1100, 1500, 3050][s.size - 1]
        }

        s.getWidthConstraint = () => {
            if (!s.workinfo) return
            // console.log("getSrcsetSize()", getSrcsetSize(), s.size)
            // let maybeSize = getSrcsetSize()
            // if (typeof maybeSize != "undefined") {
            //     let width = Number(s.workinfo.width["size_" + maybeSize])
            //     return width / 2 // not all size 5 are twice as large as size 2
            // }
            return Number(s.workinfo.width["size_" + s.size])
        }

        const infoDef = initSourceInfo()
        const fetchPage = function (ix) {
            if (s.mediatype === "etext") {
                return downloadPage(ix)
            } else {
                s.url = getDownloadPageUrl(ix, s.size)
                if (s.sizes) {
                    let maybeSize = getSrcsetSize()
                    // if (s.size < 4 && s.sizes[s.size + 2 - 1]) {
                    if (typeof maybeSize != "undefined") {
                        $("#prefetch").attr("href", getDownloadPageUrl(ix + 1, maybeSize))
                        s.srcset = `${getDownloadPageUrl(ix, s.size)} 1x, ${getDownloadPageUrl(
                            ix,
                            maybeSize
                        )} 2x`
                        // } else if (s.size == 4 && s.sizes[3] && s.sizes[4]) {
                        //     s.srcset = `${urlFromSize(s.size)} 1x, ${urlFromSize(5)} 2x`
                    } else {
                        $("#prefetch").attr("href", getDownloadPageUrl(ix + 1, s.size))
                        $(".img_area .faksimil").attr("srcset", null)
                        s.srcset = null
                    }
                }
                const def = $q.defer()
                def.resolve()
                return def.promise
            }
        }

        s.min = Math.min
        s.onImageLoad = () => {
            console.log("img load", $("img.faksimil").prop("width"))
            s.imageWidth = $("img.faksimil").prop("width")
        }
        // $("body").on("load", "img.faksimil", function() {
        //     window.safeApply(s, () => (s.imageWidth = $("img.faksimil").prop("naturalWidth")))
        // })
        s.$on("$routeUpdate", (event, route) => {
            console.log("update", route)
            let params = route.params
            let nextPath = `/författare/${params.author}/titlar/${params.title}/sida/${params.pagename}/:mediatype`
            if (params.title != s.title || params.mediatype != s.mediatype) {
                $route.reload()
            } else {
                if (s.isEditor) {
                    s.pageix = Number(params.ix)
                } else {
                    s.pagename = params.pagename
                    s.pageix = s.pagemap[`page_${s.pagename}`]
                    s.gotopage(params.pagename)

                    window.gtag("config", window.gtagID, {
                        page_path: nextPath,
                        anonymize_ip: true
                    })
                    window._paq.push(["trackPageView"])
                }
            }
            // applyRouteParams(params)
        })
        const loadPage = val => {
            c.log("loadPage", val)
            infoDef.then(
                function () {
                    if (!$route.current.isReader) {
                        c.log("resisted page load")
                        return
                    }

                    s.error = false

                    if ($location.search().sok) {
                        s.$broadcast("popper.open.searchPopup")
                    }

                    let promise = null
                    if (s.isEditor) {
                        s.pageix = Number(val)
                        promise = fetchPage(s.pageix)
                    } else {
                        s.pagename = val
                        s.pageix = s.pagemap[`page_${s.pagename}`]
                        if (typeof s.pageix == "undefined") {
                            return
                        }
                        promise = fetchPage(s.pageix)
                    }

                    if (!s.isEditor && !isDev) {
                        backend.logPage(s.pageix, s.workinfo.lbworkid, s.mediatype)
                    }
                    promise.then(function (html) {
                        s.first_load = true
                        s.loading = false
                        return onFirstLoad()
                    })

                    // console.log("mediatype", mediatype)
                    if (s.mediatype === "faksimil" && s.workinfo.searchable) {
                        return backend
                            .fetchOverlayData(s.workinfo.lbworkid, s.pageix)
                            .then(function ([overlayHtml, overlayWidth]) {
                                // s.overlayFactors = overlayFactors
                                s.overlayWidth = overlayWidth
                                s.overlayHtml = overlayHtml
                            })
                    }
                },

                function (err) {
                    c.log("page load error", err, $location.path(), val)

                    if (s.isEditor) {
                        fetchPage(Number(val)).then(function () {})
                        s.loading = false
                        s.first_load = true
                    } else {
                        s.error = true
                        if (!isDev) {
                            return backend.logError("reader", {
                                path: $location.path()
                            })
                        }
                    }
                }
            )
        }
        if (s.mediatype === "faksimil" && s.isEditor) {
            backend
                .fetchOverlayData(s.editorLbWorkId, s.pageix)
                .then(function ([overlayHtml, overlayWidth]) {
                    // s.overlayFactors = overlayFactors
                    s.overlayWidth = overlayWidth
                    s.overlayHtml = overlayHtml
                })
        }

        s.setSize = function (index) {
            c.log("setsize", index)
            s.size = index
            return loadPage(s.getPage())
        }

        s.isSizeDisabled = function (isIncrement) {
            if (s.isEditor || !s.sizes) {
                return false
            }
            if (isIncrement) {
                return !s.sizes[(s.size - 1 || 0) + 1]
            } else {
                return !s.sizes[(s.size - 1 || 0) - 1]
            }
        }

        watches.push(s.$watch("getPage()", debounce(loadPage, 200, { leading: false })))

        s.$on("$destroy", function () {
            $document.off("keydown", onKeyDown)
            for (w of watches) {
                w()
            }
        })

        try {
            // # ORD OCH SAK
            backend.ordOchSak(author, title).then(
                function (ordOchSak) {
                    s.ordOchSakAll = ordOchSak
                    s.$watch("pagename", updateOrdOchSak)
                    return updateOrdOchSak()
                },
                function (error) {}
            )
        } catch (e) {}
        // c.log 'failed to get ord och sak', error

        var updateOrdOchSak = function () {
            if (!s.ordOchSakAll || !s.pagename) {
                return
            }
            s.ordOchSakPage = s.ordOchSakAll.filter(
                entry => entry.forklaring && entry.pages.includes(s.pagename)
            )
        }

        // # TODO
        // s.markOosEntry = (entry) ->
        //    for id in entry.ids
        //        fromSpan = $(".etext #"+id.from)
        //        toSpan = $(".etext #"+id.to)
        //        all = fromSpan.nextUntil(toSpan).add(fromSpan).add(toSpan)
        //        all.addClass("markee")
        //
        // s.unmarkOosEntries = () ->
        //    $(".etext .markee").removeClass("markee")

        // # END ORD OCH SAK

        s.$on("img_expand", function (evt, src) {
            s.activeSrc = src
            $uibModal.open({
                templateUrl: "img_full.html",
                scope: s,
                windowClass: "img_full",
                size: "lg"
            })
        })

        // # START SEARCH

        s.getCleanUrl = () => $location.url().split("?")[0]

        s.hasActiveSearch = () => {
            if (!searchData) return false
            return $location.search().s_query && !searchData.searching
        }

        s.searchData = searchData = new SearchWorkData(s)

        c.log("outside params", $location.search())
        const query = $location.search().s_query
        if (query) {
            args = {
                mediatype: s.mediatype
            }
            s.search_query = query
            const getScopeVars = function (args) {
                const output = {}
                if (args.word_form_only) {
                    output.lemma = true
                }
                if (args.prefix) {
                    output.prefix = true
                }
                if (args.suffix) {
                    output.suffix = true
                }
                if (args.prefix && args.suffix) {
                    args.infix = true
                }
                return output
            }

            const object = $location.search()
            for (key in object) {
                val = object[key]
                if (_.str.startsWith(key, "s_")) {
                    const k = key.slice(2)
                    args[k] = val
                }
            }

            // _.extend s, getScopeVars(args)

            searchData.newSearch(args)
            searchData.current = Number($location.search().hit_index || 0)
            searchData.get(searchData.current).then(changeHit)
        }

        s.onGotoHitInput = function () {
            if (s.showGotoHitInput) {
                s.showGotoHitInput = false
                return
            }
            s.showGotoHitInput = true
            return $timeout(() => s.$broadcast("focus"), 0)
        }

        s.onGotoHit = function (hit) {
            if (hit > searchData.total_hits) {
                return
            }
            s.showGotoHitInput = false
            hit = Number(hit - 1)
            c.log("hit", hit)
            searchData.current = hit
            return searchData.get(hit).then(changeHit)
        }

        s.openSearchWorks = function () {
            s.show_search_work = !s.show_search_work
            return $timeout(() => s.$broadcast("focus.search_work"), 0)
        }

        s.sliderActive = null

        s.searchWork = function (query) {
            c.log("searchWork", query)

            s.$root.prevSearchState = null
            // size = $location.search().storlek

            args = {
                query,
                lbworkid: s.workinfo.lbworkid,
                prefix: $location.search().prefix,
                suffix: $location.search().suffix,
                // infix: $location.search().infix
                mediatype: s.mediatype
            }
            if (!$location.search().lemma) {
                args.word_form_only = true
            }
            const searchArgs = {}
            for (key in args) {
                val = args[key]
                searchArgs[`s_${key}`] = val
            }

            const prevArgs = {}
            const object1 = $location.search()
            for (key in object1) {
                val = object1[key]
                if (!_.str.startsWith(key, "s_")) {
                    prevArgs[key] = val
                }
            }

            $location.search(_.extend({}, prevArgs, searchArgs))
            c.log("searchArgs", searchArgs, prevArgs)

            searchData.newSearch(args)
            searchData.current = 0
            return searchData.get(0).then(function (hit) {
                c.log("hit", hit)
                if (!hit) {
                    return
                }
                return changeHit(hit)
            })
        }
    }
]
// )
