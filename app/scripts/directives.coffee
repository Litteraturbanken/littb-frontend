
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
    # controller: () ->
        #controller cn func, may access $scope, $element, $attrs, $transclude
    template: '''<div><span ng-click="up()" class="triangle up"></span>
                      <span ng-click="down()" class="triangle down"></span>
                        <input ng-model="tuple">
                 </div>'''
    replace: true
    scope : {sorttuple : "="}
    link: (scope, elem, iAttrs) ->
        c.log "tiran", scope, elem, iAttrs
        s = scope

        s.up = () ->
            c.log "iAttrs.val", iAttrs.val
            scope.tuple = [iAttrs.val, 1]
        s.down = () ->
            c.log "iAttrs.val", iAttrs.val
            scope.tuple = [iAttrs.val, -1]


        # elem.on "click", ".triangle", () ->
        #     elem.find(".triangle").removeClass "disabled"
        #     $(this).addClass "disabled"
        #     c.log "set tuple", iAttrs.val

            # scope.$apply () ->

                # scope.tuple = [iAttrs.val, 1]



        # scope.$destroy () ->
            # elem.off "click"




