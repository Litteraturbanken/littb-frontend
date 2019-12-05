/** @format */

const littb = angular.module("littbApp")
littb.directive("submitBtn", () => ({
    replace: true,
    template: '<input type="image" class="submit_btn" ng-src="/bilder/LBsubmitknapp.jpeg">'
}))

littb.directive("toolkit", () => ({
    restrict: "EA",
    link(scope, element, attrs, controller) {
        let replaced
        const id = attrs.toolkitId || "toolkit" // default to id 'toolkit'
        if (!attrs.toolkitReplace) {
            $(`#${id}`).append(element)
        } else {
            replaced = $(`#${id} > *`).replaceWith(element)
        }
        scope.$on("$destroy", function() {
            if (attrs.toolkitReplace) {
                element.replaceWith(replaced)
            } else {
                element.remove()
            }
        })
    }
}))

littb.directive("css", () => ({
    restrict: "EA",
    scope: { css: "@", evalIf: "&if" },
    compile(elm, attrs) {
        elm.remove()
        return function(scope, iElement, iAttrs) {
            scope.$watch("css", function(val) {
                if (scope.evalIf()) {
                    $("#reading_css").attr("href", val)
                }
            })

            scope.$on("$destroy", () => $("#reading_css").attr("href", null))
        }
    }
}))

littb.directive("pagetitle", () => ({
    restrict: "EA",
    scope: { title: "@pagetitle" },
    compile(elm, attrs) {
        elm.remove()
        return (scope, iElement, iAttrs) => scope.$watch("title", val => $("title").text(val))
    }
}))

littb.directive("toBody", function($compile) {
    return {
        restrict: "A",
        compile(elm, attrs) {
            elm.remove()
            elm.attr("to-body", null)
            const wrapper = $("<div>").append(elm)
            const cmp = $compile(wrapper.html())

            return function(scope, iElement, iAttrs) {
                const newElem = cmp(scope)
                $("body").append(newElem)
                scope.$on("$destroy", () => newElem.remove())
            }
        }
    }
})

littb.directive("sortTriangles", () => ({
    template: `
    <div class="sort" ng-class="{disabled : !active}">
    
        <span ng-click="down()" class="label">Sortera</span>
        <span ng-click="down()" class="target disabled " ng-class="{'disabled' :!enabled[1]}">
            stigande
        </span> <span class="dash">/</span>
        <span ng-click="up()" class="target" ng-class="{'disabled' : !enabled[0]}">
            fallande
        </span> 
    </div>`,
    scope: { tuple: "=", val: "@" },
    link(scope, elem, iAttrs) {
        const s = scope
        const val = scope.$eval(scope.val)
        s.sorttuple = [val, 1]
        s.enabled = [true, true]
        const tupMatches = tup =>
            _.every(
                _.map(_.zip(val, tup), function([item1, item2]) {
                    return item1 === item2
                })
            )
        s.$watch("tuple", function([newval, dir]) {
            s.active = tupMatches(newval)
            c.log("active", s.active)
            s.enabled = [!dir, dir]
        })
        s.up = () => (s.tuple = [val, true])
        s.down = () => (s.tuple = [val, false])
    }
}))

littb.directive("square", () => ({
    template: "<div></div>",
    replace: false,
    // scope :
    // left : "=x"
    // top : "=y"
    // w : "=width"
    // h : "=height"
    link(scope, elm, attrs) {
        const s = scope
        const EXPAND_SIZE = 4
        const Y_OFFSET = -2
        let coors = _.pick(scope.obj, "x", "y", "width", "height")
        coors.top = coors.y
        coors.left = coors.x

        coors = _.fromPairs(
            _.map(coors, function(val, key) {
                val = Number(val)
                const expand = function(val) {
                    const n = ["top", "left"].includes(key) ? EXPAND_SIZE * -1 : EXPAND_SIZE * 2
                    return val + n
                }
                if (key === "top") {
                    val += Y_OFFSET
                }
                return [key, expand(val) + "px"]
            })
        )

        return elm.css(coors)
    }
}))

