import { describe, expect, test } from "vitest"

import {
  attributeFindingToUnit,
  listSourceUnits
} from "../../scripts/maintainability/unit-attribution.mjs"

describe("maintainability source-unit attribution", () => {
  test("attributes nested TypeScript findings to the smallest named unit", () => {
    const source = [
      "export function loadBooks() {",
      "  const normalizeTitle = (title: string) => {",
      "    return title.trim()",
      "  }",
      "  return normalizeTitle('Doktor Glas')",
      "}"
    ].join("\n")

    expect(attributeFindingToUnit({
      source,
      relativePath: "app/lib/books.ts",
      line: 3,
      column: 5
    })).toEqual({
      id: "app/lib/books.ts::function::loadBooks.normalizeTitle",
      kind: "function",
      name: "loadBooks.normalizeTitle",
      path: "app/lib/books.ts",
      startLine: 2,
      endLine: 4
    })

    expect(attributeFindingToUnit({
      source,
      relativePath: "app/lib/books.ts",
      line: 5,
      column: 3
    })).toMatchObject({
      id: "app/lib/books.ts::function::loadBooks",
      startLine: 1,
      endLine: 6
    })
  })

  test("names class methods and uses the module for top-level findings", () => {
    const source = [
      "const timeout = 100",
      "export class Reader {",
      "  nextPage() {",
      "    return timeout + 1",
      "  }",
      "}"
    ].join("\n")

    expect(attributeFindingToUnit({
      source,
      relativePath: "app/lib/reader.ts",
      line: 4
    })).toMatchObject({
      id: "app/lib/reader.ts::method::Reader.nextPage",
      kind: "method",
      name: "Reader.nextPage",
      startLine: 3,
      endLine: 5
    })
    expect(attributeFindingToUnit({
      source,
      relativePath: "app/lib/reader.ts",
      line: 1
    })).toEqual({
      id: "app/lib/reader.ts::module::app/lib/reader.ts",
      kind: "module",
      name: "app/lib/reader.ts",
      path: "app/lib/reader.ts",
      startLine: 1,
      endLine: 6
    })
  })

  test("preserves Vue source offsets and falls back to the component", () => {
    const source = [
      "<template>",
      "  <button>Next</button>",
      "</template>",
      "<script setup lang=\"ts\">",
      "async function fetchPage() {",
      "  return await Promise.resolve(2)",
      "}",
      "</script>"
    ].join("\n")

    expect(attributeFindingToUnit({
      source,
      relativePath: "app/pages/ReaderPage.vue",
      line: 6
    })).toEqual({
      id: "app/pages/ReaderPage.vue::function::fetchPage",
      kind: "function",
      name: "fetchPage",
      path: "app/pages/ReaderPage.vue",
      startLine: 5,
      endLine: 7
    })
    expect(attributeFindingToUnit({
      source,
      relativePath: "app/pages/ReaderPage.vue",
      line: 2
    })).toEqual({
      id: "app/pages/ReaderPage.vue::component::ReaderPage",
      kind: "component",
      name: "ReaderPage",
      path: "app/pages/ReaderPage.vue",
      startLine: 1,
      endLine: 8
    })
  })

  test("lists units in deterministic source order", () => {
    const source = [
      "const second = () => 2",
      "function first() { return 1 }"
    ].join("\n")

    expect(listSourceUnits({ source, relativePath: "server/example.ts" }))
      .toEqual([
        {
          id: "server/example.ts::function::second",
          kind: "function",
          name: "second",
          path: "server/example.ts",
          startLine: 1,
          endLine: 1
        },
        {
          id: "server/example.ts::function::first",
          kind: "function",
          name: "first",
          path: "server/example.ts",
          startLine: 2,
          endLine: 2
        }
      ])
  })

  test("qualifies same-named methods by their enclosing class", () => {
    const source = [
      "class First { run() { return 1 } }",
      "class Second { run() { return 2 } }"
    ].join("\n")

    expect(listSourceUnits({ source, relativePath: "app/lib/runners.ts" }))
      .toEqual([
        expect.objectContaining({
          id: "app/lib/runners.ts::method::First.run",
          name: "First.run"
        }),
        expect.objectContaining({
          id: "app/lib/runners.ts::method::Second.run",
          name: "Second.run"
        })
      ])
  })

  test("names callbacks through transparent single-argument wrappers", () => {
    const source = [
      "const readerPageHandler = defineEventHandler(async event => {",
      "  if (!event) throw new Error('missing')",
      "  return event",
      "})",
      "export default readerPageHandler"
    ].join("\n")

    expect(attributeFindingToUnit({
      source,
      relativePath: "server/api/reader.get.ts",
      line: 1,
      column: 48
    })).toMatchObject({
      id: "server/api/reader.get.ts::function::readerPageHandler",
      kind: "function",
      name: "readerPageHandler",
      startLine: 1,
      endLine: 4
    })
  })

  test("gives unowned callbacks distinct stable structural identities", () => {
    const source = [
      "watch(first, () => { if (first.value) act() })",
      "watch(second, () => { if (second.value) act() })"
    ].join("\n")

    const first = attributeFindingToUnit({
      source,
      relativePath: "app/lib/watchers.ts",
      line: 1,
      column: 14
    })
    const second = attributeFindingToUnit({
      source,
      relativePath: "app/lib/watchers.ts",
      line: 2,
      column: 15
    })

    expect(first.kind).toBe("callback")
    expect(first.id).toMatch(/^app\/lib\/watchers\.ts::callback::watch\.callback\[2\]@[a-f0-9]{12}#1$/u)
    expect(second.kind).toBe("callback")
    expect(second.id).toMatch(/^app\/lib\/watchers\.ts::callback::watch\.callback\[2\]@[a-f0-9]{12}#1$/u)
    expect(first.id).not.toBe(second.id)
  })

  test("uses columns to distinguish callbacks that share one line", () => {
    const source = "run(() => first()); run(() => second())"

    const first = attributeFindingToUnit({
      source,
      relativePath: "app/lib/inline.ts",
      line: 1,
      column: 10
    })
    const second = attributeFindingToUnit({
      source,
      relativePath: "app/lib/inline.ts",
      line: 1,
      column: 30
    })

    expect(first.id).toMatch(/^app\/lib\/inline\.ts::callback::run\.callback\[1\]@[a-f0-9]{12}#1$/u)
    expect(second.id).toMatch(/^app\/lib\/inline\.ts::callback::run\.callback\[1\]@[a-f0-9]{12}#1$/u)
    expect(first.id).not.toBe(second.id)
  })

  test("preserves a callback identity when an unrelated same-callee callback is inserted earlier", () => {
    const original = "watch(first, () => first.value)"
    const inserted = [
      "watch(unrelated, () => unrelated.value)",
      original
    ].join("\n")

    const [originalUnit] = listSourceUnits({
      source: original,
      relativePath: "app/lib/stable-watchers.ts"
    })
    const [, movedUnit] = listSourceUnits({
      source: inserted,
      relativePath: "app/lib/stable-watchers.ts"
    })

    expect(movedUnit!.id).toBe(originalUnit!.id)
  })

  test("does not let comments churn a callback's structural identity", () => {
    const [plainUnit] = listSourceUnits({
      source: "watch(first, () => first.value)",
      relativePath: "app/lib/commented-watchers.ts"
    })
    const [commentedUnit] = listSourceUnits({
      source: [
        "watch(first,",
        "  // why this watch exists",
        "  () => first.value)"
      ].join("\n"),
      relativePath: "app/lib/commented-watchers.ts"
    })

    expect(commentedUnit!.id).toBe(plainUnit!.id)
  })
})
