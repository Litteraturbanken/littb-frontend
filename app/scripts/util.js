function sortBy(list, field, dir) {
    let trans = {
        ..._.fromPairs(
            _.zip(
                "ÁÂÃÇÈÉÊËÌÍÎÏÑÒÓÔÕØÙÚÛÜÝàáâãçèéêëìíîïñòóôõøùúûüýÿ".split(""),
                "AAACEEEEIIIINOOOOÖUUUUYaaaaceeeeiiiinooooöuuuuyy".split("")
            )
        ),
        ...{ Ä: "Å", Å: "Ä", ä: "å", å: "ä" }
    }
    return _.orderBy(
        list,
        function (item) {
            const transpose = char => trans[char] || char
            return _.map(_.get(item, field).toUpperCase(), transpose).join("")
        },
        dir || "asc"
    )
}

littb.factory("util", function util($location, $filter) {
    const PREFIX_REGEXP = /^(x[:\-_]|data[:\-_])/i
    const SPECIAL_CHARS_REGEXP = /([:\-_]+(.))/g
    const MOZ_HACK_REGEXP = /^moz([A-Z])/
    const camelCase = name =>
        name
            .replace(SPECIAL_CHARS_REGEXP, function (_, separator, letter, offset) {
                if (offset) {
                    return letter.toUpperCase()
                } else {
                    return letter
                }
            })
            .replace(MOZ_HACK_REGEXP, "Moz$1")

    const xml2Str = function (xmlNode) {
        try {
            // Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
            return new XMLSerializer().serializeToString(xmlNode)
        } catch (e) {
            try {
                // Internet Explorer.
                return xmlNode.xml
            } catch (error) {
                // Other browsers without XML Serializer
                alert("Xmlserializer not supported")
            }
        }
        return false
    }

    return {
        getInnerXML(elem) {
            if ("jquery" in elem) {
                if (!elem.length) {
                    return null
                }
                elem = elem.get(0)
            }

            const strArray = Array.from(elem.childNodes).map(child => xml2Str(child))
            return strArray.join("")
        },

        normalize(name) {
            return camelCase(name.replace(PREFIX_REGEXP, ""))
        },

        titleSort(a) {
            return _.map(a.sortkey.split(/(\d+)/), function (item) {
                if (Number(item)) {
                    const zeroes = _.map(
                        _.range(0, 10 - item.toString().length + 1),
                        () => "0"
                    ).join("")

                    return zeroes + item.toString()
                } else {
                    return item
                }
            })
        },

        sortAuthors(authorList, dir) {
            return sortBy(authorList, "name_for_index", dir)
        },
        sortTitles(titleList) {
            return sortBy(titleList, "sortkey")
        },
        getAuthorSelectConf(s) {
            return {
                noResults: () => "Inga resultat",
                matcher(params, data) {
                    if (!params.term) return data
                    if (!data || !data.id || data.id == "all" || data.id == "") return false
                    const author = s.authorsById[data.id]
                    if (!author) return false
                    const terms = params.term.split(" ")
                    const matches = _.every(
                        _.flatten(
                            _.map(terms, term => author.full_name.match(new RegExp(term, "i")))
                        )
                    )

                    if (matches) {
                        return data
                    }
                    return false
                },
                templateResult(data) {
                    if (!data.id) return
                    const author = s.authorsById[data.id]
                    if (!author) {
                        return data.text
                    }

                    let firstname = ""
                    if (author.name_for_index.split(",").length > 1) {
                        firstname = `<span class='firstname'>, ${
                            author.name_for_index.split(",")[1]
                        }</span>`
                    }

                    return $(`<span>
                            <span class="surname sc">${author.surname}</span>${firstname}
                            <span class="year">${$filter("authorYear")(author)}</span> 
                        </span>`)
                },

                templateSelection(item) {
                    try {
                        return s.authorsById[item.id].surname
                    } catch (e) {
                        return "Välj författare"
                    }
                }
            }
        },
        getKeywordTextfilter(filterObj) {
            // sample
            // {
            //     gender: "main_author.gender:female",
            //     keywords: ["provenance.library:Dramawebben"],
            //     authors: ["StrindbergA"],
            //     about_authors: ["StrindbergA"],
            //     languages: {
            //         "modernized:true": "modernized:true",
            //         "proofread:true": "proofread:true",
            //         "language:deu": "language:deu"
            //     },
            //     mediatypes: ["has_epub:true", "mediatype:faksimil"],
            //     'sort_date_imprint.date:range' : [1200, 1900]
            // }

            if (filterObj["main_author.gender"] === "all") {
                delete filterObj["main_author.gender"]
            }
            function makeObj(list) {
                const output = {}
                for (const kw of list || []) {
                    const [key, val] = kw.split(":")
                    if (output[key]) {
                        output[key] = output[key].concat(val.split(";"))
                    } else {
                        output[key] = val.split(";")
                    }
                }
                return output
            }
            const rest = _.omit(
                _.omitBy(filterObj, _.isEmpty),
                "keywords",
                "languages",
                "mediatypes"
                // "about_authors",
                // "main_author.authorid"
            )
            if (
                rest["sort_date_imprint.date:range"]?.length &&
                !rest["sort_date_imprint.date:range"].some(Number.isNaN)
            ) {
                rest["sort_date_imprint.date:range"] = rest["sort_date_imprint.date:range"].join(
                    ","
                )
            } else {
                delete rest["sort_date_imprint.date:range"]
            }
            const filter_or = makeObj(filterObj.mediatypes)
            const filter_and = _.extend(
                rest,
                makeObj(filterObj.languages),
                makeObj(filterObj.keywords)
                // makeObj(filterObj.about_authors),
                // makeObj(filterObj["main_author.authorid"])
            )
            return { filter_or, filter_and }
        },

        setupHashComplex(scope, config) {
            // config = [
            //     expr : "sorttuple[0]"
            //     scope_name : "sortVal"
            //     scope_func : "locChange"
            //     key : "sortering"
            //     val_in : (val) ->
            //         newVal
            //     val_out : (val) ->
            //         newVal
            //     post_change : () ->
            //     default : [val : valval]

            // ]
            function onWatch() {
                for (let obj of config) {
                    let val = $location.search()[obj.key]
                    if (val == null) {
                        if ("default" in obj) {
                            val = obj.default
                        } else {
                            if (typeof obj.post_change === "function") {
                                obj.post_change(val)
                            }
                            continue
                        }
                    }

                    val = (obj.val_in || _.identity)(val)
                    // c.log "obj.val_in", obj.val_in

                    if ("scope_name" in obj) {
                        scope[obj.scope_name] = val
                    } else if ("scope_func" in obj) {
                        scope[obj.scope_func](val)
                    } else {
                        scope[obj.key] = val
                    }
                }
            }
            onWatch()
            scope.loc = $location
            scope.$watch("loc.search()", () =>
                // c.log "onWatch", onWatch
                onWatch()
            )

            for (let obj of config) {
                const watch = obj.expr || obj.scope_name || obj.key
                scope.$watch(
                    watch,
                    ((obj, watch) =>
                        function (val) {
                            // c.log "before val", scope.$eval watch
                            val = (obj.val_out || _.identity)(val)
                            if (val === obj.default) {
                                val = null
                            }
                            const loc = $location.search(obj.key, val || null)
                            if (obj.replace !== false) {
                                loc.replace()
                            }
                            // c.log "post change", watch, val
                            return typeof obj.post_change === "function"
                                ? obj.post_change(val)
                                : undefined
                        })(obj, watch)
                )
            }
        },

        setupHash(scope, ...nameConfig) {
            const names = _.map(nameConfig, function (item) {
                if (_.isObject(item)) {
                    return _.head(_.toPairs(item))[0]
                } else {
                    return item
                }
            })
            // c.log "init", _.pick($location.search(), names...)
            _.extend(scope, _.pick($location.search(), ...names))
            scope.loc = $location
            scope.$watch("loc.search()", () =>
                _.extend(scope, _.pick($location.search(), ...names))
            )

            for (let name of nameConfig) {
                var callback
                if (_.isObject(name)) {
                    ;[name, callback] = _.head(_.toPairs(name))
                }
                scope[name] = $location.search()[name]
                scope.$watch(
                    name,
                    (name =>
                        function (val) {
                            $location.search(name, val || null)
                            if (callback) {
                                return callback(val)
                            }
                        })(name)
                )
            }
        }
    }
})
