const { defineConfig, devices } = require("@playwright/test")
const { availableParallelism } = require("node:os")

const nuxtOrigin = (process.env.LITTB_NUXT_LIVE_ORIGIN || "http://127.0.0.1:3020")
    .replace(/\/$/, "")
const expectedGitSha = process.env.LITTB_EXPECTED_GIT_SHA
const expectedImageDigest = process.env.LITTB_EXPECTED_IMAGE_DIGEST

if (Boolean(expectedGitSha) !== Boolean(expectedImageDigest)) {
    throw new Error(
        "LITTB_EXPECTED_GIT_SHA and LITTB_EXPECTED_IMAGE_DIGEST must be set together"
    )
}

module.exports = defineConfig({
    testDir: "./test/e2e",
    testMatch: "playwright_e2e.spec.js",
    fullyParallel: true,
    workers: Math.min(4, availableParallelism()),
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: "list",
    timeout: 60000,
    expect: { timeout: 10000 },
    globalSetup: require.resolve("./test/e2e/nuxt_live_preflight.cjs"),
    use: {
        baseURL: nuxtOrigin,
        trace: "retain-on-failure",
        navigationTimeout: 30000,
        actionTimeout: 10000
    },
    projects: [
        {
            name: "nuxt-live-chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ]
})
