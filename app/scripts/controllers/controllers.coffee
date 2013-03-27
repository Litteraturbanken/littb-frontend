'use strict';

window.c = console ? log : _.noop

littb.controller "startCtrl", ($scope) ->





littb.controller "contactFormCtrl", ($scope, backend) ->
littb.controller "statsCtrl", ($scope, backend) ->
    s = $scope
    backend.getStats().then (data) ->
        s.data = data

littb.controller "searchCtrl", ($scope, backend, $location) ->
    s = $scope
    s.open = false
    s.searchProofread = true
    s.searchNonProofread = true

    s.authors = backend.getAuthorList()

    s.$watch "selected_author", (newAuthor, prevVal) ->
        return unless newAuthor
        s.titles = backend.getTitlesByAuthor(newAuthor.authorid)


    s.search = (query) ->
        if query
            $location.search("fras", query)
            s.query = query
        else
            $location.search("fras", s.query)


        s.results = backend.searchWorks(s.query)

    queryvars = $location.search()
    if "fras" of queryvars
        s.search(queryvars.fras)



littb.controller "authorInfoCtrl", ($scope, backend, $routeParams) ->
    {author} = $routeParams
    $scope.authorInfo = backend.getAuthorInfo(author)


littb.directive 'letterMap', () ->
    template : """
        <table class="letters">
            <tr ng-repeat="row in letterArray">
                <td ng-repeat="letter in row"
                    ng-class="{disabled: !ifShow(letter), selected: letter == selectedLetter}"
                    ng-click="setLetter(letter)">{{letter}}</td>
            </tr>
        </table>
    """
    replace : true
    scope :
        selected : "="
        enabledLetters : "="
    link : (scope, elm, attrs) ->
        s = scope

        s.letterArray = _.invoke([
            "ABCDE",
            "FGHIJ",
            "KLMNO",
            "PQRST",
            "UVWXY",
            "ZÅÄÖ"
        ], "split", "")

        s.ifShow = (letter) ->
            unless s.enabledLetters then return false
            letter in s.enabledLetters

        s.setLetter = (l) ->
            s.selected = l


littb.controller "titleListCtrl", ($scope, backend, util) ->
    s = $scope

    util.setupHash(s, "mediatypeFilter", "selectedLetter")
    s.sorttuple = ["itemAttrs.showtitle", false]
    s.setSort = (sortstr) ->
        s.sorttuple[0] = sortstr
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc



    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            # val_in : (val) ->
            # val_out : (val) ->
            # post_change : () ->
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
        ,
            key : "filter"
        ]

    # util.setupHash ""



    #TODO: what about titles that start with strange chars or non lower case letters?
    backend.getTitles().then (titleArray) ->
        # c.log "getTitles", titleArray
        # titleArray should be like [{author : ..., mediatype : [...], title : ...} more...]
        s.rowByLetter = _.groupBy titleArray, (item) ->
            item.itemAttrs.showtitle[0]
        s.currentLetters = _.keys s.rowByLetter

littb.controller "epubListCtrl", ($scope, backend, util) ->
    s = $scope

    window.has = (one, two) -> one.toLowerCase().indexOf(two) != -1
    s.rowFilter = (item) ->
        if "epub" not in item.mediatype then return false
        if s.authorFilter and s.authorFilter.authorid != item.author.authorid then return false
        if s.filterTxt
            return false if not ((has item.author.fullname, s.filterTxt) or (has item.itemAttrs.showtitle, s.filterTxt))
        return true

    backend.getTitles().then (titleArray) ->
        s.rows = _.filter titleArray, (item) -> "epub" in item.mediatype
        authors = _.pluck s.rows, "author"

        s.authorData = _.unique authors, false, (item) ->
            item.authorid

        s.currentLetters = _.unique _.map titleArray, (item) ->
            item.itemAttrs.showtitle[0]
        c.log "currentLetters", _.unique s.currentLetters

        util.setupHash s, {"selectedLetter" : (val) -> c.log "watch lttr val", val}




littb.controller "helpCtrl", ($scope, $http, util, $location) ->
    s = $scope
    url = host "/red/om/hjalp/hjalp.html"
    $http.get(url).success (data) ->
        s.htmlContent = data
        s.labelArray = for elem in $("[id]", data)
            label : $(elem).text()
            id : $(elem).attr("id")

        util.setupHash s, {"ankare" : (val) ->
            unless val
                $(window).scrollTop(0)
                return
            $(window).scrollTop($("##{val}").offset().top)
        }


