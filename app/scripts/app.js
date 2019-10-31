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

window.safeApply = function(scope, fn) {
    if (scope.$$phase || scope.$root.$$phase) {
        fn(scope)
    } else {
        scope.$apply(fn)
    }
}

$.fn.outerHTML = function() {
    return $(this)
        .clone()
        .wrap("<div></div>")
        .parent()
        .html()
}

function onRouteReject() {
    window.gtag("config", window.gtagID, { page_path: window.location.pathname })
}

_.templateSettings.interpolate = /{{([\s\S]+?)}}/g

const authorResolve = [
    "$q",
    "$routeParams",
    "$route",
    function($q, $routeParams, $route) {
        const def = $q.defer()
        c.log("resolve", $routeParams, $route)
        if (
            routeStartCurrent != null &&
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

window.getScope = () =>
    $("#mainview")
        .children()
        .scope()

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
    .config(function($routeProvider) {
        window.Router = class Router {
            when(route, obj) {
                if (!_.isArray(route)) {
                    route = [route]
                }
                for (let r of route) {
                    // if (r.split("/")[1] === "forfattare") {
                    //     const shortRoute = r
                    //         .replace(/^\/forfattare\//, "/f/")
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
                templateUrl: require("../views/start.html"),
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
                    function($scope, $routeParams, $http, util, $rootElement) {
                        c.log("presentation ctrl init")
                        $rootElement.addClass("page-presentation")
                        $rootElement.addClass("subpage")
                        $scope.$on("$destroy", () =>
                            // $rootElement.removeClass "page-presentation"
                            $rootElement.removeClass("subpage")
                        )

                        return $http
                            .get(`/red/presentationer/${$routeParams.folder}/${$routeParams.doc}`)
                            .success(function(data) {
                                $scope.doc = data
                                $scope.title = $(`<root>${data}</root>`)
                                    .find("h1")
                                    .text()
                                $scope.title = $scope.title
                                    .split(" ")
                                    .slice(0, 5)
                                    .join(" ")
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
                        function($q, $routeParams, $route, $rootScope) {
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
                        function($q, $routeParams, $route, $rootScope) {
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
                    function($scope, backend, $routeParams, $location) {
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
                    function($scope, backend, $routeParams, $location) {
                        let legacyurl = "forfattare/" + $routeParams.legacyurl

                        backend.getLegacyAuthor(legacyurl).then(auth => {
                            if (auth) {
                                let author = auth.author_id
                                $location.url(`/forfattare/${author}/dramawebben`).replace()
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
                            function($q, $routeParams, $route) {
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
            .when("/ljudochbild", {
                redirectTo: () => {
                    window.location = "https://litteraturbanken.se/ljudochbild"
                }
            })
            .when("/forfattare", { redirectTo: "/bibliotek" })

            .when(
                [
                    "/forfattare/LagerlofS",
                    "/forfattare/LagerlofS/titlar",
                    "/forfattare/LagerlofS/bibliografi",
                    "/forfattare/LagerlofS/presentation",
                    "/forfattare/LagerlofS/biblinfo",
                    "/forfattare/LagerlofS/jamfor",
                    "/forfattare/LagerlofS/omtexterna",
                    "/forfattare/LagerlofS/omtexterna/:omtexternaDoc"
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
                    "/forfattare/:author",
                    "/forfattare/:author/titlar",
                    "/forfattare/:author/dramawebben",
                    "/forfattare/:author/bibliografi",
                    "/forfattare/:author/presentation",
                    "/forfattare/:author/mer",
                    "/forfattare/:author/semer",
                    "/forfattare/:author/biblinfo",
                    "/forfattare/:author/jamfor",
                    "/forfattare/:author/omtexterna/:omtexternaDoc?"
                ],
                {
                    templateUrl: require("../views/authorInfo.html"),
                    controller: "authorInfoCtrl",
                    resolve: {
                        r: authorResolve
                    }
                }
            )
            .when("/forfattare/:author/titlar/:title/info/:mediatype", {
                redirectTo(routeParams, path, searchVars) {
                    return `/forfattare/${routeParams.author}/titlar/${routeParams.title}/${routeParams.mediatype}/?om-boken`
                }
            })
            .when(["/forfattare/:author/titlar/:title", "/forfattare/:author/titlar/:title/info"], {
                template: "<div></div>",
                controller: [
                    "$scope",
                    "backend",
                    "$routeParams",
                    "$location",
                    function($scope, backend, $routeParams, $location) {
                        const params = {
                            authorid: $routeParams.author,
                            titlepath: $routeParams.title
                        }
                        backend
                            .getSourceInfo(params)
                            .then(data =>
                                $location
                                    .url(
                                        `/forfattare/${$routeParams.author}/titlar/${$routeParams.title}/sida/${data.startpagename}/${data.mediatype}?om-boken`
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
                        `/forfattare/${routeParams.author}/titlar/${routeParams.title}/${
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
                        return `/forfattare/${routeParams.author}/titlar/${
                            routeParams.title
                        }/sida/${routeParams.pagename}/${{ e: "etext", f: "faksimil" }[
                            routeParams.mediatype
                        ] || routeParams.mediatype}`
                    }
                }
            )
            .when("/forfattare/:author/titlar/:title/:mediatype", {
                templateUrl: require("../views/reader.html"),
                controller: "readingCtrl",
                reloadOnSearch: false
            })
            .when(
                [
                    "/forfattare/:author/titlar/:title/sida/:pagename/:mediatype",
                    "/editor/:lbid/ix/:ix/:mediatype"
                ],
                {
                    templateUrl: require("../views/reader.html"),
                    controller: "readingCtrl",
                    reloadOnSearch: false,
                    resolve: {
                        r: [
                            "$q",
                            "$routeParams",
                            "$route",
                            "$rootScope",
                            function($q, $routeParams, $route, $rootScope) {
                                const def = $q.defer()

                                if (_.isEmpty($routeParams)) {
                                    def.resolve()
                                }
                                // return def.promise
                                // if we're only changing pages in the reader, don't change route

                                if (
                                    routeStartCurrent != null &&
                                    routeStartCurrent.$$route.controller === "readingCtrl" &&
                                    $route.current.controller === "readingCtrl"
                                ) {
                                    const cmp = ["author", "mediatype", "title"]
                                    if ("lbid" in $route.current.params) {
                                        cmp.push("lbid")
                                    }
                                    const current = _.pick($route.current.params, ...cmp)
                                    const prev = _.pick(routeStartCurrent.params, ...cmp)
                                    if (_.isEqual(current, prev)) {
                                        c.log("reject reader change")
                                        def.reject()
                                        onRouteReject()
                                    } else {
                                        def.resolve()
                                    }
                                } else {
                                    def.resolve()
                                }
                                return def.promise
                            }
                        ]
                    }
                }
            )

            .when("/kontakt", { redirectTo: "/om/kontakt" })
            .when(["/id/:id", "/id"], {
                templateURL: require("../views/id.html"),
                controller: "idCtrl"
            })
            .otherwise({
                template: `<p littb-err code='404' msg="Page not found.">Du har angett en adress som inte finns på Litteraturbanken.</p> 
                            <p>Använd browserns bakåtknapp för att komma tillbaka till 
                            sidan du var på innan, eller klicka på någon av 
                            länkarna till vänster.</p>`,
                title: "Sidan kan inte hittas"
            })
    })

littb.config(function($httpProvider, $locationProvider, $uibTooltipProvider) {
    $locationProvider.html5Mode(true)
    $locationProvider.hashPrefix("!")
    delete $httpProvider.defaults.headers.common["X-Requested-With"]
    $uibTooltipProvider.options({
        appendToBody: true
    })
})

littb.run(function($rootScope, $location, $rootElement, $q, $timeout, bkgConf) {
    c.log("run search params", $location.search())
    const CACHE_KILL = 12345 // change this value manually to kill all caches for files like /red/css/startsida.css
    $rootScope.cacheKiller = () => Math.round(new Date().getDate() / 5) + CACHE_KILL
    $rootScope.sourceInfo = require("../views/sourceInfo.html")
    const firstRoute = $q.defer()
    firstRoute.promise.then(() => $rootElement.addClass("ready").removeClass("not_ready"))

    $("body").on("click", "a[href^='/översättarlexikon/']", function() {
        window.location.pathname = $(this).attr("href")
        return false
    })

    $rootScope.getLogoUrl = function() {
        if ($rootScope.isSchool) {
            return "/skola"
        } else if ($rootScope.isSla) {
            return "/forfattare/LagerlofS"
        } else {
            return "/"
        }
    }

    // just in case the above deferred fails.
    $timeout(() => $rootElement.addClass("ready").removeClass("not_ready"), 1000)

    const stripClass = function(prefix) {
        const re = new RegExp(`\\ ?${prefix}\\-\\w+`, "g")

        let cls = $rootElement.attr("class")
        cls = cls.replace(re, "")
        $rootElement.attr("class", cls)
    }

    $rootScope._stripClass = stripClass

    $rootScope.goto = path => $location.url(path)

    $rootScope.gotoExternal = function(path, event) {
        event.preventDefault()
        event.stopPropagation()
        window.location = "https://litteraturbanken.se" + path
    }

    $rootScope.setTitle = function(title) {
        if (title) {
            title = title + " | Litteraturbanken"
        } else {
            title = "Litteraturbanken"
        }
        return $("title:first").text(title)
    }

    $rootScope.$on("$routeChangeStart", (event, next, current) => (routeStartCurrent = current))

    $rootScope.$on("$routeChangeSuccess", function(event, newRoute, prevRoute) {
        console.log("$routeChangeSuccess", window.location.pathname)
        window.gtag("config", window.gtagID, { page_path: window.location.pathname })

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

        if (newRoute.controller != null ? newRoute.controller.replace : undefined) {
            $rootElement.addClass(`page-${newRoute.controller.replace("Ctrl", "")}`)
        }

        if (newRoute.school) {
            $rootScope.isSchool = true
            $rootElement.addClass("site-school")
            className = _.last(newRoute.templateUrl.split("/")).split(".")[0]
            $rootElement.addClass(`page-${className}`)
        } else {
            delete $rootScope.isSchool
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
        bkgConf.get(path).then(function(confObj) {
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

    /*
    $rootScope.scrollPos = {} # scroll position of each view
    $(window).on "scroll", ->
        * false between $routeChangeStart and $routeChangeSuccess
        if $rootScope.okSaveScroll
            if $(window).scrollTop()
                $rootScope.scrollPos[$location.path()] = $(window).scrollTop()


    *console.log($rootScope.scrollPos);
    $rootScope.scrollClear = (path) ->
        $rootScope.scrollPos[path] = 0

    $rootScope.$on "$routeChangeStart", ->
        $rootScope.okSaveScroll = false

    $rootScope.$on "$routeChangeSuccess", ->
        $rootScope.okSaveScroll = true
        *     c.log "$routeChangeSuccess"
        *     $timeout (-> # wait for DOM, then restore scroll position
                
        *     ), 0

*/

    // $rootScope._showmenu_mobile = false;
    $rootScope._focus_mode = true
})

littb.filter(
    "setMarkee",
    () =>
        function(input, fromid, toid) {
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
                if (
                    $(`#${fromid}`, input)
                        .next()
                        .text() === "-"
                ) {
                    $(`#${fromid}`, input)
                        .next()
                        .next("br")
                        .next()
                        .addClass("markee")
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
        function(input) {
            if (!input) {
                return input
            }
            if (input.toString().length < 5) {
                return input
            }
            input = _.map(
                input
                    .toString()
                    .split("")
                    .reverse(),
                function(item, i) {
                    if (!i) {
                        return item
                    }
                    if (i % 3 === 0) {
                        return [item, " "]
                    }
                    return item
                }
            )

            return _.flatten(input.reverse()).join("")
        }
)

littb.filter("trust", $sce => input => $sce.trustAsHtml(input))

littb.filter("normalizeAuthor", function() {
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
    return function(author_id) {
        if (!author_id) {
            return
        }
        const ret = _.map(author_id.split(""), char => trans[char] || char).join("")

        return ret
    }
})
