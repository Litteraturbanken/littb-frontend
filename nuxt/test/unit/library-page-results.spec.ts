import { describe, expect, it, vi } from "vitest"

import { assignLibraryPageResult } from "../../app/lib/library/page-results"

describe("assignLibraryPageResult", () => {
  it("delivers a discriminated page response to only its matching owner", () => {
    const handlers = {
      all: vi.fn(),
      authors: vi.fn(),
      works: vi.fn(),
      parts: vi.fn(),
      latest: vi.fn(),
      epub: vi.fn(),
      pdf: vi.fn()
    }
    const response = {
      data: [],
      hits: 2,
      distinctHits: 2,
      authorIds: [],
      suggest: [],
      failed: false
    }

    assignLibraryPageResult({ mode: "works", response }, handlers)

    expect(handlers.works).toHaveBeenCalledOnce()
    expect(handlers.works).toHaveBeenCalledWith(response)
    expect(Object.values(handlers).filter(handler => handler.mock.calls.length > 0)).toHaveLength(1)
  })
})
