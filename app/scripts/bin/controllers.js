(function() {
  'use strict';
  var littb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  window.c = typeof console !== "undefined" && console !== null ? console : {
    log: _.noop
  };

  littb = angular.module('littbApp');

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

  littb.controller("searchCtrl", function($scope, backend, $location, util, searchData, authors) {
    var getMediatypes, initTitle, queryvars, s;
    s = $scope;
    s.open = false;
    s.proofread = 'all';
    initTitle = _.once(function(titlesById) {
      if (!$location.search().titel) {
        return;
      }
      return s.selected_title = titlesById[$location.search().titel];
    });
    s.titleChange = function() {
      var _ref;
      return $location.search("titel", ((_ref = s.selected_title) != null ? _ref.lbworkid : void 0) || null);
    };
    s.checkProof = function(obj) {
      if (obj.searchable !== 'true') {
        return false;
      }
      if (s.proofread === 'all') {
        return true;
      } else if (s.proofread === "no" && obj.proofread === "false") {
        return true;
      } else if (s.proofread === "yes" && obj.proofread === "true") {
        return true;
      } else {
        return false;
      }
    };
    s.authorChange = function() {
      $location.search("titel", null);
      return s.selected_title = "";
    };
    util.setupHashComplex(s, [
      {
        scope_name: "num_hits",
        key: "per_sida",
        val_in: Number
      }
    ]);
    authors.then(function(_arg) {
      var authorList, authorsById, change;
      authorList = _arg[0], authorsById = _arg[1];
      s.authors = authorList;
      change = function(newAuthor) {
        if (!newAuthor) {
          return;
        }
        c.log("change", newAuthor);
        return backend.getTitlesByAuthor(newAuthor).then(function(data) {
          var filteredTitles, titlesById;
          filteredTitles = _.filter(data, function(item) {
            return __indexOf.call(item.titlepath, "/") < 0;
          });
          s.titles = filteredTitles;
          titlesById = _.object(_.map(filteredTitles, function(item) {
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
    if (s.num_hits == null) {
      s.num_hits = 20;
    }
    s.current_page = 0;
    getMediatypes = function() {
      return {
        yes: "etext",
        no: "faksimil",
        all: "all"
      }[s.proofread];
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
      s.current_page = s.total_pages - 1;
      return s.search(s.query);
    };
    s.save_search = function(startIndex, currentIndex, data) {
      c.log("save_search", startIndex, currentIndex, data);
      c.log("searchData", searchData);
      return searchData.save(startIndex, currentIndex, data, [s.query, getMediatypes()]);
    };
    s.getSetVal = function(sent, val) {
      return _.str.trim(sent.structs[val], "|").split("|")[0];
    };
    s.selectLeft = function(sentence) {
      if (!sentence.match) {
        return;
      }
      return sentence.tokens.slice(0, sentence.match.start);
    };
    s.selectMatch = function(sentence) {
      var from;
      if (!sentence.match) {
        return;
      }
      from = sentence.match.start;
      return sentence.tokens.slice(from, sentence.match.end);
    };
    s.selectRight = function(sentence) {
      var from, len;
      if (!sentence.match) {
        return;
      }
      from = sentence.match.end;
      len = sentence.tokens.length;
      return sentence.tokens.slice(from, len);
    };
    s.search = function(query) {
      var from, mediatype, q, to;
      q = query || s.query;
      if (q) {
        $location.search("fras", q);
      }
      s.query = q;
      s.searching = true;
      mediatype = getMediatypes();
      from = s.current_page * s.num_hits;
      to = (from + s.num_hits) - 1;
      return backend.searchWorks(s.query, mediatype, from, to, $location.search().forfattare, $location.search().titel).then(function(data) {
        var row, _i, _len, _ref, _results;
        c.log("search data", data);
        s.kwic = data.kwic || [];
        s.hits = data.hits;
        s.searching = false;
        s.total_pages = Math.ceil(s.hits / s.num_hits);
        _ref = data.kwic || [];
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
        val_in: function(val) {
          return Number(val) - 1;
        },
        val_out: function(val) {
          return val + 1;
        },
        "default": 1
      }, {
        key: "open"
      }, {
        key: "proofread",
        "default": "all"
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

  littb.controller("authorInfoCtrl", function($scope, $location, $rootScope, backend, $routeParams, $http, util) {
    var refreshBreadcrumb, refreshExternalDoc, refreshRoute, refreshTitle, s;
    s = $scope;
    _.extend(s, $routeParams);
    s.showpage = null;
    refreshRoute = function() {
      s.showpage = _.last($location.path().split("/"));
      if (s.author === s.showpage) {
        return s.showpage = "introduktion";
      }
    };
    refreshTitle = function() {
      var suffix;
      suffix = s.showpage === "titlar" ? "Verk i LB" : _.str.capitalize(s.showpage);
      return s.setTitle(("" + s.authorInfo.fullName + " - ") + suffix);
    };
    refreshBreadcrumb = function() {
      if (s.showpage !== "introduktion") {
        if ($rootScope.breadcrumb.length > 2) {
          $rootScope.breadcrumb.pop();
        }
        return s.appendCrumb(s.showpage);
      } else {
        return $rootScope.breadcrumb.pop();
      }
    };
    s.getUnique = function(worklist) {
      return _.filter(worklist, function(item) {
        return __indexOf.call(item.titlepath, "/") < 0;
      });
    };
    s.getPageTitle = function(page) {
      return {
        "semer": "Mera om"
      }[page] || _.str.capitalize(page);
    };
    s.getAllTitles = function() {
      return [].concat(s.groupedTitles, s.groupedWorks);
    };
    s.getUrl = function(work) {
      var url;
      url = "#!/forfattare/" + (work.workauthor || s.author) + "/titlar/" + (work.titlepath.split('/')[0]) + "/";
      if (work.mediatype === "epub" || work.mediatype === "pdf") {
        url += "info/" + work.mediatype;
      } else {
        url += "sida/" + work.startpagename + "/" + work.mediatype;
      }
      return url;
    };
    refreshExternalDoc = function(page) {
      var url, _ref;
      c.log("page", page);
      url = s.authorInfo[page];
      if (location.hostname === "localhost") {
        url = "http://demolittb.spraakdata.gu.se" + s.authorInfo[page];
      }
      if ((_ref = s.showpage) !== "introduktion" && _ref !== "titlar") {
        return $http.get(url).success(function(xml) {
          var from, to;
          from = xml.indexOf("<body>");
          to = xml.indexOf("</body>");
          xml = xml.slice(from, +(to + "</body>".length) + 1 || 9e9);
          return s.externalDoc = _.str.trim(xml);
        });
      }
    };
    refreshRoute();
    s.$on("$routeChangeError", function(event, current, prev, rejection) {
      c.log("change error", current);
      _.extend(s, current.pathParams);
      refreshRoute();
      refreshTitle();
      refreshExternalDoc(s.showpage);
      return refreshBreadcrumb();
    });
    return backend.getAuthorInfo(s.author).then(function(data) {
      s.authorInfo = data;
      s.groupedWorks = _.values(_.groupBy(s.authorInfo.works, "titlepath"));
      s.groupedTitles = _.values(_.groupBy(s.authorInfo.titles, "titlepath"));
      c.log("data.surname", data.surname);
      $rootScope.appendCrumb({
        label: data.surname,
        url: "#!/forfattare/" + s.author
      });
      if (s.showpage !== "introduktion") {
        refreshBreadcrumb();
      }
      refreshTitle();
      return refreshExternalDoc(s.showpage);
    });
  });

  littb.controller("titleListCtrl", function($scope, backend, util, $timeout, $location, $q, authors) {
    var fetchWorks, s;
    s = $scope;
    s.searching = false;
    s.rowByLetter = {};
    s.getTitleTooltip = function(attrs) {
      if (!attrs) {
        return;
      }
      if (attrs.showtitle !== attrs.title) {
        return attrs.title;
      }
    };
    s.filterTitle = function(row) {
      var filter;
      if (!s.rowfilter) {
        return true;
      }
      filter = s.rowfilter || '';
      return new RegExp(filter, "i").test(row.itemAttrs.title + " " + row.itemAttrs.shorttitle);
    };
    s.titlesort = "itemAttrs.sortkey";
    s.sorttuple = [s.titlesort, false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    s.getTitleId = function(row) {
      return row.itemAttrs.titlepath.split('/')[0];
    };
    s.selectWork = function() {
      c.log("selectWork", s.workFilter);
      if (s.workFilter === "titles") {
        s.mediatypeFilter = "";
        if (s.filter) {
          s.selectedLetter = null;
        }
        if (s.selectedLetter) {
          s.filter = null;
        }
      }
      if (!(s.authorFilter || s.filter || s.selectedLetter)) {
        s.selectedLetter = "A";
      }
      return fetchWorks();
    };
    authors.then(function(_arg) {
      var authorList, authorsById;
      authorList = _arg[0], authorsById = _arg[1];
      s.authorsById = authorsById;
      return s.authorData = authorList;
    });
    s.searchTitle = function() {
      c.log("searchTitle", s.workFilter);
      if (s.workFilter === 'titles') {
        s.selectedLetter = null;
        fetchWorks();
      } else {
        if (!s.filter) {
          s.selectedLetter = "A";
        } else {
          s.selectedLetter = null;
        }
      }
      return s.rowfilter = s.filter;
    };
    s.authorChange = function() {
      s.selectedLetter = null;
      if (!(s.authorFilter && !s.selectedLetter)) {
        return s.selectedLetter = "A";
      }
    };
    fetchWorks = function() {
      s.searching = true;
      return backend.getTitles(s.workFilter === "titles", s.selectedLetter, s.filter).then(function(titleArray) {
        s.searching = false;
        s.titleArray = titleArray;
        s.rowByLetter = _.groupBy(titleArray, function(item) {
          var firstletter;
          firstletter = item.itemAttrs.sortkey[0];
          if (firstletter === "Æ") {
            firstletter = "A";
          }
          return firstletter.toUpperCase();
        });
        if (s.workFilter === "titles") {
          return s.currentLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("");
        } else {
          return s.currentLetters = _.keys(s.rowByLetter);
        }
      });
    };
    s.getUrl = function(row, mediatype) {
      var url;
      url = "#!/forfattare/" + (row.author.workauthor || row.author.authorid) + "/titlar/" + (s.getTitleId(row)) + "/";
      if (mediatype === "epub" || mediatype === "pdf") {
        url += "info/" + mediatype;
      } else {
        url += "sida/" + row.itemAttrs.startpagename + "/" + mediatype;
      }
      return url;
    };
    s.getSource = function() {
      if (s.selectedLetter) {
        return s.rowByLetter[s.selectedLetter];
      } else {
        return s.titleArray;
      }
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
        key: "filter",
        scope_name: "rowfilter"
      }, {
        key: "niva",
        scope_name: "workFilter",
        "default": "works"
      }, {
        key: "mediatypeFilter"
      }, {
        key: "forfattare",
        scope_name: "authorFilter"
      }, {
        key: "index",
        scope_name: "selectedLetter",
        replace: false,
        post_change: function(val) {
          if (val) {
            s.filter = "";
          }
          if (s.workFilter === "titles" && val) {
            fetchWorks();
          }
          return val;
        }
      }
    ]);
    if (!(s.rowfilter || s.selectedLetter || s.mediatypeFilter)) {
      s.selectedLetter = "A";
    }
    if (s.rowfilter) {
      s.filter = s.rowfilter;
    }
    c.log("workfilter", s.workFilter);
    return fetchWorks();
  });

  littb.controller("epubListCtrl", function($scope, backend, util) {
    var s;
    s = $scope;
    s.searching = true;
    s.sorttuple = ["author.nameforindex", false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    window.has = function(one, two) {
      return one.toLowerCase().indexOf(two.toLowerCase()) !== -1;
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
      return (_.compact([last.toUpperCase(), first])).join(",");
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
      s.searching = false;
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
      var elem, label;
      s.htmlContent = data;
      s.labelArray = (function() {
        var _i, _len, _ref, _results;
        _ref = $("[id]", data);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          elem = _ref[_i];
          label = _.str.humanize($(elem).attr("name").replace(/([A-Z])/g, " $1"));
          _results.push({
            label: label,
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
          },
          replace: false
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

  littb.controller("authorListCtrl", function($scope, backend, util, authors) {
    var s;
    s = $scope;
    s.sorttuple = ["nameforindex", false];
    s.setSort = function(sortstr) {
      return s.sorttuple[0] = sortstr;
    };
    s.setDir = function(isAsc) {
      return s.sorttuple[1] = isAsc;
    };
    s.authorDef = authors;
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
    authors.then(function(_arg) {
      var authorById, data;
      data = _arg[0], authorById = _arg[1];
      s.authorIdGroup = authorById;
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

  littb.controller("sourceInfoCtrl", function($scope, backend, $routeParams, $q, authors, $document) {
    var author, infoDef, mediatype, s, title;
    s = $scope;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype;
    _.extend(s, $routeParams);
    s.defaultErrataLimit = 8;
    s.errataLimit = s.defaultErrataLimit;
    s.isOpen = false;
    s.show_large = false;
    s.getValidAuthors = function() {
      var _ref;
      return _.filter((_ref = s.data) != null ? _ref.authoridNorm : void 0, function(item) {
        return item.id in s.authorById;
      });
    };
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
      if (mediatype === "epub") {
        return "#!/forfattare/" + s.author + "/titlar/" + s.title + "/info/" + mediatype;
      } else {
        return "#!/forfattare/" + s.author + "/titlar/" + s.title + "/" + mediatype;
      }
    };
    s.onMediatypeClick = function() {
      c.log("onMediatypeClick");
      if (mediatype === "epub") {
        return window.location.href = s.getUrl(mediatype);
      }
    };
    s.getSourceImage = function() {
      if (s.data) {
        return "txt/" + s.data.lbworkid + "/" + s.data.lbworkid + "_small.jpeg";
      }
    };
    s.showLargeImage = function($event) {
      if (s.show_large) {
        return;
      }
      s.show_large = true;
      $event.stopPropagation();
      return $document.one("click", function(event) {
        if (event.button !== 0) {
          return;
        }
        return s.$apply(function() {
          return s.show_large = false;
        });
      });
    };
    infoDef = backend.getSourceInfo(author, title, mediatype);
    infoDef.then(function(data) {
      s.data = data;
      if (!s.mediatype) {
        return s.mediatype = s.data.mediatypes[0];
      }
    });
    return $q.all([authors, infoDef]).then(function(_arg) {
      var authorById, authorData, infoData, item, _i, _len, _ref, _results;
      (_ref = _arg[0], authorData = _ref[0], authorById = _ref[1]), infoData = _arg[1];
      s.authorById = authorById;
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

  littb.controller("lexiconCtrl", function($scope, backend, $location, $rootScope, $q, $timeout, $modal, util, $window) {
    var modal, s;
    s = $scope;
    s.dict_not_found = null;
    s.dict_searching = false;
    modal = null;
    $($window).on("keyup", function(event) {
      if (event.which === 83 && !$("input:focus,textarea:focus,select:focus").length) {
        return s.$broadcast("focus");
      }
    });
    s.showModal = function() {
      c.log("showModal", modal);
      if (!modal) {
        s.$broadcast("blur");
        modal = $modal.open({
          templateUrl: "so_modal_template.html",
          scope: s
        });
        return modal.result.then(function() {
          return s.closeModal();
        }, function() {
          return s.closeModal();
        });
      }
    };
    s.clickX = function() {
      return modal.close();
    };
    s.closeModal = function() {
      s.lex_article = null;
      return modal = null;
    };
    $rootScope.$on("search_dict", function(event, query, searchId) {
      c.log("search_dict", query, searchId);
      return backend.searchLexicon(query, false, searchId, true).then(function(data) {
        var obj, result, _i, _len;
        c.log("search_dict", data);
        if (!data.length) {
          s.dict_not_found = "Hittade inget uppslag";
          $timeout(function() {
            return s.dict_not_found = null;
          }, 4000);
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
        return s.showModal();
      });
    });
    s.getWords = function(val) {
      var def, timeout;
      c.log("getWords", val);
      if (!val) {
        return;
      }
      s.dict_searching = true;
      def = backend.searchLexicon(val, true);
      timeout = $timeout(angular.noop, 800);
      $q.all([def, timeout]).then(function() {
        return s.dict_searching = false;
      });
      return def;
    };
    return util.setupHashComplex(s, [
      {
        key: "so",
        expr: "lex_article.baseform",
        val_in: function(val) {
          return s.$emit("search_dict", val);
        },
        replace: false
      }
    ]);
  });

  littb.controller("readingCtrl", function($scope, backend, $routeParams, $route, $location, util, searchData, debounce, $timeout, $rootScope, $document, $q, $window, $rootElement, authors) {
    var author, loadPage, mediatype, onClickOutside, onKeyDown, pagename, parseEditorPage, s, thisRoute, title, watches;
    s = $scope;
    s.isEditor = false;
    title = $routeParams.title, author = $routeParams.author, mediatype = $routeParams.mediatype, pagename = $routeParams.pagename;
    _.extend(s, _.pick($routeParams, "title", "author", "mediatype"));
    if ("ix" in $routeParams) {
      s.isEditor = true;
      mediatype = s.mediatype = {
        'f': 'faksimil',
        'e': 'etext'
      }[s.mediatype];
    }
    s.pageToLoad = pagename;
    s.searchData = searchData;
    s.loading = true;
    s.showPopup = false;
    s.error = false;
    s.onPartClick = function(startpage) {
      s.gotopage(startpage);
      return s.showPopup = false;
    };
    s.resetHitMarkings = function() {
      var key, _i, _len, _ref, _results;
      _ref = ["traff", "traffslut", "x", "y", "height", "width"];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        key = _ref[_i];
        _results.push(s[key] = null);
      }
      return _results;
    };
    thisRoute = $route.current;
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
    onKeyDown = function(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      return s.$apply(function() {
        switch (event.which) {
          case 39:
            if (navigator.userAgent.indexOf("Firefox") !== -1 || $rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft") === $($window).width()) {
              return s.nextPage();
            }
            break;
          case 37:
            if ($rootElement.prop("scrollLeft") === 0) {
              return s.prevPage();
            }
        }
      });
    };
    $document.on("keydown", onKeyDown);
    s.getPage = function() {
      if (s.isEditor) {
        return $route.current.pathParams.ix;
      } else {
        return $route.current.pathParams.pagename;
      }
    };
    s.setPage = function(ix) {
      s.pageix = ix;
      return s.pageToLoad = s.pagemap["ix_" + s.pageix];
    };
    s.nextPage = function(event) {
      var newix;
      event.preventDefault();
      if (!s.endpage) {
        return;
      }
      if (s.pageix === s.pagemap["page_" + s.endpage]) {
        return;
      }
      newix = s.pageix + 1;
      if ("ix_" + newix in s.pagemap) {
        return s.setPage(newix);
      } else {
        return s.setPage(0);
      }
    };
    s.prevPage = function(event) {
      var newix;
      event.preventDefault();
      newix = s.pageix - 1;
      if ("ix_" + newix in s.pagemap) {
        return s.setPage(newix);
      } else {
        return s.setPage(0);
      }
    };
    s.getFirstPageUrl = function() {
      return "/#!/forfattare/" + author + "/titlar/" + title + "/sida/" + s.startpage + "/" + mediatype;
    };
    s.getPrevPageUrl = function() {
      var newix, page;
      if (!s.pagemap) {
        return;
      }
      newix = s.pageix - 1;
      if ("ix_" + newix in s.pagemap) {
        page = s.pagemap["ix_" + newix];
        return "/#!/forfattare/" + author + "/titlar/" + title + "/sida/" + page + "/" + mediatype;
      }
    };
    s.getNextPageUrl = function() {
      var newix, page;
      if (!s.endpage) {
        return;
      }
      if (s.pageix === s.pagemap["page_" + s.endpage]) {
        return;
      }
      newix = s.pageix + 1;
      if ("ix_" + newix in s.pagemap) {
        page = s.pagemap["ix_" + newix];
        return "/#!/forfattare/" + author + "/titlar/" + title + "/sida/" + page + "/" + mediatype;
      }
    };
    s.getLastPageUrl = function() {
      return "/#!/forfattare/" + author + "/titlar/" + title + "/sida/" + s.endpage + "/" + mediatype;
    };
    s.gotopage = function(page) {
      var ix;
      ix = s.pagemap["page_" + page];
      return s.setPage(ix);
    };
    s.mouseover = function(event) {
      c.log("mouseover");
      return s.showPopup = true;
    };
    onClickOutside = function() {
      return s.$apply(function() {
        return s.showPopup = false;
      });
    };
    $document.on("click", onClickOutside);
    s.getTooltip = function(part) {
      if (part.navtitle !== part.showtitle) {
        return part.showtitle;
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
    s.getValidAuthors = function() {
      var _ref;
      return _.filter((_ref = s.workinfo) != null ? _ref.authoridNorm : void 0, function(item) {
        return item.id in s.authorById;
      });
    };
    authors.then(function(_arg) {
      var authorById, authorData;
      authorData = _arg[0], authorById = _arg[1];
      return s.authorById = authorById;
    });
    s.size = $location.search().size || 2;
    util.setupHashComplex(s, [
      {
        scope_name: "markee_from",
        key: "traff",
        replace: false
      }, {
        scope_name: "markee_to",
        key: "traffslut",
        replace: false
      }, {
        key: "x",
        replace: false
      }, {
        key: "y",
        replace: false
      }, {
        key: "width",
        replace: false
      }, {
        key: "height",
        replace: false
      }, {
        key: "parallel",
        scope_name: "isParallel"
      }, {
        key: "storlek",
        scope_name: "size",
        val_in: Number,
        post_change: function() {
          var i, item, pairs;
          if (!s.x) {
            return;
          }
          return s.coors = (function() {
            var _i, _len, _ref, _results;
            _ref = s.x.split("|");
            _results = [];
            for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
              item = _ref[i];
              pairs = _.pairs(_.pick(s, "x", "y", "height", "width"));
              _results.push(_.object(_.map(pairs, function(_arg) {
                var key, val;
                key = _arg[0], val = _arg[1];
                return [key, val.split("|")[i].split(",")[s.size]];
              })));
            }
            return _results;
          })();
        }
      }
    ]);
    watches = [];
    watches.push(s.$watch("pageToLoad", function(val) {
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
    parseEditorPage = function(data) {
      c.log("parseEditorPage", data);
      return s.loading = false;
    };
    loadPage = function(val) {
      var pageQuery, params;
      if ($route.current.controller !== 'readingCtrl') {
        c.log("resisted page load");
        return;
      }
      c.log("loadPage", val);
      s.loading = true;
      s.error = false;
      if (s.isEditor) {
        params = {
          lbworkid: $routeParams.lbid,
          mediatype: mediatype,
          pageix: val
        };
        pageQuery = "page[ix='" + val + "']";
      } else {
        pageQuery = "page[name='" + val + "']";
        params = {
          authorid: author,
          titlepath: title,
          mediatype: mediatype
        };
        if (val) {
          params["pagename"] = val;
        }
      }
      return backend.getPage(params).then(function(_arg) {
        var data, page, url, workinfo, _i, _len, _ref;
        data = _arg[0], workinfo = _arg[1];
        s.workinfo = workinfo;
        s.pagemap = workinfo.pagemap;
        s.startpage = workinfo.startpagename;
        s.endpage = workinfo.endpagename;
        page = $(pageQuery, data).last().clone();
        if (!page.length) {
          page = $("page:last", data).clone();
          s.pagename = page.attr("name");
        } else {
          s.pagename = val;
        }
        s.displaynum = s.pagename;
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
        c.log("loadpage result", s.size);
        s.url = $("faksimil-url[size=" + (s.size + 1) + "]", page).last().text();
        page.children().remove();
        s.etext_html = _.str.trim(page.text());
        if (!s.isEditor) {
          backend.logPage(s.pageix, s.workinfo.lbworkid, mediatype);
        }
        s.loading = false;
        $rootScope.breadcrumb = [];
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
            url: "#!/forfattare/" + author + "/titlar/" + title + "/info"
          }
        ]);
        return s.setTitle("" + workinfo.title + " sidan " + s.pagename + " " + s.mediatype);
      }, function(data) {
        c.log("fail", data);
        s.error = true;
        return s.loading = false;
      });
    };
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
      $document.off("keydown", onKeyDown);
      $document.off("click", onClickOutside);
      _results = [];
      for (_i = 0, _len = watches.length; _i < _len; _i++) {
        w = watches[_i];
        _results.push(w());
      }
      return _results;
    });
  });

}).call(this);

/*
//@ sourceMappingURL=controllers.js.map
*/