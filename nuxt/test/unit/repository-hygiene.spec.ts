import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { expect, test } from "vitest"

const repositoryRoot = resolve(import.meta.dirname, "../../..")

test("generated staging artifacts are ignored while authored Nuxt files remain visible", () => {
  const generated = [
    "output/playwright/local.png",
    ".superpowers/brainstorm/.last-port",
    "nuxt/output/lighthouse/report.json",
    "nuxt/test-results-visual-extra/result/error-context.md",
    "nuxt/.playwright-cli/console.log",
    "nuxt/.playwright-mcp/session.json"
  ]

  const ignored = spawnSync("git", ["check-ignore", "--stdin"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: generated.join("\n")
  })

  expect(ignored.status).toBe(0)
  expect(ignored.stdout.trim().split("\n")).toEqual(generated)

  const authored = spawnSync("git", ["check-ignore", "nuxt/app/app.vue"], {
    cwd: repositoryRoot
  })

  expect(authored.status).not.toBe(0)
})
