// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const littb = angular.module("littbApp")

littb.controller("MenuCtrl", function($scope, util) {
    c.log("MenuCtrl", $scope)
    const s = $scope
    if (s.$root.collapsed == null) {
        s.$root.collapsed = [true, true, true, true, true, true, true, true]
    }

    // util.setupHash s, [
    //     key : "collapsed"
    // ]

    s.unCollapse = function(index) {
        for (let i = 0; i < s.$root.collapsed.length; i++) {
            const __ = s.$root.collapsed[i]
            s.$root.collapsed[i] = true
        }
        return (s.$root.collapsed[index] = false)
    }

    return (s.collapseMenu = function(index) {
        c.log("collapseMenu", index)

        if (!s.$root.collapsed[index]) {
            s.$root.collapsed[index] = true
            return
        }

        for (let i = 0; i < s.$root.collapsed.length; i++) {
            const __ = s.$root.collapsed[i]
            s.$root.collapsed[i] = true
        }
        s.$root.collapsed[index] = false
        return c.log("s.$root.collapsed", s.$root.collapsed)
    })
})

littb.controller("lyrikTeacherCtrl", ($scope, util, $location) =>
    c.log("location", $location.url())
)

const getStudentCtrl = id => [
    "$scope",
    "$routeParams",
    "$rootElement",
    "$location",
    function($scope, $routeParams, $rootElement, $location) {
        // filenameFunc($scope, $routeParams)
        $scope.id = id
        const sfx = {
            "f-5": "F-5",
            "6-9": "6-9",
            gymnasium: "GY"
        }[id]
        $scope.defaultUrl = `Valkommen${sfx}.html`

        if (!_.str.endsWith($location.path(), ".html")) {
            $rootElement.addClass("school-startpage")
        } else {
            $rootElement.removeClass("school-startpage")
        }

        $scope.capitalize = str => str[0].toUpperCase() + str.slice(1)

        let works = [
            {
                label: "Drottningar i Kongahälla",
                url: `/skola/${id}/Drottningar${sfx}.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "En herrgårdssägen",
                url: `/skola/${id}/EnHerrgardssagen${sfx}.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Gösta Berlings saga",
                url: `/skola/${id}/GostaBerlingGY.html`,
                if: ["gymnasium"]
            },
            {
                label: "Herr Arnes penningar",
                url: `/skola/${id}/HerrArne${sfx}.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Nils Holgersson",
                url: `/skola/${id}/NilsHolgerssonUppgifter.html`,
                if: ["6-9"]
            },
            {
                label: "Osynliga länkar",
                url: `/skola/${id}/OsynligaLankar${sfx}.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Troll och människor",
                url: `/skola/${id}/TrollManniskor${sfx}.html`,
                if: ["6-9", "gymnasium"]
            }
        ]

        const workfilter = function(obj) {
            if (!obj.if) {
                return true
            }
            return Array.from(obj.if).includes(id)
        }

        works = _.filter(works, workfilter)

        return ($scope.list = _.filter(
            [
                {
                    label: "Termer och begrepp",
                    url: `/skola/${id}/TermerOchBegrepp.html`,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "Författarpresentation",
                    url: `/skola/${id}/Forfattarpresentation${sfx}.html`,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "I andra medier",
                    url: `/skola/${id}/SLiAndraMedier.html`,
                    sublist: [
                        {
                            label: "Uppgifter medier",
                            url: `/skola/${id}/UppgifterMedierGY.html`
                        }
                    ],
                    if: ["gymnasium"]
                },
                {
                    label: "Läshandledningar",
                    sublist: works,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "Den heliga natten",
                    url: "/forfattare/LagerlofS/titlar/DenHeligaNatten/sida/1/faksimil?storlek=1",
                    if: ["f-5"]
                }

                // ,
                //     label: "Orientering genrer",
                //     url : "/skola/#{id}/Genrer.html",
                //     sublist : [
                //         {label : "Romaner", url: "/skola/#{id}/Romaner.html"}
                //         {label : "Noveller", url: "/skola/#{id}/Noveller.html"}
                //     ]
                // ,
                // label: "Orientering tema/motiv", url : "/skola/#{id}/Genrer.html"
                // ,
                //     label: "I andra medier", url : "/skola/#{id}/SLiAndraMedier.html"
            ],
            workfilter
        ))
    }
]

