const angular = window.angular
const _ = window._
const $ = window.$
const isDev = window.isDev

const c = (window.c =
    typeof console !== "undefined" && console !== null ? console : { log: _.noop })
const littb = angular.module("littbApp")

document.addEventListener("keydown", function (event) {
    let abort =
        event.metaKey || event.ctrlKey || $("input:focus").length || $("textarea:focus").length

    if (abort) {
        return
    }

    switch (event.key) {
        case "F19":
        case "®":
        case "ŗ":
            if (location.host == "localhost:9000") {
                location.host = "litteraturbanken.se:80"
            } else {
                location.hostname =
                    location.hostname == "litteraturbanken.se"
                        ? "red.Litteraturbanken.se"
                        : "litteraturbanken.se"
            }
            break
        case "b":
            location.href = $(".mainnav a[href^='/bibliotek']").attr("href")
            break
        case "h":
            location.pathname = "/historik"
            break
    }
})

document.addEventListener("paste", function (event) {
    const paste = (event.clipboardData || window.clipboardData).getData("text")
    if ($(":focus").length) return
    const lbPattern = /lb\w+/g
    const matches = paste.match(lbPattern)
    if (matches) {
        if (matches.length === 1) {
            window.location.href = `/editor/${matches[0]}/ix/0/f`
        } else {
            const filter = matches.map(match => `lbworkid:${match}`).join("%20OR%20")
            window.location.href = `/bibliotek?filter=${filter}&visa=works&sort=popularitet`
        }
    }
})

function sortObjectKeys(obj) {
    // Separate keys into two arrays based on their type
    let simpleKeys = []
    let complexKeys = []
    for (let key in obj) {
        if (
            typeof obj[key] === "string" ||
            typeof obj[key] === "number" ||
            typeof obj[key] === "boolean"
        ) {
            simpleKeys.push(key)
        } else {
            complexKeys.push(key)
        }
    }

    // Sort each array of keys
    simpleKeys.sort()
    complexKeys.sort()

    // Create a new object with the sorted keys
    let sortedObj = {}
    for (let key of simpleKeys.concat(complexKeys)) {
        sortedObj[key] = obj[key]
    }

    return sortedObj
}

littb.filter(
    "formatAuthors",
    () =>
        function (authorlist, makeLink, noHTML) {
            let et, strings
            if (!authorlist || !authorlist.length) {
                return
            }

            const stringify = function (auth) {
                let suffix =
                    {
                        editor: " <span class='authortype'>red.</span>",
                        translator: " <span class='authortype'>övers.</span>",
                        illustrator: " <span class='authortype'>ill.</span>",
                        photographer: " <span class='authortype'>fotogr.</span>"
                        // scholar : " (red.)"
                    }[auth.type] || ""
                if (noHTML) {
                    suffix = $(suffix).text()
                }
                return auth.full_name + suffix
            }

            const linkify = auth =>
                $("<a>")
                    .attr("href", `/författare/${auth.authorid}`)
                    .html(stringify(auth))
                    .outerHTML()

            if (makeLink) {
                strings = _.map(authorlist, linkify)
            } else {
                strings = _.map(authorlist, stringify)
            }

            const firsts = strings.slice(0, -1)
            const last = _.last(strings)

            if (noHTML) {
                et = "&"
            } else {
                et = "<em class='font-normal'>&</em>"
            }
            if (firsts.length) {
                return `${firsts.join(", ")} ${et} ${last}`
            } else {
                return last
            }
        }
)

littb.filter("downloadMediatypes", () => obj => {
    if (!obj || !obj.mediatypes) {
        return []
    }
    return obj.mediatypes.filter(x => x.downloadable)
})

littb.filter("readMediatypes", function () {
    const read = ["etext", "faksimil", "infopost"]
    return obj => {
        if (!obj || !obj.mediatypes) {
            return []
        }
        return obj.mediatypes.filter(x => read.includes(x.label))
    }
})

c.time = angular.noop
c.timeEnd = angular.noop

littb.filter(
    "authorYear",
    () =>
        function (obj, parens) {
            if (!obj) {
                return
            }
            const isFalsy = val => !val || val === "0000"
            const birth = obj.birth != null ? obj.birth.plain : undefined
            const death = obj.death?.plain
            if (isFalsy(birth) && isFalsy(death)) {
                return ""
            }
            let ret = ""
            if (isFalsy(death)) {
                ret = `f. ${birth}`
            } else if (isFalsy(birth)) {
                ret = `d. ${death}`
            } else {
                ret = `${birth}-${death}`
            }

            if (parens) {
                return `(${ret})`
            } else {
                return ret
            }
        }
)

