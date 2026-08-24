import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"
import config, { createPlaywrightConfig } from "../../playwright.config"
import dictionaryProductionConfig from "../../playwright.dictionary-production.config"
import readerAssetsConfig from "../../playwright.reader-assets-production.config"
import slaArticlesConfig from "../../playwright.sla-articles-nuxt.config"

type Pattern = string | RegExp

function matches(patterns: Pattern | Pattern[] | undefined, path: string): boolean {
  if (!patterns) return false
  return (Array.isArray(patterns) ? patterns : [patterns]).some((pattern) => (
    typeof pattern === "string" ? path.includes(pattern) : pattern.test(path)
  ))
}

function nuxtServerCommand(fixtureConfig: typeof config): string | undefined {
  const servers = Array.isArray(fixtureConfig.webServer)
    ? fixtureConfig.webServer
    : [fixtureConfig.webServer]
  return servers.find(server => server?.command.includes("NUXT_CONTENT_BASE"))?.command
}

function serverCommandContaining(
  fixtureConfig: typeof config,
  fragment: string
): string | undefined {
  const servers = Array.isArray(fixtureConfig.webServer)
    ? fixtureConfig.webServer
    : [fixtureConfig.webServer]
  return servers.find(server => server?.command.includes(fragment))?.command
}

function ssrSpecPaths(): string[] {
  return readdirSync(resolve(import.meta.dirname, "../ssr"), { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".spec.ts"))
    .map(entry => `ssr/${entry}`)
}

function runsSpec(
  project: typeof config.projects[number] | undefined,
  path: string
): boolean {
  return Boolean(project && matches(project.testMatch, path) && !matches(project.testIgnore, path))
}

describe("Playwright project boundaries", () => {
  test("keeps the default output directory when no shard override is present", () => {
    expect(config.outputDir).toBe("test-results")
  })

  test("runs the mobile Editor behavior only in the mobile project", () => {
    const spec = "e2e/editor-reader.mobile.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(matches(desktop?.testMatch, spec)).toBe(true)
    expect(matches(desktop?.testIgnore, spec)).toBe(true)
    expect(matches(mobile?.testMatch, spec)).toBe(true)
    expect(matches(mobile?.testIgnore, spec)).toBe(false)
  })

  test("keeps the production dictionary proxy spec in its production-build config", () => {
    const spec = "e2e/reader-dictionary-production.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(matches(desktop?.testMatch, spec)).toBe(true)
    expect(matches(desktop?.testIgnore, spec)).toBe(true)
    expect(matches(mobile?.testMatch, spec)).toBe(false)
  })

  test("keeps the production reader asset spec in its production-build config", () => {
    const spec = "e2e/reader-assets-production.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(matches(desktop?.testMatch, spec)).toBe(true)
    expect(matches(desktop?.testIgnore, spec)).toBe(true)
    expect(matches(mobile?.testMatch, spec)).toBe(false)
  })

  test("assigns the Reader embed matrix to desktop and its dedicated case to mobile", () => {
    const spec = "e2e/reader-production.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(runsSpec(desktop, spec)).toBe(true)
    expect(runsSpec(mobile, spec)).toBe(true)
  })

  test("launches development and reader-asset suites with the local embed origin", () => {
    for (const [fixtureConfig, fixturePort] of [
      [config, 4100],
      [readerAssetsConfig, 4120]
    ] as const) {
      const command = serverCommandContaining(fixtureConfig, "NUXT_API_BASE")

      expect(command).toContain("NUXT_PUBLIC_READER_DICTIONARY_MODE=embed")
      expect(command).toContain(
        `NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN=http://127.0.0.1:${fixturePort}`
      )
    }
  })

  test("keeps the production dictionary suite as the explicit legacy rollback", () => {
    const command = serverCommandContaining(dictionaryProductionConfig, "NUXT_API_BASE")

    expect(command).toContain("NUXT_PUBLIC_READER_DICTIONARY_MODE=legacy")
    expect(command).not.toContain("NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN")
  })

  test("bypasses only the Nuxt checkout lock while keeping isolated servers non-reusable", () => {
    const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer]
    const nuxtServer = servers.find(server => server?.command.includes("yarn dev"))

    expect(nuxtServer?.command).toContain(
      "NUXT_IGNORE_LOCK=1 node scripts/run-owned-webserver.mjs"
    )
    expect(nuxtServer?.command).toContain("yarn dev --port 3000")
    expect(nuxtServer?.reuseExistingServer).toBe(false)
    expect(servers.every(server => server?.reuseExistingServer === false)).toBe(true)
  })

  test("runs local content fixture launchers without a second Reader authority", () => {
    for (const fixtureConfig of [config, readerAssetsConfig, slaArticlesConfig]) {
      expect(nuxtServerCommand(fixtureConfig)).toContain(
        "NUXT_DEPLOYMENT_ENVIRONMENT=development"
      )
      expect(nuxtServerCommand(fixtureConfig)).toContain("NUXT_CONTENT_BASE=http://127.0.0.1:")
      expect(nuxtServerCommand(fixtureConfig)).not.toContain("NUXT_READER_SOURCE_BASE")
    }
  })

  test("creates staging SSR launchers without a private Reader authority", () => {
    const ssrConfig = createPlaywrightConfig({
      deploymentEnvironment: "staging"
    })

    expect(nuxtServerCommand(ssrConfig)).toContain(
      "NUXT_DEPLOYMENT_ENVIRONMENT=staging"
    )
    expect(nuxtServerCommand(ssrConfig)).not.toContain("NUXT_READER_SOURCE_BASE")
  })

  test("can omit E2E projects from a focused SSR launcher", () => {
    const ssrConfig = createPlaywrightConfig({ includeE2eProjects: false })

    expect(ssrConfig.projects?.map(project => project.name)).toEqual(["ssr"])
  })

  test("uses a narrow staging launcher for only SSR policy contracts", async () => {
    const ssrConfig = (await import("../../playwright.ssr.config")).default
    const stagingProject = ssrConfig.projects?.find(project => project.name === "ssr-staging")

    expect(ssrConfig.projects?.map(project => project.name)).toEqual(["ssr-staging"])
    expect(nuxtServerCommand(ssrConfig)).toContain(
      "NUXT_DEPLOYMENT_ENVIRONMENT=staging"
    )
    expect(nuxtServerCommand(ssrConfig)).not.toContain("NUXT_READER_SOURCE_BASE")
    expect(runsSpec(stagingProject, "ssr/robots.spec.ts")).toBe(true)
    expect(runsSpec(stagingProject, "ssr/deployment-identity.spec.ts")).toBe(true)
    expect(runsSpec(stagingProject, "ssr/reader.spec.ts")).toBe(false)
  })

  test("assigns every SSR spec to exactly one local or staging launcher", async () => {
    const ssrConfig = (await import("../../playwright.ssr.config")).default
    const localProject = config.projects?.find(project => project.name === "ssr")
    const stagingProject = ssrConfig.projects?.find(project => project.name === "ssr-staging")

    for (const spec of ssrSpecPaths()) {
      expect([
        runsSpec(localProject, spec),
        runsSpec(stagingProject, spec)
      ].filter(Boolean)).toHaveLength(1)
    }
  })
})
