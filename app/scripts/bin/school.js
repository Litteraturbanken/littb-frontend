(function() {
  var getFileName, getStudentCtrl, littb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb = angular.module('littbApp');

  getFileName = function($scope, $routeParams) {
    return $scope.docurl = $routeParams.docurl;
  };

  getStudentCtrl = function(id) {
    return function($scope, $routeParams) {
      var sfx, works;
      getFileName($scope, $routeParams);
      $scope.id = id;
      sfx = {
        "f-5": "F-5",
        "6-9": "6-9",
        "gymnasium": "GY"
      }[id];
      $scope.defaultUrl = "Valkommen" + sfx + ".html";
      c.log("id", id);
      works = [
        {
          label: "Drottningar i Kongahälla",
          url: "/#!/skola/" + id + "/Drottningar" + sfx + ".html"
        }, {
          label: "En herrgårdssägen",
          url: "/#!/skola/" + id + "/HerrArne" + sfx + ".html",
          "if": ["6-9", "gymnasium"]
        }, {
          label: "Herr Arnes penningar",
          url: "/#!/skola/" + id + "/HerrArne" + sfx + ".html",
          "if": ["6-9", "gymnasium"]
        }, {
          label: "Kejsarn av Portugallien",
          url: "/#!/skola/" + id + "/Kejsarn" + sfx + ".html",
          "if": ["6-9", "gymnasium"]
        }, {
          label: "Mårbacka",
          url: "/#!/skola/" + id + "/Marbacka" + sfx + ".html",
          "if": ["f-5", "6-9"]
        }, {
          label: "Osynliga Länkar",
          url: "/#!/skola/" + id + "/OsynligaLankar" + sfx + ".html",
          "if": ["f-5"]
        }, {
          label: "Troll och människor",
          url: "/#!/skola/" + id + "/TrollManniskor" + sfx + ".html",
          "if": ["6-9", "gymnasium"]
        }
      ];
      works = _.filter(works, function(obj) {
        if (!obj["if"]) {
          return true;
        }
        return __indexOf.call(obj["if"], id) >= 0;
      });
      return $scope.list = [
        {
          label: "Författarpresentation",
          url: "/#!/skola/" + id + "/ForfattarpresentationElever.html"
        }, {
          label: "Orientering enskilda verk",
          url: "",
          sublist: works
        }, {
          label: "Orientering genrer",
          url: "/#!/skola/" + id + "/Genrer.html",
          sublist: [
            {
              label: "Romaner",
              url: "/#!/skola/" + id + "/Romaner.html"
            }, {
              label: "Noveller",
              url: "/#!/skola/" + id + "/Noveller.html"
            }
          ]
        }, {
          label: "I andra medier",
          url: "/#!/skola/" + id + "/SLiAndraMedier.html"
        }
      ];
    };
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
      templateUrl: "views/school/school.html",
      controller: getFileName
    });
    whn(["/skola/larare/:docurl", "/skola/larare"], {
      title: "Lärare",
      breadcrumb: ["För lärare"],
      controller: getFileName,
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

  littb.directive("scFile", function($routeParams, $http, util, backend) {
    return {
      template: "<div ng-bind-html-unsafe=\"doc\"></div>",
      replace: true,
      link: function($scope, elem, attr) {
        return backend.getHtmlFile("/red/skola/" + attr.scFile || $routeParams.doc).success(function(data) {
          var innerxmls;
          innerxmls = _.map($("body > div > :not(.titlepage)", data), util.getInnerXML);
          $scope.doc = innerxmls.join("\n");
          return $("[xmlns]", $scope.doc).attr("xmlns", null);
        });
      }
    };
  });

}).call(this);

/*
//@ sourceMappingURL=school.js.map
*/