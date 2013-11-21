littb = angular.module('littbApp')

getFileName = ($scope, $routeParams) ->
    $scope.docurl = $routeParams.docurl

getStudentCtrl = (id) ->
    ($scope, $routeParams) ->
        getFileName($scope, $routeParams)
        $scope.id = id
        $scope.defaultUrl = {
            "f-5" : "ValkommenAk5.html"
            "6-9" : "Valkommen6-9.html"
            "gymnasium" : "ValkommenGY.html"
        }[id]

        $scope.list = [
                label: "Författarpresentation", url : "/#!/skola/#{id}/ForfattarpresentationElever.html"
            ,
                label: "Orientering enskilda verk", url : "", sublist : [
                    # alla
                    {label : "Drottningar i Kongahälla", url : "DrottningarF-5.html"}
                    {label : "Mårbacka", url : "MarbackaF5.html"}
                ]
            ,
                label: "Orientering genrer", 
                url : "/#!/skola/#{id}/Genrer.html", 
                sublist : [
                    {label : "Romaner", url: "/#!/skola/#{id}/Romaner.html"}
                    {label : "Noveller", url: "/#!/skola/#{id}/Noveller.html"}
                ]
            # ,
                # label: "Orientering tema/motiv", url : "/#!/skola/#{id}/Genrer.html"
            ,
                label: "I andra medier", url : "/#!/skola/#{id}/SLiAndraMedier.html"


        ]



littb.config () -> 
    router = new Router()


    whn = (route, obj) ->
        router.when route, (_.extend {school : true}, obj)

    whn "/skola",
        title : "Skola"
        templateUrl : "views/school/school.html"
        controller : getFileName


    whn ["/skola/larare/:docurl", "/skola/larare"],
        title : "Lärare"
        breadcrumb : [
            "För lärare"
        ]

        controller : getFileName
        templateUrl : "views/school/teachers.html"
    
    whn ["/skola/f-5/:docurl", "/skola/f-5"],
        title : "F-5"
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("f-5")
    whn ["/skola/6-9/:docurl", "/skola/6-9"],
        title : "6-9"
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("6_9")
    whn ["/skola/gymnasium/:docurl", "/skola/gymnasium"],
        title : "Gymnasium"
        breadcrumb : [
            "För elever",
            "Gymnasium"
        ]
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("gymnasium")




littb.directive "scFile", ($routeParams, $http, util, backend) ->
    template: """<div ng-bind-html-unsafe="doc"></div>"""
    replace : true
    link : ($scope, elem, attr) ->
        # $scope.doc = $routeParams.doc
        backend.getHtmlFile("/red/skola/" + attr.scFile or $routeParams.doc).success (data) ->
            c.log "data", $("body", data).get(0), typeof data
            innerxmls = _.map $("body > div > :not(.titlepage)", data), util.getInnerXML
            $scope.doc = innerxmls.join("\n")
            $("[xmlns]", $scope.doc).attr("xmlns", null)