littb.directive("clickOutside", $document => ({
    restrict: "A",
    link(scope, elem, attr, ctrl) {
        let handler, handler1
        let skip = false
        elem.bind("click", function(e) {
            skip = true
        })

        $document.bind(
            "click",
            (handler = function(e) {
                if (!skip) {
                    scope.$eval(attr.clickOutside, { $event: e }) // event object can be accessed as $event, as with ng-click
                }
                skip = false
            })
        )

        elem.on("$destroy", function() {
            $document.off("click", handler)
        })
    }
}))

littb.directive("scrollTo", ($window, $timeout) =>
    // scope : scrollTo : "="
    ({
        link(scope, elem, attr) {
            scope.$watch(() => scope.$eval(elem.attr("scroll-to")), function(val) {
                if (!val) {
                    return
                }
                const target = elem.find(`#${val}`)
                if (!target.length) {
                    return
                }

                return $timeout(function() {
                    let offset = 0
                    // c.log "animate to offset", (scope.$eval elem.attr("offset"))
                    if (attr.offset) {
                        offset = Number(scope.$eval(elem.attr("offset")) || 0)
                        c.log("offset", offset)
                    }
                    return elem.animate({
                        scrollTop: elem.scrollTop() + target.position().top - offset
                    })
                    // elem.scrollTop()
                })
            })
        }
    })
)

littb.directive("collapsing", ($window, $timeout) => ({
    scope: {
        collapsing: "=",
        index: "="
    },
    link(scope, elem, attr) {
        return scope.$watch(() => elem.find(".in.collapsing").height(), function(val) {
            scope.collapsing = val
            if (elem.find(".in.collapsing").scope()) {
                return elem
                    .find(".in.collapsing")
                    .scope()
                    .$eval("$index")
            }
        })
    }
}))

littb.directive("soArticle", ($compile, $location, $window) => ({
    scope: {
        soArticle: "="
    },
    link(scope, elem, attrs) {
        scope.$watch("soArticle", function(val) {
            const newElem = $compile(_.str.trim(val))(scope)
            return elem.html(newElem)
        })

        scope.lex = () => $location.search().lex

        return scope.$watch("lex()", function(val) {
            if (!val) {
                return
            }
            if (elem.find(`#${val}`).length) {
                elem.find(`#${val}`)
                    .get(0)
                    .scrollIntoView()
            }
        })
    }
}))

littb.directive("hvord", (backend, $location) => ({
    restrict: "E",
    link(scope, elem, attr) {
        elem.on("click", function() {
            const id = elem.prev("hvtag").text()
            if (id) {
                // $location.search("lex", id)
                c.log("click id", id)
                scope.$emit("search_dict", null, id, true)
            } else {
                // $location.search("lex", null)
                c.log("click not id", elem)
                scope.$emit("search_dict", _.str.trim(elem.text(), null, false))
            }
        })
    }
}))

littb.directive("selectionSniffer", $window => ({
    link(scope, elem, attr) {
        // box = $("<div><i class='icon-search'></i></div>").addClass("search_dict")
        //     .appendTo("body").hide()
        let box = $()

        $("html").on("click", () => box.remove())
        $("body").on("mousedown", ".search_dict", function() {
            c.log("search click!", $window.getSelection().toString())
            scope.$emit("search_dict", _.str.trim($window.getSelection().toString()))
            return false
        })

        scope.$on("$destroy", function() {
            $("body").off("mousedown", ".search_dict")
            return $("body > .search_dict").remove()
        })

        const showIndicator = function(target) {
            // return false # CURRENTLY S.O. IS DISABLED
            c.log("showIndicator", target)
            box.remove()

            box = $(`<div><i class='fa fa-search glass'></i> 
                        <i class='fa fa-search shadow'></i> 
                        <span class='circle'></span></div>`)
                .addClass("search_dict")
                .appendTo("body")
                .position({
                    my: "left bottom",
                    at: "right top",
                    of: target
                })
        }

        // we use debounce to account for doubleclick
        elem.on(
            "mouseup",
            _.debounce(function(event) {
                if (!$window.getSelection) return
                const sel = $window.getSelection().toString()
                const isOneWord = sel && !Array.from(_.str.trim(sel)).includes(" ")
                c.log("isOneWord", sel, isOneWord, event.target)

                if (
                    isOneWord &&
                    ($(event.target).is(".w") ||
                        $(event.target)
                            .parent()
                            .is(".w"))
                ) {
                    showIndicator(event.target)
                }
            }, 500)
        )
    }
}))

