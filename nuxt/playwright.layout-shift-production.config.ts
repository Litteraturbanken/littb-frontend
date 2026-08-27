import { defineConfig, devices } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4180)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3080)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /layout-shift-production\.behavior\.spec\.ts/,
  fullyParallel: true,
  workers: 4,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: nuxtOrigin
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
        `NUXT_PUBLIC_READER_DICTIONARY_MODE=embed `
        + `NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN=${fixtureOrigin} `
        + `LITTERATURKARTAN_PROXY_TARGET=${fixtureOrigin} `
        + `CONTENT_PROXY_TARGET=${fixtureOrigin} `
        + `NUXT_API_BASE=${fixtureOrigin}/private-v2 `
        + `NUXT_LIBRARY_API_BASE=${fixtureOrigin}/legacy-api `
        + `NUXT_CONTENT_BASE=${fixtureOrigin} `
        + "yarn build && "
        + `PORT=${nuxtPort} `
        + `NUXT_API_BASE=${fixtureOrigin}/private-v2 `
        + `NUXT_LIBRARY_API_BASE=${fixtureOrigin}/legacy-api `
        + `NUXT_CONTENT_BASE=${fixtureOrigin} `
        + "NUXT_DEPLOYMENT_ENVIRONMENT=development "
        + "node .output/server/index.mjs",
      url: nuxtOrigin,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
