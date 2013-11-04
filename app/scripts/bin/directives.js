(function() {
  var littb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb = angular.module('littbApp');

  littb.directive('submitBtn', function() {
    return {
      replace: true,
      template: '<input type="image" class="submit_btn" ng-src="/bilder/LBsubmitknapp.jpeg">'
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

  littb.directive('css', function() {
    return {
      restrict: "EA",
      scope: {
        css: "@",
        evalIf: "&if"
      },
      compile: function(elm, attrs) {
        elm.remove();
        return function(scope, iElement, iAttrs) {
          scope.$watch('css', function(val) {
            if (scope.evalIf()) {
              return $("#reading_css").attr("href", val);
            }
          });
          return scope.$on("$destroy", function() {
            return $("#reading_css").attr("href", null);
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
      template: '<div><span ng-click="up()"\n             class="triangle up" ng-class="{\'disabled\' : active && !enabled[0]}"></span>\n       <span ng-click="down()"\n             class="triangle down" ng-class="{\'disabled\' : active && !enabled[1]}"></span>\n </div>',
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
      template: "<table class=\"letters\">\n    <tr ng-repeat=\"row in letterArray\">\n        <td ng-repeat=\"letter in row\"\n            ng-class=\"{disabled: !ifShow(letter), selected: letter == selected}\"\n            ng-click=\"setLetter(letter)\">{{letter}}</td>\n    </tr>\n</table>",
      replace: true,
      scope: {
        selected: "=",
        enabledLetters: "=",
        letterMapChange: "&"
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
          s.selected = l;
          return s.letterMapChange(l);
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
        var s;
        s = scope;
        return s.$watch("left + top + width + height", function() {
          var coors;
          coors = _.pick(scope, "top", "left", "width", "height");
          c.log("coors", coors);
          coors = _.object(_.map(coors, function(val, key) {
            return [key, ((val != null ? val.split(",")[2] : void 0) || 0) + "px"];
          }));
          return elm.css(coors);
        });
      }
    };
  });

  littb.directive('clickOutside', function($document) {
    return {
      restrict: 'A',
      link: function(scope, elem, attr, ctrl) {
        elem.bind('click', function(e) {
          return e.stopPropagation();
        });
        return $document.on('click', function() {
          return scope.$apply(attr.clickOutside);
        });
      }
    };
  });

  littb.directive('scrollTo', function($window, $timeout) {
    return {
      link: function(scope, elem, attr) {
        scope._getScroll = function() {
          return attr.scrollTo;
        };
        return scope.$watch('_getScroll()', function(val) {
          var target;
          c.log('scroll watch', val);
          target = elem.find("#" + val);
          if (!target.length) {
            return;
          }
          return $timeout(function() {
            return $window.scrollTo(0, target.position().top);
          });
        });
      }
    };
  });

  littb.directive('soArticle', function($compile) {
    return {
      scope: {
        soArticle: "="
      },
      link: function(scope, elem, attrs) {
        return scope.$watch("soArticle", function(val) {
          var newElem;
          newElem = $compile(_.str.trim(val))(scope);
          return elem.html(newElem);
        });
      }
    };
  });

  littb.directive('hvord', function(backend) {
    return {
      restrict: "E",
      link: function(scope, elem, attr) {
        return elem.on("click", function() {
          var id;
          id = elem.prev("hvtag").text();
          if (id) {
            return scope.$emit("search_dict", id, true);
          } else {
            return scope.$emit("search_dict", _.str.trim(elem.text()));
          }
        });
      }
    };
  });

  littb.directive('selectionSniffer', function($window) {
    return {
      link: function(scope, elem, attr) {
        var box, showIndicator;
        box = $();
        $("html").on("click", function() {
          return box.remove();
        });
        $("body").on("mousedown", ".search_dict", function() {
          c.log("search click!", $window.getSelection().toString());
          scope.$emit("search_dict", _.str.trim($window.getSelection().toString()));
          return false;
        });
        scope.$on("$destroy", function() {
          $("body").off("mousedown", ".search_dict");
          return $("body > .search_dict").remove();
        });
        showIndicator = function(target) {
          box.remove();
          return box = $("<div><i class='icon-search glass'></i>                        <i class='icon-search shadow'></i>                        <span class='circle'></span></div>").addClass("search_dict").appendTo("body").position({
            my: "left bottom",
            at: "right top",
            of: target
          });
        };
        return elem.on("mouseup", _.debounce(function(event) {
          var isOneWord, sel;
          sel = typeof $window.getSelection === "function" ? $window.getSelection().toString() : void 0;
          isOneWord = sel && __indexOf.call(_.str.trim(sel), " ") < 0;
          c.log("isOneWord", sel, isOneWord, event.target);
          if (isOneWord && $(event.target).is("span.w")) {
            return showIndicator(event.target);
          }
        }, 500));
      }
    };
  });

  littb.directive('alert', function($rootElement, $timeout) {
    return {
      scope: {
        alert: "="
      },
      template: "<div ng-if=\"alert\" class=\"alert_popup\">{{alert}}</div>",
      link: function(scope, elem, attr) {
        $rootElement.append(elem);
        return scope.$on("$destroy", function() {
          return elem.remove();
        });
      }
    };
  });

  littb.directive('focusable', function() {
    return {
      link: function(scope, elem, attr) {
        scope.$on("focus", function() {
          return elem.focus();
        });
        return scope.$on("blur", function() {
          c.log("blur!", elem);
          return setTimeout(function() {
            return elem.blur();
          }, 100);
        });
      }
    };
  });

  littb.directive('metaDesc', function($interpolate) {
    return {
      restrict: "EA",
      link: function(scope, elm, attrs) {
        var inpl, wtch;
        elm.remove();
        inpl = $interpolate(elm.text());
        wtch = scope.$watch(function(s) {
          return inpl(s);
        }, function(val) {
          return $("meta[name=description").attr("content", val);
        });
        return scope.$on("$destroy", function() {
          return wtch();
        });
      }
    };
  });

  littb.directive('pageTitle', function($interpolate) {
    return {
      restrict: "EA",
      link: function(scope, elm, attrs) {
        var inpl, wtch;
        elm.remove();
        inpl = $interpolate(elm.text());
        wtch = scope.$watch(function(s) {
          return inpl(s);
        }, function(val) {
          return $("head > title").text(val || "");
        });
        return scope.$on("$destroy", function() {
          return wtch();
        });
      }
    };
  });

}).call(this);

/*
//@ sourceMappingURL=directives.js.map
*/