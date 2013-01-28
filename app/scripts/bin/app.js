(function() {
  'use strict';

  window.host = function(url) {
    return "http://demolittbdev.spraakdata.gu.se" + url;
  };

  window.littb = angular.module('littbApp', []).config(function($routeProvider) {
    return $routeProvider.when('/', {
      templateUrl: 'views/start.html',
      controller: 'startCtrl'
    }).when('/presentationer', {
      templateUrl: host('/red/presentationer/presentationerForfattare.html')
    }).when('/om/aktuellt', {
      templateUrl: host('/red/om/aktuellt/aktuellt.html')
    }).when('/om/rattigheter', {
      templateUrl: host('/red/om/rattigheter/rattigheter.html')
    }).when('/om/ide', {
      templateUrl: host('/red/om/ide/omlitteraturbanken.html')
    }).when('/om/inenglish', {
      templateUrl: host('/red/om/ide/inenglish.html')
    }).when('/om/hjalp', {
      templateUrl: host('/red/om/hjalp/hjalp.html')
    }).when('/statistik', {
      templateUrl: 'views/stats.html',
      controller: 'statsCtrl',
      reloadOnSearch: false
    }).when('/sok', {
      templateUrl: 'views/search.html',
      controller: 'searchCtrl',
      reloadOnSearch: false
    }).when("/titlar", {
      templateUrl: "views/titleList.html",
      controller: "titleListCtrl",
      reloadOnSearch: false
    }).when("/epub", {
      templateUrl: "views/epubList.html",
      controller: "epubListCtrl",
      reloadOnSearch: false
    }).when("/forfattare", {
      templateUrl: "views/authorList.html",
      controller: "authorListCtrl"
    }).when("/forfattare/:author", {
      templateUrl: "views/authorInfo.html",
      controller: "authorInfoCtrl"
    }).when("/forfattare/:author/titlar/:title/info", {
      templateUrl: "views/sourceInfo.html",
      controller: "sourceInfoCtrl",
      reloadOnSearch: false
    }).when("/forfattare/:author/titlar/:title/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false
    }).when("/forfattare/:author/titlar/:title/sida/:pagenum/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false
    }).when('/kontakt', {
      templateUrl: 'views/contactForm.html',
      controller: 'contactFormCtrl',
      reloadOnSearch: false
    }).otherwise({
      redirectTo: '/'
    });
  });

  littb.run(function($rootScope) {
    return $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
      var classList;
      $("#toolkit").html("");
      classList = ($("[ng-view]").attr("class") || "").split(" ");
      classList = _.filter(classList, function(item) {
        return !_.str.startsWith(item, "page-");
      });
      $("body").attr("class", classList.join(" "));
      if (newRoute.controller) {
        return $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""));
      }
    });
  });

}).call(this);
