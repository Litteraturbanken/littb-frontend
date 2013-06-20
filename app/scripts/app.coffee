'use strict';
_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g




window.littb = angular.module('littbApp', ["ui.bootstrap.typeahead"
                                           "template/typeahead/typeahead.html"
                                           "ui.bootstrap.modal"
                                           "ui.bootstrap.tooltip"
                                           "template/tooltip/tooltip-popup.html"
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
                controller : ($scope, $routeParams) ->
                    $scope.doc = "/red/presentationer/specialomraden/#{$routeParams.doc}"
                template : '''
                        <div style="position:relative;" ng-include="doc"></div>
                    '''
            .when '/om/aktuellt',
                templateUrl: '/red/om/aktuellt/aktuellt.html'
                title : "Aktuellt"
            .when '/om/rattigheter',
                templateUrl: '/red/om/rattigheter/rattigheter.html'
                title : "Rättigheter"
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
                # breadcrumb : ["statistik"]
            .when '/sok',
                templateUrl: 'views/search.html'
                controller : 'searchCtrl'
                reloadOnSearch : false
                title : "Sök i verkstext"

            .when "/titlar",
                templateUrl : "views/titleList.html"
                controller : "titleListCtrl"
                reloadOnSearch : false
                title : "Titlar"
            .when "/epub",
                templateUrl : "views/epubList.html"
                controller : "epubListCtrl"
                reloadOnSearch : false
                title : "Gratis titlar för nerladdning i epubformatet"
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
            .when "/forfattare/LagerlofS/biblinfo",
                templateUrl : "views/sla/biblinfo.html"
                controller : "biblinfoCtrl"
                reloadOnSearch : false
            .when "/forfattare/:author/titlar",
                templateUrl : "views/authorTitles.html"
                controller : "authorInfoCtrl"
                reloadOnSearch : false
                title : "Titlar"
            .when "/forfattare/:author",
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
                breadcrumb : [
                    label : "författare"
                    url : "#/forfattare"
                ]
            .when "/forfattare/:author/titlar/:title/info",
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
                title : "Verk"
            .when "/forfattare/:author/titlar/:title/info/:mediatype",
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
            .when "/forfattare/:author/titlar/:title/:mediatype",
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false
            
            .when "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype",
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false,
                resolve :
                    r : ($q, $routeParams, $route) ->
                        def = $q.defer()

                        # c.log "route", $route
                        if _.isEmpty($routeParams)
                            def.resolve()
                            return def.promise
                        # because we have a pagenum here,
                        # we're still in the reader and should't leave
                        if "pagename" of $routeParams
                            def.reject()
                        else
                            def.resolve()
                        return def.promise

            .when '/kontakt',
                templateUrl: 'views/contactForm.html'
                controller : 'contactFormCtrl'
                reloadOnSearch : false
                title : "Kontakt"
                breadcrumb : ["kontakt"]
            .otherwise
                redirectTo: '/'

littb.config ($httpProvider, $locationProvider) ->
    # $locationProvider.hashPrefix('!')
    delete $httpProvider.defaults.headers.common["X-Requested-With"]


littb.run ($rootScope, $location, $rootElement) ->
    $rootScope.goto = (path) ->
        $location.url(path)

    $rootScope.$on "$routeChangeSuccess", (event, newRoute, prevRoute) ->
        if newRoute.title
            title = "Litteraturbanken v.3 | " + newRoute.title
        else
            title = "Litteraturbanken v.3"

        $("title").text(title)
        if newRoute.loadedTemplateUrl != prevRoute?.loadedTemplateUrl
            $("#toolkit").html ""
        $rootScope.prevRoute = prevRoute

        # sync ng-view class name to page
        classList = ($("[ng-view]").attr("class") or "").split(" ")
        classList = _.filter classList, (item) -> not _.str.startsWith item, "page-"
        $("body").attr "class", classList.join(" ")
        if newRoute.controller?.replace
            $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""))


    normalizeUrl = (str) ->
        trans = _.object _.zip "åäö", "aao"

        _.map str, (letter) ->
            trans[letter.toLowerCase()] or letter


    $rootScope.breadcrumb = for item in newRoute?.breadcrumb or []
        if _.isObject item 
            item 
        else
            {label : item, url : "#/" + normalizeUrl(item).join("")}

    $rootScope.appendCrumb = (label) ->
        $rootScope.breadcrumb = [].concat $rootScope.breadcrumb, [{label : label}]

littb.service "searchData", (backend, $q) ->
    NUM_HITS = 20 # how many hits per search?
    @data = []
    @total_hits = null
    @current = null

    parseUrls = (row) ->
        itm = row.item
        return "#/forfattare/#{itm.authorid}/titlar/#{itm.titleidNew}" + 
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
            backend.searchWorks(args...).then (data) ->
                @appendData @current, data
                def.resolve(data)
        return def.promise







littb.filter "setMarkee", () ->
    return (input, fromid, toid) ->
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


