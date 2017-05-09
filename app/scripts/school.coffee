littb = angular.module('littbApp')

    
littb.controller "MenuCtrl", ($scope, util) ->
    c.log "MenuCtrl", $scope
    s = $scope
    s.$root.collapsed ?= [true, true, true, true, true, true, true, true]

    # util.setupHash s, [
    #     key : "collapsed"
    # ]

    s.unCollapse = (index) ->
        for __, i in s.$root.collapsed
            s.$root.collapsed[i] = true
        s.$root.collapsed[index] = false

    s.collapseMenu = (index) ->
        c.log "collapseMenu", index

        if not s.$root.collapsed[index]
            s.$root.collapsed[index] = true    
            return

        for __, i in s.$root.collapsed
            s.$root.collapsed[i] = true
        s.$root.collapsed[index] = false
        c.log "s.$root.collapsed", s.$root.collapsed
            
littb.controller "lyrikTeacherCtrl", ($scope, util, $location) ->
    c.log("location", $location.url())


getStudentCtrl = (id) ->
    ["$scope", "$routeParams", "$rootElement", "$location", ($scope, $routeParams, $rootElement, $location) ->
        # filenameFunc($scope, $routeParams)
        $scope.id = id
        sfx = {
            "f-5" : "F-5"
            "6-9" : "6-9"
            "gymnasium" : "GY"
        }[id]
        $scope.defaultUrl = "Valkommen#{sfx}.html"

        if !_.str.endsWith $location.path(), ".html"
            $rootElement.addClass "school-startpage"
        else
            $rootElement.removeClass "school-startpage"

        $scope.capitalize = (str) -> str[0].toUpperCase() + str[1..]

        works =  [
            {
                label : "Drottningar i Kongahälla", 
                url : "/skola/#{id}/Drottningar#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "En herrgårdssägen", 
                url : "/skola/#{id}/EnHerrgardssagen#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Gösta Berlings saga", 
                url : "/skola/#{id}/GostaBerlingGY.html"
                if : ["gymnasium"]
            }
            {
                label : "Herr Arnes penningar", 
                url : "/skola/#{id}/HerrArne#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Nils Holgersson", 
                url : "/skola/#{id}/NilsHolgerssonUppgifter.html"
                if: ["6-9"]
            }
            {
                label : "Osynliga länkar", 
                url : "/skola/#{id}/OsynligaLankar#{sfx}.html"
                if: ["6-9", "gymnasium"]
            }
            {
                label : "Troll och människor", 
                url : "/skola/#{id}/TrollManniskor#{sfx}.html"
                if : ["6-9", "gymnasium"]
            }
        ]

        workfilter = (obj) ->
            unless obj.if then return true
            return id in obj.if


        works = _.filter works, workfilter

        $scope.list = _.filter [
                label: "Termer och begrepp", 
                url : "/skola/#{id}/TermerOchBegrepp.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "Författarpresentation", 
                url : "/skola/#{id}/Forfattarpresentation#{sfx}.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "I andra medier", 
                url : "/skola/#{id}/SLiAndraMedier.html"
                sublist : [
                        label : "Uppgifter medier"
                        url : "/skola/#{id}/UppgifterMedierGY.html"
                ]
                if : ["gymnasium"]
            ,
                label: "Läshandledningar", 
                sublist : works
                if : ["6-9", "gymnasium"]
            ,
                label: "Den heliga natten", 
                url : "/forfattare/LagerlofS/titlar/DenHeligaNatten/sida/1/faksimil?storlek=1"
                if : ["f-5"]

            # ,
            #     label: "Orientering genrer", 
            #     url : "/skola/#{id}/Genrer.html", 
            #     sublist : [
            #         {label : "Romaner", url: "/skola/#{id}/Romaner.html"}
            #         {label : "Noveller", url: "/skola/#{id}/Noveller.html"}
            #     ]
            # ,
                # label: "Orientering tema/motiv", url : "/skola/#{id}/Genrer.html"
            # ,
            #     label: "I andra medier", url : "/skola/#{id}/SLiAndraMedier.html"


        ], workfilter

    ]


