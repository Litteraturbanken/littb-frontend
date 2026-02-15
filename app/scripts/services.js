const angular = window.angular
const _ = window._
const c = window.console
import { createBackendService } from "./services/backend"

const littb = angular.module("littbApp")

let STRIX_URL = "http://" + location.host.split(":")[0] + ":5001"
// let STRIX_URL = "https://litteraturbanken.se/api"
// let STRIX_URL = "/api"

// Vite supports compile-time env vars prefixed with VITE_.
// This makes it easy to point the frontend at a local backend when needed.
if (import.meta.env.VITE_STRIX_URL) {
    STRIX_URL = import.meta.env.VITE_STRIX_URL
}

// For local dev/test, prefer the dev-server proxy so the app works without a local backend.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    STRIX_URL = "/api"
}

if (
    _.str.startsWith(location.host, "red.l") ||
    _.str.startsWith(location.host, "dev.l") ||
    _.str.startsWith(location.host, "litteraturbanken") ||
    import.meta.env.PROD
) {
    STRIX_URL = "/api"
}

window.STRIX_URL = STRIX_URL

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

littb.factory("backend", [
    "$http",
    "$q",
    "util",
    "$timeout",
    "$sce",
    "$filter",
    function ($http, $q, util, $timeout, $sce, $filter) {
        return createBackendService({
            $http,
            $q,
            util,
            $timeout,
            $sce,
            $filter,
            STRIX_URL,
            isDev: window.isDev
        })
    }
])

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
                params: _.omit(params, "number_of_fragments", "from", "to", "sort_field"),
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
                console.log("🚀 ~ sentsWithHeaders:", sentsWithHeaders)

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
                    console.log("🚀 ~ item:", item)
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
                queryParams.push("prefix=true")
            }
            if (params.suffix) {
                queryParams.push("suffix=true")
            }
            if (params.word_form_only != null) {
                queryParams.push("word_form_only=true")
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
