import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

import angularConfig from "./playwright.angular.config"

const authorityPort = Number(process.env.LITTB_SLA_AUTHORITY_PORT || 9032)
const authorityOrigin = `http://127.0.0.1:${authorityPort}`

export default defineConfig(angularConfig, {
  testMatch: /capture-sla-articles-angular\.spec\.ts/,
  use: {
    baseURL: authorityOrigin
  },
  webServer: {
    command: `yarn vite --host 127.0.0.1 --port ${authorityPort} --strictPort`,
    cwd: resolve(import.meta.dirname, ".."),
    url: `${authorityOrigin}/`,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