littb.controller "authorListCtrl", ($scope, backend, util) ->
    s = $scope
    util.setupHash s, "authorFilter"
    backend.getAuthorList().then (data) ->
        s.authorIdGroup = _.groupBy data, (item) ->
            return item.authorid
        s.authorIdGroup[""] = ""
        s.rows = data

    s.getAuthor = (row) ->
        [last, first] = row.nameforindex.split(",")
        return last.toUpperCase() + "," + first
    # $scope.


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author, mediatype} = $routeParams
    _.extend s, $routeParams

    s.getMediatypes = () ->
        if mediatype then [mediatype] else s.data?.mediatypes

    s.data = backend.getSourceInfo(author, title, mediatype or "etext")




littb.controller "readingCtrl", ($scope, backend, $routeParams, $route, $location, util) ->
    s = $scope
    {title, author, mediatype, pagename} = $routeParams
    _.extend s, (_.omit $routeParams, "traff", "traffslut")

    s.pagename = pagename
    s.opts =
        backdropFade: true
        dialogFade:true


    s.getPage = () ->
        $route.current.pathParams.pagename
    s.setPage = (ix) ->
        s.pageix = ix
        s.pagename = s.pagemap["ix_" + s.pageix]
    s.nextPage = () ->
        newix = s.pageix + 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)
    s.prevPage = () ->
        newix = s.pageix - 1
        if "ix_" + newix of s.pagemap
            s.setPage(newix)
        else
            s.setPage(0)


    # if not s.workinfo?
    #     c.log "no workinfo"

    s.gotopage = (page) ->
        c.log "gotopage", page
        s.pagename = Number(page)

    s.mouseover = () ->
        c.log "mouseover"
        s.showPopup = true


    s.getWords = (val) ->
        unless val then return []
        return backend.searchLexicon(val)

    s.getTooltip = (part) ->
        return part.navtitle if part.navtitle != part.showtitle


    util.setupHashComplex s, [
            scope_name : "markee_from"
            key : "traff"
        ,
            scope_name : "markee_to"
            key : "traffslut"

    ]

    watches = []
    watches.push s.$watch "pagename", (val) ->
        c.log "pagename", val
        s.displaynum = val
        $location.path("/forfattare/#{author}/titlar/#{title}/sida/#{val}/#{mediatype}")


    watches.push s.$watch "getPage()", (val) ->
        c.log "getPage watch", val
        unless val? then return


        s.pagename = val
        backend.getPage(author, title, mediatype, s.pagename).then ([data, workinfo]) ->
            # c.log "data, workinfo", data, workinfo
            s.workinfo = workinfo
            s.pagemap = workinfo.pagemap
            c.log "pagemap", s.pagemap
            # c.log "parts", workinfo.parts

            s.startpage = Number(workinfo.startpagename)


            page = $("page[name=#{pagename}]", data).clone()
            if not page.length
                page = $("page:last", data).clone()
                s.pagename = page.attr("name")

            s.pageix = s.pagemap["page_" + s.pagename]

            if mediatype == 'faksimil'
                s.url = $("faksimil-url[size=3]", page).text()
            else
                page.children().remove()
                s.etext_html = page.text()

    s.$on "$destroy", () ->
        for w in watches
            w()

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
        if "get" of elem
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
        scope.loc = $location
        scope.$watch 'loc.search()', ->
            for obj in config
                val = $location.search()[obj.key]
                unless val then continue

                val = (obj.val_in or _.identity)(val)

                if "scope_name" of obj
                    scope[obj.scope_name] = val
                else if "scope_func" of obj
                    scope[obj.scope_func](val)
                else
                    scope[obj.key] = val

        for obj in config
            watch = obj.expr or obj.scope_name or obj.key
            scope.$watch watch, do (obj) ->
                (val) ->
                    val = (obj.val_out or _.identity)(val)
                    $location.search obj.key, val or null
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
                    c.log "watch name", val
                    $location.search(name, val or null)
                    callback(val) if callback





