const littb = window.littb
const _ = window._
const $ = window.$
const isDev = window.isDev
const c = window.console

littb.directive("sortList", () => ({
    restrict: "E",
    template: `
    <div>
    <div class="inline-block sc mr-2">Sortera på:</div>
    <ul class="part_header top_header mb-4 text-lg inline-block">

        <li class="inline-block sc" ng-repeat="item in sortItems[listType]" >
            <a href="" ng-click="onSortClick(item)">{{item.label}}</a>
            <i ng-show="item.active" 
               class="fa fa-arrows-v text-grey-darkest text-sm"></i>
        </li>
    </ul>
    </div>
    `
}))

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
    s.showAllParts = !!$location.search().alla_titlar
    s.showAllWorks = !!$location.search().alla_verk
    s.titleSearching = false
    s.authorSearching = true
    // s.showPopular = true
    s.showInitial = true
    s.show_more = $location.search().avancerat != null

    s.listType = $location.search().visa || "works"

    s.filters = {
        "main_author.gender": $location.search()["kön"],
        authorkeyword: [],
        keywords: [],
        languages: [],
        mediatypes: []
    }

    const listKeys = _.pick(
        $location.search(),
        "keywords",
        "languages",
        "mediatypes",
        "authorkeyword"
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

    const aboutDef = $q.defer()
    s.onAboutAuthorChange = _.once(function($event) {
        console.log("onAboutAuthorChange", s.filters.authorkeyword)
        if ($location.search().authorkeyword) {
            s.filters.authorkeyword = ($location.search().authorkeyword || "").split(",")
        }

        aboutDef.resolve()
    })

    $q.all([aboutDef.promise, authors]).then(function() {
        return $timeout(() => {
            $(".about_select").select2()
        }, 100)
    })

    // s.filterAuthor = function(author) {
    //     if (!author) return
    //     const exprs = (s.rowfilter || "").split(" ")

    //     return _.every(exprs, function(expr) {
    //         const pseudonym = _.map(author.pseudonym, "full_name").join(" ")
    //         return new RegExp(expr, "i").test(author.full_name + pseudonym)
    //     })
    // }

    // function getPopularTitles() {
    //     s.titleSearching = true
    //     backend.getTitles({ sort_field: "popularity|desc" }).then(function({ titles }) {
    //         s.titleSearching = false
    //         s.popularTitles = titles
    //         s.titleByPath = _.groupBy(titles, item => item.titlepath)

    //         return titles
    //     })
    // }

    s.resetView = function() {
        console.log("resetView")
        s.showInitial = true
        // s.showPopular = true

        s.filters = {}
        // s.about_authors_filter = []
        $timeout(() => $(".gender_select, .keyword_select, about_select").select2(), 0)
        s.filter = ""
        s.rowfilter = ""
        s.all_titles = null
        s.audio_list = null
        s.refreshData()
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

    s.titleRender = function() {
        console.log("titleRender")
        if (
            $location.search()["title"] &&
            s.titleByPath &&
            s.titleByPath[$location.search()["title"]]
        ) {
            const title = s.titleByPath[$location.search()["title"]][0]
            s.titleClick(null, title)
            const id = s.getUniqId(title)
            s.$emit("listScroll", id)
        } else {
            $location.search("title", null).replace()
        }
    }

    // use timeout to make sure the page shows before loading authors
    // $timeout () ->
    authors.then(function([authorList, authorsById]) {
        s.authorsById = authorsById
        s.authorData = _.filter(authorList, item => item.show)
        s.authorSearching = false
    })

    s.filterChange = () => {
        console.log("filterchange")
    }

    $q.all([backend.getAboutAuthors(), authors]).then(function([authorIds]) {
        s.aboutAuthors = _.orderBy(authorIds, auth => {
            if (s.authorsById[auth]) {
                return s.authorsById[auth].surname
            }
        })
    })

    // backend.getPopularAuthors().then(({ auths, hits }) => {
    //     s.popularAuthors = auths
    //     s.authHits = hits
    // })

    // , 10
    s.sort = {
        works: "popularity|desc",
        authors: "popularity|desc",
        parts: "sortkey|asc",
        audio: "title.raw|asc"
    }
    s.onSortClick = item => {
        if (item.active) {
            item.dir = item.dir == "asc" ? "desc" : "asc"
        } else {
            for (let obj of s.sortItems[s.listType]) {
                obj.active = false
            }
            item.active = true
        }
        if (item.search) {
            $location.search({ sort: item.search })
        }
        s.sort[s.listType] = item.val + "|" + item.dir

        if (s.listType == "works") {
            s.fetchWorks(false)
        } else if (s.listType == "parts") {
            s.fetchParts(false)
        } else if (s.listType == "audio") {
            fetchAudio(false)
        } else if (s.listType == "authors") {
            s.setAuthorData()
        }
        // s.refreshData()
    }
    s.sortItems = {
        works: [
            {
                label: "Titel",
                val: "sortkey",
                dir: "asc"
            },
            {
                label: "Författare",
                val: "main_author.name_for_index",
                dir: "asc"
            },
            {
                label: "Populärt",
                val: "popularity",
                dir: "desc",
                active: true
            },
            {
                label: "Kronologiskt",
                val: "sort_date.date",
                dir: "desc"
            },
            {
                label: "Tillkommet",
                // val: "imported|desc,sortfield|asc",
                val: "imported",
                dir: "desc",
                search: "nytillkommet"
            }
        ],
        authors: [
            { label: "Namn", val: "name_for_index", dir: "asc" },
            { label: "Popularitet", val: "popularity", dir: "desc" },
            { label: "Kronologiskt", val: "birth.date", dir: "asc" }
        ],
        parts: [
            {
                label: "Titel",
                val: "sortkey",
                dir: "asc",
                active: true
            },
            {
                label: "Författare",
                val: "main_author.name_for_index",
                dir: "asc"
            }
            // {
            //     label: "Populärt",
            //     val: "popularity",
            //     dir: "desc",
            //     active: true
            // },
            // {
            //     label: "Kronologiskt",
            //     val: "sort_date.date",
            //     dir: "desc"
            // }
        ],
        audio: [
            {
                label: "Titel",
                val: "title.raw",
                dir: "asc",
                active: true
            },
            {
                label: "Författare",
                val: "main_author.name_for_index",
                dir: "asc"
            },
            {
                label: "Uppläsare",
                val: "main_reader.name_for_index",
                dir: "asc"
            }
        ]
    }
    // s.sortSelectSetup = {
    //     minimumResultsForSearch: -1,
    //     templateSelection(item) {
    //         return `Sortering: ${item.text}`
    //     }
    // }
    s.refreshData = function() {
        s.selectedTitle = null
        s.rowfilter = s.filter
        if (!isDev) {
            backend.logLibrary(s.rowfilter)
        }

        s.fetchWorks(s.listType !== "works")
        s.fetchParts(s.listType !== "parts")
        fetchAudio(s.listType !== "audio")
    }
    // s.getAuthorData = function() {
    // if (s.showPopularAuth) {
    //     return s.popularAuthors
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
    // } else if (s.showInitial) {
    //     return s.authorData
    // } else {
    // return _.orderBy(
    //     _.uniq([].concat(s.currentAuthors, s.currentPartAuthors), "author_id"),
    //     "name_for_index"
    // )
    // }
    // }
    s.setAuthorData = function() {
        let [key, dir] = (s.sort.authors || "").split("|")
        console.log("setAuthorData key, dir", key, dir)
        s.authorData = _.orderBy(
            _.uniq([].concat(s.currentAuthors, s.currentPartAuthors), "author_id"),
            key || "name_for_index",
            dir || "asc"
        )
    }
    let hasActiveFilter = () => {
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)
        return _.toPairs({ ...filter_and, ...filter_or }).length
    }

    s.fetchParts = () => {
        // unless s.filter then return
        s.partSearching = true
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)

        let def = backend
            .getTitles("etext-part,faksimil-part", {
                sort_field: s.sort.parts,
                filter_string: s.rowfilter,
                filter_or,
                filter_and,
                author_aggs: true,
                partial_string: true
                // to: fix paging
            })
            // s.rowfilter, true, filter_or, filter_and, s.showAllParts ? 10000 : 30)
            .then(({ titles, hits, author_aggs }) => {
                s.all_titles = titles
                s.partSearching = false
                s.parts_hits = hits
                return { titles, hits, author_aggs }
            })
        $q.all([def, authors]).then(([{ author_aggs }]) => {
            s.currentPartAuthors = util.sortAuthors(
                author_aggs.map(({ author_id }) => s.authorsById[author_id])
            )
            s.setAuthorData()
        })
    }

    var fetchAudio = () =>
        backend
            .getAudioList({
                string_filter: s.rowfilter,
                sort_field: s.sort["audio"],
                partial_string: true
            })
            .then(titleArray => {
                if ($location.search()["kön"]) {
                    s.audio_list = _.filter(
                        titleArray,
                        audio => audio.authors[0].gender == $location.search()["kön"]
                    )
                } else {
                    s.audio_list = titleArray
                }
            })

    s.fetchWorks = countOnly => {
        let size = { from: 0, to: s.showAllWorks ? 10000 : 100 }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }
        s.titleSearching = true

        let isSearchRecent = $location.search().sort == "nytillkommet"

        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)
        // if (!_.toPairs(text_filter).length) {
        //     text_filter = null
        // }
        // const about_authors = $location.search().about_authors_filter

        const def = backend.getTitles("etext,faksimil,pdf", {
            sort_field: s.sort.works,
            filter_string: s.filter,
            include:
                "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable,imported," +
                "main_author.author_id,main_author.surname,main_author.type,startpagename,has_epub,sort_date.plain",
            filter_or,
            filter_and,
            partial_string: true,
            author_aggs: true,
            ...size
        })
        $q.all([def, authors]).then(([{ titles, author_aggs, hits }]) => {
            console.log("titleArray after all", titles)
            if (!titles.length) {
                window.gtag("event", "search-no-hits", {
                    event_category: "library",
                    event_label: s.filter
                })
            }
            s.titleByPath = _.groupBy(titles, item => item.titlepath)

            if (isSearchRecent) {
                s.titleArray = decorateRecent(titles)
            } else {
                s.titleArray = titles
            }
            s.titleHits = hits
            s.currentAuthors = util.sortAuthors(
                author_aggs.map(({ author_id }) => s.authorsById[author_id])
            )
            s.setAuthorData()

            s.titleSearching = false
        })
    }

    // s.showAllWorks = function() {
    //     s.showPopular = false
    //     s.filter = ""
    //     s.rowfilter = ""
    //     s.titleArray = null
    //     fetchWorks()
    // }

    // s.popClick = function() {
    //     s.showPopular = true
    //     if (!s.popularTitles) {
    //         getPopularTitles()
    //     }
    // }

    function decorateRecent(titles) {
        const dateFmt = function(datestr) {
            const months = `januari,februari,mars,april,maj,juni,juli,
                            augusti,september,oktober,november,december`.split(",")
            const [year, month, day] = datestr.split("-")
            return [Number(day), months[month - 1], year].join(" ")
        }

        s.titleGroups = _.groupBy(titles, "imported")

        let output = []
        for (let datestr in s.titleGroups) {
            // TODO: fix locale format, 'femte maj 2017'
            // output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
            const titles = s.titleGroups[datestr]
            output.push({ isHeader: true, label: dateFmt(datestr) })
            output = output.concat(_.sortBy(titles, ["sortfield"]))
        }
        return output
    }

    // s.fetchRecent = function() {
    //     s.filter = ""
    //     s.rowfilter = ""
    //     s.titleArray = null

    //     s.titleSearching = true
    //     return backend
    //         .getTitles("etext,faksimil,pdf", {
    //             sort_field: "imported|asc,sortfield|asc",
    //             include: workInclude + ","
    //         })
    //         .then(function({ titles, hits }) {
    //             s.titleSearching = false
    //             s.titleHits = hits

    //             s.titleArray = output
    //         })
    // }

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

    if ($location.search().filter) {
        s.filter = $location.search().filter
    }
    // if $location.search().keyword
    //     s.selectedKeywords = $location.search().keyword?.split(",")

    s.refreshData()

    const listValIn = val => (val || "").split(",")
    const listValOut = val => {
        return (val || []).join(",")
    }
    util.setupHashComplex(s, [
        {
            key: "filter",
            // scope_name : "rowfilter"
            replace: false
        },
        // {
        //     key: "nytillkommet",
        //     scope_name: "showRecent"
        // },
        {
            key: "kön",
            expr: "filters['main_author.gender']",
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
            key: "mediatypes",
            expr: "filters.mediatypes",
            val_in: listValIn,
            val_out: listValOut
        },
        {
            key: "about_authors",
            expr: "filters.authorkeyword",
            val_in: listValIn,
            val_out: listValOut
        },
        {
            key: "avancerat",
            expr: "show_more"
        },
        {
            key: "alla_titlar",
            expr: "showAllParts"
        },
        {
            key: "alla_verk",
            expr: "showAllWorks"
        },
        {
            key: "visa",
            expr: "listType",
            default: "works"
        }
        // {
        // key: "sortering",
        // expr: "sort"
        // default : "popularity|desc"
        // }
    ])

    // s.listVisibleTitles = function() {
    //     if (s.showInitial && s.showPopular) {
    //         return s.popularTitles
    //     } else {
    //         return s.titleArray
    //     }
    // }
})
