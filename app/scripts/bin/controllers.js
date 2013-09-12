(function() {
  'use strict';
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

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
    var getMediatypes, initTitle, queryvars, s;
    s = $scope;
    s.open = false;
    s.searchProofread = true;
    s.searchNonProofread = true;
    initTitle = _.once(function(titlesById) {
      if (!$location.search().titel) {
        return;
      }
      return s.selected_title = titlesById[$location.search().titel];
    });
    s.titleChange = function() {
      var _ref;
      return $location.search("titel", ((_ref = s.selected_title) != null ? _ref.titlepath : void 0) || null);
    };
    s.checkProof = function() {
      var out;
      if (s.searchProofread && s.searchNonProofread) {
        out = null;
      } else if (!s.searchProofread && s.searchNonProofread) {
        out = 'false';
      } else {
        out = 'true';
      }
      c.log("out", out);
      return out;
    };
    s.authorChange = function() {
      return $location.search("titel", null);
    };
    s.authors = backend.getAuthorList();
    s.authors.then(function(authors) {
      var authorsById, change;
      authorsById = _.object(_.map(authors, function(item) {
        return [item.authorid, item];
      }));
      change = function(newAuthor) {
        if (!newAuthor) {
          return;
        }
        return backend.getTitlesByAuthor(newAuthor).then(function(data) {
          var titlesById;
          s.titles = data;
          titlesById = _.object(_.map(data, function(item) {
            return [item.titlepath, item];
          }));
          return initTitle(titlesById);
        });
      };
      if ($location.search().forfattare) {
        s.selected_author = authorsById[$location.search().forfattare];
      }
      return util.setupHashComplex(s, [
        {
          key: "forfattare",
          expr: "selected_author.pseudonymfor || selected_author.authorid",
          post_change: change
        }
      ]);
    });
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
      c.log("save_search", startIndex, currentIndex, data);
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
      return backend.searchWorks(s.query, mediatype, s.current_page * s.num_hits, s.num_hits, $location.search().forfattare, $location.search().titel).then(function(data) {
        var row, _i, _len, _ref, _results;
        s.data = data;
        s.total_pages = Math.ceil(data.count / s.num_hits);
        s.searching = false;
        _ref = data.kwic;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          row = _ref[_i];
          _results.push(row.href = searchData.parseUrls(row));
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
      }, {
        key: "open"
      }, {
        key: "pf",
        scope_name: "searchProofread",
        "default": true,
        val_in: function(val) {
          if (val === 'false') {
            return false;
          }
          return val;
        },
        val_out: function(val) {
          if (!val) {
            return 'false';
          }
          return val;
        }
      }, {
        key: "npf",
        scope_name: "searchNonProofread",
        "default": true,
        val_in: function(val) {
          if (val === 'false') {
            return false;
          }
          return val;
        },
        val_out: function(val) {
          if (!val) {
            return 'false';
          }
          return val;
        }
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

  littb.controller("authorInfoCtrl", function($scope, $location, $rootScope, backend, $routeParams) {
    var refreshBreadcrumb, refreshRoute, refreshTitle, s;
    s = $scope;
    _.extend(s, $routeParams);
    refreshRoute = function() {
      return s.showtitles = (_.last($location.path().split("/"))) === "titlar";
    };
    refreshTitle = function() {
      var suffix;
      suffix = s.showtitles ? "Verk i LB" : "Introduktion";
      return s.setTitle(("" + s.authorInfo.fullName + " - ") + suffix);
    };
    refreshBreadcrumb = function() {
      if (s.showtitles) {
        return s.appendCrumb("titlar");
      } else {
        return delete $rootScope.breadcrumb[2];
      }
    };
    refreshRoute();
    s.$on("$routeChangeError", function(event, current, prev, rejection) {
      c.log("change error", current);
      _.extend(s, current.pathParams);
      refreshRoute();
      return refreshTitle();
    });
    return backend.getAuthorInfo(s.author).then(function(data) {
      s.authorInfo = data;
      s.groupedWorks = _.values(_.groupBy(s.authorInfo.works, "lbworkid"));
      $rootScope.appendCrumb(data.surname);
      return refreshTitle();
    });
  });

  littb.controller("titleListCtrl", function($scope, backend, util, $timeout, $location, $q) {
    var authorDef, fetchWorks, s;
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
    s.titlesort = "itemAttrs.showtitle";
    s.sorttuple = [s.titlesort, false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    s.getTitleId = function(row) {
      var collection, title, _ref;
      _ref = row.itemAttrs.titlepath.split('/'), collection = _ref[0], title = _ref[1];
      return collection;
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
    authorDef = backend.getAuthorList().then(function(data) {
      s.authorsById = _.object(_.map(data, function(item) {
        return [item.authorid, item];
      }));
      return s.authorData = data;
    });
    fetchWorks = function() {
      var titleDef;
      s.searching = true;
      titleDef = backend.getTitles(s.workFilter === "titles", s.selectedLetter || "A").then(function(titleArray) {
        s.searching = false;
        window.titleArray = titleArray;
        s.rowByLetter = _.groupBy(titleArray, function(item) {
          return item.itemAttrs.showtitle[0];
        });
        if (s.workFilter === "titles") {
          return s.currentLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("");
        } else {
          return s.currentLetters = _.keys(s.rowByLetter);
        }
      });
      return $q.all([titleDef, authorDef]).then(function(_arg) {
        var authorData, titleData;
        titleData = _arg[0], authorData = _arg[1];
      });
    };
    util.setupHashComplex(s, [
      {
        expr: "sorttuple[0]",
        scope_func: "setSort",
        key: "sortering",
        "default": s.titlesort
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
    s.letterChange = function() {
      return s.filterTxt = "";
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
      return util.setupHashComplex(s, [
        {
          key: "selectedLetter"
        }
      ]);
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
            label: _.str.humanize($(elem).attr("name")),
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
      }, {
        key: "selectedLetter"
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
      var _ref, _ref1;
      if (mediatype === "epub") {
        return (_ref = s.data) != null ? _ref.epub.url : void 0;
      } else if (mediatype === "pdf") {
        return (_ref1 = s.data) != null ? _ref1.pdf.url : void 0;
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
              label: (_.str.humanize(infoData.titlepath)) + " info " + (s.mediatype || "")
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

  littb.controller("readingCtrl", function($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document) {
    var author, loadPage, mediatype, pagename, s, thisRoute, title, watches;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype, pagename = $routeParams.pagename;
    _.extend(s, _.omit($routeParams, "traff", "traffslut", "x", "y", "height", "width", "parallel"));
    s.searchData = searchData;
    s.dict_not_found = false;
    thisRoute = $route.current;
    s.dict_searching = false;
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
    s.closeModal = function() {
      s.lex_article = null;
      return $location.search("so", null);
    };
    s.saveSearch = function(str) {
      c.log("str", str);
      return $location.search("so", str);
    };
    s.$on("search_dict", function(event, query, searchId) {
      s.dict_searching = true;
      return backend.searchLexicon(query, false, searchId, true).then(function(data) {
        var obj, result, _i, _len;
        s.dict_searching = false;
        c.log("search_dict", data);
        if (!data.length) {
          s.dict_not_found = true;
          $timeout(function() {
            return s.dict_not_found = false;
          }, 3000);
          return;
        }
        result = data[0];
        for (_i = 0, _len = data.length; _i < _len; _i++) {
          obj = data[_i];
          if (obj.baseform === query) {
            result = obj;
            continue;
          }
        }
        s.lex_article = result;
        return $location.search("so", result.baseform);
      });
    });
    if ($location.search().so) {
      s.$emit("search_dict", $location.search().so);
    }
    $document.on("keydown", function(event) {
      return s.$apply(function() {
        switch (event.which) {
          case 39:
            return s.nextPage();
          case 37:
            return s.prevPage();
        }
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
      if (Number(s.displaynum) === s.endpage) {
        return;
      }
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
      return backend.searchLexicon(val, true);
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
      if ($route.current.controller !== 'readingCtrl') {
        c.log("resisted page load");
        return;
      }
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
        s.etext_html = page.text();
        backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype);
        $rootScope.breadcrumb = [];
        c.log("write reader breadcrumb", $location.path(), $route.current);
        s.appendCrumb([
          {
            label: "författare",
            url: "#!/forfattare"
          }, {
            label: (_.str.humanize(author)).split(" ")[0],
            url: "#!/forfattare/" + author
          }, {
            label: "titlar",
            url: "#!/forfattare/" + author + "/titlar"
          }, {
            label: (_.str.humanize(workinfo.titlepath)) + (" sidan " + s.pagename + " ") + (s.mediatype || ""),
            url: "#!/forfattare/" + author + "/titlar/" + title
          }
        ]);
        return s.setTitle("" + workinfo.title + " sidan " + s.pagename + " " + s.mediatype);
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
    watches.push(s.$watch("getPage()", debounce(loadPage, 200, {
      leading: false
    })));
    return s.$on("$destroy", function() {
      var w, _i, _len, _results;
      c.log("destroy reader");
      $document.off("keydown");
      _results = [];
      for (_i = 0, _len = watches.length; _i < _len; _i++) {
        w = watches[_i];
        _results.push(w());
      }
      return _results;
    });
  });

}).call(this);