littb.controller("startCtrl", ($scope, $location, $rootScope, $http, $compile) => {
    $scope.gotoTitle = function (query) {
        let url
        if (!query) {
            url = "/titlar"
        } else {
            url = `/titlar?filter=${query}&selectedLetter=${query[0].toUpperCase()}`
        }

        return $scope.goto(url)
    }
    // let url = "/red/om/start/startsida-ny.html?" + $rootScope.cacheKiller()
    // $http.get(url).then(function (response) {
    //     console.log("🚀 ~ file: controllers.js ~ line 126 ~ response.data", response.data)
    //     let html = response.data
    //     if (!isDev) {
    //         html = html.replace(
    //             /(\/red\/bilder\/bakgrundsbilder\/.*?.jpg)/,
    //             "/cdn-cgi/image/format=auto/$1"
    //         )
    //     }
    //     $scope.startpage = html
    // })
})

littb.controller("contactFormCtrl", function ($scope, backend, $timeout, $location) {
    const s = $scope

    const fromSchool = $location.search().skola != null
    const isSOL = $location.search().sol != null

    if (isSOL) {
        s.message = "[Ang. Översättarlexikon]\n\n"
    }

    s.showContact = false
    s.showNewsletter = false
    s.showError = false

    const done = () =>
        $timeout(function () {
            s.showContact = false
            s.showNewsletter = false

            s.name = null
            s.email = null
            s.message = null
        }, 4000)

    const err = function () {
        s.showError = true
        s.showContact = false
        s.showNewsletter = false
        s.isLoading = false

        return $timeout(() => (s.showError = false), 4000)
    }

    s.submitContactForm = function () {
        let msg
        if (fromSchool) {
            msg = `[skola] ${s.message}`
        } else {
            msg = s.message
        }
        // svenskt oversattarlexikon?
        s.isLoading = true
        return backend.submitContactForm(s.name, s.email, msg, isSOL).then(function () {
            s.isLoading = false
            s.showContact = true
            done()
        }, err)
    }
    s.subscribe = function () {
        const msg = s.newsletterEmail + " vill bli tillagd på utskickslistan."
        backend.submitContactForm("Utskickslista", s.newsletterEmail, msg).then(function () {
            s.showNewsletter = true
            done()
        }, err)
    }
})

littb.controller("statsCtrl", function ($scope, backend) {
    const s = $scope

    backend.getStats().then(data => (s.statsData = data))

    backend
        .getTitles("etext,faksimil", { sort_field: "popularity|desc", to: 30 })
        .then(({ titles }) => {
            s.titleList = titles
        })

    return backend.getEpub(30).then(({ data, hits }) => (s.epubList = data))
})

littb.controller("biblinfoCtrl", function ($scope, backend) {
    const s = $scope
    let limit = true
    s.showHit = 0
    s.searching = false
    s.wf = ""

    s.showAll = () => (limit = false)

    s.increment = function () {
        limit = true
        return (s.entries != null ? s.entries[s.showHit + 1] : undefined) && s.showHit++
    }
    s.decrement = function () {
        limit = true
        return s.showHit && s.showHit--
    }

    s.getEntries = function () {
        if (limit) {
            return [s.entries != null ? s.entries[s.showHit] : undefined]
        } else {
            return s.entries
        }
    }

    s.getColumn1 = function (entry) {
        const pairs = _.toPairs(entry)
        const splitAt = Math.floor(pairs.length / 2)
        return _.fromPairs(pairs.slice(0, +splitAt + 1 || undefined))
    }

    s.getColumn2 = function (entry) {
        const pairs = _.toPairs(entry)
        const splitAt = Math.floor(pairs.length / 2)
        return _.fromPairs(pairs.slice(splitAt + 1))
    }

    s.submit = function () {
        let wf
        const names = ["manus", "tryckt_material", "annat_tryckt", "forskning"]
        const params = names.filter(x => s[x]).map(x => `resurs=${x}`)
        if (wf) {
            ;({ wf } = s)
        }
        s.searching = true

        return backend.getBiblinfo(params.join("&"), wf).then(function (data) {
            s.entries = data
            s.num_hits = data.length
            s.searching = false
        })
    }

    return s.submit()
})

