import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

export default defineConfig(angularConfig, {
  testMatch: /capture-editor-angular\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:9017"
  },
  webServer: {
    command: "yarn dev --port 9017",
    cwd: resolve(import.meta.dirname, ".."),
    url: "http://127.0.0.1:9017/",
    reuseExistingServer: false,
    timeout: 120_000
  }
})