// littb.directive 'nprogress', () ->
//     scope :
//         nprogress = "="
//     link: (scope, elem, attr) ->
//         NProgress.configure({ parent :  elem});
//         scope.$watch "nprogress", (val) ->
//             if val
//                 NProgress.start()
//             else
//                 nProgress.done()

littb.directive("alertPopup", ($rootElement, $timeout, $rootScope) => ({
    scope: {},
    restrict: "EA",
    template: `
        <div ng-show="show" class="alert_popup">{{text}}</div>
    `,
    replace: true,
    link(scope, elem, attr) {
        scope.text = null
        scope.show = false
        $rootScope.$on("notify", function(event, text) {
            scope.text = text
            scope.show = true
            $timeout(() => (scope.show = false), 4000)
        })
    }
}))

littb.directive("focusable", () => ({
    link(scope, elem, attr) {
        const evtsuffix = attr.focusable ? `.${attr.focusable}` : ""
        scope.$on(`focus${evtsuffix}`, function() {
            c.log("focus!")
            elem.focus()
        })

        scope.$on("blur", function() {
            c.log("blur!", elem)
            setTimeout(() => elem.blur(), 100)
        })
    }
}))

littb.directive("typeaheadTrigger", () => ({
    require: ["ngModel"],
    link(scope, element, attr, ctrls) {
        scope.$on("open", (event, value) => ctrls[0].$setViewValue(value))
    }
}))

littb.directive("metaDesc", $interpolate => ({
    restrict: "EA",
    link(scope, elm, attrs) {
        elm.remove()
        const inpl = $interpolate(elm.text())
        const wtch = scope.$watch(
            s => inpl(s),
            val => $("meta[name=description]").attr("content", val)
        )

        scope.$on("$destroy", () => wtch())
    }
}))

littb.directive("pageTitle", $interpolate => ({
    restrict: "EA",
    link(scope, elm, attrs) {
        elm.remove()
        const inpl = $interpolate(elm.text())
        const wtch = scope.$watch(s => inpl(s), function(val) {
            if (val) {
                val += " | Litteraturbanken"
            }
            $("head > title").text(val || "Litteraturbanken")
        })

        scope.$on("$destroy", () => wtch())
    }
}))

littb.directive("sticky", () => ({
    link(scope, element, attrs) {
        element.origTop = element.offset().top
        $(document).on("scroll.sticky", function(evt) {
            //c.log "scroll", $(document).scrollTop(), element.origTop
            if ($(document).scrollTop() >= element.origTop) {
                return element.addClass("sticky")
            } else {
                return element.removeClass("sticky")
            }
        })

        return scope.$on("$destroy", () => $(document).off("scroll.sticky"))
    }
}))

littb.directive("popper", $rootElement => ({
    scope: {
        popper: "@"
    },
    link(scope, elem, attrs) {
        console.log("popper link")
        const popup = elem.next()
        popup.appendTo("body").hide()
        const closePopup = () => popup.hide()

        // popup.on "click", (event) ->
        //     closePopup()
        //     return false

        // scope.$watch (() -> popup.is(":visible")), (isVisible) ->
        //     popper =

        elem.on("click", function(event) {
            console.log("elem click")
            if (popup.is(":visible")) {
                closePopup()
            } else {
                popup.show()
            }

            const pos = {
                my: attrs.my || "right top",
                at: attrs.at || "bottom right",
                of: elem
            }
            if (scope.offset) {
                pos.offset = scope.offset
            }

            popup.position(pos)

            return false
        })

        $rootElement.on("click", () => closePopup())

        return scope.$on(`popper.open.${scope.popper}`, function() {
            c.log("on popper open", elem)
            return setTimeout(() => elem.click(), 0)
        })
    }
}))

