littb = angular.module('littbApp')

studentCtrl = ($scope) ->
    $scope.list = [
            label: "Författarpresentation", url : ""
        ,
            label: "Orientering enskilda verk", url : ""
        ,
            label: "Orientering genrer", url : ""
        ,
            label: "Orientering tema/motiv", url : ""
        ,
            label: "Filmatiseringarna", url : ""
        
    ]




littb.config ($routeProvider) -> 
    whn = (route, obj) ->
        $routeProvider.when route, (_.extend {school : true}, obj)
    whn "/skola",
        title : "Skola"
        templateUrl : "views/school/school.html"
        controller : ($scope) ->


    whn "/skola/larare",
        title : "Lärare"
        breadcrumb : [
            "För lärare"
        ]
        templateUrl : "views/school/teachers.html"
    whn "/skola/gymnasium",
        title : "Gymnasium"
        breadcrumb : [
            "För elever",
            "Gymnasium"
        ]
        templateUrl : "views/school/gym.html"
        controller : studentCtrl
    whn "/skola/f-5",
        title : "F-5"
        templateUrl : "views/school/f_5.html"
    whn "/skola/6-9",
        title : "6-9"
        templateUrl : "views/school/6_9.html"


littb.directive "scFile", ($routeParams, $http, util, backend) ->
    template: """<div ng-bind-html-unsafe="doc"></div>"""
    replace : true
    link : ($scope, elem, attr) ->
        # $scope.doc = $routeParams.doc
        backend.getHtmlFile("/red/skola/" + attr.scFile or $routeParams.doc).success (data) ->
            c.log "data", $("body", data).get(0), typeof data
            $scope.doc =  util.getInnerXML $("body > .article > :not(.titlepage)", data).get(0)
            


