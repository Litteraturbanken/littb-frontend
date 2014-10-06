littb = angular.module('littbApp');
SIZE_VALS = [625, 750, 1100, 1500, 2050]
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

    querydata = null

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

    getTitles : (allTitles = false, author = null, initial = null, string = null) ->
        def = $q.defer()
        if author and allTitles
            params = 
                action : "get-titles-by-author"
                authorid : author
        else if allTitles
            params = 
                action : "get-titles-by-string-filter"
            if initial
                params.initial = initial
            if string
                params.string = string
        else 
            params = 
                action : "get-works"


        http(
            url : "/query/lb-anthology.xql"
            params: params


        ).success (xml) ->

            pathGroups = _.groupBy $("item", xml), (item) ->
                author = $(item).find("author").attr("authorid")
                # if "/" in $(item).attr("titlepath")
                return author + $(item).attr("titlepath").split("/")
                # else
                #     return author + $(item).attr("titlepath")


            rows = []
            for path, elemList of pathGroups
                itm = elemList[0]
                if not (objFromAttrs $(itm).find("author").get(0))
                    c.log "author failed", itm
                rows.push
                    itemAttrs : objFromAttrs itm
                    author : (objFromAttrs $(itm).find("author").get(0)) or ""
                    mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))
                    # mediatype : getMediatypes($(itm).attr("lbworkid"))

            # rows = _.flatten _.values rows
            def.resolve rows
            # .fail -> def.reject()
        return def.promise

    getAuthorList : () ->
        def = $q.defer()
        url = "/query/lb-authors.xql?action=get-authors"
        http(
            url : url
            # cache: localStorageCache
        ).success (xml) ->
            attrArray = for item in $("item", xml)
                obj = objFromAttrs item
                obj.sortyear = Number(obj.sortyear)
                obj
                

            def.resolve attrArray

        return def.promise

    getSourceInfo : (author, title, mediatype) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"
        params = 
            action : "get-work-info-init"
            authorid : author
            titlepath : title

        if mediatype
            params.mediatype = mediatype

        http(
            url : url
            params : params

        ).success( (xml) ->
            if $("fel", xml).length
                def.reject $("fel", xml).text()
            output = parseWorkInfo("result", xml)


            prov = $("result provenance-data", xml)


            output["provenance"] = for item in prov
                {
                    text : $("text", item).text()
                    image : $("image", item).text()
                    link : $("link", item).text()
                }


            sourcedesc = $("sourcedesc", xml)


            errata = $("errata", xml)
            output.errata = for tr in $("tr", errata)
                _($(tr).find("td")).map(util.getInnerXML)
                .map(_.str.strip).value()
            errata.remove()

            output.sourcedesc = (util.getInnerXML sourcedesc) or ""
            # output.workintro = (util.getInnerXML workintro) or ""

            epub = $("result epub", xml)
            if epub.length
                output.epub = 
                    file_size: epub.attr("file-size")
                    url : util.getInnerXML epub
            pdf = $("result pdf", xml)
            if pdf.length
                output.pdf = 
                    file_size: pdf.attr("file-size")
                    url : util.getInnerXML pdf

            def.resolve output
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
            # c.log "info", info

            info["showtitle"] = $("showtitle:first", xml).text()
            info["css"] = $("css", xml).text()
            pgMap = {}
            for page in $("bok sida", xml)
                p = $(page)
                pgMap["ix_" + p.attr("ix")] = p.attr("sidn")
                pgMap["page_" + p.attr("sidn")] = Number p.attr("ix")


            info.pagemap = pgMap

            # info.parts = _.map $("parts > part", xml), objFromAttrs
            info.parts = _.map $("parts > part", xml), objFromAttrs
            info.parts = _.filter info.parts, (item) ->
                return "/" in item.id


            info.mediatypes = for mediatype in $("mediatypes mediatype", xml)
                util.getInnerXML mediatype

 

            def.resolve [xml, info]
        ).error () ->
            def.reject(arguments...)

        return def.promise

    getAuthorInfo : (authorid) ->
        def = $q.defer()
        url = "/query/lb-authors.xql"
        http(
            url : url
            # cache: 
            cache: true #localStorageCache
            params :
                action : "get-author-data-init"
                authorid : authorid

        ).success( (xml) ->
            authorInfo = {}
            for elem in $("LBauthor", xml).children()
                if elem.nodeName == "intro" 
                    val = util.getInnerXML elem
                else
                    val = $(elem).text()

                authorInfo[util.normalize(elem.nodeName)] = val


            parseWorks = (selector) ->
                titles = []
                editorTitles = []
                translatorTitles = []
                for item in $(selector, xml)
                    obj = objFromAttrs item
                    obj.authors = []
                    isEditor = false
                    isTranslator = false
                    for author in $(item).find("author")
                        authObj = objFromAttrs author
                        obj.authors.push authObj
                        if authorid == authObj.authorid and authObj.authortype == 'editor'
                            isEditor = true
                        else if authorid == authObj.authorid and authObj.authortype == 'translator'
                            isTranslator = true


                    # if obj.authors.length > 1
                    #     obj.workauthor = obj.authors[0].workauthor or authorid
                    
                    if isEditor
                        editorTitles.push obj
                    else if isTranslator
                        translatorTitles.push obj
                    else
                        titles.push obj
                
                return [titles, editorTitles, translatorTitles]


            [works, editorWorks, translatorWorks] = parseWorks("works item")
            [titles, editorTitles, translatorTitles] = parseWorks("titles item")

            authorInfo.works = works
            authorInfo.titles = titles
            authorInfo.editorWorks = [].concat editorWorks, editorTitles
            authorInfo.translatorWorks = [].concat translatorWorks, translatorTitles

            authorInfo.smallImage = util.getInnerXML $("image-small-uri", xml)
            authorInfo.largeImage = util.getInnerXML $("image-large-uri", xml)
            authorInfo.presentation = util.getInnerXML $("presentation-uri", xml)
            authorInfo.bibliografi = util.getInnerXML $("bibliography-uri", xml)
            authorInfo.semer = util.getInnerXML $("see-uri", xml)
            authorInfo.externalref = for ref in $("LBauthor external-ref", xml)
                label : util.getInnerXML $("label", ref)
                url : util.getInnerXML $("url", ref)


            def.resolve authorInfo
        ).error (data, status, headers, config) ->
            def.reject()

        return def.promise


    getStats : () ->
        def = $q.defer()
        url = "/query/lb-stats.xql"
        http(

            url : url
            params :
                action : "get-overall-stats"

        ).success (xml) ->
            output = {}
            parseObj = ["pages", "words"]
            # getting two tables for some reason
            # if $("table", xml).length > 1
            #     $("table", xml).last().remove()
            parseTable = (table) ->
                return ("<a href='/#!/#{$(x).attr('href').slice(3)}'>#{$(x).text()}</a>" for x in $("td:nth-child(2) a", table))
            output.titleList = parseTable($("table", xml)[0])
            output.epubList = parseTable($("table", xml)[1])
            for elem in $("result", xml).children()
                if elem.tagName == "table"
                    continue
                    
                else if elem.tagName in parseObj
                    output[elem.tagName] = _.object _.map $(elem).children(), (child) ->
                        [child.tagName, $(child).text()]
                else
                    output[elem.tagName] = $(elem).text()

            def.resolve output



        return def.promise

    getTitlesByAuthor : (authorid) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"
        http(

            url : url
            params :
                action : "get-titles-by-author"
                authorid : authorid
        ).success (xml) ->
            output = []
            for elem in $("result", xml).children()
                output.push objFromAttrs(elem)

            def.resolve output


        return def.promise


    searchWorks : (query, mediatype, from, to, selectedAuthor, selectedTitle, prefix, suffix, infix) ->
        c.log "searchvars", query, mediatype, from, to, selectedAuthor, selectedTitle
        def = $q.defer()

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



            wdlist = for wd in query.split(/\s+/)
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


        for wd in tokenize(query)
            pre = suf = ""
            or_block = []

            if prefix
                or_block.push "word = '#{regescape wd}.*' %c"
            if suffix
                or_block.push "word = '.*#{regescape wd}' %c"
            if infix and not (prefix or suffix)
                or_block.push "word = '.*#{regescape wd}.*' %c"
            if not prefix and not suffix
                or_block.push "word = '#{regescape wd}' %c"

            tokenList.push "(#{or_block.join(' | ')})"

        if selectedAuthor
            tokenList[0] += " & _.text_authorid contains '#{selectedAuthor}'"
        if selectedTitle
            tokenList[0] += " & _.text_lbworkid = '#{selectedTitle}'"
        if mediatype == "all"
            tokenList[0] += " & (_.text_mediatype = 'faksimil' | _.text_mediatype = 'etext')"
        else
            tokenList[0] += " & _.text_mediatype = '#{mediatype}'"



        params = 
            command : "query"
            cqp : "[#{tokenList.join('] [')}]"
            show: "wid,x,y,width,height"
            show_struct : "page_n,text_lbworkid,text_author,text_authorid,text_title,text_shorttitle,text_titlepath,text_nameforindex,text_mediatype,text_date,page_size"
            corpus : "LBSOK"
            start: from
            end : to

        if querydata
            params.querydata = querydata

        $http(
            url : "http://spraakbanken.gu.se/ws/korp"
            method : "GET"
            # cache: localStorageCache
            cache: true
            params : params
                
        ).success( (data) ->
            querydata = data.querydata
            def.resolve data
        ).error (data) ->
            c.log "error", arguments
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
        
    
    getKollatWorks : () ->
        def = $q.defer()
        
        kollatWorks = [
            title: "Gösta Berlings saga 1"
            workgroup: "GBS1"
            works: [
                title: "Gösta Berlings saga 1 (1891)"
                id: "lb1492249"
                path: "GostaBerling1"
            ,
                title: "Gösta Berlings saga 1 (1895)"
                id: "lb3312560"
                path: "GostaBerlingsSagaForraDelen1895"
            ,
                title: "Gösta Berlings saga (1910)"
                id: "lb3312973"
                path: "GostaBerlingsSaga1910"
            ,
                title: "Gösta Berlings saga (1933)"
                id: "lb491569"
                path: "GostaBerlingsSaga1933"
            ]
        ,
            title: "Gösta Berlings saga 2"
            workgroup: "GBS2"
            works: [
                title:"Gösta Berlings saga 2 (1891)"
                id: "lb1492250"
                path: "GostaBerling2"
            ,
                title:"Gösta Berlings saga 2 (1895)"
                id: "lb3312561"
                path: "GostaBerlingsSagaSenareDelen1895"
            ,
                title: "Gösta Berlings saga (1910)"
                id: "lb3312973"
                path: "GostaBerlingsSaga1910"
            ,
                title: "Gösta Berlings saga (1933)"
                id: "lb491569"
                path: "GostaBerlingsSaga1933"
            ]
        ,
            title: "Osynliga Länkar"
            workgroup: "OL"
            works: [
                title:"Osynliga länkar (1894)"
                id: "lb31869"
                path: "OsynligaLankar"
            ,
                title:"Osynliga länkar (1904)"
                id: "lb2169911"
                path: "OsynligaLankar1904"
            ,
                title: "Osynliga länkar (1909)"
                id: "lb1615111"
                path: "OsynligaLankar1909"
            ,
                title: "Osynliga länkar (1933)"
                id: "lb8233075"
                path: "OsynligaLankar1933"
            ]
        ]
        
        def.resolve kollatWorks
        
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
           c.log "ordOchSak: tillåtna titlar är " + (t for t of titlemap)
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

            


