littb = angular.module('littbApp');
SIZE_VALS = [625, 750, 1100, 1500, 2050]

# STRIX_URL = "http://kappa.svenska.gu.se:8081"
# STRIX_URL = "http://" + location.host.split(":")[0] + ":5000"
STRIX_URL = "http://demosb.spraakdata.gu.se/strix/backend"

if _.str.startsWith(location.host, "demolittb")
    STRIX_URL = "http://demosb.spraakdata.gu.se/strix/backend"
    

littb.factory "debounce", ($timeout) ->
    (func, wait, options) ->
        args = null
        inited = null
        result = null
        thisArg = null
        timeoutDeferred = null
        trailing = true
        
        delayed = ->
            inited = timeoutDeferred = null
            result = func.apply(thisArg, args) if trailing
        if options is true
            leading = true
            trailing = false
        else if options and angular.isObject(options)
            leading = options.leading
            trailing = (if "trailing" of options then options.trailing else trailing)
        return () ->
            args = arguments
            thisArg = this
            $timeout.cancel timeoutDeferred
            if not inited and leading
                inited = true
                result = func.apply(thisArg, args)
            else
                timeoutDeferred = $timeout(delayed, wait)
            result




littb.factory "util", ($location) ->
    PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i
    SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g
    MOZ_HACK_REGEXP = /^moz([A-Z])/
    camelCase = (name) ->
        name.replace(SPECIAL_CHARS_REGEXP, (_, separator, letter, offset) ->
            if offset then letter.toUpperCase() else letter
        ).replace MOZ_HACK_REGEXP, "Moz$1"


    xml2Str = (xmlNode) ->
        try
            # Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
            return (new XMLSerializer()).serializeToString(xmlNode)
        catch e
            try

                # Internet Explorer.
                return xmlNode.xml
            catch e
                #Other browsers without XML Serializer
                alert "Xmlserializer not supported"
        false


    getInnerXML : (elem) ->
        if "jquery" of elem
            unless elem.length then return null
            elem = elem.get(0)

        strArray = for child in elem.childNodes
            xml2Str child
        return strArray.join("")

    normalize : (name) ->
        camelCase(name.replace(PREFIX_REGEXP, ''))


    titleSort : (a) ->
       _.map a.shorttitle.split(/(\d+)/), (item) -> 
           if Number(item)
               zeroes = (_.map [0..(10 - item.toString().length)], () -> "0").join("")

               return zeroes + item.toString()
           else 
               return item

    setupHashComplex : (scope, config) ->
        # config = [
        #     expr : "sorttuple[0]"
        #     scope_name : "sortVal"
        #     scope_func : "locChange"
        #     key : "sortering"
        #     val_in : (val) ->
        #         newVal
        #     val_out : (val) ->
        #         newVal
        #     post_change : () ->
        #     default : [val : valval]

        # ]
        onWatch = () ->
            for obj in config
                val = $location.search()[obj.key]
                unless val?
                    if obj.default
                        val = obj.default 
                    else 
                        obj.post_change?(val)
                        continue
                
                val = (obj.val_in or _.identity)(val)
                # c.log "obj.val_in", obj.val_in
                
                if "scope_name" of obj
                    scope[obj.scope_name] = val
                else if "scope_func" of obj
                    scope[obj.scope_func](val)
                else
                    scope[obj.key] = val
        onWatch()
        scope.loc = $location
        scope.$watch 'loc.search()', ->
            # c.log "onWatch", onWatch
            onWatch()

        for obj in config
            watch = obj.expr or obj.scope_name or obj.key
            scope.$watch watch, do (obj, watch) ->
                (val) ->
                    # c.log "before val", scope.$eval watch
                    val = (obj.val_out or _.identity)(val)
                    if val == obj.default then val = null
                    loc = $location.search obj.key, val or null
                    if obj.replace != false then loc.replace()
                    # c.log "post change", watch, val
                    obj.post_change?(val)





    setupHash : (scope, nameConfig...) ->
        names = _.map nameConfig, (item) ->
            if _.isObject(item)
                return (_.head _.pairs item)[0]
            else
                return item
        # c.log "init", _.pick($location.search(), names...)
        _.extend(scope, _.pick($location.search(), names...))
        scope.loc = $location
        scope.$watch 'loc.search()', ->
            _.extend(scope, _.pick($location.search(), names...))

        for name in nameConfig
            if _.isObject name
                [name, callback] = _.head _.pairs name
            scope[name] = $location.search()[name]
            scope.$watch name, do (name) ->
                (val) ->
                    $location.search(name, val or null)
                    callback(val) if callback



