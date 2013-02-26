(function() {
  'use strict';

  var MOZ_HACK_REGEXP, PREFIX_REGEXP, SPECIAL_CHARS_REGEXP, camelCase, normalize,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __slice = [].slice;

  window.c = typeof console !== "undefined" && console !== null ? console : {
    log: _.noop
  };

  window.xml2Str = function(xmlNode) {
    try {
      return (new XMLSerializer()).serializeToString(xmlNode);
    } catch (e) {
      try {
        return xmlNode.xml;
      } catch (e) {
        alert("Xmlserializer not supported");
      }
    }
    return false;
  };

  window.getInnerXML = function(elem) {
    var child, strArray;
    strArray = (function() {
      var _i, _len, _ref, _results;
      _ref = elem.childNodes;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        _results.push(xml2Str(child));
      }
      return _results;
    })();
    return strArray.join("");
  };

  PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;

  SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;

  MOZ_HACK_REGEXP = /^moz([A-Z])/;

  normalize = function(name) {
    return camelCase(name.replace(PREFIX_REGEXP, ''));
  };

  camelCase = function(name) {
    return name.replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
      if (offset) {
        return letter.toUpperCase();
      } else {
        return letter;
      }
    }).replace(MOZ_HACK_REGEXP, "Moz$1");
  };

  littb.controller("startCtrl", function() {});

  littb.controller("contactFormCtrl", function($scope, backend) {});

  littb.controller("statsCtrl", function($scope, backend) {
    var s;
    s = $scope;
    return backend.getStats().then(function(data) {
      return s.data = data;
    });
  });

  littb.controller("searchCtrl", function($scope, backend) {
    var s;
    s = $scope;
    s.open = false;
    s.searchProofread = true;
    s.searchNonProofread = true;
    s.authors = backend.getAuthorList();
    s.$watch("selected_author", function(newAuthor, prevVal) {
      if (!newAuthor) {
        return;
      }
      return s.titles = backend.getTitlesByAuthor(newAuthor.authorid);
    });
    return s.search = function() {
      return s.results = backend.searchWorks(s.query);
    };
  });

  littb.controller("authorInfoCtrl", function($scope, backend, $routeParams) {
    var author;
    author = $routeParams.author;
    return $scope.authorInfo = backend.getAuthorInfo(author);
  });

  littb.controller("titleListCtrl", function($scope, $location, backend, util) {
    var s;
    s = $scope;
    s.loc = $location;
    s.letterArray = _.invoke(["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY", "ZÅÄÖ"], "split", "");
    util.setupHash(s, "sort", "filter", "mediatypeFilter");
    backend.getTitles().then(function(titleArray) {
      s.rowByLetter = _.groupBy(titleArray, function(item) {
        return item.itemAttrs.showtitle[0];
      });
      s.selectedLetter = _.keys(s.rowByLetter).sort()[0];
      s.selectedLetter = "A";
      return s.rows = s.rowByLetter[s.selectedLetter];
    });
    return s.setLetter = function(l) {
      var list;
      list = s.rowByLetter[l];
      if (l && l.length) {
        s.selectedLetter = l;
        return s.rows = list;
      }
    };
  });

  littb.controller("epubListCtrl", function($scope, backend) {
    var s;
    s = $scope;
    return backend.getTitles().then(function(titleArray) {
      var authors, x;
      s.rows = titleArray;
      authors = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = titleArray.length; _i < _len; _i++) {
          x = titleArray[_i];
          if (__indexOf.call(x.mediatype, "epub") >= 0) {
            _results.push(x.author);
          }
        }
        return _results;
      })();
      return s.authorData = _.unique(authors, false, function(item) {
        return item.authorid;
      });
    });
  });

  littb.controller("authorListCtrl", function($scope, backend) {
    return backend.getAuthorList().then(function(data) {
      $scope.authorIdGroup = _.groupBy(data, function(item) {
        return item.authorid;
      });
      $scope.authorIdGroup[""] = "";
      return $scope.rows = data;
    });
  });

  littb.controller("sourceInfoCtrl", function($scope, backend, $routeParams) {
    var author, mediatype, s, title;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype;
    _.extend(s, $routeParams);
    s.getMediatypes = function() {
      var _ref;
      if (mediatype) {
        return [mediatype];
      } else {
        return (_ref = s.data) != null ? _ref.mediatypes : void 0;
      }
    };
    return backend.getSourceInfo(author, title).then(function(data) {
      return s.data = data;
    });
  });

  littb.controller("readingCtrl", function($scope, backend, $routeParams) {
    var author, mediatype, pagenum, s, title;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype, pagenum = $routeParams.pagenum;
    _.extend(s, $routeParams);
    s.pagenum = Number(pagenum);
    return backend.getPage(author, title, mediatype, s.pagenum).then(function(_arg) {
      var data, page, workinfo;
      data = _arg[0], workinfo = _arg[1];
      s.workinfo = workinfo;
      page = $("page[name=" + pagenum + "]", data).clone();
      if (!page.length) {
        page = $("page:last", data).clone();
        s.pagenum = Number(page.attr("name"));
      }
      if (mediatype === 'faksimil') {
        return s.url = $("faksimil-url[size=3]", page).text();
      } else {
        page.children().remove();
        return s.etext_html = page.text();
      }
    });
  });

  littb.factory("util", function($location) {
    return {
      setupHash: function() {
        var name, names, scope, _i, _len, _results;
        scope = arguments[0], names = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
        scope[name] = $location.search()[name];
        scope.$watch('loc.search()', function() {
          return _.extend(scope, _.pick.apply(_, [$location.search()].concat(__slice.call(names))));
        });
        _results = [];
        for (_i = 0, _len = names.length; _i < _len; _i++) {
          name = names[_i];
          _results.push(scope.$watch(name, (function(name) {
            return function(val) {
              return $location.search(name, val || null);
            };
          })(name)));
        }
        return _results;
      }
    };
  });

  littb.factory('backend', function($http, $q) {
    var http, objFromAttrs, parseWorkInfo;
    http = function(config) {
      var defaultConfig;
      defaultConfig = {
        method: "GET",
        params: {
          username: "app"
        },
        transformResponse: function(data, headers) {
          var output;
          output = new DOMParser().parseFromString(data, "text/xml");
          if ($("fel", output).length) {
            c.log("fel:", $("fel", output).text());
          }
          return output;
        }
      };
      return $http(_.deepExtend(defaultConfig, config));
    };
    objFromAttrs = function(elem) {
      var attrib;
      if (!elem) {
        return null;
      }
      return _.object((function() {
        var _i, _len, _ref, _results;
        _ref = elem.attributes;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attrib = _ref[_i];
          _results.push([attrib.name, attrib.value]);
        }
        return _results;
      })());
    };
    parseWorkInfo = function(root, xml) {
      var asArray, elem, output, useInnerXML, val, _i, _len, _ref, _ref1, _ref2;
      useInnerXML = ["sourcedesc"];
      asArray = ["mediatypes"];
      output = {};
      _ref = $(root, xml).children();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        if (_ref1 = elem.nodeName, __indexOf.call(useInnerXML, _ref1) >= 0) {
          val = getInnerXML(elem);
        } else if (_ref2 = elem.nodeName, __indexOf.call(asArray, _ref2) >= 0) {
          val = _.map($(elem).children(), function(child) {
            return $(child).text();
          });
        } else {
          val = $(elem).text();
        }
        output[normalize(elem.nodeName)] = val;
      }
      return output;
    };
    return {
      getTitles: function() {
        var def;
        def = $q.defer();
        http({
          url: host("/query/lb-anthology.xql"),
          params: {
            action: "get-works"
          }
        }).success(function(xml) {
          var elemList, itm, rows, workIdGroups, workid;
          workIdGroups = _.groupBy($("item", xml), function(item) {
            return $(item).attr("lbworkid");
          });
          rows = {};
          for (workid in workIdGroups) {
            elemList = workIdGroups[workid];
            itm = $(elemList[0]);
            rows[workid] = {
              itemAttrs: objFromAttrs(elemList[0]),
              author: (objFromAttrs(itm.find("author").get(0))) || "",
              mediatype: _.unique(_.map(elemList, function(item) {
                return $(item).attr("mediatype");
              }))
            };
          }
          rows = _.flatten(_.values(rows));
          return def.resolve(rows);
        });
        return def.promise;
      },
      getAuthorList: function() {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-authors.xql?action=get-authors");
        http({
          url: url
        }).success(function(xml) {
          var attrArray, item;
          attrArray = (function() {
            var _i, _len, _ref, _results;
            _ref = $("item", xml);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              item = _ref[_i];
              _results.push(objFromAttrs(item));
            }
            return _results;
          })();
          return def.resolve(attrArray);
        });
        return def.promise;
      },
      getSourceInfo: function(author, title) {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-anthology.xql");
        http({
          url: url,
          params: {
            action: "get-work-info-init",
            authorid: author,
            titlepath: title
          }
        }).success(function(xml) {
          var output;
          output = parseWorkInfo("result", xml);
          return def.resolve(output);
        });
        return def.promise;
      },
      getPage: function(author, title, mediatype, pagenum) {
        var def, params, url;
        def = $q.defer();
        url = host("/query/lb-anthology.xql");
        params = {
          action: "get-work-data-init",
          authorid: author,
          titlepath: title,
          navinfo: true,
          css: true,
          workdb: true,
          mediatype: mediatype
        };
        if (pagenum) {
          params["pagename"] = pagenum;
        }
        http({
          url: url,
          params: params
        }).success(function(xml) {
          var info;
          info = parseWorkInfo("LBwork", xml);
          info["authorFullname"] = $("author-fullname", xml).text();
          info["showtitle"] = $("showtitle", xml).text();
          info["css"] = $("css", xml).text();
          return def.resolve([xml, info]);
        });
        return def.promise;
      },
      getAuthorInfo: function(author) {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-authors.xql");
        http({
          url: url,
          params: {
            action: "get-author-data-init",
            authorid: author
          }
        }).success(function(xml) {
          var authorInfo, elem, item, obj, val, works, _i, _j, _len, _len1, _ref, _ref1;
          authorInfo = {};
          _ref = $("LBauthor", xml).children();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            elem = _ref[_i];
            if (elem.nodeName === "intro") {
              val = getInnerXML(elem);
            } else {
              val = $(elem).text();
            }
            authorInfo[normalize(elem.nodeName)] = val;
          }
          works = [];
          _ref1 = $("works item", xml);
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            item = _ref1[_j];
            c.log("works item", item);
            obj = objFromAttrs(item);
            works.push(obj);
          }
          authorInfo.works = works;
          return def.resolve(authorInfo);
        });
        return def.promise;
      },
      getStats: function() {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-stats.xql");
        http({
          url: url,
          params: {
            action: "get-overall-stats"
          }
        }).success(function(xml) {
          var elem, output, parseObj, x, _i, _len, _ref, _ref1;
          output = {};
          parseObj = ["pages", "words"];
          _ref = $("result", xml).children();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            elem = _ref[_i];
            if (elem.tagName === "table") {
              output.titleList = (function() {
                var _j, _len1, _ref1, _results;
                _ref1 = $("td:nth-child(2) a", elem);
                _results = [];
                for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                  x = _ref1[_j];
                  _results.push("<a href='" + ($(x).attr('href')) + "'>" + ($(x).text()) + "</a>");
                }
                return _results;
              })();
              c.log("titleList", output.titleList);
            } else if (_ref1 = elem.tagName, __indexOf.call(parseObj, _ref1) >= 0) {
              output[elem.tagName] = _.object(_.map($(elem).children(), function(child) {
                return [child.tagName, $(child).text()];
              }));
            } else {
              output[elem.tagName] = $(elem).text();
            }
          }
          return def.resolve(output);
        });
        return def.promise;
      },
      getTitlesByAuthor: function(authorid) {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-anthology.xql");
        http({
          url: url,
          params: {
            action: "get-titles-by-author",
            authorid: authorid
          }
        }).success(function(xml) {
          var elem, output, _i, _len, _ref;
          output = [];
          _ref = $("result", xml).children();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            elem = _ref[_i];
            output.push(objFromAttrs(elem));
          }
          return def.resolve(output);
        });
        return def.promise;
      },
      searchWorks: function(query) {
        var def, url;
        def = $q.defer();
        url = host("/query/lb-search.xql");
        http({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "text/xml; charset=utf-8"
          },
          params: {
            action: "search"
          },
          data: "<search>\n    <string-filter>\n        <item type=\"string\">" + (query || "finge") + "|</item>\n    </string-filter>\n<domain-filter>\n<item type=\"all-titles\" mediatype=\"all\"></item>\n</domain-filter>\n<ne-filter>\n    <item type=\"NUL\"></item>\n</ne-filter>\n</search>"
        }).success(function(data) {
          var ref;
          c.log("success", $("result", data).attr("ref"));
          ref = $("result", data).attr("ref");
          return http({
            url: url,
            params: {
              action: "get-result-set",
              searchref: ref
            }
          }).success(function(resultset) {
            var elem, kw, left, output, right, work, _i, _len, _ref, _ref1;
            c.log("get-result-set success", resultset, $("result", resultset).children());
            output = [];
            _ref = $("result", resultset).children();
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              elem = _ref[_i];
              _ref1 = _.map($(elem).children(), $), left = _ref1[0], kw = _ref1[1], right = _ref1[2], work = _ref1[3];
              output.push({
                left: left.text(),
                kw: kw.text(),
                right: right.text(),
                item: objFromAttrs(work.get(0))
              });
            }
            return def.resolve(output);
          });
        }).error(function(data) {
          c.log("error", arguments);
          return def.reject();
        });
        return def.promise;
      }
    };
  });

}).call(this);
