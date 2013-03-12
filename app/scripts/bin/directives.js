(function() {

  littb.directive('submitBtn', function() {
    return {
      replace: true,
      template: '<img class="submit_btn" src="http://demolittb.spraakdata.gu.se/bilder/LBsubmitknapp.jpeg">'
    };
  });

  littb.directive('toolkit', function($compile, $location, $route) {
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

  littb.directive('css', function($compile) {
    return {
      restrict: "EA",
      scope: {
        css: "@",
        evalIf: "&if"
      },
      compile: function(elm, attrs) {
        elm.remove();
        return function(scope, iElement, iAttrs) {
          return scope.$watch('css', function(val) {
            if (scope.evalIf()) {
              return $("#reading_css").attr("href", host(val));
            }
          });
        };
      }
    };
  });

  littb.directive('pagetitle', function() {
    return {
      restrict: "EA",
      scope: {
        title: "@pagetitle"
      },
      compile: function(elm, attrs) {
        elm.remove();
        return function(scope, iElement, iAttrs) {
          return scope.$watch("title", function(val) {
            return $("title").text(val);
          });
        };
      }
    };
  });

  littb.directive('sortTriangles', function() {
    return {
      template: '<div><span ng-click="up()" class="triangle up"></span>\n     <span ng-click="down()" class="triangle down"></span>\n       <input ng-model="tuple">\n</div>',
      replace: true,
      scope: {
        sorttuple: "="
      },
      link: function(scope, elem, iAttrs) {
        var s;
        c.log("tiran", scope, elem, iAttrs);
        s = scope;
        s.up = function() {
          c.log("iAttrs.val", iAttrs.val);
          return scope.tuple = [iAttrs.val, 1];
        };
        return s.down = function() {
          c.log("iAttrs.val", iAttrs.val);
          return scope.tuple = [iAttrs.val, -1];
        };
      }
    };
  });

}).call(this);