getLyrikStudentCtrl = (id) ->
    ["$scope", "$routeParams", "$rootElement", "$location", ($scope, $routeParams, $rootElement, $location) ->
        # filenameFunc($scope, $routeParams)
        $scope.id = id
        sfx = {
            "f-5" : "F-5"
            "6-9" : "6-9"
            "gymnasium" : "gymnasium"
        }[id]
        # $scope.defaultUrl = "Valkommen#{sfx}.html"
        $scope.defaultUrl = "Valkommen.html"

        if !_.str.endsWith $location.path(), ".html"
            $rootElement.addClass "school-startpage"
        else
            $rootElement.removeClass "school-startpage"

        $scope.capitalize = (str) -> str[0].toUpperCase() + str[1..]

        $scope.getOtherId = (id) ->
            {
                "6-9": "gymnasium"
                "gymnasium" : "6-9"
            }[id]

        works =  [
            {
                label : "Andersson", 
                url : "/skola/lyrik/elev/#{sfx}/Andersson.html"
                if : ["gymnasium"]
            }
            {
                label : "Boye", 
                url : "/skola/lyrik/elev/#{sfx}/Boye.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Fröding", 
                url : "/skola/lyrik/elev/#{sfx}/Froding.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Karlfeldt", 
                url : "/skola/lyrik/elev/#{sfx}/Karlfeldt.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Lenngren", 
                url : "/skola/lyrik/elev/#{sfx}/Lenngren.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Nordenflycht", 
                url : "/skola/lyrik/elev/#{sfx}/Nordenflycht.html"
                if : ["gymnasium"]
            }
            {
                label : "Sjöberg", 
                url : "/skola/lyrik/elev/#{sfx}/Sjoberg.html"
                if: ["6-9", "gymnasium"]
            }
            {
                label : "Södergran", 
                url : "/skola/lyrik/elev/#{sfx}/Sodergran.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Övriga dikter", 
                url : "/skola/lyrik/elev/#{sfx}/OvrigaDikter.html"
                if : ["6-9", "gymnasium"]
            }
            # {
            #     label : "Idéer", 
            #     url : "/skola/lyrik/elev/#{sfx}/Ideer.html"
            #     if : ["6-9", "gymnasium"]
            # }
            # {
            #     label : "Lyrikens undergenrer", 
            #     url : "/skola/lyrik/elev/#{sfx}/LyrikensUndergenrer.html"
            #     if : ["gymnasium"]
            # }
            {
                label : "Teman", 
                url : "/skola/lyrik/elev/#{sfx}/Teman.html"
                if : ["6-9", "gymnasium"]
            }
            {
                label : "Visor och psalmer", 
                url : "/skola/lyrik/elev/#{sfx}/VisorOchPsalmer.html"
                if : ["6-9"]
            }
        ]

        workfilter = (obj) ->
            unless obj.if then return true
            return id in obj.if


        works = _.filter works, workfilter

        $scope.list = _.filter [
                label: "Välkommen", 
                url : "/skola/lyrik/elev/#{id}/Valkommen.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "Termer och begrepp", 
                url : "/skola/lyrik/elev/#{id}/TermerOchBegrepp.html"
                if : ["6-9", "gymnasium"]
            ,
                label: "Litterära genrer", 
                url : "/skola/lyrik/elev/#{id}/Genrer.html"
                if : ["6-9", "gymnasium"]
            ,
                label : "Lyrikens undergenrer", 
                url : "/skola/lyrik/elev/#{id}/LyrikensUndergenrer.html"
                if : ["6-9", "gymnasium"]
            # ,
            #     label: "Hjälp", 
            #     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
            #     if : ["6-9", "gymnasium"]
            ,
                label: "Läshandledningar", 
                sublist : works
                if : ["6-9", "gymnasium"]
            # ,
            #     label: "Hjälp", 
            #     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
            #     if : ["6-9", "gymnasium"]
            # ,
            #     label: "Hjälp", 
            #     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
            #     if : ["6-9", "gymnasium"]


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

    # whn '/skola/larare/kontakt',
    #     templateUrl: 'views/contactForm.html'
    #     controller : 'contactFormCtrl'
    #     reloadOnSearch : false
    #     title : "Kontakt"
    #     breadcrumb : ["kontakt"]
    whn ["/skola/lyrik/elev/gymnasium/:docurl", "/skola/lyrik/elev/gymnasium"],
        title : "Lyrikskolan gymnasium"
        templateUrl : "views/school/lyrik_students.html"
        controller : getLyrikStudentCtrl("gymnasium")
    whn ["/skola/lyrik/elev/6-9/:docurl", "/skola/lyrik/elev/6-9"],
        title : "Lyrikskolan 6-9"
        templateUrl : "views/school/lyrik_students.html"
        controller : getLyrikStudentCtrl("6-9")

    whn ["/skola/lyrik/larare/:subsection/:docurl", "/skola/lyrik/larare/:docurl", "/skola/lyrik/larare"],
        title : "Lyrikskolan"
        templateUrl : "views/school/lyrik_teachers.html"

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


    whn "/skola/:docurl",
        title : "Litteraturskolan"
        templateUrl : "views/school/school.html"








littb.controller "fileCtrl", ($scope, $routeParams, $location, $anchorScroll, $q, $timeout, $rootScope, $rootElement) ->
    $scope.docurl = $routeParams.docurl
    $scope.subsection = $routeParams.subsection

    # classlist = $rootElement.attr("class").split(" ")
    # classlist = _.filter classlist, (item) -> !_.str.startsWith("subpage-")

    # $rootElement.attr("class", classlist.join(" "))
    # $rootElement.addClass("subpage-" + id)


    def = $q.defer()
    def.promise.then () ->
        $timeout(() ->
            a = $location.search().ankare
            if a
                unless a and $("##{a}").length
                    $(".content").scrollTop(0)
                    return
                $(".content").scrollTop($("##{a}").position().top - 200)

                $("##{a}").parent().addClass("highlight")
            # else if $rootScope.scrollPos[$location.path()]
            #     $(window).scrollTop ($rootScope.scrollPos[$location.path()] or 0)
            
            else
                $anchorScroll()

        , 500)
        
    
    $scope.fileDef = def


littb.directive "scFile", ($routeParams, $location, $http, $compile, util, backend) ->
    template: """<div class="file_parent"></div>"""
    replace : true
    link : ($scope, elem, attr) ->
        # $scope.doc = $routeParams.doc

        getLocationRoot = () ->
            if _.startsWith($location.url(), "/skola/lyrik")
                return "/skola/lyrik/"
            else 
                return "/skola/"


        # look for these under /skola, disregarding locationRoot above
        generalTexts = [
            "ValkommenStartsida.html"
            "DidaktikOchMetodik.html"
            "DidaktikOchMetodik.html"
            "DidaktikOchMetodik2.html"
            "DidaktikOchMetodik3.html"
            "DidaktikOchMetodik4.html"
            "DidaktikOchMetodik5.html"
            "Litteraturlista.html"
            "TermerOchBegrepp.html"
            "Genrer.html"
            "Hjalp.html"
        ]

        generalTextsForLyrikStudents = [
            "LyrikensUndergenrer.html"
        ]


        $scope.setName = (name) ->
            $scope.currentName = name

        filename = attr.scFile or $routeParams.doc
        c.log "filename", filename
        section = $scope.$eval attr.section
        subsection = $scope.$eval attr.subsection
        if subsection == "gymnasium" then subsection = "gy"

        if filename in generalTexts
            path = "/skola/" + filename
        else if filename in generalTextsForLyrikStudents and _.startsWith($location.url(), "/skola/lyrik/elev")
            path = "/skola/lyrik/elev_" + filename
        else
            path = getLocationRoot() + (_.compact [section, subsection, filename]).join("_")

        # if section then filename = section + "/" + filename
        c.log "section", section, subsection, filename

        $scope.path = path

        if section == "larare" and subsection

            actualPath = path.replace(/_/g, "/")
            actualPath = "/#!" + actualPath
            c.log "actualPath", actualPath
            # may God forgive me for this code
            s = $("a[href='#{actualPath}']").parent().parent().scope()
            if s
                safeApply s, (s) ->
                    index = $("a[href='#{actualPath}']").parent().parent().attr("collapse").slice(-2, -1)
                    s.$eval("unCollapse(#{index})")
            

        backend.getHtmlFile("/red" + path ).success (data) ->
            innerxmls = _.map $("body > div > :not(.titlepage)", data), util.getInnerXML
            innerxmlStr = innerxmls.join("\n")
            # bug fix for firefox
            innerxmlStr = innerxmlStr.replace(/#%21/g, "#!")

            newElem = $compile(innerxmlStr)($scope)
            elem.html newElem

            $scope.fileDef.resolve()


littb.directive "sidebar", ($timeout) ->
    restrict : "C"
    link : ($scope, elem, attr) ->
        $timeout( () ->
            parent = $("<div class='sidebar_parent'></div>")
            prev = elem.prev()
            elem.before(parent)
            c.log "elem", elem
            parent.append(prev, elem)
            
        , 0)

        # h = elem.prev().addClass("before_sidebar").height()
        # elem.height(h)



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

