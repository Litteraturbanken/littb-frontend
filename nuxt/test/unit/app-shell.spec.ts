import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const appSource = readFileSync(
  new URL("../../app/app.vue", import.meta.url),
  "utf8"
)

describe("application shell", () => {
  test("places exactly one Nuxt route announcer before the routed page", () => {
    expect(appSource.match(/<NuxtRouteAnnouncer\s*\/>/g)).toHaveLength(1)
    expect(appSource).toMatch(
      /<NuxtLayout>\s*<NuxtRouteAnnouncer\s*\/>\s*<NuxtPage\s*\/>\s*<\/NuxtLayout>/
    )
  })
})
