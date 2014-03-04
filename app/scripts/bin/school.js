(function() {
  var getStudentCtrl, littb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb = angular.module('littbApp');

  littb.controller("MenuCtrl", function($scope) {
    var s, _base;
    s = $scope;
    return (_base = s.$root).collapsed != null ? (_base = s.$root).collapsed : _base.collapsed = [true, true, true, true, true];
  });

  getStudentCtrl = function(id) {
    return [
      "$scope", "$routeParams", function($scope, $routeParams) {
        var sfx, workfilter, works;
        $scope.id = id;
        sfx = {
          "f-5": "F-5",
          "6-9": "6-9",
          "gymnasium": "GY"
        }[id];
        $scope.defaultUrl = "Valkommen" + sfx + ".html";
        $scope.capitalize = function(str) {
          return str[0].toUpperCase() + str.slice(1);
        };
        works = [
          {
            label: "Drottningar i Kongahälla",
            url: "/#!/skola/" + id + "/Drottningar" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "En herrgårdssägen",
            url: "/#!/skola/" + id + "/EnHerrgardssagen" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Gösta Berlings saga",
            url: "/#!/skola/" + id + "/GostaBerlingGY.html",
            "if": ["gymnasium"]
          }, {
            label: "Herr Arnes penningar",
            url: "/#!/skola/" + id + "/HerrArne" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Nils Holgersson",
            url: "/#!/skola/" + id + "/NilsHolgerssonUppgifter.html",
            "if": ["6-9"]
          }, {
            label: "Osynliga länkar",
            url: "/#!/skola/" + id + "/OsynligaLankar" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Troll och människor",
            url: "/#!/skola/" + id + "/TrollManniskor" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }
        ];
        workfilter = function(obj) {
          if (!obj["if"]) {
            return true;
          }
          return __indexOf.call(obj["if"], id) >= 0;
        };
        works = _.filter(works, workfilter);
        return $scope.list = _.filter([
          {
            label: "Termer och begrepp",
            url: "/#!/skola/" + id + "/LitteraturvetenskapligaBegrepp.html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Författarpresentation",
            url: "/#!/skola/" + id + "/Forfattarpresentation" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "I andra medier",
            url: "/#!/skola/" + id + "/SLiAndraMedier.html",
            sublist: [
              {
                label: "Uppgifter medier",
                url: "/#!/skola/" + id + "/UppgifterMedierGY.html"
              }
            ],
            "if": ["gymnasium"]
          }, {
            label: "Läshandledningar",
            sublist: works,
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Den heliga natten",
            url: "/#!/forfattare/LagerlofS/titlar/DenHeligaNatten/sida/1/faksimil",
            "if": ["f-5"]
          }
        ], workfilter);
      }
    ];
  };

  littb.config(function() {
    var router, whn;
    router = new Router();
    whn = function(route, obj) {
      return router.when(route, _.extend({
        school: true
      }, obj));
    };
    whn("/skola", {
      title: "Skola",
      templateUrl: "views/school/school.html"
    });
    whn(["/skola/larare/:docurl", "/skola/larare"], {
      title: "Lärare",
      templateUrl: "views/school/teachers.html"
    });
    whn(["/skola/f-5/:docurl", "/skola/f-5"], {
      title: "F-5",
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("f-5")
    });
    whn(["/skola/6-9/:docurl", "/skola/6-9"], {
      title: "6-9",
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("6-9")
    });
    return whn(["/skola/gymnasium/:docurl", "/skola/gymnasium"], {
      title: "Gymnasium",
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("gymnasium")
    });
  });

  littb.controller("fileCtrl", function($scope, $routeParams, $location, $anchorScroll, $q, $timeout, $rootScope) {
    var def;
    $scope.docurl = $routeParams.docurl;
    def = $q.defer();
    def.promise.then(function() {
      return $timeout(function() {
        var a;
        a = $location.search().ankare;
        if (a) {
          if (!(a && $("#" + a).length)) {
            $(window).scrollTop(0);
            return;
          }
          $(window).scrollTop($("#" + a).offset().top);
          return $("#" + a).parent().addClass("highlight");
        } else if ($rootScope.scrollPos[$location.path()]) {
          return $(window).scrollTop($rootScope.scrollPos[$location.path()] || 0);
        } else {
          return $anchorScroll();
        }
      }, 500);
    });
    return $scope.fileDef = def;
  });

  littb.directive("scFile", function($routeParams, $http, $compile, util, backend) {
    return {
      template: "<div class=\"file_parent\"></div>",
      replace: true,
      link: function($scope, elem, attr) {
        $scope.setName = function(name) {
          return $scope.currentName = name;
        };
        return backend.getHtmlFile("/red/skola/" + attr.scFile || $routeParams.doc).success(function(data) {
          var innerxmlStr, innerxmls, newElem;
          innerxmls = _.map($("body > div > :not(.titlepage)", data), util.getInnerXML);
          innerxmlStr = innerxmls.join("\n");
          innerxmlStr = innerxmlStr.replace(/#%21/g, "#!");
          newElem = $compile(innerxmlStr)($scope);
          elem.html(newElem);
          return $scope.fileDef.resolve();
        });
      }
    };
  });

  littb.directive("sidebar", function() {
    return {
      restrict: "C",
      link: function($scope, elem, attr) {
        var h;
        h = elem.prev().addClass("before_sidebar").height();
        return elem.height(h);
      }
    };
  });

  littb.directive("activeStyle", function($routeParams, $timeout) {
    return {
      link: function($scope, elem, attr) {
        var selected;
        selected = elem.find("a[href$='html']").removeClass("selected").filter("[href$='" + $scope.docurl + "']").addClass("selected");
        c.log("selected", selected);
        return $timeout(function() {
          return $scope.setName(selected.last().text());
        }, 0);
      }
    };
  });

  littb.directive("selectable", function($interpolate, $timeout) {
    return {
      link: function($scope, elem, attr) {
        var href;
        href = ($interpolate(elem.attr("ng-href")))($scope);
        if (_.str.endsWith(href, $scope.docurl)) {
          elem.addClass("selected");
          return $timeout(function() {
            return $scope.setName(($interpolate(elem.text()))($scope));
          }, 0);
        }
      }
    };
  });

  littb.directive("ulink", function($location) {
    return {
      restrict: "C",
      link: function($scope, elem, attr) {
        var reg;
        reg = new RegExp("/?#!/");
        if ((attr.href.match(reg)) && !_.str.startsWith(attr.href.replace(reg, ""), "skola")) {
          return elem.attr("target", "_blank");
        }
      }
    };
  });

}).call(this);

/*
//@ sourceMappingURL=school.js.map
*/