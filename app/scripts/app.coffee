'use strict';

_.mixin deepExtend: underscoreDeepExtend(_)
_.templateSettings =
  interpolate : /\{\{(.+?)\}\}/g


window.host = (url) -> "http://demolittbdev.spraakdata.gu.se" + url
window.littb = angular.module('littbApp', [])
    .config ($routeProvider) ->

        $routeProvider
            .when '/',
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
            .when '/om/inenglish',
                templateUrl: host '/red/om/ide/inenglish.html'
                title : "In English"
            .when '/om/hjalp',
                # templateUrl: host '/red/om/hjalp/hjalp.html'
                templateUrl : "views/help.html"
                title : "Hjälp"
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
            .when "/forfattare/:author/titlar/:title/sida/:pagenum/:mediatype"
                templateUrl : "views/reader.html"
                controller : "readingCtrl"
                reloadOnSearch : false
            .when '/kontakt',
                templateUrl: 'views/contactForm.html'
                controller : 'contactFormCtrl'
                reloadOnSearch : false
                title : "Kontakt"
            .otherwise
                redirectTo: '/'

littb.run ($rootScope) ->
    $rootScope.$on "$routeChangeSuccess", (event, newRoute, prevRoute) ->

        c.log "$routeChangeSuccess", newRoute

        if newRoute.title
            title = "Litteraturbanken v.3 | " + newRoute.title

            # if newRoute.controller == "startCtrl"
        else
            title = "Litteraturbanken v.3"

        $("title").text(title)
        # c.log "prev != new"
        c.log newRoute.loadedTemplateUrl, prevRoute?.loadedTemplateUrl
        if newRoute.loadedTemplateUrl != prevRoute?.loadedTemplateUrl
            c.log "empty toolkit"
            $("#toolkit").html ""
        else
            c.log event.preventDefault()
        $rootScope.prevRoute = prevRoute

        # sync ng-view class name to page
        classList = ($("[ng-view]").attr("class") or "").split(" ")
        classList = _.filter classList, (item) -> not _.str.startsWith item, "page-"
        $("body").attr "class", classList.join(" ")
        if newRoute.controller
            $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""))




    $rootScope.$on "$routeChangeStart", (event, next, current) ->
        c.log "routeChangeStart", next, current
        c.log "routeChangeStart", next?.templateUrl, current?.templateUrl
        if next?.templateUrl == current?.templateUrl
            c.log "don't change"
            # event.preventDefault()

    $rootScope.$on "$routeChangeError", () ->
            c.log "routeChangeError", arguments