// littb.directive 'kwicWord', ->
//     replace: true
//     template : """<span class="word" ng-class="getClassObj(wd)">{{::wd.word}} </span>
//                 """ #ng-click="wordClick($event, wd, sentence)"
//     link : (scope, element) ->
//         scope.getClassObj = (wd) ->
//             output =
//                 reading_match : wd._match
//                 punct : wd._punct
//                 match_sentence : wd._matchSentence

//             for struct in (wd._struct or [])
//                 output["struct_" + struct] = true

//             for struct in (wd._open or [])
//                 output["open_" + struct] = true
//             for struct in (wd._close or [])
//                 output["close_" + struct] = true

//             return (x for [x, y] in _.toPairs output when y).join " "

littb.directive("insert", () => (scope, elem, attr) =>
    scope.watch("doc", function() {
        c.log("insert doc", scope.doc)
        return elem.html(scope.doc || "")
    })
)

littb.directive("downloadBtn", () => ({
    restrict: "AE",
    replace: true,
    scope: {
        file: "="
    },
    template: `
        <a class="download" download ng-href="{{getUrl(file)}}" target="_blank">
            <i class="fa fa-file-text-o "></i>
            <span class="">Ladda ner som PDF</span> 
        </a>
    `,
    link(scope, elem, attr) {
        c.log("attr", attr)
        scope.getUrl = function(filename) {
            if (attr.isLyrik != null) {
                const segments = filename.split("/")
                segments.splice(-1, 0, "pdf")
                return `/red${segments.join("/").replace(".html", ".pdf")}`
            } else {
                return `/red/skola/pdf/${filename.replace(".html", ".pdf")}`
            }
        }
    }
}))

littb.directive("schoolAffix", $window => ({
    restrict: "EA",
    link(scope, elem, attrs) {
        const detectScrollDir = function(fDown, fUp) {
            let lastScrollTop = 0
            const delta = 5
            const f = function(event) {
                const st = $(this).scrollTop()
                if (Math.abs(lastScrollTop - st) <= delta) {
                    return
                }
                if (st > lastScrollTop) {
                    if (typeof fDown === "function") {
                        fDown()
                    }
                } else {
                    if (typeof fUp === "function") {
                        fUp()
                    }
                }
                lastScrollTop = st
            }
            $(window).on("scroll", f)

            return () => $(window).off("scroll", f)
        }

        const reset = function() {
            elem.removeClass("affix-disable")
            return elem.css({
                top: "",
                left: ""
            })
        }

        const detach = function(height) {
            const isTooTall = height > $(window).height()
            const hasScrolledFromTop = window.scrollY > $(".nav_sidebar").offset().top

            if (isTooTall && hasScrolledFromTop && !elem.is(".affix-disable")) {
                elem.addClass("affix-disable")
                return elem.css({
                    top: window.scrollY + 5,
                    left: $(".nav_sidebar").offset().left
                })
            }
        }

        const killDetect = detectScrollDir(() => detach(elem.height()), reset)

        scope.$on("$destroy", () => killDetect())

        const onWatch = height => detach(height)

        scope.getHeight = () => elem.height()
        scope.$watch("getHeight()", onWatch)

        onWatch()

        return elem.affix({
            offset: {
                top: elem.offset().top
            }
        })
    }
}))
littb.directive("affix", $window => ({
    restrict: "EA",
    link(scope, elem, attrs) {
        return elem.affix({
            offset: {
                top: elem.offset().top
            }
        })
    }
}))

littb.directive("setClass", () => ({
    link(scope, elem, attrs) {
        const obj = scope.$eval(attrs.setClass)
        for (let key in obj) {
            const val = obj[key]
            if (val) {
                elem.addClass(key)
            } else {
                elem.removeClass(key)
            }
        }
    }
}))

