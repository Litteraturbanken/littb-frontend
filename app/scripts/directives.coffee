littb = angular.module('littbApp')
littb.directive 'submitBtn', () ->
    replace : true
    template : '<input type="image" class="submit_btn" ng-src="/bilder/LBsubmitknapp.jpeg">'


littb.directive 'toolkit', () ->
    restrict : "EA"
    link: (scope, element, attrs, controller) ->
        id = attrs.toolkitId || "toolkit" # default to id 'toolkit'
        if not attrs.toolkitReplace
            $("##{id}").append element
        else
            replaced = $("##{id} > *").replaceWith element
        scope.$on "$destroy", () ->
            if attrs.toolkitReplace
                element.replaceWith replaced
            else
                element.remove()
        
littb.directive 'css', () ->
    restrict : "EA"
    scope : {css : "@", evalIf : "&if"}
    compile: (elm, attrs) ->
        elm.remove()
        return (scope, iElement, iAttrs) ->

            scope.$watch 'css', (val) ->
                if scope.evalIf()
                    $("#reading_css").attr("href", val)

            scope.$on "$destroy", () ->
                $("#reading_css").attr("href", null)



littb.directive 'pagetitle', () ->
    restrict : "EA"
    scope : {title : "@pagetitle"}
    compile : (elm, attrs) ->
        elm.remove()
        return (scope, iElement, iAttrs) ->
            scope.$watch "title", (val) ->
                $("title").text(val)


littb.directive 'toBody', ($compile) ->
    restrict : "A"
    compile : (elm, attrs) ->
        elm.remove()
        elm.attr("to-body", null)
        wrapper = $("<div>").append(elm)
        cmp = $compile(wrapper.html())

        return (scope, iElement, iAttrs) ->
            newElem = cmp(scope)
            $("body").append(newElem)
            scope.$on "$destroy", () ->
                newElem.remove()


littb.directive 'sortTriangles', () ->
    template: '''
    <div class="sort" ng-class="{disabled : !active}">
        
        <span ng-click="down()" class="label">Sortera</span>
        <span ng-click="down()" class="target disabled " ng-class="{'disabled' :!enabled[1]}">
            stigande
        </span> <span class="dash">/</span>
        <span ng-click="up()" class="target" ng-class="{'disabled' : !enabled[0]}">
            fallande
        </span> 
    </div>'''
    scope : {tuple : "=", val : "@"}
    link: (scope, elem, iAttrs) ->
        s = scope
        val = scope.$eval scope.val
        s.sorttuple = [val, 1]
        s.enabled = [true, true]
        tupMatches = (tup) ->
            _.every _.map _.zip(val, tup), ([item1, item2]) ->
                item1 == item2
        s.$watch "tuple", (newtup) ->
            [newval, dir] = newtup
            s.active = tupMatches(newval)
            c.log "active", s.active
            s.enabled = [!dir, dir]
        s.up = () ->
            s.tuple = [val, true]
        s.down = () ->
            s.tuple = [val, false]


littb.directive 'square', () ->
    template : "<div></div>"
    replace : false
    # scope : 
        # left : "=x"
        # top : "=y"
        # w : "=width"
        # h : "=height"
    link : (scope, elm, attrs) ->
        s = scope
        EXPAND_SIZE = 4
        Y_OFFSET = -2
        coors = _.pick scope.obj, "x", "y", "width", "height"
        coors.top = coors.y
        coors.left = coors.x

        coors = _.fromPairs _.map coors, (val, key) ->
            val = Number(val)
            expand = (val) ->
                n = if key in ["top", "left"] then EXPAND_SIZE * -1 else EXPAND_SIZE * 2
                val + n
            if key == "top"
                val += Y_OFFSET
            [key, expand(val) + "px"]

        elm.css coors

littb.directive 'clickOutside', ($document) ->
    restrict: 'A'
    link: (scope, elem, attr, ctrl) ->
        skip = false
        elem.bind 'click', handler1 = (e) ->
            skip = true
            return
            
        $document.bind 'click', handler = (e) ->
            unless skip
                scope.$eval attr.clickOutside, {$event:e} # event object can be accessed as $event, as with ng-click 
            skip = false
            return ## HO! watch out! not to implicitly return false
            
        elem.on "$destroy", () ->
            $document.off('click', handler)
            return
        return

