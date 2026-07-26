import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`),
    request.delete(`${fixture}/_bibliography_requests`),
    request.delete(`${fixture}/_bibliography_failure`),
    request.delete(`${fixture}/_bibliography_disconnect`),
    request.delete(`${fixture}/_bibliography_delays`)
  ])
}

function captureProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test("matches the Angular bibliography authority at desktop and mobile", async ({ page }, testInfo) => {
  const problems = captureProblems(page)
  const response = await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
  await expect(page.locator(".page_content h1")).toHaveText("Bibliografisk databas")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await expect(page.locator("#toolkit-biblinfo .num_hits")).toHaveText("3 träffar")

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`author-biblinfo-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })
  expect(problems).toEqual([])
})
