const { defineConfig, devices } = require("@playwright/test")

const nuxtOrigin = process.env.LITTB_NUXT_LIVE_ORIGIN || "http://127.0.0.1:3020"

module.exports = defineConfig({
    testDir: "./test/e2e",
    testMatch: "playwright_e2e.spec.js",
    fullyParallel: false,
    workers: 1,
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
