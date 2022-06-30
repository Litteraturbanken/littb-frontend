const angular = window.angular
const _ = window._
const jQuery = window.jQuery
const c = window.console
import bodybuilder from "bodybuilder"
import { fromFilters } from "./query.ts"

const littb = angular.module("littbApp")
let SIZE_VALS = [625, 750, 1100, 1500, 2050]

// let STRIX_URL = "http://" + location.host.split(":")[0] + ":5001"
// let STRIX_URL = "https://litteraturbanken.se/api"
let STRIX_URL = "/api"

if (
    _.str.startsWith(location.host, "red.l") ||
    _.str.startsWith(location.host, "dev.l") ||
    _.str.startsWith(location.host, "litteraturbanken") ||
    process.env.NODE_ENV === "production"
) {
    STRIX_URL = "/api"
}

var relevanceCanceller

littb.factory(
    "debounce",
    $timeout =>
        function (func, wait, options) {
            let leading
            let args = null
            let inited = null
            let result = null
            let thisArg = null
            let timeoutDeferred = null
            let trailing = true

            const delayed = function () {
                inited = timeoutDeferred = null
                if (trailing) {
                    result = func.apply(thisArg, args)
                }
            }
            if (options === true) {
                leading = true
                trailing = false
            } else if (options && angular.isObject(options)) {
                ;({ leading } = options)
                trailing = "trailing" in options ? options.trailing : trailing
            }
            return function () {
                args = arguments
                thisArg = this
                $timeout.cancel(timeoutDeferred)
                if (!inited && leading) {
                    inited = true
                    result = func.apply(thisArg, args)
                } else {
                    timeoutDeferred = $timeout(delayed, wait)
                }
                return result
            }
        }
)

// writeDownloadableUrl = (toWorkObj) ->

const expandMediatypes = function (works, mainMediatype) {
    const order = ["etext", "faksimil", "epub", "pdf", "infopost"]
    const groups = _.groupBy(works, item => item.titlepath + item.lbworkid)
    const output = []
    const getMainAuthor = metadata =>
        (metadata.work_authors || metadata.authors || [metadata.main_author])[0]

    const makeObj = function (metadata) {
        if (metadata.mediatype === "pdf") {
            return {
                label: metadata.mediatype,
                url: `txt/${metadata.lbworkid}/${metadata.lbworkid}.pdf`,
                downloadable: true,
                imported: metadata.imported
            }
        } else if (metadata.mediatype === "infopost") {
            return {
                label: metadata.mediatype,
                url: `/dramawebben/pjäser?om-boken&authorid=${metadata.authors[0].authorid}&titlepath=${metadata.titlepath}`,
                imported: metadata.imported
            }
        } else {
            return {
                label: metadata.mediatype,
                url: `/författare/${getMainAuthor(metadata).authorid}/titlar/${
                    metadata.work_titleid || metadata.titleid
                }/sida/${metadata.startpagename}/${metadata.mediatype}`,
                imported: metadata.imported,
                export: _.map(metadata.export, exp => {
                    exp.lbworkid = metadata.lbworkid
                    exp.mediatype = metadata.mediatype
                    return exp
                })
            }
        }
    }

    for (let key in groups) {
        let group = groups[key]
        const sortWorks = function (work) {
            if (mainMediatype && work.mediatype === mainMediatype) {
                return -10
            } else {
                return _.indexOf(order, work.mediatype)
            }
        }
        group = _.sortBy(group, sortWorks)
        const [main, ...rest] = group

        main.work_titleid = main.work_titleid || main.titleid

        let mediatypes = [makeObj(main)]
        mediatypes = mediatypes.concat(_.map(rest, makeObj))

        // if main.has_epub
        for (let work of group) {
            if (work.has_epub) {
                mediatypes.push({
                    label: "epub",
                    url: `txt/epub/${getMainAuthor(work).authorid}_${
                        work.work_titleid || work.titleid
                    }.epub`,
                    downloadable: true
                })
                break
            }
        }

        let exports = _.find(group, "export")
        if (exports) {
            main.export = exports.export
        }

        const sortMedia = item => _.indexOf(order, item.label)

        main.mediatypes = _.sortBy(mediatypes, sortMedia)
        output.push(main)
    }

    return output
}

