(function() {
  var getStudentCtrl, littb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb = angular.module('littbApp');

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
        works = [
          {
            label: "Drottningar i Kongahälla",
            url: "/#!/skola/" + id + "/Drottningar" + sfx + ".html"
          }, {
            label: "En herrgårdssägen",
            url: "/#!/skola/" + id + "/EnHerrgardssagen" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Herr Arnes penningar",
            url: "/#!/skola/" + id + "/HerrArne" + sfx + ".html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Osynliga Länkar",
            url: "/#!/skola/" + id + "/OsynligaLankar" + sfx + ".html",
            "if": ["6-9"]
          }, {
            label: "Nils Holgersson",
            url: "/#!/skola/" + id + "/NilsHolgerssonUppgifter.html",
            "if": ["6-9"]
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
            label: "Författarpresentation",
            url: "/#!/skola/" + id + "/ForfattarpresentationElever.html",
            "if": ["6-9", "gymnasium"]
          }, {
            label: "Uppgifter",
            url: "",
            sublist: works
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
      breadcrumb: [
        {
          label: "För elever",
          url: ""
        }, "F-5"
      ],
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("f-5")
    });
    whn(["/skola/6-9/:docurl", "/skola/6-9"], {
      title: "6-9",
      breadcrumb: ["För elever", "6-9"],
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("6-9")
    });
    return whn(["/skola/gymnasium/:docurl", "/skola/gymnasium"], {
      title: "Gymnasium",
      breadcrumb: ["För elever", "Gymnasium"],
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("gymnasium")
    });
  });

  littb.controller("fileCtrl", function($scope, $routeParams, $anchorScroll, $q, $timeout) {
    var def;
    $scope.docurl = $routeParams.docurl;
    def = $q.defer();
    def.promise.then(function() {
      return $timeout(function() {
        return $anchorScroll();
      }, 500);
    });
    return $scope.fileDef = def;
  });

  littb.directive("scFile", function($routeParams, $http, $compile, util, backend) {
    return {
      template: "<div link-fix></div>",
      replace: true,
      link: function($scope, elem, attr) {
        $scope.setName = function(name) {
          return $scope.currentName = name;
        };
        return backend.getHtmlFile("/red/skola/" + attr.scFile || $routeParams.doc).success(function(data) {
          var innerxmlStr, innerxmls, newElem;
          innerxmls = _.map($("body > div > :not(.titlepage)", data), util.getInnerXML);
          innerxmlStr = innerxmls.join("\n");
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
        return $timeout(function() {
          return $scope.setName(selected.text());
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

}).call(this);

/*
//@ sourceMappingURL=school.js.map
*/