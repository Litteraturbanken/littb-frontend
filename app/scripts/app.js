/** @format */

import collapse from "angular-ui-bootstrap/src/collapse"
import tooltip from "angular-ui-bootstrap/src/tooltip"
import modal from "angular-ui-bootstrap/src/modal"
import typeahead from "angular-ui-bootstrap/src/typeahead"
import popover from "angular-ui-bootstrap/src/popover"
import buttons from "angular-ui-bootstrap/src/buttons"
import dropdown from "angular-ui-bootstrap/src/dropdown"
import pagination from "angular-ui-bootstrap/src/pagination"

import startHtml from "../views/start.html?raw"
import aboutUrl from "../views/about.html?url"
import authorInfoUrl from "../views/authorInfo.html?url"
import dramawebUrl from "../views/dramaweb.html?url"
import idUrl from "../views/id.html?url"
import presentationsUrl from "../views/presentations.html?url"
import searchUrl from "../views/search.html?url"
import saLogoUrl from "../img/SA_logo_type.svg?url"

_.templateSettings = { interpolate: /\{\{(.+?)\}\}/g }

window.isDev = location.hostname !== "litteraturbanken.se"

let c = window.console

let routeStartCurrent = null
const encodedAngularUrlStatePattern = /%7B%7B(?:libraryState|searchState)\[[^\]]+\]%7D%7D/i
const decodedAngularUrlStatePattern = /\{\{(?:libraryState|searchState)\[[^\]]+\]\}\}/

let decodedPathname = null
try {
    decodedPathname = decodeURIComponent(location.pathname)
} catch (error) {
    decodedPathname = null
}

