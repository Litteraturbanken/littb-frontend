/** @format */

import collapse from "angular-ui-bootstrap/src/collapse"
import tooltip from "angular-ui-bootstrap/src/tooltip"
import modal from "angular-ui-bootstrap/src/modal"
import typeahead from "angular-ui-bootstrap/src/typeahead"
import popover from "angular-ui-bootstrap/src/popover"
import buttons from "angular-ui-bootstrap/src/buttons"
import dropdown from "angular-ui-bootstrap/src/dropdown"
import pagination from "angular-ui-bootstrap/src/pagination"

_.templateSettings = { interpolate: /\{\{(.+?)\}\}/g }

window.isDev = location.hostname !== "litteraturbanken.se"

let c = window.console

let routeStartCurrent = null

if (location.hash.length && _.startsWith(location.hash, "#!%2F")) {
    //rewrite for incoming #! with encoded url
    location.href = decodeURIComponent(location.href).replace("/#!/", "/")
} else if (location.hash.length && _.startsWith(location.hash, "#!/")) {
    //rewrite for incoming #!
    location.href = location.href.replace("/#!/", "/")
} else if (location.hash.length && location.hash[1] !== "!") {
    // rewrite for libris
    location.hash = _.str.lstrip(location.hash, "#")
}

window.safeApply = function (scope, fn) {
    if (scope.$$phase || scope.$root.$$phase) {
        fn(scope)
    } else {
        scope.$apply(fn)
    }
}

$.fn.outerHTML = function () {
    return $(this).clone().wrap("<div></div>").parent().html()
}

function onRouteReject() {
    window.gtag("config", window.gtagID, {
        page_path: window.location.pathname,
        anonymize_ip: true
    })
    _paq.push(["trackPageView"])
}

_.templateSettings.interpolate = /{{([\s\S]+?)}}/g

const authorResolve = [
    "$q",
    "$routeParams",
    "$route",
    function ($q, $routeParams, $route) {
        const def = $q.defer()
        c.log("resolve", $routeParams, $route)
        if (
            routeStartCurrent != null &&
            routeStartCurrent.$$route != null &&
            routeStartCurrent.$$route.controller === "authorInfoCtrl" &&
            $route.current.controller === "authorInfoCtrl" &&
            $route.current.params.author === $routeParams.author
        ) {
            def.reject()
            onRouteReject()
        } else {
            def.resolve()
        }
        return def.promise
    }
]

window.getScope = () => $("#mainview").children().scope()

