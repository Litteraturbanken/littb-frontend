/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
littb.controller("dramawebCtrl", function($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter, $rootElement, $modal, $timeout) {
    const s = $scope;

    s.filters = {
        gender : $location.search().gender,
        filterTxt : $location.search().filterTxt,
        mediatype : $location.search().mediatype,
        author : $location.search().author,
        female_roles : __guard__($location.search().female_roles, x => x.split(",")),
        male_roles : __guard__($location.search().male_roles, x1 => x1.split(",")),
        other_roles : __guard__($location.search().other_roles, x2 => x2.split(",")),
        number_of_acts : __guard__($location.search().number_of_acts, x3 => x3.split(",")),
        number_of_pages : __guard__($location.search().number_of_pages, x4 => x4.split(",")),
        number_of_roles : __guard__($location.search().number_of_roles, x5 => x5.split(",")),
        isChildrensPlay : $location.search().barnlitteratur
    };

    const updateRoute = function() {
        s.showpage = $location.path().split("/")[2] || "start";
        s.isStartPage = s.showpage === "start";
        // s.$root.dramasubpage = !s.isStartPage
        $rootScope._stripClass("drama");
        if (!s.isStartPage) {
            return $rootElement.addClass("drama-dramasubpage");
        }
    };
        
    updateRoute();
    s.$on("$routeChangeError", function(event, current, prev, rejection) {
        console.log("routeChangeError", event, current, prev, rejection);
        // _.extend s, current.pathParams
        return updateRoute();
    });
    

    s.filterDirty = {};
    s.onDropdownToggle = function(isOpen) {
        console.log("onDropdownToggle", isOpen);

        if (!isOpen && _.keys(s.filterDirty).length) {
            for (let key of Array.from(_.keys(s.filterDirty))) {
                $location.search(key, s.filters[key].join(",")).replace();
            }
        }

        if (!isOpen) {
            return $location.search("barnlitteratur", s.filters.isChildrensPlay || null);
        }
    };

    s.onMediatypeChange = function() {
        if (s.filters.mediatype === "all") {
            return s.filters.mediatype = "";
        }
    };
    util.setupHashComplex(s,
            [{
                key : "visa",
                scope_name : "listType",
                replace : false,
                default : "pjäser"
            }
            , {
                key : 'gender',
                expr : "filters.gender",
                default : "all"
            }
            , {
                key : 'author',
                expr : "filters.author"
            }
            , {
                key : 'filterTxt',
                expr: "filters.filterTxt"
            }
            , {
                key : 'mediatype',
                expr: "filters.mediatype"
            }
            // ,
            //     key : 'filterDirty'
            //     val_in : (val) -> val?.split(",")
            //     val_out : (val) -> val?.join(",")
            , {
            //     key : "female_roles"
            //     expr : "filters.female_roles"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
            //     key : "male_roles"
            //     expr : "filters.male_roles"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
            //     key : "other_roles"
            //     expr : "filters.other_roles"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
            //     key : "number_of_acts"
            //     expr : "filters.number_of_acts"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
            //     key : "number_of_pages"
            //     expr : "filters.number_of_pages"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
            //     key : "number_of_roles"
            //     expr : "filters.number_of_roles"
            //     val_in : (val) -> val.split(",")
            //     val_out : (val) -> val.join(",")
            // ,
                key : "om-boken",
                scope_name : "show_about",
                default: "no",
                post_change(val) {
                    if (val) {

                        s.workinfoPromise = backend.getInfopost($location.search().author_id, $location.search().titlepath);

                        return s.workinfoPromise.then(function(workinfo) {
                            s.workinfo = workinfo;
                            const about_modal = $modal.open({
                                templateUrl : "sourceInfoModal.html",
                                scope : s,
                                windowClass : "about"
                            });

                            return about_modal.result.then(function() {
                                s.show_about = false;
                                return $location.search({'author_id' : null, 'titlepath' : null});
                            }
                            , function() {
                                s.show_about = false;
                                return $location.search({'author_id' : null, 'titlepath' : null});
                            });
                        });

                    } else {
                        let about_modal;
                        if (about_modal != null) {
                            about_modal.close();
                        }
                        return about_modal = null;
                    }
                }
            }
                
        ]);

    authors.then(function(...args) {
        const [authorList, authorsById] = Array.from(args[0]);
        s.authorsById = authorsById;
        return s.authorList = authorList;
    });
    s.authorSelectSetup = {
        formatNoMatches: "Inga resultat",
        formatResult(data) {
            if (!s.authorsById) { return; } 
            const author = s.authorsById[data.id];
            if (!author) { return data.text; }

            let firstname = "";
            if (author.name_for_index.split(",").length > 1) {
                firstname = `<span class='firstname'>, ${author.name_for_index.split(',')[1]}</span>`;
            }

            return `\
<span>
    <span class="surname sc">${author.surname}</span>${firstname} <span class="year">${$filter('authorYear')(author)}</span>
</span>\
`;
        },

        formatSelection(item) {
            try {
                return s.authorsById[item.id].surname;
            } catch (e) {
                return "Välj författare";
            }
        }

    };

    s.onAuthorChange = _.once(function() {
        console.log("onAuthorChange", $location.search().author);
        if ($location.search().author) {
            return s.filters.author = $location.search().author;
        }
    });
        
    s.onGenderChange = _.once(function() {
        console.log("$location.search().gender", $location.search().gender);
        if ($location.search().gender) {
            return s.filters.gender = $location.search().gender;
        }
    });

    s.onRadioClick = function(newType) {
        c.log("onRadioClick", s.listType);
        return s.listType = newType;
    };

    s.listType = 'pjäser';

    s.formatInterval = function(...args) {
        const [from, width] = Array.from(args[0]);
        return `${from}–${width + from}`;
    };

    s.getAuthor = function(author) {
        let [last, first] = Array.from(author.name_for_index.split(","));

        if (first) {
            first = `<span class='firstname'>${first}</span>`;
        } else {
            first = "";
        }

        return _.compact([`<span class='sc'>${last}</span>`, first]).join(",");
    };

    s.authorFilter = function(author) {
        if (s.filters.gender && (s.filters.gender !== "all")) {
            return s.filters.gender === author.gender;
        }


        if (s.filters.filterTxt) {
            const searchstr = [author.full_name, author.birth.plain, author.death.plain]
                        .join(" ").toLowerCase();
            for (let str of Array.from(s.filters.filterTxt.split(" "))) {
                if (!searchstr.match(str)) { return false; }
            }
        }


        return true;
    };

    s.getFilteredRows = _.throttle(function() {
        const ret = _.filter(s.rows, function(item) { 
            // if not (_.filter item.authors, (auth) -> auth.gender == s.filters.gender).length
            //     # return false
            if (s.filters.gender && 
                (s.filters.gender !== "all") && 
                (item.authors[0].gender !== s.filters.gender)) { return false; }


            if (s.filters.author && (s.filters.author !== "all")) {
                if (item.authors[0].author_id !== s.filters.author) { return false; }
            }


            if (s.filters.mediatype && (s.filters.mediatype !== "all")) { 
                if (!(_.filter(item.mediatypes, mt => mt.label === s.filters.mediatype)).length) {
                    return false;
                }
            }
            if (s.filters.filterTxt) { 
                const fullnames = _.map(item.authors, author => [author.full_name, author.birth.plain, author.death.plain].join(" "));
                let searchstr = fullnames.join(" ") + (item.title);
                searchstr = searchstr.toLowerCase();
                
                for (let str of Array.from(s.filters.filterTxt.split(" "))) {
                    if (!searchstr.match(str)) { return false; }
                }
            }

            if (s.filters.isChildrensPlay) {
                let needle;
                if (!((needle = "Barnlitteratur", Array.from(((item.keyword != null ? item.keyword.split(",") : undefined) || [])).includes(needle)))) { return false; }
            }

            for (let key of Array.from(_.keys(s.filterDirty))) {
                // console.log("key", key)
                const value = s.filters[key];
                if ((_.isArray(value)) && value.length) {
                    let [from, to] = Array.from(value);
                    from = from || 0;
                    to = to || Infinity;
                    if (!(item.dramawebben != null ? item.dramawebben.hasOwnProperty(key) : undefined)) { return false; }

                    const n = Number(item.dramawebben[key]);
                    if (!(from <= n && n <= to )) { return false; }
                }
            }

            return true;
        });

        return ret;
    }
    , 100);
                
    return backend.getDramawebTitles().then(function(data) {
        let key;
        s.rows = data.works;
        authors.then(function() {
            s.authorData = _.map(data.authors, author_id => s.authorsById[author_id]);
            return s.authorData = util.sortAuthors(s.authorData);
        });
            

        // s.filters = _.extend s.filters, {
        // }

        const findMinMax = ["female_roles", "male_roles", "other_roles", "number_of_acts", "number_of_pages", "number_of_roles"];
        s.filterDirty = _.fromPairs(_.map((_.intersection(findMinMax, $location.search())), key => [key, true]));
        // s.filterDirty = _.fromPairs ([key, true] for key in findMinMax when $location.search()[key])
        const ranges = _.fromPairs(_.map(findMinMax, key => [key, [Infinity, 0]]));
        for (let item of Array.from(s.rows)) {
            if (!item.dramawebben) { continue; }
            for (key of Array.from(findMinMax)) {
                const n = Number(item.dramawebben[key]);
                if (n < ranges[key][0]) {
                    ranges[key][0] = n;
                }
                if (n > ranges[key][1]) {
                    ranges[key][1] = n;
                }
            }
        }
        s.sliderConf = {};
        
        return (() => {
            const result = [];
            for (key of Array.from(findMinMax)) {
                const [from, to] = Array.from(ranges[key]);
                if (!s.filters[key]) {
                    console.log("from, to", from, to);
                    s.filters[key] = [from, to];
                }
                result.push(s.sliderConf[key] = {
                    floor : from,
                    ceil: to,
                    onEnd : ((key, s) =>
                        () => 
                            // safeApply(s, () ->
                            $timeout( () => s.filterDirty[key] = true
                            , 0)
                        
                    )(key, s)
                            // $location.search("ranges", s.filterDirty.join(",")).replace()
                            // )
                });
            }
            return result;
        })();});
});



function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}