# writeDownloadableUrl = (toWorkObj) ->
    

expandMediatypes = (works) ->
    groups = _.groupBy works, "titlepath"
    output = []
    getMainAuthor = (metadata) ->
        (metadata.work_authors or metadata.authors)[0]

    makeObj = (metadata) ->
        if metadata.mediatype == "pdf"
            return {
                label : metadata.mediatype
                url : "txt/#{metadata.lbworkid}/#{metadata.lbworkid}.pdf"
                downloadable : true
            }
        else
            return {
                label : metadata.mediatype
                url : "/#!/forfattare/#{getMainAuthor(metadata).author_id}/titlar/#{metadata.work_title_id}/sida/#{metadata.startpagename}/#{metadata.mediatype}"
            }



    for key, group of groups
        group = _.sortBy group, "mediatype"
        [main, rest...] = group

        main.work_title_id = main.work_title_id or main.title_id

        mediatypes = [makeObj(main)]
        mediatypes = mediatypes.concat _.map rest, makeObj

        if main.has_epub
            mediatypes.push
                label : "epub"
                url : "txt/epub/" + getMainAuthor(main).author_id + "_" + main.work_title_id + ".epub"
                downloadable : true


        sortMedia = (item) ->
            order = ['etext', 'faksimil', 'epub', 'pdf']
            return _.indexOf order, item.label


        main.mediatypes = _.sortBy mediatypes, sortMedia
        output.push main
        
    return output


