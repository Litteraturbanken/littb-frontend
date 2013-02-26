'use strict';

window.c = console ? log : _.noop


window.xml2Str = (xmlNode) ->
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
window.getInnerXML = (elem) ->
    strArray = for child in elem.childNodes
        xml2Str child
    return strArray.join("")


PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i
SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g
MOZ_HACK_REGEXP = /^moz([A-Z])/
normalize = (name) ->
    camelCase(name.replace(PREFIX_REGEXP, ''));

camelCase = (name) ->
  name.replace(SPECIAL_CHARS_REGEXP, (_, separator, letter, offset) ->
    (if offset then letter.toUpperCase() else letter)
  ).replace MOZ_HACK_REGEXP, "Moz$1"



littb.controller "startCtrl", () ->

littb.controller "contactFormCtrl", ($scope, backend) ->
littb.controller "statsCtrl", ($scope, backend) ->
    s = $scope
    backend.getStats().then (data) ->
        s.data = data

littb.controller "searchCtrl", ($scope, backend) ->
    s = $scope
    s.open = false
    s.searchProofread = true
    s.searchNonProofread = true

    s.authors = backend.getAuthorList()

    s.$watch "selected_author", (newAuthor, prevVal) ->
        return unless newAuthor
        s.titles = backend.getTitlesByAuthor(newAuthor.authorid)


    s.search = () ->
        s.results = backend.searchWorks(s.query)



littb.controller "authorInfoCtrl", ($scope, backend, $routeParams) ->
    {author} = $routeParams
    $scope.authorInfo = backend.getAuthorInfo(author)




littb.controller "titleListCtrl", ($scope, $location, backend, util) ->
    s = $scope
    s.loc = $location

    s.letterArray = _.invoke([
        "ABCDE",
        "FGHIJ",
        "KLMNO",
        "PQRST",
        "UVWXY",
        "ZÅÄÖ"
    ], "split", "")

    util.setupHash(s, "sort", "filter", "mediatypeFilter")


    backend.getTitles().then (titleArray) ->
        # titleArray should be like [{author : ..., mediatype : [...], title : ...} more...]
        s.rowByLetter = _.groupBy titleArray, (item) ->
            item.itemAttrs.showtitle[0]

        s.selectedLetter = _.keys(s.rowByLetter).sort()[0]

        s.selectedLetter = "A"
        s.rows = s.rowByLetter[s.selectedLetter]


    s.setLetter = (l) ->
        list = s.rowByLetter[l]
        if l and l.length
            s.selectedLetter = l
            s.rows = list

littb.controller "epubListCtrl", ($scope, backend) ->
    s = $scope
    backend.getTitles().then (titleArray) ->
        s.rows = titleArray
        authors = (x.author for x in titleArray when "epub" in x.mediatype)

        s.authorData = _.unique authors, false, (item) ->
            item.authorid
        # c.log s.authorData


    # s.authorData = backend.getAuthorList()



littb.controller "authorListCtrl", ($scope, backend) ->
    backend.getAuthorList().then (data) ->
        $scope.authorIdGroup = _.groupBy data, (item) ->
            return item.authorid
        $scope.authorIdGroup[""] = ""
        $scope.rows = data
    # $scope.


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author, mediatype} = $routeParams
    _.extend s, $routeParams

    s.getMediatypes = () ->
        if mediatype then [mediatype] else s.data?.mediatypes

    backend.getSourceInfo(author, title).then (data) ->
        s.data = data



littb.controller "readingCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author, mediatype, pagenum} = $routeParams
    _.extend s, $routeParams
    s.pagenum = Number(pagenum)

    backend.getPage(author, title, mediatype, s.pagenum).then ([data, workinfo]) ->
        s.workinfo = workinfo
        page = $("page[name=#{pagenum}]", data).clone()
        if not page.length
            page = $("page:last", data).clone()
            s.pagenum = Number(page.attr("name"))
        if mediatype == 'faksimil'
            s.url = $("faksimil-url[size=3]", page).text()
        else
            page.children().remove()
            s.etext_html = page.text()




littb.factory "util", ($location) ->
    setupHash : (scope, names...) ->
        scope[name] = $location.search()[name]
        scope.$watch 'loc.search()', ->
            _.extend(scope, _.pick($location.search(), names...))

        for name in names
            scope.$watch name, do (name) ->
                (val) ->
                    $location.search(name, val or null)





littb.factory 'backend', ($http, $q) ->
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
        _.object ([attrib.name, attrib.value] for attrib in elem.attributes)

    parseWorkInfo = (root, xml) ->
        useInnerXML = ["sourcedesc"]
        asArray = ["mediatypes"]
        output = {}
        for elem in $(root, xml).children()
            if elem.nodeName in useInnerXML
                val = getInnerXML elem

            else if elem.nodeName in asArray
                 val = _.map $(elem).children(), (child) ->
                    $(child).text()
            else
                val = $(elem).text()

            output[normalize(elem.nodeName)] = val
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

    getSourceInfo : (author, title) ->
        def = $q.defer()
        url = host "/query/lb-anthology.xql"
        http(
            url : url
            params :
                action : "get-work-info-init"
                authorid : author
                titlepath : title
                # mediatype:
        ).success (xml) ->
            output = parseWorkInfo("result", xml)
            # useInnerXML = ["sourcedesc"]
            # asArray = ["mediatypes"]
            # output = {}
            # for elem in $("result", xml).children()
            #     if elem.nodeName in useInnerXML
            #         val = getInnerXML elem

            #     else if elem.nodeName in asArray
            #          val = _.map $(elem).children(), (child) ->
            #             $(child).text()
            #     else
            #         val = $(elem).text()

            #     output[normalize(elem.nodeName)] = val
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
            info["showtitle"] = $("showtitle", xml).text()
            info["css"] = $("css", xml).text()


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
                    val = getInnerXML elem
                else
                    val = $(elem).text()

                authorInfo[normalize(elem.nodeName)] = val

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