const getLyrikStudentCtrl = id => [
    "$scope",
    "$routeParams",
    "$rootElement",
    "$location",
    function($scope, $routeParams, $rootElement, $location) {
        // filenameFunc($scope, $routeParams)
        $scope.id = id
        const sfx = {
            "f-5": "F-5",
            "6-9": "6-9",
            gymnasium: "gymnasium"
        }[id]
        // $scope.defaultUrl = "Valkommen#{sfx}.html"
        $scope.defaultUrl = "Valkommen.html"

        if (!_.str.endsWith($location.path(), ".html")) {
            $rootElement.addClass("school-startpage")
        } else {
            $rootElement.removeClass("school-startpage")
        }

        $scope.capitalize = str => str[0].toUpperCase() + str.slice(1)

        $scope.getOtherId = id =>
            ({
                "6-9": "gymnasium",
                gymnasium: "6-9"
            }[id])

        let works = [
            {
                label: "Andersson",
                url: `/skola/lyrik/elev/${sfx}/Andersson.html`,
                if: ["gymnasium"]
            },
            {
                label: "Boye",
                url: `/skola/lyrik/elev/${sfx}/Boye.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Fröding",
                url: `/skola/lyrik/elev/${sfx}/Froding.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Karlfeldt",
                url: `/skola/lyrik/elev/${sfx}/Karlfeldt.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Lenngren",
                url: `/skola/lyrik/elev/${sfx}/Lenngren.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Nordenflycht",
                url: `/skola/lyrik/elev/${sfx}/Nordenflycht.html`,
                if: ["gymnasium"]
            },
            {
                label: "Sjöberg",
                url: `/skola/lyrik/elev/${sfx}/Sjoberg.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Södergran",
                url: `/skola/lyrik/elev/${sfx}/Sodergran.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Övriga dikter",
                url: `/skola/lyrik/elev/${sfx}/OvrigaDikter.html`,
                if: ["6-9", "gymnasium"]
            },
            // {
            //     label : "Idéer",
            //     url : "/skola/lyrik/elev/#{sfx}/Ideer.html"
            //     if : ["6-9", "gymnasium"]
            // }
            // {
            //     label : "Lyrikens undergenrer",
            //     url : "/skola/lyrik/elev/#{sfx}/LyrikensUndergenrer.html"
            //     if : ["gymnasium"]
            // }
            {
                label: "Teman",
                url: `/skola/lyrik/elev/${sfx}/Teman.html`,
                if: ["6-9", "gymnasium"]
            },
            {
                label: "Visor och psalmer",
                url: `/skola/lyrik/elev/${sfx}/VisorOchPsalmer.html`,
                if: ["6-9"]
            }
        ]

        const workfilter = function(obj) {
            if (!obj.if) {
                return true
            }
            return Array.from(obj.if).includes(id)
        }

        works = _.filter(works, workfilter)

        return ($scope.list = _.filter(
            [
                {
                    label: "Välkommen",
                    url: `/skola/lyrik/elev/${id}/Valkommen.html`,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "Termer och begrepp",
                    url: `/skola/lyrik/elev/${id}/TermerOchBegrepp.html`,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "Litterära genrer",
                    url: `/skola/lyrik/elev/${id}/Genrer.html`,
                    if: ["6-9", "gymnasium"]
                },
                {
                    label: "Lyrikens undergenrer",
                    url: `/skola/lyrik/elev/${id}/LyrikensUndergenrer.html`,
                    if: ["6-9", "gymnasium"]
                },
                // ,
                //     label: "Hjälp",
                //     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
                //     if : ["6-9", "gymnasium"]
                {
                    label: "Läshandledningar",
                    sublist: works,
                    if: ["6-9", "gymnasium"]
                }
                // ,
                //     label: "Hjälp",
                //     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
                //     if : ["6-9", "gymnasium"]
                // ,
                //     label: "Hjälp",
                //     url : "/skola/lyrik/elev/#{id}/Hjalp.html"
                //     if : ["6-9", "gymnasium"]
            ],
            workfilter
        ))
    }
]

