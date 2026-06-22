import assert from "node:assert/strict"
import {
    buildFilterQuery,
    buildSearchFilterPayload,
    composeQuery,
    fromFilters
} from "../../app/scripts/query"

type Filters = Parameters<typeof fromFilters>[0]

function assertQuery(name: string, filters: Filters, expected: string) {
    const actual = fromFilters(filters)
    assert.strictEqual(actual, expected, name)
}

assertQuery("empty filters yield empty string", {}, "")

assertQuery(
    "gender filter combines top-level and nested gender checks",
    { gender: "female" },
    "(gender:female OR authors>(gender:female))"
)

assertQuery(
    "date range expands to related fields",
    { "sort_date_imprint.date:range": [1800, 1900] },
    "(sort_date_imprint.date:[1800 TO 1900] OR birth.date:[1800 TO 1900] OR death.date:[1800 TO 1900])"
)

assertQuery(
    "keywords aggregate with logical OR",
    { keywords: ["keyword:Barnlitteratur", "texttype:drama;poetry"] },
    "(keyword:Barnlitteratur OR texttype:(drama OR poetry))"
)

assertQuery(
    "grouped keyword expressions aggregate with logical OR",
    { keywords: ["keyword:Biografika|texttype:brev;brevsamling"] },
    "(keyword:Biografika OR texttype:(brev OR brevsamling))"
)

assertQuery(
    "language filters combine lexical flags",
    { languages: ["language:lat", "modernized:true", "translation:yes", "foreign:yes"] },
    "(language:lat OR modernized:true OR (keyword:language-source OR keyword:translated OR (authors>(type:translator))) OR (_exists_:language AND NOT language:swe) OR language_source:unknown)"
)

assertQuery(
    "language filters differentiate translation versus original",
    { languages: ["translation:yes", "original:yes"] },
    "((keyword:language-source OR keyword:translated OR (authors>(type:translator))) OR ((NOT (keyword:language-source OR keyword:translated OR (authors>(type:translator)))) AND NOT language_source:unknown))"
)

assertQuery(
    "media filters merge mediatype and epub availability",
    { mediatypes: ["mediatype:pdf", "has_epub:true"] },
    "(mediatype:pdf OR has_epub:true)"
)

assertQuery(
    "author keyword filters use nested terms",
    { "authorkeyword>authorid": ["id1", "id2"] },
    "authorkeyword>(authorid:(id1 OR id2))"
)

assertQuery(
    "author filters use nested author path",
    { "authors>authorid": ["a1", "a2"] },
    "authors>(authorid:(a1 OR a2))"
)

assertQuery(
    "combining filters groups them with AND",
    {
        gender: "female",
        keywords: ["keyword:Barnlitteratur"]
    },
    "(gender:female OR authors>(gender:female)) AND (keyword:Barnlitteratur)"
)

console.log("query builder parity tests: ok")

const complexFilterQuery = buildFilterQuery({
    gender: "female",
    "main_author.gender": "female",
    keywords: ["keyword:Barnlitteratur"]
})
assert.strictEqual(
    complexFilterQuery,
    "(gender:female OR authors>(gender:female)) AND (keyword:Barnlitteratur) AND (main_author.gender:female)"
)

const nestedFieldFilterQuery = buildFilterQuery({
    "export>type": ["xml", "txt", "workdb"]
})
assert.strictEqual(
    nestedFieldFilterQuery,
    "(export>type:xml OR export>type:txt OR export>type:workdb)"
)

const composedQuery = composeQuery({
    filterQuery: complexFilterQuery,
    filterString: "Strindberg",
    keywordAux: ["keyword:klassiker"]
})
assert.strictEqual(
    composedQuery,
    "(keyword:(klassiker)) AND (gender:female OR authors>(gender:female)) AND (keyword:Barnlitteratur) AND (main_author.gender:female) AND (Strindberg)"
)

const searchPayload = buildSearchFilterPayload({
    gender: "female",
    languages: ["language:lat", "translation:true", "foreign:true"],
    keywords: ["keyword:Barnlitteratur"],
    "authorkeyword>authorid": ["id1"],
    "sort_date_imprint.date:range": [1800, 1900]
})

assert.deepStrictEqual(searchPayload.textFilter, {
    language: ["lat"],
    keyword: ["Barnlitteratur"],
    "authorkeyword>authorid": ["id1"],
    "main_author.gender": "female",
    "sort_date_imprint.date:range": "1800,1900",
    _exists: ["language"]
})

assert.deepStrictEqual(searchPayload.keywordAux, [
    'RAW:(keyword:"language-source" OR keyword:"translated" OR authors>type:translator)',
    "RAW:-language:swe"
])

const groupedKeywordPayload = buildSearchFilterPayload({
    keywords: ["keyword:Biografika|texttype:brev;brevsamling"]
})

assert.deepStrictEqual(groupedKeywordPayload.textFilter, {
    keyword: ["Biografika"],
    texttype: ["brev", "brevsamling"]
})

assert.deepStrictEqual(groupedKeywordPayload.keywordAux, [])

console.log("extended query utilities tests: ok")
