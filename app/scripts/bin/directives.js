(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb.directive('submitBtn', function() {
    return {
      replace: true,
      template: '<img class="submit_btn" src="bilder/LBsubmitknapp.jpeg">'
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
              return $("#reading_css").attr("href", val);
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
        scope.sorttuple = [iAttrs.val, 1];
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

  littb.directive('letterMap', function() {
    return {
      template: "<table class=\"letters\">\n    <tr ng-repeat=\"row in letterArray\">\n        <td ng-repeat=\"letter in row\"\n            ng-class=\"{disabled: !ifShow(letter), selected: letter == selectedLetter}\"\n            ng-click=\"setLetter(letter)\">{{letter}}</td>\n    </tr>\n</table>",
      replace: true,
      scope: {
        selected: "=",
        enabledLetters: "="
      },
      link: function(scope, elm, attrs) {
        var s;

        s = scope;
        s.letterArray = _.invoke(["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY", "ZÅÄÖ"], "split", "");
        s.ifShow = function(letter) {
          if (!s.enabledLetters) {
            return false;
          }
          return __indexOf.call(s.enabledLetters, letter) >= 0;
        };
        return s.setLetter = function(l) {
          return s.selected = l;
        };
      }
    };
  });

  littb.directive('square', function() {
    return {
      template: "<div></div>",
      replace: false,
      scope: {
        left: "=x",
        top: "=y",
        width: "=",
        height: "="
      },
      link: function(scope, elm, attrs) {
        var coors, s;

        s = scope;
        coors = _.pick(scope, "top", "left", "width", "height");
        c.log("coors", coors, _.isEmpty(coors));
        if (!_.compact(_.values(coors)).length) {
          return;
        }
        coors = _.object(_.map(coors, function(val, key) {
          return [key, val.split(",")[2] + "px"];
        }));
        return elm.css(coors);
      }
    };
  });

}).call(this);