littb.directive 'scrollTo', ($window, $timeout) -> 
    # scope : scrollTo : "="
    link : (scope, elem, attr) ->
        scope.$watch ( () -> scope.$eval elem.attr("scroll-to")), (val) ->
            unless val then return
            target = elem.find("#" + val)
            if not target.length then return

            $timeout( () ->
                offset = 0
                # c.log "animate to offset", (scope.$eval elem.attr("offset"))
                if attr.offset
                    offset = Number((scope.$eval elem.attr("offset")) or 0)
                    c.log "offset", offset
                elem.animate
                    scrollTop : (elem.scrollTop() + target.position().top) - offset
                # elem.scrollTop()
            )   


littb.directive 'collapsing', ($window, $timeout) -> 
    scope :
        collapsing: "="
        index: "="
    link : (scope, elem, attr) ->
        scope.$watch ( () -> elem.find(".in.collapsing").height()), (val) ->

            scope.collapsing = val
            scope.index = (elem.find(".in.collapsing").scope()?.$eval "$index")


littb.directive 'soArticle', ($compile, $location, $window) -> 
    scope : 
        soArticle : "="
    link : (scope, elem, attrs) ->
        scope.$watch "soArticle", (val) ->
            newElem = $compile(_.str.trim val)(scope)
            elem.html newElem

        scope.lex = () -> $location.search().lex

        scope.$watch "lex()", (val) ->
            unless val then return
            elem.find("#" + val).get(0)?.scrollIntoView()






            

littb.directive 'hvord', (backend, $location) -> 

    restrict : "E"
    link: (scope, elem, attr) ->
        elem.on "click", () ->
            id = elem.prev("hvtag").text()
            if id
                # $location.search("lex", id)
                c.log "click id", id
                scope.$emit "search_dict", null, id, true
            else
                # $location.search("lex", null)
                c.log "click not id", elem
                scope.$emit "search_dict", _.str.trim elem.text(), null, false



        
