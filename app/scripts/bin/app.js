(function() {
  'use strict';
  var routeStartCurrent,
    __slice = [].slice;

  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };

  routeStartCurrent = null;

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
    }).when("/forfattare/LagerlofS", {
      templateUrl: "views/sla/lagerlof.html",
      controller: "lagerlofCtrl",
      reloadOnSearch: false
    }).when("/forfattare/LagerlofS/biblinfo", {
      templateUrl: "views/sla/biblinfo.html",
      controller: "biblinfoCtrl",
      reloadOnSearch: false
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
        r: function($q, $routeParams, $route, $rootScope) {
          var cmp, current, def, prev;
          def = $q.defer();
          if (_.isEmpty($routeParams)) {
            def.resolve();
          }
          if (routeStartCurrent && $route.current.controller === "readingCtrl") {
            cmp = ["author", "mediatype", "title"];
            current = _.pick.apply(_, [$route.current.params].concat(__slice.call(cmp)));
            prev = _.pick.apply(_, [routeStartCurrent.params].concat(__slice.call(cmp)));
            if (_.isEqual(current, prev)) {
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
    }).otherwise({
      template: "<p>Du har angett en adress som inte finns på Litteraturbanken.</p>                            <p>Använd browserns bakåtknapp för att komma tillbaka till                             sidan du var på innan, eller klicka på någon av                             länkarna till vänster.</p>",
      breadcrumb: ["fel"],
      title: "Sidan kan inte hittas"
    });
  });

  littb.config(function($httpProvider, $locationProvider, $tooltipProvider) {
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    return $tooltipProvider.options({
      appendToBody: true
    });
  });

  littb.run(function($rootScope, $location, $rootElement) {
    var item, normalizeUrl;
    $rootScope.goto = function(path) {
      return $location.url(path);
    };
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
      return routeStartCurrent = current;
    });
    $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
      var classList, title, _ref;
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
        return $("body").addClass("page-" + newRoute.controller.replace("Ctrl", ""));
      }
    });
    normalizeUrl = function(str) {
      var trans;
      trans = _.object(_.zip("åäö", "aao"));
      return _.map(str, function(letter) {
        return trans[letter.toLowerCase()] || letter;
      });
    };
    $rootScope.breadcrumb = (function() {
      var _i, _len, _ref, _results;
      _ref = (typeof newRoute !== "undefined" && newRoute !== null ? newRoute.breadcrumb : void 0) || [];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
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

  littb.service("searchData", function(backend, $q) {
    var NUM_HITS, parseUrls;
    NUM_HITS = 20;
    this.data = [];
    this.total_hits = null;
    this.current = null;
    parseUrls = function(row) {
      var itm;
      itm = row.item;
      return ("/forfattare/" + itm.authorid + "/titlar/" + itm.titleidNew) + ("/sida/" + itm.pagename + "/" + itm.mediatype + "?" + (backend.getHitParams(itm)));
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
      return ([].splice.apply(this.data, [startIndex, data.kwic.length - startIndex + 1].concat(_ref = _.map(data.kwic, parseUrls))), _ref);
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

  littb.factory("throttle", function($timeout) {
    return function(func, wait, options) {
      var args, lastCalled, leading, result, thisArg, timeoutId, trailing, trailingCall;
      trailingCall = function() {
        var lastCalled, result, timeoutId;
        timeoutId = null;
        if (trailing) {
          lastCalled = new Date;
          return result = func.apply(thisArg, args);
        }
      };
      args = void 0;
      result = void 0;
      thisArg = void 0;
      timeoutId = void 0;
      lastCalled = 0;
      leading = true;
      trailing = true;
      if (options === false) {
        leading = false;
      } else if (_.isObject(options)) {
        leading = ("leading" in options ? options.leading : leading);
        trailing = ("trailing" in options ? options.trailing : trailing);
      }
      return function() {
        var now, remaining;
        now = new Date;
        if (!timeoutId && !leading) {
          lastCalled = now;
        }
        remaining = wait - (now - lastCalled);
        args = arguments;
        thisArg = this;
        if (remaining <= 0) {
          $timeout.cancel(timeoutId);
          timeoutId = null;
          lastCalled = now;
          result = func.apply(thisArg, args);
        } else {
          if (!timeoutId) {
            timeoutId = $timeout(trailingCall, remaining);
          }
        }
        return result;
      };
    };
  });

}).call(this);
