import { realpathSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`
const svenskaEmbedPort = Number(process.env.LITTB_SVENSKA_EMBED_PORT || fixturePort + 2)
const svenskaEmbedOrigin = `http://127.0.0.1:${svenskaEmbedPort}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`
const reuseExistingServers = process.env.LITTB_REUSE_EXISTING_SERVERS === "1"
const dependencyRoot = realpathSync(resolve(import.meta.dirname, "node_modules"))
const fixturePidFile = process.env.LITTB_FIXTURE_PID_FILE || resolve(
  "node_modules/.cache/littb-playwright/default-fixture.pid"
)
const nuxtPidFile = process.env.LITTB_NUXT_PID_FILE || resolve(
  "node_modules/.cache/littb-playwright/default-nuxt.pid"
)
const excludeStatefulSsr = process.env.LITTB_SSR_EXCLUDE_STATEFUL === "1"
const configuredRetries = process.env.LITTB_PLAYWRIGHT_RETRIES
const configuredE2eLane = process.env.LITTB_E2E_LANE
if (configuredE2eLane !== undefined
  && !["behavior", "visual"].includes(configuredE2eLane)) {
  throw new TypeError("LITTB_E2E_LANE must be behavior or visual")
}
const visualE2eSpec = /e2e\/.*\.visual\.spec\.ts/
const productionLayoutShiftSpec = /e2e\/layout-shift-production\.behavior\.spec\.ts/
const mobileBehaviorSpecs = [
  /e2e\/reader\.behavior\.spec\.ts/,
  /e2e\/reader-production\.behavior\.spec\.ts/,
  /e2e\/editor-reader\.mobile\.behavior\.spec\.ts/,
  /e2e\/library-advanced\.behavior\.spec\.ts/,
  /e2e\/quick-search-developer\.behavior\.spec\.ts/
]
let mobileE2eTestMatch: RegExp | RegExp[] = [visualE2eSpec, ...mobileBehaviorSpecs]
if (configuredE2eLane === "visual") mobileE2eTestMatch = visualE2eSpec
else if (configuredE2eLane === "behavior") mobileE2eTestMatch = mobileBehaviorSpecs
const ownedServer = (pidFile: string, command: string) => (
  `node scripts/run-owned-webserver.mjs ${pidFile} ${command}`
)

type PlaywrightServerEnvironment = "development" | "staging"
type SsrProjectConfiguration = {
  name: string
  testMatch: RegExp | RegExp[]
  testIgnore?: RegExp | RegExp[]
}

const ssrPolicySpecs = [
  /ssr\/robots\.spec\.ts/,
  /ssr\/deployment-identity\.spec\.ts/
]

function localSsrProject(): SsrProjectConfiguration {
  return {
    name: "ssr",
    testMatch: /ssr\/.*\.spec\.ts/,
    testIgnore: [
      ...ssrPolicySpecs,
      ...(excludeStatefulSsr ? [/ssr\/reader-shorthand\.spec\.ts/] : [])
    ]
  }
}

export function createPlaywrightConfig({
  deploymentEnvironment = "development",
  ssrProject = localSsrProject(),
  includeE2eProjects = true
}: {
  deploymentEnvironment?: PlaywrightServerEnvironment
  ssrProject?: SsrProjectConfiguration
  includeE2eProjects?: boolean
} = {}) {
  return defineConfig({
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || "test-results",
  testDir: "./test",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: configuredRetries === undefined
    ? (process.env.CI ? 2 : 0)
    : Number(configuredRetries),
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
    { ...ssrProject, use: { ...devices["Desktop Chrome"] } },
    ...(includeE2eProjects ? [
    {
      name: "desktop-chromium",
      testMatch: configuredE2eLane === "visual"
        ? visualE2eSpec
        : /e2e\/.*\.spec\.ts/,
      testIgnore: [
        /e2e\/.*\.mobile\.behavior\.spec\.ts/,
        /e2e\/requiem-kerning\.behavior\.spec\.ts/,
        /e2e\/reader-dictionary-production\.behavior\.spec\.ts/,
        /e2e\/reader-asset-graph\.behavior\.spec\.ts/,
        /e2e\/reader-assets-production\.behavior\.spec\.ts/,
        productionLayoutShiftSpec,
        ...(configuredE2eLane === "behavior" ? [visualE2eSpec] : [])
      ],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: mobileE2eTestMatch,
      testIgnore: configuredE2eLane === "behavior"
        ? [visualE2eSpec, productionLayoutShiftSpec]
        : [productionLayoutShiftSpec],
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    },
    {
      name: "chromium-typography",
      testMatch: /e2e\/requiem-kerning\.behavior\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "firefox-typography",
      testMatch: /e2e\/requiem-kerning\.behavior\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "webkit-typography",
      testMatch: /e2e\/requiem-kerning\.behavior\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "webkit-reader-faksimil",
      testMatch: /e2e\/reader-faksimil-webkit\.behavior\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 1000 }
      }
    }
    ] : [])
  ],
  webServer: [
    {
      command: ownedServer(
        fixturePidFile,
        `node test/fixtures/v2-server.mjs`
      ),
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: reuseExistingServers,
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
        `CONTENT_PROXY_TARGET=${fixtureOrigin} ` +
        `NUXT_CONTENT_BASE=${fixtureOrigin} ` +
        `NUXT_OBSERVABILITY_HMAC_SECRET=${"test-observability-secret-material-0123456789"} ` +
        `NUXT_OBSERVABILITY_ALLOWED_ORIGINS=https://stage.litteraturbanken.se ` +
        `NUXT_PUBLIC_READER_DICTIONARY_MODE=embed ` +
        `NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN=${svenskaEmbedOrigin} ` +
        `NUXT_DEPLOYMENT_ENVIRONMENT=${deploymentEnvironment} ` +
        `NUXT_DEPLOYMENT_GIT_SHA=${"a".repeat(40)} ` +
        `IMAGE_DIGEST=sha256:${"b".repeat(64)} ` +
        `NUXT_IGNORE_LOCK=1 ` +
        ownedServer(nuxtPidFile, `yarn dev --port ${nuxtPort}`),
      url: `${nuxtOrigin}/_nuxt/@vite/client`,
      reuseExistingServer: reuseExistingServers,
      timeout: 120_000
    }
  ]
  })
}

export default createPlaywrightConfig()
