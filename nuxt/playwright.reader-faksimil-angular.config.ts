import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

export default defineConfig(angularConfig, {
  testMatch: /capture-reader-faksimil-angular\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:9015"
  },
  webServer: {
    command: "yarn dev --port 9015",
    cwd: resolve(import.meta.dirname, ".."),
    url: "http://127.0.0.1:9015/",
    reuseExistingServer: false,
    timeout: 120_000
  }
})