littb.directive 'selectionSniffer', ($window) -> 
    
    link: (scope, elem, attr) ->
        # box = $("<div><i class='icon-search'></i></div>").addClass("search_dict")
        #     .appendTo("body").hide()
        box = $()
                

        $("html").on "click", () ->
            box.remove()
        $("body").on "mousedown", ".search_dict", () ->
            c.log "search click!", $window.getSelection().toString()
            scope.$emit "search_dict", _.str.trim $window.getSelection().toString()
            return false

        scope.$on "$destroy", () ->
            $("body").off "mousedown", ".search_dict"
            $("body > .search_dict").remove()

        showIndicator = (target) ->
            # return false # CURRENTLY S.O. IS DISABLED
            c.log "showIndicator", target
            box.remove()
            
            box = $("<div><i class='fa fa-search glass'></i>
                        <i class='fa fa-search shadow'></i>
                        <span class='circle'></span></div>")
                .addClass("search_dict")
                .appendTo("body")
                .position(
                    my : "left bottom"
                    at : "right top"
                    of : target
                )



        # we use debounce to account for doubleclick
        elem.on "mouseup", _.debounce( (event) ->
            sel = $window.getSelection?().toString()
            isOneWord = sel and " " not in _.str.trim(sel)
            c.log "isOneWord", sel, isOneWord, event.target

            if isOneWord and ($(event.target).is(".w") || $(event.target).parent().is(".w"))
                showIndicator event.target
        , 500)


# littb.directive 'nprogress', () -> 
#     scope : 
#         nprogress = "="
#     link: (scope, elem, attr) ->
#         NProgress.configure({ parent :  elem});
#         scope.$watch "nprogress", (val) ->
#             if val
#                 NProgress.start()
#             else
#                 nProgress.done()


littb.directive 'alertPopup', ($rootElement, $timeout, $rootScope) -> 
    scope : {}
    restrict : "EA"
    template : """
        <div ng-show="show" class="alert_popup">{{text}}</div>
    """
    replace : true        
    link : (scope, elem, attr) ->
        scope.text = null
        scope.show = false
        $rootScope.$on "notify", (event, text) ->
            scope.text = text
            scope.show = true
            $timeout () ->
                scope.show = false
            , 4000



    
littb.directive 'focusable', () ->
    link : (scope, elem, attr) ->
        evtsuffix = if attr.focusable then ("." + attr.focusable) else ""
        scope.$on ("focus" + evtsuffix), () ->
            c.log "focus!"
            elem.focus()

        scope.$on "blur", () ->
            c.log "blur!", elem
            setTimeout () ->
                elem.blur()
            , 100

littb.directive "typeaheadTrigger", () ->
    require: ["ngModel"]
    link: (scope, element, attr, ctrls) ->
        scope.$on 'open', (event, value) ->

            ctrls[0].$setViewValue(value)


littb.directive 'metaDesc', ($interpolate) ->
    restrict : "EA"
    link: (scope, elm, attrs) ->
        elm.remove()
        inpl = $interpolate(elm.text())
        wtch = scope.$watch((s) ->
            inpl(s)
        , (val) ->
            $("meta[name=description]").attr("content", val)
        )

        scope.$on "$destroy", () ->
            wtch()




littb.directive 'pageTitle', ($interpolate) ->
    restrict : "EA"
    link: (scope, elm, attrs) ->
        elm.remove()
        inpl = $interpolate(elm.text())
        wtch = scope.$watch((s) ->
            inpl(s)
        , (val) ->
            if val then val += " | Litteraturbanken"
            $("head > title").text(val or "Litteraturbanken")
        )

        scope.$on "$destroy", () ->
            wtch()

littb.directive 'breadcrumb', ($interpolate, $rootScope) ->
    restrict : "EA"
    link: (scope, elem, attrs) ->
        $rootScope.breadcrumb.splice(1, $rootScope.breadcrumb.length)
        elem.remove()
        watches = []
        for a, i in elem.children()
            do (a, i) ->
                inplText = $interpolate($(a).text())
                if $(a).attr("href")
                    inplHref = $interpolate($(a).attr("href"))
                watches.push scope.$watch((s) ->
                    # c.log "inplText(s)", inplText(s)
                    inplText(s)
                , (label) ->
                    unless label then return
                    unless $rootScope.breadcrumb[i]
                        $rootScope.breadcrumb[i] = {}
                    $rootScope.breadcrumb[i].label = label
                )
                if inplHref
                    watches.push scope.$watch((s) ->
                        inplHref(s)
                    , (url) ->
                        unless $rootScope.breadcrumb[i]
                            $rootScope.breadcrumb[i] = {}
                        $rootScope.breadcrumb[i].url = url
                    )
                

            


        scope.$on "$destroy", () ->
            for wtch in watches
                wtch()

littb.directive "sticky", () ->
    link: (scope, element, attrs) ->
        element.origTop = element.offset().top
        $(document).on "scroll.sticky", (evt) ->
            #c.log "scroll", $(document).scrollTop(), element.origTop
            if $(document).scrollTop() >= element.origTop
                element.addClass "sticky"
            else
                element.removeClass "sticky"
            
        scope.$on "$destroy", () ->
            $(document).off "scroll.sticky"

littb.directive "popper", ($rootElement) ->
    scope: {
        popper : "@"
    }
    link : (scope, elem, attrs) ->
        popup = elem.next()
        popup.appendTo("body").hide()
        closePopup = () ->
            popup.hide()
        
        # popup.on "click", (event) ->
        #     closePopup()
        #     return false

        # scope.$watch (() -> popup.is(":visible")), (isVisible) ->
        #     popper = 


        elem.on "click", (event) ->
            if popup.is(":visible") then closePopup()
            else 
                popup.show()

            pos = 
                my : attrs.my or "right top"
                at : attrs.at or "bottom right"
                of : elem
            if scope.offset
                pos.offset = scope.offset

            popup.position pos

            return false

        $rootElement.on "click", () ->
            closePopup()

        scope.$on "popper.open." + scope.popper, () ->
            c.log "on popper open", elem
            setTimeout(() ->
                elem.click()
            , 0)



# littb.directive 'kwicWord', ->
#     replace: true
#     template : """<span class="word" ng-class="getClassObj(wd)">{{::wd.word}} </span>
#                 """ #ng-click="wordClick($event, wd, sentence)"
#     link : (scope, element) ->
#         scope.getClassObj = (wd) ->
#             output =
#                 reading_match : wd._match
#                 punct : wd._punct
#                 match_sentence : wd._matchSentence

#             for struct in (wd._struct or [])
#                 output["struct_" + struct] = true

#             for struct in (wd._open or [])
#                 output["open_" + struct] = true
#             for struct in (wd._close or [])
#                 output["close_" + struct] = true

#             return (x for [x, y] in _.toPairs output when y).join " "


littb.directive 'insert', () ->
    (scope, elem, attr) ->
        scope.watch "doc", () ->
            c.log "insert doc", scope.doc
            elem.html(scope.doc or "")

littb.directive 'downloadBtn', () ->
    restrict : "AE"
    replace : true
    scope :
        file : "="
    template : """
    <a class="download" download ng-href="{{getUrl(file)}}" target="_blank">
        <i class="fa fa-file-text-o "></i>
        <span class="">Ladda ner som PDF</span> 
    </a>
    """
    link : (scope, elem, attr) ->
        c.log "attr", attr
        scope.getUrl = (filename) ->
            if attr.isLyrik?
                segments = filename.split("/")
                segments.splice(-1, 0, "pdf")
                return "/red" + segments.join("/").replace(".html", ".pdf")


            else
                "/red/skola/pdf/" + filename.replace(".html", ".pdf")


littb.directive "schoolAffix", ($window) ->

    restrict : "EA"
    link : (scope, elem, attrs) ->
        detectScrollDir = (fDown, fUp) ->
            lastScrollTop = 0
            delta = 5
            f = (event) ->
                st = $(this).scrollTop()
                return if Math.abs(lastScrollTop - st) <= delta
                if st > lastScrollTop
                    fDown?()
                else
                    fUp?()
                lastScrollTop = st
            $(window).on "scroll", f

            return () -> $(window).off "scroll", f


        reset = () ->
            elem.removeClass "affix-disable"
            elem.css 
                top : ""
                left : ""


        detach = (height) ->
            isTooTall = height > $(window).height()
            hasScrolledFromTop = window.scrollY > $(".nav_sidebar").offset().top

            if isTooTall and hasScrolledFromTop and not elem.is(".affix-disable")
                elem.addClass "affix-disable"
                elem.css 
                    top : window.scrollY + 5
                    left : $(".nav_sidebar").offset().left



        killDetect = detectScrollDir () -> 
            detach elem.height()
        , reset

        scope.$on "$destroy", () ->
            killDetect()

        onWatch = (height) ->
            detach(height)
            

        scope.getHeight = () -> elem.height()
        scope.$watch "getHeight()", onWatch


        onWatch()

        elem.affix(
            offset : {
                top : elem.offset().top
            }
        )
littb.directive "affix", ($window) ->

    restrict : "EA"
    link : (scope, elem, attrs) ->
        elem.affix(
            offset : {
                top : elem.offset().top
            }
        )

littb.directive "setClass", () ->
    link : (scope, elem, attrs) ->
        obj = scope.$eval attrs.setClass
        for key, val of obj
            if val
                elem.addClass key
            else
                elem.removeClass key

littb.directive "footnotePopup", ($window, $location, $compile) ->
    restrict : "EA"
    scope : 
        mapping : "=footnotePopup"
    link : (s, elem, attrs) ->

        popupTmpl = """
            <div class="note_popover popover bottom" ng-show="show">
                <div class="arrow"></div>
                <div class="popover-content" ng-bind-html="content | trust"></div>
            </div>
        """

        popupTmpl = $compile(popupTmpl)(s)
        .appendTo("body")
        .click((event) -> 
            target = $(event.target)
            event.preventDefault()
            
            if target.is("sup") 
                id = _.str.lstrip target.parent().attr("href"), "#"
                scrollTarget = elem.find(".footnotes .footnote[id='ftn.#{id}']")
                $location.search("upp", $("body").prop("scrollTop"))
                $("body").animate({scrollTop : scrollTarget.position().top})
            else
                event.stopPropagation()    

        )
        .show()
        s.show = false

        elem.on "click", "a.footnote[href^=#ftn]", (event) ->
            if s.show
                $(document).click()
                return false
            event.preventDefault()
            event.stopPropagation()

            target = $(event.currentTarget)
            id = _.str.lstrip target.attr("href"), "#"
            
            s.$apply () ->
                s.content = s.mapping[id]
                s.show = true

            popupTmpl
            .position(
                my : "middle top+10px"
                at : "bottom middle"
                of : target
            )

            $(document).one "click", () ->
                s.$apply () ->
                    s.show = false

littb.directive "bigText", () ->
    link : (scope, elem, attr) ->
        obj = scope.$eval attr.bigText
        fac = scope.$eval attr.fac
        elem.text obj.wd
        size = 4
        elem.css("font-size", size + "px")
        w = fac * (Number obj.w)
        # c.log "elem.width()", elem.width()  
        if elem.width() 
            while elem.width() < w
                size += 10
                elem.css("font-size", size + "px")
                if size > 300 then break

            while elem.width() > w
                size -= 1
                elem.css("font-size", size + "px")
                if size < 5 then break

        # elem.css("font-size", size * (1.2) + "px")
        elem.attr "id", obj.wid
        elem.text obj.wd + " "


littb.directive "top", () ->
    scope: 
        top: "="
    link : (scope, elem, attr) ->

        elem.on "click", () ->
            safeApply scope, () ->
                scope.top = elem.position()?.top            

        # scope.$watch "getY()", (offset) ->
        #     c.log "lol", elem.height()
        #     scope.top = offset


littb.directive "height", () ->
    restrict: "A"
    scope: 
        height: "="
    link : (scope, elem, attr) ->
        scope.$watch (() -> elem.outerHeight()), (val) ->
            scope.height = val


littb.directive "firstHeight", () ->

    setWatch = (scope, elem) ->
        scope.$watch (() -> elem.outerHeight()), (val) ->
            scope.firstHeight = val

    scope : 
        firstHeight : "="
    restrict: "A"
    link : (scope, elem, attr) ->
        # if scope.$parent.$first
        _.once setWatch

    
littb.directive 'onFinishRender', ($timeout) ->
    restrict : "A"
    link: (scope, element, attr) ->
        if (scope.$last)
            $timeout(() ->
                scope.$eval attr.onFinishRender
            )
            # scope.$evalAsync(attr.onFinishRender)

blockRemoveBkg = false
littb.directive 'bkgImg', ($rootElement, $timeout) ->
    restrict : "EA"
    template : '''
        <img >
    '''
    replace : true
    scope : {}
    #     src: "@"

    link : (scope, element, attr) ->
        # element.appendTo "#bkgimg"
        src = element.attr("src")
        element.remove()

        $timeout( () ->
            $("body").css
                "background" : "url('#{src}') no-repeat"
        , 0)
        scope.$on "$destroy", () ->
            c.log "bkg destroy"

            # element.remove()
            if blockRemoveBkg
                blockRemoveBkg = false
                c.log "block remove bkg"
                return
            $("body").css
                "background-image" : "none"


        scope.$on "$routeChangeStart", (event, next, current) ->
            unless next.$$route then return
            blockRemoveBkg = current.$$route.school and next.$$route.school

littb.directive "listScroll", () ->
    link : ($scope, element, attr) ->
        s = $scope

        s.$on "listScroll", ($event, id) ->
            c.log "id", id
            element.find("#" + id).click()

        element.on "click", "li", (event) ->
            targetScope = $(event.currentTarget).scope()
            closing = element.find(".in.collapsing")

            animateTo = () ->
                element.animate
                    scrollTop : element.scrollTop() + $(event.currentTarget).position().top - 25

            if not closing.length
                animateTo()
                return
            
            collapse_index = closing.scope().$index
            collapse_height = closing.height()
            

            isBelow = targetScope.$index > collapse_index

            if isBelow
                element.animate
                    scrollTop : (element.scrollTop() + $(event.currentTarget).position().top - 25) - collapse_height
            else
                animateTo()



# littb.directive "ornament", () ->
#     restrict : "C"
    

overflowLoad = (s, element) ->
    btn = null

    element.load () ->
        maxWidth = $(this).css("max-width")
        $(this).css("max-width", "initial")
        actualWidth = $(this).width()
        $(this).css("max-width", maxWidth)
        if $(this).width() < actualWidth
            c.log "overflowing image found", element, $(this).width(), actualWidth
            element.parent().addClass "img-overflow"
            btn?.remove()
            btn = $("<button class='btn btn-xs expand'>Förstora</button>").click () ->
                s.$emit "img_expand", element.attr("src"), actualWidth
            .appendTo element.parent()
        else
            btn?.remove()
            element.parent().removeClass "img-overflow"




# littb.directive "imgdiv", imgDef
# littb.directive "figurediv", imgDef
littb.directive "graphicimg", () ->
    restrict : "C"
    compile: (elm, attrs) ->
        if _.str.endsWith elm.attr("src"), ".svg"
            elm.load(elm.attr("src"), (data) ->
                [__, __, width, height] = data.match(/viewBox="(.+?)"/)[1].split(" ")
                elm.width width
                elm.height height
            )
        return ($scope, element, attr) ->
            s = $scope
            if _.str.endsWith element.attr("src"), "svg"
                return
            
            overflowLoad(s, element)



littb.directive "faksimilImg", () ->
    restrict : "A"
    link : ($scope, element, attr) ->
        overflowLoad($scope, element)


littb.directive "compile", ($compile) ->
    link : ($scope, element, attr) ->
        s = $scope

        s.$watch attr.compile, (val) ->
            tmpl = ($compile val)(s)
            element.html tmpl


littb.directive "searchOpts", ($location, util) ->
    template: """
        <ul class="search_opts_widget">
            <li ng-repeat="(key, opt) in searchOptionsItems" ng-class="{advanced_only: opt.advanced_only}">
                <span role="checkbox" aria-checked="{{opt.selected}}" ng-show="opt.selected">✓</span>
                <a ng-click="searchOptSelect(opt)">{{opt.label}}</a>
            </li>
        </ul>
    """
    link : ($scope, element, attr) ->
        s = $scope

        s.searchOptionsMenu = 
            default : {
                label: "SÖK EFTER ORD ELLER FRAS",
                val: "default",
                selected: not ($location.search().infix or
                               $location.search().prefix or
                               $location.search().suffix or
                               $location.search().fuzzy or
                               $location.search().lemma),
            }
            lemma : {
                label : "INKLUDERA BÖJNINGSFORMER"
                val : "lemma"
                selected : $location.search().lemma
            }
            # fuzzy : {
            #     label : "Suddig sökning"
            #     val : "fuzzy"
            #     selected : $location.search().fuzzy
            #     advanced_only : true
            # }
            prefix : {
                label: "SÖK EFTER ORDBÖRJAN",
                val: "prefix",
                selected: $location.search().prefix
            }
            suffix : {
                label: "SÖK EFTER ORDSLUT",
                val: "suffix",
                selected: $location.search().suffix
            }
            infix : {
                label: "SÖK EFTER DEL AV ORD",
                val: "infix",
                selected: $location.search().infix
            }

        s.searchOptionsItems = _.values s.searchOptionsMenu


        util.setupHashComplex s, [
            key: "prefix"
            expr: "searchOptionsMenu.prefix.selected"
        ,   
            key : "suffix"
            expr: "searchOptionsMenu.suffix.selected"
        ,   
            key : "infix"
            expr: "searchOptionsMenu.infix.selected"
        ,   
            key : "lemma"
            expr: "searchOptionsMenu.lemma.selected"
        ,   
            key : "fuzzy"
            expr: "searchOptionsMenu.fuzzy.selected"
        ]

        s.searchOptSelect = (sel) ->
            o = s.searchOptionsMenu

            currents = _.filter (_.values o), "selected"
            isDeselect = sel in currents
            deselectAll = () ->
                for item in currents
                    item.selected = false



            if sel.val == "default"
                deselectAll()
                sel.selected = true
                return
            if sel.val in ["prefix", "suffix", "infix"] and currents.length == 1 and isDeselect
                currents[0].selected = false
                o.default.selected = true
                return
            if sel.val in ["prefix", "suffix"]
                o.default.selected = false
                o.lemma.selected = false
                sel.selected = !o[sel.val].selected
                if isDeselect then o.infix.selected = false
            if sel.val == 'infix' and not isDeselect
                deselectAll()
                sel.selected = true
                o.prefix.selected = true
                o.suffix.selected = true
                return
            if sel.val == 'lemma' # and not isDeselect
                deselectAll()
                o.lemma.selected = true
                return
            if sel.val == 'fuzzy'
                deselectAll()
                o.fuzzy.selected = true
                return
            if isDeselect
                sel.selected = false



