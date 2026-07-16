import { expect, test } from "@playwright/test"

test("legacy statistics alias redirects permanently and preserves query", async ({ request }) => {
  const response = await request.get("/statistik?source=legacy", { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe("/om/statistik?source=legacy")
})

test("missing route returns the legacy Swedish 404 inside the site shell", async ({ request }) => {
  const response = await request.get("/definitely-not-a-route")
  expect(response.status()).toBe(404)
  const html = await response.text()
  expect(html).toContain("<title>Sidan kan inte hittas | Litteraturbanken</title>")
  expect(html).toContain("Du har angett en adress som inte finns på Litteraturbanken.")
  expect(html).toContain("Använd webbläsarens bakåtknapp för att komma tillbaka")
  for (const selector of ["leftCorridor", "mainview", "rightCorridor"]) {
    expect(html).toContain(`id="${selector}"`)
  }
  expect(html).not.toContain("page-about")
  expect(html).not.toContain("about_bkg.jpg")
})
