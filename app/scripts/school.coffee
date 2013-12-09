littb = angular.module('littbApp')

    


getStudentCtrl = (id) ->
    ["$scope", "$routeParams", ($scope, $routeParams) ->
        # filenameFunc($scope, $routeParams)
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
                url : "/#!/skola/#{id}/EnHerrgardssagen#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Herr Arnes penningar", 
                url : "/#!/skola/#{id}/HerrArne#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            # {
            #     label : "Kejsarn av Portugallien", 
            #     url : "/#!/skola/#{id}/Kejsarn#{sfx}.html"
            #     if : ["6-9", "gymnasium"]
            # }
            # {
            #     label : "Mårbackasviten", 
            #     url : "/#!/skola/#{id}/Marbacka#{sfx}.html"
            #     if : ["f-5", "6-9"]
            # }
            {
                label : "Osynliga Länkar", 
                url : "/#!/skola/#{id}/OsynligaLankar#{sfx}.html"
                if: ["6-9"]
            }
            {
                label : "Nils Holgersson", 
                url : "/#!/skola/#{id}/NilsHolgerssonUppgifter.html"
                if: ["6-9"]
            }
            {
                label : "Troll och människor", 
                url : "/#!/skola/#{id}/TrollManniskor#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
        ]

        workfilter = (obj) ->
            unless obj.if then return true
            return id in obj.if


        works = _.filter works, workfilter

        $scope.list = _.filter [
                label: "Författarpresentation", 
                url : "/#!/skola/#{id}/ForfattarpresentationElever.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "Uppgifter", 
                url : "", 
                sublist : works
            # ,
            #     label: "Orientering genrer", 
            #     url : "/#!/skola/#{id}/Genrer.html", 
            #     sublist : [
            #         {label : "Romaner", url: "/#!/skola/#{id}/Romaner.html"}
            #         {label : "Noveller", url: "/#!/skola/#{id}/Noveller.html"}
            #     ]
            # ,
                # label: "Orientering tema/motiv", url : "/#!/skola/#{id}/Genrer.html"
            # ,
            #     label: "I andra medier", url : "/#!/skola/#{id}/SLiAndraMedier.html"


        ], workfilter

    ]



littb.config () -> 
    router = new Router()


    whn = (route, obj) ->
        router.when route, (_.extend {school : true}, obj)

    whn "/skola",
        title : "Skola"
        templateUrl : "views/school/school.html"
        # controller : getFileName

    # whn "/skola/:page/LitteraturvetenskapligaBegrepp.html",
    #     title : "Begrepp"
    #     templateUrl

    whn ["/skola/larare/:docurl", "/skola/larare"],
        title : "Lärare"
        # breadcrumb : [
        #     label : "skola"
        #     url : "/#!/skola"
        # ,
        #     label : "För lärare"
        #     url : "/#!/skola/larare"
        # ]

        # controller : getFileName
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




littb.controller "fileCtrl", ($scope, $routeParams, $anchorScroll, $q, $timeout) ->
    $scope.docurl = $routeParams.docurl
    def = $q.defer()
    def.promise.then () ->
        $timeout(() ->
            $anchorScroll()
        , 500)
        
        
    $scope.fileDef = def


littb.directive "scFile", ($routeParams, $http, $compile, util, backend) ->
    template: """<div link-fix></div>"""
    replace : true
    link : ($scope, elem, attr) ->
        # $scope.doc = $routeParams.doc
        $scope.setName = (name) ->
            $scope.currentName = name
        backend.getHtmlFile("/red/skola/" + attr.scFile or $routeParams.doc).success (data) ->
            innerxmls = _.map $("body > div > :not(.titlepage)", data), util.getInnerXML
            innerxmlStr = innerxmls.join("\n")
            # innerxmlStr = $("[xmlns]", innerxmlStr).attr("xmlns", null)

            newElem = $compile(innerxmlStr)($scope)
            elem.html newElem

            $scope.fileDef.resolve()


littb.directive "sidebar", () ->
    restrict : "C"
    link : ($scope, elem, attr) ->
        h = elem.prev().addClass("before_sidebar").height()
        elem.height(h)



littb.directive "activeStyle", ($routeParams, $timeout) ->
    link : ($scope, elem, attr) ->
        selected = elem.find("a[href$='html']").removeClass("selected")
        .filter("[href$='#{$scope.docurl}']").addClass("selected")

        
        $timeout(() ->
            $scope.setName selected.text()
        , 0)



littb.directive "selectable", ($interpolate, $timeout) ->
    link : ($scope, elem, attr) ->
        href = ($interpolate elem.attr("ng-href"))($scope)
        if _.str.endsWith href, $scope.docurl
            elem.addClass("selected")
            # broken for some odd reason
            $timeout(() ->
                $scope.setName ($interpolate elem.text())($scope)
            , 0)

