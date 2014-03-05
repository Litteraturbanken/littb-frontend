(function() {
  var littb,
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  littb = angular.module('littbApp');

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
              var loc;
              val = (obj.val_out || _.identity)(val);
              if (val === obj["default"]) {
                val = null;
              }
              loc = $location.search(obj.key, val || null);
              if (obj.replace !== false) {
                loc.replace();
              }
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
    var http, objFromAttrs, parseWorkInfo, parseXML;
    parseXML = function(data) {
      var e, tmp, xml;
      xml = null;
      tmp = null;
      if (!data || typeof data !== "string") {
        return null;
      }
      try {
        if (window.DOMParser) {
          tmp = new DOMParser();
          xml = tmp.parseFromString(data, "text/xml");
        } else {
          xml = new ActiveXObject("Microsoft.XMLDOM");
          xml.async = "false";
          xml.loadXML(data);
        }
      } catch (_error) {
        e = _error;
        xml = 'undefined';
      }
      if (!xml || !xml.documentElement || xml.getElementsByTagName("parsererror").length) {
        jQuery.error("Invalid XML: " + data);
      }
      return xml;
    };
    http = function(config) {
      var defaultConfig;
      defaultConfig = {
        method: "GET",
        params: {
          username: "app"
        },
        transformResponse: function(data, headers) {
          var output;
          output = parseXML(data);
          if ($("fel", output).length) {
            c.log("xml parse error:", $("fel", output).text());
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
      var asArray, elem, output, useInnerXML, val, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4;
      useInnerXML = ["sourcedesc", "workintro", "license-text"];
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
        } else if ((_ref3 = elem.nodeName) === "authorid" || _ref3 === "authorid-norm") {
          val = {
            id: $(elem).text(),
            type: $(elem).attr("type")
          };
          ((_ref4 = output[util.normalize(elem.nodeName)]) != null ? _ref4.push(val) : void 0) || (output[util.normalize(elem.nodeName)] = [val]);
          continue;
        } else {
          val = $(elem).text();
        }
        output[util.normalize(elem.nodeName)] = val;
      }
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
      getTitles: function(allTitles, initial, string) {
        var def, params;
        if (allTitles == null) {
          allTitles = false;
        }
        if (initial == null) {
          initial = null;
        }
        if (string == null) {
          string = null;
        }
        def = $q.defer();
        if (allTitles) {
          params = {
            action: "get-titles-by-string-filter"
          };
          if (initial) {
            params.initial = initial;
          }
          if (string) {
            params.string = string;
          }
        } else {
          params = {
            action: "get-works"
          };
        }
        http({
          url: "/query/lb-anthology.xql",
          params: params
        }).success(function(xml) {
          var elemList, itm, path, pathGroups, rows;
          pathGroups = _.groupBy($("item", xml), function(item) {
            var author;
            author = $(item).find("author").attr("authorid");
            return author + $(item).attr("titlepath").split("/");
          });
          rows = [];
          for (path in pathGroups) {
            elemList = pathGroups[path];
            itm = elemList[0];
            if (!(objFromAttrs($(itm).find("author").get(0)))) {
              c.log("author failed", itm);
            }
            rows.push({
              itemAttrs: objFromAttrs(itm),
              author: (objFromAttrs($(itm).find("author").get(0))) || "",
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
      getPage: function(passedParams) {
        var def, params, url;
        def = $q.defer();
        url = "/query/lb-anthology.xql";
        params = {
          action: "get-work-data-init",
          navinfo: true,
          css: true,
          workdb: true
        };
        http({
          url: url,
          cache: true,
          params: _.extend({}, params, passedParams)
        }).success(function(xml) {
          var info, mediatype, p, page, pgMap, _i, _len, _ref;
          info = parseWorkInfo("LBwork", xml);
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
          info.parts = _.filter(info.parts, function(item) {
            return __indexOf.call(item.id, "/") >= 0;
          });
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
        }).error(function() {
          return def.reject.apply(def, arguments);
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
          var authorInfo, elem, parseWorks, ref, val, _i, _len, _ref;
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
          parseWorks = function(selector) {
            var item, obj, titles, _j, _len1, _ref1;
            titles = [];
            _ref1 = $(selector, xml);
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              item = _ref1[_j];
              obj = objFromAttrs(item);
              titles.push(_.extend(obj, objFromAttrs($(item).find("author").get(0))));
            }
            return titles;
          };
          authorInfo.works = parseWorks("works item");
          authorInfo.titles = parseWorks("titles item");
          authorInfo.smallImage = util.getInnerXML($("image-small-uri", xml));
          authorInfo.largeImage = util.getInnerXML($("image-large-uri", xml));
          authorInfo.presentation = util.getInnerXML($("presentation-uri", xml));
          authorInfo.bibliografi = util.getInnerXML($("bibliography-uri", xml));
          authorInfo.semer = util.getInnerXML($("see-uri", xml));
          authorInfo.externalref = (function() {
            var _j, _len1, _ref1, _results;
            _ref1 = $("LBauthor external-ref", xml);
            _results = [];
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              ref = _ref1[_j];
              _results.push({
                label: util.getInnerXML($("label", ref)),
                url: util.getInnerXML($("url", ref))
              });
            }
            return _results;
          })();
          return def.resolve(authorInfo);
        }).error(function(data, status, headers, config) {
          return def.reject();
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
      searchWorks: function(query, mediatype, from, to, selectedAuthor, selectedTitle, prefix, suffix) {
        var def, pre, regescape, suf, tokenList, tokenize, wd, _i, _len, _ref;
        c.log("searchvars", query, mediatype, from, to, selectedAuthor, selectedTitle);
        def = $q.defer();
        tokenList = [];
        regescape = function(s) {
          return s.replace(/[\.|\?|\+|\*|\|\'|\"\(\)\^\$]/g, "\\$&");
        };
        tokenize = function(str) {
          var extras, wd, wdlist;
          wdlist = (function() {
            var _i, _len, _ref, _results;
            _ref = query.split(/\s+/);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              wd = _ref[_i];
              extras = [];
              if (wd.match(/\.\.\./)) {
                extras.push("...");
                wd = wd.replace(/(\.\.\.)/, "");
              }
              wd = wd.replace(/([\.,;:])/g, " $1");
              wd = wd.replace(/([-])/g, " $1 ");
              wd = wd.replace(/([»])/g, "$1 ");
              _results.push(wd.split(" "));
            }
            return _results;
          })();
          return _.compact([].concat(_.flatten(wdlist), extras));
        };
        _ref = tokenize(query);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          wd = _ref[_i];
          pre = suf = "";
          if (prefix) {
            pre = ".*";
          }
          if (suffix) {
            suf = ".*";
          }
          tokenList.push("word = '" + suf + (regescape(wd)) + pre + "' %c");
        }
        if (selectedAuthor) {
          tokenList[0] += " & _.text_authorid contains '" + selectedAuthor + "'";
        }
        if (selectedTitle) {
          tokenList[0] += " & _.text_lbworkid = '" + selectedTitle + "'";
        }
        if (mediatype === "all") {
          tokenList[0] += " & (_.text_mediatype = 'faksimil' | _.text_mediatype = 'etext')";
        } else {
          tokenList[0] += " & _.text_mediatype = '" + mediatype + "'";
        }
        $http({
          url: "http://spraakbanken.gu.se/ws/korp",
          method: "GET",
          cache: true,
          params: {
            command: "query",
            cqp: "[" + (tokenList.join('] [')) + "]",
            show: "wid,x,y,width,height",
            show_struct: "page_n,text_lbworkid,text_author,text_authorid,text_title,text_shorttitle,text_titlepath,text_nameforindex,text_mediatype,text_date,page_size",
            corpus: "LBSOK",
            start: from,
            end: to
          }
        }).success(function(data) {
          return def.resolve(data);
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
                id: $("lemma", article).first().attr("id"),
                lexemes: util.getInnerXML(article)
              });
            }
            return _results;
          })();
          window.output = output;
          output = _.sortBy(output, function(item) {
            if (item.baseform === str) {
              return "aaaaaaaaa";
            }
            return item.baseform.toLowerCase();
          });
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

  littb.factory("authors", function(backend, $q) {
    var def,
      _this = this;
    def = $q.defer();
    backend.getAuthorList().then(function(authors) {
      var authorsById;
      authorsById = _.object(_.map(authors, function(item) {
        return [item.authorid, item];
      }));
      return def.resolve([authors, authorsById]);
    });
    return def.promise;
  });

  littb.factory("searchData", function(backend, $q) {
    var NUM_HITS, SearchData;
    NUM_HITS = 20;
    SearchData = (function() {
      function SearchData() {
        this.data = [];
        this.total_hits = null;
        this.current = null;
      }

      SearchData.prototype.parseUrls = function(row, matches) {
        var author, group, itm, makeParams, matchGroups, matchParams, mediatype, merged, titleid, _i, _len, _ref;
        itm = row.structs;
        mediatype = itm.text_mediatype;
        matches = row.tokens.slice(row.match.start, row.match.end);
        matchParams = [];
        if (mediatype === "faksimil") {
          matchGroups = _.groupBy(matches, "y");
          makeParams = function(group) {
            var factors, key, match, max, params, sizeVals, val, _i, _len;
            params = _.pick(group[0], "x", "y", "height");
            for (_i = 0, _len = group.length; _i < _len; _i++) {
              match = group[_i];
              if (!params.width) {
                params.width = Number(match.width);
              } else {
                params.width += Number(match.width);
              }
            }
            max = Math.max.apply(Math, itm.page_size.split("x"));
            sizeVals = [625, 750, 1100, 1500, 2050];
            factors = _.map(sizeVals, function(val) {
              return val / max;
            });
            for (key in params) {
              val = params[key];
              params[key] = _(factors).map(function(fact) {
                return Math.round(fact * val);
              }).join(",");
            }
            return params;
          };
          _ref = _.values(matchGroups);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            group = _ref[_i];
            matchParams.push(makeParams(group));
          }
        } else {
          matchParams.push({
            traff: matches[0].wid,
            traffslut: _.last(matches).wid
          });
        }
        merged = _(matchParams).reduce(function(obj1, obj2) {
          if (!obj1) {
            return {};
          }
          return _.merge({}, obj1, obj2, function(a, b) {
            if (!a) {
              return b;
            }
            return a + "|" + b;
          });
        });
        merged = _(merged).pairs().invoke("join", "=").join("&");
        author = _.str.trim(itm.text_authorid, "|").split("|")[0];
        titleid = itm.text_titlepath;
        return ("/#!/forfattare/" + author + "/titlar/" + titleid) + ("/sida/" + itm.page_n + "/" + itm.text_mediatype + "?" + merged);
      };

      SearchData.prototype.save = function(startIndex, currentIndex, input, search_args) {
        this.searchArgs = search_args;
        this.data = new Array(input.count);
        this.appendData(startIndex, input);
        this.total_hits = input.count;
        return this.current = currentIndex;
      };

      SearchData.prototype.appendData = function(startIndex, data) {
        var _ref;
        return ([].splice.apply(this.data, [startIndex, data.kwic.length - startIndex + 1].concat(_ref = _.map(data.kwic, this.parseUrls))), _ref);
      };

      SearchData.prototype.next = function() {
        this.current++;
        return this.search();
      };

      SearchData.prototype.prev = function() {
        this.current--;
        return this.search();
      };

      SearchData.prototype.search = function() {
        var args, current_page, def,
          _this = this;
        def = $q.defer();
        c.log("search", this.current);
        if (this.data[this.current] != null) {
          def.resolve(this.data[this.current]);
        } else {
          current_page = Math.floor(this.current / NUM_HITS);
          args = [].concat(this.searchArgs, [current_page + 1, NUM_HITS]);
          backend.searchWorks.apply(backend, args).then(function(data) {
            _this.appendData(_this.current, data);
            return def.resolve(_this.data[_this.current]);
          });
        }
        return def.promise;
      };

      SearchData.prototype.reset = function() {
        this.current = null;
        this.total_hits = null;
        this.data = [];
        return this.searchArgs = null;
      };

      return SearchData;

    })();
    return new SearchData();
  });

}).call(this);

/*
//@ sourceMappingURL=services.js.map
*/