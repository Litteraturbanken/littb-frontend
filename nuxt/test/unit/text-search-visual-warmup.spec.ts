import { readFileSync } from "node:fs"

import { expect, test } from "vitest"

const source = readFileSync(
  new URL("../e2e/text-search.visual.spec.ts", import.meta.url),
  "utf8"
)

test("warms Text Search through the same mounted visual-ready authority", () => {
  const beforeAll = source.slice(
    source.indexOf("test.beforeAll"),
    source.indexOf("for (const visualCase")
  )

  expect(beforeAll).toContain("await request.put(`${fixture}/_text_search/authority`)")
  expect(beforeAll).toContain("await expectReady(warmupPage, visualCases[0])")
  expect(beforeAll.indexOf("await request.put")).toBeLessThan(beforeAll.indexOf("warmupPage.goto"))
  expect(beforeAll.indexOf("warmupPage.goto")).toBeLessThan(beforeAll.indexOf("await expectReady"))
})
