import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

export default defineConfig(angularConfig, {
  testMatch: /capture-reader-hit-angular\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:9000"
  },
  webServer: {
    command: "yarn dev",
    cwd: resolve(import.meta.dirname, ".."),
    url: "http://127.0.0.1:9000/",
    reuseExistingServer: false,
    timeout: 120_000
  }
})
