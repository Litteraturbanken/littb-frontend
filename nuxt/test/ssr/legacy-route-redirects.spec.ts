import { expect, test } from "@playwright/test"

const redirects = [
  ["/om/aktuellt", "/bibliotek?sort=nytillkommet"],
  ["/om/aktuellt?source=legacy", "/bibliotek?sort=nytillkommet"],
  ["/nytt?source=legacy", "/bibliotek?sort=nytillkommet"],
  ["/titlar?visa=works&sort=titlar", "/bibliotek?visa=works&sort=titlar"],
  ["/forfattare?sort=namn", "/bibliotek?sort=namn"]
] as const

for (const [source, location] of redirects) {
  test(`${source} redirects permanently to ${location}`, async ({ request }) => {
    const response = await request.get(source, { maxRedirects: 0 })

    expect(response.status()).toBe(308)
    expect(response.headers().location).toBe(location)
  })
}

test("nested and prefix lookalikes are not redirected", async ({ request }) => {
  for (const path of ["/nytt-extra", "/titlar/extra", "/forfattare/extra"]) {
    const response = await request.get(path, { maxRedirects: 0 })

    expect(response.status(), path).toBe(404)
    expect(response.headers().location, path).toBeUndefined()
  }
})
