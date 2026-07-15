import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./test/visual",
  testMatch: "capture-angular.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.ANGULAR_BASE_URL || "https://litteraturbanken.se",
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: "angular-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "angular-mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ]
})