littb.config(function() {
    const router = new Router()

    const whn = (route, obj) => router.when(route, _.extend({ school: true }, obj))

    whn("/skola", {
        title: "Skola",
        templateUrl: require("../views/school/school.html")
    })
    // controller : getFileName

    // whn '/skola/larare/kontakt',
    //     templateUrl: 'views/contactForm.html'
    //     controller : 'contactFormCtrl'
    //     reloadOnSearch : false
    //     title : "Kontakt"
    whn(["/skola/lyrik/elev/gymnasium/:docurl", "/skola/lyrik/elev/gymnasium"], {
        title: "Lyrikskolan gymnasium",
        templateUrl: require("../views/school/lyrik_students.html"),
        controller: getLyrikStudentCtrl("gymnasium")
    })
    whn(["/skola/lyrik/elev/6-9/:docurl", "/skola/lyrik/elev/6-9"], {
        title: "Lyrikskolan 6-9",
        templateUrl: require("../views/school/lyrik_students.html"),
        controller: getLyrikStudentCtrl("6-9")
    })

    whn(
        [
            "/skola/lyrik/larare/:subsection/:docurl",
            "/skola/lyrik/larare/:docurl",
            "/skola/lyrik/larare"
        ],
        {
            title: "Lyrikskolan",
            templateUrl: require("../views/school/lyrik_teachers.html")
        }
    )

    whn(["/skola/larare/:docurl", "/skola/larare"], {
        title: "Lärare",
        // controller : getFileName
        templateUrl: require("../views/school/teachers.html")
    })

    whn(["/skola/f-5/:docurl", "/skola/f-5"], {
        title: "F-5",
        templateUrl: require("../views/school/students.html"),
        controller: getStudentCtrl("f-5")
    })
    whn(["/skola/6-9/:docurl", "/skola/6-9"], {
        title: "6-9",
        templateUrl: require("../views/school/students.html"),
        controller: getStudentCtrl("6-9")
    })
    whn(["/skola/gymnasium/:docurl", "/skola/gymnasium"], {
        title: "Gymnasium",
        templateUrl: require("../views/school/students.html"),
        controller: getStudentCtrl("gymnasium")
    })

    return whn("/skola/:docurl", {
        title: "Litteraturskolan",
        templateUrl: require("../views/school/school.html")
    })
})

littb.controller("fileCtrl", function(
    $scope,
    $routeParams,
    $location,
    $anchorScroll,
    $q,
    $timeout,
    $rootScope,
    $rootElement
) {
    $scope.docurl = $routeParams.docurl
    $scope.subsection = $routeParams.subsection

    // classlist = $rootElement.attr("class").split(" ")
    // classlist = _.filter classlist, (item) -> !_.str.startsWith("subpage-")

    // $rootElement.attr("class", classlist.join(" "))
    // $rootElement.addClass("subpage-" + id)

    const def = $q.defer()
    def.promise.then(() =>
        $timeout(
            function() {
                const a = $location.search().ankare
                if (a) {
                    if (!a || !$(`#${a}`).length) {
                        $(".content").scrollTop(0)
                        return
                    }
                    $(".content").scrollTop($(`#${a}`).position().top - 200)

                    return $(`#${a}`)
                        .parent()
                        .addClass("highlight")
                    // else if $rootScope.scrollPos[$location.path()]
                    //     $(window).scrollTop ($rootScope.scrollPos[$location.path()] or 0)
                } else {
                    return $anchorScroll()
                }
            },

            500
        )
    )

    return ($scope.fileDef = def)
})

