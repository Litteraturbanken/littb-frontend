
littb.directive 'submitBtn', () ->

    replace : true
    template : '<img class="submit_btn" src="http://demolittb.spraakdata.gu.se/bilder/LBsubmitknapp.jpeg">'
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
                    $("#reading_css").attr("href", host val)



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
    <span><span ng-click="up()"
                 class="triangle up" ng-class="{'disabled' : active && !enabled[0]}"></span>
           <span ng-click="down()"
                 class="triangle down" ng-class="{'disabled' : active && !enabled[1]}"></span>
     </span>'''
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


