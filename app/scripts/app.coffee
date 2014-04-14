'use strict';
_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g

routeStartCurrent = null

window.getScope = () -> $("#mainview").children().scope()

window.littb = angular.module('littbApp', [ "ngRoute",
                                            "ui.bootstrap"
                                            "template/modal/backdrop.html"
                                            "template/modal/window.html"
                                            "template/tooltip/tooltip-popup.html"
                                            "template/typeahead/typeahead-popup.html"
                                            "template/typeahead/typeahead-match.html"
                                            "angularSpinner"
                                            "pasvaz.bindonce"
                                            "jmdobry.angular-cache"
                                            "ngAnimate"
                                           ])
    .config ($routeProvider) ->

        class Router
            constructor : () ->
            when : (route, obj) ->

                    

                route = [route] if not _.isArray route
                for r in route
                    if r.split("/")[1] == "forfattare"
                        shortRoute = r.replace(/^\/forfattare\//, "/f/").replace("/titlar/", "/t/")
                        $routeProvider.when shortRoute, obj
                        
                    

                    $routeProvider.when r, obj
                return this
            otherwise : () -> $routeProvider.otherwise.apply $routeProvider, arguments

        router = new Router()

        router
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
                        
            .when '/presentationer/:folder/:doc',
                controller : ["$scope", "$routeParams", "$http", "util", 
                                ($scope, $routeParams, $http, util) ->
                                    $http.get("/red/presentationer/#{$routeParams.folder}/#{$routeParams.doc}").success (data) ->
                                        c.log "doc", data
                
                                        $scope.doc = data
                                        $scope.title = $("<root>#{data}</root>").find("h1").text()
                                        $scope.title = $scope.title.split(" ")[0...5].join(" ")
                                        $scope.setTitle $scope.title
                                        $scope.appendCrumb $scope.title
                ]
                template : '''
                        <meta-desc>{{title}}</meta-desc>
                        <div style="position:relative;" ng-bind-html="doc | trust"></div>
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
                title : "Sök i verk"
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
            # .when "/forfattare/LagerlofS",
            #     templateUrl : "views/sla/lagerlof.html"
            #     controller : "lagerlofCtrl"
            #     reloadOnSearch : false
            #     breadcrumb : ["författare", "lagerlöf"]
            # .when "/forfattare/LagerlofS/biblinfo",
            #     templateUrl : "views/sla/biblinfo.html"
            #     controller : "biblinfoCtrl"
            #     reloadOnSearch : false
            #     breadcrumb : ["författare", "lagerlöf"]
            .when ["/forfattare/:author"
                   "/forfattare/:author/titlar"
                   "/forfattare/:author/bibliografi"
                   "/forfattare/:author/presentation"
                   "/forfattare/:author/semer"
                   ],
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
                breadcrumb : [
                    label : "författare"
                    url : "#!/forfattare"
                ]
                resolve : 
                    r : ["$q", "$routeParams", "$route",
                            ($q, $routeParams, $route) ->
                                def = $q.defer()
                                c.log "resolve", $routeParams, $route
                                if routeStartCurrent?.controller == "authorInfoCtrl" and 
                                        $route.current.controller == "authorInfoCtrl" and
                                        $route.current.params.author == $routeParams.author
                                    def.reject()
                                else 
                                    def.resolve()
                                return def.promise
                        ]
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
            # .when "/editor/:lbid",

            .when [ "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype",
                    "/editor/:lbid/ix/:ix/:mediatype"],
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false,
                breadcrumb : ["författare"]
                resolve :
                    r : ["$q", "$routeParams", "$route", "$rootScope",
                            ($q, $routeParams, $route, $rootScope) ->
                                def = $q.defer()
        
                                if _.isEmpty($routeParams)
                                    def.resolve()
                                    # return def.promise
                                # if we're only changing pages in the reader, don't change route
        
                                if routeStartCurrent?.controller == "readingCtrl" and $route.current.controller == "readingCtrl"
                                    cmp = ["author", "mediatype", "title"]
                                    current = _.pick $route.current.params, cmp...
                                    prev = _.pick routeStartCurrent.params, cmp...
                                    if _.isEqual current, prev
                                        c.log "reject reader change"
                                        def.reject()
                                    else
                                        def.resolve()
                                else
                                    def.resolve()
                                return def.promise
                    ]

            .when '/kontakt',
                templateUrl: 'views/contactForm.html'
                controller : 'contactFormCtrl'
                reloadOnSearch : false
                title : "Kontakt"
                breadcrumb : ["kontakt"]
            .when ["/id/:id", "/id"],
                template : """
                <div ng-class="{searching:!data}">
                    <input ng-model="id" placeholder="lbid" autofocus ng-change="title = ''"> 
                    <input ng-model="title" placeholder="titel" ng-change="id = ''">
                    <div class="preloader">Hämtar <span class="dots_blink"></span></div>
                    <table class="table-striped">
                    <tr ng-repeat="row in data | filter:{'itemAttrs.lbworkid' : id} | filter:rowFilter">
                        <td>{{row.itemAttrs.lbworkid}}</td>
                        <td>
                            <a href="#!/forfattare/{{row.author.authorid}}/info">{{row.author.surname}}</a>
                        </td>
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
            title = title + " | Litteraturbanken"
        else
            title = "Litteraturbanken"
        $("title:first").text title

    $rootScope.$on "$routeChangeStart", (event, next, current) ->
        routeStartCurrent = current

    $rootScope.$on "$routeChangeSuccess", (event, newRoute, prevRoute) ->
        if newRoute.controller == "startCtrl"
            $("title:first").text "Litteraturbanken | " + newRoute.title
        else
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


        # c.log "newRoute?.breadcrumb", newRoute?.breadcrumb
        $rootScope.breadcrumb = for item in newRoute?.breadcrumb or []
            if _.isObject item 
                item 
            else
                {label : item, url : "#!/" + normalizeUrl(item).join("")}

        firstRoute.resolve()

    $rootScope._showmenu_mobile = false;

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

    



littb.filter "setMarkee", () ->
    return (input, fromid, toid) ->
        if not (fromid or toid) then return input
        input = $(input)
        wrapper = $("<div>")
        if fromid == toid
            $("#" + fromid, input).addClass("markee")
        else
            $("#" + fromid, input)
                .nextUntil("#" + toid, "span")
                .andSelf()
                .add("#" + toid, input)
                .addClass("markee")
                .filter(":odd").addClass("flip")

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


littb.filter "trust", ($sce) ->
    return (input) ->
        $sce.trustAsHtml input


