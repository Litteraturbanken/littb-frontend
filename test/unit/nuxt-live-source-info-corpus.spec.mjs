import assert from "node:assert/strict"
import test from "node:test"

import corpus from "../e2e/nuxt_live_source_info_corpus.cjs"

const {
    mapWithConcurrency,
    sourceInfoSearchMatrix,
    sampleReadableWorks
} = corpus

function work(index, mediaType = "etext") {
    return {
        route_author_id: `Author${index}`,
        route_title_id: `Title${index}`,
        route_media_type: mediaType
    }
}

test("source-info corpus matrix spans three orderings and six bounded pages", () => {
    const matrix = sourceInfoSearchMatrix()

    assert.equal(matrix.length, 18)
    assert.deepEqual(
        [...new Set(matrix.map(request => request.sort))],
        ["title", "chronology", "popularity"]
    )
    assert.deepEqual(
        [...new Set(matrix.map(request => request.page))],
        [1, 5, 10, 25, 50, 100]
    )
    assert.ok(matrix.every(request => (
        request.mode === "works"
        && request.reverse === false
        && request.source_only === false
        && request.filters.query === ""
    )))
})

test("source-info corpus sampling is deterministic, readable, unique, and bounded", () => {
    const items = Array.from({ length: 10 }, (_, index) => work(index))
    items.splice(3, 0, work(30, "pdf"), work(31, "infopost"), work(0))

    const sample = sampleReadableWorks([{ mode: "works", items }], 5)

    assert.deepEqual(sample, [work(0), work(2), work(5), work(7), work(9)])
})

test("bounded mapping preserves input order and never exceeds its concurrency", async () => {
    let active = 0
    let maximumActive = 0
    const values = [30, 5, 20, 1, 15, 10]

    const output = await mapWithConcurrency(values, 2, async value => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await new Promise(resolve => setTimeout(resolve, value))
        active -= 1
        return value * 2
    })

    assert.deepEqual(output, [60, 10, 40, 2, 30, 20])
    assert.equal(maximumActive, 2)
})
