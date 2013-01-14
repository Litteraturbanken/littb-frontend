'use strict';

window.littb = angular.module('littbApp', [])
    .config ($routeProvider) ->

        $routeProvider
            .when '/',
                # templateUrl: 'views/main.html',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/start/startsida.html',
                controller: 'MainCtrl'
            .when '/presentationer',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/presentationer/presentationerForfattare.html',
            .when '/om/aktuellt',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/aktuellt/aktuellt.html',
            .when '/om/rattigheter',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/rattigheter/rattigheter.html',
            .when '/om/ide',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/ide/omlitteraturbanken.html',
            .when '/om/inenglish',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/ide/inenglish.html',
            .when '/kontakt',
                templateUrl: 'views/contactForm.html',
                controller : 'contactFormCtrl',
                reloadOnSearch : false
            .when '/om/hjalp',
                templateUrl: '/cgi-bin/get.py?url=http://demolittb.spraakdata.gu.se/red/om/hjalp/hjalp.html',
            .when '/statistik',
                templateUrl: 'views/stats.html',
                controller : 'statsCtrl',
                reloadOnSearch : false
            .when '/sok',
                templateUrl: 'views/search.html',
                controller : 'searchCtrl',
                reloadOnSearch : false


            .when "/titlar",
                templateUrl : "views/titleList.html"
                controller : "titleListCtrl"
                reloadOnSearch : false
            .when "/epub",
                templateUrl : "views/epubList.html"
                controller : "epubListCtrl"
                reloadOnSearch : false
            .when "/forfattare",
                templateUrl : "views/authorList.html"
                controller : "authorListCtrl"
            .when "/forfattare/:author",
                templateUrl : "views/authorInfo.html"
                controller : "authorInfoCtrl"
            .when "/forfattare/:author/titlar/:title/info"
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

            .otherwise
                redirectTo: '/'
