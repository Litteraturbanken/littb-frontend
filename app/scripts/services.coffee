littb = angular.module('littbApp');
SIZE_VALS = [625, 750, 1100, 1500, 2050]

STRIX_URL = "http://localhost:5000"

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





getCqp = (o) ->


    tokenList = []
    regescape = (s) ->
        s.replace(/[\.|\?|\+|\*|\|\"\(\)\^\$]/g, "\\$&")

    tokenize = (str) ->
        # Excludes some characters from starting word tokens
        # _re_word_start = /[^\(\"\'‘’–—“”»\`\\{\/\[:;&\#\*@\)}\]\-,…]/

        # Characters that cannot appear within words
        # _re_non_word_chars = /(?:[?!)\"“”»–—\\;\/}\]\*\'‘’\({\[…%])/ #@

        # Excludes some characters from ending word tokens
        # _re_word_end = /[\(\"\`{\[:;&\#\*@\)}\],]/

        # Multi-character punctuation
        # _re_multi_char_punct = /(?:\-{2,}|\.{2,}|(?:\.\s){2,}\.)/



        wdlist = for wd in o.query.split(/\s+/)
            extras = []
            if wd.match(/\.\.\./)
                extras.push "..."
                wd = wd.replace(/(\.\.\.)/, "")
            wd = wd.replace(/([\.,;:!?])/g, " $1")
            wd = wd.replace(/([-’])/g, " $1 ")
            wd = wd.replace(/(['])/g, " $1$1 ") # double quote for escaping
            wd = wd.replace(/([»])/g, "$1 ")
            c.log "wd", wd
            wd.split(" ")


        _.compact [].concat (_.flatten wdlist), extras


    for wd in tokenize(o.query)
        pre = suf = ""
        or_block = []
        flag = "%c"
        # flag = ""

        if o.prefix and not o.infix
            or_block.push "word = '#{regescape wd}.*'#{flag}"
        if o.suffix and not o.infix
            or_block.push "word = '.*#{regescape wd}'#{flag}"
        if o.infix
            or_block.push "word = '.*#{regescape wd}.*'#{flag}"
        if not o.prefix and not o.suffix
            or_block.push "word = '#{regescape wd}'#{flag}"

        tokenList.push "(#{or_block.join(' | ')})"


    getAuthors = (obj, type) ->
        auths = _.map obj.split(","), (auth) -> "_.text_#{type} contains '#{auth}'"
        auths = "(#{auths.join(' | ')})"

    optsToCQP = (optlist) ->
        map = 
            # all_texts : "Sök i <span class='sc'>ALLA TEXTER</span>"
            is_modernized : 
                cqp : "_.text_modernized = 'true'"
                group : 0
            not_modernized : 
                cqp : "_.text_modernized = 'false'"
                group : 0
            is_proofread : 
                cqp : "_.text_proofread = 'true'"
                group : 1
            not_proofread : 
                cqp : "_.text_proofread = 'false'"
                group : 1
            gender_female : 
                cqp : "_.text_gender contains 'female'"
                group : 2
            gender_male : 
                cqp : "_.text_gender contains 'male'"
                group : 2
            is_anom : 
                cqp : "_.text_authorid contains 'Anonym'"
                group : 2


        opts = _.map optlist, (key) -> map[key]
        groups = _.groupBy opts, "group"

        groups = _.map groups, (group) ->
            
            # vals = _.map (_.pluck group, "cqp"), (val) -> "_.text_" + val
            vals = _.pluck group, "cqp"
            return "(" + vals.join(" | ") + ")"

        return groups.join(" & ")

    structAttrs = []
    textAttrs = []
    c.log "o.text_attrs", o.text_attrs
    # if o.text_attrs.length
    #     if not _.isArray o.text_attrs then o.text_attrs = o.text_attrs.split(",")
    #     for attr in o.text_attrs
    #         textAttrs.push attr

    # if o.mediatype == "all"
    #     textAttrs.push "(_.text_mediatype = 'faksimil' | _.text_mediatype = 'etext')"
    # else
    #     textAttrs.push "_.text_mediatype = '#{o.mediatype}'"
    if o.selectedAuthor
        auths = getAuthors(o.selectedAuthor, "authorid")
        structAttrs.push auths
    else if o.selectedAboutAuthor
        auths = getAuthors(o.selectedAboutAuthor, "aboutauthor")
        structAttrs.push auths
    else if o.searchAllAbout
        structAttrs.push "ambiguity(_.text_aboutauthor) > 0"

    # if textAttrs.length then structAttrs.push "(#{textAttrs.join(' & ')})"

    if o.text_attrs?.length
        structAttrs.push optsToCQP(o.text_attrs)

    if o.selectedTitle
        titles = _.map o.selectedTitle.split(","), (id) -> "_.text_lbworkid = '#{id}'"
        titles = "(#{titles.join(' | ')})"
        structAttrs.push titles


    if structAttrs.length
        tokenList[0] += " & " + structAttrs.join(" & ")

    return "[#{tokenList.join('] [')}]"



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
                unless val 
                    if obj.default then val = obj.default else continue
                
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

    parseWorkInfo = (root, xml) ->
        useInnerXML = ["sourcedesc", "workintro", "license-text"]
        asArray = ["mediatypes"]

        output = {}
        for elem in $(root, xml).children()
            # c.log "parseWorkInfo", elem.nodeName
            if elem.nodeName in useInnerXML
                val = util.getInnerXML elem

            else if elem.nodeName in asArray
                val = _.map $(elem).children(), (child) ->
                    $(child).text()
            else if elem.nodeName in ["authorid", "authorid-norm"]
                val = {id : $(elem).text(), type: $(elem).attr("type")}
                (output[util.normalize(elem.nodeName)]?.push val) or
                 output[util.normalize(elem.nodeName)] = [val]
                 continue
            else
                val = $(elem).text()

            output[util.normalize(elem.nodeName)] = val


        prov = $("result provenance-data", xml)


        output["provenance"] = for item in prov
            {
                text : $("text", item).text()
                image : $("image", item).text()
                link : $("link", item).text()
            }


        output.sourcedescAuthor = $("sourcedesc-author", xml).text()
        sourcedesc = $("sourcedesc", xml)
        $("sourcedesc-author", sourcedesc).remove()

        errata = $("errata", xml)
        output.errata = for tr in $("tr", errata)
            _($(tr).find("td")).map(util.getInnerXML)
            .map(_.str.strip).value()
        errata.remove()

        output.sourcedesc = (util.getInnerXML sourcedesc) or ""


        # output.workintro = (util.getInnerXML workintro) or ""

        epub = $("result > epub", xml)
        if epub.length
            output.epub = 
                file_size: epub.attr("file-size")
                url : util.getInnerXML epub
        pdf = $("result pdf", xml)
        if pdf.length
            output.pdf = 
                file_size: pdf.attr("file-size")
                url : util.getInnerXML pdf

        # output.author_type = $(root + " > authorid", xml).attr("type")
        return output

    


    getHtmlFile : (url) ->
        return http(
            url : url
        )
    
    getHitParams : (item) ->
        if item.mediatype == "faksimil"
            obj = _.pick item, "x", "y", "width", "height"
            return _(obj).pairs().invoke("join", "=").join("&")
        else 
            return "traff=#{item.nodeid}&traffslut=#{item.endnodeid}"

    getTitles : (allTitles = false, author = null, sort_key = null, string = null) ->
        def = $q.defer()
        params = 
            exclude : "text,parts,sourcedesc"

        if sort_key
            params.sort_field = sort_key
            params.to = 30
        if string
            params.filter_string = string
        if author
            author = "/" + author

        $http(
            url : "#{STRIX_URL}/lb_list_all/etext,faksimil" + (author or "")
            params: params


        ).success (data) ->
            c.log "data", data

            titleGroups = _.groupBy data.data, (title) ->
                title.lbworkid


            # for path, titles in pathGroups
            #     if titles.length > 1
            #         for title in titles
            #             sibl = _.filter titles, (item) -> item.mediatype != title.mediatype
            #             title.siblings = sibl[0]

            def.resolve [data.data, titleGroups]

        return def.promise



    # getTitles : (allTitles = false, author = null, initial = null, string = null) ->
    #     def = $q.defer()
    #     if author and allTitles
    #         params = 
    #             action : "get-titles-by-author"
    #             authorid : author
    #     else if allTitles
    #         params = 
    #             action : "get-titles-by-string-filter"
    #         if initial
    #             params.initial = initial
    #         if string
    #             params.string = string
    #     else 
    #         params = 
    #             action : "get-works"


    #     http(
    #         url : "/query/lb-anthology.xql"
    #         params: params


    #     ).success (xml) ->

    #         pathGroups = _.groupBy $("item", xml), (item) ->
    #             author = $(item).find("author").attr("authorid")
    #             # if "/" in $(item).attr("titlepath")
    #             return author + $(item).attr("titlepath").split("/")
    #             # else
    #             #     return author + $(item).attr("titlepath")


    #         rows = []
    #         for path, elemList of pathGroups
    #             itm = elemList[0]
    #             if not (objFromAttrs $(itm).find("author").get(0))
    #                 c.log "author failed", itm


    #             obj = 
    #                 itemAttrs : objFromAttrs itm
    #                 # author : (objFromAttrs $(itm).find("author").get(0)) or ""
    #                 author : _.map $(itm).find("author"), objFromAttrs
    #                 mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))
    #                 authorKeywords : _.pluck $(itm).find("authorkeyword"), "innerHTML"
    #                 # mediatype : getMediatypes($(itm).attr("lbworkid"))

    #             if allTitles
    #                 obj.isTitle = true

    #             rows.push obj

    #         # rows = _.flatten _.values rows
    #         def.resolve rows
    #         # .fail -> def.reject()
    #     return def.promise

    # getAuthorList : () ->
    #     def = $q.defer()
    #     url = "/query/lb-authors.xql?action=get-authors"
    #     http(
    #         url : url
    #         # cache: localStorageCache
    #     ).success (xml) ->
    #         attrArray = for item in $("item", xml)
    #             obj = objFromAttrs item
    #             obj.sortyear = Number(obj.sortyear)
    #             obj
                

    #         c.log "attrArray", attrArray[0]
    #         def.resolve attrArray

    #     return def.promise

    getAuthorList : () ->

            def = $q.defer()
            url = "#{STRIX_URL}/get_authors"
            $http(
                url : url
                method: "GET"
                cache: true
            ).success (response) ->
                c.log "getAuthorList", response
                def.resolve response.data

            return def.promise


    getSourceInfo : (titlepath, mediatype) ->
        # TODO: mediatype can be null?
        def = $q.defer()
        url = "#{STRIX_URL}/get_work_info/#{titlepath}/#{mediatype}"

        $http(
            url : url

        ).success( (data) ->
            # if $("fel", xml).length
            #     def.reject $("fel", xml).text()
            # output = parseWorkInfo("result", xml)
            workinfo = data.data[0]

            workinfo.pagemap = {}
            for pg in workinfo.pages
                workinfo.pagemap["page_" + pg.pagename] = pg.pageindex
                workinfo.pagemap["ix_" + pg.pageindex] = pg.pagename

            workinfo.errata = for tr in $("tr", workinfo.errata)
                _($(tr).find("td")).map(util.getInnerXML)
                .map(_.str.strip).value()

            if workinfo.epub
                workinfo.mediatypes.push "epub"
            if workinfo.pdf
                workinfo.mediatypes.push "pdf"




            c.log "getSourceInfo", workinfo
            def.resolve workinfo
        ).error (xml) ->
            def.reject xml
        
        return def.promise


    logPage : (pageix, lbworkid, mediatype) ->
            
        http(
            url : "/query/lb-admin.xql"
            params : 
                action : "log-page-request"
                lbworkid : lbworkid
                pageix : pageix
                type : mediatype
                # hash : "80301537332859264406912773809666"
        )


    getPage : (passedParams) ->
        def = $q.defer()

        url = "/query/lb-anthology.xql"

        params =
            action : "get-work-data-init"
            navinfo : true
            css : true
            workdb : true


        http(
            url : url
            cache : true
            params : _.extend {}, params, passedParams
        ).success( (xml) ->
            info = parseWorkInfo("LBwork", xml)

            info["showtitle"] = $("showtitle:first", xml).text()
            info["css"] = $("css", xml).text()
            info.widths = []
            
            for {name, value} in _.values $("bok", xml).prop("attributes")
                if _.str.startsWith name, "width"
                    size = Number name.split("-")[1]
                    info.widths[size] = value


            pgMap = {}
            for page in $("bok sida", xml)
                p = $(page)
                pgMap["ix_" + p.attr("ix")] = p.attr("sidn")
                pgMap["page_" + p.attr("sidn")] = Number p.attr("ix")


            info.pagemap = pgMap


            info.parts = _.map $("LBwork part", xml), (item, i) ->

                # obj = objFromAttrs(item)
                obj = {}
                for node in $(item).children()
                    obj[node.nodeName] = $(node).text()


                obj.showtitle = obj.showtitle or obj.shorttitle or obj.title

                obj.number = i
                return obj

            info.mediatypes = for mediatype in $("mediatypes mediatype", xml)
                util.getInnerXML mediatype

 

            def.resolve [xml, info]
        ).error () ->
            def.reject(arguments...)

        return def.promise

    getAuthorInfo : (authorid) ->
        def = $q.defer()
        $http(
            url : "#{STRIX_URL}/get_lb_author/" + authorid
        ).success( (response) ->

            def.resolve response.data
        )

        return def.promise
    # getAuthorInfo : (authorid) ->
    #     def = $q.defer()
    #     url = "/query/lb-authors.xql"
    #     http(
    #         url : url
    #         # cache: 
    #         cache: true #localStorageCache
    #         # params :
    #         #     action : "get-author-data-init"
    #         #     authorid : authorid

    #     ).success( (xml) ->
    #         authorInfo = {}
    #         for elem in $("LBauthor", xml).children()
    #             if elem.nodeName == "intro" 
    #                 val = util.getInnerXML elem
    #             else
    #                 val = $(elem).text()

    #             authorInfo[util.normalize(elem.nodeName)] = val


    #         parseWorks = (selector) ->
    #             titles = []
    #             editorTitles = []
    #             translatorTitles = []
    #             for item in $(selector, xml)
    #                 obj = objFromAttrs item
    #                 obj.authors = []
    #                 isEditor = false
    #                 isTranslator = false
    #                 for author in $(item).find("author")
    #                     authObj = objFromAttrs author
    #                     obj.authors.push authObj
    #                     if authorid == authObj.authorid and authObj.authortype == 'editor'
    #                         isEditor = true
    #                     else if authorid == authObj.authorid and authObj.authortype == 'translator'
    #                         isTranslator = true


    #                 # if obj.authors.length > 1
    #                 #     obj.workauthor = obj.authors[0].workauthor or authorid
                    
    #                 if isEditor
    #                     editorTitles.push obj
    #                 else if isTranslator
    #                     translatorTitles.push obj
    #                 else
    #                     titles.push obj
                
    #             return [titles, editorTitles, translatorTitles]


    #         [works, editorWorks, translatorWorks] = parseWorks(":root > works item")
    #         [titles, editorTitles, translatorTitles] = parseWorks(":root > titles item")
    #         [aboutWorks, about_editorWorks, about_translatorWorks] = parseWorks("about works item")
    #         [aboutTitles, about_editorTitles, about_translatorTitles] = parseWorks("about titles item")

    #         authorInfo.works = works
    #         authorInfo.titles = titles
    #         authorInfo.editorWorks = [].concat editorWorks, editorTitles
    #         authorInfo.translatorWorks = [].concat translatorWorks, translatorTitles
            
    #         authorInfo.aboutWorks = aboutWorks
    #         authorInfo.aboutTitles = aboutTitles
    #         authorInfo.about_editorTitles = about_editorTitles
    #         authorInfo.about_translatorTitles = about_translatorTitles

    #         authorInfo.smallImage = util.getInnerXML $("image-small-uri", xml)
    #         authorInfo.largeImage = util.getInnerXML $("image-large-uri", xml)
    #         authorInfo.presentation = util.getInnerXML $("presentation-uri", xml)
    #         authorInfo.bibliografi = util.getInnerXML $("bibliography-uri", xml)
    #         authorInfo.semer = util.getInnerXML $("see-uri", xml)
    #         authorInfo.externalref = for ref in $("LBauthor external-ref", xml)
    #             label : util.getInnerXML $("label", ref)
    #             url : util.getInnerXML $("url", ref)


    #         def.resolve authorInfo
    #     ).error (data, status, headers, config) ->
    #         def.reject()

    #     return def.promise


    getStats : () ->
        def = $q.defer()
        url = "/query/lb-stats.xql"
        http(

            url : url
            params :
                action : "get-overall-stats"

        ).success (xml) ->
            output = {}
            parse = (toplist) ->
                list = for item in toplist.children()
                    obj = {}
                    obj.itemAttrs = objFromAttrs item
                    obj.author = []
                    for author in $(item).find("author")
                        authObj = objFromAttrs author
                        obj.author.push authObj

                    obj.mediatype = []
                    for mediatype in $(item).find("mediatype")
                        obj.mediatype.push $(mediatype).text()

                    obj

                
                return list



            output.titleList = parse $("toplist:first", xml)
            output.epubList = parse $("toplist:nth(1)", xml)
            

            parseObj = ["pages", "words"]
            # parseTable = (table) ->
            #     return ("<a href='/#!/#{$(x).attr('href').slice(3)}'>#{$(x).text()}</a>" for x in $("td:nth-child(2) a", table))
            # output.titleList = parseTable($("table", xml)[0])
            # output.epubList = parseTable($("table", xml)[1])
            for elem in $("result", xml).children()
                if elem.tagName == "toplist"
                    continue
                    
                else if elem.tagName in parseObj
                    output[elem.tagName] = _.object _.map $(elem).children(), (child) ->
                        [child.tagName, $(child).text()]
                else
                    output[elem.tagName] = $(elem).text()

            def.resolve output



        return def.promise

    getTitlesByAuthor : (authorid, cache, aboutAuthors=false) ->
        serviceName = if aboutAuthors then "get-works-by-author-keyword" else "get-titles-by-author"
        def = $q.defer()
        url = "/query/lb-anthology.xql"
        req = 
            url : url
            params:
                action : serviceName
                authorid : authorid
        if cache then req.cache = true
        http(req).success (xml) ->
            output = []
            for elem in $("result", xml).children()
                output.push objFromAttrs(elem)

            def.resolve output


        return def.promise



    getAuthorsInSearch : (o) ->
        def = $q.defer()
        params = 
            command: "count"
            groupby: "text_nameforindex"
            cqp: getCqp(o)
            corpus: "LBSOK"
            incremental: false
            defaultwithin: "sentence"
        $http(
            url: "http://spraakbanken.gu.se/ws/korp"
            method: "GET"
            cache: true
            params: params
        ).success( (data) ->
            def.resolve data.total.absolute
        ).error (data) ->
            c.log "getAuthorsInSearch error", arguments
            def.reject()

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
        def = $q.defer()

        url = "query/lb-contact.xql"
        
        if window.isDev
            action = "contact-test"
        else
            action = "contact"

        params = 
            action : action
            lang : "swe"
            ContactName : name
            ContactEmail : email
            ContactMessage : message


        http(
            url : url
            params: params

        ).success(def.resolve)
        .error def.reject
        
        return def.promise
        
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

    fetchOverlayData : (workid, ix) ->
        def = $q.defer()
        http(
            url : "/query/lb-anthology.xql"
            # url : "test.merge"
            params:
                action: "get-ocr"
                pageix : ix
                lbworkid : workid
        ).success( (data) ->
            # dimensions = _.map $(data).attr("rend").split("x"), Number
            root = $("result page", data)
            dimensions = _.map [root.attr("w"), root.attr("h")], Number

            max = _.max dimensions
            factors = _.map SIZE_VALS, (val) -> val / max

            out = []
            prevY = 0
            TOLERANCE = 3
            isInsideTolerence = (thisVal, ofThatVal) ->
                Math.abs(thisVal - ofThatVal) < TOLERANCE

            for elem in root.children()
                obj = objFromAttrs elem
                obj.word = $(elem).text()

                # if ( (Number obj.y) > (prevY)) or ( (Number obj.y) > (prevY - TOLERANCE))
                if not isInsideTolerence (Number obj.y), prevY
                    out.push [obj]
                else
                    (_.last out).push obj

                prevY = Number obj.y

            def.resolve [out, factors]


        ).error def.reject


        return def.promise

    
    workSearch : (query, lbworkid) ->
        def = $q.defer()
        source = new EventSource('#{STRIX_URL}/search_document/#{lbworkid}/#{query}');
        source.onmessage = (event) ->
            data = JSON.parse(event.data)
            c.log "onmessage onprogress", data 
            def.notify data

        source.onerror = (event) ->
            c.log "onmessage onprogress fail", event
            this.close()
            def.resolve()

        return def.promise
        
        


littb.factory "authors", (backend, $q) ->
    
    def = $q.defer()
    # @promise = def.promise
    backend.getAuthorList().then (authors) =>
        authorsById = _.object _.map authors, (item) =>
            [item.authorid, item]
        # c.log "authorsById", authorsById
        def.resolve [authors, authorsById]


    return def.promise


    

littb.factory "searchData", (backend, $q, $http, $location) ->
    NUM_HITS = 50 # how many hits per search?
    BUFFER = 0 # additional hits 
    class SearchData
        constructor: () ->
            @data = []
            @total_hits = null
            @current = null
            @querydata = null
            @currentParams = null

            @isSearching = false

        newSearch : (params) ->
            @data = []
            @total_hits = null
            @currentParams = params
            @doNewSearch = true
            @querydata = null
            @current = null
            @isSearching = false


        searchWorks : (o) ->
            c.log "searchvars", o
            def = $q.defer()


            # from = (o.from or 0) - BUFFER
            # if from < 0 then from = 0
            # to = (o.to or NUM_HITS) + BUFFER


            # params = 
            #     command : "query"
            #     cqp : getCqp(o)
            #     show: "wid,x,y,width,height"
            #     show_struct : "page_n,text_lbworkid,text_author,text_authorid,text_title,text_shorttitle,text_titlepath,text_nameforindex,text_mediatype,text_date,page_size"
            #     corpus : "LBSOK"
            #     start: from
            #     end : to
            #     sort: "sortby"
            #     context: 'LBSOK:20 words'
            #     rightcontext : 'LBSOK:15 words'

            # if @querydata
            #     params.querydata = @querydata

            @isSearching = true

            $http(
                url: "#{STRIX_URL}/lb_search/" + o.query
            ).success (data) =>
                c.log "data", data
                @isSearching = false
                @total_hits = data.hits
                c.log "@total_hits", @total_hits
                def.resolve data
            .error (data) =>
                def.reject(data)




            # $http(
            #     url : "http://spraakbanken.gu.se/ws/korp"
            #     method : "GET"
            #     # cache: localStorageCache
            #     cache: true
            #     params : params
                    
            # ).success( (data) =>
            #     @querydata = data.querydata
            #     punctArray = [",", ".", ";", ":", "!", "?", "..."]
            #     # sums = []
            #     if data.ERROR
            #         c.log "searchWorks error:", JSON.stringify(data.ERROR)
            #         def.reject(data)
            #         return

                # @total_hits = data.hits
            #     @compactData(data, from)

            #     if not @data.length
            #         @data = new Array(data.hits)


            #     c.log "splice", from, data.kwic.length
            #     for sent, i in data.kwic
            #         sent.index = i + from
            #         for wd in sent.tokens
            #             if wd.word in punctArray
            #                 wd._punct = true

            #     @isSearching = false
            #     @data[from..data.kwic.length] = data.kwic




            #     def.resolve data
            # ).error (data) ->
            #     c.log "searchworks error", arguments
            #     def.reject()

            return def.promise

        slice : (from, to) ->
            unless @currentParams then return
            c.log "slice", from, to
            def = $q.defer()
            if (@hasSlice from, to) and not @doNewSearch
                c.log "@hasSlice from, to", (@hasSlice from, to)
                def.resolve(@data.slice(from, to))
            else
                [missingStart, missingEnd] = @findMissingInSpan(from, to)
                if missingEnd
                    @currentParams.from = missingStart
                    c.log "missingStart", missingStart, missingEnd
                    @currentParams.to = missingEnd
                else
                    @currentParams.from = from
                    @currentParams.to = to

                @searchWorks(@currentParams).then (data) ->
                    def.resolve data.data
            @doNewSearch = false
            return def.promise

        hasSlice: (from, to) ->
            slice = @data.slice(from, to)
            unless slice.length then return false
            return not _.any slice, _.isUndefined

        findMissingInSpan : (from, to) ->
            start = null
            span = @data[from..to]
            for item, i in span
                if not item? # count undefined
                    start = i
                    end = (_.takeWhile span[i..], _.isUndefined).length
                    break

            c.log "end", end
            return [from + start, from + start + end]




        compactData : (data, startIndex) ->
            min = Infinity
            for row in data.kwic

                sum = _.sum row.tokens, (item, i) ->
                    if i < row.match.start
                        return item.word.length
                    else
                        return 0

                if sum < min then min = sum 
                # sums.push sum 

                row.sent_length = sum

            for row, index in data.kwic
                row.href = @parseUrls row, index + startIndex
                if row.sent_length > min

                    diff = row.sent_length - min
                    dropped = 0

                    for wd, i in row.tokens
                        if dropped >= diff
                            drop = i
                            break
                        dropped += wd.word.length

                    if drop
                        row.tokens.splice(0, drop)
                        row.match.start -= drop
                        row.match.end -= drop

        parseUrls : (row, index) ->
            itm = row.structs
            mediatype = itm.text_mediatype

            matches = row.tokens[row.match.start...row.match.end]
            matchParams = []
            if mediatype == "faksimil"
                # obj = _.pick item, "x", "y", "width", "height"
                matchGroups = _.groupBy matches, "y"

                makeParams = (group) ->
                    params = _.pick group[0], "x", "y", "height"

                    for match in group
                        unless params.width
                            params.width = Number(match.width)
                        else
                            params.width += Number(match.width)

                    max = Math.max itm.page_size.split("x")...
                    factors = _.map SIZE_VALS, (val) -> val / max

                    for key, val of params
                        params[key] = _(factors).map( (fact) ->
                            Math.round fact * val).join(",")

                    return params
                
                for group in _.values matchGroups
                    matchParams.push makeParams group


            else 
                matchParams.push
                    traff : matches[0].wid
                    traffslut : _.last(matches).wid
                

            merged = _(matchParams).reduce( (obj1, obj2) -> 
                if not obj1 then return {}
                _.merge {}, obj1, obj2, (a,b) -> 
                    unless a then return b
                    a + "|" + b
            )


            for key, val of @currentParams
                if key == "text_attrs" and val.length
                    merged["s_" + key] = val.join(",")
                else
                    merged["s_" + key] = val


            merged.hit_index = index
            merged = _(merged).pairs().invoke("join", "=").join("&")

            author = _.str.trim(itm.text_authorid, "|").split("|")[0]
            titleid = itm.text_titlepath

            return "/#!/forfattare/#{author}/titlar/#{titleid}" + 
                "/sida/#{itm.page_n}/#{itm.text_mediatype}?#{merged}" # ?#{backend.getHitParams(itm)}
            

        next : () ->
            if @current + 1 == @total_hits then return {then : angular.noop}
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
                    def.resolve @data[index]
            return def.promise

        reset : () ->
            @current = null
            @total_hits = null
            @data = []
            @currentParams = null


    return new SearchData()
        

