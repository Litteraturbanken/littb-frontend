import { describe, expect, test } from "vitest"

import {
  planReviewPackets,
  validatePacketCoverage
} from "../../scripts/semantic-review/packet-planner.mjs"
import { inventorySource } from "../../scripts/semantic-review/source-inventory.mjs"

function inventory(path: string, source: string) {
  return inventorySource({ path, source })
}

function ownedIds(packets: ReturnType<typeof planReviewPackets>): string[] {
  return packets.flatMap(packet => packet.ownedUnitIds)
}

describe("semantic review packet planner", () => {
  test("assigns Vue shell, template, and script responsibilities to separate packets", () => {
    const source = [
      "<template><button @click=\"loadBooks\">Load</button></template>",
      "<script setup lang=\"ts\">",
      "function loadBooks() {",
      "  const normalize = (title: string) => title.trim()",
      "  return normalize('Doktor Glas')",
      "}",
      "</script>"
    ].join("\n")
    const sources = [inventory("app/pages/index.vue", source)]

    const packets = planReviewPackets(sources)

    expect(packets).toEqual([
      expect.objectContaining({
        id: "app/pages/index.vue::packet::component",
        rootUnitIds: ["app/pages/index.vue::component::index"],
        ownedUnitIds: ["app/pages/index.vue::component::index"]
      }),
      expect.objectContaining({
        id: "app/pages/index.vue::packet::template-1",
        rootUnitIds: ["app/pages/index.vue::template::template[1]"],
        ownedUnitIds: ["app/pages/index.vue::template::template[1]"]
      }),
      expect.objectContaining({
        id: "app/pages/index.vue::packet::script-loadBooks",
        rootUnitIds: ["app/pages/index.vue::function::loadBooks"],
        ownedUnitIds: [
          "app/pages/index.vue::function::loadBooks",
          "app/pages/index.vue::function::loadBooks.normalize"
        ]
      })
    ])
    expect(() => validatePacketCoverage(sources, packets)).not.toThrow()
  })

  test("keeps unrelated exported operations in separate packets with their nested helpers", () => {
    const source = [
      "export function loadBooks() {",
      "  const normalize = (title: string) => title.trim()",
      "  return normalize('Doktor Glas')",
      "}",
      "export function loadAuthors() {",
      "  const normalize = (name: string) => name.trim()",
      "  return normalize('Söderberg')",
      "}"
    ].join("\n")
    const sources = [inventory("app/lib/catalog.ts", source)]

    const packets = planReviewPackets(sources)

    expect(packets.map(packet => ({ id: packet.id, owned: packet.ownedUnitIds }))).toEqual([
      {
        id: "app/lib/catalog.ts::packet::loadBooks",
        owned: [
          "app/lib/catalog.ts::function::loadBooks",
          "app/lib/catalog.ts::function::loadBooks.normalize"
        ]
      },
      {
        id: "app/lib/catalog.ts::packet::loadAuthors",
        owned: [
          "app/lib/catalog.ts::function::loadAuthors",
          "app/lib/catalog.ts::function::loadAuthors.normalize"
        ]
      }
    ])
    expect(new Set(ownedIds(packets)).size).toBe(ownedIds(packets).length)
    expect(() => validatePacketCoverage(sources, packets)).not.toThrow()
  })

  test("treats a server handler and otherwise unnamed module as coherent roots", () => {
    const sources = [
      inventory("server/api/books.get.ts", [
        "const booksHandler = defineEventHandler(async event => {",
        "  return event ? [] : []",
        "})",
        "export default booksHandler"
      ].join("\n")),
      inventory("shared/constants.ts", "export type Empty = never\n")
    ]

    const packets = planReviewPackets(sources)

    expect(packets).toEqual([
      expect.objectContaining({
        id: "server/api/books.get.ts::packet::booksHandler",
        ownedUnitIds: [
          "server/api/books.get.ts::function::booksHandler",
          "server/api/books.get.ts::module::server/api/books.get.ts"
        ]
      }),
      expect.objectContaining({
        id: "shared/constants.ts::packet::module",
        ownedUnitIds: ["shared/constants.ts::module::shared/constants.ts"]
      })
    ])
  })

  test("keeps a long template bounded by splitting its content packets", () => {
    const template = Array.from({ length: 451 }, (_, index) => `  <p>Line ${index + 1}</p>`)
    const source = ["<template>", ...template, "</template>"].join("\n")
    const sources = [inventory("app/pages/LongPage.vue", source)]

    const packets = planReviewPackets(sources)

    expect(packets.map(packet => ({
      id: packet.id,
      productionLines: packet.productionLines,
      oversized: packet.oversized
    }))).toEqual([
      { id: "app/pages/LongPage.vue::packet::component", productionLines: 2, oversized: false },
      { id: "app/pages/LongPage.vue::packet::template-1", productionLines: 400, oversized: false },
      { id: "app/pages/LongPage.vue::packet::template-2", productionLines: 51, oversized: false }
    ])
    expect(() => validatePacketCoverage(sources, packets)).not.toThrow()
  })

  test("splits adjacent private roots before their packet exceeds the 400-line target", () => {
    function privateFunction(name: string, lines: number): string[] {
      return [
        `function ${name}() {`,
        ...Array.from({ length: lines - 2 }, (_, index) => `  consume(${index})`),
        "}"
      ]
    }
    const source = [
      ...privateFunction("first", 180),
      ...privateFunction("second", 180),
      ...privateFunction("third", 180)
    ].join("\n")
    const sources = [inventory("app/lib/private-catalog.ts", source)]

    const packets = planReviewPackets(sources)

    expect(packets.map(packet => ({
      id: packet.id,
      roots: packet.rootUnitIds,
      lines: packet.productionLines,
      oversized: packet.oversized
    }))).toEqual([
      {
        id: "app/lib/private-catalog.ts::packet::module-first",
        roots: [
          "app/lib/private-catalog.ts::function::first",
          "app/lib/private-catalog.ts::function::second"
        ],
        lines: 360,
        oversized: false
      },
      {
        id: "app/lib/private-catalog.ts::packet::module-third",
        roots: ["app/lib/private-catalog.ts::function::third"],
        lines: 180,
        oversized: false
      }
    ])
    expect(() => validatePacketCoverage(sources, packets)).not.toThrow()
  })

  test("does not double-count named functions in server utility module packets", () => {
    const operation = (name: string) => [
      `export function ${name}() {`,
      ...Array.from({ length: 248 }, (_, index) => `  consume(${index})`),
      "}"
    ]
    const sources = [inventory("server/utils/catalog.ts", [
      "import { consume } from './consume'",
      ...operation("first"),
      ...operation("second")
    ].join("\n"))]

    const packets = planReviewPackets(sources)

    expect(packets.map(packet => ({ id: packet.id, lines: packet.productionLines }))).toEqual([
      { id: "server/utils/catalog.ts::packet::first", lines: 250 },
      { id: "server/utils/catalog.ts::packet::second", lines: 250 },
      { id: "server/utils/catalog.ts::packet::module", lines: 1 }
    ])
    expect(packets.every(packet => !packet.oversized)).toBe(true)
  })

  test("rejects missing, duplicate, and unknown unit ownership", () => {
    const sources = [inventory("app/lib/books.ts", "export function books() { return [] }\n")]
    const packets = planReviewPackets(sources)
    const unitId = packets[0]!.ownedUnitIds[0]!

    expect(() => validatePacketCoverage(sources, [])).toThrow("Missing packet owner")
    expect(() => validatePacketCoverage(sources, [
      packets[0]!,
      { ...packets[0]!, id: `${packets[0]!.id}-duplicate` }
    ])).toThrow("Duplicate packet owner")
    expect(() => validatePacketCoverage(sources, [{
      ...packets[0]!,
      ownedUnitIds: [unitId, "app/lib/books.ts::function::missing"]
    }])).toThrow("Unknown packet unit")
  })
})
