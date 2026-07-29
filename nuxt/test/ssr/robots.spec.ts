import { expect, test } from "@playwright/test"

test("the default deployment remains explicitly indexable", async ({ request }) => {
  const robots = await request.get("/robots.txt")

  expect(robots.status()).toBe(200)
  expect(await robots.text()).toBe("User-agent: *\nAllow: /\n")
  expect(robots.headers()["x-robots-tag"]).toBeUndefined()
})