littb.controller(
    "authorInfoCtrl",
    function authorInfoCtrl(
        $scope,
        $location,
        $rootScope,
        backend,
        $routeParams,
        $http,
        $document,
        util,
        $route,
        authors,
        $q,
        $filter
    ) {
        const s = $scope
        _.extend(s, $routeParams)

        if ($route.current.$$route.isSla) {
            s.slaMode = true
            s.author = "LagerlöfS"
            s.biblInfoLocation = require("../views/sla/biblinfo.html")
            s.compareLocation = require("../views/sla/textjamforelse.html")
        }

        s.showpage = null
        s.show_large = false
        s.show_more = true
        s.authorError = false

        backend
            .authorHasMapArticle(s.author)
            .then(hasMapArticle => (s.hasMapArticle = hasMapArticle))

        // Add keydown listener for "i" to copy author ID
        const keydownHandler = function (event) {
            let abort =
                event.metaKey ||
                event.ctrlKey ||
                $("input:focus").length ||
                $("textarea:focus").length

            if (abort) {
                return
            }

            if (event.key === "i" && s.author) {
                navigator.clipboard.writeText(s.authorInfo.authorid_norm)
                s.$emit("notify", "Kopierade authorid")
                s.$apply()
            }
        }

        document.addEventListener("keydown", keydownHandler)

        // Clean up listener when scope is destroyed
        s.$on("$destroy", function () {
            document.removeEventListener("keydown", keydownHandler)
        })

        s.getIntro = function () {
            if (!s.authorInfo) {
                return
            }
            if (s.isDramaweb) {
                return s.authorInfo.dramawebben.intro || s.authorInfo.intro
            } else {
                return s.authorInfo.intro
            }
        }

        s.getIntroAuthor = function () {
            if (!s.authorInfo) {
                return
            }
            if (s.isDramaweb && s.authorInfo.dramawebben.intro) {
                return s.authorInfo.dramawebben.intro_author
            } else {
                return s.authorInfo.intro_author
            }
        }

        s.getWikimediaFilePage = imageUrl => {
            if (!imageUrl) {
                return
            }
            // Extract the filename from the URL
            let filename = imageUrl.split("/").pop()

            // URL encode the filename
            // let encodedFilename = encodeURIComponent(filename)

            // Base URL of Wikimedia Commons file page
            let baseUrl = "https://commons.wikimedia.org/wiki/File:"

            // Return the file page URL
            return baseUrl + filename
        }

        s.getWikiImage = () => {
            if (window.isDev) {
                return s?.authorInfo?.wikidata?.image?.replace(/^http:/, "https:")
            }
        }

        s.normalizeAuthor = $filter("normalizeAuthor")

        s.titleSort = util.titleSort

        authors.then(function ([authorList, authorsById]) {
            s.authorsById = authorsById
        })

        s.showLargeImage = function ($event) {
            if (s.show_large) {
                return
            }
            s.show_large = true
            $event.stopPropagation()

            $document.one("click", function (event) {
                if (event.button !== 0) {
                    return
                }
                return s.$apply(() => (s.show_large = false))
            })
        }

        s.getTitleTooltip = function (attrs) {
            if (!attrs) {
                return
            }
            if (attrs.shorttitle !== attrs.title) {
                return attrs.title
            }
        }

        const refreshRoute = function () {
            s.showpage = $location.path().split("/")[3]
            if (!s.showpage) {
                s.showpage = "introduktion"
            }
        }

        s.getUnique = worklist =>
            _.filter(worklist, item => !Array.from(item.titlepath).includes("/"))

        s.getPageTitle = page =>
            ({
                titlar: "Verk i Litteraturbanken",
                dramawebben: "Introduktion av Dramawebben",
                semer: "Mera om",
                biblinfo: "Bibliografisk databas",
                jamfor: "Textkritisk verkstad",
                omtexterna: "Om texterna"
            }[page] || _.str.capitalize(page))

        s.getAllTitles = () => [].concat(s.groupedTitles, s.groupedWorks, s.groupedEditorWorks)

        s.getUrl = function (work) {
            let url
            const auth = s.getWorkAuthor(work.authors).authorid
            if (work.mediatype === "epub") {
                url = `txt/epub/${auth}_${work.work_titleid}.epub`
            } else if (work.mediatype === "pdf") {
                // url += "info"
                url = `txt/${work.lbworkid}/${work.lbworkid}.pdf`
            } else {
                url = `/författare/${auth}/titlar/${work.work_titleid}/`
                url += `sida/${work.startpagename}/${work.mediatype}`
            }
            return url
        }

        const getHtml = function (url) {
            const def = $q.defer()
            $http.get(url).then(function (response) {
                let xml = response.data
                const from = xml.indexOf("<body>")
                const to = xml.indexOf("</body>")
                xml = xml.slice(from, to + "</body>".length)
                return def.resolve(_.str.trim(xml))
            })
            return def.promise
        }

        // if (s.slaMode) {
        //     getHtml("/red/sla/OmSelmaLagerlofArkivet.html").then(xml => (s.slaIntro = xml))
        // }

        const refreshExternalDoc = function (page, routeParams) {
            if (!s.authorInfo) {
                return
            }
            // sla hack
            let url
            c.log("refreshExternalDoc", page, routeParams.omtexternaDoc)
            if (s.slaMode) {
                if (s.showpage == "jamfor") return
                let doc
                if (page === "omtexterna" && !routeParams.omtexternaDoc) {
                    doc = "omtexterna.html"
                } else if (_.str.endsWith(routeParams.omtexternaDoc, ".html")) {
                    doc = routeParams.omtexternaDoc
                }
                if (doc) {
                    url = `/red/sla/${doc}`
                } else {
                    url = `/red/forfattare/${s.authorInfo.authorid_norm}/${page}/index.html`
                }
            } else {
                // url = s.authorInfo[page]
                if (page === "mer") {
                    page = "semer"
                }
                url = `/red/forfattare/${s.authorInfo.authorid_norm}/${page}/index.html`
            }

            if (!url) {
                return
            }

            if (!["introduktion", "titlar"].includes(s.showpage)) {
                return getHtml(url).then(function (xml) {
                    s.externalDoc = xml
                    if (s.showpage === "omtexterna") {
                        s.pagelinks = harvestLinks(s.externalDoc)
                    } else {
                        s.pagelinks = null
                    }
                })
            }
        }

        var harvestLinks = function (doc) {
            const elemsTuples = $(".footnotes .footnote[id^=ftn]", doc)
                .get()
                .map(elem => [$(elem).attr("id"), $(elem).html()])

            s.noteMapping = _.fromPairs(elemsTuples)
        }

        refreshRoute()

        s.$on("$routeChangeError", function (event, current, prev, rejection) {
            _.extend(s, current.pathParams)

            refreshRoute()
            // refreshTitle()
            return refreshExternalDoc(s.showpage, current.pathParams)
        })

        s.getDataSource = function () {
            if (s.showpage === "titlar") {
                return s.titleStruct
            } else if (s.showpage === "mer") {
                c.log("showpage mer")
                return s.moreStruct
            }
        }

        s.sortOrder = works => works[0].sortkey

        s.hasMore = () => {
            if (!s.authorInfo) return
            return _.flatten(s.moreStruct.map(item => item.data || [])).length
        }

        s.titleStruct = [
            {
                label: "Tillgängliga verk",
                data: null,
                showAuthor: false,
                def: backend.getTextByAuthor(
                    s.author,
                    "etext,faksimil,pdf,infopost",
                    "main,scholar"
                )
            },
            {
                label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
                data: null,
                showAuthor: false,
                def: backend.getPartsInOthersWorks(s.author, "sortkey|desc")
            },
            {
                label: "Som fotograf",
                data: null,
                showAuthor(work) {
                    return work["authors"]
                },
                def: backend.getTextByAuthor(
                    s.author,
                    "etext,faksimil,pdf,etext-part,faksimil-part",
                    "photographer"
                )
            },
            {
                label: "Som illustratör",
                data: null,
                showAuthor(work) {
                    return work["authors"]
                },
                def: backend.getTextByAuthor(
                    s.author,
                    "etext,faksimil,pdf,etext-part,faksimil-part",
                    "illustrator"
                )
            },
            {
                label: "Som utgivare",
                data: null,
                showAuthor(work) {
                    return work["authors"]
                },
                def: backend.getTextByAuthor(
                    s.author,
                    "etext,faksimil,pdf,etext-part,faksimil-part",
                    "editor"
                )
            },
            {
                label: "Som översättare",
                data: null,
                showAuthor(work) {
                    return work["authors"]
                },
                def: backend.getTextByAuthor(
                    s.author,
                    "etext,faksimil,pdf,etext-part,faksimil-part",
                    "translator"
                )
            }
            // {
            //     label: "Som uppläsare",
            //     data: null,
            //     showAuthor(work) {
            //         return work["authors"]
            //     },
            //     def: backend.getAudioList({ reader: s.author })
            // },
            // {
            //     label: "Uppläsningar",
            //     data: null,
            //     showAuthor: false,
            //     def: backend.getAudioList({ authorid: s.author }),
            //     audioExtras: true
            // }
        ]
        s.getSortOrder = function (obj) {
            if (obj.showAuthor === false) {
                return "sortkey"
            } else {
                return ["main_author.name_for_index", "sortkey"]
            }
        }

        for (var item of s.titleStruct) {
            // TODO: error handling?
            ;(item =>
                item.def.then(function (data) {
                    c.log("then", data)
                    item.data = data
                }))(item)
        }

        backend.getAuthorInfo(s.author).then(
            function (data) {
                if (!data) {
                    return
                }

                s.authorInfo = data

                refreshExternalDoc(s.showpage, $routeParams)
                backend
                    .hasAudioPage(s.authorInfo.authorid_norm)
                    .then(hasPage => (s.hasAudioPage = hasPage))
                s.moreStruct = [
                    {
                        label: `Verk om ${s.authorInfo.full_name}`,
                        data: null,
                        def: backend
                            .getTextByAuthor(s.author, "etext,faksimil,pdf,infopost", null, true)
                            .then(data => {
                                s.maybePresentationWork = data.filter(x =>
                                    x.keyword?.includes("LB-presentation")
                                )?.[0]
                                return data
                            }),
                        showAuthor(work) {
                            return work["authors"]
                        }
                    },
                    {
                        label: `Kortare texter om ${s.authorInfo.full_name}`,
                        data: null,
                        def: backend.getPartsInOthersWorks(
                            s.author,
                            "main_author.name_for_index|desc",
                            true
                        ),
                        showAuthor(work) {
                            return work["authors"] || work["work_authors"]
                        }
                    },
                    {
                        label: "Som utgivare",
                        data: null,
                        def: backend.getTextByAuthor(
                            s.author,
                            "etext,faksimil,pdf",
                            "editor",
                            true
                        ),
                        showAuthor(work) {
                            return work["authors"]
                        }
                    },
                    {
                        label: "Som översättare",
                        data: null,
                        def: backend.getTextByAuthor(
                            s.author,
                            "etext,faksimil,pdf",
                            "translator",
                            true
                        ),
                        showAuthor(work) {
                            return work["authors"]
                        }
                    }
                ]

                for (item of s.moreStruct) {
                    ;(item => item.def.then(data => (item.data = data)))(item)
                }

                if (
                    !(
                        s.authorInfo.intro ||
                        (s.authorInfo.dramawebben && s.authorInfo.dramawebben.intro)
                    )
                ) {
                    $location.url(`/författare/${s.author}/titlar`).replace()
                } else if (
                    !s.authorInfo.intro &&
                    s.authorInfo.dramawebben &&
                    s.authorInfo.dramawebben.intro
                ) {
                    $location.url(`/författare/${s.author}/dramawebben`).replace()
                }
            },
            function (data) {
                c.log("authorinfo error", arguments)
                s.authorError = true
            }
        )
    }
)

