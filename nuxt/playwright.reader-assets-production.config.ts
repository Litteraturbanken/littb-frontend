import { defineConfig, devices } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4120)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3032)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /reader-assets-production\.behavior\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: nuxtOrigin,
    viewport: { width: 1440, height: 1000 }
  },
  webServer: [
    {
      command: `LBAPI_FIXTURE_PORT=${fixturePort} node test/fixtures/v2-server.mjs`,
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command:
        `LITTB_CONTENT_PROXY_TARGET=${fixtureOrigin} `
        + `READER_SOURCE_PROXY_TARGET=${fixtureOrigin} `
        + `LITTERATURKARTAN_PROXY_TARGET=${fixtureOrigin} `
        + "yarn build && "
        + `PORT=${nuxtPort} `
        + `NUXT_API_BASE=${fixtureOrigin}/private-v2 `
        + `NUXT_CONTENT_BASE=${fixtureOrigin} `
        + `NUXT_READER_SOURCE_BASE=${fixtureOrigin} `
        + "node .output/server/index.mjs",
      url: nuxtOrigin,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
