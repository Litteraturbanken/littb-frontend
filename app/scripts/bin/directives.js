(function() {

  littb.directive('submitBtn', function() {
    return {
      replace: true,
      template: '<img class="submit_btn" src="http://demolittb.spraakdata.gu.se/bilder/LBsubmitknapp.jpeg">',
      link: function(scope, elm, attrs) {}
    };
  });

  littb.directive('toolkit', function($compile, $location) {
    return {
      restrict: "EA",
      compile: function(elm, attrs) {
        var cmp;
        elm.remove();
        cmp = $compile("<div>" + (elm.html()) + "</div>");
        return function(scope, iElement, iAttrs) {
          return cmp(scope, function(clonedElement, scope) {
            $("#toolkit").html(clonedElement);
            return $(clonedElement.get(0)).unwrap().attr("id", "toolkit");
          });
        };
      }
    };
  });

}).call(this);