littb.factory 'backend', ($http, $q, util) ->
    # $http.defaults.transformResponse = (data, headers) ->
    # localStorageCache = $angularCacheFactory "localStorageCache", 
    #     storageMode: 'localStorage'
    parseXML = (data) ->
        xml = null
        tmp = null
        return null if not data or typeof data isnt "string"
        try
            if window.DOMParser # Standard
                tmp = new DOMParser()
                xml = tmp.parseFromString(data, "text/xml")
            else # IE
                # c.log "data", data.replace /<\?xml.*/, ''
                xml = new ActiveXObject("Microsoft.XMLDOM")
                xml.async = "false"
                xml.loadXML data
        catch e
            xml = 'undefined'
        jQuery.error "Invalid XML: " + data  if not xml or not xml.documentElement or xml.getElementsByTagName("parsererror").length
        xml


    http = (config) ->
        defaultConfig =
            method : "GET"
            params:
                username : "app"
            transformResponse : (data, headers) ->
                output = parseXML(data)
                if $("fel", output).length
                    c.log "xml parse error:", $("fel", output).text()
                return output

        $http(_.merge defaultConfig, config)


    objFromAttrs = (elem) ->
        return null unless elem
        _.object ([util.normalize(attrib.name), attrib.value] for attrib in elem.attributes)

    getHtmlFile : (url) ->
        return http(
            url : url
        )
    
    getEpub : (size) ->
        
        return $http(
            url : "#{STRIX_URL}/get_epub"        
            params :
                size : size or 10000
                exclude : "text,parts,sourcedesc,pages,errata"
                sort_field : "epub_popularity|desc"
        ).then (response) ->
            return response.data.data

    getParts : (filterString) ->
        def = $q.defer()
        # TODO: add filter for leaf titlepaths and mediatype
        params = 
            exclude : "text,parts,sourcedesc,pages,errata"
            filter_string: filterString
            to: 10000


        $http(
            url : "#{STRIX_URL}/lb_list_all/part"
            params: params


        ).success (response) ->
            c.log "getParts data", response
            def.resolve expandMediatypes(response.data)

        return def.promise



    getTitles : (includeParts = false, author = null, sort_key = null, string = null, aboutAuthors=false, getAll = false) ->
        def = $q.defer()
        params = 
            exclude : "text,parts,sourcedesc,pages,errata"

        if sort_key
            params.sort_field = sort_key
            params.to = 30
        else
            params.sort_field = "sortkey|asc"
            params.to = 10000
            
        if string
            params.filter_string = string
        if author
            author = "/" + author
        if aboutAuthors
            params.about_authors = true
        # if getAll
        #     params.to = 500

        $http(
            url : "#{STRIX_URL}/lb_list_all/etext,faksimil,pdf" + (author or "")
            params: params


        ).success (data) ->
            c.log "data", data
            titles = data.data

            def.resolve expandMediatypes(titles)

        return def.promise

    getPopularAuthors : () ->
        $http(
            url : "#{STRIX_URL}/get_popular_authors"
        ).then (response) ->
            return response.data.data
    getAuthorList : (include, exclude) ->

        def = $q.defer()
        url = "#{STRIX_URL}/get_authors"
        params = {}
        if include
            params.include = include.join(",")
        if exclude
            params.exclude = exclude.join(",")
        $http(
            url : url
            method: "GET"
            cache: true
            params : params
        ).success (response) ->
            c.log "getAuthorList", response
            def.resolve response.data

        return def.promise

    getLicense : (workinfo) ->
        $http(
            url : "/xhr/red/etc/license/license.json"
            cache: true
        ).then (response) ->
            return response.data[workinfo.license]


    getProvenance : (workinfo) ->
        $http(
            url : "/xhr/red/etc/provenance/provenance.json"
            cache: true
        ).then (response) ->
            provData = []
            for prov, i in workinfo.provenance
                output = response.data[prov.library]
                unless output
                    c.warn "Library name #{prov.library} not in provenance.json"
                if i > 0 and prov.text2
                    textField = 'text2' 
                else 
                    textField = 'text'
                if workinfo.mediatype == "faksimil" and workinfo.printed
                    output.text = output[textField].faksimilnoprinted    
                else if workinfo.mediatype == "faksimil" and not workinfo.printed
                    output.text = output[textField].faksimilnoprinted    
                else 
                    output.text = output[textField][workinfo.mediatype]

                signum = ""
                if prov.signum then signum = " (#{prov.signum})"
                output.text = _.template(output.text)({
                    signum: signum or ""
                })
                provData.push output
            return provData
    getSourceInfo : (key, value) ->
        # TODO: mediatype can be null?
        def = $q.defer()
        url = "#{STRIX_URL}/get_work_info"
        params = {}
        # key is titlepath or lbworkid
        params[key] = value
        $http(
            url : url
            params: params
        ).success( (response) ->
            if response.hits == 0
                def.reject "not_found"
                return

            works = response.data
            c.log "works", works


            workinfo = expandMediatypes(works)[0]

            workinfo.pagemap = {}
            for pg in workinfo.pages
                workinfo.pagemap["page_" + pg.pagename] = pg.pageindex
                workinfo.pagemap["ix_" + pg.pageindex] = pg.pagename
            delete workinfo.pages

            workinfo.errata = for tr in $("tr", workinfo.errata)
                _($(tr).find("td")).map(util.getInnerXML)
                .map(_.str.strip).value()

            c.log "getSourceInfo", workinfo
            def.resolve workinfo
        ).error (xml) ->
            def.reject xml
        
        return def.promise


    logPage : (pageix, lbworkid, mediatype) ->
        $http(
            url : "#{STRIX_URL}/log_page/#{lbworkid}/#{mediatype}/#{pageix}"
        )

    logDownload : (author, title, lbworkid) ->
        $http(
            url : "#{STRIX_URL}/log_download/#{author}/#{title}/#{lbworkid}"
        )
    logLibrary : (filter) ->
        $http(
            url : "#{STRIX_URL}/log_library/#{filter}"
        )

    getAuthorInfo : (author_id) ->
        return $http(
            url : "#{STRIX_URL}/get_lb_author/" + author_id
        ).then( (response) ->

            auth = response.data.data

            # for auth in data
            if auth.image
                auth.smallImage = "/red/forfattare/#{auth.author_id}/#{auth.author_id}_small.jpeg"
                auth.largeImage = "/red/forfattare/#{auth.author_id}/#{auth.author_id}_large.jpeg"

            return auth
        , (err) ->
            c.log "getAuthorInfo error", err
        )


    getTextByAuthor : (author_id, textType, maybeAuthType, list_about=false) ->
        params = 
            exclude : "text,parts,sourcedesc,pages,errata"
            to : 10000
            sort: "sortkey"
        if maybeAuthType
            params["author_type"] = maybeAuthType
        if list_about
            params["about_author"] = true
            
        return $http(
            url : "#{STRIX_URL}/lb_list_all/#{textType}/#{author_id}"
            params : params
        ).then( (response) ->
            return expandMediatypes response.data.data
        , (err) ->
            c.log "err", err
        )


    getPartsInOthersWorks : (author_id, list_about=false) ->
        params = {}
        if list_about
            params["about_author"] = true
        return $http(
            url : "#{STRIX_URL}/list_parts_in_others_works/" + author_id
            params : params
                
        ).then( (response) ->
            return expandMediatypes response.data.data
        , (err) ->
            c.log "err getPartsInOthersWorks", err
        )        

    getStats : () ->
        $http(
            url : "#{STRIX_URL}/get_stats"
        ).then (response) ->
            c.log "response", response
            return response.data

    getTitlesByAuthor : (author_id, cache, aboutAuthors=false) ->
        # TODO: repace this with getTitles?
        # serviceName = if aboutAuthors then "get-works-by-author-keyword" else "get-titles-by-author"
        def = $q.defer()
        
        params = 
            include : "shorttitle,lbworkid,titlepath,searchable"

        if aboutAuthors
            params.aboutAuthors = true

        # url = "/query/lb-anthology.xql"
        url = "#{STRIX_URL}/lb_list_all/etext,faksimil/#{author_id}"
        req = 
            url : url
            params: params
        if cache then req.cache = true
        $http(req).success (data) ->
            def.resolve data.data


        return def.promise


    searchLexicon : (str, id, useWildcard, doSearchId, strict) ->
        def = $q.defer()
        url = "/query/so.xql"
        # c.log "searchId", searchId
        if doSearchId
            params = 
                id : id
        else
            suffix = if useWildcard and str.length > 3 then "*" else ""
            params = 
                word : str + suffix
        
        if strict
            params['strict'] = true

        http(
            url : url
            params : params
                
            # transformResponse : (data, headers) ->
            #     c.log "transformResponse", data, headers

        ).success( (xml) ->
            c.log "searchLexicon success", xml

            if $(xml).text() == "Inga träffar"
                def.reject()
                return
            
            
            output = for article in $("artikel", xml)
                baseform : $("grundform-clean:first", article).text()
                id : $("lemma", article).first().attr("id")
                # lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                lexemes : util.getInnerXML article

            # window.output = output
            output = _.sortBy output, (item) ->
                if item.baseform == str then return "aaaaaaaaa"
                item.baseform.toLowerCase()

            c.log "lexicon def resolve"

            unless output.length
                def.reject()

            def.resolve output
        ).error () ->
            def.reject()



        return def.promise

    getBiblinfo : (params, wf) ->
        def = $q.defer()

        url = "http://demolittb.spraakdata.gu.se/sla-bibliografi/?" + params

        $http(
            url : url
            method : "GET"
            params:
                username : "app"
                wf : wf
        ).success (xml) ->
            output = for entry in $("entry", xml)
                title : util.getInnerXML $("title", entry)
                isbn : util.getInnerXML $("isbn", entry)
                issn : util.getInnerXML $("issn", entry)
                archive : util.getInnerXML $("manusarchive ArchiveID", entry)


            def.resolve output
        return def.promise
        
    
    getDiff : (workgroup, myWits, ids...) ->
        def = $q.defer()
        ## release
        #url = "/ws/kollationering/" + "?workgroup=" + workgroup + ("&lbworkid="+id for id in ids).join("")
        ## dev
        url = "/views/sla/kollationering-"+workgroup.toLowerCase()+".xml"
        
        http(
            url: url
            transformResponse: null
        ).success( (xml) ->
            output = xml
            def.resolve output
        ).error (why) ->
            def.reject(why)
            
        return def.promise

    
    submitContactForm : (name, email, message) ->
        params = 
            sender_name : name
            sender_address : email
            message : message
        if isDev
            params.test = true
        $http(
            url : "#{STRIX_URL}/contact"
            params: params
        )
        
    ordOchSak : (author, title) ->
        def = $q.defer()
        
        titlemap = 
            'OsynligaLankarSLA' : '/views/sla/OLOrdSak-output.xml'
            'GostaBerlingsSaga1SLA' : '/views/sla/GBOrdSakForstaDel-output.xml'
            'GostaBerlingsSaga2SLA' : '/views/sla/GBOrdSakAndraDel-output.xml'
        
        url = titlemap[title]
        
        if not url
           def.reject("#{title} not of #{t for t of titlemap}")
           
        else
            http(
                url : url
                params: ""
            ).success( (xml) ->
                data = []
                for entry in $("glossentry", xml)
                    pages = []
                    try
                        for page in $("page", entry)
                            pages.push page.textContent
                        data.push
                            pages: pages
                            ord: $("glossterm", entry)[0].textContent
                            forklaring:  $("glossdef para", entry)[0].textContent
                    catch ex
                        c.error "invalid entry?", entry
                
                def.resolve data
            ).error(def.reject)
        
        return def.promise

    fetchOverlayData : (lbworkid, ix) ->
        filename = _.str.lpad(ix, 5, "0")
        url = "txt/#{lbworkid}/ocr_#{filename}.html"
        this.getHtmlFile(url).then (response) ->
            SIZE_VALS = [625, 750, 1100, 1500, 2050]
            html = response.data.firstChild
            # c.log $(html)
            max = _.max _.map $(html).data("size").split("x"), Number
            overlayFactors = _.map SIZE_VALS, (val) -> val / max
            return [$(html).outerHTML(), overlayFactors]

    
    autocomplete : (filterstr) ->
        $http(
            url : "#{STRIX_URL}/autocomplete/#{filterstr}"
        ).then (response) ->
            data = response.data

            for item in data
                if item.doc_type in ["etext", "faksimil"]
                    title_id = item.work_title_id or item.title_id
                    item.url = "/forfattare/#{item.authors[0].author_id}/titlar/#{title_id}/sida/#{item.startpagename}/#{item.doc_type}"
                    item.label = "#{item.authors[0].surname} – #{item.shorttitle}" 
                    item.typeLabel = "Verk"
                    item.mediatypeLabel = item.doc_type
                if item.doc_type == "part"
                    item.url = "/forfattare/#{item.work_authors[0].author_id}/titlar/#{item.work_title_id}/sida/#{item.startpagename}/#{item.mediatype}"
                    item.label = "#{(item.authors?[0] or item.work_authors[0]).surname} – #{item.shorttitle}"
                    item.typeLabel = "Del"
                    item.mediatypeLabel = item.mediatype

                if item.doc_type == "author"
                    item.url = "/forfattare/#{item.author_id}"
                    item.label = item.name_for_index
                    item.typeLabel = "Författare"

            return data


        
        


