import authorInfoUrl from "../../../views/authorInfo.html?url"
import slaBiblinfoUrl from "../../../views/sla/biblinfo.html?url"

const angular = window.angular
const _ = window._
const $ = window.$
const c = typeof console !== "undefined" && console !== null ? console : { log: _.noop }
const littb = angular.module("littbApp")

class AuthorInfoPageCtrl {
    static $inject = [
        "$scope",
        "$location",
        "$rootScope",
        "backend",
        "$routeParams",
        "$http",
        "$document",
        "util",
        "$route",
        "authors",
        "$q",
        "$filter"
    ]

    constructor($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter) {
        this.$scope = $scope
        this.$location = $location
        this.$rootScope = $rootScope
        this.backend = backend
        this.$routeParams = $routeParams
        this.$http = $http
        this.$document = $document
        this.util = util
        this.$route = $route
        this.authors = authors
        this.$q = $q
        this.$filter = $filter
    }

    $onInit() {
        const s = this.$scope
        _.extend(s, this.$routeParams)

        if (this.$route.current.$$route.isSla) {
            s.slaMode = true
            s.author = "LagerlöfS"
            s.biblInfoLocation = slaBiblinfoUrl
        }

        s.showpage = null
        s.show_large = false
        s.show_more = true
        s.authorError = false

        this.backend.authorHasMapArticle(s.author).then(hasMapArticle => (s.hasMapArticle = hasMapArticle))

        const keydownHandler = (event) => {
            let abort =
                event.metaKey ||
                event.ctrlKey ||
                $("input:focus").length ||
                $("textarea:focus").length

            if (abort) return

            if (event.key === "i" && s.author) {
                navigator.clipboard.writeText(s.authorInfo.authorid_norm)
                s.$emit("notify", "Kopierade authorid")
                s.$apply()
            }
        }

        document.addEventListener("keydown", keydownHandler)
        s.$on("$destroy", () => document.removeEventListener("keydown", keydownHandler))

        s.getIntro = () => {
            if (!s.authorInfo) return
            if (s.isDramaweb) {
                return s.authorInfo.dramawebben.intro || s.authorInfo.intro
            } else {
                return s.authorInfo.intro
            }
        }

        s.getIntroAuthor = () => {
            if (!s.authorInfo) return
            if (s.isDramaweb && s.authorInfo.dramawebben.intro) {
                return s.authorInfo.dramawebben.intro_author
            } else {
                return s.authorInfo.intro_author
            }
        }

        s.getWikimediaFilePage = imageUrl => {
            if (!imageUrl) return
            let filename = imageUrl.split("/").pop()
            let baseUrl = "https://commons.wikimedia.org/wiki/File:"
            return baseUrl + filename
        }

        s.getWikiImage = () => {
            if (window.isDev) {
                return s?.authorInfo?.wikidata?.image?.replace(/^http:/, "https:")
            }
        }

        s.normalizeAuthor = this.$filter("normalizeAuthor")
        s.titleSort = this.util.titleSort
        s.authorPath = (authorid, ...segments) => {
            if (!authorid) {
                return
            }

            const encodedSegments = [authorid, ...segments]
                .filter(segment => segment !== undefined && segment !== null && segment !== "")
                .map(segment => encodeURIComponent(segment))

            return `/f%C3%B6rfattare/${encodedSegments.join("/")}`
        }

        this.authors.then(([authorList, authorsById]) => {
            s.authorsById = authorsById
        })

        s.showLargeImage = ($event) => {
            if (s.show_large) return
            s.show_large = true
            $event.stopPropagation()
            this.$document.one("click", (event) => {
                if (event.button !== 0) return
                s.$apply(() => (s.show_large = false))
            })
        }

        s.getTitleTooltip = (attrs) => {
            if (!attrs) return
            if (attrs.shorttitle !== attrs.title) return attrs.title
        }

        const refreshRoute = () => {
            s.showpage = this.$location.path().split("/")[3]
            if (!s.showpage) s.showpage = "introduktion"
        }

        s.getUnique = worklist =>
            _.filter(worklist, item => !Array.from(item.titlepath).includes("/"))

        s.getPageTitle = page =>
            ({
                titlar: "Tillgängliga verk",
                dramawebben: "Introduktion av Dramawebben",
                semer: "Mera om",
                biblinfo: "Bibliografisk databas",
                omtexterna: "Om texterna"
            }[page] || _.str.capitalize(page))

        s.getAllTitles = () => [].concat(s.groupedTitles, s.groupedWorks, s.groupedEditorWorks)

        s.getUrl = (work) => {
            let url
            const auth = s.getWorkAuthor(work.authors).authorid
            if (work.mediatype === "epub") {
                url = `txt/epub/${auth}_${work.work_titleid}.epub`
            } else if (work.mediatype === "pdf") {
                url = `txt/${work.lbworkid}/${work.lbworkid}.pdf`
            } else {
                url = `/författare/${auth}/titlar/${work.work_titleid}/`
                url += `sida/${work.startpagename}/${work.mediatype}`
            }
            return url
        }

        const getHtml = (url) => {
            const def = this.$q.defer()
            this.$http.get(url).then((response) => {
                let xml = response.data
                const from = xml.indexOf("<body>")
                const to = xml.indexOf("</body>")
                xml = xml.slice(from, to + "</body>".length)
                def.resolve(_.str.trim(xml))
            })
            return def.promise
        }

        const refreshExternalDoc = (page, routeParams) => {
            if (!s.authorInfo) return
            let url
            c.log("refreshExternalDoc", page, routeParams.omtexternaDoc)
            if (s.slaMode) {
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
                if (page === "mer") page = "semer"
                url = `/red/forfattare/${s.authorInfo.authorid_norm}/${page}/index.html`
            }

            if (!url) return

            if (!["introduktion", "titlar"].includes(s.showpage)) {
                return getHtml(url).then((xml) => {
                    s.externalDoc = xml
                    if (s.showpage === "omtexterna") {
                        s.pagelinks = harvestLinks(s.externalDoc)
                    } else {
                        s.pagelinks = null
                    }
                })
            }
        }

        const harvestLinks = (doc) => {
            const elemsTuples = $(".footnotes .footnote[id^=ftn]", doc)
                .get()
                .map(elem => [$(elem).attr("id"), $(elem).html()])
            s.noteMapping = _.fromPairs(elemsTuples)
        }

        refreshRoute()

        s.$on("$routeChangeError", (event, current, prev, rejection) => {
            _.extend(s, current.pathParams)
            refreshRoute()
            refreshExternalDoc(s.showpage, current.pathParams)
        })

        s.getDataSource = () => {
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
                def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf,infopost", "main,scholar")
            },
            {
                label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
                data: null,
                showAuthor: false,
                def: this.backend.getPartsInOthersWorks(s.author, "sortkey|desc")
            },
            {
                label: "Som fotograf",
                data: null,
                showAuthor(work) { return work["authors"] },
                def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "photographer")
            },
            {
                label: "Som illustratör",
                data: null,
                showAuthor(work) { return work["authors"] },
                def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "illustrator")
            },
            {
                label: "Som utgivare",
                data: null,
                showAuthor(work) { return work["authors"] },
                def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "editor")
            },
            {
                label: "Som översättare",
                data: null,
                showAuthor(work) { return work["authors"] },
                def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "translator")
            }
        ]

        s.getSortOrder = (obj) => {
            if (obj.showAuthor === false) {
                return "sortkey"
            } else {
                return ["main_author.name_for_index", "sortkey"]
            }
        }

        for (let item of s.titleStruct) {
            ;(item => item.def.then(data => {
                c.log("then", data)
                item.data = data
            }))(item)
        }

        this.backend.getAuthorInfo(s.author).then(
            (data) => {
                if (!data) return

                s.authorInfo = data

                refreshExternalDoc(s.showpage, this.$routeParams)
                this.backend
                    .hasAudioPage(s.authorInfo.authorid_norm)
                    .then(hasPage => (s.hasAudioPage = hasPage))

                s.moreStruct = [
                    {
                        label: `Verk om ${s.authorInfo.full_name}`,
                        data: null,
                        def: this.backend
                            .getTextByAuthor(s.author, "etext,faksimil,pdf,infopost", null, true)
                            .then(data => {
                                s.maybePresentationWork = data.filter(x =>
                                    x.keyword?.includes("LB-författarpresentation")
                                )?.[0]
                                return data
                            }),
                        showAuthor(work) { return work["authors"] }
                    },
                    {
                        label: `Kortare texter om ${s.authorInfo.full_name}`,
                        data: null,
                        def: this.backend.getPartsInOthersWorks(s.author, "main_author.name_for_index|desc", true),
                        showAuthor(work) { return work["authors"] || work["work_authors"] }
                    },
                    {
                        label: "Som utgivare",
                        data: null,
                        def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "editor", true),
                        showAuthor(work) { return work["authors"] }
                    },
                    {
                        label: "Som översättare",
                        data: null,
                        def: this.backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "translator", true),
                        showAuthor(work) { return work["authors"] }
                    }
                ]

                for (let item of s.moreStruct) {
                    ;(item => item.def.then(data => (item.data = data)))(item)
                }

                if (!(s.authorInfo.intro || (s.authorInfo.dramawebben && s.authorInfo.dramawebben.intro))) {
                    this.$location.url(`/författare/${s.author}/titlar`).replace()
                } else if (!s.authorInfo.intro && s.authorInfo.dramawebben && s.authorInfo.dramawebben.intro) {
                    this.$location.url(`/författare/${s.author}/dramawebben`).replace()
                }
            },
            (data) => {
                c.log("authorinfo error", arguments)
                s.authorError = true
            }
        )
    }
}

littb.component("authorInfoPage", {
    templateUrl: authorInfoUrl,
    controller: AuthorInfoPageCtrl
})
