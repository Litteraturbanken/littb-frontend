(function() {
  var getFileName, getStudentCtrl, littb;

  littb = angular.module('littbApp');

  getFileName = function($scope, $routeParams) {
    return $scope.docurl = $routeParams.docurl;
  };

  getStudentCtrl = function(id) {
    return function($scope, $routeParams) {
      getFileName($scope, $routeParams);
      $scope.id = id;
      $scope.defaultUrl = {
        "f-5": "ValkommenAk5.html",
        "6-9": "Valkommen6-9.html",
        "gymnasium": "ValkommenGY.html"
      }[id];
      return $scope.list = [
        {
          label: "Författarpresentation",
          url: "/#!/skola/" + id + "/ForfattarpresentationElever.html"
        }, {
          label: "Orientering enskilda verk",
          url: "",
          sublist: [
            {
              label: "Drottningar i Kongahälla",
              url: "DrottningarF-5.html"
            }, {
              label: "Mårbacka",
              url: "MarbackaF5.html"
            }
          ]
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
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("f-5")
    });
    whn(["/skola/6-9/:docurl", "/skola/6-9"], {
      title: "6-9",
      templateUrl: "views/school/students.html",
      controller: getStudentCtrl("6_9")
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
          c.log("data", $("body", data).get(0), typeof data);
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