littb.factory "authors", (backend, $q) ->
    
    def = $q.defer()
    # @promise = def.promise
    backend.getAuthorList(null, exclude=['intro']).then (authors) =>
        authorsById = _.object _.map authors, (item) =>
            [item.author_id, item]
        # c.log "authorsById", authorsById
        def.resolve [authors, authorsById]


    return def.promise


littb.factory "SearchData", (backend, $q, $http, $location) ->

    class SearchData
        constructor: () ->
            @data = []
            @total_hits = null
            @total_doc_hits = null
            @current = null
            @currentParams = null

            @isSearching = false
            @NUM_HITS = 30 # how many doc hits per search?
            @NUM_HIGHLIGHTS = 5

            @include = "authors,title,titlepath,title_id,mediatype,lbworkid"

        newSearch : (params) ->
            @data = []
            @total_hits = null
            @total_doc_hits = null
            @currentParams = params
            @doNewSearch = true
            @current = null
            @isSearching = false
            @savedParams = null

        submit : (query, params) ->
            $http(
                url: "#{STRIX_URL}/lb_search_count/#{query}"
                params : _.omit params, "number_of_fragments", "from", "to"
                cache: true
            ).success (response) =>
                c.log "count all", response
                @total_hits = response.total_highlights
                c.log "@total_hits", @total_hits

            return $http(
                url: "#{STRIX_URL}/lb_search/#{query}"
                params : params
                cache: true
            ).then (response) =>
                c.log "response", response.data
                @isSearching = false
                
                @total_doc_hits = response.data.hits
                @compactLeftContext(response.data.data)

                sentsWithHeaders = @decorateData(response.data.data, @NUM_HIGHLIGHTS)


                return [sentsWithHeaders, response.data.author_aggregation]
            # .error (data) =>
                # def.reject(data)

        searchWorks : (o) ->
            c.log "searchvars", o

            @isSearching = true

            params = 
                include: @include
                number_of_fragments: @NUM_HIGHLIGHTS + 1

            params = _.extend {}, o, params
            return @submit(o.query, params)

        resetMod : () ->
            def = $q.defer()
            @currentParams = @savedParams
            @savedParams = null
            @searchWorks(@currentParams).then (data) ->
                def.resolve data
            return def.promise

        modifySearch : (arg_mod) ->
            # redoes search with new args
            def = $q.defer()
            if not @savedParams
                @savedParams = @currentParams
            @currentParams = _.extend {}, @savedParams, arg_mod
            @searchWorks(@currentParams).then (data) ->
                def.resolve data
            return def.promise


        slice : (from, to) ->
            unless @currentParams then return
            c.log "slice", from, to
            if from < 0 then from = 0
            def = $q.defer()
            if (@hasSlice from, to) and not @doNewSearch
                c.log "@hasSlice from, to", (@hasSlice from, to)
                def.resolve(@data.slice(from, to))
            else
                # [missingStart, missingEnd] = @findMissingInSpan(from, to)
                # if missingEnd
                #     @currentParams.from = missingStart
                #     c.log "missingStart", missingStart, missingEnd
                #     @currentParams.to = missingEnd
                # else
                @currentParams.from = from
                @currentParams.to = to

                @searchWorks(@currentParams).then (response) =>
                    @data[@currentParams.from..@currentParams.to] = response[0]
                    def.resolve response
            @doNewSearch = false
            return def.promise

        hasSlice: (from, to) ->
            slice = @data.slice(from, to)
            if slice.length < (to - from) then return false
            return not _.any slice, _.isUndefined

        # findMissingInSpan : (from, to) ->
        #     start = null

        #     span = @data[from..to]
        #     for item, i in span
        #         if not item? # count undefined
        #             start = i
        #             end = (_.takeWhile span[i..], _.isUndefined).length
        #             break

        #     c.log "end", end
        #     return [from + start, from + start + end]


        getMoreHighlights : (sentenceData) ->
            sentenceData.at_highlight_page ?= 1
            at_page = sentenceData.at_highlight_page + 1
            num_fragments = at_page * @NUM_HIGHLIGHTS
            c.log "sentenceData.at_highlight_page", sentenceData.at_highlight_page
            params = 
                include: @include
                number_of_fragments: num_fragments + 1
                # authors: _.pluck sentenceData.metadata.authors, "author_id"
                work_ids: sentenceData.metadata.lbworkid
                from: 0
                to: 1

            params = _.extend {}, @currentParams, params

            return $http(
                url: "#{STRIX_URL}/lb_search/#{@currentParams.query}"
                params : params
            ).then (response) =>
                c.log "getMoreHighlights response", response.data.data
                @compactLeftContext(response.data.data)
                

                decorated = _.flatten @decorateData(response.data.data, num_fragments)
                c.log "decorated", decorated
                if (_.last decorated).overflow
                    (_.last decorated).at_highlight_page = at_page
                return decorated



        decorateData : (data, num_fragments) ->
            groupSents = (data) =>
                i = 0
                output = []

                row_index = 0
                for item in data
                    work_rows = [{isHeader: true, metadata: item.source}]
                    output.push work_rows
                    for high in item.highlight
                        obj = {metadata: item.source, highlight: high, index: row_index}
                        obj.href = @parseUrls obj, row_index
                        work_rows.push obj
                        row_index++
                    if item.overflow
                        work_rows.push {metadata: item.source, overflow: true}

                return output


            punctArray = [",", ".", ";", ":", "!", "?", "..."]
            for work in data
                if work.highlight.length > num_fragments
                    work.highlight = work.highlight[0..num_fragments - 1]
                    work.overflow = true
                
                for high in work.highlight

                    for key in ["left_context", "match", "right_context"]
                        for wd in high[key]
                            if wd.word in punctArray
                                wd._punct = true

            return groupSents(data)

        compactLeftContext : (data) ->
            min = 40 # no longer sentences than min chars
            # for work in data
            #     for ctx in _.pluck work.highlight, "left_context"
            #         sum = _.sum ctx, (wd) -> wd.word.length

            #         if sum < min then min = sum 

            #         ctx.num_chars = sum
            c.log "min", min
            for work in data
                for ctx in _.pluck work.highlight, "left_context"
                    num_chars = _.sum ctx, (wd) -> wd.word.length
                    if num_chars > min
                        diff = num_chars - min
                        dropped = 0

                        for wd, i in ctx
                            if dropped >= diff
                                drop = i
                                break
                            dropped += wd.word.length

                        if drop
                            ctx.splice(0, drop)


        parseUrls : (row, index) ->
            metadata = row.metadata

            matches = row.highlight.match
            matchParams = []
            # TODO: this probably changed quite a bit
            # if metadata.mediatype == "faksimil"
                # matchGroups = _.groupBy matches, (match) -> match.attrs.x

                # makeParams = (group) ->
                #     params = _.pick group[0].attrs, "x", "y", "height"

                #     for match in group
                #         unless params.width
                #             params.width = Number(match.attrs.width)
                #         else
                #             params.width += Number(match.attrs.width)

                #     max = Math.max group[0].attrs.size.split("x")...
                #     factors = _.map SIZE_VALS, (val) -> val / max

                #     for key, val of params
                #         params[key] = _(factors).map( (fact) ->
                #             Math.round fact * val).join(",")
                #     return params
                
                # for group in _.values matchGroups
                #     matchParams.push makeParams group


            # else 
            matchParams.push
                traff : matches[0].attrs.wid
                traffslut : _.last(matches).attrs.wid
                

            merged = _(matchParams).reduce( (obj1, obj2) -> 
                if not obj1 then return {}
                _.merge {}, obj1, obj2, (a,b) -> 
                    unless a then return b
                    a + "|" + b
            )


            for key, val of @currentParams
                # TODO text_attrs are not more
                if key == "text_attrs" and val.length
                    merged["s_" + key] = val.join(",")
                else
                    merged["s_" + key] = val


            merged["s_lbworkid"] = metadata.lbworkid
            merged.hit_index = index
            merged = _(merged).pairs().invoke("join", "=").join("&")

            author = metadata.authors[0].author_id
            titleid = metadata.title_id

            return "/#!/forfattare/#{author}/titlar/#{titleid}" + 
                "/sida/#{matches[0].attrs.n}/#{metadata.mediatype}?#{merged}"
            

        next : () ->
            if @current + 1 == @total_doc_hits then return {then : angular.noop}
            @current++
            @get(@current)

            
        prev : () ->
            if @current == 0 then return {then : angular.noop}
            @current--
            @get(@current)

        get : (index) ->
            def = $q.defer()
            # c.log "search", @current

            if @data[index]? 
                def.resolve @data[index]
            else
                @slice(index - 10, index + 10).then () =>
                    c.log "@data[index]", index, @data
                    def.resolve @data[index]
            return def.promise

        reset : () ->
            @current = null
            @total_hits = null
            @total_doc_hits = null
            @data = []
            @currentParams = null


    # return new SearchData()
        
