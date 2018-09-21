// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const littb = angular.module("littbApp")
let SIZE_VALS = [625, 750, 1100, 1500, 2050]

// STRIX_URL = "http://" + location.host.split(":")[0] + ":5000"
// STRIX_URL = "https://litteraturbanken.se/api"
let STRIX_URL = "/api"

if (_.str.startsWith(location.host, "demolittbred")) {
    STRIX_URL = "http://demolittbdev.spraakdata.gu.se/api"
} else if (_.str.startsWith(location.host, "demolittb")) {
    STRIX_URL = "/api"
}
if (_.str.startsWith(location.host, "litteraturbanken")) {
    STRIX_URL = "/api"
}

littb.factory(
    "debounce",
    $timeout =>
        function(func, wait, options) {
            let leading
            let args = null
            let inited = null
            let result = null
            let thisArg = null
            let timeoutDeferred = null
            let trailing = true

            const delayed = function() {
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
            return function() {
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

littb.factory("util", function($location) {
    const PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i
    const SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g
    const MOZ_HACK_REGEXP = /^moz([A-Z])/
    const camelCase = name =>
        name
            .replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
                if (offset) {
                    return letter.toUpperCase()
                } else {
                    return letter
                }
            })
            .replace(MOZ_HACK_REGEXP, "Moz$1")

    const xml2Str = function(xmlNode) {
        try {
            // Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
            return new XMLSerializer().serializeToString(xmlNode)
        } catch (e) {
            try {
                // Internet Explorer.
                return xmlNode.xml
            } catch (error) {
                //Other browsers without XML Serializer
                e = error
                alert("Xmlserializer not supported")
            }
        }
        return false
    }

    return {
        getInnerXML(elem) {
            if ("jquery" in elem) {
                if (!elem.length) {
                    return null
                }
                elem = elem.get(0)
            }

            const strArray = Array.from(elem.childNodes).map(child => xml2Str(child))
            return strArray.join("")
        },

        normalize(name) {
            return camelCase(name.replace(PREFIX_REGEXP, ""))
        },

        titleSort(a) {
            return _.map(a.sortkey.split(/(\d+)/), function(item) {
                if (Number(item)) {
                    const zeroes = _.map(
                        _.range(0, 10 - item.toString().length + 1),
                        () => "0"
                    ).join("")

                    return zeroes + item.toString()
                } else {
                    return item
                }
            })
        },

        sortAuthors(authorList) {
            return _.orderBy(authorList, function(auth) {
                const transpose = char => ({ Ä: "Å", Å: "Ä", ä: "å", å: "ä" }[char] || char)
                return _.map(auth.name_for_index.toUpperCase(), transpose).join("")
            })
        },

        setupHashComplex(scope, config) {
            // config = [
            //     expr : "sorttuple[0]"
            //     scope_name : "sortVal"
            //     scope_func : "locChange"
            //     key : "sortering"
            //     val_in : (val) ->
            //         newVal
            //     val_out : (val) ->
            //         newVal
            //     post_change : () ->
            //     default : [val : valval]

            // ]
            function onWatch() {
                for (let obj of config) {
                    let val = $location.search()[obj.key]
                    if (val == null) {
                        if (obj.default) {
                            val = obj.default
                        } else {
                            if (typeof obj.post_change === "function") {
                                obj.post_change(val)
                            }
                            continue
                        }
                    }

                    val = (obj.val_in || _.identity)(val)
                    // c.log "obj.val_in", obj.val_in

                    if ("scope_name" in obj) {
                        scope[obj.scope_name] = val
                    } else if ("scope_func" in obj) {
                        scope[obj.scope_func](val)
                    } else {
                        scope[obj.key] = val
                    }
                }
            }
            onWatch()
            scope.loc = $location
            scope.$watch("loc.search()", () =>
                // c.log "onWatch", onWatch
                onWatch()
            )

            for (let obj of config) {
                const watch = obj.expr || obj.scope_name || obj.key
                scope.$watch(
                    watch,
                    ((obj, watch) =>
                        function(val) {
                            // c.log "before val", scope.$eval watch
                            val = (obj.val_out || _.identity)(val)
                            if (val === obj.default) {
                                val = null
                            }
                            const loc = $location.search(obj.key, val || null)
                            if (obj.replace !== false) {
                                loc.replace()
                            }
                            // c.log "post change", watch, val
                            return typeof obj.post_change === "function"
                                ? obj.post_change(val)
                                : undefined
                        })(obj, watch)
                )
            }
        },

        setupHash(scope, ...nameConfig) {
            const names = _.map(nameConfig, function(item) {
                if (_.isObject(item)) {
                    return _.head(_.toPairs(item))[0]
                } else {
                    return item
                }
            })
            // c.log "init", _.pick($location.search(), names...)
            _.extend(scope, _.pick($location.search(), ...names))
            scope.loc = $location
            scope.$watch("loc.search()", () =>
                _.extend(scope, _.pick($location.search(), ...names))
            )

            for (let name of nameConfig) {
                var callback
                if (_.isObject(name)) {
                    ;[name, callback] = _.head(_.toPairs(name))
                }
                scope[name] = $location.search()[name]
                scope.$watch(
                    name,
                    (name =>
                        function(val) {
                            $location.search(name, val || null)
                            if (callback) {
                                return callback(val)
                            }
                        })(name)
                )
            }
        }
    }
})

// writeDownloadableUrl = (toWorkObj) ->

const expandMediatypes = function(works, mainMediatype) {
    const order = ["etext", "faksimil", "epub", "pdf", "infopost"]
    const groups = _.groupBy(works, item => item.titlepath + item.lbworkid)
    const output = []
    const getMainAuthor = metadata => (metadata.work_authors || metadata.authors)[0]

    const makeObj = function(metadata) {
        if (metadata.mediatype === "pdf") {
            return {
                label: metadata.mediatype,
                url: `txt/${metadata.lbworkid}/${metadata.lbworkid}.pdf`,
                downloadable: true
            }
        } else if (metadata.mediatype === "infopost") {
            return {
                label: metadata.mediatype,
                url: `/dramawebben/pjäser?om-boken&author_id=${
                    metadata.authors[0].author_id
                }&titlepath=${metadata.titlepath}`
            }
        } else {
            return {
                label: metadata.mediatype,
                url: `/forfattare/${
                    getMainAuthor(metadata).author_id
                }/titlar/${metadata.work_title_id || metadata.title_id}/sida/${
                    metadata.startpagename
                }/${metadata.mediatype}`
            }
        }
    }

    for (let key in groups) {
        let group = groups[key]
        const sortWorks = function(work) {
            if (mainMediatype && work.mediatype === mainMediatype) {
                return -10
            } else {
                return _.indexOf(order, work.mediatype)
            }
        }
        group = _.sortBy(group, sortWorks)
        const [main, ...rest] = group

        main.work_title_id = main.work_title_id || main.title_id

        let mediatypes = [makeObj(main)]
        mediatypes = mediatypes.concat(_.map(rest, makeObj))

        // if main.has_epub
        for (let work of group) {
            if (work.has_epub) {
                mediatypes.push({
                    label: "epub",
                    url: `txt/epub/${getMainAuthor(work).author_id}_${work.work_title_id ||
                        work.title_id}.epub`,
                    downloadable: true
                })
                break
            }
        }

        const sortMedia = item => _.indexOf(order, item.label)

        main.mediatypes = _.sortBy(mediatypes, sortMedia)
        output.push(main)
    }

    return output
}

littb.factory("backend", function($http, $q, util, $timeout, $sce) {
    // $http.defaults.transformResponse = (data, headers) ->
    // localStorageCache = $angularCacheFactory "localStorageCache",
    //     storageMode: 'localStorage'
    const parseXML = function(data) {
        let xml = null
        let tmp = null
        if (!data || typeof data !== "string") {
            return null
        }
        try {
            if (window.DOMParser) {
                // Standard
                tmp = new DOMParser()
                xml = tmp.parseFromString(data, "text/xml")
            } else {
                // IE
                // c.log "data", data.replace /<\?xml.*/, ''
                xml = new ActiveXObject("Microsoft.XMLDOM")
                xml.async = "false"
                xml.loadXML(data)
            }
        } catch (e) {
            xml = "undefined"
        }
        if (!xml || !xml.documentElement || xml.getElementsByTagName("parsererror").length) {
            jQuery.error(`Invalid XML: ${data}`)
        }
        return xml
    }

    const http = function(config) {
        const defaultConfig = {
            method: "GET",
            params: {
                username: "app"
            },
            transformResponse(data, headers) {
                const output = parseXML(data)
                if ($("fel", output).length) {
                    c.log("xml parse error:", $("fel", output).text())
                }
                return output
            }
        }

        return $http(_.merge(defaultConfig, config))
    }

    const objFromAttrs = function(elem) {
        if (!elem) {
            return null
        }
        return _.fromPairs(
            Array.from(elem.attributes).map(attrib => [util.normalize(attrib.name), attrib.value])
        )
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
            }).then(function(response) {
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
            const url = `${STRIX_URL}/list_all/etext`

            const text_filter = {}
            const params = {
                has_epub: true,
                to: size || 10000,
                include: `lbworkid,titlepath,sortkey,title,title_id,work_title_id,shorttitle,mediatype,authors.author_id,
                    authors.name_for_index,authors.authortype,startpagename,authors.surname,authors.full_name`,
                exclude: "text,parts,sourcedesc,pages,errata",
                sort_field: sort_field || "epub_popularity|desc"
            }

            if (authorid) {
                // url += "/" + authorid
                text_filter["main_author.author_id"] = authorid
            }
            if (filterTxt) {
                params.filter_string = filterTxt
            }

            params.text_filter = JSON.stringify(text_filter)

            return $http({
                url,
                params
            }).then(response => response.data)
        },

        getEpubAuthors() {
            const url = `${STRIX_URL}/get_work_prop_authors?key=has_epub&val=true`

            return $http({ url }).then(response => response.data)
        },

        getParts(filterString, partial_string, text_filter = null) {
            if (partial_string == null) {
                partial_string = false
            }
            const def = $q.defer()
            // TODO: add filter for leaf titlepaths and mediatype
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                filter_string: filterString,
                to: 10000,
                text_filter
            }

            if (partial_string) {
                params.partial_string = true
            }

            $http({
                url: `${STRIX_URL}/list_all/etext-part,faksimil-part`,
                params
            }).success(function(response) {
                c.log("getParts data", response)
                return def.resolve(expandMediatypes(response.data))
            })

            return def.promise
        },

        getTitles(
            author,
            sort_key,
            string,
            aboutAuthors,
            getAll,
            partial_string,
            include = null,
            text_filter = null
        ) {
            if (aboutAuthors == null) {
                aboutAuthors = false
            }
            if (getAll == null) {
                getAll = false
            }
            if (partial_string == null) {
                partial_string = false
            }
            const def = $q.defer()
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                text_filter
            }

            if (include) {
                params.include = include
            }
            if (sort_key) {
                params.sort_field = sort_key
                params.to = 30
            } else {
                params.sort_field = "sortkey|asc"
                params.to = 10000
            }

            if (string) {
                params.filter_string = string
            }
            if (author) {
                author = `/${author}`
            }
            if (aboutAuthors) {
                params.about_author = true
            }
            if (partial_string) {
                params.partial_string = true
            }
            if (getAll) {
                params.to = 300
            }

            $http({
                url: `${STRIX_URL}/list_all/etext,faksimil,pdf` + (author || ""),
                params
            }).success(function(data) {
                c.log("data", data)
                const titles = data.data

                return def.resolve(expandMediatypes(titles))
            })

            return def.promise
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
                        "surname,author_id,birth,death,full_name,pseudonym,name_for_index,dramawebben"
                }
            }).then(response => response.data.data)
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
            $http({
                url,
                method: "GET",
                cache: true,
                params
            }).success(function(response) {
                c.log("getAuthorList", response)
                return def.resolve(response.data)
            })

            return def.promise
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
            }).then(function(response) {
                const provData = []
                const iterable = workinfo.provenance || []
                for (let i = 0; i < iterable.length; i++) {
                    var textField
                    const prov = iterable[i]
                    const output = response.data[prov.library]
                    if (!output) {
                        c.warn(`Library name '${prov.library}' not in provenance.json`, prov)
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
            const def = $q.defer()
            const url = `${STRIX_URL}/get_work_info`
            // params = {}
            // key is titlepath or lbworkid
            // params[key] = value
            $http({
                url,
                params
            })
                .success(function(response) {
                    let workinfo
                    if (response.hits === 0) {
                        def.reject("not_found")
                        return
                    }

                    let works = response.data
                    works = expandMediatypes(works, mediatype)

                    c.log("works", works)

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
                        .map(tr =>
                            _($(tr).find("td"))
                                .map(util.getInnerXML)
                                .map(_.str.strip)
                                .value()
                        )

                    workinfo.partStartArray = _(workinfo.parts)
                        .map(part => [workinfo.pagemap[`page_${part.startpagename}`], part])
                        .sortBy(function([i, part]) {
                            return i
                        })
                        .value()

                    c.log("getSourceInfo", workinfo)
                    return def.resolve(workinfo)
                })
                .error(xml => def.reject(xml))

            return def.promise
        },

        getInfopost(authorid, titlepath) {
            const url = `${STRIX_URL}/get_work_info`
            return $http({
                url,
                params: {
                    authorid,
                    titlepath
                }
            }).then(function(response) {
                console.log("response.data.data", response.data.data)
                let { data } = response.data

                data = expandMediatypes(data, "infopost")

                console.log("data[0]", data[0])
                return data[0]
            })
        },

        logPage(pageix, lbworkid, mediatype) {
            return $http({
                url: `${STRIX_URL}/log_page/${lbworkid}/${mediatype}/${pageix}`
            })
        },
        logQR(code, url) {
            return $http({
                url: `${STRIX_URL}/log_qr`,
                params: {
                    code,
                    url
                }
            })
        },

        logDownload(author, title, lbworkid) {
            return $http({
                url: `${STRIX_URL}/log_download/${author}/${title}/${lbworkid}`
            })
        },
        logLibrary(filter) {
            return $http({
                url: `${STRIX_URL}/log_library/${filter}`
            })
        },
        logQuicksearch(filter_val, label) {
            return $http({
                url: `${STRIX_URL}/log_quicksearch/${filter_val}/${label}`
            })
        },
        logError(type, payload) {
            return $http({
                url: `${STRIX_URL}/log_error/${type}`,
                params: payload
            })
        },

        getBackgroundConf() {
            return http({
                url: "/red/bilder/bakgrundsbilder/backgrounds.xml"
            }).then(function(response) {
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

        getAuthorInfo(author_id) {
            return $http({
                url: `${STRIX_URL}/get_lb_author/` + author_id
            }).then(
                function(response) {
                    const auth = response.data.data

                    // for auth in data
                    if (auth.picture) {
                        auth.smallImage = `/red/forfattare/${auth.author_id}/${
                            auth.author_id
                        }_small.jpeg`
                        auth.largeImage = `/red/forfattare/${auth.author_id}/${
                            auth.author_id
                        }_large.jpeg`
                    }

                    if (auth.dramawebben != null ? auth.dramawebben.picture : undefined) {
                        auth.dramawebben.largeImage = `/red/forfattare/${auth.author_id}/${
                            auth.author_id
                        }_dw_large.jpeg`
                    }

                    return auth
                },
                err => c.log("getAuthorInfo error", err)
            )
        },

        getTextByAuthor(author_id, textType, maybeAuthType, list_about) {
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
                url: `${STRIX_URL}/list_all/${textType}/${author_id}`,
                params
            }).then(response => expandMediatypes(response.data.data), err => c.log("err", err))
        },

        getPartsInOthersWorks(author_id, list_about) {
            if (list_about == null) {
                list_about = false
            }
            const params = {
                sort_field: "sortkey|desc"
            }
            if (list_about) {
                params["about_author"] = true
            }
            return $http({
                url: `${STRIX_URL}/list_parts_in_others_works/` + author_id,
                params
            }).then(
                response => expandMediatypes(response.data.data),
                err => c.log("err getPartsInOthersWorks", err)
            )
        },

        getStats() {
            return $http({
                url: `${STRIX_URL}/get_stats`
            }).then(function(response) {
                c.log("response", response)
                return response.data
            })
        },

        getTitlesByAuthor(author_id, cache, aboutAuthors) {
            // TODO: repace this with getTitles?
            // serviceName = if aboutAuthors then "get-works-by-author-keyword" else "get-titles-by-author"
            if (aboutAuthors == null) {
                aboutAuthors = false
            }
            const def = $q.defer()

            const params = { include: "shorttitle,lbworkid,titlepath,searchable" }

            if (aboutAuthors) {
                params.aboutAuthors = true
            }

            const url = `${STRIX_URL}/list_all/etext,faksimil/${author_id}`
            const req = {
                url,
                params
            }
            if (cache) {
                req.cache = true
            }
            $http(req).success(data => def.resolve(data.data))

            return def.promise
        },

        getDramawebTitles() {
            const params = {
                exclude: "text,parts,sourcedesc,pages,errata",
                include:
                    "shorttitle,title,lbworkid,titlepath,authors,title_id,mediatype,dramawebben,keyword,startpagename",
                text_filter: { "provenance.library": "Dramawebben" },
                sort_field: "sortkey|asc",
                show_all: true,
                to: 10000,
                author_aggregation: true
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
            }).then(function(response) {
                const titles = response.data.data

                return {
                    authors: _.map(response.data.author_aggregation, "author_id"),
                    works: expandMediatypes(titles)
                }
            })
        },

        searchLexicon(str, id, useWildcard, doSearchId, strict) {
            let params
            const def = $q.defer()
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

            http({
                url,
                params

                // transformResponse : (data, headers) ->
                //     c.log "transformResponse", data, headers
            })
                .success(function(xml) {
                    c.log("searchLexicon success", xml)

                    if ($(xml).text() === "Inga träffar") {
                        def.reject()
                        return
                    }

                    let output = $("artikel", xml)
                        .get()
                        .map(article => ({
                            baseform: $("grundform-clean:first", article).text(),
                            id: $("lemma", article)
                                .first()
                                .attr("id"),
                            // lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                            lexemes: util.getInnerXML(article)
                        }))

                    // window.output = output
                    output = _.sortBy(output, function(item) {
                        if (item.baseform === str) {
                            return "aaaaaaaaa"
                        }
                        return item.baseform.toLowerCase()
                    })

                    c.log("lexicon def resolve")

                    if (!output.length) {
                        def.reject()
                    }

                    return def.resolve(output)
                })
                .error(() => def.reject())

            return def.promise
        },

        getBiblinfo(params, wf) {
            const def = $q.defer()

            const url = `http://demolittb.spraakdata.gu.se/sla-bibliografi/?${params}`

            $http({
                url,
                method: "GET",
                params: {
                    username: "app",
                    wf
                }
            }).success(function(xml) {
                const output = $("entry", xml)
                    .get()
                    .map(entry => ({
                        title: util.getInnerXML($("title", entry)),
                        isbn: util.getInnerXML($("isbn", entry)),
                        issn: util.getInnerXML($("issn", entry)),
                        archive: util.getInnerXML($("manusarchive ArchiveID", entry))
                    }))

                return def.resolve(output)
            })
            return def.promise
        },

        getDiff(workgroup, myWits, ...ids) {
            const def = $q.defer()
            const url = `/views/sla/kollationering-${workgroup.toLowerCase()}.xml`

            http({
                url,
                transformResponse: null
            })
                .success(function(xml) {
                    const output = xml
                    return def.resolve(output)
                })
                .error(why => def.reject(why))

            return def.promise
        },

        submitContactForm(name, email, message, isSOL) {
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
                params
            })
        },

        ordOchSak(author, title) {
            const def = $q.defer()

            const titlemap = {
                OsynligaLankarSLA: "/views/sla/OLOrdSak-output.xml",
                GostaBerlingsSaga1SLA: "/views/sla/GBOrdSakForstaDel-output.xml",
                GostaBerlingsSaga2SLA: "/views/sla/GBOrdSakAndraDel-output.xml"
            }

            const url = titlemap[title]

            if (!url) {
                def.reject(
                    `${title} not of ${(() => {
                        const result = []
                        for (let t in titlemap) {
                            result.push(t)
                        }
                        return result
                    })()}`
                )
            } else {
                http({
                    url,
                    params: ""
                })
                    .success(function(xml) {
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

                        return def.resolve(data)
                    })
                    .error(def.reject)
            }

            return def.promise
        },

        fetchOverlayData(lbworkid, ix) {
            const filename = _.str.lpad(ix, 5, "0")
            const url = `txt/${lbworkid}/ocr_${filename}.html`
            return this.getHtmlFile(url).then(function(response) {
                SIZE_VALS = [625, 750, 1100, 1500, 2050]
                const html = response.data.firstChild
                // c.log $(html)
                const max = _.max(
                    _.map(
                        $(html)
                            .data("size")
                            .split("x"),
                        Number
                    )
                )
                const overlayFactors = _.map(SIZE_VALS, val => val / max)

                const xmlSerializer = new XMLSerializer()
                const result = xmlSerializer.serializeToString(html)
                return [result, overlayFactors]
            })
        },

        autocomplete(filterstr) {
            return $http({
                url: `${STRIX_URL}/autocomplete/${filterstr}`
            }).then(function(response) {
                // c.log "autocomplete response", response
                let data
                const content = response.data
                if (content.suggest && content.suggest.length)
                    c.log("suggest!", content.suggest[0].text, "score", content.suggest[0].score)
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

                for (let item of content.data) {
                    if (["etext", "faksimil"].includes(item.doc_type)) {
                        const title_id = item.work_title_id || item.title_id
                        item.url = `/forfattare/${
                            item.authors[0].author_id
                        }/titlar/${title_id}/sida/${item.startpagename}/${item.doc_type}`
                        item.label = `${item.authors[0].surname} – ${item.shorttitle || item.title}`
                        item.typeLabel = "Verk"
                        item.mediatypeLabel = item.doc_type
                    }
                    if (["etext-part", "faksimil-part"].includes(item.doc_type)) {
                        item.url = `/forfattare/${item.work_authors[0].author_id}/titlar/${
                            item.work_title_id
                        }/sida/${item.startpagename}/${item.mediatype}`
                        item.label = `${
                            (item.authors != null ? item.authors[0] : item.work_authors[0]).surname
                        } – ${item.shorttitle || item.title}`
                        item.typeLabel = "Del"
                        item.mediatypeLabel = item.mediatype
                    }

                    if (item.doc_type === "author") {
                        item.url = `/forfattare/${item.author_id}`
                        item.label = item.name_for_index
                        item.typeLabel = "Författare"
                    }

                    if (item.doc_type === "audio") {
                        item.url = `/ljudarkivet?spela=${item.file}`
                        item.label = item.title
                        item.typeLabel = "Ur ljudarkivet"
                    }
                }

                return content.data
            })
        }
    }
})

