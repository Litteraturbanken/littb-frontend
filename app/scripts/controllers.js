import sourceInfoUrl from "../views/sourceInfo.html?url"

// Component imports (extracted from this file)
import "./components/page-start/index.js"
import "./components/contact-form/index.js"
import "./components/stats-page/index.js"
import "./components/help-page/index.js"
import "./components/about-page/index.js"
import "./components/presentations-page/index.js"
import "./components/sla-omtexterna/index.js"
import "./components/history-page/index.js"
import "./components/sla-biblinfo/index.js"
import "./components/author-info-page/index.js"
import "./components/id-page/index.js"
import "./components/autocomplete-global/index.js"
import "./components/lexicon-global/index.js"

const angular = window.angular
const _ = window._
const $ = window.$

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
        case "\u00AE":
        case "\u0157":
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

function SourceInfoPanelCtrl($scope, backend, $routeParams, $q, authors, $document, $location, $http) {
    const s = $scope
    const ctrl = this

    function syncBindings() {
        if (ctrl.workinfo !== undefined) s.workinfo = ctrl.workinfo
        if (ctrl.workinfoPromise !== undefined) s.workinfoPromise = ctrl.workinfoPromise
        if (ctrl.author !== undefined) s.author = ctrl.author
        if (ctrl.title !== undefined) s.title = ctrl.title
        if (ctrl.mediatype !== undefined) s.mediatype = ctrl.mediatype
    }

    ctrl.$onInit = function () {
        syncBindings()

        // Fallbacks for legacy contexts.
        if (!s.title) s.title = $routeParams.title
        if (!s.author) s.author = $routeParams.author

        s.defaultErrataLimit = 8
        s.errataLimit = s.defaultErrataLimit
        s.isOpen = false
        s.show_large = false

        if (s.workinfoPromise && typeof s.workinfoPromise.then === "function") {
            s.workinfoPromise.then(function (workinfo) {
                if (workinfo) {
                    s.workinfo = workinfo
                }
                if (!s.workinfo) {
                    return
                }

                c.log("workinfo", s.workinfo)

                // Some contexts (Dramaweb modal) only provide workinfo; derive routing bits from it.
                if (!s.author) s.author = s.workinfo?.authors?.[0]?.authorid
                if (!s.title) s.title = s.workinfo?.titlepath

                const prov = backend.getProvenance(s.workinfo)
                const lic = backend.getLicense(s.workinfo)

                $q.all([prov, lic]).then(function ([provData, licenseData]) {
                    let provtmpl = ""
                    s.provenanceData = provData
                    provtmpl = _.map(
                        provData,
                        prov => `<a href='${prov.link}'>${prov.fullname}</a>`
                    ).join(" \u2013 ")
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
                            console.log("controllers.js ~ data.data:", data.data)
                            s.similar = data.data.data
                        })
                }
            })
        }

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

        if (!s.mediatype && s.workinfo?.mediatypes?.length) {
            s.mediatype = s.workinfo.mediatypes[0]
        }
        authors.then(function ([authorList, authorsById]) {
            s.authorsById = authorsById
        })
    }

    ctrl.$onChanges = function () {
        syncBindings()
    }
}

SourceInfoPanelCtrl.$inject = [
    "$scope",
    "backend",
    "$routeParams",
    "$q",
    "authors",
    "$document",
    "$location",
    "$http"
]

littb.component("sourceInfoPanel", {
    templateUrl: sourceInfoUrl,
    controller: SourceInfoPanelCtrl,
    bindings: {
        workinfo: "<?",
        workinfoPromise: "<?",
        author: "<?",
        title: "<?",
        mediatype: "<?"
    }
})