littb.factory "SearchWorkData", (SearchData, $q, $http) ->  
    # c.log "searchWorkData", SearchData
    class SearchWorkData extends SearchData
        constructor : () ->
            super()
            @n_times = 0
        submit : (query, params) ->
            c.log "params", params
            def = $q.defer()
            source = new EventSource("#{STRIX_URL}/search_document/#{params.lbworkid}/#{query}?init_hits=20");

            source.onmessage = (event) =>
                data = JSON.parse(event.data)

                c.log "onmessage onprogress", data 
                def.resolve [data.data]
                @n_times++ 

                if @n_times > 1
                    @search_id = data.search_id
                    @total_hits = data.total_hits

            source.onerror = (event) ->
                c.log "eventsource closed", event
                this.close()
                # def.resolve()

            return def.promise

        searchWorks : (o) ->
            @isSearching = true



            params = 
                include: @include
                number_of_fragments: @NUM_HIGHLIGHTS + 1

            params = _.extend {}, o, params
            if @n_times == 0
                return @submit(o.query, params).then (data) =>
                    @isSearching = false
                    return data
            else
                return @pageSearchInWork(@search_id, params.from, params.to)


        pageSearchInWork : (search_id, from, to) ->
            $http(
                url : "#{STRIX_URL}/page_search/#{search_id}/#{from}/#{to}"
            ).then (response) =>
                c.log "pageSearchInWork", response
                @isSearching = false
                return [response.data.data]


    # return new SearchWorkData()
