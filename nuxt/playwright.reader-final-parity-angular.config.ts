import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

const angularPort = Number(process.env.LITTB_ANGULAR_TEST_PORT || 3051)
const angularOrigin = `http://127.0.0.1:${angularPort}`

export default defineConfig(angularConfig, {
  testMatch: /capture-reader-final-parity-angular\.spec\.ts/,
  use: {
    baseURL: angularOrigin
  },
  webServer: {
    command: `yarn dev --port ${angularPort}`,
    cwd: resolve(import.meta.dirname, ".."),
    url: `${angularOrigin}/`,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
