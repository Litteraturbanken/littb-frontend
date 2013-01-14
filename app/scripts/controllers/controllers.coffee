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



littb.controller "MainCtrl", () ->
littb.controller "contactFormCtrl", ($scope, backend) ->
littb.controller "statsCtrl", ($scope, backend) ->
littb.controller "searchCtrl", ($scope, backend) ->
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
        c.log "data", JSON.stringify data, null, 2


littb.controller "readingCtrl", ($scope, backend, $routeParams) ->
    s = $scope
    {title, author, mediatype, pagenum} = $routeParams
    c.log "params", $routeParams
    _.extend s, $routeParams
    s.pagenum = Number(pagenum)

    backend.getPage(author, title, mediatype, s.pagenum).then (data) ->
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
        url = "http://localhost/cgi-bin/get.py?url=" + encodeURIComponent("http://demolittb.spraakdata.gu.se/query/lb-authors.xql?action=get-authors&username=app")
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
        url = "http://localhost/cgi-bin/get.py?url=" + encodeURIComponent("http://demolittb.spraakdata.gu.se/query/lb-anthology.xql")
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
            useInnerXML = ["sourcedesc"]
            asArray = ["mediatypes"]
            output = {}
            for elem in $("result", xml).children()
                if elem.nodeName in useInnerXML
                    val = getInnerXML elem

                else if elem.nodeName in asArray
                     val = _.map $(elem).children(), (child) ->
                        $(child).text()
                else
                    val = $(elem).text()

                output[normalize(elem.nodeName)] = val
            def.resolve output
        return def.promise

    getPage : (author, title, mediatype, pagenum) ->
        def = $q.defer()
        url = "http://localhost/cgi-bin/get.py?url=" + encodeURIComponent("http://demolittb.spraakdata.gu.se/query/lb-anthology.xql")

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
            def.resolve xml

        return def.promise

    getAuthorInfo : (author) ->
        def = $q.defer()
        url = "http://localhost/cgi-bin/get.py?url=" + encodeURIComponent("http://demolittb.spraakdata.gu.se/query/lb-authors.xql")
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


