const readableMediaTypes = new Set(["etext", "faksimil"])
const corpusSorts = ["title", "chronology", "popularity"]
const corpusPages = [1, 5, 10, 25, 50, 100]
const samplesPerResponse = 5

function sourceInfoSearchMatrix() {
    return corpusSorts.flatMap(sort => corpusPages.map(page => ({
        mode: "works",
        filters: { query: "" },
        sort,
        reverse: false,
        page,
        source_only: false
    })))
}

function readableWork(item) {
    return item
        && typeof item.route_author_id === "string"
        && item.route_author_id.length > 0
        && typeof item.route_title_id === "string"
        && item.route_title_id.length > 0
        && readableMediaTypes.has(item.route_media_type)
}

function uniqueReadableWorks(items) {
    const output = []
    const seen = new Set()
    for (const item of items) {
        if (!readableWork(item)) continue
        const identity = JSON.stringify([
            item.route_author_id,
            item.route_title_id,
            item.route_media_type
        ])
        if (seen.has(identity)) continue
        seen.add(identity)
        output.push({
            route_author_id: item.route_author_id,
            route_title_id: item.route_title_id,
            route_media_type: item.route_media_type
        })
    }
    return output
}

function evenlySpaced(items, count) {
    if (items.length <= count) return items
    return Array.from({ length: count }, (_, index) => (
        items[Math.round(index * (items.length - 1) / (count - 1))]
    ))
}

function sampleReadableWorks(responses, limit = 96) {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new TypeError("source-info corpus limit must be a positive integer")
    }
    const output = []
    const seen = new Set()
    for (const response of responses) {
        if (response?.mode !== "works" || !Array.isArray(response.items)) {
            throw new TypeError("invalid works response in source-info corpus")
        }
        const candidates = evenlySpaced(
            uniqueReadableWorks(response.items),
            samplesPerResponse
        )
        for (const item of candidates) {
            const identity = JSON.stringify([
                item.route_author_id,
                item.route_title_id,
                item.route_media_type
            ])
            if (seen.has(identity)) continue
            seen.add(identity)
            output.push(item)
            if (output.length === limit) return output
        }
    }
    return output
}

async function mapWithConcurrency(values, concurrency, operation) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new TypeError("concurrency must be a positive integer")
    }
    const results = new Array(values.length)
    let nextIndex = 0
    const workers = Array.from(
        { length: Math.min(concurrency, values.length) },
        async () => {
            while (nextIndex < values.length) {
                const index = nextIndex
                nextIndex += 1
                results[index] = await operation(values[index], index)
            }
        }
    )
    await Promise.all(workers)
    return results
}

module.exports = {
    mapWithConcurrency,
    sampleReadableWorks,
    sourceInfoSearchMatrix
}