littb.controller("helpCtrl", function ($scope, $http, util, $location) {
    const s = $scope
    const url = "/red/om/hjalp/hjalp.html"
    s.onNavClick = id => {
        s.ankare = id
        $location.search("ankare", id)
    }
    return $http.get(url).then(function ({ data }) {
        s.htmlContent = data
        s.labelArray = []
        for (let elem of $("[id]", data).get()) {
            const label = _.str.humanize(
                $(elem)
                    .attr("name")
                    .replace(/([A-Z])/g, " $1")
            )

            s.labelArray.push({
                label,
                id: $(elem).attr("id")
            })
        }
    })
})

littb.controller("aboutCtrl", function ($scope, $http, util, $location, $routeParams) {
    const s = $scope
    _.extend(s, $routeParams)
    s.$on("$routeChangeError", function (event, current, prev, rejection) {
        c.log("route change", current.pathParams)
        return _.extend(s, current.pathParams)
    })

    s.page = $routeParams.page
    s.getPage = page =>
        ({
            ide: "/red/om/ide/omlitteraturbanken.html",
            hjalp: require("../views/help.html"),
            mål: "/red/om/visioner/visioner.html",
            kontakt: require("../views/contactForm.html"),
            statistik: require("../views/stats.html"),
            rattigheter: "/red/om/rattigheter/rattigheter.html",
            tack: "/red/om/tack.html",
            organisation: "/red/om/ide/organisation.html",
            // "inenglish" : "/red/om/ide/inenglish.html",
            "english.html": "/red/om/ide/english.html",
            "deutsch.html": "/red/om/ide/deutsch.html",
            "francais.html": "/red/om/ide/francais.html"
        }[page])
})

