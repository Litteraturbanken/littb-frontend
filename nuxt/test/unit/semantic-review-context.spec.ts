import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  enrichReviewPackets,
  riskWeights
} from "../../scripts/semantic-review/context.mjs"
import { planReviewPackets } from "../../scripts/semantic-review/packet-planner.mjs"
import { inventorySource } from "../../scripts/semantic-review/source-inventory.mjs"

const temporaryRoots: string[] = []

function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-semantic-context-"))
  temporaryRoots.push(root)
  return root
}

function write(root: string, path: string, source: string): void {
  const target = resolve(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

function sources(records: Array<[string, string]>) {
  return records.map(([path, source]) => inventorySource({ path, source }))
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("semantic review packet context", () => {
  test("attaches resolved imports, callers, generated API types, and real test context", () => {
    const root = temporaryRoot()
    const production = sources([
      ["app/pages/books.vue", [
        "<script setup lang=\"ts\">",
        "import { loadBooks } from '~/lib/books'",
        "import type { components } from '~/lib/api/generated/lbapi'",
        "const books = await loadBooks()",
        "</script>",
        "<template><main>{{ books.length }}</main></template>"
      ].join("\n")],
      ["app/lib/books.ts", "export async function loadBooks() { return [] }\n"],
      ["app/components/BookLink.vue", [
        "<script setup lang=\"ts\">",
        "import { loadBooks } from '~/lib/books'",
        "void loadBooks",
        "</script>",
        "<template><a href=\"/books\">Books</a></template>"
      ].join("\n")]
    ])
    write(root, "test/unit/books.spec.ts", [
      "import { loadBooks } from '../../app/lib/books'",
      "void loadBooks"
    ].join("\n"))
    write(root, "test/ssr/books.spec.ts", "test('books route', () => {})\n")

    const enriched = enrichReviewPackets({
      root,
      sources: production,
      packets: planReviewPackets(production),
      maintainability: { units: [] }
    })
    const page = enriched.find(packet => packet.id === "app/pages/books.vue::packet::component")
    const library = enriched.find(packet => packet.id === "app/lib/books.ts::packet::loadBooks")

    expect(page).toMatchObject({
      imports: ["app/lib/books.ts"],
      callers: [],
      typeBoundaries: ["app/lib/api/generated/lbapi.ts#components"],
      tests: [{ path: "test/ssr/books.spec.ts", evidence: "basename" }]
    })
    expect(library).toMatchObject({
      imports: [],
      callers: ["app/components/BookLink.vue", "app/pages/books.vue"],
      tests: [
        { path: "test/ssr/books.spec.ts", evidence: "basename" },
        { path: "test/unit/books.spec.ts", evidence: "import" }
      ]
    })
  })

  test("classifies syntax-backed risk and merges maintainability findings by owned unit", () => {
    const root = temporaryRoot()
    const source = [
      "<script setup lang=\"ts\">",
      "import type { components } from '~/lib/api/generated/lbapi'",
      "const state = useState('books', () => [])",
      "const controller = new AbortController()",
      "const { data } = await useAsyncData('books', () => $fetch('/v2/books'))",
      "void components; void state; void controller; void data",
      "</script>",
      "<template><div @click=\"state = []\" v-html=\"data\" /></template>"
    ].join("\n")
    const production = sources([["app/pages/books.vue", source]])
    const packets = planReviewPackets(production)
    const unitId = packets[0]!.ownedUnitIds.find(id => id.includes("useAsyncData"))
      ?? packets[0]!.ownedUnitIds[0]!

    const [packet] = enrichReviewPackets({
      root,
      sources: production,
      packets,
      maintainability: {
        units: [{
          id: unitId,
          findings: [{ rule: "cognitive-complexity", message: "Complexity exceeds 12" }]
        }]
      }
    })

    expect(packet!.riskFlags).toEqual([
      "accessibility",
      "api-boundary",
      "concurrency",
      "maintainability-finding",
      "raw-html",
      "route",
      "ssr-state",
      "untested"
    ])
    expect(packet!.riskScore).toBe(packet!.riskFlags.reduce(
      (total, flag) => total + riskWeights[flag],
      0
    ))
    expect(packet!.maintainabilityFindings).toEqual([{
      rule: "cognitive-complexity",
      message: "Complexity exceeds 12"
    }])
  })

  test("does not derive risk from comments or unrelated identifier substrings", () => {
    const root = temporaryRoot()
    const production = sources([["app/lib/plain.ts", [
      "// localStorage, innerHTML, Promise.all, $fetch",
      "export const innerHTMLLabel = 'plain text'"
    ].join("\n")]])

    const [packet] = enrichReviewPackets({
      root,
      sources: production,
      packets: planReviewPackets(production),
      maintainability: { units: [] }
    })

    expect(packet!.riskFlags).toEqual(["untested"])
  })

  test("orders equal-risk packets by stable packet ID", () => {
    const root = temporaryRoot()
    const production = sources([
      ["shared/zeta.ts", "export const zeta = true\n"],
      ["shared/alpha.ts", "export const alpha = true\n"]
    ])

    const enriched = enrichReviewPackets({
      root,
      sources: production,
      packets: planReviewPackets(production),
      maintainability: { units: [] }
    })

    expect(enriched.map(packet => packet.id)).toEqual([
      "shared/alpha.ts::packet::module",
      "shared/zeta.ts::packet::module"
    ])
  })
})