littb.factory("backend", function ($http, $q, util, $timeout, $sce) {
    // $http.defaults.transformResponse = (data, headers) ->
    // localStorageCache = $angularCacheFactory "localStorageCache",
    //     storageMode: 'localStorage'
    const parseHTML = function (data) {
        let html = null
        let tmp = null
        if (!data || typeof data !== "string") {
            return null
        }
        try {
            if (window.DOMParser) {
                // Standard
                tmp = new DOMParser()
                html = tmp.parseFromString(data, "text/html")
            }
        } catch (e) {
            html = "undefined"
        }
        if (!html || !html.documentElement || html.getElementsByTagName("parsererror").length) {
            jQuery.error(`Invalid html: ${data}`)
        }
        return html
    }

    const http = function (config) {
        const defaultConfig = {
            method: "GET",
            params: {
                username: "app"
            },
            transformResponse(data, headers) {
                const output = parseHTML(data)
                if ($("fel", output).length) {
                    c.log("xml parse error:", $("fel", output).text())
                }
                return output
            }
        }

        return $http(_.merge(defaultConfig, config))
    }

    return {
        getHtmlFile(url) {
            return http({
                url
            })
        },

        getAudioList(params) {
            return $http({
                url: `${STRIX_URL}/get_audio`,
                params: params || {}
            }).then(function (response) {
                const audioList = response.data.data
                for (let i = 0; i < audioList.length; i++) {
                    const item = audioList[i]
                    item.url = $sce.trustAsResourceUrl(`/red/ljud/${item.file}`)
                    item.showtitle = item.shorttitle = item.title
                    item.i = i
                }
                return audioList
            })
        },

        getEpub(size, filterTxt, authorid, sort_field) {
            let query = bodybuilder().filter("term", "has_epub", true)

            if (authorid)
                query.query("nested", "path", "authors", q =>
                    q
                        .query("match", "authors.authorid", authorid)
                        .notQuery("exists", "authors.type")
                )
            if (filterTxt)
                query.query("multi_match", "query", filterTxt, {
                    fields: ["main_author.full_name.search", "title.search"]
                })
            const url = `${STRIX_URL}/query/etext`

            const params = {
                to: size || 10000,
                include:
                    "lbworkid,titlepath,sortkey,title,titleid,work_titleid,shorttitle,mediatype,authors.authorid,sort_date_imprint.plain," +
                    "authors.name_for_index,authors.authortype,startpagename,authors.surname,authors.full_name,authors.type",
                exclude: "text,parts,sourcedesc,pages,errata",
                sort_field: sort_field || "epub_popularity|desc",
                search: JSON.stringify(query.build())
            }

            return $http({
                url,
                params
            }).then(response => response.data)
        },

        getEpubAuthors() {
            const url = `${STRIX_URL}/get_work_prop_authors?key=has_epub&val=true`

            return $http({ url }).then(response => response.data)
        },
        authorHasMapArticle(authorid) {
            const url = `${STRIX_URL}/query/litteraturkartan`
            return $http({
                url,
                params: {
                    to: 0,
                    search: JSON.stringify({
                        query: {
                            query_string: {
                                query: "lb_author.authorid:" + authorid,
                                fields: ["lb_author.authorid"]
                            }
                        }
                    })
                }
            }).then(response => response.data.hits > 0)
        },
        getParts(filter_string, partial_string, filter_or, filter_and, to) {
            if (partial_string == null) {
                partial_string = false
            }
            // TODO: add filter for leaf titlepaths and mediatype
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                sort_field: "sortkey|asc",
                filter_string: filter_string.replace(/(\w)-(\w)/g, "$1 $2"),
                to,
                filter_or,
                filter_and,
                author_aggregation: true
            }

            if (partial_string) {
                params.partial_string = true
            }

            return $http({
                url: `${STRIX_URL}/list_all/etext-part,faksimil-part`,
                params
            }).then(function (response) {
                c.log("getParts data", response)
                let { data, hits, author_aggregation } = response.data
                return {
                    titleArray: expandMediatypes(data),
                    hits: hits,
                    author_aggs: author_aggregation
                }
            })
        },
        getLegacyAuthor(legacy_url) {
            let params = {
                filter_and: { "dramawebben.legacy_url": legacy_url },
                includes: ["authors.authorid"],
                show_all: true
            }
            return $http({
                url: `${STRIX_URL}/list_all/author`,
                params
            }).then(function (response) {
                c.log("response", response)
                const { data } = response.data

                return data[0]
            })
        },

        getTitles(types, options, disableGrouping = false, relevance = false) {
            let defaults = {
                from: 0,
                to: 100,
                sort_field: "sortkey|asc"
            }
            let { author, author_aggs, ...opts } = Object.assign({}, defaults, options)

            const params = _.omitBy(
                {
                    exclude: "text,parts,sourcedesc,pages,errata",
                    author_aggregation: author_aggs,
                    ...opts
                },
                val => _.isNull(val)
            )

            if (author) {
                author = `/${author}`
            }

            if (params.filter_string) {
                params.filter_string = params.filter_string
                    .replace(/([A-Öa-ö])[-–—]([A-Öa-ö])/g, "$1 $2")
                    .replace(/[.,!"“'”]/g, "")
            }
            return $http({
                url: `${STRIX_URL}/list_all/${types}` + (author || ""),
                params
            }).then(function (response) {
                c.log("response", response)
                const { data, author_aggregation, hits, distinct_hits, suggest } = response.data

                return {
                    titles: disableGrouping ? data : expandMediatypes(data),
                    author_aggs: author_aggregation,
                    hits,
                    distinct_hits,
                    suggest
                }
            })
        },

        relevanceSearch(types, { filters, ...options }, disableGrouping = false) {
            if (relevanceCanceller) {
                relevanceCanceller.resolve()
            }
            relevanceCanceller = $q.defer()
            filters = _.omitBy(
                filters,
                val => _.isNil(val) || _.isNaN(val) || (!_.isNumber(val) && _.isEmpty(val))
            )
            const params = _.omitBy(
                {
                    exclude:
                        "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types",
                    // author_aggregation: author_aggs,
                    ...options,
                    search: fromFilters(filters)
                },
                val => _.isNil(val) || (_.isPlainObject(val) && _.isEmpty(val))
            )
            return $http({
                url: `${STRIX_URL}/relevance/${types}`,
                timeout: relevanceCanceller.promise,
                params
            }).then(function (response) {
                c.log("response", response)
                // const { data, author_aggregation, hits, distinct_hits, suggest } = response.data
                // TODO: bring back suggest
                const { data, suggest, hits } = response.data

                const groups = _.groupBy(data, item => item.titlepath + item.lbworkid)
                for (let item of data) {
                    if (groups[item.titlepath + item.lbworkid].length > 1) {
                        item.hasAmbigousMediatype = true
                    }
                }

                return {
                    titles: disableGrouping ? data : expandMediatypes(data),
                    suggest,
                    hits
                    // distinct_hits,
                    // suggest
                }
            })
        },

        getAuthorSuggest(str) {
            return $http({
                url: `${STRIX_URL}/list_all/author?filter_string=${str}&to=0&suggest=true`
            }).then(response => response.data.suggest)
        },

        getAboutAuthors() {
            return $http({
                url: `${STRIX_URL}/get_authorkeywords`
            }).then(response => response.data)
        },

        getPopularAuthors() {
            return $http({
                url: `${STRIX_URL}/get_popular_authors`,
                params: {
                    include:
                        "surname,authorid,birth,death,full_name,pseudonym,name_for_index,dramawebben"
                }
            }).then(response => response.data)
        },
        getAuthorList(include, exclude) {
            const def = $q.defer()
            const url = `${STRIX_URL}/get_authors`
            const params = {}
            if (include) {
                params.include = include
            }
            if (exclude) {
                params.exclude = exclude
            }
            return $http({
                url,
                method: "GET",
                cache: true,
                params
            }).then(function (response) {
                c.log("getAuthorList", response)
                return response.data.data
            })
        },

        getLicense(workinfo) {
            return $http({
                url: "/red/etc/license/license.json",
                cache: true
            }).then(response => response.data[workinfo.license])
        },

        getProvenance(workinfo) {
            return $http({
                url: "/red/etc/provenance/provenance.json",
                cache: true
            }).then(function (response) {
                const provData = []
                const iterable = workinfo.provenance || []
                for (let i = 0; i < iterable.length; i++) {
                    var textField
                    const prov = iterable[i]
                    const output = response.data[prov.library]
                    if (!output) {
                        c.warn(`Library name '${prov.library}' not in provenance.json`, prov)
                        continue
                    }
                    if (i > 0 && prov.text2) {
                        textField = "text2"
                    } else {
                        textField = "text"
                    }
                    if (workinfo.mediatype === "faksimil" && workinfo.printed) {
                        output.text = output[textField].faksimilprint
                    } else if (workinfo.mediatype === "faksimil" && !workinfo.printed) {
                        output.text = output[textField].faksimilnoprint
                    } else {
                        output.text = output[textField][workinfo.mediatype]
                    }

                    let signum = ""
                    if (prov.signum) {
                        signum = ` (${prov.signum})`
                    }
                    output.text = _.template(output.text)({
                        signum: signum || ""
                    })
                    provData.push(output)
                }
                return provData
            })
        },
        getSourceInfo(params, mediatype) {
            // TODO: mediatype can be null?
            const url = `${STRIX_URL}/get_work_info`
            // params = {}
            // key is titlepath or lbworkid
            // params[key] = value
            return $http({
                url,
                params
            }).then(function (response) {
                let workinfo
                if (response.data.hits === 0) {
                    // def.reject("not_found")
                    throw Error("not_found")
                }

                let works = response.data.data
                works = expandMediatypes(works, mediatype)

                if (mediatype) {
                    for (let work of works) {
                        if (work.mediatype === mediatype) {
                            workinfo = work
                            break
                        }
                    }
                    if (!workinfo) {
                        workinfo = works[0]
                    }
                } else {
                    workinfo = works[0]
                }

                workinfo.pagemap = {}
                workinfo.stepmap = {}
                workinfo.pagestep = Number(workinfo.pagestep)
                workinfo.filenameMap = []
                for (let pg of workinfo.pages) {
                    workinfo.pagemap[`page_${pg.pagename}`] = pg.pageindex
                    workinfo.pagemap[`ix_${pg.pageindex}`] = pg.pagename
                    workinfo.filenameMap[pg.pageindex] = pg.imagenumber
                    if (pg.pagestep) {
                        workinfo.stepmap[pg.pageindex] = Number(pg.pagestep)
                    }
                }
                delete workinfo.pages

                workinfo.errata = $("tr", workinfo.errata)
                    .get()
                    .map(tr => _($(tr).find("td")).map(util.getInnerXML).map(_.str.strip).value())

                workinfo.partStartArray = _(workinfo.parts)
                    .map(part => [workinfo.pagemap[`page_${part.startpagename}`], part])
                    .sortBy(function ([i, part]) {
                        return i
                    })
                    .value()

                c.log("getSourceInfo", workinfo)
                return workinfo
            })
        },

        getInfopost(authorid, titlepath) {
            const url = `${STRIX_URL}/get_work_info`
            return $http({
                url,
                params: {
                    authorid,
                    titlepath
                }
            }).then(function (response) {
                console.log("response.data.data", response.data.data)
                let { data } = response.data

                data = expandMediatypes(data, "infopost")

                return data[0]
            })
        },

        logPage(pageix, lbworkid, mediatype) {
            return $http({
                url: `${STRIX_URL}/log_page/${lbworkid}/${mediatype}/${pageix}`
            })
        },
        logQR(code, url) {
            window.gtag("event", "qr_scan", {
                event_category: "code",
                anonymize_ip: true
            })

            return $http({
                url: `${STRIX_URL}/log_qr`,
                params: {
                    code,
                    url
                }
            })
        },

        logDownload(author, title, lbworkid, mediatype) {
            if (!isDev) {
                $http({
                    url: `${STRIX_URL}/log_download/${author}/${title}/${lbworkid}`
                })
            }

            window.gtag("event", mediatype, {
                event_category: "download",
                event_label: `${lbworkid} – ${author} – ${title}`,
                anonymize_ip: true
            })
        },
        logLibrary(filter) {
            if (!filter) {
                filter = "[alla]"
            }

            window.gtag("event", "search", {
                event_category: "library",
                event_label: filter,
                anonymize_ip: true
            })

            $http({
                url: `${STRIX_URL}/log_library/${filter}`
            })
        },
        logQuicksearch(filter_val, label) {
            window.gtag("event", "search", {
                event_category: "quicksearch",
                event_label: filter_val + " -> " + label,
                anonymize_ip: true
            })
            $http({
                url: `${STRIX_URL}/log_quicksearch/${filter_val}/${label}`
            })
        },
        logError(type, payload) {
            $http({
                url: `${STRIX_URL}/log_error/${type}`,
                params: payload
            })
        },

        getBackgroundConf() {
            return http({
                url: "/red/bilder/bakgrundsbilder/backgrounds.xml"
            }).then(function (response) {
                const output = {}
                for (let node of Array.from($("background", response.data))) {
                    output[$(node).attr("target")] = {
                        url: $(node).attr("url"),
                        class: $(node).attr("class"),
                        style: $("style", node).get(0)
                    }
                }
                return output
            })
        },

        getAuthorInfo(authorid) {
            return $http({
                url: `${STRIX_URL}/get_author/` + authorid
            }).then(
                function (response) {
                    const auth = response.data.data

                    // for auth in data
                    if (auth.picture) {
                        auth.smallImage = `/red/forfattare/${auth.authorid_norm}/${auth.authorid_norm}_small.jpeg`
                        auth.largeImage = `/red/forfattare/${auth.authorid_norm}/${auth.authorid_norm}_large.jpeg`
                    }

                    if (auth.dramawebben != null ? auth.dramawebben.picture : undefined) {
                        auth.dramawebben.largeImage = `/red/forfattare/${auth.authorid_norm}/${auth.authorid_norm}_dw_large.jpeg`
                    }

                    return auth
                },
                err => c.log("getAuthorInfo error", err)
            )
        },

        getTextByAuthor(authorid, textType, maybeAuthType, list_about) {
            if (list_about == null) {
                list_about = false
            }
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                to: 10000,
                sort_field: "sortkey|desc"
            }
            if (maybeAuthType) {
                params["author_type"] = maybeAuthType
            }
            if (list_about) {
                params["about_author"] = true
            }

            return $http({
                url: `${STRIX_URL}/list_all/${textType}/${authorid}`,
                params
            }).then(
                response => expandMediatypes(response.data.data),
                err => c.log("err", err)
            )
        },

        getPartsInOthersWorks(authorid, sortkey, list_about) {
            if (list_about == null) {
                list_about = false
            }
            const params = {
                sort_field: sortkey
            }
            if (list_about) {
                params["about_author"] = true
            }
            return $http({
                url: `${STRIX_URL}/list_parts_in_others_works/` + authorid,
                params
            }).then(
                response => expandMediatypes(response.data.data),
                err => c.log("err getPartsInOthersWorks", err)
            )
        },

        getStats() {
            return $http({
                url: `${STRIX_URL}/get_stats`
            }).then(function (response) {
                c.log("response", response)
                return response.data
            })
        },

        getTitlesByAuthor(authorid, cache, aboutAuthors) {
            // TODO: repace this with getTitles?
            // serviceName = if aboutAuthors then "get-works-by-author-keyword" else "get-titles-by-author"
            if (aboutAuthors == null) {
                aboutAuthors = false
            }

            const params = { include: "shorttitle,lbworkid,titlepath,searchable" }

            if (aboutAuthors) {
                params.aboutAuthors = true
            }

            const url = `${STRIX_URL}/list_all/etext,faksimil/${authorid}`
            const req = {
                url,
                params
            }
            if (cache) {
                req.cache = true
            }
            return $http(req).then(response => response.data.data)
        },

        // "dramawebben.legacy-url" : "/pjas/fiskargossarne"
        getDramawebTitles(legacy_url = null) {
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                include:
                    "shorttitle,title,lbworkid,titlepath,authors,titleid,mediatype,dramawebben,keyword,startpagename,sortkey",
                filter_and: { "provenance.library": "Dramawebben", texttype: "drama" },
                sort_field: "sortkey|asc",
                show_all: true,
                to: 10000,
                author_aggregation: true
            }
            if (legacy_url) {
                params.filter_and["dramawebben.legacy_url"] = legacy_url
                params.to = 10
                params.author_aggregation = false
            }
            // if include
            //     params.include = include
            // if sort_key
            //     params.sort_field = sort_key
            //     params.to = 30
            // else
            //     params.sort_field = "sortkey|asc"
            //     params.to = 10000

            // if string
            //     params.filter_string = string
            // if author
            //     author = "/" + author
            // if aboutAuthors
            //     params.about_authors = true
            // if partial_string
            //     params.partial_string = true
            // if getAll
            //     params.to = 300

            return $http({
                url: `${STRIX_URL}/list_all/etext,faksimil,pdf,infopost`,
                params
            }).then(function (response) {
                const titles = response.data.data

                return {
                    authors: _.map(response.data.author_aggregation, "authorid"),
                    works: expandMediatypes(titles)
                }
            })
        },

        downloadFiles(exports) {
            let files = exports.map(exp => `${exp.lbworkid}-${exp.mediatype}-${exp.type}`).join(",")

            let submit = $('<input type="submit" />')
            let form = $(`<form action="/api/download" method="POST">
                <input type="hidden" name="files" value="${files}" />
                </form>`).appendTo("body")

            submit.appendTo(form).click()
            form.remove()
        },

        searchLexicon(str, id, useWildcard, doSearchId, strict) {
            let params
            const url = "/so/"
            // c.log "searchId", searchId
            if (doSearchId) {
                params = { id }
            } else {
                const suffix = useWildcard && str.length > 3 ? "*" : ""
                params = { word: str + suffix }
            }

            if (strict) {
                params["strict"] = true
            }

            return http({
                url,
                params

                // transformResponse : (data, headers) ->
                //     c.log "transformResponse", data, headers
            }).then(function (response) {
                let xml = response.data
                c.log("searchLexicon success", xml)

                if ($(xml).text() === "Inga träffar") {
                    throw new Error("no_hits")
                }

                let output = $("artikel", xml)
                    .get()
                    .map(article => ({
                        baseform: $("grundform-clean:first", article).text(),
                        id: $("lemma", article).first().attr("id"),
                        // lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                        lexemes: util.getInnerXML(article)
                    }))

                // window.output = output
                output = _.sortBy(output, function (item) {
                    if (item.baseform === str) {
                        return "aaaaaaaaa"
                    }
                    return item.baseform.toLowerCase()
                })

                c.log("lexicon def resolve")

                if (!output.length) {
                    throw new Error("no_hits")
                }
                return output
            })

            return def.promise
        },

        getBiblinfo(params, wf) {
            const url = `http://demolittb.spraakdata.gu.se/sla-bibliografi/?${params}`

            return $http({
                url,
                method: "GET",
                params: {
                    username: "app",
                    wf
                }
            }).then(function (response) {
                let xml = response.data
                const output = $("entry", xml)
                    .get()
                    .map(entry => ({
                        title: util.getInnerXML($("title", entry)),
                        isbn: util.getInnerXML($("isbn", entry)),
                        issn: util.getInnerXML($("issn", entry)),
                        archive: util.getInnerXML($("manusarchive ArchiveID", entry))
                    }))

                return output
            })
        },

        getDiff(workgroup, myWits, ...ids) {
            const url = `/assets/views/sla/kollationering-${workgroup.toLowerCase()}.xml`

            return http({
                url,
                transformResponse: null
            }).then(function (response) {
                return response.data
            })
        },

        submitContactForm(name, email, message, isSOL) {
            let canceller = $q.defer()
            const timeoutDef = $timeout(() => canceller.resolve("timeout"), 30000)
            const params = {
                sender_name: name,
                sender_address: email,
                message
            }
            if (isDev) {
                params.test = true
            }
            if (isSOL) {
                params.isSOL = true
            }
            return $http({
                url: `${STRIX_URL}/contact`,
                params,
                timeout: canceller.promise
            }).then(() => $timeout.cancel(timeoutDef))
        },

        ordOchSak(author, title) {
            const titlemap = {
                OsynligaLankarSLA: "/assets/views/sla/OLOrdSak-output.xml",
                GostaBerlingsSaga1SLA: "/assets/views/sla/GBOrdSakForstaDel-output.xml",
                GostaBerlingsSaga2SLA: "/assets/views/sla/GBOrdSakAndraDel-output.xml"
            }

            const url = titlemap[title]

            if (!url) {
                throw new Error("title not valid: " + title)
            } else {
                return http({
                    url,
                    params: ""
                }).then(function (response) {
                    let xml = response.data
                    const data = []
                    for (let entry of $("glossentry", xml)) {
                        const pages = []
                        try {
                            for (let page of $("page", entry)) {
                                pages.push(page.textContent)
                            }
                            data.push({
                                pages,
                                ord: $("glossterm", entry)[0].textContent,
                                forklaring: $("glossdef para", entry)[0].textContent
                            })
                        } catch (ex) {
                            c.error("invalid entry?", entry)
                        }
                    }

                    return data
                })
            }
        },

        getImprintRange() {
            return $http({
                url: `${STRIX_URL}/imprint_range`
            }).then(response => {
                let { start_year, end_year } = response.data
                return [start_year.value_as_string, end_year.value_as_string].map(Number)
            })
        },

        fetchOverlayData(lbworkid, ix) {
            // console.log("size_vals", size_vals)
            // let size_vals = SIZE_VALS
            const filename = _.str.lpad(ix, 5, "0")
            console.log("filename", filename, ix)
            const url = `txt/${lbworkid}/ocr_${filename}.html`
            return this.getHtmlFile(url).then(function (response) {
                const html = response.data.querySelector("body > div")
                // c.log $(html)
                const overlayWidth = Number($(html).data("size").split("x")[0])
                if (window.devicePixelRatio == 2) {
                    //     SIZE_VALS = [625, 750, 1025, 1500, 2050]
                    //     SIZE_VALS = [625, 750, 1025, 1500, 2050]
                    // size_vals[0] = size_vals[2] / 2
                    // size_vals[1] = size_vals[3] / 2
                    // size_vals[2] = size_vals[4] / 2
                }
                // const x_factor = 0.97
                // const overlayFactors = _.map(size_vals, val => (val / max) * x_factor)

                const xmlSerializer = new XMLSerializer()
                const result = xmlSerializer.serializeToString(html)
                return [result, overlayWidth]
            })
        },

        hasAudioPage(authorid) {
            return $http({
                url: "https://litteraturbanken.se/ljudochbild/wp-json/wp/v2/pages",
                params: {
                    slug: authorid.toLowerCase(),
                    _fields: "slug"
                }
            }).then(response => response.data.length)
        },

        unNormalizeAuthorid(authorid) {
            return $http({
                url: `${STRIX_URL}/get_author/${authorid}`
            }).then(response => response.data.data.authorid)
        },
        unNormalizeTitleid(mediatype, titleid) {
            return $http({
                url: `${STRIX_URL}/list_all/${mediatype}`,
                params: {
                    include: "titleid",
                    filter_and: {
                        titleid
                    }
                }
            }).then(response => response.data.data[0].titleid)
        },

        autocomplete(filterstr) {
            return $http({
                url: `${STRIX_URL}/autocomplete/${filterstr}`
            }).then(function (response) {
                // c.log "autocomplete response", response
                let data
                const content = response.data
                if (content.suggest && content.suggest.length) {
                    c.log("suggest!", content.suggest[0].text, "score", content.suggest[0].score)
                }
                if (!(content.data.length || (content.suggest && content.suggest.length))) {
                    data = [
                        {
                            // TODO: this should not be selectable
                            label: "Inga träffar.",
                            action() {
                                return false
                            }
                        }
                    ]
                    return data
                }

                if (content.suggest.length && !Array.from(filterstr).includes(" ")) {
                    data = [
                        {
                            label: content.suggest[0].text,
                            typeLabel: "Menade du",
                            action(scope) {
                                // c.log ("autoc", @autocomplete)
                                // return scope.autocomplete(content.suggest[0].text)
                                // scope.autocomplete(content.suggest[0].text).then (data) ->
                                // scope.$apply () ->
                                $("#autocomplete")
                                    .controller("ngModel")
                                    .$setViewValue(content.suggest[0].text)
                                $("#autocomplete").val(content.suggest[0].text)

                                return false
                            }
                        }
                    ]
                    return data
                }
                // for item in data.suggest

                content.data = _.filter(content.data, item => item.doc_type != "audio")
                for (let item of content.data) {
                    if (["etext", "faksimil"].includes(item.doc_type)) {
                        const titleid = item.work_titleid || item.titleid
                        item.url = `/författare/${item.authors[0].authorid}/titlar/${titleid}/sida/${item.startpagename}/${item.doc_type}`
                        item.label = `${item.authors[0].surname} – ${item.shorttitle || item.title}`
                        item.typeLabel = "Verk"
                        item.mediatypeLabel = item.doc_type
                    }
                    if (["etext-part", "faksimil-part"].includes(item.doc_type)) {
                        item.url = `/författare/${item.work_authors[0].authorid}/titlar/${item.work_titleid}/sida/${item.startpagename}/${item.mediatype}`
                        item.label = `${
                            (item.authors != null ? item.authors[0] : item.work_authors[0]).surname
                        } – ${item.shorttitle || item.title}`
                        item.typeLabel = "Del"
                        item.mediatypeLabel = item.mediatype
                    }

                    if (item.doc_type === "author") {
                        item.url = `/författare/${item.authorid}`
                        item.label = item.name_for_index
                        item.typeLabel = "Författare"
                    }

                    // if (item.doc_type === "audio") {
                    //     item.url = `/ljudarkivet?spela=${item.file}`
                    //     item.label = item.title
                    //     item.typeLabel = "Ur ljudarkivet"
                    // }
                }
                content.data = content.data.filter(item => item.doc_type != "audio")

                return content.data
            })
        }
    }
})