littb.factory "authors", (backend, $q) ->
    
    def = $q.defer()
    # @promise = def.promise
    backend.getAuthorList().then (authors) =>
        authorsById = _.object _.map authors, (item) =>
            [item.authorid, item]
        # c.log "authorsById", authorsById
        def.resolve [authors, authorsById]


    return def.promise



littb.factory "searchData", (backend, $q) ->
    NUM_HITS = 20 # how many hits per search?
    class SearchData
        constructor: () ->
            @data = []
            @total_hits = null
            @current = null

        parseUrls : (row, matches) ->
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
            merged = _(merged).pairs().invoke("join", "=").join("&")

            author = _.str.trim(itm.text_authorid, "|").split("|")[0]
            titleid = itm.text_titlepath
            return "/#!/forfattare/#{author}/titlar/#{titleid}" + 
                "/sida/#{itm.page_n}/#{itm.text_mediatype}?#{merged}" # ?#{backend.getHitParams(itm)}
            
        save : (startIndex, currentIndex, input, search_args) ->
            @searchArgs = search_args
            @data = new Array(input.hits)
            @appendData startIndex, input
            @total_hits = input.hits
            @current = currentIndex
            c.log "save currentIndex", currentIndex

        appendData : (startIndex, data) ->
            @data[startIndex..data.kwic.length] = _.map data.kwic, (itm) => 
                _.str.ltrim @parseUrls(itm), "/#!"


        next : () ->
            if @current + 1 == @total_hits then return {then : angular.noop}
            @current++
            @search()

            
        prev : () ->
            if @current == 0 then return {then : angular.noop}
            @current--
            @search()


        search : () ->
            def = $q.defer()
            c.log "search", @current
            if @data[@current]? 
                def.resolve @data[@current]
            else
                # current_page = Math.floor(@current / NUM_HITS )
                args = [].concat @searchArgs
                # replace from and to args
                args[2] = @current
                args[3] = @current + NUM_HITS
                c.log "fetch and append", args

                backend.searchWorks(args...).then (data) =>
                    @appendData @current, data
                    def.resolve @data[@current]
            return def.promise


        reset : () ->
            @current = null
            @total_hits = null
            @data = []
            @searchArgs = null


    return new SearchData()
        

