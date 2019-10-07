const _ = window._
const littb = window.littb
const c = window.console

const rangeKeys = [
    "female_roles",
    "male_roles",
    "other_roles",
    "number_of_acts",
    "number_of_pages",
    "number_of_roles"
]

littb.controller("dramawebCtrl", function dramawebCtrl(
    $scope,
    $location,
    $rootScope,
    backend,
    $routeParams,
    $http,
    $document,
    util,
    $route,
    authors,
    $q,
    $filter,
    $rootElement,
    $uibModal,
    $timeout
) {
    const s = $scope

    s.filters = {
        gender: $location.search().gender,
        filterTxt: $location.search().filterTxt,
        mediatype: $location.search().mediatype,
        author: $location.search().author,
        female_roles: [],
        male_roles: [],
        other_roles: [],
        number_of_acts: [],
        number_of_pages: [],
        number_of_roles: [],
        isChildrensPlay: $location.search().barnlitteratur
    }

    _.extend(
        s.filters,
        _.mapValues(_.pick($location.search(), ...rangeKeys), val => val.split(","))
    )

    s.$watch(
        () => _.keys($location.search()).join(""),
        () => {
            s.hasFilters = _.keys($location.search()).length
            console.log("hasFilters", s.hasFilters)
        }
    )
    s.clearFilters = () => {
        window.location.search = ""
    }

    const updateRoute = function() {
        s.showpage = $location.path().split("/")[2] || "start"
        s.isStartPage = s.showpage === "start"
        // s.$root.dramasubpage = !s.isStartPage
        $rootScope._stripClass("drama")
        if (!s.isStartPage) {
            $rootElement.addClass("drama-dramasubpage")
        }
    }

    updateRoute()
    s.$on("$routeChangeError", function(event, current, prev, rejection) {
        console.log("routeChangeError", event, current, prev, rejection)
        // _.extend s, current.pathParams
        updateRoute()
    })

    s.filterDirty = {}
    s.onDropdownToggle = function(isOpen) {
        console.log("onDropdownToggle", isOpen)

        if (!isOpen && _.keys(s.filterDirty).length) {
            for (let key of _.keys(s.filterDirty)) {
                $location.search(key, s.filters[key].join(",")).replace()
            }
        }

        if (!isOpen) {
            $location.search("barnlitteratur", s.filters.isChildrensPlay || null)
        }
    }

    s.onMediatypeChange = function() {
        if (s.filters.mediatype === "all") {
            s.filters.mediatype = ""
        }
    }
    util.setupHashComplex(s, [
        {
            key: "visa",
            scope_name: "listType",
            replace: false,
            default: "pjäser"
        },
        {
            key: "gender",
            expr: "filters.gender",
            default: "all"
        },
        {
            key: "author",
            expr: "filters.author"
        },
        {
            key: "filterTxt",
            expr: "filters.filterTxt"
        },
        {
            key: "mediatype",
            expr: "filters.mediatype"
        },
        // ,
        //     key : 'filterDirty'
        //     val_in : (val) -> val?.split(",")
        //     val_out : (val) -> val?.join(",")
        {
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
            key: "om-boken",
            scope_name: "show_about",
            default: "no",
            post_change(val) {
                if (val) {
                    s.workinfoPromise = backend.getInfopost(
                        $location.search().author_id,
                        $location.search().titlepath
                    )

                    s.workinfoPromise.then(function(workinfo) {
                        s.workinfo = workinfo
                        const about_modal = $uibModal.open({
                            templateUrl: "sourceInfoModal.html",
                            scope: s,
                            windowClass: "about"
                        })

                        about_modal.result.then(
                            function() {
                                s.show_about = false
                                $location.search({ author_id: null, titlepath: null })
                            },
                            function() {
                                s.show_about = false
                                $location.search({ author_id: null, titlepath: null })
                            }
                        )
                    })
                } else {
                    let about_modal
                    if (about_modal != null) {
                        about_modal.close()
                    }
                    about_modal = null
                }
            }
        }
    ])

    authors.then(function([authorList, authorsById]) {
        s.authorsById = authorsById
        s.authorList = authorList
    })
    s.authorSelectSetup = util.getAuthorSelectConf(s)

    s.onAuthorChange = _.once(function() {
        console.log("onAuthorChange", $location.search().author)
        if ($location.search().author) {
            s.filters.author = $location.search().author
        }
    })

    s.onGenderChange = _.once(function() {
        console.log("$location.search().gender", $location.search().gender)
        if ($location.search().gender) {
            s.filters.gender = $location.search().gender
        }
    })

    s.onRadioClick = function(newType) {
        c.log("onRadioClick", s.listType)
        s.listType = newType
    }

    s.listType = "pjäser"

    s.formatInterval = function([from, width]) {
        return `${from}–${width + from}`
    }

    s.getAuthor = function(author) {
        let [last, first] = author.name_for_index.split(",")

        if (first) {
            first = `<span class='firstname'>${first}</span>`
        } else {
            first = ""
        }

        return _.compact([`<span class='sc'>${last}</span>`, first]).join(",")
    }

    s.authorFilter = function(author) {
        if (s.filters.gender && s.filters.gender !== "all") {
            return s.filters.gender === author.gender
        }

        if (s.filters.filterTxt) {
            const searchstr = [author.full_name, author.birth.plain, author.death.plain]
                .join(" ")
                .toLowerCase()
            for (let str of s.filters.filterTxt.split(" ")) {
                if (!searchstr.match(str)) {
                    return false
                }
            }
        }

        return true
    }

    s.getFilteredRows = _.throttle(function() {
        const ret = _.filter(s.rows, function(item) {
            // if not (_.filter item.authors, (auth) -> auth.gender == s.filters.gender).length
            //     # return false
            if (
                s.filters.gender &&
                s.filters.gender !== "all" &&
                item.authors[0].gender !== s.filters.gender
            ) {
                return false
            }

            if (s.filters.author && s.filters.author !== "all") {
                if (
                    !_.some(
                        _.filter(item.authors, ({ author_id }) => s.filters.author == author_id)
                    )
                ) {
                    return false
                }
            }

            if (s.filters.mediatype && s.filters.mediatype !== "all") {
                if (!_.filter(item.mediatypes, mt => mt.label === s.filters.mediatype).length) {
                    return false
                }
            }
            if (s.filters.filterTxt) {
                const fullnames = _.map(item.authors, author =>
                    [author.full_name, author.birth.plain, author.death.plain].join(" ")
                )
                let searchstr = fullnames.join(" ") + item.title
                searchstr = searchstr.toLowerCase()

                for (let str of s.filters.filterTxt.split(" ")) {
                    if (!searchstr.match(str)) {
                        return false
                    }
                }
            }

            if (s.filters.isChildrensPlay) {
                if (!item.keyword || !item.keyword.includes("Barnlitteratur")) {
                    return false
                }
            }

            for (let key of _.keys(s.filterDirty)) {
                // console.log("key", key)
                const value = s.filters[key]
                if (_.isArray(value) && value.length) {
                    let [from, to] = value
                    from = from || 0
                    to = to || Infinity
                    if (!item.dramawebben || !item.dramawebben.hasOwnProperty(key)) {
                        return false
                    }

                    const n = Number(item.dramawebben[key])
                    if (!(from <= n && n <= to)) {
                        return false
                    }
                }
            }
            return true
        })

        return ret
    }, 100)

    backend.getDramawebTitles().then(data => {
        s.rows = util.sortTitles(data.works)
        authors.then(function() {
            s.authorData = _.map(data.authors, author_id => s.authorsById[author_id])
            s.authorData = util.sortAuthors(s.authorData)
        })

        // s.filters = _.extend s.filters, {
        // }

        s.filterDirty = _.fromPairs(
            _.map(_.intersection(rangeKeys, $location.search()), key => [key, true])
        )
        // s.filterDirty = _.fromPairs ([key, true] for key in rangeKeys when $location.search()[key])
        const ranges = _.fromPairs(_.map(rangeKeys, key => [key, [Infinity, 0]]))
        for (let item of s.rows) {
            if (!item.dramawebben) {
                continue
            }
            for (let key of rangeKeys) {
                const n = Number(item.dramawebben[key])
                if (_.isNaN(n)) {
                    continue
                }
                if (n < ranges[key][0]) {
                    ranges[key][0] = n
                }
                if (n > ranges[key][1]) {
                    ranges[key][1] = n
                }
            }
        }
        console.log("ranges", ranges)
        s.sliderConf = {}

        for (let key of rangeKeys) {
            const [from, to] = ranges[key]
            console.log("from, to", from, to, s.filters[key])
            if (!s.filters[key] || s.filters[key].length < 2) {
                s.filters[key] = [from, to]
            }
            s.sliderConf[key] = {
                floor: from,
                ceil: to,
                onEnd: ((key, s) => () => $timeout(() => (s.filterDirty[key] = true), 0))(key, s)
            }
        }
    })
})
