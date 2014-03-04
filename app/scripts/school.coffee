littb = angular.module('littbApp')

    
littb.controller "MenuCtrl", ($scope) ->
    s = $scope
    s.$root.collapsed ?= [true, true, true, true, true]

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

        $scope.capitalize = (str) -> str[0].toUpperCase() + str[1..]

        works =  [
            {
                label : "Drottningar i Kongahälla", 
                url : "/#!/skola/#{id}/Drottningar#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "En herrgårdssägen", 
                url : "/#!/skola/#{id}/EnHerrgardssagen#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Gösta Berlings saga", 
                url : "/#!/skola/#{id}/GostaBerlingGY.html"
                if : ["gymnasium"]
            }
            {
                label : "Herr Arnes penningar", 
                url : "/#!/skola/#{id}/HerrArne#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Nils Holgersson", 
                url : "/#!/skola/#{id}/NilsHolgerssonUppgifter.html"
                if: ["6-9"]
            }
            {
                label : "Osynliga länkar", 
                url : "/#!/skola/#{id}/OsynligaLankar#{sfx}.html"
                if: ["6-9", "gymnasium"]
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
                label: "Termer och begrepp", 
                url : "/#!/skola/#{id}/LitteraturvetenskapligaBegrepp.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "Författarpresentation", 
                url : "/#!/skola/#{id}/Forfattarpresentation#{sfx}.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "I andra medier", 
                url : "/#!/skola/#{id}/SLiAndraMedier.html"
                sublist : [
                        label : "Uppgifter medier"
                        url : "/#!/skola/#{id}/UppgifterMedierGY.html"
                ]
                if : ["gymnasium"]
            ,
                label: "Läshandledningar", 
                sublist : works
                if : ["6-9", "gymnasium"]
            ,
                label: "Den heliga natten", 
                url : "/#!/forfattare/LagerlofS/titlar/DenHeligaNatten/sida/1/faksimil"
                if : ["f-5"]

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

    whn ["/skola/larare/:docurl", "/skola/larare"],
        title : "Lärare"
        # controller : getFileName
        templateUrl : "views/school/teachers.html"
    
    whn ["/skola/f-5/:docurl", "/skola/f-5"],
        title : "F-5"
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("f-5")
    whn ["/skola/6-9/:docurl", "/skola/6-9"],
        title : "6-9"
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("6-9")
    whn ["/skola/gymnasium/:docurl", "/skola/gymnasium"],
        title : "Gymnasium"
        templateUrl : "views/school/students.html"
        controller : getStudentCtrl("gymnasium")




littb.controller "fileCtrl", ($scope, $routeParams, $location, $anchorScroll, $q, $timeout, $rootScope) ->
    $scope.docurl = $routeParams.docurl
    def = $q.defer()
    def.promise.then () ->
        $timeout(() ->
            a = $location.search().ankare
            if a
                unless a and $("##{a}").length
                    $(window).scrollTop(0)
                    return
                $(window).scrollTop($("##{a}").offset().top)

                $("##{a}").parent().addClass("highlight")
            else if $rootScope.scrollPos[$location.path()]
                $(window).scrollTop ($rootScope.scrollPos[$location.path()] or 0)
            
            else
                $anchorScroll()

        , 500)
        
    
    $scope.fileDef = def


littb.directive "scFile", ($routeParams, $http, $compile, util, backend) ->
    template: """<div class="file_parent"></div>"""
    replace : true
    link : ($scope, elem, attr) ->
        # $scope.doc = $routeParams.doc
        $scope.setName = (name) ->
            $scope.currentName = name
        backend.getHtmlFile("/red/skola/" + attr.scFile or $routeParams.doc).success (data) ->
            innerxmls = _.map $("body > div > :not(.titlepage)", data), util.getInnerXML
            innerxmlStr = innerxmls.join("\n")
            # bug fix for firefox
            innerxmlStr = innerxmlStr.replace(/#%21/g, "#!")

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
        c.log "selected", selected

        
        $timeout(() ->
            $scope.setName selected.last().text()
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


littb.directive "ulink", ($location) ->
    restrict : "C"
    link : ($scope, elem, attr) ->
        reg = new RegExp "/?#!/"
        if (attr.href.match reg) and not _.str.startsWith attr.href.replace(reg, ""), "skola"
            elem.attr("target", "_blank")

