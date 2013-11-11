(function() {
  var littb, studentCtrl;

  littb = angular.module('littbApp');

  studentCtrl = function($scope) {
    return $scope.list = [
      {
        label: "Författarpresentation",
        url: ""
      }, {
        label: "Orientering enskilda verk",
        url: ""
      }, {
        label: "Orientering genrer",
        url: ""
      }, {
        label: "Orientering tema/motiv",
        url: ""
      }, {
        label: "Filmatiseringarna",
        url: ""
      }
    ];
  };

  littb.config(function($routeProvider) {
    var whn;
    whn = function(route, obj) {
      return $routeProvider.when(route, _.extend({
        school: true
      }, obj));
    };
    whn("/skola", {
      title: "Skola",
      templateUrl: "views/school/school.html"
    });
    whn("/skola/larare", {
      title: "Lärare",
      breadcrumb: ["För lärare"],
      templateUrl: "views/school/teachers.html"
    });
    whn("/skola/gymnasium", {
      title: "Gymnasium",
      breadcrumb: ["För elever", "Gymnasium"],
      templateUrl: "views/school/gym.html",
      controller: studentCtrl
    });
    whn("/skola/f-5", {
      title: "F-5",
      templateUrl: "views/school/f_5.html"
    });
    return whn("/skola/6-9", {
      title: "6-9",
      templateUrl: "views/school/6_9.html"
    });
  });

}).call(this);

/*
//@ sourceMappingURL=school.js.map
*/