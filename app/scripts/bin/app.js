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

  window.littb = angular.module('littbApp', ["ui.bootstrap.typeahead", "ngMobile", "template/typeahead/typeahead.html", "ui.bootstrap.modal", "ui.bootstrap.tooltip", "template/tooltip/tooltip-popup.html", "template/typeahead/typeahead-popup.html", "template/typeahead/typeahead-match.html"]).config(function($routeProvider) {
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
      controller: function($scope, $routeParams, $http, util) {
        return $http.get("/red/presentationer/specialomraden/" + $routeParams.doc).success(function(data) {
          var title;
          $scope.doc = data;
          title = $("<root>" + data + "</root>").find("h1").text();
          c.log("title", title);
          title = title.split(" ").slice(0, 5).join(" ");
          $scope.setTitle(title);
          return $scope.appendCrumb(title);
        });
      },
      template: '<div style="position:relative;" ng-bind-html-unsafe="doc"></div>',
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
      title: "Sök i verkstext",
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
    }).when("/forfattare/LagerlofS", {
      templateUrl: "views/sla/lagerlof.html",
      controller: "lagerlofCtrl",
      reloadOnSearch: false,
      breadcrumb: ["författare", "lagerlöf"]
    }).when("/forfattare/LagerlofS/biblinfo", {
      templateUrl: "views/sla/biblinfo.html",
      controller: "biblinfoCtrl",
      reloadOnSearch: false,
      breadcrumb: ["författare", "lagerlöf"]
    }).when(["/forfattare/:author", "/forfattare/:author/titlar"], {
      templateUrl: "views/authorInfo.html",
      controller: "authorInfoCtrl",
      breadcrumb: [
        {
          label: "författare",
          url: "#!/forfattare"
        }
      ],
      resolve: {
        r: function($q, $routeParams, $route) {
          var def;
          def = $q.defer();
          if ((routeStartCurrent != null ? routeStartCurrent.controller : void 0) === "authorInfoCtrl" && $route.current.controller === "authorInfoCtrl") {
            def.reject();
          } else {
            def.resolve();
          }
          return def.promise;
        }
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
        r: function($q, $routeParams, $route, $rootScope) {
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
        title = title + " | Litteraturbanken v.3";
      } else {
        title = "Litteraturbanken v.3";
      }
      return $("title:first").text(title);
    };
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
      return routeStartCurrent = current;
    });
    $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
      var cls, item, _ref;
      $rootScope.setTitle(newRoute.title);
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

  littb.service("searchData", function(backend, $q) {
    var NUM_HITS;
    NUM_HITS = 20;
    this.data = [];
    this.total_hits = null;
    this.current = null;
    this.parseUrls = function(row) {
      var author, itm, titleid;
      itm = row.item;
      author = itm.workauthor || itm.authorid;
      titleid = itm.titleidNew.split("/")[0];
      return ("/forfattare/" + author + "/titlar/" + titleid) + ("/sida/" + itm.pagename + "/" + itm.mediatype + "?" + (backend.getHitParams(itm)));
    };
    this.save = function(startIndex, currentIndex, input, search_args) {
      this.searchArgs = search_args;
      this.data = new Array(input.count);
      this.appendData(startIndex, input);
      this.total_hits = input.count;
      return this.current = currentIndex;
    };
    this.appendData = function(startIndex, data) {
      var _ref;
      return ([].splice.apply(this.data, [startIndex, data.kwic.length - startIndex + 1].concat(_ref = _.map(data.kwic, this.parseUrls))), _ref);
    };
    this.next = function() {
      this.current++;
      return this.search();
    };
    this.prev = function() {
      this.current--;
      return this.search();
    };
    this.search = function() {
      var args, current_page, def,
        _this = this;
      def = $q.defer();
      c.log("search", this.current);
      if (this.data[this.current] != null) {
        def.resolve(this.data[this.current]);
      } else {
        current_page = Math.floor(this.current / NUM_HITS);
        args = [].concat(this.searchArgs, [current_page + 1, NUM_HITS]);
        backend.searchWorks.apply(backend, args).then(function(data) {
          _this.appendData(_this.current, data);
          return def.resolve(_this.data[_this.current]);
        });
      }
      return def.promise;
    };
    return this.reset = function() {
      this.current = null;
      this.total_hits = null;
      this.data = [];
      return this.searchArgs = null;
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
