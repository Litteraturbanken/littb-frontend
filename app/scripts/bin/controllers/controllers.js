(function() {
  'use strict';
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __slice = [].slice;

  window.c = typeof console !== "undefined" && console !== null ? console : {
    log: _.noop
  };

  littb.controller("startCtrl", function($scope, $location) {
    return $scope.gotoTitle = function(query) {
      var url;
      if (!query) {
        url = "/titlar";
      } else {
        url = "/titlar?filter=" + query + "&selectedLetter=" + (query[0].toUpperCase());
      }
      return $scope.goto(url);
    };
  });

  littb.controller("contactFormCtrl", function($scope, backend, $timeout) {
    var done, err, s;
    s = $scope;
    s.showContact = false;
    s.showNewsletter = false;
    s.showError = false;
    done = function() {
      return $timeout(function() {
        s.showContact = false;
        return s.showNewsletter = false;
      }, 4000);
    };
    err = function() {
      s.showError = true;
      s.showContact = false;
      s.showNewsletter = false;
      return $timeout(function() {
        return s.showError = false;
      }, 4000);
    };
    s.submitContactForm = function() {
      return backend.submitContactForm(s.name, s.email, s.message).then(function() {
        s.showContact = true;
        return done();
      }, err);
    };
    return s.subscribe = function() {
      var msg;
      msg = s.newsletterEmail + " vill bli tillagd på utskickslistan.";
      return backend.submitContactForm("Utskickslista", s.newsletterEmail, msg).then(function() {
        s.showNewsletter = true;
        return done();
      }, err);
    };
  });

  littb.controller("statsCtrl", function($scope, backend) {
    var s;
    s = $scope;
    return backend.getStats().then(function(data) {
      return s.data = data;
    });
  });

  littb.controller("searchCtrl", function($scope, backend, $location, util, searchData) {
    var getMediatypes, queryvars, s;
    s = $scope;
    s.open = false;
    s.searchProofread = true;
    s.searchNonProofread = true;
    s.authors = backend.getAuthorList();
    s.searching = false;
    s.num_hits = 20;
    s.current_page = 0;
    getMediatypes = function() {
      var mediatype;
      mediatype = [s.searchProofread && "etext", s.searchNonProofread && "faksimil"];
      if (_.all(mediatype)) {
        mediatype = "all";
      } else {
        mediatype = _.filter(mediatype, Boolean);
      }
      return mediatype;
    };
    s.$watch("selected_author", function(newAuthor, prevVal) {
      if (!newAuthor) {
        return;
      }
      return s.titles = backend.getTitlesByAuthor(newAuthor.authorid);
    });
    s.nextPage = function() {
      s.current_page++;
      return s.search(s.query);
    };
    s.prevPage = function() {
      s.current_page--;
      return s.search(s.query);
    };
    s.firstPage = function() {
      s.current_page = 0;
      return s.search(s.query);
    };
    s.lastPage = function() {
      s.current_page = s.total_pages;
      return s.search(s.query);
    };
    s.save_search = function(startIndex, currentIndex, data) {
      return searchData.save(startIndex, currentIndex, data, [s.query, getMediatypes()]);
    };
    s.getItems = function() {
      return _.pluck("item", data.kwic);
    };
    s.search = function(query) {
      var mediatype, q;
      q = query || s.query;
      if (q) {
        $location.search("fras", q);
      }
      s.query = q;
      s.searching = true;
      mediatype = getMediatypes();
      return backend.searchWorks(s.query, mediatype, s.current_page * s.num_hits, s.num_hits).then(function(data) {
        var itm, row, _i, _len, _ref, _results;
        s.data = data;
        s.total_pages = Math.ceil(data.count / s.num_hits);
        s.searching = false;
        _ref = data.kwic;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          row = _ref[_i];
          itm = row.item;
          _results.push(row.href = ("#!/forfattare/" + itm.authorid + "/titlar/" + itm.titleidNew) + ("/sida/" + itm.pagename + "/" + itm.mediatype + "?" + (backend.getHitParams(itm))));
        }
        return _results;
      });
    };
    queryvars = $location.search();
    util.setupHashComplex(s, [
      {
        scope_name: "current_page",
        key: "traffsida",
        val_in: Number
      }
    ]);
    if ("fras" in queryvars) {
      return s.search(queryvars.fras);
    }
  });

  littb.controller("lagerlofCtrl", function($scope, $rootScope, backend) {
    var s;
    s = $scope;
    s.author = "LagerlofS";
    return backend.getAuthorInfo(s.author).then(function(data) {
      s.authorInfo = data;
      s.groupedWorks = _.values(_.groupBy(s.authorInfo.works, "lbworkid"));
      return $rootScope.appendCrumb(data.surname);
    });
  });

  littb.controller("biblinfoCtrl", function($scope, backend) {
    var limit, s;
    s = $scope;
    limit = true;
    s.showHit = 0;
    s.searching = false;
    s.showAll = function() {
      return limit = false;
    };
    s.increment = function() {
      var _ref;
      limit = true;
      return ((_ref = s.entries) != null ? _ref[s.showHit + 1] : void 0) && s.showHit++;
    };
    s.decrement = function() {
      limit = true;
      return s.showHit && s.showHit--;
    };
    s.getEntries = function() {
      var _ref;
      if (limit) {
        return [(_ref = s.entries) != null ? _ref[s.showHit] : void 0];
      } else {
        return s.entries;
      }
    };
    s.getColumn1 = function(entry) {
      var pairs, splitAt;
      pairs = _.pairs(entry);
      splitAt = Math.floor(pairs.length / 2);
      return _.object(pairs.slice(0, +splitAt + 1 || 9e9));
    };
    s.getColumn2 = function(entry) {
      var pairs, splitAt;
      pairs = _.pairs(entry);
      splitAt = Math.floor(pairs.length / 2);
      return _.object(pairs.slice(splitAt + 1));
    };
    s.submit = function() {
      var names, params, wf, x;
      names = ["manus", "tryckt_material", "annat_tryckt", "forskning"];
      params = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = names.length; _i < _len; _i++) {
          x = names[_i];
          if (s[x]) {
            _results.push("resurs=" + x);
          }
        }
        return _results;
      })();
      if (wf) {
        wf = s.wf;
      }
      s.searching = true;
      return backend.getBiblinfo(params.join("&"), wf).then(function(data) {
        s.entries = data;
        s.num_hits = data.length;
        return s.searching = false;
      });
    };
    return s.submit();
  });

  littb.controller("authorInfoCtrl", function($scope, $rootScope, backend, $routeParams) {
    var s;
    s = $scope;
    _.extend(s, $routeParams);
    return backend.getAuthorInfo(s.author).then(function(data) {
      s.authorInfo = data;
      s.groupedWorks = _.values(_.groupBy(s.authorInfo.works, "lbworkid"));
      return $rootScope.appendCrumb(data.surname);
    });
  });

  littb.controller("titleListCtrl", function($scope, backend, util, $timeout, $location) {
    var fetchWorks, s;
    s = $scope;
    s.searching = false;
    s.getTitleTooltip = function(attrs) {
      if (!attrs) {
        return;
      }
      if (attrs.showtitle !== attrs.title) {
        return attrs.title;
      }
    };
    s.sorttuple = ["itemAttrs.showtitle", false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    s.selectWork = function() {
      c.log("selectWork", s.workFilter);
      if (s.workFilter === "titles") {
        s.authorFilter = null;
        s.mediatypeFilter = "";
        s.filter = null;
      }
      return fetchWorks();
    };
    fetchWorks = function() {
      s.searching = true;
      return backend.getTitles(s.workFilter === "titles", s.selectedLetter || "A").then(function(titleArray) {
        var authors;
        s.searching = false;
        window.titleArray = titleArray;
        s.rowByLetter = _.groupBy(titleArray, function(item) {
          return item.itemAttrs.showtitle[0];
        });
        if (s.workFilter === "titles") {
          s.currentLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("");
        } else {
          s.currentLetters = _.keys(s.rowByLetter);
        }
        authors = _.pluck(titleArray, "author");
        return s.authorData = _.unique(authors, false, function(item) {
          return item.authorid;
        });
      });
    };
    util.setupHashComplex(s, [
      {
        expr: "sorttuple[0]",
        scope_func: "setSort",
        key: "sortering",
        "default": "itemAttrs.showtitle"
      }, {
        expr: "sorttuple[1]",
        scope_func: "setDir",
        key: "fallande"
      }, {
        key: "filter"
      }, {
        key: "niva",
        scope_name: "workFilter",
        "default": "works"
      }, {
        key: "mediatypeFilter"
      }, {
        key: "index",
        scope_name: "selectedLetter",
        "default": "A",
        post_change: function(val) {
          c.log("val_in", val);
          if (s.workFilter === "titles") {
            fetchWorks();
          }
          return val;
        }
      }
    ]);
    if (!s.selectedLetter) {
      s.selectedLetter = "A";
    }
    c.log("workfilter", s.workFilter);
    return fetchWorks();
  });

  littb.controller("epubListCtrl", function($scope, backend, util) {
    var s;
    s = $scope;
    s.sorttuple = ["author.nameforindex", false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    window.has = function(one, two) {
      return one.toLowerCase().indexOf(two) !== -1;
    };
    s.rowFilter = function(item) {
      if (__indexOf.call(item.mediatype, "epub") < 0) {
        return false;
      }
      if (s.authorFilter && s.authorFilter.authorid !== item.author.authorid) {
        return false;
      }
      if (s.filterTxt) {
        if (!((has(item.author.fullname, s.filterTxt)) || (has(item.itemAttrs.showtitle, s.filterTxt)))) {
          return false;
        }
      }
      return true;
    };
    s.getAuthor = function(row) {
      var first, last, _ref;
      _ref = row.author.nameforindex.split(","), last = _ref[0], first = _ref[1];
      return [last.toUpperCase(), first].join(",");
    };
    util.setupHashComplex(s, [
      {
        expr: "sorttuple[0]",
        scope_func: "setSort",
        key: "sortering",
        "default": "author.nameforindex"
      }, {
        expr: "sorttuple[1]",
        scope_func: "setDir",
        key: "fallande"
      }, {
        key: "filter",
        scope_name: "filterTxt"
      }
    ]);
    return backend.getTitles().then(function(titleArray) {
      var authors;
      s.rows = _.filter(titleArray, function(item) {
        return __indexOf.call(item.mediatype, "epub") >= 0;
      });
      authors = _.pluck(s.rows, "author");
      s.authorData = _.unique(authors, false, function(item) {
        return item.authorid;
      });
      s.currentLetters = _.unique(_.map(titleArray, function(item) {
        return item.author.nameforindex[0];
      }));
      return util.setupHash(s, "selectedLetter");
    });
  });

  littb.controller("helpCtrl", function($scope, $http, util, $location) {
    var s, url;
    s = $scope;
    url = "/red/om/hjalp/hjalp.html";
    return $http.get(url).success(function(data) {
      var elem;
      s.htmlContent = data;
      s.labelArray = (function() {
        var _i, _len, _ref, _results;
        _ref = $("[id]", data);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          elem = _ref[_i];
          _results.push({
            label: $(elem).text(),
            id: $(elem).attr("id")
          });
        }
        return _results;
      })();
      return util.setupHashComplex(s, [
        {
          "key": "ankare",
          post_change: function(val) {
            c.log("post_change", val);
            if (!(val && $("#" + val).length)) {
              $(window).scrollTop(0);
              return;
            }
            return $(window).scrollTop($("#" + val).offset().top);
          }
        }
      ]);
    });
  });

  littb.controller("presentationCtrl", function($scope, $http, $routeParams, $location, util) {
    var s, url;
    s = $scope;
    url = '/red/presentationer/presentationerForfattare.html';
    return $http.get(url).success(function(data) {
      var elem;
      s.doc = data;
      s.currentLetters = (function() {
        var _i, _len, _ref, _results;
        _ref = $("[id]", data);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          elem = _ref[_i];
          _results.push($(elem).attr("id"));
        }
        return _results;
      })();
      return util.setupHash(s, {
        "ankare": function(val) {
          if (!val) {
            $(window).scrollTop(0);
            return;
          }
          return $(window).scrollTop($("#" + val).offset().top);
        }
      });
    });
  });

  littb.controller("authorListCtrl", function($scope, backend, util) {
    var s;
    s = $scope;
    s.sorttuple = ["nameforindex", false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    util.setupHashComplex(s, [
      {
        expr: "sorttuple[0]",
        scope_func: "setSort",
        key: "sortering",
        "default": "nameforindex"
      }, {
        expr: "sorttuple[1]",
        scope_func: "setDir",
        key: "fallande"
      }, {
        key: "authorFilter"
      }
    ]);
    backend.getAuthorList().then(function(data) {
      s.authorIdGroup = _.groupBy(data, function(item) {
        return item.authorid;
      });
      s.authorIdGroup[""] = "";
      s.rows = data;
      s.rowByLetter = _.groupBy(data, function(item) {
        return item.nameforindex[0];
      });
      return s.currentLetters = _.keys(s.rowByLetter);
    });
    return s.getAuthor = function(row) {
      var first, last, _ref;
      _ref = row.nameforindex.split(","), last = _ref[0], first = _ref[1];
      last = last.toUpperCase();
      if (first) {
        return last + "," + first;
      } else {
        return last;
      }
    };
  });

  littb.filter("correctLink", function() {
    return function(html) {
      var img, wrapper;
      wrapper = $("<div>").append(html);
      img = $("img", wrapper);
      img.attr("src", "/red/bilder/gemensamt/" + img.attr("src"));
      return wrapper.html();
    };
  });

  littb.controller("idCtrl", function($scope, backend, $routeParams) {
    var s;
    s = $scope;
    _.extend(s, $routeParams);
    if (!_.str.startsWith(s.id, "lb")) {
      s.title = s.id;
      s.id = "";
    }
    return backend.getTitles().then(function(titleArray) {
      return s.data = titleArray;
    });
  });

  littb.controller("sourceInfoCtrl", function($scope, backend, $routeParams, $q) {
    var author, infoDef, mediatype, s, title;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype;
    _.extend(s, $routeParams);
    s.defaultErrataLimit = 8;
    s.errataLimit = s.defaultErrataLimit;
    s.isOpen = false;
    s.toggleErrata = function() {
      s.errataLimit = s.isOpen ? 8 : 1000;
      return s.isOpen = !s.isOpen;
    };
    s.getUrl = function(mediatype) {
      if (mediatype === "epub") {
        return s.data.epub.url;
      } else if (mediatype === "pdf") {
        return s.data.pdf.url;
      }
      return "#!/forfattare/" + s.author + "/titlar/" + s.title + "/" + s.mediatype;
    };
    s.getOtherMediatypes = function() {
      var x, _i, _len, _ref, _ref1, _results;
      _ref1 = ((_ref = s.data) != null ? _ref.mediatypes : void 0) || [];
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        x = _ref1[_i];
        if (x !== s.mediatype) {
          _results.push(x);
        }
      }
      return _results;
    };
    s.getMediatypeUrl = function(mediatype) {
      var _ref;
      if (mediatype === "epub") {
        return (_ref = s.data) != null ? _ref.epub.url : void 0;
      } else {
        return "#!/forfattare/" + s.author + "/titlar/" + s.title + "/" + mediatype;
      }
    };
    infoDef = backend.getSourceInfo(author, title, mediatype);
    infoDef.then(function(data) {
      s.init = true;
      s.data = data;
      if (!s.mediatype) {
        return s.mediatype = s.data.mediatypes[0];
      }
    });
    return $q.all([backend.getAuthorList(), infoDef]).then(function(_arg) {
      var authorData, infoData, item, _i, _len, _results;
      authorData = _arg[0], infoData = _arg[1];
      c.log("authorData", arguments);
      _results = [];
      for (_i = 0, _len = authorData.length; _i < _len; _i++) {
        item = authorData[_i];
        if (item.authorid === author) {
          s.appendCrumb([
            {
              label: item.nameforindex.split(",")[0],
              url: "#!/forfattare/" + author
            }, {
              label: "titlar",
              url: "#!/forfattare/" + author + "/titlar"
            }, {
              label: infoData.titlepath + " info " + (s.mediatype || "")
            }
          ]);
          break;
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    });
  });

  littb.controller("readingCtrl", function($scope, backend, $routeParams, $route, $location, util, searchData, debounce) {
    var author, loadPage, mediatype, pagename, s, title, watches;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype, pagename = $routeParams.pagename;
    _.extend(s, _.omit($routeParams, "traff", "traffslut", "x", "y", "height", "width", "parallel"));
    s.searchData = searchData;
    s.nextHit = function() {
      return searchData.next().then(function(newUrl) {
        return $location.url(newUrl);
      });
    };
    s.prevHit = function() {
      return searchData.prev().then(function(newUrl) {
        return $location.url(newUrl);
      });
    };
    s.close_hits = function() {
      searchData.reset();
      $location.search("traff", null);
      return $location.search("traffslut", null);
    };
    s.pagename = pagename;
    s.opts = {
      backdropFade: true,
      dialogFade: true
    };
    s.$on("search_dict", function(event, query) {
      return backend.searchLexicon(query).then(function(data) {
        var obj, _i, _len, _results;
        c.log("search_dict", data);
        _results = [];
        for (_i = 0, _len = data.length; _i < _len; _i++) {
          obj = data[_i];
          if (obj.baseform === query) {
            s.lex_article = obj;
            break;
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
    });
    s.getPage = function() {
      return $route.current.pathParams.pagename;
    };
    s.setPage = function(ix) {
      s.pageix = ix;
      return s.pagename = s.pagemap["ix_" + s.pageix];
    };
    s.nextPage = function() {
      var newix;
      newix = s.pageix + 1;
      if ("ix_" + newix in s.pagemap) {
        return s.setPage(newix);
      } else {
        return s.setPage(0);
      }
    };
    s.prevPage = function() {
      var newix;
      newix = s.pageix - 1;
      if ("ix_" + newix in s.pagemap) {
        return s.setPage(newix);
      } else {
        return s.setPage(0);
      }
    };
    s.firstPage = function() {
      return s.setPage(0);
    };
    s.lastPage = function() {
      var ix;
      ix = s.pagemap["page_" + s.endpage];
      return s.setPage(ix);
    };
    s.gotopage = function(page) {
      var ix;
      ix = s.pagemap["page_" + page];
      return s.setPage(ix);
    };
    s.mouseover = function() {
      c.log("mouseover");
      return s.showPopup = true;
    };
    s.getWords = function(val) {
      return backend.searchLexicon(val);
    };
    s.getTooltip = function(part) {
      if (part.navtitle !== part.showtitle) {
        return part.navtitle;
      }
    };
    s.toggleParallel = function() {
      return s.isParallel = !s.isParallel;
    };
    s.supportsParallel = function() {
      if (!s.workinfo) {
        return;
      }
      return __indexOf.call(s.workinfo.mediatypes, 'etext') >= 0 && __indexOf.call(s.workinfo.mediatypes, 'faksimil') >= 0;
    };
    util.setupHashComplex(s, [
      {
        scope_name: "markee_from",
        key: "traff"
      }, {
        scope_name: "markee_to",
        key: "traffslut"
      }, {
        key: "x"
      }, {
        key: "y"
      }, {
        key: "width"
      }, {
        key: "height"
      }, {
        key: "parallel",
        scope_name: "isParallel"
      }
    ]);
    watches = [];
    watches.push(s.$watch("pagename", function(val) {
      var loc, prevpath, url;
      if (val == null) {
        return;
      }
      s.displaynum = val;
      url = "/forfattare/" + author + "/titlar/" + title + "/sida/" + val + "/" + mediatype;
      prevpath = $location.path();
      loc = $location.path(url);
      if (!_.str.contains(prevpath, "/sida/")) {
        c.log("replace", prevpath);
        return loc.replace();
      }
    }));
    s.isDefined = angular.isDefined;
    loadPage = function(val) {
      c.log("loadPage", val);
      s.pagename = val;
      return backend.getPage(author, title, mediatype, s.pagename).then(function(_arg) {
        var data, page, url, workinfo, _i, _len, _ref;
        data = _arg[0], workinfo = _arg[1];
        s.workinfo = workinfo;
        s.pagemap = workinfo.pagemap;
        s.startpage = Number(workinfo.startpagename);
        s.endpage = Number(workinfo.endpagename);
        page = $("page[name=" + s.pagename + "]", data).last().clone();
        if (!page.length) {
          page = $("page:last", data).clone();
          s.pagename = page.attr("name");
        }
        s.pageix = s.pagemap["page_" + s.pagename];
        s.sizes = new Array(5);
        _ref = $("faksimil-url", page);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          url = _ref[_i];
          s.sizes[Number($(url).attr("size")) - 1] = false;
        }
        if (s.sizes[s.size] === false) {
          s.sizes[s.size] = true;
        }
        s.url = $("faksimil-url[size=" + (s.size + 1) + "]", page).last().text();
        page.children().remove();
        return s.etext_html = page.text();
      });
    };
    s.size = 2;
    s.setSize = function(index) {
      s.sizes = _.map(s.sizes, function(item) {
        if (item) {
          return false;
        } else {
          return item;
        }
      });
      s.sizes[index] = true;
      s.size = index;
      return loadPage(s.getPage());
    };
    watches.push(s.$watch("getPage()", debounce(loadPage, 100, {
      leading: true
    })));
    return s.$on("$destroy", function() {
      var w, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = watches.length; _i < _len; _i++) {
        w = watches[_i];
        _results.push(w());
      }
      return _results;
    });
  });

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
          var elemList, itm, rows, workIdGroups, workid;
          workIdGroups = _.groupBy($("item", xml), function(item) {
            return $(item).attr("lbworkid");
          });
          rows = {};
          for (workid in workIdGroups) {
            elemList = workIdGroups[workid];
            itm = $(elemList[0]);
            if (!(objFromAttrs(itm.find("author").get(0)))) {
              c.log("author failed", workid, itm);
            }
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
      searchWorks: function(query, mediatype, resultitem, resultlength) {
        var def, url;
        def = $q.defer();
        url = "/query/lb-search.xql";
        http({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "text/xml; charset=utf-8"
          },
          params: {
            action: "search"
          },
          data: "<search>\n    <string-filter>\n        <item type=\"string\">" + query + "|</item>\n    </string-filter>\n<domain-filter>\n<item type=\"all-titles\" mediatype=\"" + mediatype + "\"></item>\n</domain-filter>\n<ne-filter>\n    <item type=\"NUL\"></item>\n</ne-filter>\n</search>"
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
      searchLexicon: function(str) {
        var def, suffix, url;
        c.log("searchLexicon", str);
        def = $q.defer();
        url = "/query/so.xql";
        suffix = str.length > 3 ? "*" : "";
        http({
          url: url,
          params: {
            word: str + suffix
          }
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
