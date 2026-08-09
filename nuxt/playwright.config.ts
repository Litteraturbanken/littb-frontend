import { realpathSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`
const dependencyRoot = realpathSync(resolve(import.meta.dirname, "node_modules"))

export default defineConfig({
  testDir: "./test",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  snapshotPathTemplate: resolve(
    import.meta.dirname,
    "test/visual/baselines/{arg}{ext}"
  ),
  use: {
    baseURL: nuxtOrigin,
    trace: "on-first-retry",
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: "ssr",
      testMatch: /ssr\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "desktop-chromium",
      testMatch: /e2e\/.*\.spec\.ts/,
      testIgnore: [
        /e2e\/.*\.mobile\.behavior\.spec\.ts/,
        /e2e\/reader-dictionary-production\.behavior\.spec\.ts/,
        /e2e\/reader-asset-graph\.behavior\.spec\.ts/,
        /e2e\/reader-assets-production\.behavior\.spec\.ts/
      ],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: [
        /e2e\/.*\.visual\.spec\.ts/,
        /e2e\/reader\.behavior\.spec\.ts/,
        /e2e\/editor-reader\.mobile\.behavior\.spec\.ts/,
        /e2e\/library-advanced\.behavior\.spec\.ts/,
        /e2e\/quick-search-developer\.behavior\.spec\.ts/
      ],
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  webServer: [
    {
      command: `LBAPI_FIXTURE_PORT=${fixturePort} node test/fixtures/v2-server.mjs`,
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command:
        `NUXT_API_BASE=${fixtureOrigin}/private-v2 ` +
        `NUXT_PUBLIC_API_BASE=/api/v2 ` +
        `NUXT_LIBRARY_API_BASE=${fixtureOrigin}/legacy-api ` +
        `NUXT_PUBLIC_LIBRARY_API_BASE=/api ` +
        `LBAPI_PROXY_TARGET=${fixtureOrigin} ` +
        `LBAPI_LEGACY_PROXY_TARGET=${fixtureOrigin} ` +
        `LITTB_VITE_FS_ALLOW=${dependencyRoot} ` +
        `LITTERATURKARTAN_PROXY_TARGET=${fixtureOrigin} ` +
        `NUXT_CONTENT_BASE=${fixtureOrigin} ` +
        `NUXT_READER_SOURCE_BASE=${fixtureOrigin} ` +
        `NUXT_OBSERVABILITY_HMAC_SECRET=${"test-observability-secret-material-0123456789"} ` +
        `NUXT_OBSERVABILITY_ALLOWED_ORIGINS=https://stage.litteraturbanken.se ` +
        `NUXT_DEPLOYMENT_ENVIRONMENT=staging ` +
        `NUXT_DEPLOYMENT_GIT_SHA=${"a".repeat(40)} ` +
        `READER_SOURCE_PROXY_TARGET=${fixtureOrigin} ` +
        `NUXT_IGNORE_LOCK=1 yarn dev --port ${nuxtPort}`,
      url: `${nuxtOrigin}/_nuxt/@vite/client`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