littb.controller("presentationCtrl", function ($scope, $http, $routeParams, $location, util) {
    const s = $scope
    const url = "/red/presentationer/presentationerForfattare.html"
    s.isMain = true
    return $http.get(url).then(function ({ data }) {
        s.doc = data
        return util.setupHash(s, {
            ankare(val) {
                if (!val) {
                    $(window).scrollTop(0)
                    return
                }
                return $(window).scrollTop($(`#${val}`).offset().top)
            }
        })
    })
})

littb.controller("omtexternaCtrl", function ($scope, $routeParams) {
    const docPath = "/red/sla/omtexterna/"
    $scope.doc = docPath + ($routeParams["doc"] || "omtexterna.html")
})

littb.filter(
    "correctLink",
    () =>
        function (html) {
            const wrapper = $("<div>").append(html)
            $("img", wrapper).each(function () {
                const img = $(this)
                img.attr("src", `/red/bilder/gemensamt/${img.attr("src")}`)
            })
            return wrapper.html()
        }
)

littb.controller(
    "autocompleteCtrl",
    function ($scope, backend, $route, $location, $window, $timeout, $uibModal, $http) {
        const s = $scope
        const modal = null
        let prevFilter = null
        s.close = function () {
            s.lbworkid = null
            s.$broadcast("blur")
            // s.show_autocomplete = false
            s.completeObj = null
            c.log("close modal", s.modal, s)
            if (s.modal != null) {
                s.modal.close()
            }
            s.modal = null
        }

        s.onSelect = function (val) {
            c.log("scope", s)
            if (!isDev) {
                backend.logQuicksearch(prevFilter, val.label)
            }

            if (val.action && val.action(s) === false) {
                return
            }
            s.close()
            if (val.url) {
                $location.url(val.url)
            }
        }

        const getInfo = () =>
            $route.current.$$route.isReader
                ? $(".reader_main").scope().workinfo
                : $("#mainview").scope().authorInfo

        function infoAction() {
            if ($("#mainview").scope) {
                let obj = getInfo()
                if (!obj) return
                delete obj["filenameMap"]
                delete obj["content_vector"]
                s.info = JSON.stringify(sortObjectKeys(getInfo()), null, 2)
            }
        }

        s.autocomplete = function (val) {
            if (val) {
                prevFilter = val
                return backend.autocomplete(val).then(function (data) {
                    console.log("data", data, val, s)
                    let menu = [
                        {
                            label: "Start",
                            url: "/",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Bibliotek",
                            url: "/bibliotek",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Epub",
                            url: "/epub",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Ljud och bild",
                            url: "/ljudochbild",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Sök",
                            url: "/sok",
                            alt: ["Sok"],
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Presentationer",
                            url: "/presentationer",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Dramawebben",
                            url: "/dramawebben",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Nytillkommet",
                            url: "/bibliotek?sort=nytillkommet",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Skolan",
                            url: "/skolan",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Skolan/lyrik",
                            url: "/skolan/lyrik",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Om",
                            url: "/om/ide",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Hjälp",
                            url: "/om/hjalp",
                            alt: ["hjalp"],
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Kontakt",
                            url: "/om/kontakt",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Statistik",
                            url: "/om/statistik",
                            typeLabel: "Gå till sidan"
                        },
                        {
                            label: "Läshistorik",
                            url: "/historik",
                            typeLabel: "Gå till sidan"
                        }
                    ]

                    if ($route.current.$$route.isReader) {
                        pushIfRed({
                            label: "/id",
                            alt: ["id", "red"],
                            typeLabel: "[Red.]",
                            action() {
                                if ($(".reader_main").scope) {
                                    s.lbworkid = $(".reader_main").scope().workinfo.lbworkid
                                    navigator.clipboard.writeText(s.lbworkid)
                                }
                                return false
                            }
                        })

                        pushIfRed({
                            label: "/editor",
                            alt: ["editor", "red"],
                            typeLabel: "[Red.]",
                            action() {
                                let lbworkid = $(".reader_main").scope().workinfo.lbworkid
                                let ix = $(".reader_main").scope().pageix
                                let mediatype = $(".reader_main").scope().workinfo.mediatype[0]
                                window.location.pathname = `/editor/${lbworkid}/ix/${ix}/${mediatype}`
                                return false
                            }
                        })
                    }

                    function pushIfRed(obj) {
                        if (isDev) {
                            menu.push(obj)
                        }
                    }
                    if (
                        $route.current.$$route.isReader ||
                        $route.current.$$route.controller == "authorInfoCtrl"
                    ) {
                        pushIfRed({
                            label: "/info",
                            alt: ["info", "db", "red"],
                            typeLabel: "[Red.]",
                            action() {
                                infoAction()
                                return false
                            }
                        })
                    }
                    if (val.match(/^lb.*/)) {
                        menu.push({
                            label: val,
                            url: `/editor/${val}/ix/0/f`,
                            typeLabel: "[Red.] Gå till faksimileditorn"
                        })
                        menu.push({
                            label: val,
                            typeLabel: "[Red.] Sök i ftp",
                            action() {
                                $http({
                                    url: `https://red.litteraturbanken.se/hitta?q=${val}`
                                }).then(
                                    response => {
                                        console.log("response", response.data)

                                        s.htmlInfo = response.data.split("\n").map(url => {
                                            url = url.replace(/\/mnt/, "//mnt")
                                            let breadcrumbs = url
                                                .split("/")
                                                .slice(5)
                                                .map((part, index) => ({
                                                    label: part,
                                                    url: url
                                                        .split("/")
                                                        .slice(0, index + 6)
                                                        .join("/")
                                                }))
                                                .slice(0, -1)
                                            return { url, breadcrumbs }
                                        })
                                    },
                                    response => {
                                        console.log("response", response)
                                        s.$emit("notify", "Hittade inte red-tjänsten.")
                                    }
                                )
                                return false
                            }
                        })
                    }
                    menu = _.filter(menu, function (item) {
                        // if !isDev and item.typeLabel == "[Red.]" then return false
                        const exp = new RegExp(`^${val}`, "gi")
                        // alt = new RegExp(val, "gi")
                        return (
                            item.label.match(exp) ||
                            (item.alt && _.some(item.alt.map(item => item.match(exp))))
                        )
                    })
                    return data.concat(menu)
                })
            }
        }

        const show = function () {
            // s.show_autocomplete = true

            s.modal = $uibModal.open({
                templateUrl: "autocomplete.html",
                scope: s,
                windowClass: "autocomplete",
                size: "sm"
            })

            return $timeout(() => s.$broadcast("focus"), 0)
        }
        // s.show_autocomplete = false
        s.$on("show_autocomplete", () => show())
        return $($window).on("keydown", function (event) {
            switch (event.key) {
                case "Escape":
                    s.$apply(() => s.close())
                    break
                case "s":
                    if (!$("input:focus,textarea:focus,select:focus").length) {
                        s.$apply(() => show())
                    }
                    break
                case "F20":
                case "ı":
                case "ī":
                    if (!$("input:focus,textarea:focus,select:focus").length) {
                        s.$apply(() => {
                            show()
                            infoAction()
                        })
                    }
                    break
            }
        })
    }
)

