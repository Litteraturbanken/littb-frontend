import nyaVagarUrl from "@/img/lb_logga_nyavagar_2.2021.svg?url"
import dwUrl from "@/img/dramawebben_svart.svg?url"

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
    "ReaderStateService",
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
        $filter,
        ReaderStateService
    ) {
        const ctrl = this

        // Bridge properties managed by setupHashComplex (which reads/writes $scope)
        // so that ctrl.prop and $scope.prop stay in sync
        const hashProps = [
            "markee_from", "markee_to", "x", "y", "width", "height",
            "isParallel", "isFocus", "border", "show_search_work",
            "show_about", "show_chapters", "size"
        ]
        for (const prop of hashProps) {
            Object.defineProperty(ctrl, prop, {
                get() { return $scope[prop] },
                set(val) { $scope[prop] = val },
                enumerable: true,
                configurable: true
            })
        }

        ctrl.$routeParams = $routeParams
        ctrl.isEditor = false
        ctrl._ = { humanize: _.humanize }

        $window.scrollTo(0, 0)

        let applyRouteParams = params => {
            _.extend(ctrl, _.pick($routeParams, "title", "author", "mediatype"))

            if ("ix" in $routeParams) {
                ctrl.isEditor = true
                ctrl.pageix = Number($routeParams.ix)
                ctrl.pageToLoad = ctrl.pageix
                ctrl.editorLbWorkId = $routeParams.lbid
                ctrl.mediatype = { f: "faksimil", e: "etext" }[ctrl.mediatype]
            } else {
                ctrl.pagename = $routeParams.pagename
            }
        }
        applyRouteParams($routeParams)
        ctrl.suggestEtext = () => window.location.href.replace("/epub", "/etext")

        let searchData
        ctrl.searchData = searchData = null
        ctrl.loading = true
        ctrl.first_load = false
        const onFirstLoad = _.once(() => {
            // only if screen is small
            if (window.innerWidth > 768) {
                $timeout(() => window.scrollTo({ left: 1000, behavior: "smooth" }), 0)
            } else {
                $timeout(
                    () => {
                        const el = document.querySelector(".reader_main")
                        if (el) {
                            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" })
                        }
                    },
                    0
                )
            }
        })
        ctrl.showPopup = false
        ctrl.error = false
        ctrl.show_chapters = false // index modal

        ctrl.normalizeAuthor = $filter("normalizeAuthor")

        const h = window.innerHeight

        ctrl.fontSizeFactor = h / 900
        ReaderStateService.setNightMode(false)
        Object.defineProperty(ctrl, "nightMode", {
            get() { return ReaderStateService.getState().nightMode },
            set(val) { ReaderStateService.setNightMode(val) },
            enumerable: true,
            configurable: true
        })
        ctrl.isFocus = false
        ctrl.showFocusBar = true
        ctrl.isOcr = () => $location.search().ocr != null

        ctrl.activateFocus = function () {
            ctrl.isFocus = true
            ctrl.showFocusBar = true
        }

        ctrl.hasSearchable = function (authorid) {
            if (!authorid || !ctrl.authorById) {
                return
            }
            return ctrl.authorById[authorid].searchable
        }

        ctrl.closeFocus = event => (ctrl.isFocus = false)

        ctrl.incrFontSize = function (event, fac) {
            event.stopPropagation()
            ctrl.fontSizeFactor += fac
        }

        ctrl.getFontSizeFactor = function () {
            if (ctrl.isFocus) {
                return ctrl.fontSizeFactor
            } else {
                return 1
            }
        }

        ctrl.nyaVagarUrl = nyaVagarUrl
        ctrl.dwUrl = dwUrl

        ctrl.getTransform = function () {
            if (!ctrl.isFocus) {
                return {}
            }
            const prefixes = ["", "-webkit-", "-o-", "-moz-", "-ms-"]
            const val = `scaleX(${ctrl.fontSizeFactor}) scaleY(${ctrl.fontSizeFactor})`
            const addPrefixes = rule => _.map(prefixes, p => p + rule)

            const out = {}
            for (let [to, t] of _.zip(addPrefixes("transform-origin"), addPrefixes("transform"))) {
                out[t] = val
                out[to] = "left top"
            }

            return out
        }

        ctrl.openModal = () => (ctrl.show_about = true)

        ctrl.onPartClick = function (startpage) {
            ctrl.gotopage(startpage)
            ctrl.showPopup = false
            ctrl.show_chapters = false
        }

        ctrl.resetHitMarkings = () =>
            ["markee_from", "markee_to", "x", "y", "height", "width"].map(key => (ctrl[key] = null))

        const changeHit = function (newHit) {
            c.log("newHit", newHit)
            if (!newHit || !newHit.highlights || !newHit.highlights.length) {
                ctrl.resetHitMarkings()
                $location.search("hit_index", null)
                $location.search("traff", null)
                $location.search("traffslut", null)
                return
            }
            const from_id = newHit.highlights[0].wid
            const to_id = _.last(newHit.highlights).wid
            ctrl.gotopage(newHit.highlights[0].n)
            ctrl.markee_from = from_id
            ctrl.markee_to = to_id
            return $location.search("hit_index", newHit.order)
        }

        ctrl.nextHit = () => searchData.next().then(changeHit)

        ctrl.prevHit = () => searchData.prev().then(changeHit)

        ctrl.isLastHit = () => searchData.current + 1 == searchData.total_hits

        ctrl.close_hits = function () {
            ctrl.search_query = ""
            searchData.reset()
            ctrl.resetHitMarkings()
            ctrl.show_search_work = false
        }

        ctrl.rotateAmount = 0
        ctrl.getRotate = () => `rotate(${ctrl.rotateAmount}deg)`
        ctrl.rotate_left = () => {
            ctrl.rotateAmount -= 90
        }
        ctrl.rotate_right = () => {
            ctrl.rotateAmount += 90
        }

        const onKeyDown = function (event) {
            const activeTag = document.activeElement?.tagName
            let abort =
                event.metaKey ||
                event.ctrlKey ||
                activeTag === "INPUT" ||
                activeTag === "TEXTAREA"

            let isToggleOpen = [79, 129].includes(event.which)
            if (!isToggleOpen) {
                if (event.key != "i") {
                    abort = abort || document.body.classList.contains("modal-open")
                }
            }
            if (abort) {
                return
            }
            $scope.$apply(function () {
                switch (event.key) {
                    case "n":
                        ctrl.nextPage()
                        break
                    case "ArrowRight":
                        if (event.altKey && event.shiftKey) {
                            ctrl.setPage(ctrl.pageix + 10)
                        } else if (event.altKey) {
                            $location.path(ctrl.getNextPartUrl())
                        } else if (event.shiftKey) {
                            ctrl.nextPage()
                        } else {
                            if (
                                $rootElement.prop("scrollWidth") - $window.scrollX ===
                                $window.innerWidth
                            ) {
                                ctrl.nextPage()
                            }
                        }
                        break
                    case "f":
                        ctrl.prevPage()
                        break
                    case "ArrowLeft":
                        if (event.altKey && event.shiftKey) {
                            ctrl.setPage(ctrl.pageix - 10)
                        } else if (event.altKey) {
                            $location.path(ctrl.getPrevPartUrl())
                        } else if (event.shiftKey) {
                            ctrl.prevPage()
                        } else {
                            if ($window.scrollX < 10) {
                                ctrl.prevPage()
                            }
                        }
                        break
                    case "F15":
                    case "d":
                        if (ctrl.isEditor) {
                            ctrl.pageix = ctrl.pageix - 10
                            ctrl.pageToLoad = ctrl.pageix
                            break
                        } else {
                            $location.path(ctrl.getPrevPartUrl())
                        }
                    case "F16":
                    case "m":
                        if (ctrl.isEditor) {
                            ctrl.pageix = ctrl.pageix + 10
                            ctrl.pageToLoad = ctrl.pageix
                            break
                        } else {
                            $location.path(ctrl.getNextPartUrl())
                        }
                        break
                    case "F17":
                    case "i":
                        navigator.clipboard.writeText(ctrl.editorLbWorkId || ctrl.workinfo.lbworkid)
                        $scope.$emit("notify", "Kopierade lbworkid")
                        break
                    case "F21":
                    case "u":
                        if (ctrl.workinfo.urn) {
                            navigator.clipboard.writeText(
                                "https://urn.kb.se/resolve?urn=" + ctrl.workinfo.urn
                            )
                            $scope.$emit("notify", "Kopierade urn")
                        } else {
                            $scope.$emit("notify", "Ingen urn hittades")
                        }
                        break
                    case "F18":
                    case "o":
                        ctrl.show_about = !ctrl.show_about
                        break
                    case "Escape":
                        ctrl.isFocus = false
                        break
                    case "å":
                    case "[":
                        window.location.pathname =
                            window.location.pathname.split("/").slice(0, -1).join("/") +
                            (ctrl.mediatype == "etext" ? "/faksimil" : "/etext")
                        break
                }
            })
        }

        $document.on("keydown", onKeyDown)

        ctrl.getPage = function () {
            if (ctrl.isEditor) {
                return ctrl.pageix
            } else {
                return ctrl.pagename || ctrl.startpage
            }
        }

        ctrl.setPage = function (ix) {
            if (ctrl.isEditor) {
                ctrl.pageix = ix
                ctrl.pageToLoad = ctrl.pageix
            } else {
                ctrl.pageix = ix
                ctrl.pageToLoad = ctrl.pagemap[`ix_${ctrl.pageix}`]
            }
        }

        ctrl.getStep = () => {
            if (!ctrl.workinfo?.stepmap) return
            return ctrl.workinfo.stepmap[ctrl.pageix] || ctrl.workinfo.pagestep || 1
        }

        ctrl.nextPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            if (ctrl.isEditor) {
                ctrl.pageix = ctrl.pageix + (ctrl.getStep() || 1)
                ctrl.pageToLoad = ctrl.pageix
                return
            }
            if (!ctrl.endpage) {
                return
            }
            const newix = ctrl.pageix + ctrl.getStep()
            if (`ix_${newix}` in ctrl.pagemap) {
                return ctrl.setPage(newix)
            }
        }

        ctrl.prevPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            if (ctrl.isEditor) {
                ctrl.pageix = ctrl.pageix - (ctrl.getStep() || 1)
                ctrl.pageToLoad = ctrl.pageix
                return
            }
            const newix = ctrl.pageix - ctrl.getStep()
            if (`ix_${newix}` in ctrl.pagemap) {
                return ctrl.setPage(newix)
            } else {
                return ctrl.setPage(0)
            }
        }

        ctrl.isBeforeStartpage = function (pageix) {
            if (ctrl.isEditor) {
                return false
            }
            if (!ctrl.pagemap) {
                return
            }
            const startix = ctrl.pagemap[`page_${ctrl.startpage}`]
            return pageix <= startix
        }

        ctrl.getFirstPageUrl = function () {
            const { search } = window.location
            if (ctrl.isEditor) {
                let startpageix = ctrl.startpage ? ctrl.pagemap[`page_${ctrl.startpage}`] : 0
                return (
                    `/editor/${$routeParams.lbid}/ix/${startpageix}/${$routeParams.mediatype}` +
                    search
                )
            } else {
                return ctrl.getPageUrl(ctrl.startpage)
            }
        }

        ctrl.getPrevPageUrl = function () {
            if (!ctrl.pagemap) {
                return
            }
            const newix = ctrl.pageix - ctrl.getStep()
            if (`ix_${newix}` in ctrl.pagemap) {
                const page = ctrl.pagemap[`ix_${newix}`]
                return `/författare/${ctrl.author}/titlar/${ctrl.title}/sida/${page}/${ctrl.mediatype}`
            } else {
                return ""
            }
        }

        ctrl.getNextPageUrl = function () {
            if (!ctrl.endpage) {
                return
            }
            if (ctrl.pageix === ctrl.pagemap[`page_${ctrl.endpage}`]) {
                return
            }
            const newix = ctrl.pageix + ctrl.getStep()
            if (`ix_${newix}` in ctrl.pagemap) {
                const page = ctrl.pagemap[`ix_${newix}`]
                return `/författare/${ctrl.author}/titlar/${ctrl.title}/sida/${page}/${ctrl.mediatype}`
            } else {
                return ""
            }
        }

        ctrl.getLastPageUrl = function () {
            if (ctrl.isEditor && !ctrl.workinfo) {
                return ""
            } else if (ctrl.isEditor) {
                return `/editor/${ctrl.workinfo.lbworkid}/ix/${ctrl.workinfo.page_count - 1}/${
                    ctrl.mediatype[0]
                }`
            } else {
                return ctrl.getPageUrl(ctrl.endpage)
            }
        }

        ctrl.getPageUrl = function (page) {
            if (!page) {
                return ""
            }
            const search = $location.url().split("?")
            let suffix = ""
            if (search.length > 1) {
                suffix = `?${search[1]}`
            }

            return `/författare/${ctrl.author}/titlar/${ctrl.title}/sida/${page}/${ctrl.mediatype}` + suffix
        }

        ctrl.gotopage = function (page, event) {
            ctrl.showGotoInput = false
            c.log("preventDefault", page)
            if (event != null) {
                event.preventDefault()
            }
            const ix = ctrl.pagemap[`page_${page}`]
            ctrl.setPage(ix)
        }

        ctrl.onGotoClick = function () {
            if (ctrl.showGotoInput) {
                ctrl.showGotoInput = false
                return
            }
            ctrl.showGotoInput = true
            $timeout(() => $scope.$broadcast("focus"), 0)
        }

        ctrl.toStartPage = function (event) {
            if (event != null) {
                event.preventDefault()
            }
            if (ctrl.isEditor) {
                ctrl.pageix = 0
                ctrl.pageToLoad = 0
            } else {
                ctrl.gotopage(ctrl.startpage)
            }
        }

        ctrl.mouseover = function (event) {
            c.log("mouseover")
            ctrl.showPopup = true
        }

        ctrl.getTooltip = function (part) {
            if (part.navtitle !== part.showtitle) {
                return part.showtitle
            }
        }

        const partStartsOnPage = part => ctrl.pagemap[`page_${part.startpagename}`] === ctrl.pageix

        const getAllCurrentParts = function () {
            if (!ctrl.workinfo) {
                return
            }
            return _.filter(ctrl.workinfo.parts, function (part) {
                const startix = ctrl.pagemap[`page_${part.startpagename}`]
                const endix = ctrl.pagemap[`page_${part.endpagename}`]
                if (_.isUndefined(startix) || _.isUndefined(endix)) {
                    c.warn("Incorrect value, startix", startix, "endix", endix)
                }
                return ctrl.pageix <= endix && ctrl.pageix >= startix
            })
        }

        const findShortest = parts =>
            _.min(parts, function (part) {
                const startix = ctrl.pagemap[`page_${part.startpagename}`]
                const endix = ctrl.pagemap[`page_${part.endpagename}`]
                return endix - startix
            })

        const getLastSeenPart = function (findIndex, filterEnded, ignoreCurrent) {
            const maybePart = _.last(
                _.dropRightWhile(ctrl.workinfo.partStartArray, function ([startix, part]) {
                    if (part === ignoreCurrent) {
                        return true
                    } // always go back a part
                    const endix = ctrl.pagemap[`page_${part.endpagename}`]
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
            const decorated = _.map(ctrl.workinfo.partStartArray, function ([i, part]) {
                return [findIndex - ctrl.pagemap[`page_${part.endpagename}`], part]
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

        const updateMetaTag = function (name, content) {
            let metaElement = document.querySelector(`meta[name="${name}"]`)
            if (!content) {
                if (metaElement) {
                    metaElement.remove()
                }
                return
            }
            if (!metaElement) {
                metaElement = document.createElement("meta")
                metaElement.name = name
                document.head.appendChild(metaElement)
            }
            metaElement.content = content
        }

        const updatePartMetaTag = function () {
            const part = ctrl.getCurrentPart()
            updateMetaTag("part", part?.titleid)
        }

        ctrl.getCurrentPart = function () {
            if (!ctrl.workinfo) {
                return
            }

            // there are no parts on this page
            if (!getAllCurrentParts().length) {
                return
            }

            const partStartingHere = _.find(ctrl.workinfo.partStartArray, function ([i, part]) {
                return i === ctrl.pageix
            })

            if (partStartingHere) return partStartingHere[1]
            return getLastSeenPart(ctrl.pageix, true)
        }

        ctrl.getNextPartUrl = function () {
            if (!ctrl.workinfo?.partStartArray?.length) {
                return
            }

            const findIndex = ctrl.pageix + 1 // should always go one page fwd

            const next = _.first(
                _.dropWhile(ctrl.workinfo.partStartArray, function ([i, part]) {
                    return i < findIndex
                })
            )

            if (!next) {
                return ""
            }
            const [i, newPart] = next

            if (ctrl.isEditor) {
                return `/editor/${ctrl.workinfo.lbworkid}/ix/${i}/${ctrl.mediatype[0]}`
            }

            return ctrl.getPageUrl(newPart.startpagename)
        }

        ctrl.getPrevPartUrl = function () {
            if (!ctrl.workinfo?.partStartArray?.length) {
                return
            }

            const [i, firstpart] = ctrl.workinfo.partStartArray[0]
            if (ctrl.pageix <= i) {
                // disable prev if we're before first part
                return
            }

            const prev = getLastSeenPart(ctrl.pageix - 1, false)

            if (!prev) {
                return ""
            }

            if (ctrl.isEditor) {
                return `/editor/${ctrl.workinfo.lbworkid}/ix/${i}/${ctrl.mediatype[0]}`
            }

            return ctrl.getPageUrl(prev.startpagename)
        }

        ctrl.toggleParallel = () => (ctrl.isParallel = !ctrl.isParallel)

        ctrl.supportsParallel = function () {
            if (!ctrl.workinfo) {
                return
            }
            return (
                ctrl.workinfo.mediatypes.includes("etext") &&
                ctrl.workinfo.mediatypes.includes("faksimil")
            )
        }

        ctrl.getValidAuthors = function () {
            if (!ctrl.authorById || !ctrl.workinfo) {
                return
            }
            return ctrl.workinfo.authors
        }

        authors.then(function ([authorData, authorById]) {
            ctrl.authorById = authorById
        })

        const recalcCoors = function (val) {
            if (!ctrl.x) {
                return
            }
            ctrl.coors = []
            const iterable = ctrl.x.split("|")
            for (var i = 0; i < iterable.length; i++) {
                const item = iterable[i]
                const pairs = _.toPairs(_.pick(ctrl, "x", "y", "height", "width"))
                ctrl.coors.push(
                    _.fromPairs(
                        _.map(pairs, function ([key, val]) {
                            return [key, val.split("|")[i].split(",")[ctrl.size - 1]]
                        })
                    )
                )
            }
        }
        let chapter_modal = null
        let about_modal = null
        // setupHashComplex needs $scope for $watch/$watch functionality
        util.setupHashComplex($scope, [
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
                    ReaderStateService.setFocusMode(val)
                }
            },
            { key: "border" },
            { key: "show_search_work" },
            {
                key: "om-boken",
                scope_name: "show_about",
                default: false,
                post_change(val) {
                    if (val) {
                        about_modal = $uibModal.open({
                            templateUrl: "sourceInfoModal.html",
                            scope: $scope,
                            windowClass: "about"
                        })

                        about_modal.result.then(
                            () => (ctrl.show_about = false),
                            () => (ctrl.show_about = false)
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
                            scope: $scope,
                            windowClass: "chapters"
                        })

                        chapter_modal.result.then(
                            () => (ctrl.show_chapters = false),
                            () => (ctrl.show_chapters = false)
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

        // ctrl.showFocusBar = ctrl.isFocus
        if (ctrl.mediatype === "faksimil") {
            util.setupHashComplex($scope, [
                {
                    key: "storlek",
                    scope_name: "size",
                    val_in: Number,
                    default: 3,
                    post_change: recalcCoors
                }
            ])
        }

        const watches = []
        watches.push(
            $scope.$watch("$ctrl.pageToLoad", function (val) {
                let url
                if (val == null) {
                    return
                }
                ctrl.displaynum = val
                if (ctrl.isEditor) {
                    url = `/editor/${$routeParams.lbid}/ix/${val}/${$routeParams.mediatype}`
                } else {
                    url = `/författare/${ctrl.author}/titlar/${ctrl.title}/sida/${val}/${ctrl.mediatype}`
                }

                const prevpath = $location.path()
                if (url === prevpath) {
                    return
                }

                const loc = $location.path(url)
                if (!ctrl.isEditor && !_.str.contains(prevpath, "/sida/")) {
                    c.log("replace", prevpath)
                    loc.replace()
                }
            })
        )

        ctrl.isDefined = angular.isDefined

        const initSourceInfo = function () {
            let params
            if (ctrl.isEditor) {
                params = {
                    lbworkid: $routeParams.lbid
                }
            } else {
                params = {
                    titlepath: ctrl.title,
                    authorid: ctrl.author
                }
            }

            const def = backend.getSourceInfo({ exclude: "content_vector", ...params }, ctrl.mediatype)
            ctrl.workinfoPromise = def
            def.then(function (workinfo) {
                ctrl.workinfo = workinfo
                updateMetaTag("lbworkid", workinfo.lbworkid)
                ctrl.pagemap = workinfo.pagemap

                if (ctrl.isEditor) {
                    ctrl.author = workinfo.authors[0].authorid
                    ctrl.title = workinfo.titlepath
                }

                if (ctrl.etextPageMapping == null) {
                    ctrl.etextPageMapping = {}
                }

                if (ctrl.mediatype === "faksimil") {
                    ctrl.sizes = new Array(5)
                    for (let i of ctrl.workinfo.faksimil_sizes) {
                        ctrl.sizes[i] = true
                    }
                }

                ctrl.startpage = workinfo.startpagename
                ctrl.endpage = workinfo.endpagename
                if (ctrl.pagename == null && !ctrl.isEditor) {
                    ctrl.pagename = ctrl.startpage
                    ctrl.pageix = ctrl.pagemap[`page_${ctrl.startpage}`]
                    // Normalize mediatype-only reader routes to a concrete page immediately.
                    ctrl.pageToLoad = ctrl.startpage
                    $location.path(ctrl.getPageUrl(ctrl.startpage)).replace()
                }

                ctrl.isDramaweb = !!workinfo.dramawebben

                $timeout(() => {
                    ctrl.sliderConf = {
                        floor: 0,
                        ceil: ctrl.workinfo.page_count - 1,
                        showSelectionBar: true,
                        translate: val => ctrl.pagemap["ix_" + val],
                        onStart: (sliderId, modelValue, highValue, pointerType) => {
                            ctrl.sliderActive = pointerType
                        },
                        onEnd: () => {
                            ctrl.sliderActive = null
                            if (ctrl.isEditor) {
                                ctrl.pageToLoad = ctrl.pageix
                            } else {
                                ctrl.setPage(ctrl.pageix)
                            }
                        }
                    }
                }, 1000)
            })

            return def
        }

        const getDownloadPageUrl = function (pageix, size) {
            const id = $routeParams.lbid || ctrl.workinfo.lbworkid
            if (ctrl.mediatype === "etext") {
                const filename = _.str.lpad(pageix, 5, "0")
                return `/txt/${id}/res_${filename}.html`
            } else {
                if (ctrl.isEditor) {
                    var basename = pageix + 1
                } else {
                    basename = ctrl.workinfo.filenameMap[pageix]
                }
                const filename = _.str.lpad(basename, 4, "0")
                return `/txt/${id}/${id}_${size}/${id}_${size}_${filename}.jpeg`
            }
        }

        const downloadPage = function (pageix) {
            let url = getDownloadPageUrl(pageix)
            document.getElementById("prefetch").href = getDownloadPageUrl(pageix + 1)
            const def = backend.getHtmlFile(url, false)
            def.then(function (html) {
                // since we use hard line breaks, soft hyphen needs to be replaced by actual hyphen
                const xmlSerializer = new XMLSerializer()
                const childNodes = []
                for (let child of html.data.firstChild.childNodes) {
                    childNodes.push(xmlSerializer.serializeToString(child))
                }
                ctrl.etext_html = childNodes.join("").replace(/­/g, "-") // there's a soft hyphen in there, trust me
                return ctrl.etext_html
            }).catch(function (err) {
                ctrl.loading = false
                ctrl.error = true
            })

            return def
        }

        const getSrcsetSize = () => {
            if (ctrl.size < 4 && ctrl.sizes && ctrl.sizes[ctrl.size + 2 - 1]) {
                return ctrl.size + 2
            }
        }

        ctrl.getHeightConstraint = () => {
            return [625, 750, 1100, 1500, 3050][ctrl.size - 1]
        }

        ctrl.getWidthConstraint = () => {
            if (!ctrl.workinfo?.width) return
            return Number(ctrl.workinfo.width["size_" + ctrl.size])
        }

        const infoDef = initSourceInfo()
        const fetchPage = function (ix) {
            if (ctrl.mediatype === "etext") {
                return downloadPage(ix)
            } else {
                ctrl.url = getDownloadPageUrl(ix, ctrl.size)
                if (ctrl.sizes) {
                    let maybeSize = getSrcsetSize()
                    if (typeof maybeSize != "undefined") {
                        document.getElementById("prefetch").href = getDownloadPageUrl(ix + 1, maybeSize)
                        ctrl.srcset = `${getDownloadPageUrl(ix, ctrl.size)} 1x, ${getDownloadPageUrl(
                            ix,
                            maybeSize
                        )} 2x`
                    } else {
                        document.getElementById("prefetch").href = getDownloadPageUrl(ix + 1, ctrl.size)
                        const faksimilImg = document.querySelector(".img_area .faksimil")
                        if (faksimilImg) faksimilImg.removeAttribute("srcset")
                        ctrl.srcset = null
                    }
                }
                const def = $q.defer()
                def.resolve()
                return def.promise
            }
        }

        ctrl.min = Math.min
        ctrl.onImageLoad = () => {
            const img = document.querySelector("img.faksimil")
            const w = img ? img.width : 0
            console.log("img load", w)
            ctrl.imageWidth = w
        }
        $scope.$on("$routeUpdate", (event, route) => {
            console.log("update", route)
            let params = route.params
            let nextPath = `/författare/${params.author}/titlar/${params.title}/sida/${params.pagename}/:mediatype`
            if (ctrl.isEditor) {
                const routeMediatype = { f: "faksimil", e: "etext" }[params.mediatype]
                if (params.lbid != ctrl.editorLbWorkId || routeMediatype != ctrl.mediatype) {
                    $route.reload()
                    return
                }
                ctrl.pageix = Number(params.ix)
                return
            }

            if (params.title != ctrl.title || params.mediatype != ctrl.mediatype) {
                $route.reload()
            } else {
                ctrl.pagename = params.pagename
                ctrl.pageix = ctrl.pagemap[`page_${ctrl.pagename}`]
                ctrl.gotopage(params.pagename)

                window.gtag("config", window.gtagID, {
                    page_path: nextPath,
                    anonymize_ip: true
                })

                _paq.push(["setCustomUrl", decodeURI(window.location.pathname)])
                _paq.push([
                    "setDocumentTitle",
                    params.author + " – " + params.title + " s. " + params.pagename
                ])
                window._paq.push(["trackPageView"])
            }
        })
        const loadPage = val => {
            c.log("loadPage", val)
            infoDef.then(
                function () {
                    if (!$route.current.isReader) {
                        c.log("resisted page load")
                        return
                    }

                    ctrl.error = false

                    if ($location.search().sok) {
                        $scope.$broadcast("popper.open.searchPopup")
                    }

                    let promise = null
                    if (ctrl.isEditor) {
                        ctrl.pageix = Number(val)
                        promise = fetchPage(ctrl.pageix)
                    } else {
                        ctrl.pagename = val
                        ctrl.pageix = ctrl.pagemap[`page_${ctrl.pagename}`]
                        if (typeof ctrl.pageix == "undefined") {
                            return
                        }
                        updatePartMetaTag()
                        promise = fetchPage(ctrl.pageix)
                    }

                    if (!ctrl.isEditor && !isDev) {
                        backend.logPage(ctrl.pageix, ctrl.workinfo.lbworkid, ctrl.mediatype)
                    }

                    const id = $routeParams.lbid || ctrl.workinfo.lbworkid
                    const pageView = {
                        pageix: ctrl.pageix,
                        pagename: ctrl.pagename,
                        timestamp: new Date().toISOString(),
                        mediatype: ctrl.mediatype,
                        lbworkid: id,
                        author: ctrl.author,
                        label: ctrl.workinfo.shorttitle || ctrl.workinfo.title,
                        url: $location.url()
                    }
                    const lastPageViews = JSON.parse(localStorage.getItem("lastPageViews")) || []
                    const existingIndex = lastPageViews.findIndex(
                        view => view.lbworkid === id && view.mediatype === ctrl.mediatype
                    )

                    if (existingIndex !== -1) {
                        lastPageViews.splice(existingIndex, 1)
                    }

                    lastPageViews.unshift(pageView)

                    if (lastPageViews.length > 50) {
                        lastPageViews.pop()
                    }

                    localStorage.setItem("lastPageViews", JSON.stringify(lastPageViews))
                    console.log("🚀 ~ lastPageViews:", lastPageViews)
                    promise.then(function (html) {
                        ctrl.first_load = true
                        ctrl.loading = false
                        return onFirstLoad()
                    })

                    if (ctrl.mediatype === "faksimil" && ctrl.workinfo.searchable) {
                        return backend
                            .fetchOverlayData(ctrl.workinfo.lbworkid, ctrl.pageix)
                            .then(function ([overlayHtml, overlayWidth, overlayHeight]) {
                                ctrl.overlayWidth = overlayWidth
                                ctrl.overlayHeight = overlayHeight
                                ctrl.overlayHtml = overlayHtml
                            })
                    }
                },

                function (err) {
                    c.log("page load error", err, $location.path(), val)

                    if (ctrl.isEditor) {
                        fetchPage(Number(val)).then(function () {})
                        ctrl.loading = false
                        ctrl.first_load = true
                        backend.getPageCount($routeParams.lbid, ctrl.mediatype).then(function (count) {
                            ctrl.workinfo = { page_count: count }
                        })
                    } else {
                        ctrl.error = true
                        if (!isDev) {
                            return backend.logError("reader", {
                                path: $location.path()
                            })
                        }
                    }
                }
            )
        }
        if (ctrl.mediatype === "faksimil" && ctrl.isEditor) {
            backend
                .fetchOverlayData(ctrl.editorLbWorkId, ctrl.pageix)
                .then(function ([overlayHtml, overlayWidth, overlayHeight]) {
                    ctrl.overlayWidth = overlayWidth
                    ctrl.overlayHeight = overlayHeight
                    ctrl.overlayHtml = overlayHtml
                })
        }

        ctrl.setSize = function (index) {
            c.log("setsize", index)
            ctrl.size = index
            return loadPage(ctrl.getPage())
        }

        ctrl.isSizeDisabled = function (isIncrement) {
            if (ctrl.isEditor || !ctrl.sizes) {
                return false
            }
            if (isIncrement) {
                return !ctrl.sizes[(ctrl.size - 1 || 0) + 1]
            } else {
                return !ctrl.sizes[(ctrl.size - 1 || 0) - 1]
            }
        }

        watches.push($scope.$watch("$ctrl.getPage()", debounce(loadPage, 200, { leading: false })))

        $scope.$on("$destroy", function () {
            $document.off("keydown", onKeyDown)
            for (const w of watches) {
                w()
            }
        })

        try {
            // # ORD OCH SAK
            backend.ordOchSak(author, title).then(
                function (ordOchSak) {
                    ctrl.ordOchSakAll = ordOchSak
                    $scope.$watch("$ctrl.pagename", updateOrdOchSak)
                    return updateOrdOchSak()
                },
                function (error) {}
            )
        } catch (e) {}

        var updateOrdOchSak = function () {
            if (!ctrl.ordOchSakAll || !ctrl.pagename) {
                return
            }
            ctrl.ordOchSakPage = ctrl.ordOchSakAll.filter(
                entry => entry.forklaring && entry.pages.includes(ctrl.pagename)
            )
        }

        $scope.$on("img_expand", function (evt, src) {
            ctrl.activeSrc = src
            $uibModal.open({
                templateUrl: "img_full.html",
                scope: $scope,
                windowClass: "img_full",
                size: "lg"
            })
        })

        // # START SEARCH

        ctrl.getCleanUrl = () => $location.url().split("?")[0]

        ctrl.hasActiveSearch = () => {
            if (!searchData) return false
            return $location.search().s_query && !searchData.searching
        }

        ctrl.searchData = searchData = new SearchWorkData($scope)

        let args, key, val
        c.log("outside params", $location.search())
        const query = $location.search().s_query
        if (query) {
            args = {
                mediatype: ctrl.mediatype
            }
            ctrl.search_query = query
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

            searchData.newSearch(args)
            searchData.current = Number($location.search().hit_index || 0)
            searchData.get(searchData.current).then(changeHit)
        }

        ctrl.onGotoHitInput = function () {
            if (ctrl.showGotoHitInput) {
                ctrl.showGotoHitInput = false
                return
            }
            ctrl.showGotoHitInput = true
            return $timeout(() => $scope.$broadcast("focus"), 0)
        }

        ctrl.onGotoHit = function (hit) {
            if (hit > searchData.total_hits) {
                return
            }
            ctrl.showGotoHitInput = false
            hit = Number(hit - 1)
            c.log("hit", hit)
            searchData.current = hit
            return searchData.get(hit).then(changeHit)
        }

        ctrl.openSearchWorks = function () {
            ctrl.show_search_work = !ctrl.show_search_work
            return $timeout(() => $scope.$broadcast("focus.search_work"), 0)
        }

        ctrl.sliderActive = null

        ctrl.searchWork = function (query) {
            c.log("searchWork", query)

            $rootScope.prevSearchState = null

            args = {
                query,
                lbworkid: ctrl.workinfo.lbworkid,
                prefix: $location.search().prefix,
                suffix: $location.search().suffix,
                mediatype: ctrl.mediatype
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
