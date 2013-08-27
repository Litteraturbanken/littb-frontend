'use strict';
_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g

routeStartCurrent = null

window.getScope = () -> $("#mainview").children().scope()

window.littb = angular.module('littbApp', ["ui.bootstrap.typeahead"
                                           "template/typeahead/typeahead.html"
                                           "ui.bootstrap.modal"
                                           "ui.bootstrap.tooltip"
                                           "template/tooltip/tooltip-popup.html"
                                           "template/typeahead/typeahead-popup.html"
                                           ])
    .config ($routeProvider) ->
        $routeProvider
            .when '',
                redirectTo : "/start"
            .when '/',
                redirectTo : "/start"
            .when '/start',
                templateUrl: 'views/start.html'
                controller: 'startCtrl'
                title : "Svenska klassiker som e-bok och epub"
            .when '/presentationer',
                title : "Presentationer"
                breadcrumb : ["presentationer"]
                templateUrl : "views/presentations.html"
                controller : "presentationCtrl"
                        
            .when '/presentationer/specialomraden/:doc',
                controller : ($scope, $routeParams, $http, util) ->
                    $http.get("/red/presentationer/specialomraden/#{$routeParams.doc}").success (data) ->
                        # c.log "doc", data

                        $scope.doc = data
                        title = $("<root>#{data}</root>").find("h1").text()
                        c.log "title", title
                        title = title.split(" ")[0...5].join(" ")
                        $scope.setTitle title
                        $scope.appendCrumb title
                template : '''
                        <div style="position:relative;" ng-bind-html-unsafe="doc"></div>
                    '''
                breadcrumb : ["presentationer"]

            .when '/om/aktuellt',
                templateUrl: '/red/om/aktuellt/aktuellt.html'
                title : "Aktuellt"
                breadcrumb : ["aktuellt"]
            .when '/om/rattigheter',
                templateUrl: '/red/om/rattigheter/rattigheter.html'
                title : "Rättigheter"
                breadcrumb : ["rättigheter"]
            .when '/om/ide',
                templateUrl: '/red/om/ide/omlitteraturbanken.html'
                title : "Om LB"
                reloadOnSearch : false
                breadcrumb : ["idé"]
            .when '/om/inenglish',
                templateUrl: '/red/om/ide/inenglish.html'
                title : "In English"
                breadcrumb : ["in english"]
                reloadOnSearch : false
            .when '/om/hjalp',
                # templateUrl: '/red/om/hjalp/hjalp.html'
                templateUrl : "views/help.html"
                controller : "helpCtrl"
                title : "Hjälp"
                breadcrumb : ["hjälp"]
                reloadOnSearch : false
            .when '/statistik',
                templateUrl: 'views/stats.html'
                controller : 'statsCtrl'
                reloadOnSearch : false
                title : "Statistik"
                breadcrumb : ["statistik"]
            .when '/sok',
                templateUrl: 'views/search.html'
                controller : 'searchCtrl'
                reloadOnSearch : false
                title : "Sök i verkstext"
                breadcrumb : ["sök"]

            .when "/titlar",
                templateUrl : "views/titleList.html"
                controller : "titleListCtrl"
                reloadOnSearch : false
                title : "Titlar"
                breadcrumb : ["titlar"]
            .when "/epub",
                templateUrl : "views/epubList.html"
                controller : "epubListCtrl"
                reloadOnSearch : false
                title : "Gratis titlar för nerladdning i epubformatet"
                breadcrumb : ["epub"]
            .when "/forfattare",
                templateUrl : "views/authorList.html"
                controller : "authorListCtrl"
                title : "Författare"
                reloadOnSearch : false
                breadcrumb : ["författare"]
            .when "/forfattare/LagerlofS",
                templateUrl : "views/sla/lagerlof.html"
                controller : "lagerlofCtrl"
                reloadOnSearch : false
                breadcrumb : ["författare", "lagerlöf"]
            .when "/forfattare/LagerlofS/biblinfo",
                templateUrl : "views/sla/biblinfo.html"
                controller : "biblinfoCtrl"
                reloadOnSearch : false
                breadcrumb : ["författare", "lagerlöf"]
            .when "/forfattare/:author",
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
                breadcrumb : [
                    label : "författare"
                    url : "#!/forfattare"
                ]
            .when "/forfattare/:author/titlar",
                templateUrl : "views/authorTitles.html"
                controller : "authorInfoCtrl"
                reloadOnSearch : false
                title : "Titlar"
                breadcrumb : ["författare"]
            .when "/forfattare/:author/titlar/:title/info",
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
                title : "Verk"
                breadcrumb : ["författare"]
            .when "/forfattare/:author/titlar/:title/info/:mediatype",
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
                breadcrumb : ["författare"]
            .when "/forfattare/:author/titlar/:title/:mediatype",
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false
                breadcrumb : ["författare"]
            .when "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype",
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false,

                resolve :
                    r : ($q, $routeParams, $route, $rootScope) ->
                        def = $q.defer()

                        if _.isEmpty($routeParams)
                            def.resolve()
                            # return def.promise
                        # if we're only changing pages in the reader, don't change route

                        if routeStartCurrent and $route.current.controller == "readingCtrl"
                            cmp = ["author", "mediatype", "title"]
                            current = _.pick $route.current.params, cmp...
                            prev = _.pick routeStartCurrent.params, cmp...
                            if _.isEqual current, prev
                                def.reject()
                            else
                                def.resolve()
                        else
                            def.resolve()
                        return def.promise

            .when '/kontakt',
                templateUrl: 'views/contactForm.html'
                controller : 'contactFormCtrl'
                reloadOnSearch : false
                title : "Kontakt"
                breadcrumb : ["kontakt"]
            .when "/id/:id",
                template : """<div ng-class="{searching:!data}"><h1>{{id}}</h1>
                    <div class="preloader">Hämtar <span class="dots_blink"></span></div>
                    <table class="table-striped">
                    <tr ng-repeat="row in data | filter:{'itemAttrs.lbworkid' : id, 'itemAttrs.showtitle' : title}">
                        <td>{{row.itemAttrs.lbworkid}}</td>
                        <td>
                            <a href="#!/forfattare/{{row.author.authorid}}/titlar/{{row.itemAttrs.titlepath.split('/')[0]}}/info">{{row.itemAttrs.showtitle}}</a>
                        </td>
                        <td>
                            <span ng-repeat="type in row.mediatype">
                            
                                <span ng-show="!$first">:::</span>
                                <a href="#!/forfattare/{{row.author.authorid}}/titlar/{{row.itemAttrs.titlepath}}/info/{{type}}">{{type}}</a>
                            </span>
                        </td>
                    </tr>
                    </table>
                </div>
                            """
                controller : 'idCtrl'
            .otherwise
                template : "<p>Du har angett en adress som inte finns på Litteraturbanken.</p>
                            <p>Använd browserns bakåtknapp för att komma tillbaka till 
                            sidan du var på innan, eller klicka på någon av 
                            länkarna till vänster.</p>"
                breadcrumb : ["fel"]
                title : "Sidan kan inte hittas"
            #     redirectTo: '/'

