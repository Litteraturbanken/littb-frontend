import { filter } from "lodash"
import { buildFilterQuery, composeQuery } from "./query.ts"
import worksListUrl from "./components/library/works_list.html?url"
import downloadPopoverUrl from "./components/library/downloadPopover.html?url"
import libraryUrl from "./components/library/library.html?url"

const littb = window.littb
const _ = window._
const isDev = window.isDev
const c = window.console

littb.directive("sortList", () => ({
    restrict: "E",
    template: String.raw`
    <div>
        <div class="inline-block sc mr-2">Sortera: </div>
        <ul class="part_header top_header mb-4 inline-block">

            <li class="inline-block sc" ng-repeat="item in $ctrl.sortItems[$ctrl.listType]" >
                <a class="sort_item" href="" ng-click="$ctrl.onSortClick(item)"
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
    
    <select multiple class="filter_select keyword_select" ui-select2="{placeholder: $ctrl.label}"
        ng-change="$ctrl.onChange({keywords: $ctrl.model})"
        ng-model="$ctrl.model"
        data-placeholder="{{$ctrl.label}}"
         ng-placeholder="{{$ctrl.label}}">
    <option value=""></option>
    <optgroup label="Kategorier">
        <option value="texttype:brev;brevsamling">Brev</option>
        <option value="texttype:drama;dramasamling" data-disabled="true">Dramatik</option>
        <option value="texttype:essä;essäsamling" data-disabled="true">Essäer</option>
        <option value="texttype:novellsamling;novell">Noveller</option>
        <option value="texttype:diktsamling;dikt">Poesi</option>
        <option value="texttype:roman">Romaner</option>
        <option value="texttype:sakprosa;kringtexter;avhandling;referensverk">Sakprosa</option>
        
        <option value='keyword:Barnlitteratur'>Barn- och ungdomslitteratur</option>
        <option value='keyword:Biografika'>Biografisk litteratur</option>
        <option value='keyword:Finlandssvenskt'>Finlandssvensk litteratur</option>
        <option value='keyword:Flickböcker'>Flickböcker</option>
        <option value="texttype:herdaminne">Herdaminnen</option>
        <option value='keyword:Humor'>Humoristiska verk</option>
        <option value="texttype:kistebrev">Kistebrev</option>
        <option value='texttype:kringtext'>Kringtexter</option>
        <option value='texttype:kåseri;kåserisamling'>Kåserier</option>
        <option value="texttype:reseskildring">Reseskildringar</option>
        <option value='keyword:Rösträtt'>Rösträtt</option>
        <option value='keyword:Sapmi'>Sápmi</option>
        <option value='keyword:Folktryck'>Skillingtryck och folktryck</option>
    </optgroup>
    <optgroup label="Projekt">
        <option value='keyword:sentpajorden'>Gunnar Ekelöf. Sent på jorden</option>
        <option value='keyword:OrdenPrövas'>Harry Martinson. Orden prövas</option>
        <option value='keyword:LB-antologi'>Litteraturbankens antologier</option>
        <option value='keyword:1800'>Nya vägar till det förflutna</option>
    </optgroup>
    <optgroup label="Avdelningar">
        <option value='source:bibliotekariesidor'>Bibliotekariesidorna</option>
        <option value='source:diktensmuseum'>Diktens museum</option>
        <option value='keyword:Dramawebben'>Dramawebben</option>
        <option value='source:skolan'>Litteraturbankens skola</option>
        <option value='source:litteraturkartan'>Litteraturkartan</option>
        <option value='source:ljudochbild'>Ljud & Bild</option>
        <option value='source:sol'>Översättarlexikon</option>
    </optgroup>
    <optgroup label="Utgivare">
        <option value='keyword:SLS-FI'>SLS Finland</option>
        <option value='provenance.library:SVELITT'>SLS Sverige</option>
        <option value='provenance.library:SA'>Svenska Akademien</option>
        <option value='provenance.library:SFS'>Svenska fornskriftssällskapet</option>
        <option value='provenance.library:SVA'>Svenskt visarkiv</option>
        <option value='author_ids:KunglSamfundet'>Kungl. Samfundet för utgivande av handskrifter</option>
        <option value='provenance.library:SVS'>Svenska Vitterhetssamfundet</option>
    </optgroup>
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
                    $element[0]
                        .querySelectorAll("option")
                        .forEach(opt => opt.removeAttribute("disabled"))
                    let opts = val.split(",")
                    for (let v of opts) {
                        let opt = $element[0].querySelector(`option[value='${v}']`)
                        if (opt) opt.setAttribute("disabled", "disabled")
                    }
                    window.setTimeout(() => {
                        const select = $element.find("select")
                        select.select2({
                            placeholder: select.attr("data-placeholder") || ctrl.label
                        })
                    })
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
        list: "<",
        isPhrase: "<"
    },
    controller($scope, $element, $attrs, $location) {
        var ctrl = this
        ctrl.$onChanges = () => {
            if (ctrl.isPhrase && ctrl.list) {
                ctrl.list = ctrl.list.filter(item => {
                    if (Array.from(item.matchAll("class='hit'")).length > 1) {
                        return true
                    }
                    return !["<em class='hit'>i</em>", "<em class='hit'>I</em>"].some(x =>
                        item.includes(x)
                    )
                })
            }
        }
    }
})

function LibraryPageCtrl(
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
    LibraryStateService
) {
    const ctrl = this

    ctrl.filter = $location.search().filter || ""
    ctrl.worksListURL = worksListUrl
    ctrl.titleSearching = false
    ctrl.authorSearching = true

    ctrl.show_more = $location.search().avancerat != null
    ctrl.show_dl = $location.search().avancerat != null
    // TODO: refactor state variable to keep track of these
    ctrl.parts_page = {
        current: Number($location.search().sida) || 1
    }
    ctrl.relevance_page = {
        current: Number($location.search().sida) || 1
    }

    let routeChangeUnbind = $scope.$on("$routeChangeStart", (event, newRoute, prevRoute) => {
        LibraryStateService.setState({ queryparams: window.location.search })
    })

    $timeout(() => $scope.$broadcast("focus"))
    ctrl.listType = $location.search().visa || "all"

    ctrl.authLimit = 150

    ctrl.isHide1800 = () => $location.search().hide1800
    ctrl.toggle1800 = () => {
        if (!ctrl.isHide1800()) $location.search("hide1800", true)
        else $location.search("hide1800", null)
        ctrl.titleModel.latest_currentpage = 1
        ctrl.fetchRecent(false)
    }

    ctrl.getMediatype = (row, mediatype) => {
        return _.find(row.mediatypes, item => item.label == mediatype)
    }

    ctrl.onAutocompleteSelect = item => {
        console.log("🚀 ~ file: library_controller.js:179 ~ item", item)
        if (item.url) {
            $location.url(val.url)
        }
    }
    ctrl.autocomplete = val => {
        if (val.match(/^lb.*/)) {
            return [
                {
                    label: val,
                    url: `/editor/${val}/ix/0/f`,
                    typeLabel: "[Red.] Gå till faksimileditorn"
                }
            ]
        }
    }

    ctrl.filters = {
        gender: $location.search()["kön"],
        authorkeyword: [],
        keywords: [],
        languages: [],
        mediatypes: [],
        "sort_date_imprint.date:range": $location.search().intervall
            ? $location.search().intervall.split(",")
            : []
    }

    ctrl.keywords_aux = $location.search().keywords_aux?.split(",") || []

    ctrl.onKeywordAuxChange = keywords => {
        console.log("🚀 ~ keywords:", keywords, ctrl.keyword_aux)
        ctrl.keywords_aux = keywords
        ctrl.refreshData()
    }

    ctrl.onSliderChange = () => {
        $location.search("intervall", ctrl.filters["sort_date_imprint.date:range"].join(","))
        ctrl.parts_page.current = 1
        ctrl.refreshData()
    }

    ctrl.isEpub = $location.path() == "/epub"
    ctrl.isLibrary = $location.path() == "/bibliotek"

    ctrl.isPristine = () => {
        if (ctrl.initialLoading) return true
        let [from, to] = ctrl.filters["sort_date_imprint.date:range"]
        return (
            !ctrl.filter &&
            Object.values(
                _.pick(ctrl.filters, ["authorkeyword", "keywords", "languages", "mediatypes"])
            ).every(arr => !arr.length) &&
            !ctrl.filters.gender &&
            !ctrl.keywords_aux.length &&
            ctrl.chronology_floor == from &&
            ctrl.chronology_ceil == to &&
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
        ctrl.filters,
        _.mapValues(listKeys, val => val.split(","))
    )
    ctrl.filters = _.omitBy(ctrl.filters, _.isNil)

    ctrl.currentAuthors = []
    ctrl.currentPartAuthors = []

    ctrl.normalizeAuthor = $filter("normalizeAuthor")

    ctrl.getTitleTooltip = function (attrs) {
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
            safeApply($scope, () => {
                console.log("popstate", $location.search().visa)
                ctrl.listType = $location.search().visa || "all"
            })
        })
    )

    ctrl.filterTitle = function (row) {
        const auths = _.map(row.authors, auth => auth.full_name).join(" ")

        const exprs = ctrl.rowfilter.split(" ")

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
    ctrl.onAboutAuthorChange = _.once(function ($event) {
        if ($location.search().about_authors) {
            ctrl.filters["authorkeyword>authorid"] = ($location.search().about_authors || "").split(
                ","
            )
        }

        aboutDef.resolve()
    })

    $q.all([aboutDef.promise, authors]).then(function () {
        return $timeout(() => {
            angular.element(document.querySelectorAll(".about_select")).select2()
        }, 100)
    })

    ctrl.resetView = function () {
        ctrl.filters = {
            "sort_date_imprint.date:range": ctrl.filters["sort_date_imprint.date:range"]
        }
        $scope.$broadcast("chronology-reset")

        $timeout(
            () =>
                angular
                    .element(
                        document.querySelectorAll(".gender_select, .keyword_select, .about_select")
                    )
                    .select2(),
            0
        )
        ctrl.filter = ""
        ctrl.rowfilter = ""
        ctrl.all_titles = null
        ctrl.keywords_aux = []
        ctrl.parts_page.current = 1
        $location.search("hide1800", null)
        ctrl.refreshData()
    }

    ctrl.hasMediatype = function (titleobj, mediatype) {
        return _.map(titleobj.mediatypes, "label").includes(mediatype)
    }

    ctrl.pickMediatypes = (titleobj, mediatypeLabels) =>
        _.filter(titleobj.mediatypes, item => mediatypeLabels.includes(item.label))

    ctrl.sortMedia = function (list) {
        const order = ["etext", "faksimil", "epub", "pdf"]
        // first keep the keys in the order list, then readd the ones that weren't there.
        return _.intersection(order, list).concat(_.difference(list, order))
    }

    ctrl.setDateRange = (from, to) => {
        console.log("from, to", from, to)
        ctrl.filters["sort_date_imprint.date:range"][0] = from
        ctrl.filters["sort_date_imprint.date:range"][1] = to
        ctrl.onSliderChange()
    }

    ctrl.getTitleId = row => row.work_titleid

    const toSafeTitleIdPart = value =>
        String(value || "")
            .split("")
            .map(char =>
                /^[A-Za-z0-9_-]$/.test(char) ? char : `_${char.charCodeAt(0).toString(16)}_`
            )
            .join("")

    ctrl.getUniqId = function (title) {
        if (!title) {
            return
        }
        const titleKey = title.titlepath || title.titleid || title.work_titleid
        return `${toSafeTitleIdPart(title.lbworkid)}-${toSafeTitleIdPart(titleKey)}`
    }
    ctrl.getTitleRowTrackId = function (row) {
        if (!row) {
            return
        }
        if (row.isHeader) {
            return `header:${row.label}`
        }
        return `title:${ctrl.getUniqId(row)}`
    }
    ctrl.titleRender = function () {
        console.log("titleRender")
        if (ctrl.listType == "epub" || ctrl.listType == "pdf") {
            return
        }
        if (
            $location.search()["title"] &&
            ctrl.titleByPath &&
            ctrl.titleByPath[$location.search()["title"]]
        ) {
            const title = ctrl.titleByPath[$location.search()["title"]][0]
            ctrl.titleClick(null, title)
            const id = ctrl.getUniqId(title)
            $scope.$emit("listScroll", id)
        } else {
            $location.search("title", null).replace()
        }
    }

    // use timeout to make sure the page shows before loading authors
    // $timeout () ->
    authors.then(function ([authorList, authorsById]) {
        ctrl.authorsById = authorsById
        ctrl.authorSearching = false
    })

    ctrl.filterChange = () => {
        console.log("filterchange")
    }

    $q.all([backend.getAboutAuthors(), authors]).then(function ([authorIds]) {
        ctrl.aboutAuthors = _.orderBy(authorIds, auth => {
            if (ctrl.authorsById[auth]) {
                return ctrl.authorsById[auth].surname
            }
        })
    })

    ctrl.sort = {
        all: "_score|desc",
        works: "popularity|desc",
        epub: "popularity|desc",
        pdf: "popularity|desc",
        authors: "popularity|desc",
        parts: "sortkey|asc",
        latest: "imported|desc,main_author.name_for_index|asc,sortkey|asc,sort_date_imprint.date|asc"
    }

    ctrl.sortItems = {
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
        ],
        latest: [
            {
                label: "Nytt",
                val: "imported",
                suffix: ",main_author.name_for_index|asc,sortkey|asc,sort_date_imprint.date|asc",
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
                suffix: ",sortkey|asc",
                dir: "asc"
            },
            {
                label: "Titel",
                val: "sortkey",
                dir: "asc",
                active: true
            }
        ]
    }
    ctrl.sortItems["epub"] = _.cloneDeep(ctrl.sortItems.works)
    ctrl.sortItems["pdf"] = _.cloneDeep(ctrl.sortItems.works)

    ctrl.tabObjects = [
        { label: "Enkel sökning", value: "enkel", current: true },
        { label: "Utökad sökning", value: "utökad", current: false }
        // { label: "Avancerad", value: "avancerad", current: false }
    ]
    ctrl.tabClick = function (tab) {
        ctrl.tabObjects.forEach(tab => (tab.current = false))
        tab.current = true
    }

    ctrl.refreshData = function (isInitial) {
        if (!isInitial) {
            ctrl.relevance_page.current = 1
            ctrl.parts_page.current = 1
            ctrl.titleModel["epub_currentpage"] = 1
            ctrl.titleModel["pdf_currentpage"] = 1
            ctrl.titleModel["works_currentpage"] = 1
            ctrl.titleModel["latest_currentpage"] = 1
        }
        ctrl.selectedTitle = null
        ctrl.rowfilter = ctrl.filter
        if (!isDev) {
            backend.logLibrary(ctrl.rowfilter)
        }

        if (ctrl.listType == "all") {
            ctrl.fetchByRelevance()
        }

        if (ctrl.listType == "latest") {
            ctrl.fetchRecent(false)
        }
        if (ctrl.isLibrary) {
            return Promise.all([
                ctrl.fetchWorks(ctrl.listType !== "works", false),
                ctrl.fetchWorks(ctrl.listType !== "epub", true),
                ctrl.fetchWorks(ctrl.listType !== "pdf", false, false, true),
                ctrl.fetchParts(ctrl.listType !== "parts")
            ])
        } else {
            return Promise.all([
                ctrl.fetchWorks(ctrl.listType !== "epub", true),
                ctrl.fetchWorks(ctrl.listType !== "pdf", false, false, true)
            ])
        }
    }
    ctrl.capitalizeLabel = label => {
        return { pdf: "PDF", xml: "XML" }[label] || label
    }

    let scandinavianFolding = str => str.toLowerCase().replace("æ", "ä").replace("ø", "ö")

    ctrl.setAuthorData = function () {
        let [key, dir] = (ctrl.sort.authors || "").split("|")
        let authorsList = [].concat(ctrl.currentAuthors, ctrl.currentPartAuthors)
        console.log("🚀 ~ currentPartAuthors:", ctrl.currentPartAuthors)

        authorsList = authorsList.filter(item => {
            let conds = []
            if (ctrl.filters.gender) {
                conds.push(item.gender == ctrl.filters.gender)
            }

            function checkForName(name, query_token) {
                let matchesNormalized = true
                let matchesScandinavian = true
                try {
                    matchesScandinavian = scandinavianFolding(name).match(
                        new RegExp(scandinavianFolding(query_token), "i")
                    )
                } catch (e) {}
                try {
                    matchesNormalized = ctrl
                        .normalizeAuthor(name)
                        .match(new RegExp(ctrl.normalizeAuthor(query_token), "i"))
                } catch (e) {}
                return matchesNormalized && matchesScandinavian
            }

            if (ctrl.filter) {
                conds.push(
                    ctrl.filter
                        .split(" ")
                        .map(str => {
                            let search =
                                item.full_name + " " + _.map(item.pseudonym, "full_name").join(" ")

                            return checkForName(search, str)
                        })
                        .some(Boolean)
                )
            }
            return conds.every(Boolean)
        })

        authorsList = _.uniq(authorsList, "authorid")
        if (key == "name_for_index") {
            ctrl.authorData = util.sortAuthors(authorsList, dir)
        } else {
            ctrl.authorData = _.orderBy(
                authorsList,
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
        }

        if (!ctrl.authorData.length) {
            backend.getAuthorSuggest(ctrl.filter).then(suggest => {
                if (suggest && suggest.length) {
                    ctrl.authorSuggest = suggest
                } else {
                    ctrl.authorSuggest = null
                }
            })
        }
    }
    ctrl.getIndex = longindex => longindex
    ctrl.getLabelBySource = item => {
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
    let relevanceRequestSeq = 0
    ctrl.fetchByRelevance = async countOnly => {
        ctrl.relevanceSearching = true
        ctrl.relevanceError = false
        const requestSeq = ++relevanceRequestSeq

        let filters = { ...ctrl.filters }
        if (
            filters["sort_date_imprint.date:range"][0] == ctrl.chronology_floor &&
            filters["sort_date_imprint.date:range"][1] == ctrl.chronology_ceil
        ) {
            delete filters["sort_date_imprint.date:range"]
        }

        let size = {
            from: (ctrl.relevance_page.current - 1) * 100,
            to: ctrl.relevance_page.current * 100
        }
        // let size = { to: 100 }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }
        try {
            let { titles, hits, suggest } = await backend.relevanceSearch(
                "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress",
                {
                    q: ctrl.rowfilter,
                    keyword_aux: [...ctrl.keywords_aux],
                    filters: filters,
                    show_all: false,
                    sort_field: ctrl.sort.all,
                    ...size
                },
                // TODO: we should be grouping, need to filter out authors though.
                true
            )

            if (requestSeq !== relevanceRequestSeq) {
                return
            }
            ctrl.relevanceData = titles
            ctrl.relevanceSuggest = suggest
            ctrl.relevanceSearching = false
            ctrl.relevance_hits = hits
            $scope.$apply()
            return { titles, hits }
        } catch (e) {
            if (requestSeq !== relevanceRequestSeq) {
                return
            }
            if (!e.xhrStatus == "abort") {
                console.error("relevance error", e)
                ctrl.relevanceSearching = false
                ctrl.relevanceError = true
                $scope.$apply()
            }
        }
    }

    let partRequestSeq = 0
    ctrl.fetchParts = countOnly => {
        // unless ctrl.filter then return
        ctrl.partSearching = true
        const requestSeq = ++partRequestSeq
        let filters = { ...ctrl.filters }
        if (
            filters["sort_date_imprint.date:range"][0] == ctrl.chronology_floor &&
            filters["sort_date_imprint.date:range"][1] == ctrl.chronology_ceil
        ) {
            delete filters["sort_date_imprint.date:range"]
        }
        let size = { from: (ctrl.parts_page.current - 1) * 100, to: ctrl.parts_page.current * 100 }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }
        const filterQuery = buildFilterQuery(filters)
        const keywordAux = [...ctrl.keywords_aux]
        const q = composeQuery({
            filterQuery,
            filterString: ctrl.rowfilter,
            keywordAux
        })
        let def = backend
            .getTitles("etext-part,faksimil-part", {
                sort_field: ctrl.sort.parts,
                q: q || "*",
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
                if (requestSeq !== partRequestSeq) {
                    return { stale: true }
                }
                ctrl.all_titles = titles
                ctrl.partSearching = false
                ctrl.parts_hits = hits
                ctrl.partSuggest = suggest
                return { titles, hits, author_aggs }
            })
        $q.all([def, authors]).then(([partResult]) => {
            if (requestSeq !== partRequestSeq || partResult.stale) {
                return
            }
            const { author_aggs } = partResult
            ctrl.currentPartAuthors = author_aggs.map(({ authorid }) => ctrl.authorsById[authorid])
            console.log("currentpartauthors part results obtained")
            ctrl.setAuthorData()
        })
    }

    ctrl.setFilter = f => {
        ctrl.filter = f
        ctrl.parts_page.current = 1
        ctrl.relevance_page.current = 1
        ctrl.refreshData()
    }

    ctrl.titleModel = {
        works: [],
        epub: [],
        pdf: [],
        latest: [],
        works_hits: 0,
        epub_hits: 0,
        pdf_hits: 0,
        latest_hits: 0,
        works_currentpage: 1,
        epub_currentpage: 1,
        pdf_currentpage: 1,
        latest_currentpage: 1
    }
    ctrl.fetchRecent = countOnly => {
        ctrl.fetchWorks(countOnly, false, true)
    }

    const titleRequestSeq = {}
    ctrl.fetchWorks = (countOnly, epubOnly, isSearchRecent, pdfOnly) => {
        let listID = "works"
        let maybeParams = {}
        if (epubOnly) listID = "epub"
        if (pdfOnly) {
            listID = "pdf"
            maybeParams["pdfOnly"] = true
        }

        if (isSearchRecent) listID = "latest"
        let page = ctrl.titleModel[ctrl.listType + "_currentpage"] - 1
        let size = {
            from: page * 100,
            to: (page + 1) * 100
        }
        if (countOnly) {
            size = { from: 0, to: 0 }
        }
        ctrl.titleSearching = true
        ctrl.titleModel[listID + "_searching"] = true
        const requestSeq = (titleRequestSeq[listID] || 0) + 1
        titleRequestSeq[listID] = requestSeq

        let filters = { ...ctrl.filters }
        if (
            filters["sort_date_imprint.date:range"][0] == ctrl.chronology_floor &&
            filters["sort_date_imprint.date:range"][1] == ctrl.chronology_ceil
        ) {
            delete filters["sort_date_imprint.date:range"]
        }
        const searchFilterString = ctrl.rowfilter
        const extraQueryClauses = []
        let filterString = searchFilterString
        if (ctrl.dl_mode) {
            extraQueryClauses.push("export>type:(xml OR txt OR workdb)")
        }
        if (epubOnly) {
            filters.has_epub = true
        } else if (pdfOnly) {
            extraQueryClauses.push("((export>type:pdf AND license:pd) OR mediatype:pdf)")
        }
        let maybeHide1800 =
            isSearchRecent && $location.search().hide1800 ? ["NOT keyword:1800"] : []
        if (maybeHide1800.length) {
            extraQueryClauses.push(...maybeHide1800)
        }
        filterString = [searchFilterString, ...extraQueryClauses].filter(Boolean).join(" AND ")

        const filterQuery = buildFilterQuery(filters)
        const keywordAux = [...ctrl.keywords_aux]
        console.log(
            "🚀 ~ filterQuery, filterString, keywordAux:",
            filterQuery,
            filterString,
            keywordAux
        )
        const q = composeQuery({ filterQuery, filterString, keywordAux })
        const getTitleResults = options =>
            backend.getTitles("etext,faksimil,pdf", {
                sort_field: ctrl.sort[listID],
                include:
                    "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain," +
                    "main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword",
                partial_string: true,
                author_aggs: true,
                imported_aggregation: listID == "latest",
                suggest: true,
                ...maybeParams,
                ...size,
                ...options
            })
        const def = getTitleResults({ q: q || "*" })
        return $q
            .all([def, authors])
            .then(([{ titles, author_aggs, suggest, hits, distinct_hits, imported_aggs }]) => {
                if (requestSeq !== titleRequestSeq[listID]) {
                    return
                }
                console.log(
                    "🚀 ~ file: library_controller.js:862 ~ hits, distinct_hits:",
                    listID,
                    hits,
                    distinct_hits,
                    imported_aggs
                )
                ctrl.titleByPath = _.groupBy(titles, item => item.titlepath)

                if (isSearchRecent) {
                    titles = decorateRecent(titles, imported_aggs)
                }
                ctrl.titleModel[listID] = titles
                ctrl.titleModel[listID + "_hits"] = distinct_hits
                ctrl.titleModel[listID + "_suggest"] = suggest
                ctrl.titleModel[listID + "_searching"] = false
                if (listID == "works" || listID == "parts") {
                    ctrl.currentAuthors = author_aggs.map(
                        ({ authorid }) => ctrl.authorsById[authorid]
                    )
                    console.log("ctrl.currentAuthors", ctrl.currentAuthors)
                    // make sure checkbox appears selected for works added to download list
                    if (ctrl.dl_mode && ctrl.downloads.length) {
                        for (let row of ctrl.downloads) {
                            if (ctrl.titleByPath[row.titlepath]) {
                                ctrl.titleByPath[row.titlepath][0]._download = true
                            }
                        }
                    }
                }
                if (listID == "works" || listID == "parts") {
                    ctrl.setAuthorData()
                }

                ctrl.titleSearching = false
            })
            .catch(err => {
                if (requestSeq !== titleRequestSeq[listID]) {
                    return
                }
                console.error("fetchWorks error", err)
                ctrl.titleSearching = false
                ctrl.titleModel[listID + "_searching"] = false
            })
    }

    ctrl.onSortClick = (item, noSwitchDir, replace, requestSortedData = true) => {
        console.log("onSortClick", ctrl.listType)
        if (item.active && !noSwitchDir) {
            item.dir = item.dir == "asc" ? "desc" : "asc"
            item.reversed = !item.reversed
        } else {
            for (let obj of ctrl.sortItems[ctrl.listType]) {
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
        ctrl.sort[ctrl.listType] = item.val + "|" + item.dir + (item.suffix || "")

        if (!requestSortedData) {
            return
        }
        if (ctrl.listType == "all") {
            ctrl.relevance_page.current = 1
            ctrl.fetchByRelevance(false)
        } else if (ctrl.listType == "works") {
            ctrl.fetchWorks(false, false)
        } else if (ctrl.listType == "parts") {
            ctrl.parts_page.current = 1
            ctrl.fetchParts(false)
        } else if (ctrl.listType == "epub") {
            ctrl.fetchWorks(false, true)
        } else if (ctrl.listType == "pdf") {
            ctrl.fetchWorks(false, false, false, true)
        } else if (ctrl.listType == "authors") {
            ctrl.setAuthorData()
        } else if (ctrl.listType == "latest") {
            ctrl.fetchRecent(false)
        }
    }
    let sortInit = $location.search().sort || "popularitet"

    let sortItem = _.find(ctrl.sortItems[ctrl.listType], function (item) {
        return item.search == sortInit
    })
    if (sortItem) {
        ctrl.onSortClick(sortItem, true, true, false)
    } else {
        console.warn("Sort state init failed", ctrl.listType, sortInit)
        $location.search({})
    }

    function decorateRecent(titles, imported_aggs) {
        const toDatestr = val => {
            if (!val && val !== 0) return null
            if (typeof val === "string") {
                // Normalize potential ISO strings to YYYY-MM-DD
                const ds = val.split("T")[0]
                return /\d{4}-\d{2}-\d{2}/.test(ds) ? ds : null
            }
            if (typeof val === "number") {
                const d = new Date(val)
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, "0")
                const day = String(d.getUTCDate()).padStart(2, "0")
                return `${y}-${m}-${day}`
            }
            return null
        }

        const dateFmt = function (datestr) {
            const months = `januari,februari,mars,april,maj,juni,juli,
                            augusti,september,oktober,november,december`
                .split(",")
                .map(s => s.trim())
            const [year, month, day] = datestr.split("-")
            return [Number(day), months[month - 1], year].join(" ")
        }

        // Build a lookup from imported date (YYYY-MM-DD) to doc_count
        const docCountByDate = {}
        if (Array.isArray(imported_aggs)) {
            for (const agg of imported_aggs) {
                const key = toDatestr(agg.imported)
                if (key) docCountByDate[key] = agg.doc_count
            }
        }

        let groupTitles = (titles, label) => {
            let output = []
            let titleGroups = _.groupBy(titles, item => _.max(_.map(item.mediatypes, "imported")))

            let datestrs = _.keys(titleGroups)
            if (label) label = ": " + label
            for (let datestr of datestrs) {
                const titles = titleGroups[datestr]
                const count = docCountByDate[toDatestr(datestr)]
                const countLabel = typeof count === "number" ? ` (${count} verk)` : ""
                output.push({
                    isHeader: true,
                    label: dateFmt(toDatestr(datestr) || datestr) + countLabel + label
                })
                output = output.concat(titles)
            }
            return output
        }
        return groupTitles(titles, "")
    }

    ctrl.getUrl = function (row, mediatype) {
        const authorid = row.authors[0].workauthor || row.authors[0].authorid

        if (mediatype === "epub") {
            return `txt/epub/${authorid}_${row.work_titleid}.epub`
        } else if (mediatype === "pdf") {
            return `txt/${row.lbworkid}/${row.lbworkid}.pdf`
        } else {
            return (
                `/författare/${authorid}/titlar/${ctrl.getTitleId(row)}/` +
                `sida/${row.startpagename}/${mediatype}`
            )
        }
    }

    ctrl.titleClick = function ($event, title) {
        if (ctrl.selectedTitle) {
            ctrl.selectedTitle._collapsed = false
            if (ctrl.selectedTitle == title) {
                ctrl.selectedTitle = null
                $location.search("title", null)
                return
            }
        }

        ctrl.selectedTitle = title
        ctrl.selectedTitle._collapsed = true
        $location.search("title", title.titlepath)
    }

    ctrl.getPartAuthor = part => part.authors?.[0] || part.work_authors?.[0]

    ctrl.downloadPopoverURL = downloadPopoverUrl
    ctrl.dl_mode = $location.search().nedladdning
    ctrl.setDownloadMode = () => {
        if (!ctrl.dl_mode) {
            ctrl.listType = "works"
            ctrl.dl_mode = true
            ctrl.downloads = []
            ctrl.fetchWorks(false, false)
        } else {
            ctrl.dl_mode = false
            ctrl.fetchWorks(false, false)
        }
    }

    ctrl.genderSelectSetup = {
        minimumResultsForSearch: -1,
        templateSelection(item) {
            if (!item.id || item.id == "all") {
                return "Filtrera: kvinnliga / manliga / alla"
            } else {
                return item.text
            }
        }
    }

    ctrl.onSelectVisible = () => {
        let works = []
        for (let row of ctrl.titleModel.works) {
            if (!row.isHeader) {
                row._download = true
                works.push(row)
            }
        }
        ctrl.downloads = _.uniq([...ctrl.downloads, ...works])
    }
    ctrl.onDeselectVisible = () => {
        let works = []
        for (let row of ctrl.titleModel.works) {
            if (!row.isHeader) {
                row._download = false
                works.push(row)
            }
        }
        ctrl.downloads = _.difference(ctrl.downloads, works)
    }

    ctrl.isAllVisibleSelected = () => {
        let rows = _.omit(ctrl.titleModel.works, "isHeader")
        return _.every(rows, "_download")
    }

    let notIsRowEq = (r1, r2) => !(r1.titlepath == r2.titlepath && r1.lbworkid == r2.lbworkid)

    ctrl.downloads = []
    ctrl.toggleDownload = (row, toggle) => {
        if (row.isHeader) return
        if (toggle) {
            row._download = !row._download
        }
        if (row._download) {
            ctrl.downloads.push(row)
        } else {
            ctrl.downloads = _.filter(ctrl.downloads, item => notIsRowEq(item, row))
        }
    }

    ctrl.clearDownloads = () => {
        for (let dl of ctrl.downloads) {
            dl._download = false
        }
        ctrl.downloads = []
    }

    ctrl.exportsFromMediatypes = (mediatype, types) => {
        let output = []
        for (let dl of ctrl.downloads) {
            for (let mt of dl.mediatypes) {
                if (mediatype == mt.label) {
                    output = [...output, ...mt.export.filter(exp => types.includes(exp.type))]
                }
            }
        }
        return output
    }

    ctrl.typesConf = {
        etext: [
            { id: "txt", label: "ren text" },
            { id: "xml" },
            { id: "workdb", label: "Metadata" }
        ],
        faksimil: [
            { id: "txt", label: "ren text" },
            { id: "xml" },
            { id: "workdb", label: "Metadata" },
            { id: "pdf" }
        ]
    }

    ctrl.getDownloadSet = () => {
        let { etext, faksimil } = ctrl.typesConf
        etext = _.filter(etext, "selected")
        faksimil = _.filter(faksimil, "selected")
        let output = []
        if (etext.length) {
            output = [...output, ...ctrl.exportsFromMediatypes("etext", _.map(etext, "id"))]
        }
        if (faksimil.length) {
            output = [...output, ...ctrl.exportsFromMediatypes("faksimil", _.map(faksimil, "id"))]
        }
        return output
    }

    ctrl.getSize = () => {
        let size = _.reduce(_.map(ctrl.getDownloadSet() || [], "size"), _.add)
        if (!size) {
            return null
        }
        if (size < 1050000) {
            return Math.round(size / 1024).toString() + " KB"
        }
        return (size / (1024 * 1024)).toFixed(2) + "MB"
    }

    function clickhandler(event) {
        // If click is inside a popover, stop propagation instead of closing
        if (event.target.closest(".popover")) {
            return
        }
        if (document.querySelector(".popover")) {
            window.safeApply($scope, () => {
                for (let type of [...ctrl.typesConf.etext, ...ctrl.typesConf.faksimil]) {
                    type.selected = false
                }
                ctrl.hidePopup = true
            })
            window.safeApply($scope, () => (ctrl.hidePopup = false))
        }
    }
    document.addEventListener("click", clickhandler)
    $scope.$on("$destroy", () => {
        window.removeEventListener("popstate", popState)
        routeChangeUnbind()
        document.removeEventListener("click", clickhandler)
    })
    ctrl.onDownload = () => {
        let exports = ctrl.getDownloadSet()
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

    const listValIn = val => (val || "").split(",")
    const listValOut = val => {
        return (val || []).join(",")
    }
    let isInitListType = false

    // setupHashComplex registers Angular watchers on $scope. Bridge selected
    // properties so those watchers read/write the component controller state.
    const bridgedProps = [
        "filter",
        "filters",
        "keywords_aux",
        "show_more",
        "showAllParts",
        "listType",
        "dl_mode",
        "parts_page"
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

    util.setupHashComplex($scope, [
        {
            key: "filter",
            // scope_name : "rowfilter"
            replace: false
        },
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
        {
            key: "avancerat",
            expr: "show_more"
        },
        {
            key: "alla_titlar",
            expr: "showAllParts"
        },
        {
            key: "visa",
            expr: "listType",
            default: "all",
            replace: false,
            post_change: function (listType) {
                console.log("post_change listType", listType)
                if (isInitListType) {
                    let sortItem = _.find(ctrl.sortItems[listType || "all"], function (item) {
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
    ])

    ctrl.initialLoading = true
    ctrl.refreshData(true).then(() => {
        ctrl.initialLoading = false
    })
}

LibraryPageCtrl.$inject = [
    "$scope",
    "backend",
    "util",
    "$timeout",
    "$location",
    "authors",
    "$rootElement",
    "$anchorScroll",
    "$q",
    "$filter",
    "LibraryStateService"
]

littb.component("libraryPage", {
    templateUrl: libraryUrl,
    controller: LibraryPageCtrl
})
