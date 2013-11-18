(function() {
  'use strict';
  var routeStartCurrent,
    __slice = [].slice;

  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };

  routeStartCurrent = null;

  window.getScope = function() {
    return $("#mainview").children().scope();
  };

  window.littb = angular.module('littbApp', ["ui.bootstrap.typeahead", "ngMobile", "template/typeahead/typeahead.html", "ui.bootstrap.tooltip", "ui.bootstrap.modal", "template/modal/backdrop.html", "template/modal/window.html", "template/tooltip/tooltip-popup.html", "template/typeahead/typeahead-popup.html", "template/typeahead/typeahead-match.html", "angularSpinner"]).config(function($routeProvider) {
    var Router, router;
    Router = (function() {
      function Router() {}

      Router.prototype.when = function(route, obj) {
        var r, _i, _len;
        if (!_.isArray(route)) {
          route = [route];
        }
        for (_i = 0, _len = route.length; _i < _len; _i++) {
          r = route[_i];
          $routeProvider.when(r, obj);
        }
        return this;
      };

      Router.prototype.otherwise = function() {
        return $routeProvider.otherwise.apply($routeProvider, arguments);
      };

      return Router;

    })();
    router = new Router();
    return router.when('', {
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
      controller: [
        "$scope", "$routeParams", "$http", "util", function($scope, $routeParams, $http, util) {
          return $http.get("/red/presentationer/specialomraden/" + $routeParams.doc).success(function(data) {
            $scope.doc = data;
            $scope.title = $("<root>" + data + "</root>").find("h1").text();
            $scope.title = $scope.title.split(" ").slice(0, 5).join(" ");
            $scope.setTitle($scope.title);
            return $scope.appendCrumb($scope.title);
          });
        }
      ],
      template: '<meta-desc>{{title}}</meta-desc>\n<div style="position:relative;" ng-bind-html-unsafe="doc"></div>',
      breadcrumb: ["presentationer"]
    }).when('/om/aktuellt', {
      templateUrl: '/red/om/aktuellt/aktuellt.html',
      title: "Aktuellt",
      breadcrumb: ["aktuellt"]
    }).when('/om/rattigheter', {
      templateUrl: '/red/om/rattigheter/rattigheter.html',
      title: "Rättigheter",
      breadcrumb: ["rättigheter"]
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
      title: "Statistik",
      breadcrumb: ["statistik"]
    }).when('/sok', {
      templateUrl: 'views/search.html',
      controller: 'searchCtrl',
      reloadOnSearch: false,
      title: "Sök i verk",
      breadcrumb: ["sök"]
    }).when("/titlar", {
      templateUrl: "views/titleList.html",
      controller: "titleListCtrl",
      reloadOnSearch: false,
      title: "Titlar",
      breadcrumb: ["titlar"]
    }).when("/epub", {
      templateUrl: "views/epubList.html",
      controller: "epubListCtrl",
      reloadOnSearch: false,
      title: "Gratis titlar för nerladdning i epubformatet",
      breadcrumb: ["epub"]
    }).when("/forfattare", {
      templateUrl: "views/authorList.html",
      controller: "authorListCtrl",
      title: "Författare",
      reloadOnSearch: false,
      breadcrumb: ["författare"]
    }).when(["/forfattare/:author", "/forfattare/:author/titlar", "/forfattare/:author/bibliografi", "/forfattare/:author/presentation", "/forfattare/:author/semer"], {
      templateUrl: "views/authorInfo.html",
      controller: "authorInfoCtrl",
      breadcrumb: [
        {
          label: "författare",
          url: "#!/forfattare"
        }
      ],
      resolve: {
        r: [
          "$q", "$routeParams", "$route", function($q, $routeParams, $route) {
            var def;
            def = $q.defer();
            c.log("resolve", $routeParams, $route);
            if ((routeStartCurrent != null ? routeStartCurrent.controller : void 0) === "authorInfoCtrl" && $route.current.controller === "authorInfoCtrl" && $route.current.params.author === $routeParams.author) {
              def.reject();
            } else {
              def.resolve();
            }
            return def.promise;
          }
        ]
      }
    }).when("/forfattare/:author/titlar/:title/info", {
      templateUrl: "views/sourceInfo.html",
      controller: "sourceInfoCtrl",
      reloadOnSearch: false,
      title: "Verk",
      breadcrumb: ["författare"]
    }).when("/forfattare/:author/titlar/:title/info/:mediatype", {
      templateUrl: "views/sourceInfo.html",
      controller: "sourceInfoCtrl",
      reloadOnSearch: false,
      breadcrumb: ["författare"]
    }).when("/forfattare/:author/titlar/:title/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false,
      breadcrumb: ["författare"]
    }).when("/forfattare/:author/titlar/:title/sida/:pagename/:mediatype", {
      templateUrl: "views/reader.html",
      controller: "readingCtrl",
      reloadOnSearch: false,
      breadcrumb: ["författare"],
      resolve: {
        r: [
          "$q", "$routeParams", "$route", "$rootScope", function($q, $routeParams, $route, $rootScope) {
            var cmp, current, def, prev;
            def = $q.defer();
            if (_.isEmpty($routeParams)) {
              def.resolve();
            }
            if ((routeStartCurrent != null ? routeStartCurrent.controller : void 0) === "readingCtrl" && $route.current.controller === "readingCtrl") {
              cmp = ["author", "mediatype", "title"];
              current = _.pick.apply(_, [$route.current.params].concat(__slice.call(cmp)));
              prev = _.pick.apply(_, [routeStartCurrent.params].concat(__slice.call(cmp)));
              if (_.isEqual(current, prev)) {
                c.log("reject reader change");
                def.reject();
              } else {
                def.resolve();
              }
            } else {
              def.resolve();
            }
            return def.promise;
          }
        ]
      }
    }).when('/kontakt', {
      templateUrl: 'views/contactForm.html',
      controller: 'contactFormCtrl',
      reloadOnSearch: false,
      title: "Kontakt",
      breadcrumb: ["kontakt"]
    }).when("/id/:id", {
      template: "<div ng-class=\"{searching:!data}\"><h1>{{id}}</h1>\n    <div class=\"preloader\">Hämtar <span class=\"dots_blink\"></span></div>\n    <table class=\"table-striped\">\n    <tr ng-repeat=\"row in data | filter:{'itemAttrs.lbworkid' : id, 'itemAttrs.showtitle' : title}\">\n        <td>{{row.itemAttrs.lbworkid}}</td>\n        <td>\n            <a href=\"#!/forfattare/{{row.author.authorid}}/titlar/{{row.itemAttrs.titlepath.split('/')[0]}}/info\">{{row.itemAttrs.showtitle}}</a>\n        </td>\n        <td>\n            <span ng-repeat=\"type in row.mediatype\">\n            \n                <span ng-show=\"!$first\">:::</span>\n                <a href=\"#!/forfattare/{{row.author.authorid}}/titlar/{{row.itemAttrs.titlepath}}/info/{{type}}\">{{type}}</a>\n            </span>\n        </td>\n    </tr>\n    </table>\n</div>",
      controller: 'idCtrl'
    }).otherwise({
      template: "<p>Du har angett en adress som inte finns på Litteraturbanken.</p>                            <p>Använd browserns bakåtknapp för att komma tillbaka till                             sidan du var på innan, eller klicka på någon av                             länkarna till vänster.</p>",
      breadcrumb: ["fel"],
      title: "Sidan kan inte hittas"
    });
  });

  littb.config(function($httpProvider, $locationProvider, $tooltipProvider) {
    $locationProvider.hashPrefix('!');
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    return $tooltipProvider.options({
      appendToBody: true
    });
  });

  littb.run(function($rootScope, $location, $rootElement, $q, $timeout) {
    var firstRoute, normalizeUrl;
    firstRoute = $q.defer();
    firstRoute.promise.then(function() {
      return $rootElement.addClass("ready");
    });
    $timeout(function() {
      return $rootElement.addClass("ready");
    }, 1000);
    $rootScope.goto = function(path) {
      return $location.url(path);
    };
    $rootScope.setTitle = function(title) {
      if (title) {
        title = title + " | Litteraturbanken";
      } else {
        title = "Litteraturbanken";
      }
      return $("title:first").text(title);
    };
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
      return routeStartCurrent = current;
    });
    $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
      var cls, item, _ref;
      if (newRoute.controller === "startCtrl") {
        $("title:first").text("Litteraturbanken | " + newRoute.title);
      } else {
        $rootScope.setTitle(newRoute.title);
      }
      if (newRoute.loadedTemplateUrl !== (prevRoute != null ? prevRoute.loadedTemplateUrl : void 0)) {
        $("#toolkit").html("");
      }
      $rootScope.prevRoute = prevRoute;
      cls = $rootElement.attr("class");
      cls = cls.replace(/\ ?page\-\w+/g, "");
      $rootElement.attr("class", cls);
      if ((_ref = newRoute.controller) != null ? _ref.replace : void 0) {
        $rootElement.addClass("page-" + newRoute.controller.replace("Ctrl", ""));
      }
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
              url: "#!/" + normalizeUrl(item).join("")
            });
          }
        }
        return _results;
      })();
      return firstRoute.resolve();
    });
    $rootScope._showmenu_mobile = false;
    normalizeUrl = function(str) {
      var trans;
      trans = _.object(_.zip("åäö", "aao"));
      return _.map(str, function(letter) {
        return trans[letter.toLowerCase()] || letter;
      });
    };
    return $rootScope.appendCrumb = function(input) {
      var array;
      if (_.isArray(input)) {
        array = input;
      } else if (_.isString(input)) {
        array = [
          {
            label: input
          }
        ];
      } else if (_.isObject(input)) {
        array = [input];
      }
      return $rootScope.breadcrumb = [].concat($rootScope.breadcrumb, array);
    };
  });

  littb.filter("setMarkee", function() {
    return function(input, fromid, toid) {
      var wrapper;
      if (!(fromid || toid)) {
        return input;
      }
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

  littb.filter("numberFmt", function() {
    return function(input) {
      if (!input) {
        return input;
      }
      input = _.map(input.toString().split("").reverse(), function(item, i) {
        if (!i) {
          return item;
        }
        if (i % 3 === 0) {
          return [item, " "];
        }
        return item;
      });
      return _.flatten(input.reverse()).join("");
    };
  });

}).call(this);

/*
//@ sourceMappingURL=app.js.map
*/