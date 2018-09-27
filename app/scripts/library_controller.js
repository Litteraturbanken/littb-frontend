const littb = window.littb
const _ = window._
const $ = window.$
const isDev = window.isDev
const c = window.console

function detectIE() {
    const ua = window.navigator.userAgent

    const msie = ua.indexOf("MSIE ")
    if (msie > 0) {
        // IE 10 or older => return version number
        return parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)), 10)
    }

    const trident = ua.indexOf("Trident/")
    if (trident > 0) {
        // IE 11 => return version number
        const rv = ua.indexOf("rv:")
        return parseInt(ua.substring(rv + 3, ua.indexOf(".", rv)), 10)
    }

    const edge = ua.indexOf("Edge/")
    if (edge > 0) {
        // Edge (IE 12+) => return version number
        return parseInt(ua.substring(edge + 5, ua.indexOf(".", edge)), 10)
    }

    // other browser
    return false
}

littb.controller("libraryCtrl", function(
    $scope,
    backend,
    util,
    $timeout,
    $location,
    authors,
    $rootElement,
    $anchorScroll,
    $q,
    $filter
) {
    const s = $scope
    s.titleSearching = false
    s.authorSearching = true
    s.showPopular = true
    s.showPopularAuth = true
    s.showInitial = true
    s.show_more = $location.search().avancerat != null
    s.filters = {
        "main_author.gender": $location.search()["kön"],
        about_authors: [],
        keywords: [],
        languages: [],
        mediatypes: []
    }

    const listKeys = _.pick(
        $location.search(),
        "keywords",
        "languages",
        "mediatypes",
        "about_authors"
    )
    _.extend(s.filters, _.mapValues(listKeys, val => val.split(",")))
    s.filters = _.omitBy(s.filters, _.isNil)

    s.normalizeAuthor = $filter("normalizeAuthor")

    s.getTitleTooltip = function(attrs) {
        if (!attrs) {
            return
        }
        if (attrs.showtitle !== attrs.title) {
            return attrs.title
        }
    }

    s.filterTitle = function(row) {
        const auths = _.map(row.authors, auth => auth.full_name).join(" ")

        const exprs = s.rowfilter.split(" ")

        return _.every(exprs, expr =>
            new RegExp(expr, "i").test(
                row.itemAttrs.title +
                    " " +
                    row.itemAttrs.shorttitle +
                    " " +
                    auths +
                    " " +
                    row.itemAttrs.imprintyear +
                    " "
            )
        )
    }

    const isIE = detectIE()
    c.log("isIE", isIE)

    if (isIE && isIE < 12) {
        s.rowLimit = 30
    }

    backend.getAboutAuthors().then(function(data) {
        s.aboutAuthors = data
    })

    const aboutDef = $q.defer()
    s.onAboutAuthorChange = _.once(function($event) {
        console.log("onAboutAuthorChange", s.filters.about_authors)
        if ($location.search().about_authors) {
            s.filters.about_authors = ($location.search().about_authors || "").split(",")
        }
        return aboutDef.resolve()
    })

    $q.all([aboutDef.promise, authors]).then(function() {
        return $timeout(() => $(".about_select").select2(), 100)
    })

    // s.filterAuthor = function(author) {
    //     if (!author) return
    //     const exprs = (s.rowfilter || "").split(" ")

    //     return _.every(exprs, function(expr) {
    //         const pseudonym = _.map(author.pseudonym, "full_name").join(" ")
    //         return new RegExp(expr, "i").test(author.full_name + pseudonym)
    //     })
    // }

    function getPopularTitles() {
        s.titleSearching = true
        backend.getTitles(null, "popularity|desc").then(function({ titles }) {
            s.titleSearching = false
            s.popularTitles = titles
            s.titleByPath = _.groupBy(titles, item => item.titlepath)

            return titles
        })
    }

    s.resetView = function() {
        console.log("resetView")
        s.showInitial = true
        s.showPopularAuth = true
        s.showPopular = true
        s.showRecent = false

        s.filters = {}
        // s.about_authors_filter = []
        $timeout(() => $(".gender_select, .keyword_select, about_select").select2(), 0)
        s.filter = ""
        s.rowfilter = ""
        s.all_titles = null
        s.audio_list = null

        if (!s.popularTitles) {
            console.log("getPopularTitles")
            getPopularTitles()
        }
    }

    s.hasMediatype = function(titleobj, mediatype) {
        return _.map(titleobj.mediatypes, "label").includes(mediatype)
    }

    s.pickMediatypes = (titleobj, mediatypeLabels) =>
        _.filter(titleobj.mediatypes, item => mediatypeLabels.includes(item.label))

    s.sortMedia = function(list) {
        const order = ["etext", "faksimil", "epub", "pdf"]
        // first keep the keys in the order list, then readd the ones that weren't there.
        return _.intersection(order, list).concat(_.difference(list, order))
    }

    s.getTitleId = row => row.work_title_id

    s.getUniqId = function(title) {
        if (!title) {
            return
        }
        return title.lbworkid + (title.titlepath.split("/")[1] || "")
    }

    s.authorRender = function() {
        if ($location.search()["author"]) {
            const auth = s.authorsById[$location.search()["author"]]
            s.authorClick(null, auth)

            s.$emit("listScroll", $location.search()["author"])
        }
    }

    s.titleRender = function() {
        if ($location.search()["title"] && s.titleByPath) {
            const title = s.titleByPath[$location.search()["title"]][0]
            s.titleClick(null, title)
            const id = s.getUniqId(title)
            s.$emit("listScroll", id)
        }
    }

    // use timeout to make sure the page shows before loading authors
    // $timeout () ->
    authors.then(function([authorList, authorsById]) {
        s.authorsById = authorsById
        s.authorData = _.filter(authorList, item => item.show)
        s.authorSearching = false
    })

    backend.getPopularAuthors().then(auths => (s.popularAuthors = auths))

    // , 10

    s.getAuthorData = function() {
        if (s.showPopularAuth) {
            return s.popularAuthors
            // else
            //     filters = getKeywordTextfilter()
            //     if _.toPairs(filters).length
            //         return _.filter s.authorData, (auth) ->
            //             conds = []
            //             if filters['provenance.library'] == "Dramawebben"
            //                 conds.push(auth.dramaweb?)

            //             if filters['main_author.gender']
            //                 conds.push(auth.gender == filters['main_author.gender'])

            //             return _.every conds
        } else if (s.showInitial) {
            return s.authorData
        } else {
            // s.authorData
            return s.currentAuthors
        }
    }
    let hasActiveFilter = () => {
        let { filter_or, filter_and } = getKeywordTextfilter()
        return _.toPairs({ ...filter_and, ...filter_or }).length
    }
    s.searchTitle = function() {
        c.log("searchTitle", s.filter)
        s.selectedAuth = null
        s.selectedTitle = null
        s.rowfilter = s.filter
        // if s.rowfilter or _.toPairs(getKeywordTextfilter()).length
        if (s.rowfilter || hasActiveFilter() || $location.search().about_authors_filter) {
            s.showInitial = false
            s.showPopularAuth = false
            s.showPopular = false
            s.fetchTitles()
            if (s.rowfilter) {
                fetchAudio()
            }
            fetchWorks()
            // if not (_.toPairs(getKeywordTextfilter()).length or s.about_authors_filter?.length)
            //     fetchAudio()
            if (!isDev) {
                backend.logLibrary(s.rowfilter)
            }
        } else {
            s.resetView()
        }
    }

    s.fetchTitles = () => {
        // unless s.filter then return
        s.partSearching = true
        let { filter_or, filter_and } = getKeywordTextfilter()
        backend
            .getParts(s.rowfilter, true, filter_or, filter_and, s.showAllParts ? 10000 : 30)
            .then(({ titleArray, hits }) => {
                s.all_titles = titleArray
                s.partSearching = false
                s.parts_hits = hits
            })
    }

    var fetchAudio = () =>
        backend
            .getAudioList({
                string_filter: s.rowfilter,
                sort_field: "title.raw|asc",
                partial_string: true
            })
            .then(titleArray => (s.audio_list = titleArray))

    var getKeywordTextfilter = function() {
        // sample
        // {
        //     gender: "main_author.gender:female",
        //     keywords: ["provenance.library:Dramawebben"],
        //     about_authors: ["StrindbergA"],
        //     languages: {
        //         "modernized:true": "modernized:true",
        //         "proofread:true": "proofread:true",
        //         "language:deu": "language:deu"
        //     },
        //     mediatypes: ["has_epub:true", "mediatype:faksimil"]
        // }

        if (s.filters["main_author.gender"] === "all") {
            delete s.filters["main_author.gender"]
        }
        function makeObj(list) {
            let output = {}
            for (let kw of list || []) {
                const [key, val] = kw.split(":")
                if (output[key]) {
                    output[key].push(val)
                } else {
                    output[key] = [val]
                }
            }
            return output
        }
        const rest = _.omit(s.filters, "keywords", "languages", "mediatypes", "about_authors")
        const filter_or = makeObj(s.filters.mediatypes)
        const filter_and = _.extend(
            rest,
            makeObj(s.filters.languages),
            makeObj(s.filters.keywords),
            makeObj(s.filters.about_authors)
        )
        return { filter_or, filter_and }
    }

    function fetchWorks() {
        s.titleSearching = true
        const include =
            "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable" +
            "authors.author_id,work_authors.author_id,authors.surname,authors.type,startpagename,has_epub"
        let { filter_or, filter_and } = getKeywordTextfilter()
        // if (!_.toPairs(text_filter).length) {
        //     text_filter = null
        // }
        // const about_authors = $location.search().about_authors_filter

        const def = backend.getTitles(
            null, // authors
            null,
            s.filter,
            // !!about_authors,
            false,
            true, // parial string
            include,
            filter_or,
            filter_and,
            true // author_aggs
        )
        $q.all([def, authors]).then(([{ titles, author_aggs }]) => {
            console.log("titleArray after all", titles)

            s.titleArray = titles
            s.currentAuthors = util.sortAuthors(
                author_aggs.map(({ author_id }) => s.authorsById[author_id])
            )

            s.titleByPath = _.groupBy(titles, item => item.titlepath)
            s.titleSearching = false
        })
    }

    s.showAllWorks = function() {
        s.showPopular = false
        s.showRecent = false
        s.filter = ""
        s.rowfilter = ""
        s.titleArray = null
        fetchWorks()
    }

    s.popClick = function() {
        s.showRecent = false
        s.showPopular = true
        if (!s.popularTitles) {
            getPopularTitles()
        }
    }

    s.fetchRecent = function() {
        s.showPopular = false
        s.showRecent = true
        s.filter = ""
        s.rowfilter = ""
        s.titleArray = null

        const dateFmt = function(datestr) {
            const months = `januari,februari,mars,april,maj,juni,juli,
                            augusti,september,oktober,november,december`.split(",")
            const [year, month, day] = datestr.split("-")
            return [Number(day), months[month - 1], year].join(" ")
        }

        s.titleSearching = true
        return backend
            .getTitles(null, "imported|desc,sortfield|asc", null, false, true)
            .then(function(titleArray) {
                s.titleSearching = false
                s.titleGroups = _.groupBy(titleArray, "imported")

                let output = []
                for (let datestr in s.titleGroups) {
                    // TODO: fix locale format, 'femte maj 2017'
                    // output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
                    const titles = s.titleGroups[datestr]
                    output.push({ isHeader: true, label: dateFmt(datestr) })
                    output = output.concat(_.sortBy(titles, ["sortfield"]))
                }

                s.titleArray = output
            })
    }

    s.getUrl = function(row, mediatype) {
        const author_id = row.authors[0].workauthor || row.authors[0].author_id

        if (mediatype === "epub") {
            return `txt/epub/${author_id}_${row.work_title_id}.epub`
        } else if (mediatype === "pdf") {
            return `txt/${row.lbworkid}/${row.lbworkid}.pdf`
        } else {
            return (
                `/forfattare/${author_id}/titlar/${s.getTitleId(row)}/` +
                `sida/${row.startpagename}/${mediatype}`
            )
        }
    }

    s.authorClick = function($event, author) {
        if (s.selectedAuth !== author) {
            if (s.selectedAuth != null) {
                s.selectedAuth._collapsed = false
            }
        }

        s.selectedAuth = author

        $location.search("author", author.author_id)
        author._infoSearching = true
        backend.getAuthorInfo(author.author_id).then(function(data) {
            author._collapsed = true
            author.data = data
            author._infoSearching = false
        })
    }

    s.authorHeaderClick = function($event, author) {
        if (s.selectedAuth === author && author._collapsed) {
            author._collapsed = false
            if ($event) $event.stopPropagation()
        }
    }

    s.titleHeaderClick = function($event, title) {
        if (s.selectedTitle === title && title._collapsed) {
            title._collapsed = false
            if ($event) $event.stopPropagation()
        }
    }

    s.titleClick = function($event, title) {
        if (s.selectedTitle !== title) {
            if (s.selectedTitle != null) {
                s.selectedTitle._collapsed = false
            }
        }

        s.selectedTitle = title
        s.selectedTitle._collapsed = true
        $location.search("title", title.titlepath)
    }

    s.getPartAuthor = part =>
        (part.authors != null ? part.authors[0] : undefined) || part.work_authors[0]

    if ($location.search().nytillkommet) {
        s.fetchRecent()
    } else {
        if ($location.search().filter) {
            s.filter = $location.search().filter
        }
        s.searchTitle()
    }
    // if $location.search().keyword
    //     s.selectedKeywords = $location.search().keyword?.split(",")

    util.setupHashComplex(s, [
        {
            key: "filter",
            // scope_name : "rowfilter"
            replace: false
        },
        {
            key: "nytillkommet",
            scope_name: "showRecent"
        },
        {
            key: "kön",
            expr: "filters['main_author.gender']",
            default: "all"
        },
        {
            key: "languages",
            expr: "filters.languages",
            val_in(val) {
                return (val || "").split(",")
            },
            val_out(val) {
                return (val || []).join(",")
            }
        },
        {
            key: "keywords",
            expr: "filters.keywords",
            val_in(val) {
                return (val || "").split(",")
            },
            val_out(val) {
                return (val || []).join(",")
            }
        },
        {
            key: "mediatypes",
            expr: "filters.mediatypes",
            val_in(val) {
                return (val || "").split(",")
            },
            val_out(val) {
                return (val || []).join(",")
            }
        },
        {
            key: "about_authors",
            expr: "filters.about_authors",
            val_in(val) {
                return (val || "").split(",")
            },
            val_out(val) {
                return (val || []).join(",")
            }
        },
        {
            key: "avancerat",
            expr: "show_more"
        }
    ])

    s.listVisibleTitles = function() {
        if (s.showInitial && s.showPopular) {
            return s.popularTitles
        } else {
            return s.titleArray
        }
    }
})
