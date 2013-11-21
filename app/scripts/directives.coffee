littb = angular.module('littbApp')
littb.directive 'submitBtn', () ->
    replace : true
    template : '<input type="image" class="submit_btn" ng-src="/bilder/LBsubmitknapp.jpeg">'

littb.directive 'toolkit', ($compile, $location, $route) ->
    restrict : "EA"
    compile: (elm, attrs) ->
        elm.remove()
        cmp = $compile("<div>#{elm.html()}</div>")

        return (scope, iElement, iAttrs) ->
            $("#toolkit").html(cmp(scope))


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
        scope.sorttuple = [iAttrs.val, 1]
        s.enabled = [true, true]

        s.$watch "tuple", (newtup) ->
            [newval, dir] = newtup
            s.active = s.val == newval
            s.enabled = [!dir, dir]
        s.up = () ->
            scope.tuple = [s.val, true]
        s.down = () ->
            scope.tuple = [s.val, false]


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
        size : "="
    link : (scope, elm, attrs) ->
        s = scope
        EXPAND_SIZE = 4
        Y_OFFSET = -2
        coors = _.pick scope, "top", "left", "width", "height"
        coors = _.object _.map coors, (val, key) ->
            val = Number(val)
            expand = (val) ->
                n = if key in ["top", "left"] then EXPAND_SIZE * -1 else EXPAND_SIZE * 2
                # dir = if key in ["top", "left"] then -1 else 1
                val + n
            c.log "coors", val, key, expand(val)
            if key == "top"
                val += Y_OFFSET
            [key, expand(val) + "px"]
                # [key, (val) + "px"]

        elm.css coors
        
# littb.directive 'clickOutside', ($document) -> 
#     restrict: 'A',
#     link: (scope, elem, attr, ctrl) ->
#         elem.bind 'click', (e) ->
#             e.stopPropagation()

#         $document.on 'click', () ->
#             scope.$apply(attr.clickOutside)


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




littb.directive 'soArticle', ($compile) -> 
    scope : 
        soArticle : "="
    link : (scope, elem, attrs) ->
        scope.$watch "soArticle", (val) ->
            newElem = $compile(_.str.trim val)(scope)
            elem.html newElem
            


littb.directive 'hvord', (backend) -> 

    restrict : "E"
    link: (scope, elem, attr) ->
        elem.on "click", () ->
            id = elem.prev("hvtag").text()
            if id
                scope.$emit "search_dict", id, true
            else
                scope.$emit "search_dict", _.str.trim elem.text()



        
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


littb.directive 'alertPopup', ($rootElement, $timeout) -> 
    scope : 
        alertPopup : "=alert"
    template : """
        <div ng-if="alert" class="alert_popup">{{alert}}</div>
    """
    link : (scope, elem, attr) ->
        $rootElement.append elem
        scope.$on "$destroy", () -> elem.remove()

    
littb.directive 'focusable', () ->
    link : (scope, elem, attr) ->
        scope.$on "focus", () ->
            elem.focus()

        scope.$on "blur", () ->
            c.log "blur!", elem
            setTimeout () ->
                elem.blur()
            , 100



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


littb.directive 'kwicWord', ->
    replace: true
    template : """<span class="word" ng-class="getClassObj(wd)"
                    bo-text="wd.word + ' '" ></span>
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

littb.directive "affix", () ->
    restrict : "EA"
    link : (scope, elem, attrs) ->
        elem.affix()
