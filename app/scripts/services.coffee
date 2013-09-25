
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
        useInnerXML = ["sourcedesc", "license-text"]
        asArray = ["mediatypes"]

        output = {}
        for elem in $(root, xml).children()
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


    getHitParams : (item) ->
        if item.mediatype == "faksimil"
            obj = _.pick item, "x", "y", "width", "height"
            return _(obj).pairs().invoke("join", "=").join("&")
        else 
            return "traff=#{item.nodeid}&traffslut=#{item.endnodeid}"

    getTitles : (allTitles = false, initial = null, string = null) ->
        def = $q.defer()
        if allTitles
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
            # c.log "getTitles success", xml
            workGroups = _.groupBy $("item", xml), (item) ->
                $(item).attr("lbworkid") + $(item).find("author").attr("authorid")

            rows = []
            for workid, elemList of workGroups
                itm = $(elemList[0])
                if not (objFromAttrs itm.find("author").get(0))
                    c.log "author failed", itm
                rows.push
                    itemAttrs : objFromAttrs elemList[0]
                    author : (objFromAttrs itm.find("author").get(0)) or ""
                    mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))

            # rows = _.flatten _.values rows
            def.resolve rows
            # .fail -> def.reject()
        return def.promise

    getAuthorList : () ->
        def = $q.defer()
        url = "/query/lb-authors.xql?action=get-authors"
        http(
            url : url
        ).success (xml) ->
            attrArray = for item in $("item", xml)
                objFromAttrs item

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

        ).success (xml) ->
            output = parseWorkInfo("result", xml)

            prov = $("result provenance-data", xml)
            output["provenance"] = {
                text : $("text", prov).text()
                image : $("image", prov).text()
                link : $("link", prov).text()
            }

            sourcedesc = $("sourcedesc", xml)


            errata = $("errata", xml)
            output.errata = for tr in $("tr", errata)
                _($(tr).find("td")).map(util.getInnerXML)
                .map(_.str.strip).value()
            errata.remove()

            output.sourcedesc = (util.getInnerXML sourcedesc) or ""

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


    getPage : (author, title, mediatype, pagenum) ->
        def = $q.defer()
        url = "/query/lb-anthology.xql"

        params =
            action : "get-work-data-init"
            authorid : author
            titlepath : title
            navinfo : true
            css : true
            workdb : true
            mediatype: mediatype

        if pagenum then params["pagename"] = pagenum

        http(
            url : url
            params : params
        ).success (xml) ->
            info = parseWorkInfo("LBwork", xml)
            c.log "info", info

            info["authorFullname"] = $("author-fullname", xml).text()
            info["showtitle"] = $("showtitle:first", xml).text()
            info["css"] = $("css", xml).text()
            pgMap = {}
            for page in $("bok sida", xml)
                p = $(page)
                pgMap["ix_" + p.attr("ix")] = p.attr("sidn")
                pgMap["page_" + p.attr("sidn")] = Number p.attr("ix")


            info.pagemap = pgMap

            info.parts = _.map $("parts > part", xml), objFromAttrs


            info.mediatypes = for mediatype in $("mediatypes mediatype", xml)
                util.getInnerXML mediatype
 

            def.resolve [xml, info]

        return def.promise

    getAuthorInfo : (author) ->
        def = $q.defer()
        url = "/query/lb-authors.xql"
        http(
            url : url
            params :
                action : "get-author-data-init"
                authorid : author

        ).success( (xml) ->
                    authorInfo = {}
                    for elem in $("LBauthor", xml).children()
                        if elem.nodeName == "intro" 
                            val = util.getInnerXML elem
                        else
                            val = $(elem).text()
        
                        authorInfo[util.normalize(elem.nodeName)] = val
        
                    works = []
                    for item in $("works item", xml)
                        obj = objFromAttrs item
                        # _.extend obj,
                            # mediatypes : _.unique (_.map $("mediatypes", item).children(), (child) -> $(child).attr("mediatype"))
                        works.push obj
        
                    authorInfo.works = works
        
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
            if $("table", xml).length > 1
                $("table", xml).last().remove()
            for elem in $("result", xml).children()
                if elem.tagName == "table"
                    c.log "table", elem, $("td:nth-child(2) a", elem)
                    output.titleList = ("<a href='#!/#{$(x).attr('href').slice(3)}'>#{$(x).text()}</a>" for x in $("td:nth-child(2) a", elem))
                    c.log "titleList", output.titleList
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

    searchWorks : (query, mediatype, resultitem, resultlength, selectedAuthor, selectedTitle) ->
        def = $q.defer()
        url = "/query/lb-search.xql"
        domain = "<item type='all-titles' mediatype='#{mediatype}'></item>"
        if selectedAuthor
            domain = "<item type='author' mediatype='#{mediatype}'>#{selectedAuthor}</item>"
        if selectedTitle
            domain = "<item type='titlepath' mediatype='#{mediatype}'>#{selectedTitle}</item>"

        http(
            method : "POST"
            url : url
            headers : {"Content-Type" : "text/xml; charset=utf-8"}
            params :
                action : "search"
            # <item type="titlepath" mediatype="all">Intradestal1786</item>

            data : """
                    <search>
                        <string-filter>
                            <item type="string">#{query}|</item>
                        </string-filter>
                    <domain-filter>
                        #{domain}
                    </domain-filter>
                    <ne-filter>
                        <item type="NUL"></item>
                    </ne-filter>
                    </search>
                """
        ).success((data) ->
            c.log "success", $("result", data).attr("ref")
            ref = $("result", data).attr("ref")


            http(

                url : url
                params :
                    action : "get-result-set"
                    searchref : ref
                    resultlength : resultlength
                    resultitem : resultitem + 1

            ).success (resultset) ->
                c.log "get-result-set success", resultset, $("result", resultset).children()

                output = {kwic : [], count : parseInt($("result", resultset).attr("count"))}

                for elem in $("result", resultset).children()
                    [left, kw, right, work] = _.map $(elem).children(), $
                    # c.log "elem", work.get(0), work.get(0).attributes
                    output.kwic.push
                        left : left.text()
                        kw : kw.text()
                        right : right.text()
                        item : objFromAttrs work.get(0)

                def.resolve output



        ).error (data) ->
            c.log "error", arguments
            def.reject()
        return def.promise

    searchLexicon : (str, useWildcard, searchId, strict) ->
        def = $q.defer()
        url = "/query/so.xql"
        c.log "searchId", searchId
        if searchId
            params = 
                id : str
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

            output = for article in $("artikel", xml)
                baseform : $("grundform-clean:first", article).text()
                # lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                lexemes : util.getInnerXML article

            window.output = output
            output = _.sortBy output, (item) ->
                if item.baseform == str then return "aaaaaaaaa"
                item.baseform

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

    submitContactForm : (name, email, message) ->
        def = $q.defer()

        url = "query/lb-contact.xql"

        params = 
            action : "contact-test"
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


littb.factory "authors", (backend, $q) ->
    
    def = $q.defer()
    # @promise = def.promise
    backend.getAuthorList().then (authors) =>
        authorsById = _.object _.map authors, (item) =>
            [item.authorid, item]
        # c.log "authorsById", authorsById
        def.resolve [authors, authorsById]


    return def.promise