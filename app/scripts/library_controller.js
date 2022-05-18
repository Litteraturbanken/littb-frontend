const littb = window.littb
const _ = window._
const $ = window.$
const isDev = window.isDev
const c = window.console

littb.directive("sortList", () => ({
    restrict: "E",
    template: String.raw`
    <div>
        <div class="inline-block sc mr-2">Sortera: </div>
        <ul class="part_header top_header mb-4 inline-block">
        
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
littb.component("keywordSelect", {
    template: String.raw`
    
    <select multiple class="filter_select keyword_select" ui-select2
            ng-change="$ctrl.onChange({keywords: $ctrl.model})"
            ng-model="$ctrl.model"
             data-placeholder="{{$ctrl.label}}">
        <option value=""></option>
        <option value="texttype:brev">Brev</option>
        <option value="texttype:drama" data-disabled="true">Dramatik</option>
        <option value="texttype:novellsamling;novell">Noveller</option>
        <option value="texttype:diktsamling;dikt">Poesi</option>
        <option value="texttype:roman">Romaner</option>
        <option value="texttype:herdaminne">Herdaminne</option>
        
        <option value='keyword:Barnlitteratur'>Barn- och ungdomslitteratur</option>
        <option value='source:bibliotekariesidor'>Bibliotekariesidorna</option>
        <option value='source:diktensmuseum'>Diktens museum</option>
        <option value='keyword:Dramawebben'>Dramawebben</option>
        <option value='keyword:Finlandssvenskt'>Finlandssvensk litteratur</option>
        <option value='keyword:sentpajorden'>Gunnar Ekelöf. Sent på jorden</option>
        <option value='keyword:OrdenPrövas'>Harry Martinson. Orden prövas</option>
        <option value='keyword:Humor'>Humor</option>
        <option value='source:presentations'>Kringtexter</option>
        <option value='source:skolan'>Litteraturbankens skola</option>
        <option value='source:litteraturkartan'>Litteraturkartan</option>
        <option value='source:ljudochbild'>Ljud & Bild</option>
        <option value='keyword:1800'>Nya vägar till 1800-talet</option>
        <option value="texttype:reseskildring">Reseskildringar</option>
        <option value="texttype:kistebrev">Kistebrev</option>
        <option value='keyword:Rösträtt'>Rösträtt</option>
        <option value='keyword:Folktryck'>Skillingtryck och folktryck</option>
        <option value='keyword:SLS-FI'>SLS Finland</option>
        <option value='provenance.library:SVELITT'>SLS Sverige</option>
        <option value='provenance.library:SFS'>Svenska fornskriftsällskapet</option>
        <option value='provenance.library:SVS'>Svenska vitterhetssamfundet</option>
        <option value='provenance.library:SVA'>Svenskt visarkiv</option>
        <option value='source:sol'>Översättarlexikon</option>
    </select>`,
    bindings: {
        label: "@",
        model: "<",
        onChange: "&",
        disableOnKeyword: "@"
    },
    controller($scope, $element, $attrs, $location) {
        var ctrl = this

        if ($attrs.disableOnKeyword !== undefined) {
            var unwatch = $scope.$watch(
                () => $location.search().keywords,
                val => {
                    if (!val) return
                    $("option", $element).attr("disabled", null)
                    let opts = val.split(",").map(item => `option[value='${item}']`)
                    $(opts.join(","), $element).attr("disabled", "disabled")
                    $element.find("select").select2()
                }
            )
        }

        ctrl.$onDestroy = () => {
            unwatch?.()
        }

        // $element.on("change:select2", () => {
        //     console.log("🚀 ~ file: library_controller.js ~ line 69 ~ change:select2", this.model)
        // })
    }
})

littb.component("highlights", {
    template: String.raw`
        <ul>
            <li ng-repeat="highlight in $ctrl.list track by $index" 
                ng-class="{flip: $parent.$odd}" 
                class="sm:whitespace-nowrap">
                ”… <span class="highlight text-xs relative z-10" ng-bind-html="highlight | trust"></span> …”   
            </li>
        </ul>
    `,
    bindings: {
        list: "="
    }
})

littb.controller(
    "libraryCtrl",
    function (
        $scope,
        backend,
        util,
        $timeout,
        $location,
        authors,
        $rootElement,
        $anchorScroll,
        $q,
        $filter,
        $rootScope
    ) {
        const s = $scope

        s.filter = $location.search().filter || ""
        s.worksListURL = require("../views/library/works_list.html")
        s.titleSearching = false
        s.authorSearching = true

        s.show_more = $location.search().avancerat != null
        s.show_dl = $location.search().avancerat != null
        // TODO: refactor state variable to keep track of these
        s.parts_page = {
            current: Number($location.search().sida) || 1
        }
        s.relevance_page = {
            current: Number($location.search().sida) || 1
        }

        let routeChangeUnbind = s.$on("$routeChangeStart", (event, newRoute, prevRoute) => {
            console.log("leave search", window.location.search)
            $rootScope.libraryState.queryparams = window.location.search
        })

        $timeout(() => s.$broadcast("focus"))
        s.listType = $location.search().visa || "all"

        s.authLimit = 150

        s.isHide1800 = () => $location.search().hide1800
        s.toggle1800 = () => {
            if (!s.isHide1800()) $location.search("hide1800", true)
            else $location.search("hide1800", null)
            // s.hide1800 = !s.hide1800
            s.titleModel.latest_currentpage = 1
            s.fetchRecent(false)
        }

        s.filters = {
            gender: $location.search()["kön"],
            authorkeyword: [],
            keywords: [],
            languages: [],
            mediatypes: [],
            "sort_date_imprint.date:range": $location.search().intervall
                ? $location.search().intervall.split(",")
                : []
        }

        s.keywords_aux = $location.search().keywords_aux?.split(",") || []

        s.onSliderChange = () => {
            $location.search("intervall", s.filters["sort_date_imprint.date:range"].join(","))
            s.parts_page.current = 1
            s.refreshData()
        }

        s.isPristine = () => {
            if (s.initialLoading) return true
            let [from, to] = s.filters["sort_date_imprint.date:range"]
            return (
                !s.filter &&
                Object.values(
                    _.pick(s.filters, ["authorkeyword", "keywords", "languages", "mediatypes"])
                ).every(arr => !arr.length) &&
                !s.filters.gender &&
                !s.keywords_aux.length &&
                s.chronology_floor == from &&
                s.chronology_ceil == to &&
                !$location.search().hide1800
            )
        }

        const listKeys = _.pick(
            $location.search(),
            "keywords",
            "languages",
            "mediatypes",
            "authorkeyword"
        )
        _.extend(
            s.filters,
            _.mapValues(listKeys, val => val.split(","))
        )
        s.filters = _.omitBy(s.filters, _.isNil)

        s.currentAuthors = []
        s.currentPartAuthors = []
        s.currentAudioAuthors = []

        s.normalizeAuthor = $filter("normalizeAuthor")

        s.getTitleTooltip = function (attrs) {
            if (!attrs) {
                return
            }
            if (attrs.showtitle !== attrs.title) {
                return attrs.title
            }
        }

        var popState
        window.addEventListener(
            "popstate",
            (popState = () => {
                safeApply(s, () => {
                    console.log("popstate", $location.search().visa)
                    s.listType = $location.search().visa || "all"
                })
            })
        )

        s.filterTitle = function (row) {
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
        s.onAboutAuthorChange = _.once(function ($event) {
            if ($location.search().about_authors) {
                s.filters["authorkeyword>authorid"] = (
                    $location.search().about_authors || ""
                ).split(",")
            }

            aboutDef.resolve()
        })

        $q.all([aboutDef.promise, authors]).then(function () {
            return $timeout(() => {
                $(".about_select").select2()
            }, 100)
        })

        s.resetView = function () {
            s.filters = {
                "sort_date_imprint.date:range": s.filters["sort_date_imprint.date:range"]
            }
            s.$broadcast("chronology-reset")

            $timeout(() => $(".gender_select, .keyword_select, about_select").select2(), 0)
            s.filter = ""
            s.rowfilter = ""
            s.all_titles = null
            s.audio_list = null
            s.keywords_aux = []
            s.parts_page.current = 1
            $location.search("hide1800", null)
        }

        s.hasMediatype = function (titleobj, mediatype) {
            return _.map(titleobj.mediatypes, "label").includes(mediatype)
        }

        s.pickMediatypes = (titleobj, mediatypeLabels) =>
            _.filter(titleobj.mediatypes, item => mediatypeLabels.includes(item.label))

        s.sortMedia = function (list) {
            const order = ["etext", "faksimil", "epub", "pdf"]
            // first keep the keys in the order list, then readd the ones that weren't there.
            return _.intersection(order, list).concat(_.difference(list, order))
        }

        s.setDateRange = (from, to) => {
            console.log("from, to", from, to)
            s.filters["sort_date_imprint.date:range"][0] = from
            s.filters["sort_date_imprint.date:range"][1] = to
            s.onSliderChange()
        }

        s.getTitleId = row => row.work_titleid

        s.getUniqId = function (title) {
            if (!title) {
                return
            }
            return title.lbworkid + (title.titlepath.split("/")[1] || "")
        }

        s.titleRender = function () {
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
        authors.then(function ([authorList, authorsById]) {
            s.authorsById = authorsById
            s.withPortraits = _.filter(
                authorList,
                item => !item.picture && item.wikidata && item.wikidata.image
            )
            s.authorSearching = false
        })

        s.filterChange = () => {
            console.log("filterchange")
        }

        $q.all([backend.getAboutAuthors(), authors]).then(function ([authorIds]) {
            s.aboutAuthors = _.orderBy(authorIds, auth => {
                if (s.authorsById[auth]) {
                    return s.authorsById[auth].surname
                }
            })
        })

        s.sort = {
            all: "_score|desc",
            works: "popularity|desc",
            epub: "popularity|desc",
            authors: "popularity|desc",
            parts: "sortkey|asc",
            audio: "title.raw|asc",
            latest: "imported|desc,main_author.name_for_index|asc,sortfield|asc"
        }

        s.sortItems = {
            all: [
                {
                    label: "Relevans",
                    val: "_score",
                    search: "relevans",
                    dir: "desc",
                    active: true
                },
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
                    label: "Tryckår",
                    val: "sort_date_imprint.date",
                    dir: "desc",
                    search: "kronologi"
                }
                // {
                //     label: "Tryckår",
                //     val: "sort_date_imprint.date",
                //     dir: "desc",
                //     search: "kronologi"
                // },
                // {
                //     label: "Nytt",
                //     val: "imported",
                //     dir: "desc",
                //     search: "nytillkommet"
                // }
            ],
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
                }
                // {
                //     label: "Nytt",
                //     val: "imported",
                //     suffix:
                //         ",main_author.name_for_index|asc,sort_date_imprint.date|asc,sortfield|asc",
                //     dir: "desc",
                //     search: "nytillkommet"
                // }
            ],
            latest: [
                {
                    label: "Nytt",
                    val: "imported",
                    suffix: ",main_author.name_for_index|asc,sort_date_imprint.date|asc,sortfield|asc",
                    dir: "desc",
                    search: "nytillkommet",
                    active: true
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

        s.refreshData = function (isInitial) {
            if (!isInitial) {
                s.relevance_page.current = 1
                s.parts_page.current = 1
                s.titleModel["epub_currentpage"] = 1
                s.titleModel["works_currentpage"] = 1
                s.titleModel["latest_currentpage"] = 1
            }
            s.selectedTitle = null
            s.rowfilter = s.filter
            if (!isDev) {
                backend.logLibrary(s.rowfilter)
            }

            if (s.listType == "all") {
                s.fetchByRelevance()
            }

            if (s.listType == "latest") {
                s.fetchRecent(false)
            }
            return Promise.all([
                s.fetchWorks(s.listType !== "works", false),
                s.fetchWorks(s.listType !== "epub", true),
                s.fetchParts(s.listType !== "parts")
            ])
            // fetchAudio(s.listType !== "audio")
        }
        s.capitalizeLabel = label => {
            return { pdf: "PDF", xml: "XML" }[label] || label
        }

        let scandinavianFolding = str => str.toLowerCase().replace("æ", "ä").replace("ø", "ö")

        s.setAuthorData = function () {
            let [key, dir] = (s.sort.authors || "").split("|")
            let authors = [].concat(s.currentAuthors, s.currentPartAuthors, s.currentAudioAuthors)

            authors = authors.filter(item => {
                let conds = []
                if (s.filters.gender) {
                    conds.push(item.gender == s.filters.gender)
                }
                if (s.filter) {
                    conds.push(
                        s.filter
                            .split(" ")
                            .map(str => {
                                let search =
                                    item.full_name +
                                    " " +
                                    _.map(item.pseudonym, "full_name").join(" ")

                                return (
                                    scandinavianFolding(search).match(
                                        new RegExp(scandinavianFolding(str), "i")
                                    ) ||
                                    s
                                        .normalizeAuthor(search)
                                        .match(new RegExp(s.normalizeAuthor(str), "i"))
                                )
                            })
                            .some(Boolean)
                    )
                }
                return conds.every(Boolean)
            })

            authors = _.uniq(authors, "authorid")
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
        s.getIndex = longindex => longindex
        s.getLabelBySource = item => {
            if (item.texttype) {
                return item.texttype
            } else if (item._index == "wordpress") {
                return {
                    ljudochbild: "Ljud och bild",
                    diktensmuseum: "Diktens museum",
                    skolan: "Skolan",
                    bibliotekariesidor: "Bibliotekariesidor"
                }[item.source]
            } else {
                return {
                    presentations: "Kringtexter",
                    litteraturkartan: "Litteraturkartan",
                    sol: "Översättarlexikon",
                    author: "Författare"
                }[item._index]
            }
        }
        s.fetchByRelevance = async countOnly => {
            s.relevanceSearching = true
            s.relevanceError = false

            let filters = { ...s.filters }
            if (
                filters["sort_date_imprint.date:range"][0] == s.chronology_floor &&
                filters["sort_date_imprint.date:range"][1] == s.chronology_ceil
            ) {
                delete filters["sort_date_imprint.date:range"]
            }

            let size = {
                from: (s.relevance_page.current - 1) * 100,
                to: s.relevance_page.current * 100
            }
            // let size = { to: 100 }
            if (countOnly) {
                size = { from: 0, to: 0 }
            }

            try {
                let { titles, hits, suggest } = await backend.relevanceSearch(
                    "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress",
                    // "etext,faksimil,pdf,etext-part,faksimil-part,author",
                    {
                        filter_string: expandQuery(s.rowfilter),
                        filters: filters,
                        // filter_or,
                        // filter_and,
                        // author_aggs: false,
                        // relevance: true,
                        show_all: false,
                        sort_field: s.sort.all,
                        // suggest: true,
                        // include:
                        //     "lbworkid,titlepath,title,titleid,work_titleid,shorttitle,mediatype,searchable,sort_date_imprint.plain," +
                        //     "main_author.authorid,main_author.surname,main_author.type,startpagename,sort_date.plain,export," +
                        //     "authors,work_authors",
                        ...size
                    },
                    // TODO: we should be grouping, need to filter out authors though.
                    true
                )

                s.relevanceData = titles
                s.relevanceSuggest = suggest
                s.relevanceSearching = false
                s.relevance_hits = hits
                s.$apply()
                return { titles, hits }
            } catch (e) {
                if (!e.xhrStatus == "abort") {
                    console.error("relevance error", e)
                    s.relevanceSearching = false
                    s.relevanceError = true
                    s.$apply()
                }
            }

            // $q.all([def, authors]).then(([{ author_aggs }]) => {
            //     s.currentPartAuthors = author_aggs.map(({ authorid }) => s.authorsById[authorid])
            //     s.setAuthorData()
            // })
        }

        function expandQuery(query) {
            // let keywords_aux = $location.search().keywords_aux?.split(",")
            if (s.keywords_aux?.length) {
                return `(${s.keywords_aux.join(" AND ")}) ${query}`
            }
            return query
        }

        s.fetchParts = countOnly => {
            // unless s.filter then return
            s.partSearching = true
            let filters = { ...s.filters }
            if (
                filters["sort_date_imprint.date:range"][0] == s.chronology_floor &&
                filters["sort_date_imprint.date:range"][1] == s.chronology_ceil
            ) {
                delete filters["sort_date_imprint.date:range"]
            }
            let { filter_or, filter_and } = util.getKeywordTextfilter(filters)

            let size = { from: (s.parts_page.current - 1) * 100, to: s.parts_page.current * 100 }
            console.log("size", size)
            if (countOnly) {
                size = { from: 0, to: 0 }
            }

            let def = backend
                .getTitles("etext-part,faksimil-part", {
                    sort_field: s.sort.parts,
                    filter_string: expandQuery(s.rowfilter),
                    filter_or,
                    filter_and,
                    author_aggs: true,
                    partial_string: true,
                    suggest: true,
                    include:
                        "lbworkid,titlepath,title,titleid,work_titleid,shorttitle,mediatype,searchable,sort_date_imprint.plain," +
                        "main_author.authorid,main_author.surname,main_author.type,startpagename,sort_date.plain,export," +
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
                s.currentPartAuthors = author_aggs.map(({ authorid }) => s.authorsById[authorid])
                s.setAuthorData()
            })
        }

        // var fetchAudio = () => {
        //     let { filter_or, filter_and } = util.getKeywordTextfilter(s.filters)

        //     let def = backend
        //         .getTitles(
        //             "audio",
        //             {
        //                 sort_field: s.sort.audio,
        //                 filter_string: s.rowfilter,
        //                 filter_or,
        //                 filter_and,
        //                 author_aggs: false,
        //                 partial_string: true,
        //                 to: 10000,
        //                 include:
        //                     "authors.authorid,authors.surname,title,file,readers.authorid,readers.surname"
        //             },
        //             true
        //         )
        //         .then(({ titles, hits }) => {
        //             s.audio_list = titles
        //             console.log("titles", titles)
        //             // s.parts_hits = hits
        //             return _.flatten(
        //                 _.map(s.audio_list, item => {
        //                     return _.map([...item.authors, ...item.readers], "authorid")
        //                 })
        //             )
        //         })
        //     $q.all([def, authors]).then(([authorids]) => {
        //         s.currentAudioAuthors = authorids.map(authorid => s.authorsById[authorid])
        //         s.setAuthorData()
        //     })

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
        //                 return _.map([...item.authors, ...item.readers], "authorid")
        //             })
        //         )
        //     })
        // $q.all([def, authors]).then(([authorids]) => {
        //     s.currentAudioAuthors = authorids.map(authorid => s.authorsById[authorid])
        //     s.setAuthorData()
        // })
        // }

        s.setFilter = f => {
            s.filter = f
            s.parts_page.current = 1
            s.relevance_page.current = 1
            s.refreshData()
        }

        s.titleModel = {
            works: [],
            epub: [],
            latest: [],
            works_hits: 0,
            epub_hits: 0,
            latest_hits: 0,
            works_currentpage: 1,
            epub_currentpage: 1,
            latest_currentpage: 1
        }
        s.fetchRecent = countOnly => {
            s.fetchWorks(countOnly, false, true)
        }

        s.fetchWorks = (countOnly, epubOnly, isSearchRecent) => {
            let listID = epubOnly ? "epub" : "works"
            if (isSearchRecent) listID = "latest"
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

            // let isSearchRecent = $location.search().sort == "nytillkommet"
            // TODO: {"_exists": "export>"} if dl_mode
            let filters = { ...s.filters }
            if (
                filters["sort_date_imprint.date:range"][0] == s.chronology_floor &&
                filters["sort_date_imprint.date:range"][1] == s.chronology_ceil
            ) {
                delete filters["sort_date_imprint.date:range"]
            }
            let { filter_or, filter_and } = util.getKeywordTextfilter(filters)
            let filter_string = expandQuery(s.rowfilter)
            if ($location.search().hide1800) {
                filter_string = "-keyword:1800 " + filter_string
            }
            console.log("filter_and", filter_and)
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
                filter_string,
                include:
                    "lbworkid,titlepath,title,titleid,work_titleid,shorttitle,mediatype,searchable,imported,sortfield,sort_date_imprint.plain," +
                    "main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword",
                filter_or,
                filter_and,
                partial_string: true,
                author_aggs: true,
                suggest: true,
                ...size
            })
            return $q
                .all([def, authors])
                .then(([{ titles, author_aggs, suggest, hits, distinct_hits }]) => {
                    console.log("titleArray after all", titles)
                    if (!titles.length) {
                        window.gtag("event", "search-no-hits", {
                            event_category: "library",
                            event_label: s.filter,
                            anonymize_ip: true
                        })
                    }
                    s.titleByPath = _.groupBy(titles, item => item.titlepath)

                    if (isSearchRecent) {
                        titles = decorateRecent(titles)
                    }
                    s.titleModel[listID] = titles
                    s.titleModel[listID + "_hits"] = distinct_hits
                    s.titleModel[listID + "_suggest"] = suggest
                    // s.titleHits = hits
                    if (!epubOnly) {
                        s.currentAuthors = author_aggs.map(
                            ({ authorid }) => s.authorsById[authorid]
                        )
                        // make sure checkbox appears selected for works added to download list
                        if (s.dl_mode && s.downloads.length) {
                            for (let row of s.downloads) {
                                if (s.titleByPath[row.titlepath]) {
                                    s.titleByPath[row.titlepath][0]._download = true
                                }
                            }
                        }
                    }
                    if (!isSearchRecent) {
                        s.setAuthorData()
                    }

                    s.titleSearching = false
                })
        }

        s.onSortClick = (item, noSwitchDir, replace, requestSortedData = true) => {
            console.log("onSortClick", s.listType)
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
                if (replace) {
                    $location.replace()
                }
            } else {
                $location.search("sort", null)
            }
            s.sort[s.listType] = item.val + "|" + item.dir + (item.suffix || "")

            if (!requestSortedData) {
                return
            }
            if (s.listType == "all") {
                s.relevance_page.current = 1
                s.fetchByRelevance(false)
            } else if (s.listType == "works") {
                s.fetchWorks(false, false)
            } else if (s.listType == "parts") {
                s.parts_page.current = 1
                s.fetchParts(false)
            } else if (s.listType == "epub") {
                s.fetchWorks(false, true)
            } else if (s.listType == "authors") {
                s.setAuthorData()
            } else if (s.listType == "latest") {
                s.fetchRecent()
            }
            // else if (s.listType == "audio") {
            //     fetchAudio(false)
            // }
            // s.refreshData()
        }
        let sortInit = $location.search().sort || "popularitet"

        let sortItem = _.find(s.sortItems[s.listType], function (item) {
            return item.search == sortInit
        })
        if (sortItem) {
            s.onSortClick(sortItem, true, true, false)
        } else {
            console.warn("Sort state init failed", s.listType, sortInit)
            $location.search({})
        }

        function decorateRecent(titles) {
            const dateFmt = function (datestr) {
                const months = `januari,februari,mars,april,maj,juni,juli,
                            augusti,september,oktober,november,december`.split(",")
                const [year, month, day] = datestr.split("-")
                return [Number(day), months[month - 1], year].join(" ")
            }

            // let [only1800, rest] = _.partition(titles, item => item.keyword?.includes("1800"))
            let groupTitles = (titles, label) => {
                let output = []
                let titleGroups = _.groupBy(titles, item =>
                    _.max(_.map(item.mediatypes, "imported"))
                )

                let datestrs = _.keys(titleGroups)
                if (label) label = ": " + label
                for (let datestr of datestrs) {
                    // TODO: fix locale format, 'femte maj 2017'
                    // output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
                    const titles = titleGroups[datestr]
                    output.push({ isHeader: true, label: dateFmt(datestr) + label })
                    output = output.concat(titles)
                }
                return output
            }
            return groupTitles(titles, "")
        }

        s.getUrl = function (row, mediatype) {
            const authorid = row.authors[0].workauthor || row.authors[0].authorid

            if (mediatype === "epub") {
                return `txt/epub/${authorid}_${row.work_titleid}.epub`
            } else if (mediatype === "pdf") {
                return `txt/${row.lbworkid}/${row.lbworkid}.pdf`
            } else {
                return (
                    `/författare/${authorid}/titlar/${s.getTitleId(row)}/` +
                    `sida/${row.startpagename}/${mediatype}`
                )
            }
        }

        s.titleHeaderClick = function ($event, title) {
            if (s.selectedTitle === title && title._collapsed) {
                title._collapsed = false
                if ($event) $event.stopPropagation()
            }
        }

        s.titleClick = function ($event, title) {
            if (s.selectedTitle !== title) {
                if (s.selectedTitle != null) {
                    s.selectedTitle._collapsed = false
                }
            }

            s.selectedTitle = title
            s.selectedTitle._collapsed = true
            $location.search("title", title.titlepath)
        }

        s.getPartAuthor = part => part.authors?.[0] || part.work_authors?.[0]

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
        $("body").on("click", ".popover", function (event) {
            console.log("popover click")
            event.stopPropagation()
        })
        s.$on("$destroy", () => {
            window.removeEventListener("popstate", popState)
            routeChangeUnbind()
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
                event_label: label,
                anonymize_ip: true
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
                expr: "filters.gender",
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
                key: "keywords_aux",
                expr: "keywords_aux",
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
                expr: "filters['authorkeyword>authorid']",
                val_in: listValIn,
                val_out: listValOut
            },
            // {
            //     key: "intervall",
            //     expr: "filters['sort_date_imprint.date:range']",
            //     val_in: listValIn,
            //     val_out: listValOut
            // },
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
                default: "all",
                replace: false,
                post_change: function (listType) {
                    console.log("post_change listType", listType)
                    // if (listType == "all") return
                    if (isInitListType) {
                        let sortItem = _.find(s.sortItems[listType || "all"], function (item) {
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
            },
            {
                key: "sida",
                expr: "parts_page.current",
                val_in: Number,
                default: 1
            }
            // {
            // key: "sortering",
            // expr: "sort"
            // default : "popularity|desc"
            // }
        ])

        s.initialLoading = true
        s.refreshData(true).then(() => {
            s.initialLoading = false
        })

        // s.listVisibleTitles = function() {
        //     if (s.showInitial && s.showPopular) {
        //         return s.popularTitles
        //     } else {
        //         return s.titleArray
        //     }
        // }
    }
)
