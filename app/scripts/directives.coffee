
littb.directive 'submitBtn', () ->

    replace : true
    template : '<img class="submit_btn" src="http://demolittb.spraakdata.gu.se/bilder/LBsubmitknapp.jpeg">'
    link: (scope, elm, attrs) ->

littb.directive 'toolkit', ($compile, $location) ->
    restrict : "EA"
    compile: (elm, attrs) ->
        elm.remove()
        cmp = $compile("<div>#{elm.html()}</div>")
        return (scope, iElement, iAttrs) ->
            cmp(scope, (clonedElement, scope) ->
                $("#toolkit").html(clonedElement)

                $(clonedElement.get(0)).unwrap().attr("id", "toolkit")
            )