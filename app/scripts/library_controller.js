/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
littb.controller("libraryCtrl", function($scope, backend, util, $timeout, $location, authors, $rootElement, $anchorScroll, $q, $filter) {
    const s = $scope;
    s.titleSearching = false;
    s.authorSearching = true;
    s.showPopular = true;
    s.showPopularAuth = true;
    s.showInitial = true;
    s.show_more = ($location.search().avancerat != null);
    // s.rowByLetter = {}
    s.filters = _.omitBy({
        'main_author.gender': $location.search()['kön'],
        keywords : __guard__($location.search()['keywords'], x => x.split(",")),
        languages : __guard__($location.search()['languages'], x1 => x1.split(",")),
        mediatypes : __guard__($location.search()['mediatypes'], x2 => x2.split(","))
    }, _.isNil);


    s.normalizeAuthor = $filter('normalizeAuthor');

    s.getTitleTooltip = function(attrs) {
        if (!attrs) { return; }
        if (attrs.showtitle !== attrs.title) { return attrs.title; }
    };

    s.filterTitle = function(row) {    
        const auths = (_.map(row.authors, auth => auth.full_name)).join(" ");

        const exprs = s.rowfilter.split(" ");

        return _.every(exprs, expr => new RegExp(expr, "i").test((row.itemAttrs.title + " " + row.itemAttrs.shorttitle + " " + auths + " " + row.itemAttrs.imprintyear + " ")));
    };

    const isIE = detectIE();
    c.log("isIE", isIE);

    if (isIE && (isIE < 12)) {
        s.rowLimit = 30;        
    }

    
    backend.getAboutAuthors().then(function(data) {
        console.log("getAboutAuthors");
        return s.aboutAuthors = data;
    });

    const aboutDef = $q.defer();
    s.onAboutAuthorChange = _.once(function($event) {
        console.log("$event", s.about_authors_filter, $location.search().about_authors_filter);
        s.about_authors_filter = __guard__($location.search().about_authors_filter, x3 => x3.split(",")) || [];
        return aboutDef.resolve();
    });

    $q.all([aboutDef.promise, authors]).then(function() {
        c.log("after authors, about");
        return $timeout( () => $(".about_select").select2()
        , 0);
    });


    s.filterAuthor = function(author) {
        const exprs = s.rowfilter != null ? s.rowfilter.split(" ") : undefined;

        return _.every(exprs, function(expr) {
            const pseudonym = (_.map(author.pseudonym, "full_name")).join(" ");
            return new RegExp(expr, "i").test((author.full_name + pseudonym));
        });
    };

    const getPopularTitles = function() {
        let def;
        s.titleSearching = true;
        return def = backend.getTitles(null, "popularity|desc").then(function(titleArray) {
            s.titleSearching = false;
            s.popularTitles = titleArray;
            s.titleByPath = _.groupBy(titleArray, item => item.titlepath);

            return titleArray;
        });
    };

    s.resetView = function() {
        s.showInitial = true;
        s.showPopularAuth = true;
        s.showPopular = true;
        s.showRecent = false;

        s.filters = {};
        s.about_authors_filter = [];
        $timeout(() => $(".gender_select, .keyword_select, about_select").select2()
        , 0);
        s.filter = "";
        s.rowfilter = "";
        s.all_titles = null;
        s.audio_list = null;

        if (!s.popularTitles) {
            return getPopularTitles();
        }
    };


    s.hasMediatype = function(titleobj, mediatype) {
        let needle;
        return (needle = mediatype, Array.from((_.map(titleobj.mediatypes, "label"))).includes(needle));
    };

    s.pickMediatypes = (titleobj, mediatypeLabels) => _.filter(titleobj.mediatypes, item => Array.from(mediatypeLabels).includes(item.label));


    s.getTitleUrl = function(titleobj) {
        let mediatype;
        return mediatype = s.sortMedia(titleObj.mediatype)[0];
    };


    s.sortMedia = function(list) {
        const order = ['etext', 'faksimil', 'epub', 'pdf'];
        return _.intersection(order,list).concat(_.difference(list, order));
    };

    s.getTitleId = row => row.work_title_id;

    s.getUniqId = function(title) {
        if (!title) { return; }
        return title.lbworkid + (title.titlepath.split('/')[1] || "");
    };
        

    s.authorRender = function() {
        c.log("authorRender");
        // s.$apply () ->
        if ($location.search()['author']) {
            const auth = s.authorsById[$location.search()['author']];
            s.authorClick(null, auth);

            return s.$emit("listScroll", $location.search()['author']);
        }
    };


    s.titleRender = function() {
        if ($location.search()['title']) {
            // fetchWorks().then () ->
            const title = s.titleByPath != null ? s.titleByPath[$location.search()['title']][0] : undefined;
            s.titleClick(null, title);
            const id = s.getUniqId(title);
            return s.$emit("listScroll", id);
        }
    };
                


    // use timeout to make sure the page shows before loading authors
    // $timeout () ->
    authors.then(function(...args) {
        const [authorList, authorsById] = Array.from(args[0]);
        console.log("authors.then");
        s.authorsById = authorsById;
        s.authorData = _.filter(authorList, item => item.show);
        return s.authorSearching = false;
    });

    backend.getPopularAuthors().then(auths => s.popularAuthors = auths);

        
    // , 10
        
    s.getAuthorData = function() {
        if (s.showPopularAuth) {
            return s.popularAuthors;
        // else
        //     filters = getKeywordTextfilter()
        //     if _.toPairs(filters).length
        //         return _.filter s.authorData, (auth) ->
        //             conds = []
        //             if filters['provenance.library'] == "Dramawebben"
        //                 conds.push(auth.dramaweb?)

        //             if filters['main_author.gender']
        //                 conds.push(auth.gender == filters['main_author.gender'])

        //             return _.every conds

        } else if (s.showInitial) {
            return s.authorData;
        } else {
            // s.authorData
            return s.currentAuthors;
        }
    };

    s.searchTitle = function() {
        c.log("searchTitle", s.filter);
        s.selectedAuth = null;
        s.selectedTitle = null;
        s.rowfilter = s.filter;
        // if s.rowfilter or _.toPairs(getKeywordTextfilter()).length
        if (_.toPairs(getKeywordTextfilter()).length || $location.search().about_authors_filter) {
            s.showInitial = false;
            s.showPopularAuth = false;
            s.showPopular = false;
            if (s.rowfilter) {
                fetchTitles();
                fetchAudio();
            }
            fetchWorks();
            // if not (_.toPairs(getKeywordTextfilter()).length or s.about_authors_filter?.length)
            //     fetchAudio()
            if (!isDev) {
                return backend.logLibrary(s.rowfilter);
            }
        } else {
            return s.resetView();
        }
    };



    var fetchTitles = () =>
        // unless s.filter then return
        backend.getParts(s.rowfilter, true, getKeywordTextfilter()).then(titleArray => s.all_titles = titleArray)
    ;
    
    var fetchAudio = () =>
        backend.getAudioList({string_filter : s.rowfilter, sort_field: "title.raw|asc", partial_string : true}).then(titleArray => s.audio_list = titleArray)
    ;

    var getKeywordTextfilter = function() {
        ({
          "gender": "main_author.gender:female",
          "keywords": [
            "provenance.library:Dramawebben"
          ],
          "about_authors": [
            "StrindbergA"
          ],
          "languages" : {
            "modernized:true": "modernized:true",
            "proofread:true": "proofread:true",
            "language:deu": "language:deu"
          },
          "mediatypes" : [
            'has_epub:true'
          ]
        });

        c.log("gender filter", s.filters["gender"]);
        if (s.filters["main_author.gender"] === "all") {
            delete s.filters["main_author.gender"];
        }
        const kwList = _.values(s.filters.keywords).concat(_.values(s.filters.languages), _.values(s.filters.mediatypes));
        const text_filter = {};
        for (let kw of Array.from(kwList)) {
            const [key, val] = Array.from(kw.split(":"));
            if ((key === 'main_author.gender') && (val === "all")) { continue; }
            if (text_filter[key]) {
                text_filter[key].push(val);
            } else {
                text_filter[key] = [val];
            }
        }
        return _.extend(_.omit(s.filters, "keywords", "languages", "mediatypes"), text_filter);
    };

    var fetchWorks = function() {
        s.titleSearching = true;
        const include = "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable,authors.author_id,work_authors.author_id,authors.surname,authors.type,startpagename,has_epub";
        // last true in args list is for partial_string match
        let text_filter = getKeywordTextfilter();
        if (!_.toPairs(text_filter).length) { text_filter = null; }
        const about_authors = $location.search().about_authors_filter;
        const def = backend.getTitles(about_authors, null, s.filter, !!about_authors, false, s.rowfilter, include, text_filter).then(function(titleArray) {
            s.titleArray = titleArray;
            authors.then(() =>
                s.currentAuthors = _(titleArray)
                                        .map(work => Array.from(work.authors).filter((auth) => !auth.type).map((auth) => s.authorsById[auth.author_id]))
                                        .flatten()
                                        .uniqBy("author_id")
                                        .sortBy("name_for_index")
                                        .value()
            );

            // s.titleGroups = titleGroups
            s.titleByPath = _.groupBy(titleArray, item => item.titlepath);
            s.titleSearching = false;

            return titleArray;
        });

        return def;
    };
    
    s.showAllWorks = function() {
        s.showPopular = false;
        s.showRecent = false;
        s.filter = "";
        s.rowfilter = "";
        s.titleArray = null;
        return fetchWorks();
    };
    
    s.popClick = function() {
        s.showRecent = false;
        s.showPopular = true;
        if (!s.popularTitles) {
            return getPopularTitles();
        }
    };

    s.fetchRecent = function() {
        s.showPopular = false;
        s.showRecent = true;
        s.filter = "";
        s.rowfilter = "";
        s.titleArray = null;

        const dateFmt = function(datestr) {
            const months = "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december".split(",");
            const [year, month, day] = Array.from(datestr.split("-"));
            return [Number(day), months[month - 1], year].join(" ");
        };

        s.titleSearching = true;
        return backend.getTitles(null, "imported|desc,sortfield|asc", null, false, true).then(function(titleArray) {
            s.titleSearching = false;
            // s.titleArray = titleArray

            s.titleGroups = _.groupBy(titleArray, "imported");

            let output = [];
            for (let datestr in s.titleGroups) {
                // TODO: fix locale format, 'femte maj 2017'
                // output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
                const titles = s.titleGroups[datestr];
                output.push({isHeader : true, label : dateFmt(datestr)});
                output = output.concat((_.sortBy(titles, ["sortfield"])));
            }

            return s.titleArray = output;
        });
    };

    s.getUrl = function(row, mediatype) {
        let url;
        const author_id = row.authors[0].workauthor || row.authors[0].author_id;

        if (mediatype === "epub") { 
            url = `txt/epub/${author_id}_${row.work_title_id}.epub`;
        } else if (mediatype === "pdf") {
            url = `txt/${row.lbworkid}/${row.lbworkid}.pdf`;
        } else {
            url = `/forfattare/${author_id}/titlar/${s.getTitleId(row)}/` +
                 `sida/${row.startpagename}/${mediatype}`;
        }

        return url;
    };


    s.authorClick = function($event, author) {
        if (s.selectedAuth !== author) {
            if (s.selectedAuth != null) {
                s.selectedAuth._collapsed = false;
            }
        }
        
        s.selectedAuth = author;

        $location.search("author", author.author_id);
        author._infoSearching = true;
        return backend.getAuthorInfo(author.author_id).then(function(data) {
            author._collapsed = true;
            author.data = data;
            return author._infoSearching = false;
        });
    };

    s.authorHeaderClick = function($event, author) {
        if ((s.selectedAuth === author) && author._collapsed) {
            author._collapsed = false;
            return ($event != null ? $event.stopPropagation() : undefined);
        }
    };

    s.titleHeaderClick = function($event, title) {
        if ((s.selectedTitle === title) && title._collapsed) {
            title._collapsed = false;
            return ($event != null ? $event.stopPropagation() : undefined);
        }
    };

    s.titleClick = function($event, title) {
        if (s.selectedTitle !== title) {
            if (s.selectedTitle != null) {
                s.selectedTitle._collapsed = false;
            }
        }

        s.selectedTitle = title;
        s.selectedTitle._collapsed = true;
        return $location.search("title", title.titlepath);
    };


    s.getPartAuthor = part => (part.authors != null ? part.authors[0] : undefined) || part.work_authors[0];


    if ($location.search().nytillkommet) {
        s.fetchRecent();
    } else {
        if ($location.search().filter) {
            s.filter = $location.search().filter;
        }
        s.searchTitle();
    }
    // if $location.search().keyword
    //     s.selectedKeywords = $location.search().keyword?.split(",")

    util.setupHashComplex(s,
        [{
            key : "filter",
            // scope_name : "rowfilter"
            replace : false
        }
        , {
            key : "nytillkommet",
            scope_name : "showRecent"
        }
        , {
            key : "kön",
            expr: "filters['main_author.gender']",
            default: "all"
        }
        , {
            key : "languages",
            expr: "filters.languages",
            val_in(val) {
                return (val != null ? val.split(",") : undefined);
            },
            val_out(val) {
                return (val != null ? val.join(",") : undefined);
            }
        }
        , {
            key : "keywords",
            expr : "filters.keywords",
            val_in(val) {
                return (val != null ? val.split(",") : undefined);
            },
            val_out(val) {
                return (val != null ? val.join(",") : undefined);
            }
        }
        , {
            key : "mediatypes",
            expr : "filters.mediatypes",
            val_in(val) {
                return (val != null ? val.split(",") : undefined);
            },
            val_out(val) {
                return (val != null ? val.join(",") : undefined);
            }
        }
        , {
            key : "about_authors_filter",
            val_in(val) {
                return (val != null ? val.split(",") : undefined);
            },
            val_out(val) {
                return (val != null ? val.join(",") : undefined);
            }
        }
        , {
            key: "avancerat",
            expr: "show_more"
        }

        ]);

    return s.listVisibleTitles = function() {
        if (s.showInitial && s.showPopular) {
            return s.popularTitles;
        } else {
            return s.titleArray;
        }
    };
});


function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}