littb.controller("idCtrl", function ($scope, backend, $routeParams, $location) {
    const s = $scope
    _.extend(s, $routeParams)
    if (s.id) {
        s.id = s.id.toLowerCase()
    }
    s.titles = []
    if (!_.str.startsWith(s.id, "lb")) {
        s.titles = [s.id]
        s.id = ""
    }

    backend.getTitles("etext,faksimil", { to: 10000 }).then(titleArray => (s.data = titleArray))

    s.idFilter = function (row) {
        if (!s.id) {
            return true
        }
        return row.lbworkid === s.id
    }

    s.rowFilter = function (row) {
        if (!s.titles.length) {
            return true
        }
        return _.some(
            _.map(s.titles, title => {
                if (!title) {
                    return false
                }
                return (
                    _.str.contains(row.titlepath.toLowerCase(), title.toLowerCase()) ||
                    _.str.contains(row.title.toLowerCase(), title.toLowerCase())
                )
            })
        )
    }

    s.textareaChange = function (titles) {
        s.id = ""
        s.titles = _.map(titles.split("\n"), row => _.str.strip(row.split("–")[1] || row))
    }
})

class Dramaweb {
    constructor(data) {
        const order = [
            "first_staged",
            "number_of_pages",
            "number_of_acts",
            "number_of_roles",
            "male_roles",
            "female_roles",
            "other_roles"
        ]
        this.roles = data.roles
        this.history = data.history
        const tableData = _.omit(data, "legacy_url", "roles", "history")
        this.orderedData = _.orderBy(_.toPairs(tableData), pair => order.indexOf(pair[0]))
    }

