import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

const angularPort = Number(process.env.LITTB_ANGULAR_LIBRARY_PORT || 9000)

export default defineConfig(angularConfig, {
  testMatch: /capture-library-epub-angular\.spec\.ts/,
  use: {
    baseURL: `http://127.0.0.1:${angularPort}`
  },
  webServer: {
    command: `yarn dev --port ${angularPort}`,
    cwd: resolve(import.meta.dirname, ".."),
    url: `http://127.0.0.1:${angularPort}/`,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
