import { realpathSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const fixturePort = 4_136
const nuxtPort = 3_136
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`
const dependencyRoot = realpathSync(resolve(import.meta.dirname, "node_modules"))

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /sla-articles\.visual\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  snapshotPathTemplate: resolve(
    import.meta.dirname,
    "test/visual/baselines/{arg}{ext}"
  ),
  use: {
    baseURL: nuxtOrigin,
    navigationTimeout: 30_000,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1_440, height: 1_000 }
      }
    },
    {
      name: "mobile-chromium",
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
        `NUXT_IGNORE_LOCK=1 `
        + `NUXT_API_BASE=${fixtureOrigin}/private-v2 `
        + `NUXT_PUBLIC_API_BASE=/api/v2 `
        + `NUXT_LIBRARY_API_BASE=${fixtureOrigin}/legacy-api `
        + `NUXT_PUBLIC_LIBRARY_API_BASE=/api `
        + `LBAPI_PROXY_TARGET=${fixtureOrigin} `
        + `LBAPI_LEGACY_PROXY_TARGET=${fixtureOrigin} `
        + `LITTB_VITE_FS_ALLOW=${dependencyRoot} `
        + `LITTERATURKARTAN_PROXY_TARGET=${fixtureOrigin} `
        + `NUXT_CONTENT_BASE=${fixtureOrigin} `
        + `NUXT_READER_SOURCE_BASE=${fixtureOrigin} `
        + "NUXT_DEPLOYMENT_ENVIRONMENT=development "
        + `yarn dev --port ${nuxtPort}`,
      url: `${nuxtOrigin}/_nuxt/@vite/client`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
