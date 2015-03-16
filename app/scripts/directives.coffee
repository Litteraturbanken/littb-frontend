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
    <div><span ng-click="up()"
                 class="triangle up" ng-class="{'disabled' : active && !enabled[0]}"></span>
           <span ng-click="down()"
                 class="triangle down" ng-class="{'disabled' : active && !enabled[1]}"></span>
    </div>'''
    scope : {tuple : "=", val : "@"}
    link: (scope, elem, iAttrs) ->
        s = scope
        val = scope.$eval scope.val
        s.sorttuple = [val, 1]
        s.enabled = [true, true]
        tupMatches = (tup) ->
            _.all _.map _.zip(val, tup), ([item1, item2]) ->
                item1 == item2
        s.$watch "tuple", (newtup) ->
            [newval, dir] = newtup
            s.active = tupMatches(newval)
            s.enabled = [!dir, dir]
        s.up = () ->
            s.tuple = [val, true]
        s.down = () ->
            s.tuple = [val, false]


littb.directive 'letterMap', () ->
    template : """
        <table class="letters">
            <tr ng-repeat="row in letterArray">
                <td ng-repeat="letter in row"
                    ng-class="{disabled: !ifShow(letter), selected: letter == selected}"
                    ng-click="setLetter(letter)">{{letter}}</td>
            </tr>
        </table>
    """
    replace : true
    scope :
        selected : "="
        enabledLetters : "="
        letterMapChange : "&"
    link : (scope, elm, attrs) ->
        s = scope

        s.letterArray = _.invoke([
            "ABCDE",
            "FGHIJ",
            "KLMNO",
            "PQRST",
            "UVWXY",
            "ZÅÄÖ"
        ], "split", "")

        s.ifShow = (letter) ->
            unless s.enabledLetters then return false
            letter in s.enabledLetters

        s.setLetter = (l) ->
            s.selected = l
            s.letterMapChange(l)

littb.directive 'square', () ->
    template : "<div></div>"
    replace : false
    scope : 
        left : "=x"
        top : "=y"
        width : "="
        height : "="
    link : (scope, elm, attrs) ->
        s = scope
        EXPAND_SIZE = 4
        Y_OFFSET = -2
        coors = _.pick scope, "top", "left", "width", "height"
        coors = _.object _.map coors, (val, key) ->
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
        scope._getScroll = () ->
            return attr.scrollTo
        scope.$watch '_getScroll()', (val) ->
            c.log 'scroll watch', val
            target = elem.find("#" + val)
            if not target.length then return
            $timeout( () ->
                $window.scrollTo(0, target.position().top)
            )   



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
            return false # CURRENTLY S.O. IS DISABLED
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

            if isOneWord and $(event.target).is("span.w")
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
        scope.$on "focus", () ->
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
            $("head > title").text(val or "")
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
    scope: {}
    link : (scope, elem, attrs) ->
        popup = elem.next()
        popup.appendTo("body").hide()
        closePopup = () ->
            popup.hide()
        
        popup.on "click", (event) ->
            closePopup()
            return false

        elem.on "click", (event) ->
            if popup.is(":visible") then closePopup()
            else popup.show()

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


littb.directive 'kwicWord', ->
    replace: true
    template : """<span class="word" ng-class="getClassObj(wd)">{{::wd.word}} </span>
                """ #ng-click="wordClick($event, wd, sentence)"
    link : (scope, element) ->
        scope.getClassObj = (wd) ->
            output =
                reading_match : wd._match
                punct : wd._punct
                match_sentence : wd._matchSentence

            for struct in (wd._struct or [])
                output["struct_" + struct] = true

            for struct in (wd._open or [])
                output["open_" + struct] = true
            for struct in (wd._close or [])
                output["close_" + struct] = true

            return (x for [x, y] in _.pairs output when y).join " "


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
    <a class="download" ng-href="{{getUrl(file)}}">
        <i class="fa fa-file-text "></i>
        <span class="">Ladda ner <br>som PDF</span> 
    </a>
    """
    link : (scope, elem, attr) ->
        scope.getUrl = (filename) ->
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
        elem.text obj.word
        size = 4
        elem.css("font-size", size + "px")
        w = fac * (Number obj.w)
        # c.log "elem.width()", elem.width()  
        if elem.width() 
            while elem.width() < w
                size += 1
                elem.css("font-size", size + "px")
                if size > 300 then break

        # elem.css("font-size", size * (1.2) + "px")
        elem.text elem.text() + " "


littb.directive "top", () ->
    scope: 
        top: "="
    link : (scope, elem, attr) ->

        elem.on "click", () ->
            scope.$apply () ->
                scope.top = elem.position()?.top            

        # scope.$watch "getY()", (offset) ->
        #     c.log "lol", elem.height()
        #     scope.top = offset






