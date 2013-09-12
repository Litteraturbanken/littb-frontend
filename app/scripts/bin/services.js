(function() {
  var __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb.factory("debounce", function($timeout) {
    return function(func, wait, options) {
      var args, delayed, inited, leading, result, thisArg, timeoutDeferred, trailing;
      args = null;
      inited = null;
      result = null;
      thisArg = null;
      timeoutDeferred = null;
      trailing = true;
      delayed = function() {
        inited = timeoutDeferred = null;
        if (trailing) {
          return result = func.apply(thisArg, args);
        }
      };
      if (options === true) {
        leading = true;
        trailing = false;
      } else if (options && angular.isObject(options)) {
        leading = options.leading;
        trailing = ("trailing" in options ? options.trailing : trailing);
      }
      return function() {
        args = arguments;
        thisArg = this;
        $timeout.cancel(timeoutDeferred);
        if (!inited && leading) {
          inited = true;
          result = func.apply(thisArg, args);
        } else {
          timeoutDeferred = $timeout(delayed, wait);
        }
        return result;
      };
    };
  });

  littb.factory("util", function($location) {
    var MOZ_HACK_REGEXP, PREFIX_REGEXP, SPECIAL_CHARS_REGEXP, camelCase, xml2Str;
    PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;
    SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
    MOZ_HACK_REGEXP = /^moz([A-Z])/;
    camelCase = function(name) {
      return name.replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
        if (offset) {
          return letter.toUpperCase();
        } else {
          return letter;
        }
      }).replace(MOZ_HACK_REGEXP, "Moz$1");
    };
    xml2Str = function(xmlNode) {
      var e;
      try {
        return (new XMLSerializer()).serializeToString(xmlNode);
      } catch (_error) {
        e = _error;
        try {
          return xmlNode.xml;
        } catch (_error) {
          e = _error;
          alert("Xmlserializer not supported");
        }
      }
      return false;
    };
    return {
      getInnerXML: function(elem) {
        var child, strArray;
        if ("jquery" in elem) {
          if (!elem.length) {
            return null;
          }
          elem = elem.get(0);
        }
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
      },
      normalize: function(name) {
        return camelCase(name.replace(PREFIX_REGEXP, ''));
      },
      setupHashComplex: function(scope, config) {
        var obj, onWatch, watch, _i, _len, _results;
        onWatch = function() {
          var obj, val, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = config.length; _i < _len; _i++) {
            obj = config[_i];
            val = $location.search()[obj.key];
            if (!val) {
              if (obj["default"]) {
                val = obj["default"];
              } else {
                continue;
              }
            }
            val = (obj.val_in || _.identity)(val);
            if ("scope_name" in obj) {
              _results.push(scope[obj.scope_name] = val);
            } else if ("scope_func" in obj) {
              _results.push(scope[obj.scope_func](val));
            } else {
              _results.push(scope[obj.key] = val);
            }
          }
          return _results;
        };
        onWatch();
        scope.loc = $location;
        scope.$watch('loc.search()', function() {
          return onWatch();
        });
        _results = [];
        for (_i = 0, _len = config.length; _i < _len; _i++) {
          obj = config[_i];
          watch = obj.expr || obj.scope_name || obj.key;
          _results.push(scope.$watch(watch, (function(obj, watch) {
            return function(val) {
              val = (obj.val_out || _.identity)(val);
              if (val === obj["default"]) {
                val = null;
              }
              $location.search(obj.key, val || null);
              return typeof obj.post_change === "function" ? obj.post_change(val) : void 0;
            };
          })(obj, watch)));
        }
        return _results;
      },
      setupHash: function() {
        var callback, name, nameConfig, names, scope, _i, _len, _ref, _results;
        scope = arguments[0], nameConfig = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
        names = _.map(nameConfig, function(item) {
          if (_.isObject(item)) {
            return (_.head(_.pairs(item)))[0];
          } else {
            return item;
          }
        });
        _.extend(scope, _.pick.apply(_, [$location.search()].concat(__slice.call(names))));
        scope.loc = $location;
        scope.$watch('loc.search()', function() {
          return _.extend(scope, _.pick.apply(_, [$location.search()].concat(__slice.call(names))));
        });
        _results = [];
        for (_i = 0, _len = nameConfig.length; _i < _len; _i++) {
          name = nameConfig[_i];
          if (_.isObject(name)) {
            _ref = _.head(_.pairs(name)), name = _ref[0], callback = _ref[1];
          }
          scope[name] = $location.search()[name];
          _results.push(scope.$watch(name, (function(name) {
            return function(val) {
              $location.search(name, val || null);
              if (callback) {
                return callback(val);
              }
            };
          })(name)));
        }
        return _results;
      }
    };
  });

  littb.factory('backend', function($http, $q, util) {
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
      return $http(_.merge(defaultConfig, config));
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
          _results.push([util.normalize(attrib.name), attrib.value]);
        }
        return _results;
      })());
    };
    parseWorkInfo = function(root, xml) {
      var asArray, elem, output, useInnerXML, val, _i, _len, _ref, _ref1, _ref2;
      useInnerXML = ["sourcedesc", "license-text"];
      asArray = ["mediatypes"];
      output = {};
      _ref = $(root, xml).children();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        if (_ref1 = elem.nodeName, __indexOf.call(useInnerXML, _ref1) >= 0) {
          val = util.getInnerXML(elem);
        } else if (_ref2 = elem.nodeName, __indexOf.call(asArray, _ref2) >= 0) {
          val = _.map($(elem).children(), function(child) {
            return $(child).text();
          });
        } else {
          val = $(elem).text();
        }
        output[util.normalize(elem.nodeName)] = val;
      }
      output.author_type = $(root + " > authorid", xml).attr("type");
      return output;
    };
    return {
      getHitParams: function(item) {
        var obj;
        if (item.mediatype === "faksimil") {
          obj = _.pick(item, "x", "y", "width", "height");
          return _(obj).pairs().invoke("join", "=").join("&");
        } else {
          return "traff=" + item.nodeid + "&traffslut=" + item.endnodeid;
        }
      },
      getTitles: function(allTitles, initial) {
        var def, params, workAction;
        if (allTitles == null) {
          allTitles = false;
        }
        if (initial == null) {
          initial = null;
        }
        def = $q.defer();
        workAction = "get-works";
        if (allTitles) {
          params = {
            action: "get-titles-by-string-filter",
            initial: initial
          };
        } else {
          params = {
            action: "get-works"
          };
        }
        http({
          url: "/query/lb-anthology.xql",
          params: params
        }).success(function(xml) {
          var elemList, itm, rows, workGroups, workid;
          workGroups = _.groupBy($("item", xml), function(item) {
            return $(item).attr("lbworkid") + $(item).find("author").attr("authorid");
          });
          rows = [];
          for (workid in workGroups) {
            elemList = workGroups[workid];
            itm = $(elemList[0]);
            if (!(objFromAttrs(itm.find("author").get(0)))) {
              c.log("author failed", itm);
            }
            rows.push({
              itemAttrs: objFromAttrs(elemList[0]),
              author: (objFromAttrs(itm.find("author").get(0))) || "",
              mediatype: _.unique(_.map(elemList, function(item) {
                return $(item).attr("mediatype");
              }))
            });
          }
          return def.resolve(rows);
        });
        return def.promise;
      },
      getAuthorList: function() {
        var def, url;
        def = $q.defer();
        url = "/query/lb-authors.xql?action=get-authors";
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
      getSourceInfo: function(author, title, mediatype) {
        var def, params, url;
        def = $q.defer();
        url = "/query/lb-anthology.xql";
        params = {
          action: "get-work-info-init",
          authorid: author,
          titlepath: title
        };
        if (mediatype) {
          params.mediatype = mediatype;
        }
        http({
          url: url,
          params: params
        }).success(function(xml) {
          var epub, errata, output, pdf, prov, sourcedesc, tr;
          output = parseWorkInfo("result", xml);
          prov = $("result provenance-data", xml);
          output["provenance"] = {
            text: $("text", prov).text(),
            image: $("image", prov).text(),
            link: $("link", prov).text()
          };
          sourcedesc = $("sourcedesc", xml);
          errata = $("errata", xml);
          output.errata = (function() {
            var _i, _len, _ref, _results;
            _ref = $("tr", errata);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              tr = _ref[_i];
              _results.push(_($(tr).find("td")).map(util.getInnerXML).map(_.str.strip).value());
            }
            return _results;
          })();
          errata.remove();
          output.sourcedesc = (util.getInnerXML(sourcedesc)) || "";
          epub = $("result epub", xml);
          if (epub.length) {
            output.epub = {
              file_size: epub.attr("file-size"),
              url: util.getInnerXML(epub)
            };
          }
          pdf = $("result pdf", xml);
          if (pdf.length) {
            output.pdf = {
              file_size: pdf.attr("file-size"),
              url: util.getInnerXML(pdf)
            };
          }
          return def.resolve(output);
        });
        return def.promise;
      },
      logPage: function(pageix, lbworkid, mediatype) {
        return http({
          url: "/query/lb-admin.xql",
          params: {
            action: "log-page-request",
            lbworkid: lbworkid,
            pageix: pageix,
            type: mediatype
          }
        });
      },
      getPage: function(author, title, mediatype, pagenum) {
        var def, params, url;
        def = $q.defer();
        url = "/query/lb-anthology.xql";
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
          var info, p, page, pgMap, _i, _len, _ref;
          info = parseWorkInfo("LBwork", xml);
          c.log("info", info);
          info["authorFullname"] = $("author-fullname", xml).text();
          info["showtitle"] = $("showtitle:first", xml).text();
          info["css"] = $("css", xml).text();
          pgMap = {};
          _ref = $("bok sida", xml);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            page = _ref[_i];
            p = $(page);
            pgMap["ix_" + p.attr("ix")] = p.attr("sidn");
            pgMap["page_" + p.attr("sidn")] = Number(p.attr("ix"));
          }
          info.pagemap = pgMap;
          info.parts = _.map($("parts > part", xml), objFromAttrs);
          info.mediatypes = (function() {
            var _j, _len1, _ref1, _results;
            _ref1 = $("mediatypes mediatype", xml);
            _results = [];
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              mediatype = _ref1[_j];
              _results.push(util.getInnerXML(mediatype));
            }
            return _results;
          })();
          return def.resolve([xml, info]);
        });
        return def.promise;
      },
      getAuthorInfo: function(author) {
        var def, url;
        def = $q.defer();
        url = "/query/lb-authors.xql";
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
              val = util.getInnerXML(elem);
            } else {
              val = $(elem).text();
            }
            authorInfo[util.normalize(elem.nodeName)] = val;
          }
          works = [];
          _ref1 = $("works item", xml);
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            item = _ref1[_j];
            obj = objFromAttrs(item);
            works.push(obj);
          }
          authorInfo.works = works;
          authorInfo.smallImage = util.getInnerXML($("image-small-uri", xml));
          authorInfo.largeImage = util.getInnerXML($("image-large-uri", xml));
          return def.resolve(authorInfo);
        });
        return def.promise;
      },
      getStats: function() {
        var def, url;
        def = $q.defer();
        url = "/query/lb-stats.xql";
        http({
          url: url,
          params: {
            action: "get-overall-stats"
          }
        }).success(function(xml) {
          var elem, output, parseObj, x, _i, _len, _ref, _ref1;
          output = {};
          parseObj = ["pages", "words"];
          if ($("table", xml).length > 1) {
            $("table", xml).last().remove();
          }
          _ref = $("result", xml).children();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            elem = _ref[_i];
            if (elem.tagName === "table") {
              c.log("table", elem, $("td:nth-child(2) a", elem));
              output.titleList = (function() {
                var _j, _len1, _ref1, _results;
                _ref1 = $("td:nth-child(2) a", elem);
                _results = [];
                for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                  x = _ref1[_j];
                  _results.push("<a href='#!/" + ($(x).attr('href').slice(3)) + "'>" + ($(x).text()) + "</a>");
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
        url = "/query/lb-anthology.xql";
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
      searchWorks: function(query, mediatype, resultitem, resultlength, selectedAuthor, selectedTitle) {
        var def, domain, url;
        def = $q.defer();
        url = "/query/lb-search.xql";
        domain = "<item type='all-titles' mediatype='" + mediatype + "'></item>";
        if (selectedAuthor) {
          domain = "<item type='author' mediatype='" + mediatype + "'>" + selectedAuthor + "</item>";
        }
        if (selectedTitle) {
          domain = "<item type='titlepath' mediatype='" + mediatype + "'>" + selectedTitle + "</item>";
        }
        http({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "text/xml; charset=utf-8"
          },
          params: {
            action: "search"
          },
          data: "<search>\n    <string-filter>\n        <item type=\"string\">" + query + "|</item>\n    </string-filter>\n<domain-filter>\n    " + domain + "\n</domain-filter>\n<ne-filter>\n    <item type=\"NUL\"></item>\n</ne-filter>\n</search>"
        }).success(function(data) {
          var ref;
          c.log("success", $("result", data).attr("ref"));
          ref = $("result", data).attr("ref");
          return http({
            url: url,
            params: {
              action: "get-result-set",
              searchref: ref,
              resultlength: resultlength,
              resultitem: resultitem + 1
            }
          }).success(function(resultset) {
            var elem, kw, left, output, right, work, _i, _len, _ref, _ref1;
            c.log("get-result-set success", resultset, $("result", resultset).children());
            output = {
              kwic: [],
              count: parseInt($("result", resultset).attr("count"))
            };
            _ref = $("result", resultset).children();
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              elem = _ref[_i];
              _ref1 = _.map($(elem).children(), $), left = _ref1[0], kw = _ref1[1], right = _ref1[2], work = _ref1[3];
              output.kwic.push({
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
      },
      searchLexicon: function(str, useWildcard, searchId, strict) {
        var def, params, suffix, url;
        def = $q.defer();
        url = "/query/so.xql";
        c.log("searchId", searchId);
        if (searchId) {
          params = {
            id: str
          };
        } else {
          suffix = useWildcard && str.length > 3 ? "*" : "";
          params = {
            word: str + suffix
          };
        }
        if (strict) {
          params['strict'] = true;
        }
        http({
          url: url,
          params: params
        }).success(function(xml) {
          var article, output;
          c.log("searchLexicon success", xml);
          output = (function() {
            var _i, _len, _ref, _results;
            _ref = $("artikel", xml);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              article = _ref[_i];
              _results.push({
                baseform: $("grundform-clean:first", article).text(),
                lexemes: util.getInnerXML(article)
              });
            }
            return _results;
          })();
          return def.resolve(output);
        }).error(function() {
          return def.reject();
        });
        return def.promise;
      },
      getBiblinfo: function(params, wf) {
        var def, url;
        def = $q.defer();
        url = "http://demolittb.spraakdata.gu.se/sla-bibliografi/?" + params;
        $http({
          url: url,
          method: "GET",
          params: {
            username: "app",
            wf: wf
          }
        }).success(function(xml) {
          var entry, output;
          output = (function() {
            var _i, _len, _ref, _results;
            _ref = $("entry", xml);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              entry = _ref[_i];
              _results.push({
                title: util.getInnerXML($("title", entry)),
                isbn: util.getInnerXML($("isbn", entry)),
                issn: util.getInnerXML($("issn", entry)),
                archive: util.getInnerXML($("manusarchive ArchiveID", entry))
              });
            }
            return _results;
          })();
          return def.resolve(output);
        });
        return def.promise;
      },
      submitContactForm: function(name, email, message) {
        var def, params, url;
        def = $q.defer();
        url = "query/lb-contact.xql";
        params = {
          action: "contact-test",
          lang: "swe",
          ContactName: name,
          ContactEmail: email,
          ContactMessage: message
        };
        http({
          url: url,
          params: params
        }).success(def.resolve).error(def.reject);
        return def.promise;
      }
    };
  });

}).call(this);
