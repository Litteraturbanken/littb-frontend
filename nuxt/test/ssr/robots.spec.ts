import { expect, test } from "@playwright/test"

test("the staging SSR fixture remains explicitly non-indexable", async ({ request }) => {
  const robots = await request.get("/robots.txt")

  expect(robots.status()).toBe(200)
  expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n")
  expect(robots.headers()["x-robots-tag"]).toBe("noindex, nofollow")
})
