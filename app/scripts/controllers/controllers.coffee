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
    s.open = true
    s.searchProofread = true
    s.searchNonProofread = true

    s.authors = backend.getAuthorList()

    s.$watch "selected_author", (newAuthor, prevVal) ->
        return unless newAuthor
        s.titles = backend.getTitlesByAuthor(newAuthor.authorid)


    backend.searchWorks()



littb.controller "authorInfoCtrl", ($scope, backend, $routeParams) ->
    {author} = $routeParams

    backend.getAuthorInfo(author).then (data) ->
        $scope.authorInfo = data
        c.log data


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

    util.setupHash(s, "sort", "filter")


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


    s.authorData = backend.getAuthorList()



littb.controller "authorListCtrl", ($scope, backend) ->
    backend.getAuthorList().then (data) ->
        $scope.authorIdGroup = _.groupBy data, (item) ->
            return item.authorid
        $scope.authorIdGroup[""] = ""
        $scope.rows = data
    # $scope.


littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author} = $routeParams
    _.extend s, $routeParams
    backend.getSourceInfo(author, title).then (data) ->
        s.data = data


littb.controller "readingCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author, mediatype, pagenum} = $routeParams
    _.extend s, $routeParams
    s.pagenum = Number(pagenum)

    backend.getPage(author, title, mediatype, s.pagenum).then ([data, workinfo]) ->
        c.log "page data", data, workinfo
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
    transform = (data, headers) -> new DOMParser().parseFromString(data, "text/xml")
    objFromAttrs = (elem) ->
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
        $http(
            url : "data.xml"
            method : "GET"
            transformResponse : transform
        ).success (xml) ->
            workIdGroups = _.groupBy $("item", xml), (item) ->
                $(item).attr("lbworkid")

            rows = {}
            for workid, elemList of workIdGroups
                itm = $(elemList[0])
                rows[workid] =
                    itemAttrs : objFromAttrs elemList[0]
                    author : objFromAttrs itm.find("author").get(0)
                    mediatype : _.unique (_.map elemList, (item) -> $(item).attr("mediatype"))

            rows = _.flatten _.values rows
            def.resolve rows
            # .fail -> def.reject()
        return def.promise

    getAuthorList : ->
        def = $q.defer()
        # url = host "/query/lb-authors.xql?action=get-authors&username=app"
        url = "authors.xml"
        $http(
            method : "GET"
            url : url
            transformResponse : transform
        ).success (xml) ->

            attrArray = for item in $("item", xml)
                objFromAttrs item

            def.resolve attrArray

        return def.promise

    getSourceInfo : (author, title) ->
        def = $q.defer()
        url = host "/query/lb-anthology.xql"
        $http(
            method : "GET"
            url : url
            transformResponse : transform
            params :
                action : "get-work-info-init"
                username : "app"
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
            username : "app"
            authorid : author
            titlepath : title
            navinfo : true
            css : true
            workdb : true
            mediatype: mediatype
            # pagename : pagenum

        if pagenum then params["pagename"] = pagenum

        #     params["pagename"] = [pagenum, pagenum]


        $http(
            method : "GET"
            url : url
            transformResponse : transform
            params : params
        ).success (xml) ->
            info = parseWorkInfo("LBwork", xml)

            info["authorFullname"] = $("author-fullname", xml).text()
            info["showtitle"] = $("showtitle", xml).text()


            def.resolve [xml, info]

        return def.promise

    getAuthorInfo : (author) ->
        def = $q.defer()
        url = host "/query/lb-authors.xql"
        $http(
            method : "GET"
            url : url
            transformResponse : transform
            params :
                action : "get-author-data-init"
                authorid : author
                username : "app"

        ).success (xml) ->
            authorInfo = {}
            for elem in $("LBauthor", xml).children()
                if elem.nodeName == "intro"
                    val = getInnerXML elem
                else
                    val = $(elem).text()

                authorInfo[normalize(elem.nodeName)] = val



            def.resolve authorInfo

        return def.promise


    getStats : () ->
        def = $q.defer()
        url = host "/query/lb-stats.xql"
        $http(
            method : "GET"
            url : url
            transformResponse : transform
            params :
                action : "get-overall-stats"
                username : "app"

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
        $http(
            method : "GET"
            url : url
            transformResponse : transform
            params :
                action : "get-titles-by-author"
                authorid : authorid
                username : "app"
        ).success (xml) ->
            output = []
            for elem in $("result", xml).children()
                output.push objFromAttrs(elem)

            def.resolve output


        return def.promise

    searchWorks : () ->
        def = $q.defer()
        url = host "/query/lb-search.xql"

        $http(
            method : "POST"
            url : url
            headers : {"Content-Type" : "text/xml; charset=utf-8"}
            transformResponse : transform
            params :
                action : "search-init"
                username : "app"
            data : """
                    <search>
                        <string-filter>
                            <item type="string">Gud|</item>
                        </string-filter>
                    <domain-filter>
                        <item type="titlepath" mediatype="all">Intradestal1786</item>
                    </domain-filter>
                    <ne-filter>
                        <item type="NUL"></item>
                    </ne-filter>
                    </search>
                """
        ).success((data) ->
            c.log "success", data
            def.resolve data
        ).error (data) ->
            c.log "error", arguments
            def.reject()
        return def.promise