littb.factory("bkgConf", function(backend) {
    const confPromise = backend.getBackgroundConf()

    return {
        get(page) {
            return confPromise.then(function(conf) {
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

littb.factory("authors", function(backend, $q) {
    let exclude
    const def = $q.defer()
    // @promise = def.promise
    backend
        .getAuthorList(
            null,
            (exclude =
                "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources")
        )
        .then(function(authors) {
            const authorsById = _.fromPairs(_.map(authors, item => [item.author_id, item]))
            // c.log "authorsById", authorsById
            return def.resolve([authors, authorsById])
        })

    return def.promise
})

littb.factory("SearchData", function(backend, $q, $http, $location) {
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

            this.include = "authors,title,titlepath,title_id,mediatype,lbworkid"
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
                url: `${STRIX_URL}/lb_search_count/${query}`,
                params: _.omit(params, "number_of_fragments", "from", "to"),
                cache: true
            }).success(response => {
                c.log("count all", response)
                this.total_hits = response.total_highlights
                return c.log("@total_hits", this.total_hits)
            })

            return $http({
                url: `${STRIX_URL}/lb_search/${query}`,
                params,
                cache: true
            }).then(response => {
                c.log("response", response.data)
                this.isSearching = false

                this.total_doc_hits = response.data.hits
                this.compactLeftContext(response.data.data)

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
                // authors: _.map sentenceData.metadata.authors, "author_id"
                work_ids: sentenceData.metadata.lbworkid,
                from: 0,
                to: 1
            }

            params = _.extend({}, this.currentParams, params)

            return $http({
                url: `${STRIX_URL}/lb_search/${this.currentParams.query}`,
                params
            }).then(response => {
                c.log("getMoreHighlights response", response.data.data)
                this.compactLeftContext(response.data.data)

                const decorated = _.flatten(this.decorateData(response.data.data, num_fragments))
                c.log("decorated", decorated)
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

            let merged = _(matchParams).reduce(function(obj1, obj2) {
                if (!obj1) {
                    return {}
                }
                return _.merge({}, obj1, obj2, function(a, b) {
                    if (!a) {
                        return b
                    }
                    return a + "|" + b
                })
            })

            for (let key in this.currentParams) {
                // TODO text_attrs are not more
                const val = this.currentParams[key]
                if (key === "text_attrs" && val.length) {
                    merged[`s_${key}`] = val.join(",")
                } else {
                    merged[`s_${key}`] = val
                }
            }

            merged["s_lbworkid"] = metadata.lbworkid
            merged.hit_index = index
            merged = _(merged)
                .toPairs()
                .invokeMap("join", "=")
                .join("&")

            const author = metadata.authors[0].author_id
            const titleid = metadata.title_id

            return `/forfattare/${author}/titlar/${titleid}
                /sida/${matches[0].attrs.n}/${metadata.mediatype}?${merged}`
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

littb.factory("SearchWorkData", function(SearchData, $q, $http) {
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
            source.onerror = function(event) {
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

function __range__(left, right, inclusive) {
    let range = []
    let ascending = left < right
    let end = !inclusive ? right : ascending ? right + 1 : right - 1
    for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
        range.push(i)
    }
    return range
}
function __guard__(value, transform) {
    return typeof value !== "undefined" && value !== null ? transform(value) : undefined
}