littb.factory 'backend', ($http, $q, util) ->
    # $http.defaults.transformResponse = (data, headers) ->

    http = (config) ->
        defaultConfig =
            method : "GET"
            params:
                username : "app"
            transformResponse : (data, headers) ->
                output = new DOMParser().parseFromString(data, "text/xml")
                if $("fel", output).length
                    c.log "fel:", $("fel", output).text()
                return output

        $http(_.deepExtend defaultConfig, config)


    objFromAttrs = (elem) ->
        return null unless elem
        _.object ([util.normalize(attrib.name), attrib.value] for attrib in elem.attributes)

    parseWorkInfo = (root, xml) ->
        useInnerXML = ["sourcedesc"]
        asArray = ["mediatypes"]
        output = {}
        for elem in $(root, xml).children()
            if elem.nodeName in useInnerXML
                val = util.getInnerXML elem

            else if elem.nodeName in asArray
                 val = _.map $(elem).children(), (child) ->
                    $(child).text()
            else
                val = $(elem).text()

            output[util.normalize(elem.nodeName)] = val
        return output



    getTitles : ->
        def = $q.defer()
        http(
            url : host "/query/lb-anthology.xql"
            params:
                action : "get-works"

        ).success (xml) ->
            # c.log "getTitles success", xml
            workIdGroups = _.groupBy $("item", xml), (item) ->
                $(item).attr("lbworkid")

            rows = {}
            for workid, elemList of workIdGroups
                itm = $(elemList[0])
                rows[workid] =
                    itemAttrs : objFromAttrs elemList[0]
                    author : (objFromAttrs itm.find("author").get(0)) or ""
                    mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))

            rows = _.flatten _.values rows
            def.resolve rows
            # .fail -> def.reject()
        return def.promise

    getAuthorList : ->
        def = $q.defer()
        url = host "/query/lb-authors.xql?action=get-authors"
        # url = "authors.xml"
        http(
            url : url
            ).success (xml) ->
            attrArray = for item in $("item", xml)
                objFromAttrs item

            def.resolve attrArray

        return def.promise

    getSourceInfo : (author, title, mediatype) ->
        def = $q.defer()
        url = host "/query/lb-anthology.xql"

        http(
            url : url
            params :
                action : "get-work-info-init"
                authorid : author
                titlepath : title
                mediatype: mediatype

        ).success (xml) ->
            output = parseWorkInfo("result", xml)

            errata = $("errata", xml).parent().clone()
            if errata.length
                output.errata = util.getInnerXML errata

            def.resolve output
        return def.promise

    getPage : (author, title, mediatype, pagenum) ->
        def = $q.defer()
        url = host "/query/lb-anthology.xql"

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

            info["authorFullname"] = $("author-fullname", xml).text()
            info["showtitle"] = $(":root > showtitle", xml).text()
            info["css"] = $("css", xml).text()
            pgMap = {}
            for page in $("bok sida", xml)
                p = $(page)
                pgMap["ix_" + p.attr("ix")] = p.attr("sidn")
                pgMap["page_" + p.attr("sidn")] = Number p.attr("ix")


            info.pagemap = pgMap

            info.parts = _.map $("parts > part", xml), objFromAttrs


            def.resolve [xml, info]

        return def.promise

    getAuthorInfo : (author) ->
        def = $q.defer()
        url = host "/query/lb-authors.xql"
        http(
            url : url
            params :
                action : "get-author-data-init"
                authorid : author

        ).success (xml) ->
            authorInfo = {}
            for elem in $("LBauthor", xml).children()
                if elem.nodeName == "intro"
                    val = util.getInnerXML elem
                else
                    val = $(elem).text()

                authorInfo[util.normalize(elem.nodeName)] = val

            works = []
            for item in $("works item", xml)
                c.log "works item", item
                obj = objFromAttrs item
                # _.extend obj,
                    # mediatypes : _.unique (_.map $("mediatypes", item).children(), (child) -> $(child).attr("mediatype"))
                works.push obj

            authorInfo.works = works
            def.resolve authorInfo

        return def.promise


    getStats : () ->
        def = $q.defer()
        url = host "/query/lb-stats.xql"
        http(

            url : url
            params :
                action : "get-overall-stats"

        ).success (xml) ->
            output = {}
            parseObj = ["pages", "words"]
            for elem in $("result", xml).children()
                if elem.tagName == "table"
                    output.titleList = ("<a href='#{$(x).attr('href')}'>#{$(x).text()}</a>" for x in $("td:nth-child(2) a", elem))
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
        url = host "/query/lb-anthology.xql"
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

    searchWorks : (query) ->
        def = $q.defer()
        url = host "/query/lb-search.xql"

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
                            <item type="string">#{query or "finge"}|</item>
                        </string-filter>
                    <domain-filter>
                    <item type="all-titles" mediatype="all"></item>
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

            ).success (resultset) ->
                c.log "get-result-set success", resultset, $("result", resultset).children()

                output = []

                for elem in $("result", resultset).children()
                    [left, kw, right, work] = _.map $(elem).children(), $
                    # c.log "elem", work.get(0), work.get(0).attributes
                    output.push
                        left : left.text()
                        kw : kw.text()
                        right : right.text()
                        item : objFromAttrs work.get(0)

                def.resolve output



        ).error (data) ->
            c.log "error", arguments
            def.reject()
        return def.promise

    searchLexicon : (str) ->
        def = $q.defer()
        url = "http://demolittb.spraakdata.gu.se/query/so.xql"
        # http://demolittb.spraakdata.gu.se?word=abdikerades
        http(
            url : url
            params :
                word : str + "*"
            # transformResponse : (data, headers) ->
            #     c.log "transformResponse", data, headers

        ).success (xml) ->
            c.log "searchLexicon", xml

            output = for article in $("artikel", xml)
                baseform : $("grundform", article).text()
                # lexemes : (_.map $("lexem", article), util.getInnerXML).join("\n")
                lexemes : util.getInnerXML article

            def.resolve output



        return def.promise

