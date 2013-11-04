littb = angular.module('littbApp')


littb.config ($routeProvider) -> 
    whn = (route, obj) ->
        $routeProvider.when route, (_.extend {school : true}, obj)
    whn "/skola",
        title : "Skola"
        templateUrl : "views/school/school.html"
        # controller : "presentationCtrl"
    whn "/skola/larare",
        title : "Lärare"
        templateUrl : "views/school/teachers.html"
    whn "/skola/gymnasium",
        title : "Gymnasium"
        templateUrl : "views/school/gym.html"
    whn "/skola/f-5",
        title : "F-5"
        templateUrl : "views/school/f_5.html"
    whn "/skola/6-9",
        title : "6-9"
        templateUrl : "views/school/6_9.html"