if (
    encodedAngularUrlStatePattern.test(location.pathname) ||
    (decodedPathname && decodedAngularUrlStatePattern.test(decodedPathname))
) {
    const normalizedPathname = (decodedPathname || location.pathname).replace(
        decodedAngularUrlStatePattern,
        ""
    )
    location.replace(`${location.origin}${normalizedPathname}${location.search}${location.hash}`)
}

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
            routeStartCurrent.$$route.pageId === "authorInfo" &&
            $route.current.$$route.pageId === "authorInfo" &&
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
                pageId: "start",
                template: "<page-start></page-start>",
                title: "Svenska klassiker som e-bok och epub"
            })
            .when("/presentationer", {
                title: "Presentationer",
                pageId: "presentation",
                template: "<presentations-page></presentations-page>"
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
                pageId: "about",
                template: "<about-page></about-page>",
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
                                    ? routeStartCurrent.$$route.pageId
                                    : undefined) === "about" &&
                                $route.current.$$route.pageId === "about"
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
                    pageId: "dramaweb",
                    template: "<dramaweb-page></dramaweb-page>",
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
                                    routeStartCurrent.$$route.pageId === "dramaweb" &&
                                    $route.current.$$route.pageId === "dramaweb"
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
                pageId: "search",
                template: "<search-page></search-page>",
                reloadOnSearch: false
            })
            .when("/bibliotek", {
                pageId: "library",
                template: "<library-page></library-page>",
                reloadOnSearch: false,
                title: "Biblioteket – Titlar och författare"
            })
            .when("/titlar", { redirectTo: "/bibliotek" })
            .when("/epub", {
                pageId: "library",
                template: "<library-page></library-page>",
                reloadOnSearch: false,
                title: "E-böcker för nedladdning",
                isEpub: true
            })
            // .when("/ljudarkivet", {
            //     templateUrl: require("../views/audiolist.html"),
            //     controller: "audioListCtrl",
            //     reloadOnSearch: false,
            //     title: "Litteraturbankens uppläsningar"
            // })
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
                    "/författare/LagerlöfS/omtexterna",
                    "/författare/LagerlöfS/omtexterna/:omtexternaDoc"
                ],
                {
                    pageId: "authorInfo",
                    template: "<author-info-page></author-info-page>",
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
                    "/författare/:author/omtexterna/:omtexternaDoc?"
                ],
                {
                    pageId: "authorInfo",
                    template: "<author-info-page></author-info-page>",
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
                pageId: "id",
                template: "<id-page></id-page>"
            })
            .when("/historik", {
                pageId: "history",
                template: "<history-page></history-page>",
                title: "History"
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

                                console.log("translate", translate)
                                return $q
                                    .all(translate)
                                    .then(([authorid, titleid]) => {
                                        console.log("🚀 ~ authorid, titleid:", authorid, titleid)
                                        segments[1] = "författare"
                                        segments[2] = authorid
                                        if (titleid) segments[4] = titleid
                                        $location.path(segments.join("/")).replace()
                                    })
                                    .catch(err => {
                                        console.error("Error in redirect", err)
                                        // Handle error if needed
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

littb.run(function (
    $rootScope,
    $location,
    $rootElement,
    $q,
    $timeout,
    bkgConf,
    SearchStateService,
    LibraryStateService,
    ReaderStateService,
    UIStateService
) {
    if (window.location.pathname == "/" && $location.hash()) {
        window.location.hash = ""
    }

    // $rootScope.libraryBkg = import(
    //     /* webpackChunkName: "library_bkg", webpackPrefetch: true */ "!!url-loader?limit=100000000!../img/biblioteket_bakgrund.jpg"
    // )
    $rootScope.SA_logo = saLogoUrl

    // In dev, bust cache every page load. Otherwise, use a YYMM stamp that rolls over each month
    // (e.g. 2604 for April 2026) so files like /red/css/startsida.css refresh monthly.
    // Compute once: must return a stable value on every call to avoid infinite digest loops
    // in templates that use it (e.g. `ng-include="'...' + cacheKiller()"`).
    const cacheKillerValue = window.isDev
        ? Math.random().toString(36).slice(2)
        : (new Date().getFullYear() % 100) * 100 + (new Date().getMonth() + 1)
    $rootScope.cacheKiller = () => cacheKillerValue
    $rootScope.searchTemplateUrl = searchUrl
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

    if (window.isDev) {
        const ng = window.angular
        const resolveEl = selOrEl => {
            if (!selOrEl) {
                return document.querySelector("#mainview")?.firstElementChild || document.body
            }
            if (typeof selOrEl === "string") {
                return document.querySelector(selOrEl)
            }
            return selOrEl
        }
        const ae = selOrEl => ng.element(resolveEl(selOrEl))

        // Console helpers (replacement for Batarang-style scope inspection).
        // Usage in devtools:
        // - Select an element in Elements tab, then run: $s($0), $iso($0), $ctrl($0)
        window.lbDebug = {
            el: resolveEl,
            ae,
            scope: selOrEl => ae(selOrEl).scope(),
            isolate: selOrEl => ae(selOrEl).isolateScope?.(),
            ctrl: (selOrEl, name) => {
                const el = ae(selOrEl)
                const iso = el.isolateScope?.()
                if (iso?.$ctrl) return iso.$ctrl
                if (name) return el.controller?.(name)
                return el.controller?.()
            },
            injector: selOrEl => ae(selOrEl).injector(),
            get: name => ae(document.body).injector().get(name),
            rootScope: () => $rootScope
        }

        // Short aliases.
        window.$s = window.lbDebug.scope
        window.$iso = window.lbDebug.isolate
        window.$ctrl = window.lbDebug.ctrl
        window.$inj = window.lbDebug.injector
        window.$get = window.lbDebug.get
    }

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
        if (newRoute.$$route?.pageId === "start") {
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
        } else if (newRoute.isEpub) {
            $rootElement.addClass("page-epub")
        } else if (newRoute.$$route?.pageId) {
            $rootElement.addClass(`page-${newRoute.$$route.pageId}`)
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
                $("html").css({
                    background: `url('${confObj.url}') no-repeat`
                })

                $("#confObjStyle").text($(confObj.style).text())
                if (confObj["class"]) {
                    for (className of confObj["class"].split(" ")) {
                        $("body").addClass(`bkg-${className}`)
                    }
                }
            } else {
                $("html").css({
                    "background-image": "none"
                })
            }
        })

        $rootScope.lastPageViews.push($location.path())
        if ($rootScope.lastPageViews.length > 10) {
            $rootScope.lastPageViews.shift()
        }
    })

    // Initialize state services (modern pattern)
    // Services are now available for injection in controllers

    // Backward compatibility layer: Keep $rootScope working during transition
    // TODO: Remove this after all components migrate to state services
    $rootScope._focus_mode = true
    $rootScope.searchState = {}
    $rootScope.libraryState = {}
    $rootScope.lastPageViews = []

    // Initialize service state from $rootScope
    ReaderStateService.setState({
        focusMode: $rootScope._focus_mode
    })

    SearchStateService.setState({
        queryparams: $rootScope.searchState.queryparams || null
    })

    LibraryStateService.setState({
        queryparams: $rootScope.libraryState.queryparams || null
    })

    UIStateService.setState({
        lastPageViews: $rootScope.lastPageViews
    })

    // Set up two-way sync for backward compatibility during migration
    // Watch service changes and update $rootScope (for legacy code)
    SearchStateService.on("stateChange", state => {
        $rootScope.searchState = { ...state }
    })

    LibraryStateService.on("stateChange", state => {
        $rootScope.libraryState = { ...state }
    })

    ReaderStateService.on("focusModeChange", enabled => {
        $rootScope._focus_mode = enabled
    })

    ReaderStateService.on("nightModeChange", enabled => {
        $rootScope._night_mode = enabled
    })

    UIStateService.on("pageViewAdded", path => {
        $rootScope.lastPageViews = [...UIStateService.getState().lastPageViews]
    })
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
                const wordSpans = $("span[id]", input)
                const fromIndex = wordSpans.index($(`#${fromid}`, input))
                const toIndex = wordSpans.index($(`#${toid}`, input))
                const markees =
                    fromIndex > -1 && toIndex >= fromIndex
                        ? wordSpans.slice(fromIndex, toIndex + 1)
                        : $(`#${fromid}`, input)
                              .nextUntil(`#${toid}`, "span")
                              .addBack()
                              .add(`#${toid}`, input)

                markees
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
            "ÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãääåçèéêëìíîïñòóôõöøùúûüýÿ".split(""),
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
