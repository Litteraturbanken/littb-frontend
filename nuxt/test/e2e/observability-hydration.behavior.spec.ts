import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { fixtureOrigin } from "../helpers/test-origins"

interface ForwardedRequest {
  body: string
  events: ForwardedEvent[]
}

interface ForwardedEvent {
  event_name: string
  error_type: string
  attributes: { resource_kind: string }
}

async function forwardedEvents(request: APIRequestContext): Promise<ForwardedEvent[]> {
  const response = await request.get(`${fixtureOrigin}/_observability_requests`)
  expect(response.status()).toBe(200)
  const ledger = await response.json() as { requests: ForwardedRequest[] }
  return ledger.requests.flatMap(entry => entry.events)
}

async function resetObservabilityLedger(request: APIRequestContext): Promise<void> {
  const response = await request.delete(`${fixtureOrigin}/_observability_requests`)
  expect(response.status()).toBe(200)
}

async function warmHomeRoute(page: Page): Promise<void> {
  const response = await page.goto("/", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Litteraturbanken")
}

test("reports a server-only Home mismatch through the signed intake", async ({ page, request }) => {
  await warmHomeRoute(page)
  await resetObservabilityLedger(request)

  const pageExceptions: Error[] = []
  page.on("pageerror", error => pageExceptions.push(error))

  await page.route("**/", async route => {
    const response = await route.fetch()
    const document = await response.text()
    const serverHeading = "<h1>Litteraturbanken</h1>"
    expect(document).toContain(serverHeading)

    await route.fulfill({
      response,
      body: document.replace(serverHeading, "<h1>Server-only mismatch sentinel</h1>")
    })
  })

  const response = await page.goto("/", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Litteraturbanken")
  await expect.poll(() => forwardedEvents(request)).toHaveLength(1)
  const [forwarded] = await forwardedEvents(request)
  expect(forwarded?.event_name).toBe("browser.hydration_error")
  expect(forwarded?.error_type).toBe("HydrationMismatch")
  expect(forwarded?.attributes.resource_kind).toBe("document")
  expect(JSON.stringify(forwarded)).not.toContain("mismatch sentinel")
  expect(pageExceptions).toEqual([])
})
