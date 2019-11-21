const _ = window._
const $ = window.$
const c = window.console
const littb = window.littb
const safeApply = window.safeApply

const getAuthorSelectSetup = (s, $filter) => ({
    templateResult(data) {
        if (!data.id) {
            return
        }
        // return data.text
        const author = s.authorsById[data.id]
        // TODO This shouldn't happen
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
        if (!s.authorsById || !item.id) return
        return s.authorsById[item.id].surname
    }
    // item.text
})

littb.controller("searchCtrl", function(
    $scope,
    backend,
    $location,
    $document,
    $window,
    $rootElement,
    $q,
    $timeout,
    util,
    SearchData,
    authors,
    debounce,
    $filter,
    $anchorScroll
) {
    let searchData
    const s = $scope
    s.open = true
    let hasSearchInit = false
    s.auth_select_rendered = false
    s.onAuthSelectRender = function() {
        c.log("onAuthSelectRender")
        s.auth_select_rendered = true
    }
    s.onKeywordChange = () => {}
    // s.selectedAuthors = []
    s.selectedTitles = []
    s.selectedKeywords = []

    s.filters = {
        "authors.gender": $location.search()["kön"],
        authorkeyword: [],
        keywords: [],
        languages: [],
        "authors>authorid": [],
        "sort_date_imprint.date:range": $location.search().intervall
            ? $location.search().intervall.split(",")
            : []
    }

    s.onSliderChange = () => {
        $location.search("intervall", s.filters["sort_date_imprint.date:range"].join(","))
    }

    const listKeys = _.pick($location.search(), "keywords", "languages", "authorkeyword")
    _.extend(s.filters, _.mapValues(listKeys, val => val.split(",")))
    s.filters = _.omitBy(s.filters, _.isNil)
    if ($location.search().forfattare) {
        s.filters["authors>authorid"] = $location.search().forfattare.split(",")
    }
    if ($location.search().titlar) {
        s.selectedTitles = $location.search().titlar.split(",")
        refreshTitles()
    }

    s.onAuthChange = _.once(function() {
        console.log("onAuthChange", $location.search().forfattare)
        if ($location.search().forfattare) {
            let oldVal = $location.search().forfattare.split(",")
            authors.then(() => {
                $timeout(function() {
                    s.filters["authors>authorid"] = oldVal
                    // s.selectedAuthors = oldVal
                    $("select.author_select").val(oldVal)
                    return $("select.author_select").trigger("change")
                }, 0)
            })
        }
    })

    s.onTitleChange = _.once(function() {
        console.log("onTitleChange", $location.search().titlar)
        if ($location.search().titlar) {
            let oldVal = $location.search().titlar.split(",")
            authors.then(() => {
                $timeout(function() {
                    s.selectedTitles = oldVal
                    $("select.title_select").val(oldVal)
                    console.log("oldVal", oldVal)
                    return $("select.title_select").trigger("change")
                }, 0)
            })
        }
    })

    if ($location.search().keyword) {
        let oldVal = $location.search().keyword.split(",")
        $timeout(function() {
            s.selectedKeywords = oldVal
            console.log("selectedKeywords", s.selectedKeywords)
            $("select.keyword_select").val(oldVal)
            return $("select.keyword_select").trigger("change")
        }, 100)
    }

    s.searchData = searchData = new SearchData()

    s.authorSelectSetup = getAuthorSelectSetup(s, $filter)

    $timeout(() => s.$broadcast("focus"), 100)

    function getListener(selector, loadingFlag, countOnly) {
        let listener = function(event) {
            safeApply(s, () => {
                s[loadingFlag] = true
                refreshTitles(countOnly).then(() => {
                    s[loadingFlag] = false
                    $timeout(() => {
                        $(selector)
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
    $("select.title_select").on(
        "select2:opening",
        getListener("select.title_select", "loadingTitles", false)
    )
    $("select.author_select").on(
        "select2:opening",
        getListener("select.author_select", "loadingAuthors", true)
    )

    s.onAllTitlesClick = () => {
        c.log("onAllTitlesClick")
    }
    s.titleSelectSetup = {
        language: {
            noResults: () => "Inga resultat"
        }
    }

    s.titleChange = () => {
        // $location.search("titel", s.selected_title?.work_titleid or null)
        let workid = null
        if (s.selected_title && s.selected_title.lbworkid) workid = s.selected_title.lbworkid
        $location.search("titel", workid)
    }

    s.resetAuthorFilter = function() {
        s.nav_filter = null
        return searchData.resetMod().then(function([sentsWithHeaders]) {
            // s.kwic = kwic
            s.sentsWithHeaders = sentsWithHeaders
        })
    }

    s.setAuthorFilter = authorid => (s.nav_filter = authorid)

    s.authorChange = function() {
        $location.search("titel", null)
        s.selected_title = ""
    }

    s.titleSort = util.titleSort

    // for the author / about author search check
    s.isAuthorSearch = true

    const aboutDef = $q.defer()
    s.onAboutAuthorChange = _.once(function($event) {
        console.log("onAboutAuthorChange", s.filters.authorkeyword)
        if ($location.search().authorkeyword) {
            s.filters.authorkeyword = ($location.search().authorkeyword || "").split(",")
        }
        console.log("aboutDef.resolve()")
        aboutDef.resolve()
    })
    let aboutFetchPromise = backend.getAboutAuthors()
    aboutFetchPromise.then(data => {
        console.log("aboutFetchPromise")
        s.aboutAuthors = data
    })
    // $q.all([aboutFetchPromise, aboutDef.promise, authors]).then(function() {
    authors.then(function([authorList, authorsById]) {
        if ($location.search().forfattare) {
            s.authors = $location
                .search()
                .forfattare.split(",")
                .map(id => authorsById[id])
        }
        return $timeout(() => {
            $(".about_select,.author_select").select2()
        }, 0)
    })
    s.getTitlesHits = () => s.titles_hits

    function refreshTitles(countOnly, filterstr) {
        let include = "shorttitle,title,lbworkid,authors.authorid,mediatype,searchable"
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)
        // s.loadingTitles = true
        let resultlimit = s.filters["authors>author_id"].length ? 10000 : 30
        return backend
            .getTitles("etext,faksimil", {
                sort_field: "sortkey|asc",
                include,
                filter_or,
                filter_and: { searchable: true, ...filter_and },
                to: countOnly ? 0 : resultlimit,
                filter_string: filterstr || "",
                author_aggs: true
            })
            .then(({ titles, author_aggs, hits }) => {
                // s.loadingTitles = false
                s.titles = titles
                s.titles_hits = hits
                authors.then(() => {
                    if (!s.filters["authors>authorid"].length) {
                        s.authors = util.sortAuthors(
                            _.map(author_aggs, item => s.authorsById[item.authorid])
                        )
                    }
                })
            })
    }

    authors.then(function([authorList, authorsById]) {
        s.authorsById = authorsById

        if ($location.search().sok_filter) {
            s.nav_filter = $location.search().sok_filter
        }
        const listValIn = val => (val || "").split(",")
        const listValOut = val => {
            c.log("val", val)
            return (val || []).join(",")
        }
        util.setupHashComplex(s, [
            {
                key: "forfattare",
                // expr : "selected_author.pseudonymfor || selected_author.authorid"
                expr: "filters['authors>authorid']",
                val_in: listValIn,
                val_out: listValOut
                // post_change: change
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
                // post_change: refreshTitles
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
                // post_change: refreshTitles
            },
            {
                key: "authorkeyword",
                expr: "filters.authorkeyword",
                val_in: listValIn,
                val_out: listValOut
                // post_change: refreshTitles
            },
            {
                key: "sok_filter",
                expr: "nav_filter",
                post_change(authorid) {
                    if (authorid) {
                        c.log("do modifySearch", authorid)
                        s.searching = true

                        const args = { from: 0, to: s.num_hits - 1 }
                        // if (s.isAuthorAboutSearch) {
                        //     args["about_authors"] = authorid
                        // } else {
                        // }
                        // args["author"] = authorid
                        args["authors"] = authorid

                        searchData.modifySearch(args).then(function([sentsWithHeaders]) {
                            c.log("modifySearch args", arguments)
                            s.searching = false
                            s.sentsNavFilter = sentsWithHeaders
                        })
                    }
                }
            }
        ])
    })

    s.getSentsWithHeadersFromState = function() {
        if ($location.search().sok_filter) {
            return s.sentsNavFilter
        } else {
            return s.sentsWithHeaders
        }
    }

    s.searching = false
    s.num_hits = searchData.NUM_HITS
    s.current_page = 0

    s.nextPage = function() {
        // if (s.current_page  * s.num_hits) + s.kwic.length < s.doc_hits
        s.current_page++
        return s.gotoPage(s.current_page)
    }
    s.prevPage = function() {
        if (!s.current_page || s.current_page === 0) {
            return
        }
        s.current_page--
        s.gotoPage(s.current_page)
    }

    s.firstPage = () => s.gotoPage(0)
    s.lastPage = () => s.gotoPage(s.total_pages - 1)

    s.gotoPage = function(page) {
        if (page > s.total_pages - 1) {
            return
        }
        s.showGotoHitInput = false
        s.current_page = page
        // n_rows = Math.ceil($(evt.currentTarget).height() / rowHeight)
        // $(".table_viewport").scrollTop(s.getRowHeight() * page)
        const from = s.current_page * s.num_hits
        s.search(from, from + s.num_hits)
    }

    s.onGotoHitInput = function() {
        if (s.total_pages === 1) {
            return
        }
        if (s.showGotoHitInput) {
            s.showGotoHitInput = false
            return
        }
        s.showGotoHitInput = true
        $timeout(() => s.$broadcast("focus"), 0)
    }

    const getSearchArgs = function(from, to) {
        let filter_params = []

        filter_params = _.fromPairs(filter_params)

        const args = {
            query: s.query,
            // mediatype: getMediatypes()
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

        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)
        args.text_filter = { ...filter_or, ...filter_and }

        if ($location.search().titlar) {
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

        return args
    }

    s.getSetVal = (sent, val) => _.str.trim(sent.structs[val], "|").split("|")[0]

    s.selectLeft = function(sentence) {
        if (!sentence.match) {
            return
        }
        return sentence.tokens.slice(0, sentence.match.start)
    }

    s.selectMatch = function(sentence) {
        if (!sentence.match) {
            return
        }
        const from = sentence.match.start
        return sentence.tokens.slice(from, sentence.match.end)
    }

    s.selectRight = function(sentence) {
        if (!sentence.match) {
            return
        }
        const from = sentence.match.end
        const len = sentence.tokens.length
        return sentence.tokens.slice(from, len)
    }

    s.setPageNum = function(num) {
        c.log("setPageNum", num)
        s.current_page = num
        return s.search()
    }

    s.getMaxHit = function() {
        if (!(searchData.data && searchData.data.length)) {
            return
        }
        return Math.min(s.doc_hits, (s.current_page + 1) * s.num_hits)
    }

    const onKeyDown = function(event) {
        if (event.metaKey || event.ctrlKey || event.altKey || $("input:focus").length) {
            return
        }
        return s.$apply(function() {
            switch (event.which) {
                case 39:
                    if (
                        navigator.userAgent.indexOf("Firefox") !== -1 ||
                        $rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft") ===
                            $($window).width()
                    ) {
                        return s.nextPage()
                    }
                    break
                case 37:
                    if ($rootElement.prop("scrollLeft") === 0) {
                        return s.prevPage()
                    }
                    break
            }
        })
    }

    $document.on("keydown", onKeyDown)

    s.$on("$destroy", () => $document.off("keydown", onKeyDown))

    s.options = {
        sortSelected: "lastname"
    }

    s.onSearchSubmit = function(query) {
        $anchorScroll("results")
        // s.resetAuthorFilter()
        s.nav_filter = null
        s.newSearch(query)
    }

    s.searchAllInWork = (sentenceObj, index) => {
        searchData.getMoreHighlights(sentenceObj).then(function(sents) {
            let startIndex = null
            // find section start index
            for (let i of _.range(index, -1)) {
                const row = s.sentsWithHeaders[i]
                if (row.isHeader) {
                    startIndex = i
                    break
                }
            }

            console.log("startIndex", startIndex)
            s.sentsWithHeaders.splice(startIndex, index - startIndex + 1, ...sents)
        })
    }

    s.newSearch = function(query) {
        if (hasSearchInit) {
            s.current_page = 0
        }

        c.log("newSearch", query)
        const q = query || s.query
        if (!q) {
            return
        }
        $location.search("fras", q)
        s.query = q
        s.pageTitle = q
        const from = s.current_page * s.num_hits
        // TODO: eh?
        const to = from + s.num_hits - 1
        const args = getSearchArgs(from, to)
        searchData.newSearch(args)
        return s.search(from, to)
    }

    // s.search = debounce((query, from, to) ->
    s.search = function(from, to) {
        s.searching = true

        // const args = getSearchArgs(from, to)
        s.from_index = from

        // def = backend.searchWorks(args)
        const def = searchData.slice(from, to)
        def.then(function([sentsWithHeaders, author_aggs]) {
            c.log("search data slice", searchData.total_hits)

            s.doc_hits = searchData.total_doc_hits
            s.total_pages = Math.ceil(s.doc_hits / s.num_hits)

            s.sentsWithHeaders = _.flatten(sentsWithHeaders)

            s.searching = false
            hasSearchInit = true
        })
        $q.all([def, authors]).then(function([[sentsWithHeaders, author_aggs]]) {
            s.authorStatsData = _.orderBy(
                author_aggs,
                auth => s.authorsById[auth.authorid].name_for_index
            )
        })
        return def
    }

    return util.setupHashComplex(s, [
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
                    return s.newSearch(val)
                }
            }
        },
        {
            key: "sok_om",
            scope_name: "isAuthorAboutSearch",
            default: false
        }
    ])
})
