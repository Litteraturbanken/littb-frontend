
littb.directive 'submitBtn', () ->

    replace : true
    template : '<input type="image" class="submit_btn" ng-src="/bilder/LBsubmitknapp.jpeg">'
    # link: (scope, elm, attrs) ->

littb.directive 'toolkit', ($compile, $location, $route) ->
    restrict : "EA"
    compile: (elm, attrs) ->
        elm.remove()
        cmp = $compile("<div>#{elm.html()}</div>")
        return (scope, iElement, iAttrs) ->
            cmp(scope, (clonedElement, scope) ->
                $("#toolkit").html(clonedElement)

                $(clonedElement.get(0)).unwrap().attr("id", "toolkit")
            )


littb.directive 'css', ($compile) ->
    restrict : "EA"
    scope : {css : "@", evalIf : "&if"}
    compile: (elm, attrs) ->
        elm.remove()
        # cmp = $compile("<div>#{elm.html()}</div>")
        return (scope, iElement, iAttrs) ->
            # c.log "css", scope, _.pairs(scope), attrs.css, iAttrs.css, iElement.attr("css")

            scope.$watch 'css', (val) ->
                if scope.evalIf()
                    $("#reading_css").attr("href", val)



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
            s.letterMapChange()

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
        coors = _.pick scope, "top", "left", "width", "height"
        unless _.compact(_.values(coors)).length then return
        coors = _.object _.map coors, (val, key) ->
            [key, val.split(",")[2] + "px"]

        elm.css coors


        
littb.directive 'clickOutside', ($document) -> 
    restrict: 'A',
    link: (scope, elem, attr, ctrl) ->
        elem.bind 'click', (e) ->
            e.stopPropagation()

        $document.on 'click', () ->
            scope.$apply(attr.clickOutside)


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





        
littb.directive 'selectionSniffer', ($window) -> 
    
    link: (scope, elem, attr) ->
        box = $("<div>").addClass("search_dict").appendTo("body").hide()
                

        $("html").on "click", () ->
            box.remove()
        $("body").on "mousedown", ".search_dict", () ->
            c.log "search click!", $window.getSelection().toString()
            scope.$emit "search_dict", $window.getSelection().toString()
            return false

        scope.$on "$destroy", () ->
            $("body").off "mousedown", ".search_dict"
            $("body > .search_dict").remove()

        showIndicator = (target) ->
            box.remove()
            
            box = $("<div>").addClass("search_dict")
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



    
