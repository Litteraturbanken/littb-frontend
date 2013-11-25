littb = angular.module('littbApp')

filenameFunc = ($scope, $routeParams) ->
    $scope.docurl = $routeParams.docurl

getFileName = ["$scope", "$routeParams", filenameFunc]


getStudentCtrl = (id) ->
    ["$scope", "$routeParams", ($scope, $routeParams) ->
        filenameFunc($scope, $routeParams)
        $scope.id = id
        sfx = {
            "f-5" : "F-5"
            "6-9" : "6-9"
            "gymnasium" : "GY"
        }[id]
        $scope.defaultUrl = "Valkommen#{sfx}.html"

        
        works =  [
            {
                label : "Drottningar i Kongahälla", 
                url : "/#!/skola/#{id}/Drottningar#{sfx}.html"
            }
            {
                label : "En herrgårdssägen", 
                url : "/#!/skola/#{id}/HerrArne#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Herr Arnes penningar", 
                url : "/#!/skola/#{id}/HerrArne#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Kejsarn av Portugallien", 
                url : "/#!/skola/#{id}/Kejsarn#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Mårbacka", 
                url : "/#!/skola/#{id}/Marbacka#{sfx}.html"
                if : ["f-5", "6-9"]
            }
            {
                label : "Osynliga Länkar", 
                url : "/#!/skola/#{id}/OsynligaLankar#{sfx}.html"
                if: ["f-5"]
            }
            {
                label : "Troll och människor", 
                url : "/#!/skola/#{id}/TrollManniskor#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }

            

        ]

    

        works = _.filter works, (obj) ->
            unless obj.if then return true
            return id in obj.if

        $scope.list = [
                label: "Författarpresentation", url : "/#!/skola/#{id}/ForfattarpresentationElever.html"
            ,
                label: "Orientering enskilda verk", 
                url : "", 
                sublist : works
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
        breadcrumb : [
                label : "För elever"
                url : ""
            ,
            "F-5"
        ]
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("f-5")
    whn ["/skola/6-9/:docurl", "/skola/6-9"],
        title : "6-9"
        breadcrumb : [
            "För elever",
            "6-9"
        ]
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("6-9")
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
            innerxmls = _.map $("body > div > :not(.titlepage)", data), util.getInnerXML
            $scope.doc = innerxmls.join("\n")
            $("[xmlns]", $scope.doc).attr("xmlns", null)