littb.directive("scFile", ($routeParams, $location, $http, $compile, util, backend) => ({
    template: '<div class="file_parent"></div>',
    replace: true,
    link($scope, elem, attr) {
        // $scope.doc = $routeParams.doc

        let path
        const getLocationRoot = function() {
            if (_.startsWith($location.url(), "/skola/lyrik")) {
                return "/skola/lyrik/"
            } else {
                return "/skola/"
            }
        }

        // look for these under /skola, disregarding locationRoot above
        const generalTexts = [
            "ValkommenStartsida.html",
            "DidaktikOchMetodik.html",
            "DidaktikOchMetodik.html",
            "DidaktikOchMetodik2.html",
            "DidaktikOchMetodik3.html",
            "DidaktikOchMetodik4.html",
            "DidaktikOchMetodik5.html",
            "Litteraturlista.html",
            "TermerOchBegrepp.html",
            "Genrer.html",
            "Hjalp.html"
        ]

        const generalTextsForLyrikStudents = ["LyrikensUndergenrer.html"]

        $scope.setName = name => ($scope.currentName = name)

        const filename = attr.scFile || $routeParams.doc
        c.log("filename", filename)
        const section = $scope.$eval(attr.section)
        let subsection = $scope.$eval(attr.subsection)
        if (subsection === "gymnasium") {
            subsection = "gy"
        }

        if (Array.from(generalTexts).includes(filename)) {
            path = `/skola/${filename}`
        } else if (
            Array.from(generalTextsForLyrikStudents).includes(filename) &&
            _.startsWith($location.url(), "/skola/lyrik/elev")
        ) {
            path = `/skola/lyrik/elev_${filename}`
        } else {
            path = getLocationRoot() + _.compact([section, subsection, filename]).join("_")
        }

        // if section then filename = section + "/" + filename
        c.log("section", section, subsection, filename)

        $scope.path = path

        if (section === "larare" && subsection) {
            let actualPath = path.replace(/_/g, "/")
            actualPath = `/${actualPath}`
            c.log("actualPath", actualPath)
            // may God forgive me for this code
            const s = $(`a[href='${actualPath}']`)
                .parent()
                .parent()
                .scope()
            if (s) {
                safeApply(s, function(s) {
                    const index = $(`a[href='${actualPath}']`)
                        .parent()
                        .parent()
                        .attr("collapse")
                        .slice(-2, -1)
                    return s.$eval(`unCollapse(${index})`)
                })
            }
        }

        return backend.getHtmlFile(`/red${path}`).success(function(data) {
            const innerxmls = _.map($("body > div > :not(.titlepage)", data), util.getInnerXML)
            let innerxmlStr = innerxmls.join("\n")
            // bug fix for firefox
            innerxmlStr = innerxmlStr.replace(/#%21/g, "#!")

            const newElem = $compile(innerxmlStr)($scope)
            elem.html(newElem)

            return $scope.fileDef.resolve()
        })
    }
}))

littb.directive("sidebar", $timeout => ({
    restrict: "C",
    link($scope, elem, attr) {
        return $timeout(
            function() {
                const parent = $("<div class='sidebar_parent'></div>")
                const prev = elem.prev()
                elem.before(parent)
                c.log("elem", elem)
                return parent.append(prev, elem)
            },

            0
        )
    }
}))

// h = elem.prev().addClass("before_sidebar").height()
// elem.height(h)

littb.directive("activeStyle", ($routeParams, $timeout) => ({
    link($scope, elem, attr) {
        const selected = elem
            .find("a[href$='html']")
            .removeClass("selected")
            .filter(`[href$='${$scope.docurl}']`)
            .addClass("selected")
        c.log("selected", selected)

        return $timeout(() => $scope.setName(selected.last().text()), 0)
    }
}))

littb.directive("selectable", ($interpolate, $timeout) => ({
    link($scope, elem, attr) {
        const href = $interpolate(elem.attr("ng-href"))($scope)
        if (_.str.endsWith(href, $scope.docurl)) {
            elem.addClass("selected")
            // broken for some odd reason
            return $timeout(() => $scope.setName($interpolate(elem.text())($scope)), 0)
        }
    }
}))

littb.directive("ulink", $location => ({
    restrict: "C",
    link($scope, elem, attr) {
        const reg = new RegExp("/?#!/")
        if (attr.href.match(reg) && !_.str.startsWith(attr.href.replace(reg, ""), "skola")) {
            return elem.attr("target", "_blank")
        }
    }
}))
