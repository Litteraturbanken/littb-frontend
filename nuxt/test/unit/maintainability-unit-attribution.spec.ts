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
})
