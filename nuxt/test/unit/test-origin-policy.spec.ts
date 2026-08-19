import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { describe, expect, test } from "vitest"

const projectRoot = resolve(import.meta.dirname, "../..")
const forbiddenOrigin = /http:\/\/127\.0\.0\.1:(?:3000|4100)/u

function specFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return specFiles(path)
    return entry.isFile() && entry.name.endsWith(".spec.ts") ? [path] : []
  })
}

describe("browser test origin policy", () => {
  test("derives operational fixture and application origins from the environment", () => {
    const violations = ["test/e2e", "test/ssr"]
      .flatMap(directory => specFiles(resolve(projectRoot, directory)))
      .filter(path => forbiddenOrigin.test(readFileSync(path, "utf8")))
      .map(path => relative(projectRoot, path))
      .sort()

    expect(violations).toEqual([])
  })
})