littb.directive("footnotePopup", ($window, $location, $compile) => ({
    restrict: "EA",
    scope: {
        mapping: "=footnotePopup"
    },
    link(s, elem, attrs) {
        let popupTmpl = `
        <div class="note_popover popover bottom" ng-show="show">
            <div class="arrow"></div>
            <div class="popover-content" ng-bind-html="content | trust"></div>
        </div>
        `

        popupTmpl = $compile(popupTmpl)(s)
            .appendTo("body")
            .click(function(event) {
                const target = $(event.target)
                event.preventDefault()

                if (target.is("sup")) {
                    const id = _.str.lstrip(target.parent().attr("href"), "#")
                    const scrollTarget = elem.find(`.footnotes .footnote[id='ftn.${id}']`)
                    $location.search("upp", $("body").prop("scrollTop"))
                    return $("body").animate({ scrollTop: scrollTarget.position().top })
                } else {
                    return event.stopPropagation()
                }
            })
            .show()
        s.show = false

        return elem.on("click", "a.footnote[href^=#ftn]", function(event) {
            if (s.show) {
                $(document).click()
                return false
            }
            event.preventDefault()
            event.stopPropagation()

            const target = $(event.currentTarget)
            const id = _.str.lstrip(target.attr("href"), "#")

            s.$apply(function() {
                s.content = s.mapping[id]
                s.show = true
            })

            popupTmpl.position({
                my: "middle top+10px",
                at: "bottom middle",
                of: target
            })

            $(document).one("click", () => s.$apply(() => (s.show = false)))
        })
    }
}))

littb.directive("bigText", () => ({
    link(scope, elem, attr) {
        const obj = scope.$eval(attr.bigText)
        const fac = scope.$eval(attr.fac)
        elem.text(obj.wd)
        let size = 4
        elem.css("font-size", size + "px")
        const w = fac * Number(obj.w)
        // c.log "elem.width()", elem.width()
        if (elem.width()) {
            while (elem.width() < w) {
                size += 10
                elem.css("font-size", size + "px")
                if (size > 300) {
                    break
                }
            }

            while (elem.width() > w) {
                size -= 1
                elem.css("font-size", size + "px")
                if (size < 5) {
                    break
                }
            }
        }

        // elem.css("font-size", size * (1.2) + "px")
        elem.attr("id", obj.wid)
        return elem.text(obj.wd + " ")
    }
}))

littb.directive("top", () => ({
    scope: {
        top: "="
    },
    link(scope, elem, attr) {
        return elem.on("click", () =>
            safeApply(scope, () => {
                if (elem.position()) {
                    scope.top = elem.position().top
                }
            })
        )
    }
}))

littb.directive("height", () => ({
    restrict: "A",
    scope: {
        height: "="
    },
    link(scope, elem, attr) {
        return scope.$watch(() => elem.outerHeight(), val => (scope.height = val))
    }
}))

littb.directive("firstHeight", function() {
    const setWatch = (scope, elem) =>
        scope.$watch(() => elem.outerHeight(), val => (scope.firstHeight = val))

    return {
        scope: {
            firstHeight: "="
        },
        restrict: "A",
        link(scope, elem, attr) {
            // if scope.$parent.$first
            return _.once(setWatch)
        }
    }
})

littb.directive("onFinishRender", $timeout => ({
    restrict: "A",
    link(scope, element, attr) {
        if (scope.$last) {
            return $timeout(() => scope.$eval(attr.onFinishRender))
        }
    }
}))
// scope.$evalAsync(attr.onFinishRender)

let blockRemoveBkg = false
littb.directive("bkgImg", ($rootElement, $timeout) => ({
    restrict: "EA",
    template: ` <img > `,
    replace: true,
    scope: {},
    //     src: "@"

    link(scope, element, attr) {
        // element.appendTo "#bkgimg"
        const src = element.attr("src")
        element.remove()

        $timeout(
            () =>
                $("body").css({
                    background: `url('${src}') no-repeat`
                }),
            0
        )
        scope.$on("$destroy", function() {
            c.log("bkg destroy")

            // element.remove()
            if (blockRemoveBkg) {
                blockRemoveBkg = false
                c.log("block remove bkg")
                return
            }
            return $("body").css({
                "background-image": "none"
            })
        })

        return scope.$on("$routeChangeStart", function(event, next, current) {
            if (!next.$$route) {
                return
            }
            blockRemoveBkg = current.$$route.school && next.$$route.school
        })
    }
}))

