littb = angular.module('littbApp');
SIZE_VALS = [625, 750, 1100, 1500, 2050]

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




###
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
                cqp : "_.text_author_id contains 'Anonym'"
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

    if o.selectedAuthor
        auths = getAuthors(o.selectedAuthor, "author_id")
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

###

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
    ###
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
            else if elem.nodeName in ["author_id", "author_id-norm"]
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

        # output.author_type = $(root + " > author_id", xml).attr("type")
        return output
    ###
    


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



    # getTitles : (allTitles = false, author = null, initial = null, string = null) ->
    #     def = $q.defer()
    #     if author and allTitles
    #         params = 
    #             action : "get-titles-by-author"
    #             author_id : author
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
    #             author = $(item).find("author").attr("author_id")
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
        ).then (response) ->
            return response.data[workinfo.license]


    getProvenance : (workinfo) ->
        $http(
            url : "/xhr/red/etc/provenance/provenance.json"
        ).then (response) ->
            provData = []
            for prov, i in workinfo.provenance
                output = response.data[prov.library]
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
                output.text = _.template(output.text)({signum: signum or ""})
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
            # if $("fel", xml).length
            #     def.reject $("fel", xml).text()
            # output = parseWorkInfo("result", xml)
            if response.hits == 0
                def.reject "not_found"
                return
            # workinfo = data.data[0]

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

    logDownload : (lbworkid) ->
        $http(
            url : "#{STRIX_URL}/log_download/#{lbworkid}"
        )

    ###
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
    ###
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
        if maybeAuthType
            params["author_type"] = maybeAuthType
        if list_about
            params["about_author"] = true
            
        return $http(
            url : "#{STRIX_URL}/lb_list_all/#{textType}/" + author_id
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



    # getWorksByAuthor : (author_id) ->

    # getAuthorInfo : (author_id) ->
    #     def = $q.defer()
    #     url = "/query/lb-authors.xql"
    #     http(
    #         url : url
    #         # cache: 
    #         cache: true #localStorageCache
    #         # params :
    #         #     action : "get-author-data-init"
    #         #     author_id : author_id

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
    #                     if author_id == authObj.author_id and authObj.authortype == 'editor'
    #                         isEditor = true
    #                     else if author_id == authObj.author_id and authObj.authortype == 'translator'
    #                         isTranslator = true


    #                 # if obj.authors.length > 1
    #                 #     obj.workauthor = obj.authors[0].workauthor or author_id
                    
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



    # getAuthorsInSearch : (o) ->
    #     def = $q.defer()
    #     params = 
    #         command: "count"
    #         groupby: "text_name_for_index"
    #         cqp: getCqp(o)
    #         corpus: "LBSOK"
    #         incremental: false
    #         defaultwithin: "sentence"
    #     $http(
    #         url: "http://spraakbanken.gu.se/ws/korp"
    #         method: "GET"
    #         cache: true
    #         params: params
    #     ).success( (data) ->
    #         def.resolve data.total.absolute
    #     ).error (data) ->
    #         c.log "getAuthorsInSearch error", arguments
    #         def.reject()

    #     return def.promise



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

    fetchOverlayData : (workid, ix) ->
        $http(
            url : "#{STRIX_URL}/get_ocr/#{workid}/#{ix}"
        ).then (response) ->
            c.log "response", response
            max = _.max _.map response.data.size.split("x"), Number
            c.log "max", max
            factors = _.map SIZE_VALS, (val) -> val / max

            TOLERANCE = 3
            isInsideTolerence = (thisVal, ofThatVal) ->
                Math.abs(thisVal - ofThatVal) < TOLERANCE

            output = []

            for obj in response.data.words

                if not isInsideTolerence obj.y, prevY
                    output.push [obj]
                else
                    (_.last output).push obj

                prevY = obj.y


            return [output, factors]



    ###
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
    ###
    
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
    backend.getAuthorList(null, exclude=['intro']).then (authors) =>
        authorsById = _.object _.map authors, (item) =>
            [item.author_id, item]
        # c.log "authorsById", authorsById
        def.resolve [authors, authorsById]


    return def.promise


    

littb.factory "searchData", (backend, $q, $http, $location) ->
    BUFFER = 0 # additional hits 
    class SearchData
        constructor: () ->
            @data = []
            @total_hits = null
            @total_doc_hits = null
            @current = null
            @querydata = null
            @currentParams = null

            @isSearching = false
            @NUM_HITS = 30 # how many doc hits per search?
            @NUM_HIGHLIGHTS = 5

        newSearch : (params) ->
            @data = []
            @total_hits = null
            @total_doc_hits = null
            @currentParams = params
            @doNewSearch = true
            @querydata = null
            @current = null
            @isSearching = false
            @savedParams = null


        searchWorks : (o) ->
            c.log "searchvars", o
            def = $q.defer()


            @isSearching = true

            params = 
                include: "authors,title,titlepath,title_id,mediatype"
                number_of_fragments: @NUM_HIGHLIGHTS + 1

            params = _.extend {}, o, params


            groupSents = (data) =>
                i = 0
                output = []

                row_index = 0
                for item in data
                    output.push {isHeader: true, metadata: item.source}
                    for high in item.highlight
                        obj = {metadata: item.source, highlight: high, index: row_index}
                        obj.href = @parseUrls obj, row_index
                        output.push obj
                        row_index++
                    if item.overflow
                        output.push {overflow: true}

                return output
                
            $http(
                url: "#{STRIX_URL}/lb_search/#{o.query}"
                params : params
                cache: true
            ).success (response) =>
                c.log "response", response
                @isSearching = false
                
                @total_doc_hits = response.hits
                

                punctArray = [",", ".", ";", ":", "!", "?", "..."]



                @compactLeftContext(response.data)

                for work in response.data
                    if work.highlight.length > @NUM_HIGHLIGHTS
                        work.highlight = work.highlight[0..@NUM_HIGHLIGHTS - 1]
                        work.overflow = true
                    
                    for high in work.highlight

                        for key in ["left_context", "match", "right_context"]
                            for wd in high[key]
                                if wd.word in punctArray
                                    wd._punct = true

                # @compactData(response.data, o.from)

                sentsWithHeaders = groupSents(response.data)



                def.resolve [response.data, sentsWithHeaders, response.author_aggregation]
            .error (data) =>
                def.reject(data)


            $http(
                url: "#{STRIX_URL}/lb_search_count/#{o.query}"
                params : params
                cache: true
            ).success (response) =>
                c.log "count all", response
                @total_hits = response.total_highlights
                c.log "@total_hits", @total_hits

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
                    def.resolve data
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
            if metadata.mediatype == "faksimil"
                # obj = _.pick item, "x", "y", "width", "height"
                matchGroups = _.groupBy matches, (match) -> match.attrs.x

                makeParams = (group) ->
                    params = _.pick group[0].attrs, "x", "y", "height"

                    for match in group
                        unless params.width
                            params.width = Number(match.attrs.width)
                        else
                            params.width += Number(match.attrs.width)

                    max = Math.max group[0].attrs.size.split("x")...
                    factors = _.map SIZE_VALS, (val) -> val / max

                    for key, val of params
                        params[key] = _(factors).map( (fact) ->
                            Math.round fact * val).join(",")
                    return params
                
                for group in _.values matchGroups
                    matchParams.push makeParams group


            else 
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
                if key == "text_attrs" and val.length
                    merged["s_" + key] = val.join(",")
                else
                    merged["s_" + key] = val


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
                    def.resolve @data[index]
            return def.promise

        reset : () ->
            @current = null
            @total_hits = null
            @total_doc_hits = null
            @data = []
            @currentParams = null


    return new SearchData()
        

