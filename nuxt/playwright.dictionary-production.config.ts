import { defineConfig, devices } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /reader-dictionary-production\.behavior\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
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
        `NUXT_PUBLIC_READER_DICTIONARY_MODE=legacy yarn build && PORT=${nuxtPort} ` +
        `NUXT_API_BASE=${fixtureOrigin}/private-v2 ` +
        `NUXT_CONTENT_BASE=${fixtureOrigin} ` +
        `NUXT_DEPLOYMENT_ENVIRONMENT=development ` +
        `NUXT_PUBLIC_READER_DICTIONARY_MODE=legacy ` +
        "node .output/server/index.mjs",
      url: nuxtOrigin,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
