(function() {
  'use strict';  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };

  window.littb = angular.module('littbApp', ["ui.bootstrap.typeahead", "template/typeahead/typeahead.html", "ui.bootstrap.modal", "ui.bootstrap.tooltip", "template/tooltip/tooltip-popup.html"]).config(function($routeProvider) {
    return $routeProvider.when('', {
      redirectTo: "/start"
    }).when('/', {
      redirectTo: "/start"
    }).when('/start', {
      templateUrl: 'views/start.html',
      controller: 'startCtrl',
      title: "Svenska klassiker som e-bok och epub"
    }).when('/presentationer', {
      title: "Presentationer",
      breadcrumb: ["presentationer"],
      templateUrl: "views/presentations.html",
      controller: "presentationCtrl"
    }).when('/presentationer/specialomraden/:doc', {
      controller: function($scope, $routeParams) {
        return $scope.doc = "/red/presentationer/specialomraden/" + $routeParams.doc;
      },
      template: '<div style="position:relative;" ng-include="doc"></div>'
    }).when('/om/aktuellt', {
      templateUrl: '/red/om/aktuellt/aktuellt.html',
      title: "Aktuellt"
    }).when('/om/rattigheter', {
      templateUrl: '/red/om/rattigheter/rattigheter.html',
      title: "Rättigheter"
    }).when('/om/ide', {
      templateUrl: '/red/om/ide/omlitteraturbanken.html',
      title: "Om LB",
      reloadOnSearch: false,
      breadcrumb: ["idé"]
    }).when('/om/inenglish', {
      templateUrl: '/red/om/ide/inenglish.html',
      title: "In English",
      breadcrumb: ["in english"],
      reloadOnSearch: false
    }).when('/om/hjalp', {
      templateUrl: "views/help.html",
      controller: "helpCtrl",
      title: "Hjälp",
      breadcrumb: ["hjälp"],
      reloadOnSearch: false
    }).when('/statistik', {
      templateUrl: 'views/stats.html',
      controller: 'statsCtrl',
      reloadOnSearch: false,
      title: "Statistik"
    }).when('/sok', {
      templateUrl: 'views/search.html',
      controller: 'searchCtrl',
      reloadOnSearch: false,
      title: "Sök i verkstext"
    }).when("/titlar", {
      templateUrl: "views/titleList.html",
      controller: "titleListCtrl",
      reloadOnSearch: false,
      title: "Titlar"
    }).when("/epub", {
      templateUrl: "views/epubList.html",
      controller: "epubListCtrl",
      reloadOnSearch: false,
      title: "Gratis titlar för nerladdning i epubformatet"
    }).when("/forfattare", {
      templateUrl: "views/authorList.html",
      controller: "authorListCtrl",
      title: "Författare",
      reloadOnSearch: false,
      breadcrumb: ["författare"]
    }).when("/forfattare/:author/titlar", {
      templateUrl: "views/authorTitles.html",
      controller: "authorInfoCtrl",
      reloadOnSearch: false,
      title: "Titlar"
    }).when("/forfattare/:author", {
      templateUrl: "views/authorInfo.html",
      controller: "authorInfoCtrl",
      breadcrumb: [
        {
          label: "författare",
          url: "#/forfattare"
        }
      ]
    }).when("/forfattare/:author/titlar/:title/info", {
      templateUrl: "views/sourceInfo.html",
      controller: "sourceInfoCtrl",
      reloadOnSearch: false,
      title: "Verk"
    }).when("/forfattare/:author/titlar/:title/info/:mediatype", {
      templateUrl: "views/sourceInfo.html",
      controller: "sourceInfoCtrl",
      reloadOnSearch: false
    }).when("/forfattare/:author/titlar/:title/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false
    }).when("/forfattare/:author/titlar/:title/sida/:pagename/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false,
      resolve: {
        r: function($q, $routeParams, $route) {
          var def;

          def = $q.defer();
          if (_.isEmpty($routeParams)) {
            def.resolve();
            return def.promise;
          }
          if ("pagename" in $routeParams) {
            def.reject();
          } else {
            def.resolve();
          }
          return def.promise;
        }
      }
    }).when('/kontakt', {
      templateUrl: 'views/contactForm.html',
      controller: 'contactFormCtrl',
      reloadOnSearch: false,
      title: "Kontakt",
      breadcrumb: ["kontakt"]
    }).otherwise({
      redirectTo: '/'
    });
  });

  littb.config(function($httpProvider, $locationProvider) {
    return delete $httpProvider.defaults.headers.common["X-Requested-With"];
  });

  littb.run(function($rootScope, $location) {
    $rootScope.goto = function(path) {
      return $location.url(path);
    };
    return $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
      var classList, item, normalizeUrl, title, _ref;

      if (newRoute.title) {
        title = "Litteraturbanken v.3 | " + newRoute.title;
      } else {
        title = "Litteraturbanken v.3";
      }
      $("title").text(title);
      if (newRoute.loadedTemplateUrl !== (prevRoute != null ? prevRoute.loadedTemplateUrl : void 0)) {
        $("#toolkit").html("");
      }
      $rootScope.prevRoute = prevRoute;
      classList = ($("[ng-view]").attr("class") || "").split(" ");
      classList = _.filter(classList, function(item) {
        return !_.str.startsWith(item, "page-");
      });
      $("body").attr("class", classList.join(" "));
      if ((_ref = newRoute.controller) != null ? _ref.replace : void 0) {
        $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""));
      }
      normalizeUrl = function(str) {
        var trans;

        trans = _.object(_.zip("åäö", "aao"));
        return _.map(str, function(letter) {
          return trans[letter.toLowerCase()] || letter;
        });
      };
      $rootScope.breadcrumb = (function() {
        var _i, _len, _ref1, _results;

        _ref1 = (newRoute != null ? newRoute.breadcrumb : void 0) || [];
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          item = _ref1[_i];
          if (_.isObject(item)) {
            _results.push(item);
          } else {
            _results.push({
              label: item,
              url: "#/" + normalizeUrl(item).join("")
            });
          }
        }
        return _results;
      })();
      return $rootScope.appendCrumb = function(label) {
        return $rootScope.breadcrumb = [].concat($rootScope.breadcrumb, [
          {
            label: label
          }
        ]);
      };
    });
  });

  littb.filter("setMarkee", function() {
    return function(input, fromid, toid) {
      var wrapper;

      input = $(input);
      wrapper = $("<div>");
      if (fromid === toid) {
        $("#" + fromid, input).addClass("markee");
      } else {
        $("#" + fromid, input).nextUntil("#" + toid, "span").andSelf().add("#" + toid, input).addClass("markee");
      }
      wrapper.append(input);
      return wrapper.html();
    };
  });

}).call(this);
