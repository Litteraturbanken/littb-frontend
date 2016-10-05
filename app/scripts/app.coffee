_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g

window.isDev = location.hostname != "litteraturbanken.se"

routeStartCurrent = null

# rewrite for libris
if(location.hash.length && location.hash[1] != "!")
    location.hash = "#!" + _.str.lstrip(location.hash, "#")


window.safeApply = (scope, fn) ->
    if (scope.$$phase || scope.$root.$$phase) then fn(scope) else scope.$apply(fn)

$.fn.outerHTML = () ->
    return $(this).clone().wrap('<div></div>').parent().html()

_.templateSettings.interpolate = /{{([\s\S]+?)}}/g;

authorResolve = ["$q", "$routeParams", "$route",
                            ($q, $routeParams, $route) ->
                                def = $q.defer()
                                c.log "resolve", $routeParams, $route
                                if routeStartCurrent?.$$route.controller == "authorInfoCtrl" and 
                                        $route.current.controller == "authorInfoCtrl" and
                                        $route.current.params.author == $routeParams.author
                                    def.reject()
                                else
                                    def.resolve()
                                return def.promise
                        ]

window.getScope = () -> $("#mainview").children().scope()

window.littb = angular.module('littbApp', [ "ngRoute",
                                            "ui.bootstrap"
                                            "template/modal/backdrop.html"
                                            "template/modal/window.html"
                                            "template/tooltip/tooltip-popup.html"
                                            "template/typeahead/typeahead-popup.html"
                                            "template/typeahead/typeahead-match.html"
                                            "angularSpinner"
                                            # "jmdobry.angular-cache"
                                            "ngAnimate"
                                            "ngAria"
                                            "ngTouch"
                                            'ui.select2'
                                            'ngScrollEvent'
                                            # "ui.slider"
                                            "dibari.angular-ellipsis"
                                           ])
    .config ($routeProvider) ->

        class window.Router
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
                templateUrl : "views/presentations.html"
                controller : "presentationCtrl"
                        
            .when '/presentationer/:folder/:doc',
                controller : ["$scope", "$routeParams", "$http", "util", "$rootElement",
                                ($scope, $routeParams, $http, util, $rootElement) ->
                                    $rootElement.addClass "page-presentation"
                                    $rootElement.addClass "subpage"
                                    $scope.$on "$destroy", () ->
                                        # $rootElement.removeClass "page-presentation"
                                        $rootElement.removeClass "subpage"

                                    $http.get("/red/presentationer/#{$routeParams.folder}/#{$routeParams.doc}").success (data) ->
                
                                        $scope.doc = data
                                        $scope.title = $("<root>#{data}</root>").find("h1").text()
                                        $scope.title = $scope.title.split(" ")[0...5].join(" ")
                                        $scope.setTitle $scope.title
                                        # $scope.appendCrumb $scope.title
                ]
                template : '''
                        <meta-desc>{{title}}</meta-desc>
                        <div class="content" style="position:relative;" ng-bind-html="doc | trust"></div>
                    '''
            .when '/om/aktuellt',
                # templateUrl: '/red/om/aktuellt/aktuellt.html'
                # title : "Aktuellt"
                redirectTo : "/nytt",
            .when '/nytt',
                templateUrl: "nytt.html"
                title : "Nytt hos Litteraturbanken"
                controller : "newCtrl"
            # .when '/om/rattigheter',
            #     templateUrl: '/red/om/rattigheter/rattigheter.html'
            #     title : "Rättigheter"
            .when '/om/:page', #['/om/ide', "/om/hjalp", "om/kontakt", "om/statistik", "om/inenglish"],
                templateUrl: "views/about.html"
                controller : "aboutCtrl"
                title : "Om LB"
                reloadOnSearch : false

                resolve : 
                    r : ["$q", "$routeParams", "$route", "$rootScope",
                            ($q, $routeParams, $route, $rootScope) ->
                                def = $q.defer()

                                if routeStartCurrent?.$$route.controller == "aboutCtrl" and 
                                        $route.current.controller == "aboutCtrl"
                                    c.log "reject about route"
                                    def.reject()
                                else
                                    def.resolve()
                                return def.promise
                        ]

            .when '/hjalp',
                redirectTo : "/om/hjalp"
            .when '/statistik',
                redirectTo: "/om/statistik"
            .when '/sok',
                templateUrl: 'views/search.html'
                controller : 'searchCtrl'
                reloadOnSearch : false

            .when "/bibliotek",
                templateUrl : "views/library.html"
                controller : "libraryCtrl"
                reloadOnSearch : false
                title : "Biblioteket – Titlar och författare"
            .when "/titlar",
                redirectTo : "/bibliotek"
            .when "/epub",
                templateUrl : "views/epubList.html"
                controller : "epubListCtrl"
                reloadOnSearch : false
                title : "Gratis böcker för nerladdning i epubformatet"
            .when "/forfattare",
                redirectTo : "/bibliotek"

            .when ["/forfattare/LagerlofS"
                   "/forfattare/LagerlofS/titlar"
                   "/forfattare/LagerlofS/bibliografi"
                   "/forfattare/LagerlofS/presentation"
                   "/forfattare/LagerlofS/biblinfo"
                   "/forfattare/LagerlofS/jamfor"
                   "/forfattare/LagerlofS/omtexterna"
                   "/forfattare/LagerlofS/omtexterna/:omtexternaDoc"
                   ],
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
                isSla : true
                reloadOnSearch : false
                resolve : 
                    r : authorResolve
            .when ["/forfattare/:author"
                   "/forfattare/:author/titlar"
                   "/forfattare/:author/bibliografi"
                   "/forfattare/:author/presentation"
                   "/forfattare/:author/mer"
                   "/forfattare/:author/semer"
                   "/forfattare/:author/biblinfo"
                   "/forfattare/:author/jamfor"
                   "/forfattare/:author/omtexterna/:omtexternaDoc?"
                   ],
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
                resolve : 
                    r : authorResolve
            .when "/forfattare/:author/titlar/:title/info/:mediatype",
                redirectTo : (routeParams, path, searchVars) ->
                    return "/forfattare/#{routeParams.author}/titlar/#{routeParams.title}/#{routeParams.mediatype}/?om-boken"
            .when [
                "/forfattare/:author/titlar/:title",
                "/forfattare/:author/titlar/:title/info"
                ],
                template : "<div></div>"
                controller : ["$scope", "backend", "$routeParams", "$location", ($scope, backend, $routeParams, $location) ->
                    backend.getSourceInfo($routeParams.author, $routeParams.title).then (data) ->
                        $location.url("/forfattare/#{$routeParams.author}/titlar/#{$routeParams.title}/#{data.mediatype}?om-boken").replace()
                ]


            .when "/forfattare/:author/titlar/:title/:mediatype",
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false
            # .when "/editor/:lbid",

            .when [ "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype",
                    "/editor/:lbid/ix/:ix/:mediatype"],
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false,
                resolve :
                    r : ["$q", "$routeParams", "$route", "$rootScope",
                            ($q, $routeParams, $route, $rootScope) ->
                                def = $q.defer()
        
                                if _.isEmpty($routeParams)
                                    def.resolve()
                                    # return def.promise
                                # if we're only changing pages in the reader, don't change route
        
                                if routeStartCurrent?.$$route.controller == "readingCtrl" and $route.current.controller == "readingCtrl"
                                    cmp = ["author", "mediatype", "title"]
                                    if "lbid" of $route.current.params
                                        cmp.push "lbid"
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
                redirectTo : "/om/kontakt"
            .when ["/id/:id", "/id"],
                template : """
                <div ng-class="{searching:!data}">
                    <input ng-model="id" placeholder="lbid" autofocus ng-change="titles = []"> 
                    <input ng-model="titles[0]" placeholder="titel" ng-change="id = '';" ng-model-options="{debounce: 500}">
                    <textarea ng-model="textarea" placeholder="flera titlar separarade med nyrad" ng-change="textareaChange(textarea)" ng-model-options="{debounce: 500}"></textarea>
                    <div class="preloader">Hämtar <span class="dots_blink"></span></div>

                    <table class="table-striped">
                    <tr ng-repeat="row in data | filter:idFilter | filter:rowFilter" track by $index>
                        <td>{{row.lbworkid}}</td>
                        <td>
                            <a href="/#!/forfattare/{{row.author[0].author_id}}">{{row.author[0].surname}}</a>
                        </td>
                        <td>
                            <a href="/#!/forfattare/{{row.author[0].author_id}}/titlar/{{row.work_title_id}}/{{row.mediatype}}">{{row.showtitle}}</a>
                        </td>
                        <td>
                            <span ng-repeat="type in row.mediatypes track by $index">
                            
                                <span ng-show="!$first">:::</span>
                                <a href="/#!/forfattare/{{row.author[0].author_id}}/titlar/{{row.titlepath}}/{{type.label}}">{{type.label}}</a>
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
                title : "Sidan kan inte hittas"
            #     redirectTo: '/'

littb.config ($httpProvider, $locationProvider, $tooltipProvider) ->
    $locationProvider.hashPrefix('!')
    delete $httpProvider.defaults.headers.common["X-Requested-With"]
    $tooltipProvider.options
        appendToBody: true



littb.run ($rootScope, $location, $rootElement, $q, $timeout) ->
    c.log "run search params", $location.search()
    firstRoute = $q.defer()
    firstRoute.promise.then () ->
        $rootElement.addClass("ready").removeClass("not_ready")

    $rootScope.getLogoUrl = () ->
        if $rootScope.isSchool 
            return "/skola"
        else if $rootScope.isSla
            return "/forfattare/LagerlofS"
        else
            return "/start"

    # just in case the above deferred fails. 
    $timeout( () -> 
        $rootElement.addClass("ready").removeClass("not_ready")
    , 1000)

    stripClass = (prefix) ->
        re = new RegExp("\\ ?#{prefix}\\-\\w+", "g");

        cls = $rootElement.attr "class"
        cls = cls.replace re, ""
        $rootElement.attr "class", cls


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
        # is done automatically by directive on scope $destroy
		#if newRoute.loadedTemplateUrl != prevRoute?.loadedTemplateUrl
        #    $("#toolkit").html ""
        $rootScope.prevRoute = prevRoute

        # get rid of old class attr on body
        stripClass("page")
        stripClass("site")

        if newRoute.controller?.replace
            $rootElement.addClass("page-" + newRoute.controller.replace("Ctrl", ""))

        if newRoute.school
            $rootScope.isSchool = true
            $rootElement.addClass("site-school")
            className = (_.last newRoute.templateUrl.split("/")).split(".")[0]
            $rootElement.addClass("page-" + className)
            
            
        else 
            delete $rootScope.isSchool
        
        if newRoute.isSla
            $rootScope.isSla = true
            $rootElement.addClass("site-sla")
            # className = (_.last newRoute.templateUrl.split("/")).split(".")[0]
            # $rootElement.addClass("page-" + className)
        else 
            delete $rootScope.isSla


        # c.log "newRoute?.breadcrumb", newRoute?.breadcrumb
        # $rootScope.breadcrumb = for item in newRoute?.breadcrumb or []
        #     if _.isObject item 
        #         item 
        #     else
        #         {label : item, url : "/#!/" + normalizeUrl(item).join("")}

        firstRoute.resolve()

    ###
    $rootScope.scrollPos = {} # scroll position of each view
    $(window).on "scroll", ->
        # false between $routeChangeStart and $routeChangeSuccess
        if $rootScope.okSaveScroll
            if $(window).scrollTop()
                $rootScope.scrollPos[$location.path()] = $(window).scrollTop()


    #console.log($rootScope.scrollPos);
    $rootScope.scrollClear = (path) ->
        $rootScope.scrollPos[path] = 0

    $rootScope.$on "$routeChangeStart", ->
        $rootScope.okSaveScroll = false

    $rootScope.$on "$routeChangeSuccess", ->
        $rootScope.okSaveScroll = true
        #     c.log "$routeChangeSuccess"
        #     $timeout (-> # wait for DOM, then restore scroll position
                
        #     ), 0

###

    # $rootScope._showmenu_mobile = false;
    $rootScope._focus_mode = true

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
            if $("#" + fromid, input).next().text() == "-"
                $("#" + fromid, input).next().next("br").next().addClass("markee")
                    
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
        if input.toString().length < 5 then return input
        input = _.map input.toString().split("").reverse(), (item, i) ->
            if not i then return item
            if i % 3 == 0
              return [item, " "]
            return item

        _.flatten(input.reverse()).join("")


littb.filter "trust", ($sce) ->
    return (input) ->
        $sce.trustAsHtml input

littb.filter "normalizeAuthor", () ->
    trans = _.object _.zip "ÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöøùúûüýÿ", "AAAAACEEEEIIIINOOOOOOUUUUYaaaaaaceeeeiiiinoooooouuuuyy"
    trans = _.extend trans, _.object _.zip ["Æ", "æ", "Ð", "ð", "Þ", "þ", "ß", "Œ", "œ"], ["AE", "ae", "DH", "dh", "TH", "th", "ss", "OE", "oe"]
    return (author_id) ->
        unless author_id then return
        ret = _.map author_id.split(""), (char) ->
            trans[char] or char
        .join("")

        return ret
