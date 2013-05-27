'use strict';
_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g


window.host = (url) -> "http://demolittbdev.spraakdata.gu.se" + url
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
                templateUrl: 'views/start.html',
                controller: 'startCtrl'
                title : "Svenska klassiker som e-bok och epub"
            .when '/presentationer'
                templateUrl: host '/red/presentationer/presentationerForfattare.html'
                title : "Presentationer"
            .when '/om/aktuellt',
                templateUrl: host '/red/om/aktuellt/aktuellt.html'
                title : "Aktuellt"
            .when '/om/rattigheter',
                templateUrl: host '/red/om/rattigheter/rattigheter.html'
                title : "Rättigheter"
            .when '/om/ide',
                templateUrl: host '/red/om/ide/omlitteraturbanken.html'
                title : "Om LB"
                reloadOnSearch : false
            .when '/om/inenglish',
                templateUrl: host '/red/om/ide/inenglish.html'
                title : "In English"
                reloadOnSearch : false
            .when '/om/hjalp',
                # templateUrl: host '/red/om/hjalp/hjalp.html'
                templateUrl : "views/help.html"
                controller : "helpCtrl"
                title : "Hjälp"
                reloadOnSearch : false
            .when '/statistik',
                templateUrl: 'views/stats.html'
                controller : 'statsCtrl'
                reloadOnSearch : false
                title : "Statistik"
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
            .when "/forfattare/:author/titlar",
                templateUrl : "views/authorTitles.html"
                controller : "authorInfoCtrl"
                reloadOnSearch : false
                title : "Titlar"
            .when "/forfattare/:author",
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
            .when "/forfattare/:author/titlar/:title/info"
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
                title : "Verk"
            .when "/forfattare/:author/titlar/:title/info/:mediatype"
                templateUrl : "views/sourceInfo.html"
                controller : "sourceInfoCtrl"
                reloadOnSearch : false
            .when "/forfattare/:author/titlar/:title/:mediatype"
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false
            .when "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype"
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
            .otherwise
                redirectTo: '/'

littb.config ['$httpProvider', ($httpProvider) ->
  delete $httpProvider.defaults.headers.common["X-Requested-With"]
]

littb.run ($rootScope, $location) ->

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
        if newRoute.controller
            $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""))




    # $rootScope.$on "$routeChangeStart", (event, next, current) ->

    # $rootScope.$on "$routeChangeError", () ->

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

