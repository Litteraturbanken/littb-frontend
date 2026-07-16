import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const fixtureOrigin = "http://127.0.0.1:4100"

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
    baseURL: "http://127.0.0.1:3000",
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
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: /e2e\/.*\.visual\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  webServer: [
    {
      command: "node test/fixtures/v2-server.mjs",
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command:
        `NUXT_API_BASE=${fixtureOrigin}/v2 ` +
        `NUXT_PUBLIC_API_BASE=/api/v2 ` +
        `LBAPI_PROXY_TARGET=${fixtureOrigin} ` +
        `NUXT_CONTENT_BASE=${fixtureOrigin} ` +
        `LITTB_CONTENT_PROXY_TARGET=${fixtureOrigin} yarn dev`,
      url: "http://127.0.0.1:3000/_nuxt/@vite/client",
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
