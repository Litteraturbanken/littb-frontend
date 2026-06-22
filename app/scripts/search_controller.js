import { buildFilterQuery, buildSearchFilterPayload, composeQuery } from "./query.ts"
import searchUrl from "./components/search/template.html?url"

const _ = window._
const $ = window.$
const c = window.console
const littb = window.littb
const safeApply = window.safeApply

const getAuthorSelectSetup = (ctrl, $filter) => ({
    templateResult(data) {
        if (!data.id) {
            return
        }
        const author = ctrl.authorsById[data.id]
        if (!author) return data.id

        let firstname = ""
        if (!author.name_for_index) {
            c.warn("no name_for_index for author", author)
        } else if (author.name_for_index.split(",").length > 1) {
            firstname = `<span class='firstname'>, ${author.name_for_index.split(",")[1]}</span>`
        }

        return $(` <span>
                        <span class="surname sc">${author.surname}</span>${firstname}
                        <span class="year">${$filter("authorYear")(author)}</span>
                    </span>`)
    },

    templateSelection(item) {
        if (!ctrl.authorsById || !item.id) return
        return ctrl.authorsById[item.id].surname
    }
})

function SearchPageCtrl(
    $scope,
    $element,
    backend,
    $location,
    $document,
    $window,
    $rootElement,
    $rootScope,
    $q,
    $timeout,
    util,
    SearchData,
    authors,
    debounce,
    $filter,
    $anchorScroll,
    SearchStateService
) {
    const ctrl = this
    let searchData
    let hasSearchInit = false

    // Bridge: define property descriptors on $scope so that setupHashComplex
    // (which reads/writes $scope properties) transparently accesses the controller.
    const bridgedProps = [
        "filters",
        "selectedTitles",
        "selectedKeywords",
        "nav_filter",
        "current_page",
        "advanced",
        "isAuthorAboutSearch",
        "searching",
        "sentsWithHeaders",
        "sentsNavFilter",
        "num_hits",
        "authorsById",
        "authors",
        "titles",
        "titles_hits",
        "aboutAuthors",
        "doc_hits",
        "total_pages",
        "authorStatsData",
        "query",
        "pageTitle",
        "showGotoHitInput",
        "from_index",
        "auth_select_rendered",
        "loadingTitles",
        "loadingAuthors"
    ]
    for (const prop of bridgedProps) {
        Object.defineProperty($scope, prop, {
            get() {
                return ctrl[prop]
            },
            set(v) {
                ctrl[prop] = v
            },
            configurable: true,
            enumerable: true
        })
    }

    this.$onInit = function () {
        ctrl.open = true
        ctrl.auth_select_rendered = false
        ctrl.onKeywordChange = () => {}
        ctrl.selectedTitles = []
        ctrl.selectedKeywords = []
        $timeout(() => $scope.$broadcast("focus"))

        console.log("SearchStateService state", SearchStateService.getState())
        let routeChangeUnbind = $scope.$on("$routeChangeStart", (event, newRoute, prevRoute) => {
            console.log("leave search", window.location.search)
            SearchStateService.setState({ queryparams: window.location.search })
        })

        let filterDefaults = {
            "authors.gender": null,
            "authorkeyword>authorid": [],
            keywords: [],
            languages: [],
            "authors>authorid": [],
            "sort_date_imprint.date:range": []
        }

        ctrl.filters = {
            ...filterDefaults,
            "authors.gender": $location.search()["kön"],
            "sort_date_imprint.date:range": $location.search().intervall
                ? $location.search().intervall.split(",")
                : []
        }

        ctrl.onSliderChange = () => {
            $location.search("intervall", ctrl.filters["sort_date_imprint.date:range"].join(","))
            if (ctrl.query) ctrl.onSearchSubmit(ctrl.query)
        }

        const listKeys = _.pick($location.search(), "keywords", "languages")
        _.extend(
            ctrl.filters,
            _.mapValues(listKeys, val => val.split(","))
        )
        ctrl.filters = _.omitBy(ctrl.filters, _.isNil)
        if ($location.search().forfattare) {
            ctrl.filters["authors>authorid"] = $location.search().forfattare.split(",")
        }
        if ($location.search().authorkeyword) {
            ctrl.filters["authorkeyword>authorid"] = $location.search().authorkeyword.split(",")
        }
        const initialSelectedTitles = $location.search().titlar
            ? $location.search().titlar.split(",")
            : []
        if (initialSelectedTitles.length) {
            ctrl.selectedTitles = initialSelectedTitles
            refreshTitles()
        }

        ctrl.onAuthChange = _.once(function () {
            console.log("onAuthChange", $location.search().forfattare)
            if ($location.search().forfattare) {
                let oldVal = $location.search().forfattare.split(",")
                authors.then(() => {
                    $timeout(function () {
                        ctrl.filters["authors>authorid"] = oldVal
                        $element.find("select.author_select").val(oldVal)
                        return $element.find("select.author_select").trigger("change")
                    }, 0)
                })
            }
        })

        ctrl.onTitleChange = _.once(function () {
            console.log("onTitleChange", $location.search().titlar)
            if (initialSelectedTitles.length) {
                let oldVal = initialSelectedTitles
                authors.then(() => {
                    $timeout(function () {
                        ctrl.selectedTitles = oldVal
                        $element.find("select.title_select").val(oldVal)
                        console.log("oldVal", oldVal)
                        return $element.find("select.title_select").trigger("change")
                    }, 0)
                })
            }
        })

        if ($location.search().keyword) {
            let oldVal = $location.search().keyword.split(",")
            $timeout(function () {
                ctrl.selectedKeywords = oldVal
                console.log("selectedKeywords", ctrl.selectedKeywords)
                $element.find("select.keyword_select").val(oldVal)
                return $element.find("select.keyword_select").trigger("change")
            }, 100)
        }

        ctrl.searchData = searchData = new SearchData()

        ctrl.authorSelectSetup = getAuthorSelectSetup(ctrl, $filter)

        $timeout(() => $scope.$broadcast("focus"), 100)

        function getListener(selector, loadingFlag, countOnly) {
            let listener = function (event) {
                safeApply($scope, () => {
                    ctrl[loadingFlag] = true
                    refreshTitles(countOnly).then(() => {
                        ctrl[loadingFlag] = false
                        $timeout(() => {
                            $element
                                .find(selector)
                                .off({ "select2:opening": listener })
                                .select2("open")
                                .on("select2:opening", listener)
                        }, 0)
                    })
                })
                event.preventDefault()
            }
            return listener
        }
        $element
            .find("select.author_select")
            .on("select2:opening", getListener("select.author_select", "loadingAuthors", true))

        ctrl.onAllTitlesClick = () => {
            c.log("onAllTitlesClick")
        }
        const titleSelect = $element.find("select.title_select")
        const TITLE_LIMIT_NOTICE_ID = "_limited_title_results"
        const SHOW_ALL_TITLES_ID = "_show_all_title_results"
        const toTitleIdList = value =>
            _.compact(_.isArray(value) ? value : value ? [value] : []).filter(
                id => id !== TITLE_LIMIT_NOTICE_ID && id !== SHOW_ALL_TITLES_ID
            )
        let selectedTitleIds = toTitleIdList(ctrl.selectedTitles)
        const setCurrentTitleSelection = value => {
            selectedTitleIds = _.uniq(toTitleIdList(value))
            ctrl.selectedTitles = selectedTitleIds
            $location.search("titlar", selectedTitleIds.length ? selectedTitleIds.join(",") : null)
            return selectedTitleIds
        }
        const getCurrentTitleSelection = () => {
            const selectValue = toTitleIdList(titleSelect.val())
            return _.uniq([
                ...selectedTitleIds,
                ...toTitleIdList(ctrl.selectedTitles),
                ...selectValue
            ])
        }
        ctrl.isTitleSelected = titleId => getCurrentTitleSelection().includes(titleId)
        const syncCurrentTitleSelection = () => setCurrentTitleSelection(getCurrentTitleSelection())
        const applyCurrentTitleSelectionToSelect = () => {
            const selectedIds = getCurrentTitleSelection()
            titleSelect.val(selectedIds).trigger("change")
            setCurrentTitleSelection(selectedIds)
        }
        const scheduleTitleSelectionApply = () => {
            $timeout(() => {
                applyCurrentTitleSelectionToSelect()
                $timeout(applyCurrentTitleSelectionToSelect, 0)
            }, 0)
        }
        let latestTitleRequestId = 0
        let latestTitleFilterInput = ""
        let titleSelectOpen = false
        let activeTitleRequest = null
        const titleSearchFieldSelector = ".select2-container--open .select2-search__field"
        const abortActiveTitleRequest = () => {
            if (activeTitleRequest) {
                activeTitleRequest.abort()
                activeTitleRequest = null
            }
        }
        const syncTitleFilterInput = value => {
            latestTitleFilterInput = value || ""
            if (
                activeTitleRequest &&
                activeTitleRequest.filterstr !== latestTitleFilterInput
            ) {
                abortActiveTitleRequest()
            }
        }
        $(document).on("input.littbTitleSelect", titleSearchFieldSelector, event => {
            if (titleSelectOpen) {
                syncTitleFilterInput($(event.target).val())
            }
        })
        titleSelect.on("select2:open", () => {
            titleSelectOpen = true
            syncTitleFilterInput($(titleSearchFieldSelector).val())
        })
        titleSelect.on("select2:close", () => {
            titleSelectOpen = false
            latestTitleFilterInput = ""
            abortActiveTitleRequest()
        })
        const showAllMatchingTitles = data => {
            const filterstr =
                data.filterstr !== undefined ? data.filterstr : ctrl.titleFilterstr || ""
            ctrl.showAllTitleFilterstr = filterstr
            titleSelect.select2("close")
            $timeout(() => {
                titleSelect.select2("open")
                $(".select2-container--open .select2-search__field").val(filterstr).trigger("input")
            }, 0)
        }
        const getShowAllTitleText = filterstr =>
            filterstr
                ? `Visa alla ${ctrl.titles_hits} matchande titlar`
                : `Visa alla ${ctrl.titles_hits} titlar`
        const getTitleSelectResults = (filterstr, showAll) => {
            const results = []
            const hasLimitedTitleResults = ctrl.titles_hits > 30
            if (hasLimitedTitleResults && !showAll) {
                results.push({
                    id: TITLE_LIMIT_NOTICE_ID,
                    text: filterstr
                        ? "Visar de första 30 matchande titlarna"
                        : "Visar de första 30 titlarna",
                    disabled: true
                })
            }
            results.push(
                ...(ctrl.titles || []).map(title => ({
                    id: title.lbworkid,
                    text: title.shorttitle || title.title
                }))
            )
            if (hasLimitedTitleResults && !showAll) {
                results.push({
                    id: SHOW_ALL_TITLES_ID,
                    text: getShowAllTitleText(filterstr),
                    filterstr,
                    showAllTitles: true
                })
            }
            return results
        }
        const titleOptionsById = {}
        const getTitleOptionId = title => title && title.lbworkid
        const rememberTitleOptions = titles => {
            for (let title of titles || []) {
                const id = getTitleOptionId(title)
                if (id) {
                    titleOptionsById[id] = title
                }
            }
        }
        const keepSelectedTitleOptions = titles => {
            const selectedIds = getCurrentTitleSelection()
            if (!selectedIds.length) {
                return titles || []
            }

            const seenIds = new Set((titles || []).map(getTitleOptionId).filter(Boolean))
            const selectedTitles = selectedIds
                .map(id => titleOptionsById[id])
                .filter(title => {
                    const id = getTitleOptionId(title)
                    if (!id || seenIds.has(id)) {
                        return false
                    }
                    seenIds.add(id)
                    return true
                })
            return [...selectedTitles, ...(titles || [])]
        }
        ctrl.titleSelectSetup = {
            ajax: {
                delay: 250,
                transport(params, success, failure) {
                    let aborted = false
                    const requestId = ++latestTitleRequestId
                    const canceller = $q.defer()
                    const filterstr = (params.data && params.data.q) || ""
                    const showAll = Boolean(
                        ctrl.showAllTitleFilterstr !== undefined &&
                        filterstr === ctrl.showAllTitleFilterstr
                    )
                    const isCurrentRequest = () => {
                        if (aborted || requestId !== latestTitleRequestId) {
                            return false
                        }
                        return !titleSelectOpen || latestTitleFilterInput === filterstr
                    }
                    const abortRequest = () => {
                        if (aborted) return
                        aborted = true
                        canceller.resolve("abort")
                    }
                    activeTitleRequest = {
                        requestId,
                        filterstr,
                        abort: abortRequest
                    }
                    refreshTitles(false, filterstr, showAll, {
                        isCurrentRequest,
                        timeout: canceller.promise,
                        updateAuthorAggregation: false
                    }).then(
                        ({ stale } = {}) => {
                            if (stale || !isCurrentRequest()) return
                            success({ results: getTitleSelectResults(filterstr, showAll) })
                        },
                        error => {
                            if (aborted || !isCurrentRequest()) return
                            failure(error)
                        }
                    ).finally(() => {
                        if (activeTitleRequest && activeTitleRequest.requestId === requestId) {
                            activeTitleRequest = null
                        }
                    })

                    return {
                        abort: abortRequest
                    }
                }
            },
            templateResult(data) {
                if (!data.showAllTitles) {
                    return data.text
                }
                return $(`<span class="title-select-show-all">${data.text}</span>`)
                    .css({ display: "block", width: "100%" })
                    .on("mousedown mouseup click", event => {
                        event.preventDefault()
                        event.stopPropagation()
                        showAllMatchingTitles(data)
                    })
            },
            language: {
                errorLoading: () => "Resultaten kunde inte laddas",
                loadingMore: () => "Laddar fler resultat...",
                noResults: () => "Inga resultat",
                searching: () => "Söker..."
            }
        }
        const getSelectData = event =>
            event.params && (event.params.data || (event.params.args && event.params.args.data))
        const getSelectOriginalEvent = event =>
            event.params &&
            (event.params.originalEvent ||
                (event.params.args && event.params.args.originalEvent))
        const onTitleShowAllMouseDown = event => {
            const option = event.target.closest && event.target.closest(".select2-results__option")
            const expectedText = getShowAllTitleText(ctrl.titleFilterstr || "")
            if (!option || (option.textContent || "").trim() !== expectedText) {
                return
            }
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation()
            showAllMatchingTitles({ filterstr: ctrl.titleFilterstr || "" })
        }
        document.addEventListener("mousedown", onTitleShowAllMouseDown, true)
        $scope.$on("$destroy", () => {
            document.removeEventListener("mousedown", onTitleShowAllMouseDown, true)
            $(document).off("input.littbTitleSelect", titleSearchFieldSelector)
        })
        titleSelect.on("select2:selecting", event => {
            const data = getSelectData(event)
            if (!data || data.id !== SHOW_ALL_TITLES_ID) {
                return
            }
            event.preventDefault()
            showAllMatchingTitles(data)
        })
        titleSelect.on("select2:select", event => {
            const data = getSelectData(event)
            if (!data) {
                return
            }
            if (data.id !== SHOW_ALL_TITLES_ID) {
                const title = (ctrl.titles || []).find(title => title.lbworkid === data.id)
                rememberTitleOptions([
                    title || { lbworkid: data.id, shorttitle: data.text, title: data.text }
                ])
                setCurrentTitleSelection([...getCurrentTitleSelection(), data.id])
                return
            }
            ctrl.selectedTitles = (ctrl.selectedTitles || []).filter(
                id => id !== SHOW_ALL_TITLES_ID
            )
            titleSelect.val(ctrl.selectedTitles).trigger("change")
            showAllMatchingTitles(data)
        })
        titleSelect.on("select2:unselect", event => {
            const data = getSelectData(event)
            if (!data) {
                return
            }
            if (!getSelectOriginalEvent(event)) {
                return
            }
            setCurrentTitleSelection(getCurrentTitleSelection().filter(id => id !== data.id))
        })

        ctrl.titleChange = () => {
            let workid = null
            if (ctrl.selected_title && ctrl.selected_title.lbworkid)
                workid = ctrl.selected_title.lbworkid
            $location.search("titel", workid)
        }
        ctrl.resetView = event => {
            event.preventDefault()
            event.stopPropagation()
            $location.search("")
            $timeout(() => window.location.reload(), 0)
        }
        ctrl.isPristine = () => {
            return !Object.keys(_.omit($location.search(), "avancerad")).length
        }
        ctrl.resetAuthorFilter = function () {
            ctrl.nav_filter = null
            return searchData.resetMod().then(function ([sentsWithHeaders]) {
                ctrl.sentsWithHeaders = sentsWithHeaders
            })
        }

        ctrl.setAuthorFilter = authorid => (ctrl.nav_filter = authorid)

        ctrl.authorChange = function () {
            $location.search("titel", null)
            ctrl.selected_title = ""
        }

        ctrl.titleSort = util.titleSort

        // for the author / about author search check
        ctrl.isAuthorSearch = true

        const aboutDef = $q.defer()
        ctrl.onAboutAuthorChange = _.once(function ($event) {
            console.log("onAboutAuthorChange", ctrl.filters.authorkeyword)
            if ($location.search().authorkeyword) {
                ctrl.filters["authorkeyword>authorid"] = (
                    $location.search().authorkeyword || ""
                ).split(",")
            }
            console.log("aboutDef.resolve()")
            aboutDef.resolve()
        })
        let aboutFetchPromise = backend.getAboutAuthors()
        aboutFetchPromise.then(data => {
            console.log("aboutFetchPromise")
            ctrl.aboutAuthors = data
        })
        authors.then(function ([authorList, authorsById]) {
            if ($location.search().forfattare) {
                ctrl.authors = $location
                    .search()
                    .forfattare.split(",")
                    .map(id => authorsById[id])
            }
            return $timeout(() => {
                $element.find(".about_select,.author_select").select2()
            }, 0)
        })
        ctrl.getTitlesHits = () => ctrl.titles_hits

        function refreshTitles(countOnly, filterstr, showAll, requestOptions = {}) {
            let include = "shorttitle,title,lbworkid,authors.authorid,mediatype,searchable"
            const updateAuthorAggregation = requestOptions.updateAuthorAggregation !== false
            if (!countOnly) {
                ctrl.titleFilterstr = filterstr || ""
                if (ctrl.titleFilterstr && ctrl.titleFilterstr !== ctrl.showAllTitleFilterstr) {
                    ctrl.showAllTitleFilterstr = undefined
                }
            }
            const filtersForQuery = {
                ...ctrl.filters,
                searchable: true
            }
            console.log("ctrl.filters", ctrl.filters)
            let resultlimit = 30
            if (showAll) {
                resultlimit = ctrl.titles_hits || 10000
            }
            const filterQuery = buildFilterQuery(filtersForQuery)
            const q = composeQuery({
                filterQuery,
                filterString: filterstr || ""
            })
            return backend
                .getTitles("etext,faksimil", {
                    sort_field: "sortkey|asc",
                    include,
                    q,
                    to: countOnly ? 0 : resultlimit,
                    author_aggs: updateAuthorAggregation ? true : null,
                    timeout: requestOptions.timeout
                })
                .then(({ titles, author_aggs, hits }) => {
                    if (
                        requestOptions.isCurrentRequest &&
                        !requestOptions.isCurrentRequest()
                    ) {
                        return { stale: true }
                    }
                    syncCurrentTitleSelection()
                    rememberTitleOptions(titles)
                    ctrl.titles = keepSelectedTitleOptions(titles)
                    ctrl.titles_hits = hits
                    scheduleTitleSelectionApply()
                    if (!updateAuthorAggregation) {
                        return
                    }
                    authors.then(() => {
                        if (!ctrl.filters["authors>authorid"].length) {
                            ctrl.authors = util.sortAuthors(
                                _.map(author_aggs, item => ctrl.authorsById[item.authorid])
                            )
                        }
                    })
                })
        }

        authors.then(function ([authorList, authorsById]) {
            ctrl.authorsById = authorsById

            if ($location.search().sok_filter) {
                ctrl.nav_filter = $location.search().sok_filter
            }
            const listValIn = val => (val || "").split(",")
            const listValOut = val => {
                c.log("val", val)
                return (val || []).join(",")
            }
            util.setupHashComplex($scope, [
                {
                    key: "forfattare",
                    expr: "filters['authors>authorid']",
                    val_in: listValIn,
                    val_out: listValOut
                },
                {
                    key: "titlar",
                    expr: "selectedTitles",
                    val_in: listValIn,
                    val_out: listValOut
                },
                {
                    key: "kön",
                    expr: "filters['authors.gender']",
                    default: "all"
                },
                {
                    key: "languages",
                    expr: "filters.languages",
                    val_in: listValIn,
                    val_out: listValOut
                },
                {
                    key: "keywords",
                    expr: "filters.keywords",
                    val_in: listValIn,
                    val_out: listValOut
                },
                {
                    key: "authorkeyword",
                    expr: "filters['authorkeyword>authorid']",
                    val_in: listValIn,
                    val_out: listValOut
                },
                {
                    key: "sok_filter",
                    expr: "nav_filter",
                    post_change(authorid) {
                        if (authorid) {
                            c.log("do modifySearch", authorid)
                            ctrl.searching = true

                            const args = { from: 0, to: ctrl.num_hits - 1 }
                            args["authors"] = authorid

                            searchData.modifySearch(args).then(function ([sentsWithHeaders]) {
                                c.log("modifySearch args", arguments)
                                ctrl.searching = false
                                ctrl.sentsNavFilter = sentsWithHeaders
                            })
                        }
                    }
                }
            ])
        })

        ctrl.getSentsWithHeadersFromState = function () {
            if ($location.search().sok_filter) {
                return ctrl.sentsNavFilter
            } else {
                return ctrl.sentsWithHeaders
            }
        }

        ctrl.searching = false
        ctrl.num_hits = searchData.NUM_HITS
        ctrl.current_page = 0

        ctrl.nextPage = function () {
            ctrl.current_page++
            return ctrl.gotoPage(ctrl.current_page)
        }
        ctrl.prevPage = function () {
            if (!ctrl.current_page || ctrl.current_page === 0) {
                return
            }
            ctrl.current_page--
            ctrl.gotoPage(ctrl.current_page)
        }

        ctrl.firstPage = () => ctrl.gotoPage(0)
        ctrl.lastPage = () => ctrl.gotoPage(ctrl.total_pages - 1)

        ctrl.gotoPage = function (page) {
            if (page > ctrl.total_pages - 1) {
                return
            }
            ctrl.showGotoHitInput = false
            ctrl.current_page = page
            const from = ctrl.current_page * ctrl.num_hits
            ctrl.search(from, from + ctrl.num_hits)
        }

        ctrl.onGotoHitInput = function () {
            if (ctrl.total_pages === 1) {
                return
            }
            if (ctrl.showGotoHitInput) {
                ctrl.showGotoHitInput = false
                return
            }
            ctrl.showGotoHitInput = true
            $timeout(() => $scope.$broadcast("focus"), 0)
        }

        const getSearchArgs = function (from, to) {
            let filter_params = []

            filter_params = _.fromPairs(filter_params)

            const args = {
                query: ctrl.query,
                from,
                to
            }
            const { prefix } = $location.search()
            const { suffix } = $location.search()
            if (prefix) {
                args.prefix = true
            }
            if (suffix) {
                args.suffix = true
            }
            _.extend(args, filter_params)

            const { textFilter, keywordAux } = buildSearchFilterPayload(ctrl.filters)
            args.text_filter = textFilter
            if (keywordAux.length) {
                args.keyword_aux = keywordAux
            }

            const selectedTitleIds = getCurrentTitleSelection()
            if (selectedTitleIds.length) {
                args.work_ids = selectedTitleIds.join(",")
            } else if ($location.search().titlar) {
                args.work_ids = $location.search().titlar
            }

            if ($location.search().keyword) {
                for (let kw of $location.search().keyword.split(",")) {
                    const [key, val] = kw.split(":")
                    args.text_filter[key] = val
                }
            }

            if (!$location.search().lemma) {
                args.word_form_only = true
            }
            if ($location.search().fuzzy) {
                args.fuzzy = true
            }
            if ($location.search().ej_modern) {
                args.include_modernized = false
            }

            args.sort_field = "main_author.name_for_index.lowercase"

            return args
        }

        ctrl.getSetVal = (sent, val) => _.str.trim(sent.structs[val], "|").split("|")[0]

        ctrl.selectLeft = function (sentence) {
            if (!sentence.match) {
                return
            }
            return sentence.tokens.slice(0, sentence.match.start)
        }

        ctrl.selectMatch = function (sentence) {
            if (!sentence.match) {
                return
            }
            const from = sentence.match.start
            return sentence.tokens.slice(from, sentence.match.end)
        }

        ctrl.selectRight = function (sentence) {
            if (!sentence.match) {
                return
            }
            const from = sentence.match.end
            const len = sentence.tokens.length
            return sentence.tokens.slice(from, len)
        }

        ctrl.setPageNum = function (num) {
            c.log("setPageNum", num)
            ctrl.current_page = num
            return ctrl.search()
        }

        ctrl.getMaxHit = function () {
            if (ctrl.sentsWithHeaders?.length === 0) {
                return
            }
            return Math.min(ctrl.doc_hits, (ctrl.current_page + 1) * ctrl.num_hits)
        }

        const onKeyDown = function (event) {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                document.activeElement?.tagName === "INPUT"
            ) {
                return
            }
            return $scope.$apply(function () {
                switch (event.which) {
                    case 39:
                        if (
                            navigator.userAgent.indexOf("Firefox") !== -1 ||
                            $rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft") ===
                                $window.innerWidth
                        ) {
                            return ctrl.nextPage()
                        }
                        break
                    case 37:
                        if ($rootElement.prop("scrollLeft") === 0) {
                            return ctrl.prevPage()
                        }
                        break
                }
            })
        }

        $document.on("keydown", onKeyDown)

        $scope.$on("$destroy", () => {
            $document.off("keydown", onKeyDown)
            routeChangeUnbind()
        })

        ctrl.options = {
            sortSelected: "lastname"
        }

        ctrl.onSearchSubmit = function (query) {
            ctrl.nav_filter = null
            syncCurrentTitleSelection()
            ctrl.newSearch(query)
        }

        ctrl.searchAllInWork = (sentenceObj, index) => {
            searchData.getMoreHighlights(sentenceObj).then(function (sents) {
                let startIndex = null
                let currentSents = ctrl.getSentsWithHeadersFromState()
                // find section start index
                for (let i of _.range(index, -1)) {
                    const row = currentSents[i]
                    if (row.isHeader) {
                        startIndex = i
                        break
                    }
                }
                currentSents.splice(startIndex, index - startIndex + 1, ...sents)
            })
        }

        ctrl.newSearch = function (query) {
            if (hasSearchInit) {
                ctrl.current_page = 0
            }

            c.log("newSearch", query)
            const q = query || ctrl.query
            if (!q) {
                return
            }
            $location.search("fras", q)
            ctrl.query = q
            ctrl.pageTitle = q
            const from = ctrl.current_page * ctrl.num_hits
            // TODO: eh?
            const to = from + ctrl.num_hits - 1
            const args = getSearchArgs(from, to)
            searchData.newSearch(args)
            return ctrl.search(from, to)
        }

        ctrl.search = function (from, to) {
            ctrl.searching = true

            ctrl.from_index = from

            const def = searchData.slice(from, to)
            def.then(function ([sentsWithHeaders, author_aggs]) {
                c.log("search data slice", searchData.total_hits)

                ctrl.doc_hits = searchData.total_doc_hits
                ctrl.total_pages = Math.ceil(ctrl.doc_hits / ctrl.num_hits)

                ctrl.sentsWithHeaders = _.flatten(sentsWithHeaders)
                console.log("sentsWithHeaders:", ctrl.sentsWithHeaders)

                ctrl.searching = false
                hasSearchInit = true
            })
            $q.all([def, authors]).then(function ([[sentsWithHeaders, author_aggs]]) {
                ctrl.authorStatsData = author_aggs
            })
            return def
        }

        return util.setupHashComplex($scope, [
            {
                scope_name: "current_page",
                key: "traffsida",
                val_in(val) {
                    return Number(val) - 1
                },
                val_out(val) {
                    return val + 1
                },
                default: 1
            },
            {
                key: "avancerad",
                scope_name: "advanced"
            },
            {
                key: "fras",
                post_change(val) {
                    c.log("fras val", val)
                    if (val) {
                        return ctrl.newSearch(val)
                    }
                }
            },
            {
                key: "sok_om",
                scope_name: "isAuthorAboutSearch",
                default: false
            }
        ])
    }
}

SearchPageCtrl.$inject = [
    "$scope",
    "$element",
    "backend",
    "$location",
    "$document",
    "$window",
    "$rootElement",
    "$rootScope",
    "$q",
    "$timeout",
    "util",
    "SearchData",
    "authors",
    "debounce",
    "$filter",
    "$anchorScroll",
    "SearchStateService"
]

littb.component("searchPage", {
    templateUrl: searchUrl,
    controller: SearchPageCtrl,
    controllerAs: "$ctrl"
})
