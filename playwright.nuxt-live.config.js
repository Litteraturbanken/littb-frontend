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
    testMatch: ["playwright_e2e.spec.js", "multiselect-live.spec.js"],
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
        },
        {
            name: "nuxt-live-mobile-multiselect",
            testMatch: "multiselect-live.spec.js",
            use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        },
        {
            name: "nuxt-live-webkit-title-bounded",
            testMatch: "multiselect-live.spec.js",
            grep: /Title options stay bounded/,
            use: { ...devices["Desktop Safari"] }
        }
    ]
})
