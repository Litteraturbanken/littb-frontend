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
      template: '<span><span ng-click="up()"\n             class="triangle up" ng-class="{\'disabled\' : active && !enabled[0]}"></span>\n       <span ng-click="down()"\n             class="triangle down" ng-class="{\'disabled\' : active && !enabled[1]}"></span>\n </span>',
      scope: {
        tuple: "=",
        val: "@"
      },
      link: function(scope, elem, iAttrs) {
        var s;
        s = scope;
        s.enabled = [true, true];
        s.$watch("tuple", function(newtup) {
          var dir, newval;
          newval = newtup[0], dir = newtup[1];
          s.active = s.val === newval;
          return s.enabled = [!dir, dir];
        });
        s.up = function() {
          return scope.tuple = [s.val, true];
        };
        return s.down = function() {
          return scope.tuple = [s.val, false];
        };
      }
    };
  });

}).call(this);
