const { defineConfig, devices } = require("@playwright/test")

module.exports = defineConfig({
    testDir: "./test/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 12,
    reporter: "",
    timeout: 60000,
    use: {
        baseURL: `http://${process.env.LITTB_DOCKER_HOST || "localhost"}:9000`,
        trace: "on-first-retry",
        navigationTimeout: 30000,
        actionTimeout: 10000
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ],

    webServer: {
        command: "yarn dev",
        url: `http://${process.env.LITTB_DOCKER_HOST || "localhost"}:9000`,
        reuseExistingServer: !process.env.CI
    }
})