littb.factory("bkgConf", function (backend) {
    const confPromise = backend.getBackgroundConf()

    return {
        get(page) {
            return confPromise.then(function (conf) {
                c.log("conf", conf, page)

                if (conf[page]) {
                    return conf[page]
                }

                for (let key in conf) {
                    const val = conf[key]
                    if (page.match(`^${key.replace("/*", ".*")}$`)) {
                        return val
                    }
                }
            })
        }
    }
})

littb.factory("authors", function (backend, $q) {
    let exclude
    const def = $q.defer()
    // @promise = def.promise
    backend
        .getAuthorList(
            null,
            (exclude =
                "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben")
        )
        .then(function (authors) {
            let authorsById = _.fromPairs(_.map(authors, item => [item.authorid, item]))
            // c.log "authorsById", authorsById

            if (isDev) {
                authorsById = new Proxy(authorsById, {
                    get: function (obj, key) {
                        if (key != "undefined" && key && !obj[key]) {
                            console.warn("ID missing in author database:", key)
                        } else {
                            return obj[key]
                        }
                    }
                })
            }

            return def.resolve([authors, authorsById])
        })

    return def.promise
})

littb.factory("SearchData", function (backend, $q, $http, $location) {
    let SearchData
    return (SearchData = class SearchData {
        constructor() {
            this.data = []
            this.total_hits = null
            this.total_doc_hits = null
            this.current = null
            this.currentParams = null

            this.isSearching = false
            this.NUM_HITS = 30 // how many doc hits per search?
            this.NUM_HIGHLIGHTS = 5
            this.NUM_HIGHLIGHTS_MORE = 50

            this.include = "authors,title,titlepath,titleid,mediatype,lbworkid"
        }

        newSearch(params) {
            this.data = []
            this.total_hits = null
            this.total_doc_hits = null
            this.currentParams = params
            this.doNewSearch = true
            this.current = null
            this.isSearching = false
            this.savedParams = null
        }

        submit(query, params) {
            query = query.toLowerCase()
            delete params.query
            $http({
                url: `${STRIX_URL}/search_count/${query}`,
                params: _.omit(params, "number_of_fragments", "from", "to"),
                cache: true
            }).then(response => {
                c.log("count all", response)
                this.total_hits = response.data.total_highlights
                return c.log("@total_hits", this.total_hits)
            })

            return $http({
                url: `${STRIX_URL}/search/${query}`,
                params,
                cache: true
            }).then(response => {
                c.log("response", response.data)
                this.isSearching = false

                this.total_doc_hits = response.data.hits
                this.compactLeftContext(response.data.data)
                let isShort = ({ word }) => word.length < 30

                for (let item of response.data.data) {
                    for (let hl of item.highlight) {
                        hl.left_context = hl.left_context.filter(isShort)
                        hl.right_context = hl.right_context.filter(isShort)
                    }
                }
                const sentsWithHeaders = _.flatten(
                    this.decorateData(response.data.data, this.NUM_HIGHLIGHTS)
                )

                return [sentsWithHeaders, response.data.author_aggregation]
            })
        }
        // .error (data) =>
        // def.reject(data)

        searchWorks(o) {
            c.log("searchvars", o)

            this.isSearching = true

            let params = {
                include: this.include,
                number_of_fragments: this.NUM_HIGHLIGHTS + 1
            }

            params = _.extend({}, o, params)
            return this.submit(o.query, params)
        }

        resetMod() {
            const def = $q.defer()
            this.currentParams = this.savedParams
            this.savedParams = null
            this.searchWorks(this.currentParams).then(data => def.resolve(data))
            return def.promise
        }

        modifySearch(arg_mod) {
            // redoes search with new args
            const def = $q.defer()
            if (!this.savedParams) {
                this.savedParams = this.currentParams
            }
            this.currentParams = _.extend({}, this.savedParams, arg_mod)
            this.searchWorks(this.currentParams).then(data => def.resolve(data))
            return def.promise
        }

        slice(from, to) {
            if (!this.currentParams) {
                return
            }
            c.log("slice", from, to)
            if (from < 0) {
                from = 0
            }
            const def = $q.defer()
            if (this.hasSlice(from, to) && !this.doNewSearch) {
                c.log("@hasSlice from, to", this.hasSlice(from, to))
                def.resolve(this.data.slice(from, to))
            } else {
                // [missingStart, missingEnd] = @findMissingInSpan(from, to)
                // if missingEnd
                //     @currentParams.from = missingStart
                //     c.log "missingStart", missingStart, missingEnd
                //     @currentParams.to = missingEnd
                // else
                this.currentParams.from = from
                this.currentParams.to = to

                this.searchWorks(this.currentParams).then(response => {
                    const hits = response[0]
                    for (let hit of hits) {
                        const i = hit.order
                        this.data[i] = hit
                    }
                    return def.resolve(response)
                })
            }
            this.doNewSearch = false
            return def.promise
        }

        hasSlice(from, to) {
            const slice = this.data.slice(from, to)
            if (slice.length < to - from) {
                return false
            }
            return !_.some(slice, _.isUndefined)
        }

        // findMissingInSpan : (from, to) ->
        //     start = null

        //     span = @data[from..to]
        //     for item, i in span
        //         if not item? # count undefined
        //             start = i
        //             end = (_.takeWhile span[i..], _.isUndefined).length
        //             break

        //     c.log "end", end
        //     return [from + start, from + start + end]

        getMoreHighlights(sentenceData) {
            if (sentenceData.at_highlight_page == null) {
                sentenceData.at_highlight_page = 1
            }
            const at_page = sentenceData.at_highlight_page + 1
            const num_fragments = at_page * this.NUM_HIGHLIGHTS_MORE
            c.log("sentenceData.at_highlight_page", sentenceData.at_highlight_page)
            let params = {
                include: this.include,
                number_of_fragments: num_fragments + 1,
                // authors: _.map sentenceData.metadata.authors, "authorid"
                work_ids: sentenceData.metadata.lbworkid,
                from: 0,
                to: 1
            }

            params = _.extend({}, this.currentParams, params)
            delete params.text_filter
            delete params.authors

            return $http({
                url: `${STRIX_URL}/search/${this.currentParams.query}`,
                params
            }).then(response => {
                this.compactLeftContext(response.data.data)

                const decorated = _.flatten(this.decorateData(response.data.data, num_fragments))
                if (_.last(decorated).overflow) {
                    _.last(decorated).at_highlight_page = at_page
                }
                return decorated
            })
        }

        decorateData(data, num_fragments) {
            const groupSents = data => {
                const i = 0
                const output = []

                let row_index = 0
                for (let item of data) {
                    const work_rows = [{ isHeader: true, metadata: item.source }]
                    output.push(work_rows)
                    for (
                        let highlight_index = 0;
                        highlight_index < item.highlight.length;
                        highlight_index++
                    ) {
                        const high = item.highlight[highlight_index]
                        const obj = { metadata: item.source, highlight: high, index: row_index }
                        obj.href = this.parseUrls(obj, highlight_index)
                        work_rows.push(obj)
                        if (highlight_index == 0) {
                            work_rows[0].href = obj.href
                        }
                        row_index++
                    }
                    if (item.overflow) {
                        work_rows.push({ metadata: item.source, overflow: true })
                    }
                }

                return output
            }

            const punctArray = [",", ".", ";", ":", "!", "?", "..."]
            for (let work of data) {
                if (work.highlight.length > num_fragments) {
                    work.highlight = work.highlight.slice(0, +(num_fragments - 1) + 1 || undefined)
                    work.overflow = true
                }

                for (let high of work.highlight) {
                    for (let key of ["left_context", "match", "right_context"]) {
                        for (let wd of high[key]) {
                            if (punctArray.includes(wd.word)) {
                                wd._punct = true
                            }
                        }
                    }
                }
            }

            return groupSents(data)
        }

        compactLeftContext(data) {
            const min = 40 // no longer sentences than min chars
            // for work in data
            //     for ctx in _.map work.highlight, "left_context"
            //         sum = _.sum ctx, (wd) -> wd.word.length

            //         if sum < min then min = sum

            //         ctx.num_chars = sum
            data.map(work => {
                for (let ctx of _.map(work.highlight, "left_context")) {
                    const num_chars = _.sum(ctx, wd => wd.word.length)
                    if (num_chars > min) {
                        var drop
                        const diff = num_chars - min
                        let dropped = 0

                        for (let i = 0; i < ctx.length; i++) {
                            const wd = ctx[i]
                            if (dropped >= diff) {
                                drop = i
                                break
                            }
                            dropped += wd.word.length
                        }

                        if (drop) {
                            ctx.splice(0, drop)
                        }
                    }
                }
            })
        }

        parseUrls(row, index) {
            const { metadata } = row

            const matches = row.highlight.match
            const matchParams = []
            matchParams.push({
                traff: matches[0].attrs.wid,
                traffslut: _.last(matches).attrs.wid
            })

            let merged = _(matchParams).reduce(function (obj1, obj2) {
                if (!obj1) {
                    return {}
                }
                return _.merge({}, obj1, obj2, function (a, b) {
                    if (!a) {
                        return b
                    }
                    return a + "|" + b
                })
            })

            for (let key in this.currentParams) {
                // TODO text_attrs are not more
                const val = this.currentParams[key]
                if (key === "text_filter" && !_.isEmpty(val)) {
                    merged[`s_${key}`] = JSON.stringify(val)
                } else {
                    merged[`s_${key}`] = val
                }
            }

            merged["s_lbworkid"] = metadata.lbworkid
            merged.hit_index = index
            merged = _(merged).toPairs().invokeMap("join", "=").join("&")

            const author = metadata.authors[0].authorid
            const titleid = metadata.titleid

            return `/författare/${author}/titlar/${titleid}/sida/${matches[0].attrs.n}/${metadata.mediatype}?${merged}`
        }

        next() {
            if (this.current + 1 === this.total_doc_hits) {
                return { then: angular.noop }
            }
            this.current++
            return this.get(this.current)
        }

        prev() {
            if (this.current === 0) {
                return { then: angular.noop }
            }
            this.current--
            return this.get(this.current)
        }

        get(index) {
            const def = $q.defer()
            // c.log "search", @current

            if (this.data[index] != null) {
                def.resolve(this.data[index])
            } else {
                this.slice(index - 10, index + 10).then(() => {
                    c.log("@data[index]", index, this.data)
                    return def.resolve(this.data[index])
                })
            }
            return def.promise
        }

        reset() {
            this.current = null
            this.total_hits = null
            this.total_doc_hits = null
            this.data = []
            this.currentParams = null
        }
    })
})

