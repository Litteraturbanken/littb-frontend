import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  canonicalUnitSource,
  discoverAuthoredSources,
  inventorySource
} from "../../scripts/semantic-review/source-inventory.mjs"

const temporaryRoots: string[] = []

function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-semantic-inventory-"))
  temporaryRoots.push(root)
  return root
}

function write(root: string, path: string, source: string): void {
  const target = resolve(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("semantic review source inventory", () => {
  test("discovers every authored production source and excludes generated and test data", () => {
    const root = temporaryRoot()
    write(root, "app/pages/index.vue", "<template><main /></template>\n")
    write(root, "server/api/books.get.ts", "export default defineEventHandler(() => [])\n")
    write(root, "shared/types.ts", "export interface Book { title: string }\n")
    write(root, "app/lib/api/generated/lbapi.ts", "export type Generated = never\n")
    write(root, "app/test/helper.ts", "export const helper = true\n")
    write(root, "app/fixtures/page.ts", "export const page = true\n")
    write(root, "app/styles/library.css", ".library {}\n")

    expect(discoverAuthoredSources(root).map(item => item.path)).toEqual([
      "app/pages/index.vue",
      "server/api/books.get.ts",
      "shared/types.ts"
    ])
  })

  test("inventories component fallback, exported units, imports, and exports", () => {
    const source = [
      "<template><main /></template>",
      "<script lang=\"ts\">",
      "import { api } from '~/app/lib/api'",
      "export async function loadBooks() {",
      "  return api.books()",
      "}",
      "</script>"
    ].join("\n")

    const inventory = inventorySource({ path: "app/pages/index.vue", source })

    expect(inventory.units.map(unit => unit.id)).toEqual([
      "app/pages/index.vue::component::index",
      "app/pages/index.vue::template::template[1]",
      "app/pages/index.vue::function::loadBooks"
    ])
    expect(inventory.units.find(unit => unit.name === "loadBooks")?.exported).toBe(true)
    expect(inventory.imports).toEqual([{ source: "~/app/lib/api", names: ["api"] }])
    expect(inventory.exports).toEqual(["loadBooks"])
  })

  test("canonicalizes a named unit independently of unrelated line movement", () => {
    const original = [
      "export function loadBooks() {",
      "  return ['Doktor Glas']",
      "}"
    ].join("\n")
    const moved = [
      "const unrelated = true",
      "",
      "",
      original
    ].join("\n")
    const originalInventory = inventorySource({ path: "app/lib/books.ts", source: original })
    const movedInventory = inventorySource({ path: "app/lib/books.ts", source: moved })
    const originalUnit = originalInventory.units.find(unit => unit.name === "loadBooks")
    const movedUnit = movedInventory.units.find(unit => unit.name === "loadBooks")

    expect(originalUnit).toBeDefined()
    expect(movedUnit).toBeDefined()
    expect(canonicalUnitSource(original, originalUnit!))
      .toBe(canonicalUnitSource(moved, movedUnit!))
  })

  test("partitions Vue block content from the residual component shell", () => {
    const source = "<template>\r\n  <main>Book</main>\r\n</template>\r\n"
    const inventory = inventorySource({ path: "app/pages/index.vue", source })
    const component = inventory.units.find(unit => unit.kind === "component")
    const template = inventory.units.find(unit => unit.kind === "template")

    expect(component).toBeDefined()
    expect(template).toBeDefined()
    expect(canonicalUnitSource(source, component!)).toBe("<template>\n</template>")
    expect(canonicalUnitSource(source, template!)).toBe("  <main>Book</main>")
  })

  test("chunks large Vue template content into bounded review units", () => {
    const source = [
      "<template>",
      ...Array.from({ length: 451 }, (_, index) => `  <p>Line ${index + 1}</p>`),
      "</template>"
    ].join("\n")

    const inventory = inventorySource({ path: "app/pages/LongPage.vue", source })
    const templates = inventory.units.filter(unit => unit.kind === "template")

    expect(templates.map(unit => ({ id: unit.id, ownedLines: unit.ownedLines.length }))).toEqual([
      { id: "app/pages/LongPage.vue::template::template[1]", ownedLines: 400 },
      { id: "app/pages/LongPage.vue::template::template[2]", ownedLines: 51 }
    ])
  })

  test("keeps a server module fallback limited to residual top-level code", () => {
    const source = [
      "import { api } from './api'",
      "export function loadBooks() {",
      "  return api.books()",
      "}"
    ].join("\n")

    const inventory = inventorySource({ path: "server/utils/books.ts", source })
    const module = inventory.units.find(unit => unit.kind === "module")

    expect(module?.ownedLines).toEqual([1])
    expect(canonicalUnitSource(source, module!)).toBe("import { api } from './api'")
  })
})
