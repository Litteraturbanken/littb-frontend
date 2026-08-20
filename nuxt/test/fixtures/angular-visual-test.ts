import { readFileSync } from "node:fs"

import {
  expect,
  test as base,
  type APIRequestContext,
  type Page
} from "@playwright/test"

const productionAuthority = "**/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
const angularAuthority = readFileSync(
  new URL("../../app/assets/styles/fonts/601526/32FBEBA806C948833.css", import.meta.url),
  "utf8"
)

export const test = base.extend<{ angularAuthorityFonts: true }>({
  angularAuthorityFonts: [async ({ page }, use) => {
    await page.route(productionAuthority, async route => {
      await route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: angularAuthority
      })
    })
    await use(true)
  }, { auto: true }]
})

export async function useProductionAuthorityFonts(page: Page) {
  await page.unroute(productionAuthority)
}

export { expect }
export type { APIRequestContext, Page }