// return new SearchData()

littb.factory("SearchWorkData", function (SearchData, $q, $http) {
    // c.log "searchWorkData", SearchData
    let SearchWorkData
    return (SearchWorkData = class SearchWorkData extends SearchData {
        constructor(scope) {
            super()
            this.n_times = 0
            this.isCounting = false
            this.scope = scope
        }

        newSearch(params) {
            window.gtag("event", "search", {
                event_category: "search_work",
                event_label: params.query,
                anonymize_ip: true
            })
            super.newSearch(params)
            this.n_times = 0
        }

        submit(query, params) {
            c.log("params", params)
            const def = $q.defer()

            const queryParams = ["init_hits=20"]
            if (params.prefix) {
                queryParams.push("prefix")
            }
            if (params.suffix) {
                queryParams.push("suffix")
            }
            if (params.word_form_only != null) {
                queryParams.push("word_form_only")
            }

            this.isCounting = true
            const source = new EventSource(
                `${STRIX_URL}/search_document/${params.lbworkid}/${params.mediatype}/${query}/?` +
                    queryParams.join("&")
            )

            source.onmessage = event => {
                const data = JSON.parse(event.data)

                c.log("onmessage onprogress", data)
                def.resolve([data.data])
                this.scope.$apply(() => {
                    this.n_times++

                    if (this.n_times > 1) {
                        this.search_id = data.search_id
                        this.total_hits = data.total_hits
                    }
                })
            }

            const self = this
            source.onerror = function (event) {
                c.log("eventsource closed", event)
                this.close()
                self.scope.$apply(() => (self.isCounting = false))
            }
            // def.resolve()

            return def.promise
        }

        searchWorks(o) {
            this.isSearching = true

            let params = {
                include: this.include,
                number_of_fragments: this.NUM_HIGHLIGHTS + 1
            }

            params = _.extend({}, o, params)
            if (this.n_times === 0) {
                return this.submit(o.query, params).then(data => {
                    this.isSearching = false
                    return data
                })
            } else if (this.search_id) {
                return this.pageSearchInWork(this.search_id, params.from, params.to)
            } else {
                return c.warn("search in work data state error", this)
            }
        }

        pageSearchInWork(search_id, from, to) {
            return $http({
                url: `${STRIX_URL}/page_search/${search_id}/${from}/${to}`
            }).then(response => {
                c.log("pageSearchInWork", response)
                this.isSearching = false
                return [response.data.data]
            })
        }
    })
})