littb.directive("listScroll", () => ({
    link($scope, element, attr) {
        const s = $scope

        s.$on("listScroll", function($event, id) {
            c.log("id", id)
            return element.find(`#${id}`).click()
        })

        return element.on("click", "li", function(event) {
            const targetScope = $(event.currentTarget).scope()
            const closing = element.find(".in.collapsing")

            const animateTo = () =>
                element.animate({
                    scrollTop: element.scrollTop() + $(event.currentTarget).position().top - 25
                })

            if (!closing.length) {
                animateTo()
                return
            }

            const collapse_index = closing.scope().$index
            const collapse_height = closing.height()

            const isBelow = targetScope.$index > collapse_index

            if (isBelow) {
                return element.animate({
                    scrollTop:
                        element.scrollTop() +
                        $(event.currentTarget).position().top -
                        25 -
                        collapse_height
                })
            } else {
                return animateTo()
            }
        })
    }
}))

// littb.directive "ornament", () ->
//     restrict : "C"

const overflowLoad = function(s, element) {
    let btn = null

    element.load(function() {
        const maxWidth = $(this).css("max-width")
        $(this).css("max-width", "initial")
        const actualWidth = $(this).width()
        $(this).css("max-width", maxWidth)
        console.log("$(this).width() - actualWidth", $(this).width(), actualWidth)
        if (actualWidth - $(this).width() > 100) {
            c.log("overflowing image found", element, $(this).width(), actualWidth)
            element.parent().addClass("img-overflow")
            if (btn != null) {
                btn.remove()
            }
            btn = $("<button class='btn btn-xs expand'>Förstora</button>")
                .click(() => s.$emit("img_expand", element.attr("src"), actualWidth))
                .appendTo(element.parent())
        } else {
            if (btn != null) {
                btn.remove()
            }
            element.parent().removeClass("img-overflow")
        }
    })
}

// littb.directive "imgdiv", imgDef
// littb.directive "figurediv", imgDef
littb.directive("graphicimg", () => ({
    restrict: "C",
    compile(elm, attrs) {
        if (_.str.endsWith(elm.attr("src"), ".svg")) {
            elm.load(elm.attr("src"), function(data) {
                let [, , width, height] = data.match(/viewBox="(.+?)"/)[1].split(" ")
                elm.width(width)
                return elm.height(height)
            })
        }
        return function($scope, element, attr) {
            const s = $scope
            if (_.str.endsWith(element.attr("src"), "svg")) {
                return
            }

            return overflowLoad(s, element)
        }
    }
}))

littb.directive("faksimilImg", () => ({
    restrict: "A",
    link($scope, element, attr) {
        return overflowLoad($scope, element)
    }
}))

littb.directive("compile", $compile => ({
    link($scope, element, attr) {
        const s = $scope

        return s.$watch(attr.compile, function(val) {
            const tmpl = $compile(val)(s)
            return element.html(tmpl)
        })
    }
}))

