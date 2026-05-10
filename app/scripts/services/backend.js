import bodybuilder from "bodybuilder"
import { buildFilterQuery, composeQuery } from "../query.ts"

let relevanceCanceller
let getFileSize = size => {
    const kb = size / 1024
    if (kb < 1024) {
        return Math.round(kb) + " KB"
    } else {
        return Math.round((kb / 1024) * 10) / 10 + " MB"
    }
}

const createExpandMediatypes = _ => function (works, mainMediatype) {
    const order = ["etext", "faksimil", "epub", "pdf", "infopost"]
    const groups = _.groupBy(works, item => item.titlepath + item.lbworkid)
    const output = []
    const getMainAuthor = metadata =>
        (metadata.work_authors || metadata.authors || [metadata.main_author])[0]

    const makeObj = function (metadata) {
        if (metadata.mediatype === "pdf") {
            return {
                label: metadata.mediatype,
                filename: `${getMainAuthor(metadata).authorid}_${
                    metadata.work_titleid || metadata.titleid
                }`,
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

        let hasRealPDF = group.find(item => item.mediatype == "pdf")
        for (let work of group) {
            let epubExport = _.find(work.export, { type: "epub" })
            if (epubExport) {
                mediatypes.push({
                    label: "epub",
                    url: `txt/epub/${getMainAuthor(work).authorid}_${
                        work.work_titleid || work.titleid
                    }.epub`,
                    filename: `${getMainAuthor(work).authorid}_${
                        work.work_titleid || work.titleid
                    }`,
                    filesize: getFileSize(epubExport.size),
                    downloadable: true
                })
            } else {
                let pdfExport = _.find(work.export, { type: "pdf" })

                if (!hasRealPDF && pdfExport) {
                    mediatypes.push({
                        label: "pdf",
                        url: `export/faksimil/${main.lbworkid}.pdf`,
                        filename: `${getMainAuthor(main).authorid}_${
                            main.work_titleid || main.titleid
                        }`,
                        filesize: getFileSize(pdfExport.size),
                        downloadable: true
                    })
                }
            }
        }
        const sortMedia = item => _.indexOf(order, item.label)

        main.mediatypes = _.sortBy(mediatypes, sortMedia)
        output.push(main)
    }

    return output
}

export function createBackendService({
    $http,
    $q,
    util,
    $timeout,
    $sce,
    $filter,
    STRIX_URL,
    isDev,
    _: lodash,
    $: dollar,
    jQuery: jquery,
    console: logger,
    window: customWindow
}) {
    const runtimeWindow =
        customWindow || (typeof window !== "undefined" ? window : undefined) || undefined
    const runtimeGlobal = runtimeWindow || (typeof globalThis !== "undefined" ? globalThis : {})
    const _ = lodash || runtimeGlobal._
    const $ = dollar || jquery || runtimeGlobal.$ || runtimeGlobal.jQuery
    const jQuery = jquery || runtimeGlobal.jQuery || $
    const c = logger || runtimeGlobal.console || console
    const isDevelopment = typeof isDev === "boolean" ? isDev : Boolean(runtimeGlobal.isDev)

    if (!_ || !$ || !jQuery) {
        throw new Error(
            "createBackendService requires lodash and jQuery globals or explicit dependencies"
        )
    }

    const expandMediatypes = createExpandMediatypes(_)

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
            if (runtimeGlobal.DOMParser) {
                // Standard
                tmp = new runtimeGlobal.DOMParser()
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

    const http = function (config, isFaksimil) {
        const defaultConfig = {
            method: "GET",
            params: {
                username: "app"
            },
            transformResponse(data, headers) {
                if (isFaksimil) data = data.replaceAll("<a>", "&lt;a&gt;").replaceAll("</a>", "")
                const output = parseHTML(data)
                if ($("fel", output).length) {
                    console.log("xml parse error:", $("fel", output).text())
                }
                return output
            }
        }

        return $http(_.merge(defaultConfig, config))
    }

    return {
        getHtmlFile(url, isFaksimil) {
            return http({ url }, isFaksimil)
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
            let query = bodybuilder().filter("term", "has_epub", true).filter("term", "show", true)

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
                                query: "status:published AND lb_author.authorid:" + authorid,
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
            const {
                filters: filtersMap,
                q: initialQuery,
                filter_string,
                keyword_aux = [],
                ...restOpts
            } = opts

            const params = _.omitBy(
                {
                    exclude: "text,parts,sourcedesc,pages,errata",
                    author_aggregation: author_aggs,
                    ...restOpts
                },
                val => _.isNull(val)
            )

            if (author) {
                author = `/${author}`
            }

            let filterQuery = initialQuery
            if (filtersMap) {
                const built = buildFilterQuery(filtersMap)
                if (built) {
                    filterQuery = filterQuery ? `${filterQuery} AND ${built}` : built
                }
            }
            let composed = composeQuery({
                filterQuery,
                filterString: filter_string
                // keywordAux
            })

            if (composed) {
                params.q =
                    "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian " +
                    composed
            } else {
                params.q = "*"
            }

            return $http({
                // NOTE: this enpoint uses Nest for expanding the query in the backend
                // https://github.com/jroxendal/nest
                url: `${STRIX_URL}/query_string/${types}` + (author || ""),
                params
            })
                .then(function (response) {
                    const {
                        data,
                        author_aggregation,
                        imported_aggregation,
                        hits,
                        distinct_hits,
                        suggest
                    } = response.data

                    return {
                        titles: disableGrouping ? data : expandMediatypes(data),
                        author_aggs: author_aggregation,
                        imported_aggs: imported_aggregation,
                        hits,
                        distinct_hits,
                        suggest
                    }
                })
                .catch(function (error) {
                    c.error("getTitles error", error)
                    throw error
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
            let filterQuery = options.q
            if (filters) {
                const builtFilters = buildFilterQuery(filters)
                if (builtFilters) {
                    filterQuery = filterQuery ? `${filterQuery} AND ${builtFilters}` : builtFilters
                }
            }
            options.q = composeQuery({
                filterQuery,
                keywordAux: options.keyword_aux
            })
            delete options.keyword_aux
            const params = _.omitBy(
                {
                    exclude:
                        "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector",
                    // author_aggregation: author_aggs,
                    ...options,
                    vectorize: true
                },
                val => _.isNil(val) || (_.isPlainObject(val) && _.isEmpty(val))
            )
            return $http({
                // NOTE: this enpoint uses Nest for expanding the query in the backend
                // https://github.com/jroxendal/nest
                url: `${STRIX_URL}/relevance/${types}`,
                timeout: relevanceCanceller.promise,
                params
            }).then(function (response) {
                c.log("relevance response", response)
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
                url: `${STRIX_URL}/list_all/author?filter_string=${str.replace(
                    /\!/g,
                    ""
                )}&to=0&suggest=true`
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

                // Etext works may lack pages; inherit from a sibling with the same lbworkid.
                if (!workinfo.pages) {
                    const sibling = response.data.data.find(
                        work => work.pages && work.lbworkid === workinfo.lbworkid
                    )
                    if (sibling) {
                        workinfo.pages = sibling.pages
                    }
                }

                workinfo.pagemap = {}
                workinfo.stepmap = {}
                workinfo.pagestep = Number(workinfo.pagestep)
                workinfo.filenameMap = []
                for (let pg of workinfo.pages || []) {
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

                let sourcedesc = $(`<div>${workinfo.sourcedesc}</div>`)
                // workinfo.sourcedesc = .
                workinfo.sourcedescAuthor = sourcedesc.find("sourcedesc-author").text()
                $("sourcedesc-author", sourcedesc).remove()
                workinfo.sourcedesc = sourcedesc.html() || ""

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
            if (runtimeGlobal.gtag) {
                runtimeGlobal.gtag("event", "qr_scan", {
                    event_category: "code",
                    anonymize_ip: true
                })
            }

            return $http({
                url: `${STRIX_URL}/log_qr`,
                params: {
                    code,
                    url
                }
            })
        },

        logDownload(author, title, lbworkid, mediatype) {
            if (!isDevelopment) {
                $http({
                    url: `${STRIX_URL}/log_download/${author}/${title}/${lbworkid}`
                })
            }

            if (runtimeGlobal.gtag) {
                runtimeGlobal.gtag("event", mediatype, {
                    event_category: "download",
                    event_label: `${lbworkid} – ${author} – ${title}`,
                    anonymize_ip: true
                })
            }
        },
        logLibrary(filter) {
            if (!filter) {
                filter = "[alla]"
            }

            if (runtimeGlobal.gtag) {
                runtimeGlobal.gtag("event", "search", {
                    event_category: "library",
                    event_label: filter,
                    anonymize_ip: true
                })
            }

            $http({
                url: `${STRIX_URL}/log_library/${filter}`
            })
        },
        logQuicksearch(filter_val, label) {
            if (runtimeGlobal.gtag) {
                runtimeGlobal.gtag("event", "search", {
                    event_category: "quicksearch",
                    event_label: filter_val + " -> " + label,
                    anonymize_ip: true
                })
            }
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
                    console.log("🚀 ~ response:", response)
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
                err => {
                    c.log("getAuthorInfo error", err)
                    throw err
                }
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

        submitContactForm(name, email, message, isSOL) {
            let canceller = $q.defer()
            const timeoutDef = $timeout(() => canceller.resolve("timeout"), 30000)
            const params = {
                sender_name: name,
                sender_address: email,
                message
            }
            if (isDevelopment) {
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
            return this.getHtmlFile(url, true).then(function (response) {
                const html = response.data.querySelector("body > div")
                const userAgent = runtimeGlobal.navigator?.userAgent || ""
                if (userAgent.toLowerCase().indexOf("chrome") > -1) {
                    for (let node of html.querySelectorAll(".w > span")) {
                        node.innerHTML = node.innerHTML.replace(/ /g, "&nbsp;")
                    }
                }
                let [overlayWidth, overlayHeight] = $(html).data("size").split("x").map(Number)
                if (runtimeGlobal.devicePixelRatio == 2) {
                    //     SIZE_VALS = [625, 750, 1025, 1500, 2050]
                    //     SIZE_VALS = [625, 750, 1025, 1500, 2050]
                    // size_vals[0] = size_vals[2] / 2
                    // size_vals[1] = size_vals[3] / 2
                    // size_vals[2] = size_vals[4] / 2
                }
                // const x_factor = 0.97
                // const overlayFactors = _.map(size_vals, val => (val / max) * x_factor)

                let factor = 1
                // let factor = 1100 / overlayHeight

                const xmlSerializer = new runtimeGlobal.XMLSerializer()
                const result = xmlSerializer.serializeToString(html)
                return [result, overlayWidth, overlayHeight]
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
                url: `${STRIX_URL}/query_string/author?q=authorid_norm:${authorid}&include=authorid`
            }).then(response => {
                return response.data.data[0].authorid
            })
        },
        unNormalizeTitleid(mediatype, titleid) {
            return $http({
                url: `${STRIX_URL}/list_all/${mediatype}`,
                params: {
                    include: "titleid",
                    filter_and: {
                        titleid_norm: titleid
                    }
                }
            }).then(response => {
                return response.data.data[0].titleid
            })
        },

        getPageCount(lbworkid, mediatype) {
            return $http({
                url: `${STRIX_URL}/count_pages/${lbworkid}/${mediatype}`
            }).then(response => response.data.count)
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
                        const authorid = item.work_authors?.[0].authorid || item.authors[0].authorid
                        item.url = `/författare/${authorid}/titlar/${titleid}/sida/${item.startpagename}/${item.doc_type}`
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
                        let year = $filter("authorYear")(item)

                        item.url = `/författare/${item.authorid}`
                        item.label = item.name_for_index + (year ? ` (${year})` : "")
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
}

export default createBackendService