window.littb = angular
    .module("littbApp", [
        "ngRoute",
        collapse,
        tooltip,
        modal,
        typeahead,
        popover,
        buttons,
        dropdown,
        pagination,
        "angularSpinner",
        "ngAnimate",
        "ngAria",
        "ngTouch",
        "ui.select2",
        "dibari.angular-ellipsis",
        "rzModule"
    ])
    .component("dynamicWrapper", {
        controller: [
            "$scope",
            "$compile",
            "$element",
            function widgetClientCtrl($scope, $compile, $element) {
                var self = this
                // self.$onInit = function () {
                //     renderWidget(self.name, self.payload)
                // }
                self.$onChanges = function () {
                    renderWidget(self.name, self.payload)
                }
                function renderWidget(name, payload) {
                    var template = "<" + name

                    if (payload) {
                        $scope.payload = payload
                        template += ' payload="payload"'
                    }

                    template += "></" + name + ">"
                    $element.append($compile(template)($scope))
                }
            }
        ],
        bindings: {
            name: "@",
            payload: "=?"
        }
    })
    // .service("lazyLoader", LazyLoader)
    .config(function ($routeProvider) {
        window.Router = class Router {
            when(route, obj) {
                if (!_.isArray(route)) {
                    route = [route]
                }
                for (let r of route) {
                    // if (r.split("/")[1] === "författare") {
                    //     const shortRoute = r
                    //         .replace(/^\/författare\//, "/f/")
                    //         .replace("/titlar/", "/t/")
                    //     $routeProvider.when(shortRoute, obj)
                    // }

                    $routeProvider.when(r, obj)
                }
                return this
            }
            otherwise() {
                return $routeProvider.otherwise.apply($routeProvider, arguments)
            }
        }

        const router = new window.Router()

        router
            // .when("", { redirectTo: "/start" })
            // .when("/", { redirectTo: "/start" })
            .when("/", {
                template: `<div>${require("!raw-loader!../views/start.html").default}</div>`,
                controller: "startCtrl",
                title: "Svenska klassiker som e-bok och epub"
            })
            .when("/presentationer", {
                title: "Presentationer",
                templateUrl: require("../views/presentations.html"),
                controller: "presentationCtrl"
            })
            .when("/p/:folder/:doc", {
                redirectTo(routeParams, path, searchVars) {
                    let folder = { s: "specialomraden", v: "vandringar" }[routeParams.folder]
                    console.log("folder", routeParams, folder)
                    return `/presentationer/${folder}/${routeParams.doc}`
                }
            })
            .when("/presentationer/:folder/:doc", {
                controller: [
                    "$scope",
                    "$routeParams",
                    "$http",
                    "util",
                    "$rootElement",
                    function ($scope, $routeParams, $http, util, $rootElement) {
                        c.log("presentation ctrl init")
                        $rootElement.addClass("page-presentation")
                        $rootElement.addClass("subpage")
                        $scope.$on("$destroy", () =>
                            // $rootElement.removeClass "page-presentation"
                            $rootElement.removeClass("subpage")
                        )

                        return $http
                            .get(`/red/presentationer/${$routeParams.folder}/${$routeParams.doc}`)
                            .then(function ({ data }) {
                                $scope.doc = data
                                $scope.title = $(`<root>${data}</root>`).find("h1").text()
                                $scope.title = $scope.title.split(" ").slice(0, 5).join(" ")
                                $scope.setTitle($scope.title)
                            })
                    }
                ],
                resolve: {
                    r: [
                        "$q",
                        "$routeParams",
                        "$route",
                        "$rootScope",
                        function ($q, $routeParams, $route, $rootScope) {
                            console.log("$routeParams", $routeParams, routeStartCurrent, $route)
                            const def = $q.defer()

                            if (
                                routeStartCurrent != null &&
                                routeStartCurrent.$$route === $route.current.$$route &&
                                $route.current.params.folder === $routeParams.folder &&
                                $route.current.params.doc === $routeParams.doc
                            ) {
                                c.log("reject about route")
                                def.reject()
                                onRouteReject()
                            } else {
                                def.resolve()
                            }
                            return def.promise
                        }
                    ]
                },
                template: `
                    <meta-desc>{{title}}</meta-desc>
                    <div class="content" style="position:relative;" ng-bind-html="doc | trust"></div>
                `
            })
            .when("/om/aktuellt", {
                redirectTo() {
                    return "/bibliotek?sort=nytillkommet"
                }
            })
            .when("/nytt", {
                redirectTo() {
                    return "/bibliotek?sort=nytillkommet"
                }
            })
            .when("/om/:page", {
                templateUrl: require("../views/about.html"),
                controller: "aboutCtrl",
                title: "Om LB",
                reloadOnSearch: false,

                resolve: {
                    r: [
                        "$q",
                        "$routeParams",
                        "$route",
                        "$rootScope",
                        function ($q, $routeParams, $route, $rootScope) {
                            const def = $q.defer()

                            if (
                                (routeStartCurrent != null
                                    ? routeStartCurrent.$$route.controller
                                    : undefined) === "aboutCtrl" &&
                                $route.current.controller === "aboutCtrl"
                            ) {
                                c.log("reject about route")
                                def.reject()
                                onRouteReject()
                            } else {
                                def.resolve()
                            }
                            return def.promise
                        }
                    ]
                }
            })

            .when("/hjalp", { redirectTo: "/om/hjalp" })
            .when("/dramawebben/pjas/:legacyurl", {
                template: "<div></div>",
                controller: [
                    "$scope",
                    "backend",
                    "$routeParams",
                    "$location",
                    function ($scope, backend, $routeParams, $location) {
                        let legacyurl = "/pjas/" + $routeParams.legacyurl
                        backend.getDramawebTitles(legacyurl).then(({ works }) => {
                            if (works.length) {
                                let work = works[0]
                                $location.url(work.mediatypes[0].url).replace()
                            } else {
                                $location.url("/dramawebben/pjäser/").replace()
                            }
                        })
                    }
                ]
            })
            .when("/dramawebben/forfattare/:legacyurl", {
                template: "<div></div>",
                controller: [
                    "$scope",
                    "backend",
                    "$routeParams",
                    "$location",
                    function ($scope, backend, $routeParams, $location) {
                        let legacyurl = "forfattare/" + $routeParams.legacyurl

                        backend.getLegacyAuthor(legacyurl).then(auth => {
                            if (auth) {
                                let author = auth.authorid
                                $location.url(`/författare/${author}/dramawebben`).replace()
                            } else {
                                $location.url("/dramawebben/pjäser/").replace()
                            }
                        })
                    }
                ]
            })
            .when(
                [
                    "/dramawebben",
                    "/dramawebben/pjäser",
                    "/dramawebben/författare",
                    "/dramawebben/om",
                    "/dramawebben/kringtexter"
                ],
                {
                    templateUrl: require("../views/dramaweb.html"),
                    controller: "dramawebCtrl",
                    reloadOnSearch: false,
                    resolve: {
                        r: [
                            "$q",
                            "$routeParams",
                            "$route",
                            function ($q, $routeParams, $route) {
                                const def = $q.defer()
                                if (
                                    routeStartCurrent != null &&
                                    routeStartCurrent.$$route.controller === "dramawebCtrl" &&
                                    $route.current.controller === "dramawebCtrl"
                                ) {
                                    def.reject()
                                    onRouteReject()
                                } else {
                                    def.resolve()
                                }
                                return def.promise
                            }
                        ]
                    }
                }
            )
            .when("/statistik", { redirectTo: "/om/statistik" })
            .when("/sok", { redirectTo: "/sök" })
            .when("/sök", {
                templateUrl: require("../views/search.html"),
                controller: "searchCtrl",
                reloadOnSearch: false
            })
            .when("/bibliotek", {
                templateUrl: require("../views/library.html"),
                controller: "libraryCtrl",
                reloadOnSearch: false,
                title: "Biblioteket – Titlar och författare"
            })
            .when("/titlar", { redirectTo: "/bibliotek" })
            .when("/epub", {
                templateUrl: require("../views/epubList.html"),
                controller: "epubListCtrl",
                reloadOnSearch: false,
                title: "Gratis böcker för nerladdning i epubformat"
            })
            .when("/ljudarkivet", {
                templateUrl: require("../views/audiolist.html"),
                controller: "audioListCtrl",
                reloadOnSearch: false,
                title: "Litteraturbankens uppläsningar"
            })
            .when(["/ljudochbild/", "/ljudochbild/:subadress*"], {
                redirectTo: $routeParams => {
                    window.location.href =
                        "https://litteraturbanken.se/ljudochbild/" + ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/översättarlexikon/", "/översättarlexikon/:subadress*"], {
                redirectTo: $routeParams => {
                    console.log("$routeParams", $routeParams)
                    window.location.href =
                        "https://litteraturbanken.se/översättarlexikon/" +
                        ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/litteraturkartan/", "/litteraturkartan/:subadress*"], {
                redirectTo: $routeParams => {
                    window.location.pathname = "/litteraturkartan/" + ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/bibliotekariesidor/", "/bibliotekariesidor/:subadress*"], {
                redirectTo: $routeParams => {
                    window.location.href =
                        "https://litteraturbanken.se/bibliotekariesidor/" +
                        ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/diktensmuseum/", "/diktensmuseum/:subadress*"], {
                redirectTo: $routeParams => {
                    window.location.href =
                        "https://litteraturbanken.se/diktensmuseum/" +
                        ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/skolan/", "/skolan/:subadress*"], {
                redirectTo: $routeParams => {
                    window.location.href =
                        "https://litteraturbanken.se/skolan/" + ($routeParams.subadress || "")
                    return "/#external"
                }
            })
            .when(["/forfattare"], { redirectTo: "/bibliotek" })

            .when(
                [
                    "/författare/LagerlöfS/jamfor",
                    "/författare/LagerlöfS/omtexterna",
                    "/författare/LagerlöfS/omtexterna/:omtexternaDoc"
                ],
                {
                    templateUrl: require("../views/authorInfo.html"),
                    controller: "authorInfoCtrl",
                    isSla: true,
                    reloadOnSearch: false,
                    resolve: {
                        r: authorResolve
                    }
                }
            )
            .when(
                [
                    "/författare/:author",
                    "/författare/:author/titlar",
                    "/författare/:author/dramawebben",
                    "/författare/:author/bibliografi",
                    "/författare/:author/presentation",
                    "/författare/:author/mer",
                    "/författare/:author/semer",
                    "/författare/:author/biblinfo",
                    "/författare/:author/jamfor",
                    "/författare/:author/omtexterna/:omtexternaDoc?"
                ],
                {
                    templateUrl: require("../views/authorInfo.html"),
                    controller: "authorInfoCtrl",
                    resolve: {
                        r: authorResolve
                    }
                }
            )
            .when("/författare/:author/titlar/:title/info/:mediatype", {
                redirectTo(routeParams, path, searchVars) {
                    return `/författare/${routeParams.author}/titlar/${routeParams.title}/${routeParams.mediatype}/?om-boken`
                }
            })
            .when(["/författare/:author/titlar/:title", "/författare/:author/titlar/:title/info"], {
                template: "<div></div>",
                controller: [
                    "$scope",
                    "backend",
                    "$routeParams",
                    "$location",
                    function ($scope, backend, $routeParams, $location) {
                        const params = {
                            authorid: $routeParams.author,
                            titlepath: $routeParams.title
                        }
                        backend
                            .getSourceInfo(params)
                            .then(data =>
                                $location
                                    .url(
                                        `/författare/${$routeParams.author}/titlar/${$routeParams.title}/sida/${data.startpagename}/${data.mediatype}?om-boken`
                                    )
                                    .replace()
                            )
                    }
                ]
            })

            .when("/f/:author/t/:title/:mediatype", {
                redirectTo(routeParams, path, searchVars) {
                    console.log("searchVars", path, searchVars)

                    let suffix = _.toPairs(searchVars)
                        .map(([key, val]) => {
                            if (val === true) {
                                return key
                            } else {
                                return key + "=" + val
                            }
                        })
                        .join("&")
                    return (
                        `/författare/${routeParams.author}/titlar/${routeParams.title}/${
                            { e: "etext", f: "faksimil" }[routeParams.mediatype]
                        }` + (suffix ? "?" + suffix : "")
                    )
                }
            })
            .when(
                [
                    "/f/:author/t/:title/sida/:pagename/:mediatype",
                    "/f/:author/t/:title/s/:pagename/:mediatype"
                ],
                {
                    redirectTo(routeParams, path, searchVars) {
                        return `/författare/${routeParams.author}/titlar/${
                            routeParams.title
                        }/sida/${routeParams.pagename}/${
                            { e: "etext", f: "faksimil" }[routeParams.mediatype] ||
                            routeParams.mediatype
                        }`
                    }
                }
            )
            // .when("/författare/:author/titlar/:title/:mediatype", {

            .when(
                [
                    "/författare/:author/titlar/:title/:mediatype",
                    "/författare/:author/titlar/:title/sida/:pagename/:mediatype",
                    "/editor/:lbid/ix/:ix/:mediatype"
                ],
                {
                    // templateUrl: require("../views/reader.html"),
                    template: `<dynamic-wrapper name="{{$resolve.lazy ? 'reading' : 'div'}}"></dynamic-wrapper>`,
                    // template: () => {
                    //     console.log("template func")
                    //     return `<div ng-if="$resolve.lazy"><reading></reading></div>`
                    // },
                    // controller: function ($scope) {
                    //     console.log("🚀 ~ file: app.js ~ line 507 ~ $scope", $scope)
                    // },
                    // controller: "readingCtrl",
                    reloadOnSearch: false,
                    reloadOnUrl: false,
                    isReader: true,
                    resolve: {
                        lazy: [
                            "$q",
                            "$injector",
                            function ($q, $injector) {
                                let deferred = $q.defer()
                                import(
                                    /* webpackChunkName: "reading_module" */ "./components/reader/readingModule.js"
                                ).then(moduleName => {
                                    $injector.loadNewModules([moduleName.default])
                                    deferred.resolve(true)
                                })
                                return deferred.promise
                            }
                        ]
                    }
                }
            )
            // .when(
            //     [
            //         "/författare/:author/titlar/:title/sida/:pagename/:mediatype",
            //         "/editor/:lbid/ix/:ix/:mediatype"
            //     ],
            //     {
            //         templateUrl: require("../views/reader.html"),
            //         controller: "readingCtrl",
            //         reloadOnSearch: false,
            //         reloadOnUrl: false,
            //         resolve: {
            //             r: [
            //                 "$q",
            //                 "$routeParams",
            //                 "$route",
            //                 "$rootScope",
            //                 function ($q, $routeParams, $route, $rootScope) {
            //                     const def = $q.defer()

            //                     if (_.isEmpty($routeParams)) {
            //                         def.resolve()
            //                     }
            //                     // return def.promise
            //                     // if we're only changing pages in the reader, don't change route

            //                     if (
            //                         routeStartCurrent != null &&
            //                         routeStartCurrent.$$route != null &&
            //                         routeStartCurrent.$$route.controller === "readingCtrl" &&
            //                         $route.current.controller === "readingCtrl"
            //                     ) {
            //                         const cmp = ["author", "mediatype", "title"]
            //                         if ("lbid" in $route.current.params) {
            //                             cmp.push("lbid")
            //                         }
            //                         const current = _.pick($route.current.params, ...cmp)
            //                         const prev = _.pick(routeStartCurrent.params, ...cmp)
            //                         if (_.isEqual(current, prev)) {
            //                             c.log("reject reader change")
            //                             def.reject()
            //                             onRouteReject()
            //                         } else {
            //                             def.resolve()
            //                         }
            //                     } else {
            //                         def.resolve()
            //                     }
            //                     return def.promise
            //                 }
            //             ]
            //         }
            //     }
            // )

            .when("/kontakt", { redirectTo: "/om/kontakt" })
            .when(["/id/:id", "/id"], {
                templateURL: require("../views/id.html"),
                controller: "idCtrl"
            })
            .otherwise({
                resolve: {
                    redirect: [
                        "$q",
                        "$location",
                        "backend",
                        function ($q, $location, backend) {
                            if ($location.path().startsWith("/forfattare")) {
                                // example urls we're rewriting here:
                                // "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype"
                                // /forfattare/HoijerB/titlar/DenPhilosophiskaConstruktionen/info

                                let segments = $location.path().split("/")
                                console.log("segments", segments)

                                // segments[4] = backend.normalizeTitleid(segments[4])
                                let translate = [backend.unNormalizeAuthorid(segments[2])]

                                if (segments[5] != "info" && segments[4] && segments[7]) {
                                    // 7 mediatype, 4 titleid
                                    translate.push(
                                        backend.unNormalizeTitleid(segments[7], segments[4])
                                    )
                                }

                                return $q.all(translate).then(([authorid, titleid]) => {
                                    segments[1] = "författare"
                                    segments[2] = authorid
                                    if (titleid) segments[4] = titleid
                                    $location.path(segments.join("/")).replace()
                                })
                            }
                        }
                    ]
                },
                // redirectTo(routeParams, path, searchVars) {
                //     console.log("otherwise", routeParams, path, searchVars)
                //     let injector = angular.injector(["ng"])
                //     let $http = injector.get("$http")

                // },
                template: `<p littb-err code='404' msg="Page not found.">Du har angett en adress som inte finns på Litteraturbanken.</p> 
                            <p>Använd webbläsarens bakåtknapp för att komma tillbaka till 
                            sidan du var på innan, eller klicka på någon av 
                            länkarna till vänster.</p>`,
                title: "Sidan kan inte hittas"
            })
    })

littb.config(function ($httpProvider, $locationProvider, $uibTooltipProvider) {
    $locationProvider.html5Mode(true)
    $locationProvider.hashPrefix("!")
    delete $httpProvider.defaults.headers.common["X-Requested-With"]
    $uibTooltipProvider.options({
        appendToBody: true
    })
})

littb.run(function ($rootScope, $location, $rootElement, $q, $timeout, bkgConf) {
    if (window.location.pathname == "/" && $location.hash()) {
        window.location.hash = ""
    }

    $rootScope.libraryBkg = import(
        /* webpackChunkName: "library_bkg", webpackPrefetch: true */ "!!url-loader?limit=100000000!../img/library.jpg"
    )
    $rootScope.SA_logo = require("../img/SA_logo_type.svg")

    const CACHE_KILL = 12345 // change this value manually to kill all caches for files like /red/css/startsida.css
    $rootScope.cacheKiller = () => Math.round(new Date().getDate() / 5) + CACHE_KILL
    $rootScope.sourceInfo = require("../views/sourceInfo.html")
    $rootScope.isDev = window.isDev
    const firstRoute = $q.defer()
    firstRoute.promise.then(() => $rootElement.addClass("ready").removeClass("not_ready"))

    // just in case the above deferred fails.
    $timeout(() => $rootElement.addClass("ready").removeClass("not_ready"), 1000)

    const stripClass = function (prefix) {
        const re = new RegExp(`\\ ?${prefix}\\-\\w+`, "g")

        let cls = $rootElement.attr("class")
        cls = cls.replace(re, "")
        $rootElement.attr("class", cls)
    }

    $rootScope._stripClass = stripClass

    $rootScope.goto = path => $location.url(path)

    $rootScope.gotoExternal = function (path, event) {
        event.preventDefault()
        event.stopPropagation()
        window.location = "https://litteraturbanken.se" + path
    }

    $rootScope.setTitle = function (title) {
        if (title) {
            title = title + " | Litteraturbanken"
        } else {
            title = "Litteraturbanken"
        }
        return $("title:first").text(title)
    }

    $rootScope.$on("$routeChangeStart", (event, next, current) => (routeStartCurrent = current))

    $rootScope.$on("$routeChangeSuccess", function (event, newRoute, prevRoute) {
        if (window.location.hash !== "#external") {
            window.gtag("config", window.gtagID, {
                page_path: window.location.pathname,
                anonymize_ip: true
            })
            // console.log("🚀 ~ file: app.js:734 ~ newRoute:", newRoute.$$route.title)
            _paq.push(["setCustomUrl", decodeURI(window.location.pathname)])
            _paq.push(["setDocumentTitle", newRoute.$$route.title])
            _paq.push(["trackPageView"])
        }

        let className
        if (newRoute.controller === "startCtrl") {
            $("title:first").text(`Litteraturbanken | ${newRoute.title}`)
        } else {
            $rootScope.setTitle(newRoute.title)
        }
        // is done automatically by directive on scope $destroy
        //if newRoute.loadedTemplateUrl != prevRoute?.loadedTemplateUrl
        //    $("#toolkit").html ""
        $rootScope.prevRoute = prevRoute

        // get rid of old class attr on body
        stripClass("page")
        stripClass("site")

        if (newRoute.isReader) {
            $rootElement.addClass(`page-reading`)
        } else if (newRoute.controller != null ? newRoute.controller.replace : undefined) {
            $rootElement.addClass(`page-${newRoute.controller.replace("Ctrl", "")}`)
        }

        if ($rootScope.dramasubpage) {
            $rootElement.addClass("site-drama")
            $rootElement.addClass("page-dramasubpage")
        }

        if (newRoute.isSla) {
            $rootScope.isSla = true
            $rootElement.addClass("site-sla")
            // className = (_.last newRoute.templateUrl.split("/")).split(".")[0]
            // $rootElement.addClass("page-" + className)
        } else {
            delete $rootScope.isSla
        }

        firstRoute.resolve()

        const path = $location.path()
        // alt = "/" + _.str.ltrim(path, "/").split("/")

        $("#confObjStyle").text("")
        stripClass("bkg")
        bkgConf.get(path).then(function (confObj) {
            c.log("bkgConf", confObj)
            if (confObj) {
                $("body").css({
                    background: `url('${confObj.url}') no-repeat`
                })

                $("#confObjStyle").text($(confObj.style).text())
                if (confObj["class"]) {
                    for (className of confObj["class"].split(" ")) {
                        $("body").addClass(`bkg-${className}`)
                    }
                }
            } else {
                $("body").css({
                    "background-image": "none"
                })
            }
        })
    })

    $rootScope._focus_mode = true
    $rootScope.searchState = {}
    $rootScope.libraryState = {}
})

littb.filter(
    "setMarkee",
    () =>
        function (input, fromid, toid) {
            if (!(fromid || toid)) {
                return input
            }
            input = $(input)
            const wrapper = $("<div>")
            if (fromid === toid) {
                const markee = $(`#${fromid}`, input).addClass("markee")
                if (navigator.userAgent.search("Firefox") > -1) {
                    markee.parent().css("position", "relative")
                }
                if ($(`#${fromid}`, input).next().text() === "-") {
                    $(`#${fromid}`, input).next().next("br").next().addClass("markee")
                }
            } else {
                $(`#${fromid}`, input)
                    .nextUntil(`#${toid}`, "span")
                    .andSelf()
                    .add(`#${toid}`, input)
                    .addClass("markee")
                    .filter(":odd")
                    .addClass("flip")
            }

            wrapper.append(input)
            return wrapper.html()
        }
)

littb.filter(
    "numberFmt",
    () =>
        function (input) {
            if (!input) {
                return input
            }
            if (input.toString().length < 5) {
                return input
            }
            input = _.map(input.toString().split("").reverse(), function (item, i) {
                if (!i) {
                    return item
                }
                if (i % 3 === 0) {
                    return [item, " "]
                }
                return item
            })

            return _.flatten(input.reverse()).join("")
        }
)

littb.filter("trust", $sce => input => $sce.trustAsHtml(input))

function normalizeAuthorFilter() {
    let trans = _.fromPairs(
        _.zip(
            "ÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöøùúûüýÿ".split(""),
            "AAAAACEEEEIIIINOOOOOOUUUUYaaaaaaceeeeiiiinoooooouuuuyy".split("")
        )
    )
    trans = _.extend(
        trans,
        _.fromPairs(
            _.zip(
                ["Æ", "æ", "Ð", "ð", "Þ", "þ", "ß", "Œ", "œ"],
                ["AE", "ae", "DH", "dh", "TH", "th", "ss", "OE", "oe"]
            )
        )
    )
    return function (authorid) {
        if (!authorid) {
            return
        }
        const ret = _.map(authorid.split(""), char => trans[char] || char).join("")

        return ret
    }
}

littb.filter("normalizeAuthor", normalizeAuthorFilter)
