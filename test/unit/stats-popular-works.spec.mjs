import assert from "node:assert/strict"
import {
    POPULAR_WORKS_FETCH_SIZE,
    POPULAR_WORKS_LIMIT,
    getPopularWorkAuthor,
    getPopularWorksQueryOptions,
    getPopularWorkUrl,
    selectPopularWorks
} from "../../app/scripts/features/stats/popularWorks.mjs"

assert.strictEqual(POPULAR_WORKS_LIMIT, 30)
assert.strictEqual(POPULAR_WORKS_FETCH_SIZE, 100)

const queryOptions = getPopularWorksQueryOptions()
assert.strictEqual(queryOptions.q, "*")
assert.strictEqual(queryOptions.sort_field, "popularity|desc")
assert.strictEqual(queryOptions.partial_string, true)
assert.strictEqual(queryOptions.author_aggs, true)
assert.strictEqual(queryOptions.to, 100)
assert.ok(queryOptions.include.includes("main_author.authorid"))
assert.ok(queryOptions.include.includes("authors.full_name"))

assert.deepStrictEqual(
    selectPopularWorks([{ title: "one" }, { title: "two" }, { title: "three" }], 2),
    [{ title: "one" }, { title: "two" }]
)

const mainAuthor = { authorid: "main" }
const nestedAuthor = { authorid: "nested" }
const workAuthor = { authorid: "work" }

assert.strictEqual(getPopularWorkAuthor({ main_author: mainAuthor }), mainAuthor)
assert.strictEqual(getPopularWorkAuthor({ authors: [nestedAuthor] }), nestedAuthor)
assert.strictEqual(getPopularWorkAuthor({ work_authors: [workAuthor] }), workAuthor)
assert.deepStrictEqual(getPopularWorkAuthor({}), {})

assert.strictEqual(
    getPopularWorkUrl({
        mediatypes: [{ label: "pdf", url: "txt/lb1/lb1.pdf" }]
    }),
    "/txt/lb1/lb1.pdf"
)

assert.strictEqual(
    getPopularWorkUrl({
        main_author: { authorid: "StrindbergA" },
        work_titleid: "giftas",
        startpagename: "sida_1",
        mediatype: "etext"
    }),
    "/författare/StrindbergA/titlar/giftas/sida/sida_1/etext"
)

console.log("stats popular works tests: ok")