littb.directive("searchOpts", ($location, util) => ({
    template: `
            <ul class="search_opts_widget">
                    <li ng-repeat="(key, opt) in searchOptionsItems" ng-class="{advanced_only: opt.advanced_only}">
                        <span role="checkbox" aria-checked="{{opt.selected}}" ng-show="opt.selected">✓</span>
                        <a ng-click="searchOptSelect(opt)">{{opt.label}}</a>
                    </li>
            </ul>
            `,
    link($scope, element, attr) {
        const s = $scope

        s.searchOptionsMenu = {
            default: {
                label: "SÖK EFTER ORD ELLER FRAS",
                val: "default",
                selected: !(
                    $location.search().infix ||
                    $location.search().prefix ||
                    $location.search().suffix ||
                    $location.search().fuzzy ||
                    $location.search().lemma
                )
            },
            lemma: {
                label: "INKLUDERA BÖJNINGSFORMER",
                val: "lemma",
                selected: $location.search().lemma
            },
            // fuzzy : {
            //     label : "Suddig sökning"
            //     val : "fuzzy"
            //     selected : $location.search().fuzzy
            //     advanced_only : true
            // }
            prefix: {
                label: "SÖK EFTER ORDBÖRJAN",
                val: "prefix",
                selected: $location.search().prefix
            },
            suffix: {
                label: "SÖK EFTER ORDSLUT",
                val: "suffix",
                selected: $location.search().suffix
            },
            infix: {
                label: "SÖK EFTER DEL AV ORD",
                val: "infix",
                selected: $location.search().infix
            }
        }

        s.searchOptionsItems = _.values(s.searchOptionsMenu)

        util.setupHashComplex(s, [
            {
                key: "prefix",
                expr: "searchOptionsMenu.prefix.selected"
            },
            {
                key: "suffix",
                expr: "searchOptionsMenu.suffix.selected"
            },
            {
                key: "infix",
                expr: "searchOptionsMenu.infix.selected"
            },
            {
                key: "lemma",
                expr: "searchOptionsMenu.lemma.selected"
            },
            {
                key: "fuzzy",
                expr: "searchOptionsMenu.fuzzy.selected"
            }
        ])

        s.searchOptSelect = function(sel) {
            const o = s.searchOptionsMenu

            const currents = _.filter(_.values(o), "selected")
            const isDeselect = currents.includes(sel)
            const deselectAll = () => currents.map(item => (item.selected = false))

            if (sel.val === "default") {
                deselectAll()
                sel.selected = true
                return
            }
            if (
                ["prefix", "suffix", "infix"].includes(sel.val) &&
                currents.length === 1 &&
                isDeselect
            ) {
                currents[0].selected = false
                o.default.selected = true
                return
            }
            if (["prefix", "suffix"].includes(sel.val)) {
                o.default.selected = false
                o.lemma.selected = false
                sel.selected = !o[sel.val].selected
                if (isDeselect) {
                    o.infix.selected = false
                }
            }
            if (sel.val === "infix" && !isDeselect) {
                deselectAll()
                sel.selected = true
                o.prefix.selected = true
                o.suffix.selected = true
                return
            }
            if (sel.val === "lemma") {
                // and not isDeselect
                deselectAll()
                o.lemma.selected = true
                return
            }
            if (sel.val === "fuzzy") {
                deselectAll()
                o.fuzzy.selected = true
                return
            }
            if (isDeselect) {
                sel.selected = false
            }
        }
    }
}))

littb.directive("chronology", ($location, backend, util) => ({
    template: `
            <div class="flex">
                <rzslider class="mt-3 slider-large" step="1" ng-class="[sliderActive, {active: sliderActive}]"
                        rz-slider-model="from" 
                        rz-slider-high="to" 
                        rz-slider-options="sliderConf" >
                </rzslider>

                <div class="whitespace-no-wrap self-center chronology_inputs">
                    <span class="text-sm sc">Tryckår: </span>
                    <input type="text" 
                           class="text-sm text-center py-1" 
                           ng-keyup="change()" 
                           ng-model="from"> 
                   <span class="text-sm  sc">till </span> 
                   <input type="text" 
                          class="text-sm text-center py-1" 
                          ng-keyup="change()" 
                          ng-model="to">

                </div>
            </div>
            `,
    scope: {
        from: "=",
        to: "=",
        change: "&"
    },
    link($scope, element, attr) {
        const s = $scope
        backend.getImprintRange().then(([floor, ceil]) => {
            s.from = s.from || floor
            s.to = s.to || ceil
            s.sliderConf = {
                floor,
                ceil,
                onStart: (sliderId, modelValue, highValue, pointerType) => {
                    s.sliderActive = pointerType
                },
                onEnd: () => {
                    s.sliderActive = null
                    // $location.search("intervall", s.filters["sort_date_imprint.date:range"].join(","))
                    s.change()
                }
            }
            // s.change()
            // let [from, to] = ($location.search().intervall || "").split(",")
            // s.from = from || floor
            // s.to = to || ceil
            // s.filters["sort_date_imprint.date:range"][0] = from || floor
            // s.filters["sort_date_imprint.date:range"][1] = to || ceil
        })
    }
}))

// littb.directive("littbErr", $interpolate => ({
//     link($scope, element, attr) {
//         const code = $interpolate(element.attr("code"))
//         const msg = $interpolate(element.attr("msg"))
//         element.attr("littb-err-code", code)
//         if (msg) {
//             element.attr("littb-err-msg", msg)
//         }
//     }
// }))
