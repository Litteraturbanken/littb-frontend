import bodybuilder from "bodybuilder"

let builder = bodybuilder()
interface FilterObj {
    gender?: string
    "authorkeyword>authorid"?: string[]
    keywords?: string[]
    languages?: string[]
    mediatypes?: string[]
    "sort_date_imprint.date:range"?: number[]
}

interface FilterList {
    gender?: string
    keyword?: string[]
    language?: string[]
    modernized?: string[]
    texttype?: string[]
    has_epub?: string
    mediatype?: string
}

// let filters: FilterObj = {
//     authorkeyword: ["AgardhCA", "AgrellA"],
//     keywords: ["texttype:drama", "keyword:Barnlitteratur"],
//     languages: ["modernized:true", "language:lat"],
//     mediatypes: ["has_epub:true", "mediatype:pdf"],
//     "sort_date_imprint.date:range": [1248, 2020],
//     gender: "female"
// }

let makeFilterObj = (list: string[]): FilterList => {
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

let valueTag = function (strings, ...args: any[]) {
    let output: string[] = []
    for (let [i, v] of strings.entries()) {
        output.push(v)
        if (args[i]) output.push(JSON.stringify(args[i]))
    }
    return output.join("")
}

let getQuery = (key, val) => {
    let query = bodybuilder()
    switch (key) {
        case "gender":
            query
                .orQuery("match", "gender", val)
                .orQuery("nested", "path", "authors", { ignore_unmapped: true }, q =>
                    q.query("match", "authors.gender", val).notQuery("exists", "authors.type")
                )
                .queryMinimumShouldMatch(1)
            break

        case "sort_date_imprint.date:range":
            let range = { gte: val[0], lte: val[1] }
            query
                .query("range", "sort_date_imprint.date", range)
                .orQuery("range", "birth.date", range)
                .orQuery("range", "death.date", range)
            break
        case "languages":
        case "keywords":
            console.log("val", val)
            console.log("makeFilterObj(val)", makeFilterObj(val))
            let obj = makeFilterObj(val)
            for (let [filterkey, filterval] of Object.entries(makeFilterObj(val))) {
                query.orQuery("terms", filterkey, filterval).queryMinimumShouldMatch(1)
            }
            break
        case "mediatypes":
            let { has_epub, mediatype } = makeFilterObj(val)
            query.orFilter("terms", { mediatype })
            if (has_epub) query.orFilter("term", "has_epub", true).filterMinimumShouldMatch(1)
            break
        // case "authorkeyword":
        //   query.filter("terms", key, val)
        //   break
    }
    return (query.build() as any).query
}

function applyTemplate(template, obj) {
    let stmt = /^# (for|if)/
    template = template.split(/\s*\n\s*/g)
    let code = "let r = [];"

    let isOpen = false
    for (let row of template) {
        row = row.replace(/^\s*/, "")
        if (row.match(stmt)) {
            code += row.replace(/^# /, "") + "r.push(this.valueTag`"
            isOpen = true
            continue
        } else if (row == "# }") {
            isOpen = false
            code += "`);}"
        } else if (isOpen) {
            code += row
        } else {
            code += "r.push('" + row + "');"
        }
    }
    code += "return r.join('');"

    obj.valueTag = valueTag
    obj.getQuery = getQuery
    let val = Function(code).apply(obj)
    val = val.replace(/,([\}\]])/g, "$1")
    console.log("val", val)
    console.log("val", JSON.stringify(JSON.parse(val), null, 2))
    return JSON.parse(val)
}

export function fromFilters(filters: FilterObj) {
    let template = valueTag`
    {
    "query": {
        "bool": {
        "filter": {
            "bool": {
            "must": [
                # if(this.gender && this.gender != 'all') {
                ${getQuery("gender", filters.gender)},
                # }
                # if(this['sort_date_imprint.date:range']) {
                \${this.getQuery(
                    "sort_date_imprint.date:range",
                    this["sort_date_imprint.date:range"]
                )},
                # }
                # if(this['authorkeyword>authorid'] && this['authorkeyword>authorid'].length) {
                {
                    "nested": {
                        "path": "authorkeyword",
                        "query": {
                            "terms": {
                                "authorkeyword.authorid": \${this['authorkeyword>authorid']}
                            }
                        }

                    }
                },
                # }
                # if(this.languages && this.languages.length) {
                    ${getQuery("languages", filters.languages)},
                # }
                # if(this.keywords && this.keywords.length) {
                    ${getQuery("keywords", filters.keywords)}
                # }
                # if(this.mediatypes && this.mediatypes.length) {
                    ${getQuery("mediatypes", filters.mediatypes)}
                # }
            ]
            }
        }
        }
    }
    }
    `

    return applyTemplate(template, filters)
}