littb.config ($httpProvider, $locationProvider, $tooltipProvider) ->
    $locationProvider.hashPrefix('!')
    delete $httpProvider.defaults.headers.common["X-Requested-With"]
    $tooltipProvider.options
        appendToBody: true


littb.run ($rootScope, $location, $rootElement, $q, $timeout) ->
    firstRoute = $q.defer()
    firstRoute.promise.then () ->
        $rootElement.addClass("ready")

    # just in case the above deferred fails. 
    $timeout( () -> 
        $rootElement.addClass("ready")
    , 1000)

    $rootScope.goto = (path) ->
        $location.url(path)

    $rootScope.setTitle = (title) ->
        if title
            title = title + " | Litteraturbanken v.3"
        else
            title = "Litteraturbanken v.3"
        $("title:first").text title

    $rootScope.$on "$routeChangeStart", (event, next, current) ->
        routeStartCurrent = current

    $rootScope.$on "$routeChangeSuccess", (event, newRoute, prevRoute) ->
        $rootScope.setTitle newRoute.title
        if newRoute.loadedTemplateUrl != prevRoute?.loadedTemplateUrl
            $("#toolkit").html ""
        $rootScope.prevRoute = prevRoute

        # get rid of old class attr on body
        cls = $rootElement.attr "class"
        cls = cls.replace /\ ?page\-\w+/g, ""
        $rootElement.attr "class", cls

        if newRoute.controller?.replace
            $rootElement.addClass("page-" + newRoute.controller.replace("Ctrl", ""))

        $rootScope.breadcrumb = for item in newRoute?.breadcrumb or []
            if _.isObject item 
                item 
            else
                {label : item, url : "#!/" + normalizeUrl(item).join("")}

        firstRoute.resolve()


    normalizeUrl = (str) ->
        trans = _.object _.zip "åäö", "aao"

        _.map str, (letter) ->
            trans[letter.toLowerCase()] or letter


    

    $rootScope.appendCrumb = (input) ->
        if _.isArray input
            array = input
        else if _.isString input
            array = [{label : input}]
        else if _.isObject input
            array = [input]

        $rootScope.breadcrumb = [].concat $rootScope.breadcrumb, array

    


littb.service "searchData", (backend, $q) ->
    NUM_HITS = 20 # how many hits per search?
    @data = []
    @total_hits = null
    @current = null

    parseUrls = (row) ->
        itm = row.item
        return "/forfattare/#{itm.authorid}/titlar/#{itm.titleidNew}" + 
            "/sida/#{itm.pagename}/#{itm.mediatype}?#{backend.getHitParams(itm)}"
        
    @save = (startIndex, currentIndex, input, search_args) ->
        @searchArgs = search_args
        @data = new Array(input.count)
        @appendData startIndex, input
        @total_hits = input.count
        @current = currentIndex

    @appendData = (startIndex, data) ->
        @data[startIndex..data.kwic.length] = _.map data.kwic, parseUrls


    @next = () ->
        @current++
        @search()

        
    @prev = () ->
        @current--
        @search()


    @search = () ->
        def = $q.defer()
        if @data[@current]? 
            def.resolve @data[@current]
        else
            current_page = Math.floor(@current / NUM_HITS )
            args = [].concat @searchArgs, [current_page + 1, NUM_HITS]
            backend.searchWorks(args...).then (data) =>
                @appendData @current, data
                def.resolve @data[@current]
        return def.promise


    @reset = () ->
        @current = null
        @total_hits = null
        @data = []
        @searchArgs = null




littb.filter "setMarkee", () ->
    return (input, fromid, toid) ->
        if not (fromid or toid) then return input
        input = $(input)
        wrapper = $("<div>")
        if fromid == toid
            $("#" + fromid, input).addClass "markee"
        else
            $("#" + fromid, input)
                .nextUntil("#" + toid, "span")
                .andSelf()
                .add("#" + toid, input)
                .addClass("markee")

        wrapper.append input
        return wrapper.html()

littb.filter "numberFmt", () ->
    return (input) ->
        unless input then return input
        input = _.map input.toString().split("").reverse(), (item, i) ->
            if not i then return item
            if i % 3 == 0
              return [item, " "]
            return item

        _.flatten(input.reverse()).join("")