    format(key) {
        return (
            {
                roles(val) {
                    return val.join("<br>")
                }
            }[key] || (val => val.toString())
        )
    }

    getLabel(key) {
        return (
            {
                roles: "Rollista",
                first_staged: "Urpremiär",
                first_staged_in_sweden: "Svensk premiär",
                number_of_roles: "Antal roller",
                male_roles: "Antal män",
                female_roles: "Antal kvinnor",
                other_roles: "Antal övriga",
                number_of_pages: "Antal sidor",
                number_of_acts: "Antal akter",
                history: "Teaterkritik"
            }[key] || key
        )
    }
}

littb.controller(
    "sourceInfoCtrl",
    function sourceInfoCtrl(
        $scope,
        backend,
        $routeParams,
        $q,
        authors,
        $document,
        $location,
        $http
    ) {
        const s = $scope
        // _.extend s, $routeParams
        s.title = $routeParams.title
        s.author = $routeParams.author

        s.defaultErrataLimit = 8
        s.errataLimit = s.defaultErrataLimit
        s.isOpen = false
        s.show_large = false

        s.workinfoPromise.then(function () {
            c.log("workinfo", s.workinfo)
            const prov = backend.getProvenance(s.workinfo)
            const lic = backend.getLicense(s.workinfo)

            $q.all([prov, lic]).then(function ([provData, licenseData]) {
                let provtmpl = ""
                s.provenanceData = provData
                provtmpl = _.map(
                    provData,
                    prov => `<a href='${prov.link}'>${prov.fullname}</a>`
                ).join(" – ")
                s.licenseData = _.template(licenseData)({
                    provenance: provtmpl
                })
            })

            if (s.workinfo.dramawebben) {
                s.dramaweb = new Dramaweb(s.workinfo.dramawebben)
            }
            if (s.workinfo.content_vector) {
                $http
                    .get(`/api/get_similar/${s.workinfo.lbworkid}/${s.workinfo.mediatype}`)
                    .then(function (data) {
                        console.log("🚀 ~ file: controllers.js:1314 ~ data.data:", data.data)
                        s.similar = data.data.data
                    })
            }
        })
        s.log = (workinfo, mediatype) => {
            backend.logDownload(
                workinfo.authors[0].surname,
                workinfo.shorttitle || workinfo.title,
                workinfo.lbworkid,
                mediatype
            )
        }

        s.getValidAuthors = function () {
            if (!s.workinfo) {
                return
            }
            return s.workinfo.authors
        }

        s.toggleErrata = function () {
            s.errataLimit = s.isOpen ? 8 : 1000
            s.isOpen = !s.isOpen
        }

        s.getUrl = function (mediatype) {
            if (!s.workinfo) {
                return
            }
            if (mediatype === "epub") {
                return s.workinfo.epub.url
            } else if (mediatype === "pdf") {
                return s.workinfo.pdf.url
            }

            return `/författare/${s.author}/titlar/${s.title}/${mediatype}`
        }

        s.getSourceImage = function () {
            if (s.workinfo) {
                return `/txt/${s.workinfo.lbworkid}/${s.workinfo.lbworkid}_small.jpeg 1x, /txt/${s.workinfo.lbworkid}/${s.workinfo.lbworkid}_large.jpeg 2x `
            }
        }

        s.showLargeImage = function ($event) {
            if (s.show_large) {
                return
            }
            s.show_large = true
            $event.stopPropagation()

            $document.one("click", function (event) {
                if (event.button !== 0) {
                    return
                }
                return s.$apply(() => (s.show_large = false))
            })
        }

        // s.getFileSize = function(mediatype) {
        //     if (!(s.workinfo && mediatype)) {
        //         return
        //     }
        //     const size = s.workinfo[mediatype].file_size
        //     const kb = size / 1024
        //     return Math.round(kb) + " KB"
        // }

        if (!s.mediatype) {
            s.mediatype = s.workinfo.mediatypes[0]
        }
        authors.then(function ([authorList, authorsById]) {
            s.authorsById = authorsById
        })
    }
)

