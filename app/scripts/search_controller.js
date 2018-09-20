// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const getAuthorSelectSetup = (s, $filter) =>
    ({
        formatNoMatches: "Inga resultat",
        templateResult(data) {
            if (!data.id) { return; }
            // return data.text
            const author = s.authorsById[data.id];

            let firstname = "";
            if (!author.name_for_index) {
                c.warn("no name_for_index for author", author);
            }
            if ((author.name_for_index != null ? author.name_for_index.split(",").length : undefined) > 1) {
                firstname = `<span class='firstname'>, ${author.name_for_index.split(',')[1]}</span>`;
            }

            return $(`\
<span>
    <span class="surname sc">${author.surname}</span>${firstname} <span class="year">${$filter('authorYear')(author)}</span>
</span>\
`
            );
        },

        templateSelection(item) {
            return s.authorsById[item.id].surname;
        }
            // item.text

    })
;

littb.controller("searchCtrl", function($scope, backend, $location, $document, $window, $rootElement, $q, $timeout, util, SearchData, authors, debounce, $filter, $anchorScroll) {
    let searchData;
    const s = $scope;
    s.open = true;
    let hasSearchInit = false;
    s.auth_select_rendered = false;
    s.onAuthSelectRender = function() {
        c.log("onAuthSelectRender");
        return s.auth_select_rendered = true;
    };
    s.selectedAuthors = [];
    s.selectedTitles = [];
    s.selectedKeywords = [];
    // s.proofread = 'all'
    // s._selectedAuthors = ["AbeniusM", "AdelborgO"]
    // Object.defineProperty s, 'selectedAuthors',
    //   get: ->
    //     this._selectedAuthors
    //   set: (val) ->
    //     c.log("setter", val)
    //     this._selectedAuthors = val

    s.onAuthChange = _.once(function() {
        console.log("onAuthChange");
        const oldVal = __guard__($location.search().forfattare, x => x.split(","));
        if (oldVal) {
            return $timeout( function() {
                s.selectedAuthors = oldVal;
                $("select.author_select").val(oldVal);
                return $("select.author_select").trigger("change");
            }
            , 0);
        }
    });
    
    s.onTitleChange = _.once(function() {
        const oldVal = __guard__($location.search().titlar, x => x.split(","));
        if (oldVal) {
            return $timeout( function() {
                s.selectedTitles = oldVal;
                $("select.title_select").val(oldVal);
                return $("select.title_select").trigger("change");
            }
            , 100);
        }
    });

    const oldVal = __guard__($location.search().keyword, x => x.split(","));
    console.log("oldVal", oldVal);
    if (oldVal) {
        $timeout( function() {
            s.selectedKeywords = oldVal;
            console.log("selectedKeywords", s.selectedKeywords);
            $("select.keyword_select").val(oldVal);
            return $("select.keyword_select").trigger("change");
        }
        , 100);
    }


    s.searchData = (searchData = new SearchData());

    s.authorSelectSetup = getAuthorSelectSetup(s, $filter);

    $timeout( () => s.$broadcast("focus")
    , 100);

    // s.titleSelectSetup = {
    //     formatNoMatches: "Inga resultat",
    //     formatResult : (data) ->
    //         return "<span class='title'>#{data.text}</span>"

    //     formatSelection : (item) ->
    //         item.text
    // }
    

    const initTitle = _.once(function(titlesById) {
        if (!$location.search().titel) { return; }

        return s.selected_title = titlesById[$location.search().titel];});

    s.titleChange = () =>
        // $location.search("titel", s.selected_title?.work_title_id or null)
        $location.search("titel", (s.selected_title != null ? s.selected_title.lbworkid : undefined) || null)
    ;

    s.resetAuthorFilter = function() {
        s.nav_filter = null;
        return searchData.resetMod().then(function(...args) {
            // s.kwic = kwic
            const [sentsWithHeaders] = Array.from(args[0]);
            return s.sentsWithHeaders = sentsWithHeaders;
        });
    };

    s.setAuthorFilter = author_id =>
        // $location.search("navigator_filter", author_id)
        s.nav_filter = author_id
    ;


    s.authorChange = function() {
        $location.search("titel", null);
        return s.selected_title = "";
    };

    s.titleSort = util.titleSort;
        
    // for the author / about author search check
    s.isAuthorSearch = true;


    const aboutDef = backend.getAboutAuthors();

    $q.all([aboutDef, authors]).then(function(...args) {
        const array = args[0], aboutAuthorIds = array[0], [authorList, authorsById] = Array.from(array[1]);
        return s.aboutAuthors = _.uniq(_.map(aboutAuthorIds, id => authorsById[id]));});

    s.getAuthorDatasource = function() {
        if (s.isAuthorAboutSearch) {
            return s.aboutAuthors;
        } else {
            return s.authors;
        }
    };

    authors.then(function(...args) {
        const [authorList, authorsById] = Array.from(args[0]);
        s.authors = authorList;
        s.authorsById = authorsById;
        const change = _.memoize(function(newAuthors) {
            if (!newAuthors) { return; }
            c.log("change newAuthors", newAuthors);
            return backend.getTextByAuthor(newAuthors, "etext,faksimil", null, s.isAuthorAboutSearch).then(titles => s.titles = titles);
        });
        
        if ($location.search().forfattare) {
            const auth = __guard__($location.search().forfattare, x1 => x1.split(","));
            s.selectedAuthors = auth;
            c.log("s.selectedAuthors", s.selectedAuthors);
        }
        
        if ($location.search().titlar) {
            const titles = __guard__($location.search().titlar, x2 => x2.split(","));
            s.selectedTitles = titles;
        }
        if ($location.search().sok_filter) {
            s.nav_filter = $location.search().sok_filter;
        }
        if ($location.search().keyword) {
            s.selectedKeywords = __guard__($location.search().keyword, x3 => x3.split(","));
        }

        return util.setupHashComplex(s, [{
                key : "forfattare",
                // expr : "selected_author.pseudonymfor || selected_author.author_id"
                expr : "selectedAuthors",
                val_in(val) {
                    return (val != null ? val.split(",") : undefined);
                },
                val_out(val) {
                    return (val != null ? val.join(",") : undefined);
                },
                post_change : change
            }
            , {
                key : "titlar",
                expr : "selectedTitles",
                val_in(val) {
                    return (val != null ? val.split(",") : undefined);
                },
                val_out(val) {
                    return (val != null ? val.join(",") : undefined);
                }
            }
            , {
                key : "keyword",
                expr : "selectedKeywords",
                val_in(val) {
                    return (val != null ? val.split(",") : undefined);
                },
                val_out(val) {
                    return (val != null ? val.join(",") : undefined);
                }
            }

            , { 
                key : "sok_filter",
                expr : "nav_filter",
                post_change(author_id) {
                    if (author_id) {
                        c.log("do modifySearch", author_id);
                        s.searching = true;

                        args = {from: 0, to: s.num_hits - 1};
                        if (s.isAuthorAboutSearch) {
                            args["about_authors"] = author_id;
                        } else {
                            args["authors"] = author_id;
                        }
                        // args["author"] = author_id

                        return searchData.modifySearch(args).then(function(...args1) {
                            const [sentsWithHeaders] = Array.from(args1[0]);
                            c.log("modifySearch args", arguments);
                            s.searching = false;
                            return s.sentsNavFilter = sentsWithHeaders;
                        });
                    }
                }
            }



        ]);});

    s.getSentsWithHeadersFromState = function() {
        if ($location.search().sok_filter) {
            return s.sentsNavFilter;
        } else { 
            return s.sentsWithHeaders;
        }
    };


    s.searching = false;
    s.num_hits = searchData.NUM_HITS;
    s.current_page = 0;

    s.nextPage = function() {
        // if (s.current_page  * s.num_hits) + s.kwic.length < s.doc_hits
        s.current_page++;
        return s.gotoPage(s.current_page);
    };
    s.prevPage = function() {
        if (!s.current_page || (s.current_page === 0)) { return; }
        s.current_page--;
        return s.gotoPage(s.current_page);
    };
        

    s.firstPage = () => s.gotoPage(0);
    s.lastPage = () => s.gotoPage(s.total_pages - 1);

    s.gotoPage = function(page) {
        if (page > (s.total_pages - 1)) { return; }
        s.showGotoHitInput = false;
        s.current_page = page;
        // n_rows = Math.ceil($(evt.currentTarget).height() / rowHeight)
        // $(".table_viewport").scrollTop(s.getRowHeight() * page)
        const from = s.current_page * s.num_hits;
        return s.search(from, from + s.num_hits);
    };


    s.onGotoHitInput = function() {
        if (s.total_pages === 1) { return; }
        if (s.showGotoHitInput) {
            s.showGotoHitInput = false;
            return;
        }
        s.showGotoHitInput = true;
        return $timeout(() => s.$broadcast("focus"),
        0);
    };

    
    const getSearchArgs = function(from, to) {
        
        let filter_params = [];
        if (!s.filterOpts[0].selected) { // search all texts is false
            // searchAnom = _.find(s.filterOpts, {key: "is_anom"}).selected
            const object = _.groupBy(s.filterOpts, "group");
            for (let groupKey in object) {
                const group = object[groupKey];
                if (groupKey === "undefined") { continue; }
                const selected = _.filter(group, "selected");
                if (selected.length === 1) {
                    filter_params.push(selected[0].param);
                }
            }
        }


        filter_params = _.fromPairs(filter_params);

        
        const args = {
            query : s.query,
            // mediatype: getMediatypes()
            from,
            to
        };
        const { prefix } = $location.search();
        const { suffix } = $location.search();
        if (prefix) {
            args.prefix = true;
        }
        if (suffix) {
            args.suffix = true;
        }
        // infix = $location.search().infix
        // if prefix or suffix or infix
        //     args.phrase = false
        //     if prefix or suffix
        //         prefix = if prefix then "*" else ""
        //         suffix = if suffix then "*" else ""
        //         args.query = suffix + args.query + prefix
        _.extend(args, filter_params);

        args.text_filter = {};
        if ($location.search().forfattare) {
            if ($location.search().sok_om) {
                args.about_authors = $location.search().forfattare;
            } else {
                args.authors = $location.search().forfattare;
            }
        }
                // args.text_filter['authors.author_id'] = $location.search().forfattare
                
        if ($location.search().titlar) {
            args.work_ids = $location.search().titlar;
        }
        
        if ($location.search().keyword) {
            for (let kw of Array.from($location.search().keyword.split(","))) {
                const [key, val] = Array.from(kw.split(":"));
                args.text_filter[key] = val;
            }
        }

        if (!$location.search().lemma) {
            args.word_form_only = true;
        }
        if ($location.search().fuzzy) {
            args.fuzzy = true;
        }
        // if searchAnom
        //     args.anonymous = false

        return args;


    // s.save_search = (currentIndex) ->
    //     c.log "save_search", $location.url()
        return s.$root.prevSearchState = `/${$location.url()}`;
    };


    s.getSetVal = (sent, val) => _.str.trim( sent.structs[val], "|").split("|")[0];

    s.selectLeft = function(sentence) {
        if (!sentence.match) { return; }
        return sentence.tokens.slice(0, sentence.match.start);
    };

    s.selectMatch = function(sentence) {
        if (!sentence.match) { return; }
        const from = sentence.match.start;
        return sentence.tokens.slice(from, sentence.match.end);
    };

    s.selectRight = function(sentence) {
        if (!sentence.match) { return; }
        const from = sentence.match.end;
        const len = sentence.tokens.length;
        return sentence.tokens.slice(from, len);
    };

    s.setPageNum = function(num) {
        c.log("setPageNum", num);
        s.current_page = num;
        return s.search();
    };

    s.getMaxHit = function() {
        if (!(searchData.data != null ? searchData.data.length : undefined)) { return; }
        return Math.min(s.doc_hits, ((s.current_page + 1) * s.num_hits));
    };

    const onKeyDown = function(event) {
        if (event.metaKey || event.ctrlKey || event.altKey || $("input:focus").length) { return; }
        return s.$apply(function() {
            switch (event.which) {
                case 39: 
                    if ((navigator.userAgent.indexOf("Firefox") !== -1) || (($rootElement.prop("scrollWidth") - $rootElement.prop("scrollLeft")) === $($window).width())) {
                        return s.nextPage();
                    }
                    break;
                case 37: 
                    if ($rootElement.prop("scrollLeft") === 0) {
                        return s.prevPage();
                    }
                    break;
            }
        });
    };

    $document.on("keydown", onKeyDown);

    s.$on("$destroy", () => $document.off("keydown", onKeyDown));


    // s.sortStruct = [
    //     {label: "SÖK I ALLA TEXTER", val: "lastname", selected: true}
    //     {label: "INKLUDERA KOMMENTARER OCH", val: "imprintyear", selected: false}
    //     {label: "SORTERA EFTER SÖKORDET I ALFABETISK ORDNING", val: "hit", selected: false}
    // ]

    // {label: "Inkludera <span class='sc'>KOMMENTARER & FÖRKLARINGAR</span>", val: "all_texts", selected: true}
    // {label: 'Sök i <span class="sc">svenska</span> orginalverk', val: "lang_swedish", selected: true}
    // {label: 'Sök i texter <span class="sc">översatta</span> från andra språk', val: "trans_from", selected: true}
    // {label: 'Sök i texter <span class="sc">översatta</span> till andra språk', val: "trans_to", selected: true}
    s.filterOpts =  [
        {
            label: "Sök i <span class='sc'>ALLA TEXTER</span>",
            // param: "all_texts",
            selected: true,
            key : "all_texts"
        },
        {
            label: 'Sök i <span class="sc">moderniserade</span> texter',
            param: ["modernized", true],
            selected: true,
            group : 0,
            key : "is_modernized"
        },
        {
            label: 'Sök i <span class="sc">ej moderniserade</span> texter',
            param: ["modernized", false],
            selected: true,
            group : 0,
            key : "not_modernized"
        },
        {
            label: 'Sök i <span class="sc">korrekturlästa</span> texter',
            param: ["proofread", true],
            selected: true,
            group : 1,
            key : "is_proofread"
        },
        {
            label: 'Sök i <span class="sc">ej korrekturlästa</span> texter',
            param: ["proofread", false],
            selected: true,
            group : 1,
            key : "not_proofread"
        },
        {
            label: 'Sök i texter skrivna av <span class="sc">kvinnor</span>',
            param: ["gender", "female"],
            selected: true,
            group : 2,
            key : "gender_female"
        },
        {
            label: 'Sök i texter skrivna av <span class="sc">män</span>',
            param: ["gender", "male"],
            selected: true,
            group : 2,
            key : "gender_male"
        }

    ];

    s.options = {
        sortSelected : 'lastname'
    };

    s.onSearchSubmit = function(query) {
        $anchorScroll("results");
        // s.resetAuthorFilter()
        s.nav_filter = null;
        return s.newSearch(query);
    };

    s.searchAllInWork = (sentenceObj, index) =>
        searchData.getMoreHighlights(sentenceObj).then(function(sents) {
            let startIndex = null;
            // find section start index
            for (let start = index-1, i = start, asc = start <= 0; asc ? i <= 0 : i >= 0; asc ? i++ : i--) {
                const row = s.sentsWithHeaders[i];
                if (row.isHeader) {
                    startIndex = i;
                    break;
                }
            }

            return s.sentsWithHeaders.splice(startIndex, index - startIndex + 1, ...[].concat(sents)), sents;
        })
    ;


    s.newSearch = function(query) {
        if (hasSearchInit) {
            s.current_page = 0;
        }


        c.log("newSearch", query);
        const q = query || s.query;
        if (!q) { return; }
        if (q) { $location.search("fras", q); }
        s.query = q;
        s.pageTitle = q;
        const from = s.current_page * s.num_hits;
        //TODO: eh?
        const to = (from + s.num_hits) - 1;
        const args = getSearchArgs(from, to);
        searchData.newSearch(args);
        return s.search(from, to);
    };


    // s.search = debounce((query, from, to) ->
    s.search = function(from, to) {
        s.searching = true;

        const args = getSearchArgs(from, to);
        s.from_index = from;

        // def = backend.searchWorks(args)
        const def = searchData.slice(from, to);
        def.then(function(...args1) {
            const [sentsWithHeaders, author_aggs] = Array.from(args1[0]);
            c.log("search data slice", searchData.total_hits);

            s.doc_hits = searchData.total_doc_hits;
            s.total_pages = Math.ceil(s.doc_hits / s.num_hits);

            s.sentsWithHeaders = _.flatten(sentsWithHeaders);
            s.authorStatsData = author_aggs;
            s.searching = false;
            return hasSearchInit = true;
        });

        return def;
    };
    // , 200)

    // queryvars = $location.search()

    s.opt_change = function(opt) {
        const commit = () => s.search_filter_opts = _.map((_.map(s.filterOpts, "selected")), Number);
        if (opt.key === "all_texts") { 
            for (let o of Array.from(s.filterOpts)) {
                o.selected = true;
            }
            commit();
            return;
        }

        // isDeselect = opt.selected
        opt.selected = !opt.selected;


        const group = _.filter(s.filterOpts, o => o.group === opt.group);
        c.log("group", group);

        if (!_.some(group, "selected")) {
            const i = _.indexOf(group, opt);
            (group[i + 1] || group[0]).selected = true;

            commit();
            return; 
        }



        if (!_.every(s.filterOpts, "selected")) {
            s.filterOpts[0].selected = false;
        }
        if (!(_.filter(s.filterOpts, "selected")).length) {
            opt.selected = true;
        }
        
        if (_.every(s.filterOpts.slice(1), "selected")) {
            s.filterOpts[0].selected = true;
        }

        return commit();
    };

    return util.setupHashComplex(s,
        [{
            scope_name : "current_page",
            key : "traffsida",
            val_in(val) {
                return Number(val) - 1;
            },
            val_out(val) {
                return val + 1;
            },
            default : 1
        }
        , {   
            key : "avancerad",
            scope_name : "advanced"
        }
        , {
            key : "filter",
            scope_name : "search_filter_opts",
            val_in(val) {
                const iterable = (val != null ? val.split(",") : undefined);
                for (let i = 0; i < iterable.length; i++) {
                    let bool = iterable[i];
                    bool = Boolean(Number(bool));
                    s.filterOpts[i].selected = bool;
                }

                return (val != null ? val.split(",") : undefined);
            },

            val_out(val) {
                return (val != null ? val.join(",") : undefined);
            }
        }


        // ,   
        //     key : "proofread"
        //     default : "all"
        , {
            key : "fras",
            post_change(val) {
                c.log("fras val", val);
                if (val) {
                    return s.newSearch(val);
                }
            }
        }
        , {   
            key : "sok_om",
            scope_name : "isAuthorAboutSearch",
            default : false
        }


        ]);
});

    // if "fras" of queryvars
    //     s.search(queryvars.fras)


function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}