const littb = window.littb
const _ = window._
const $ = window.$
const isDev = window.isDev
const c = window.console

littb.directive("sortList", () => ({
    restrict: "E",
    template: `
    <div>
    <div class="inline-block sc mr-2">Sortera: </div>
    <ul class="part_header top_header mb-4 text-lg inline-block">

        <li class="inline-block sc" ng-repeat="item in sortItems[listType]" >
            <a class="sort_item" href="" ng-click="onSortClick(item)" 
                ng-class="{active : item.active}">{{item.label}}</a>
                <i class="fa fa-caret-down" ng-show="item.active && !item.reversed"></i>
                <i class="fa fa-caret-up" ng-show="item.active && item.reversed"></i>
                
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
    s.filter = $location.search().filter || ""
    s.showAllParts = !!$location.search().alla_titlar
    // s.showAllWorks = !!$location.search().alla_verk
    s.worksListURL = require("../views/library/works_list.html")
    s.titleSearching = false
    s.authorSearching = true
    // s.showPopular = true
    s.showInitial = true
    s.show_more = $location.search().avancerat != null
    s.show_dl = $location.search().avancerat != null
    s.parts_currentpage = 1

    s.listType = $location.search().visa || "works"
    console.log("listType init", s.listType)

    s.authLimit = 150

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

    s.currentAuthors = []
    s.currentPartAuthors = []
    s.currentAudioAuthors = []

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
        if (s.listType == "epub") {
            return
        }
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
        // s.authorData = _.filter(authorList, item => item.show)
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

    s.sort = {
        works: "popularity|desc",
        epub: "popularity|desc",
        authors: "popularity|desc",
        parts: "sortkey|asc",
        audio: "title.raw|asc"
    }

    s.sortItems = {
        works: [
            {
                label: "Författare",
                val: "main_author.name_for_index",
                suffix: ",sortkey|asc",
                dir: "asc",
                search: "forfattare"
            },
            {
                label: "Titel",
                val: "sortkey",
                dir: "asc",
                search: "titlar"
            },
            {
                label: "Populärt",
                val: "popularity",
                dir: "desc",
                active: true,
                search: "popularitet"
            },
            {
                label: "Tryckår",
                val: "sort_date_imprint.date",
                dir: "desc",
                search: "kronologi"
            },
            {
                label: "Nytt",
                val: "imported",
                dir: "desc",
                search: "nytillkommet"
            }
        ],
        authors: [
            {
                label: "Namn",
                val: "name_for_index",
                dir: "asc",
                search: "namn"
            },
            {
                label: "Populärt",
                val: "popularity",
                dir: "desc",
                search: "popularitet",
                active: true
            },
            {
                label: "Årtal",
                val: "birth.date",
                dir: "asc",
                search: "kronologi"
            }
        ],
        parts: [
            {
                label: "Författare",
                val: "main_author.name_for_index",
                dir: "asc"
            },
            {
                label: "Titel",
                val: "sortkey",
                dir: "asc",
                active: true
            }
        ],
        audio: [
            {
                label: "Författare",
                val: "main_author.name_for_index",
                dir: "asc"
            },
            {
                label: "Titel",
                val: "title.raw",
                dir: "asc",
                active: true
            },
            {
                label: "Uppläsare",
                val: "main_reader.name_for_index",
                dir: "asc"
            }
        ]
    }
    s.sortItems["epub"] = _.cloneDeep(s.sortItems.works)

    s.refreshData = function() {
        s.selectedTitle = null
        s.rowfilter = s.filter
        if (!isDev) {
            backend.logLibrary(s.rowfilter)
        }

        s.fetchWorks(s.listType !== "works", false)
        s.fetchWorks(s.listType !== "epub", true)
        s.fetchParts(s.listType !== "parts")
        // fetchAudio(s.listType !== "audio")
    }
    s.capitalizeLabel = label => {
        return { pdf: "PDF", xml: "XML" }[label] || label
    }
    s.setAuthorData = function() {
        console.log("setAuthorData", s.listType)
        let [key, dir] = (s.sort.authors || "").split("|")
        console.log("key, dir", key, dir)
        let authors = [].concat(s.currentAuthors, s.currentPartAuthors, s.currentAudioAuthors)

        // if (s.filters["main_author.gender"]) {
        //     authors = authors.filter(item => item.gender == s.filters["main_author.gender"])
        // }

        authors = authors.filter(item => {
            let conds = []
            if (s.filters["main_author.gender"]) {
                conds.push(item.gender == s.filters["main_author.gender"])
            }
            if (s.filter) {
                conds.push(
                    s.filter
                        .split(" ")
                        .map(str => {
                            let search =
                                item.name_for_index + _.map(item.pseudonym, "full_name").join(" ")
                            return search.match(new RegExp(str, "i"))
                        })
                        .some(Boolean)
                )
            }
            return conds.every(Boolean)
        })

        authors = _.uniq(authors, "author_id")
        if (key == "name_for_index") {
            s.authorData = util.sortAuthors(authors, dir)
        } else {
            s.authorData = _.orderBy(
                authors,
                auth => {
                    if (!auth) {
                        console.warn(
                            "Undefined author found. Is something missing from the authordb?"
                        )
                        return
                    }
                    if (key == "popularity") {
                        return Number(auth.popularity || 0)
                    } else if (key == "birth.date") {
                        return Number(_.get(auth, "birth.date") || 0)
                    } else {
                        return auth[key]
                    }
                },
                dir || "asc"
            )
            // if (!s.showAllAuthors) {
            //     s.authorData = s.authorData.slice(0, s.authLimit)
            // }
        }

        if (!s.authorData.length) {
            backend.getAuthorSuggest(s.filter).then(suggest => {
                if (suggest && suggest.length) {
                    s.authorSuggest = suggest
                } else {
                    s.authorSuggest = null
                }
            })
        }
    }

    s.fetchParts = countOnly => {
        // unless s.filter then return
        s.partSearching = true
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)

        console.log("fetchParts showAllParts", s.showAllParts)
        let size = { from: 0, to: s.showAllParts ? 10000 : 100 }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }

        let def = backend
            .getTitles("etext-part,faksimil-part", {
                sort_field: s.sort.parts,
                filter_string: s.rowfilter,
                filter_or,
                filter_and,
                author_aggs: true,
                partial_string: true,
                suggest: true,
                include:
                    "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable,sort_date_imprint.plain," +
                    "main_author.author_id,main_author.surname,main_author.type,startpagename,sort_date.plain,export," +
                    "authors,work_authors",
                ...size
            })
            .then(({ titles, suggest, hits, author_aggs }) => {
                s.all_titles = titles
                s.partSearching = false
                s.parts_hits = hits
                s.partSuggest = suggest
                return { titles, hits, author_aggs }
            })
        $q.all([def, authors]).then(([{ author_aggs }]) => {
            s.currentPartAuthors = author_aggs.map(({ author_id }) => s.authorsById[author_id])
            s.setAuthorData()
        })
    }

    var fetchAudio = () => {
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)

        let def = backend
            .getTitles(
                "audio",
                {
                    sort_field: s.sort.audio,
                    filter_string: s.rowfilter,
                    filter_or,
                    filter_and,
                    author_aggs: false,
                    partial_string: true,
                    to: 10000,
                    include:
                        "authors.author_id,authors.surname,title,file,readers.author_id,readers.surname"
                },
                true
            )
            .then(({ titles, hits }) => {
                s.audio_list = titles
                console.log("titles", titles)
                // s.parts_hits = hits
                return _.flatten(
                    _.map(s.audio_list, item => {
                        return _.map([...item.authors, ...item.readers], "author_id")
                    })
                )
            })
        $q.all([def, authors]).then(([authorids]) => {
            s.currentAudioAuthors = authorids.map(authorid => s.authorsById[authorid])
            s.setAuthorData()
        })

        // let def = backend
        //     .getAudioList({
        //         string_filter: s.rowfilter,
        //         sort_field: s.sort["audio"],
        //         partial_string: true,
        //     })
        //     .then(titleArray => {
        //         if ($location.search()["kön"]) {
        //             s.audio_list = _.filter(
        //                 titleArray,
        //                 audio => audio.authors[0].gender == $location.search()["kön"]
        //             )
        //         } else {
        //             s.audio_list = titleArray
        //         }

        //         return _.flatten(
        //             _.map(s.audio_list, item => {
        //                 return _.map([...item.authors, ...item.readers], "author_id")
        //             })
        //         )
        //     })
        // $q.all([def, authors]).then(([authorids]) => {
        //     s.currentAudioAuthors = authorids.map(authorid => s.authorsById[authorid])
        //     s.setAuthorData()
        // })
    }

    s.setFilter = f => {
        s.filter = f
        s.refreshData()
    }

    s.titleModel = {
        works: [],
        epub: [],
        works_hits: 0,
        epub_hits: 0,
        show_all_works: false,
        show_all_epub: false,
        works_currentpage: 1,
        epub_currentpage: 1
    }
    s.fetchWorks = (countOnly, epubOnly) => {
        let listID = epubOnly ? "epub" : "works"
        // let show_all = s.titleModel["show_all_" + listID]
        // let size = { from: 0, to: show_all ? 10000 : 100 }
        // let size = { from: 0, to: show_all ? 300 : 100 }
        let page = s.titleModel[s.listType + "_currentpage"] - 1
        let size = {
            from: page * 100,
            to: (page + 1) * 100
        }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }
        s.titleSearching = true

        let isSearchRecent = $location.search().sort == "nytillkommet"
        // TODO: {"_exists": "export>"} if dl_mode
        let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)
        // if (!_.toPairs(text_filter).length) {
        //     text_filter = null
        // }
        // const about_authors = $location.search().about_authors_filter
        if (s.dl_mode) {
            filter_and["export>type"] = ["xml", "txt", "workdb"]
        }
        if (epubOnly) {
            filter_and.has_epub = true
        }
        const def = backend.getTitles("etext,faksimil,pdf", {
            sort_field: s.sort[listID],
            filter_string: s.filter,
            include:
                "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable,imported,sortfield,sort_date_imprint.plain," +
                "main_author.author_id,main_author.surname,main_author.type,startpagename,has_epub,sort_date.plain,export",
            filter_or,
            filter_and,
            partial_string: true,
            author_aggs: true,
            suggest: true,
            ...size
        })
        $q.all([def, authors]).then(([{ titles, author_aggs, suggest, hits, distinct_hits }]) => {
            console.log("titleArray after all", titles)
            if (!titles.length) {
                window.gtag("event", "search-no-hits", {
                    event_category: "library",
                    event_label: s.filter
                })
            }
            s.titleByPath = _.groupBy(titles, item => item.titlepath)

            if (isSearchRecent) {
                s.titleModel[epubOnly ? "epub" : "works"] = decorateRecent(titles)
            } else {
                s.titleModel[epubOnly ? "epub" : "works"] = titles
            }
            s.titleModel[epubOnly ? "epub_hits" : "works_hits"] = distinct_hits
            s.titleModel[epubOnly ? "epub_suggest" : "works_suggest"] = suggest
            // s.titleHits = hits
            if (!epubOnly) {
                s.currentAuthors = author_aggs.map(({ author_id }) => s.authorsById[author_id])
                // make sure checkbox appears selected for works added to download list
                if (s.dl_mode && s.downloads.length) {
                    for (let row of s.downloads) {
                        if (s.titleByPath[row.titlepath]) {
                            s.titleByPath[row.titlepath][0]._download = true
                        }
                    }
                }
            }
            s.setAuthorData()

            s.titleSearching = false
        })
    }

    s.request = function() {
        if (s.listType == "works") {
            s.fetchWorks(false, false)
        } else if (s.listType == "parts") {
            s.fetchParts(false)
        } else if (s.listType == "epub") {
            s.fetchWorks(false, true)
        } else if (s.listType == "authors") {
            s.setAuthorData()
        }
    }

    s.onSortClick = (item, noSwitchDir) => {
        if (item.active && !noSwitchDir) {
            item.dir = item.dir == "asc" ? "desc" : "asc"
            item.reversed = !item.reversed
        } else {
            for (let obj of s.sortItems[s.listType]) {
                obj.active = false
            }
            item.active = true
        }
        if (item.search) {
            $location.search("sort", item.search)
        } else {
            $location.search("sort", null)
        }
        s.sort[s.listType] = item.val + "|" + item.dir + (item.suffix || "")

        if (s.listType == "works") {
            s.fetchWorks(false, false)
        } else if (s.listType == "parts") {
            s.fetchParts(false)
        } else if (s.listType == "epub") {
            s.fetchWorks(false, true)
        } else if (s.listType == "authors") {
            s.setAuthorData()
        }
        // else if (s.listType == "audio") {
        //     fetchAudio(false)
        // }
        // s.refreshData()
    }
    let sortInit = $location.search().sort || "popularitet"

    let sortItem = _.find(s.sortItems[s.listType], function(item) {
        return item.search == sortInit
    })
    if (sortItem) {
        s.onSortClick(sortItem, true)
    } else {
        console.warn("Sort state init failed", s.listType, sortInit)
        $location.search({})
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

        let titleGroups = _.groupBy(titles, item => _.max(_.map(item.mediatypes, "imported")))

        let output = []
        let dir = _.last(s.sort[s.listType].split("|"))
        let datestrs = _.orderBy(_.keys(titleGroups), String, dir)

        for (let datestr of datestrs) {
            // TODO: fix locale format, 'femte maj 2017'
            // output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
            const titles = titleGroups[datestr]
            output.push({ isHeader: true, label: dateFmt(datestr) })
            output = output.concat(_.sortBy(titles, ["sortfield"]))
        }
        return output
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

    s.downloadPopoverURL = require("../views/library/downloadPopover.html")
    s.dl_mode = $location.search().nedladdning
    s.setDownloadMode = () => {
        if (!s.dl_mode) {
            s.listType = "works"
            s.dl_mode = true
            s.downloads = []
            s.fetchWorks(false, false)
        } else {
            s.dl_mode = false
            s.fetchWorks(false, false)
        }
    }

    s.genderSelectSetup = {
        minimumResultsForSearch: -1,
        templateSelection(item) {
            if (!item.id || item.id == "all") {
                return "Välj kön"
            } else {
                return item.text
            }
        }
    }

    s.onSelectVisible = () => {
        let works = []
        for (let row of s.titleModel.works) {
            if (!row.isHeader) {
                row._download = true
                works.push(row)
            }
        }
        s.downloads = _.uniq([...s.downloads, ...works])
    }
    s.onDeselectVisible = () => {
        let works = []
        for (let row of s.titleModel.works) {
            if (!row.isHeader) {
                row._download = false
                works.push(row)
            }
        }
        s.downloads = _.difference(s.downloads, works)
    }

    s.isAllVisibleSelected = () => {
        let rows = _.omit(s.titleModel.works, "isHeader")
        return _.every(rows, "_download")
    }

    let notIsRowEq = (r1, r2) => !(r1.titlepath == r2.titlepath && r1.lbworkid == r2.lbworkid)

    s.downloads = []
    s.toggleDownload = (row, toggle) => {
        if (row.isHeader) return
        if (toggle) {
            row._download = !row._download
        }
        if (row._download) {
            s.downloads.push(row)
        } else {
            s.downloads = _.filter(s.downloads, item => notIsRowEq(item, row))
        }
    }

    s.clearDownloads = () => {
        for (let dl of s.downloads) {
            dl._download = false
        }
        s.downloads = []
    }

    s.exportsFromMediatypes = (mediatype, types) => {
        let output = []
        for (let dl of s.downloads) {
            for (let mt of dl.mediatypes) {
                if (mediatype == mt.label) {
                    output = [...output, ...mt.export.filter(exp => types.includes(exp.type))]
                }
            }
        }
        return output
    }

    // s.getExports = mediatype => {
    //     let exports = s.exportsFromMediatypes([mediatype])
    //     return _.uniqBy(exports, "type")
    // }

    // s.toggleDownloadType = (mediatype, downloadtype) => {
    //     let exports = s.exportsFromMediatypes([mediatype])
    //     for (let exp of exports) {
    //         exp._selected = exp.type == downloadtype
    //     }
    // }

    s.typesConf = {
        etext: [
            { id: "txt", label: "ren text" },
            { id: "xml" },
            { id: "workdb", label: "Metadata" }
        ],
        faksimil: [
            { id: "txt", label: "ren text" },
            { id: "xml" },
            { id: "workdb", label: "Metadata" },
            { id: "pdf", disabled: true }
        ]
    }

    // s.toggleDownloadType = (mediatype, type) => {
    //     _.find(s.typesConf[mediatype], item => item.label == type).selected = true
    // }

    s.getDownloadSet = () => {
        let { etext, faksimil } = s.typesConf
        etext = _.filter(etext, "selected")
        faksimil = _.filter(faksimil, "selected")
        let output = []
        if (etext.length) {
            output = [...output, ...s.exportsFromMediatypes("etext", _.map(etext, "id"))]
        }
        if (faksimil.length) {
            output = [...output, ...s.exportsFromMediatypes("faksimil", _.map(faksimil, "id"))]
        }
        return output
    }

    s.getSize = () => {
        let size = _.reduce(_.map(s.getDownloadSet() || [], "size"), _.add)
        if (!size) {
            return null
        }
        if (size < 1050000) {
            return Math.round(size / 1024).toString() + " KB"
        }
        return (size / (1024 * 1024)).toFixed(2) + "MB"
    }

    function clickhandler() {
        if ($(".popover").length) {
            window.safeApply(s, () => {
                for (let type of [...s.typesConf.etext, ...s.typesConf.faksimil]) {
                    type.selected = false
                }
                s.hidePopup = true
            })
            window.safeApply(s, () => (s.hidePopup = false))
        }
    }
    document.addEventListener("click", clickhandler)
    $("body").on("click", ".popover", function(event) {
        console.log("popover click")
        event.stopPropagation()
    })
    s.$on("$destroy", () => {
        $("body").off("click", ".popover")
    })
    s.onDownload = () => {
        let exports = s.getDownloadSet()
        let groups = _.groupBy(exports, exp => `${exp.mediatype}+${exp.type}`)
        let label = _.toPairs(groups)
            .map(([key, list]) => `${key}: ${list.length}`)
            .join(", ")
        window.gtag("event", "source-material", {
            event_category: "download",
            event_label: label
        })
        backend.downloadFiles(exports)
    }

    s.autocomplete = val => {
        // return backend.autocomplete(val).then(function(data) {
        //     console.log("autocomplete", data, val)
        //     return data
        // })
    }

    // if $location.search().keyword
    //     s.selectedKeywords = $location.search().keyword?.split(",")

    s.refreshData()

    const listValIn = val => (val || "").split(",")
    const listValOut = val => {
        return (val || []).join(",")
    }
    let isInitListType = false
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
        // {
        // TODO: deep linking to download list: needs backend support for getting
        // a list of works given a list of lbworkids
        //     key: "nedladdningar",
        //     expr: "downloads",
        //     val_in: val => {
        //         if(!s.titleModel.works) {return}
        //         s.clearDownloads()

        //         for(let lbworkid of val.split(",")) {

        //         }
        //     val_out: listValOut
        // },
        {
            key: "avancerat",
            expr: "show_more"
        },
        {
            key: "alla_titlar",
            expr: "showAllParts"
        },
        // {
        //     key: "alla_verk",
        //     expr: "showAllWorks"
        // },
        {
            key: "visa",
            expr: "listType",
            default: "works",
            post_change: function(listType) {
                console.log("post_change listType", listType)
                if (isInitListType) {
                    let sortItem = _.find(s.sortItems[listType || "works"], function(item) {
                        return item.active
                    })

                    if (sortItem.search) {
                        $location.search("sort", sortItem.search)
                    } else {
                        $location.search("sort", null)
                    }
                }
                isInitListType = true
            }
        },
        {
            key: "nedladdning",
            expr: "dl_mode"
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