littb.controller(
    "lexiconCtrl",
    function ($scope, backend, $location, $rootScope, $q, $timeout, $uibModal, util, $window) {
        const s = $scope
        s.dict_not_found = null
        s.dict_searching = false

        let modal = null

        s.keydown = function (event) {
            if (event.keyCode === 40) {
                // down arrow
                // TODO: this is pretty bad but couldn't be done using the typeahead directive
                if ($(".input_container .dropdown-menu").is(":hidden")) {
                    // typeaheadTrigger directive
                    s.$broadcast("open", s.lex_article)
                }
            } else if (event.keyCode === 27) {
                // escape
                s.lex_article = null
            }
        }

        s.showModal = function () {
            c.log("showModal", modal)
            s.lexemes = s.lex_article.lexemes
            if (!modal) {
                s.$broadcast("blur")

                modal = $uibModal.open({
                    templateUrl: "so_modal_template.html",
                    scope: s
                })

                modal.result.then(
                    () => s.closeModal(),
                    () => s.closeModal()
                )
            }
        }

        s.clickX = () => modal.close()

        s.closeModal = function () {
            s.lex_article = null
            s.lexid = null
            modal = null
        }

        const reportDictError = function () {
            s.$emit("notify", "Hittade inget uppslag")
            s.dict_searching = false
        }

        s.lexid = null

        $rootScope.$on("search_dict", function (event, lemma, id, doSearchId) {
            c.log("search_dict event", lemma, id, doSearchId)
            if (doSearchId) {
                s.lexid = false
            }

            s.dict_searching = true

            const def = backend.searchLexicon(lemma, id, false, doSearchId, true)
            def.catch(function () {
                c.log("searchLexicon catch")
                reportDictError()
            })

            def.then(function (data) {
                c.log("searchLexicon then", data)
                s.dict_searching = false

                let result = data[0]
                for (let obj of data) {
                    if (obj.baseform === lemma) {
                        result = obj
                        continue
                    }
                }

                // c.log "searchId", id
                // s.lexid = if searchId then searchId else null
                s.lex_article = result
                if (id) {
                    s.lexid = id
                }
                s.showModal()
            })
        })

        s.getWords = function (val) {
            c.log("getWords", val)
            if (!val) {
                return
            }
            s.dict_searching = true
            const def = backend.searchLexicon(val, null, true)
            const timeout = $timeout(angular.noop, 800)
            def.catch(function () {
                s.dict_searching = false
                reportDictError()
            })

            $q.all([def, timeout]).then(() => (s.dict_searching = false))

            return def
        }

        return util.setupHashComplex(s, [
            {
                key: "so",
                expr: "lex_article.baseform",
                val_in(val) {
                    const id = $location.search().lex
                    // event = if id then "search_id" else "search_dict"
                    c.log("val_in", val, id)
                    return s.$emit("search_dict", val, id, false)
                },
                replace: false
            },
            {
                key: "lex",
                scope_name: "lexid",
                replace: false
            }
        ])
    }
)

littb.controller("historyCtrl", function ($scope, $rootScope, authors) {
    $scope.lastPageViews = JSON.parse(localStorage.getItem("lastPageViews")) || []
    authors.then(function ([authorList, authorsById]) {
        $scope.authorsById = authorsById
    })
})
