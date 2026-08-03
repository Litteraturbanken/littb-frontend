import { describe, expect, test } from "vitest"
import { createTextSearchRequestOwner } from "../../app/lib/text-search-request-owner"

describe("text-search request ownership", () => {
  test("starting a newer request aborts and supersedes the previous request", () => {
    const owner = createTextSearchRequestOwner()
    const first = owner.start("first")
    const second = owner.start("second")

    expect(first.signal.aborted).toBe(true)
    expect(owner.isCurrent(first, "first")).toBe(false)
    expect(owner.isCurrent(second, "second")).toBe(true)
  })

  test("cancel aborts active work and rejects a stale completion", () => {
    const owner = createTextSearchRequestOwner()
    const request = owner.start("active")

    owner.cancel()

    expect(request.signal.aborted).toBe(true)
    expect(owner.isCurrent(request, "active")).toBe(false)
    expect(owner.finish(request)).toBe(false)
  })

  test("a failed request can finish and retry the same identity", () => {
    const owner = createTextSearchRequestOwner()
    const failed = owner.start("same")

    expect(owner.finish(failed)).toBe(true)
    const retry = owner.start("same")

    expect(retry.signal.aborted).toBe(false)
    expect(owner.isCurrent(retry, "same")).toBe(true)
  })

  test("independent request channels do not supersede one another", () => {
    const counts = createTextSearchRequestOwner()
    const options = createTextSearchRequestOwner()
    const countRequest = counts.start("route")
    const optionsRequest = options.start("route")

    counts.cancel()

    expect(countRequest.signal.aborted).toBe(true)
    expect(optionsRequest.signal.aborted).toBe(false)
    expect(options.isCurrent(optionsRequest, "route")).toBe(true)
  })
})
