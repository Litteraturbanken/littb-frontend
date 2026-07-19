import { expect, test } from "@playwright/test"

const redirects = [
  ["/om/aktuellt", "/bibliotek?sort=nytillkommet"],
  ["/om/aktuellt?source=legacy", "/bibliotek?sort=nytillkommet"],
  ["/nytt?source=legacy", "/bibliotek?sort=nytillkommet"],
  [
    "/dramawebben/f%C3%B6rfattare",
    "/dramawebben/pj%C3%A4ser?visa=f%C3%B6rfattare"
  ],
  ["/sok", "/s%C3%B6k"],
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

test("/sok preserves duplicate and empty query values in its permanent redirect", async ({
  request
}) => {
  const response = await request.get(
    "/sok?fras=doktor&bare&empty=&repeat=%2f&repeat=%2F",
    { maxRedirects: 0 }
  )

  expect(response.status()).toBe(308)
  const location = new URL(response.headers().location!, "http://127.0.0.1")
  expect(location.pathname).toBe("/s%C3%B6k")
  expect([...location.searchParams]).toEqual([
    ["fras", "doktor"],
    ["bare", ""],
    ["empty", ""],
    ["repeat", "/"],
    ["repeat", "/"]
  ])
})

test("the Dramawebben author alias preserves query pairs behind its canonical visa", async ({
  request
}) => {
  const response = await request.get(
    "/dramawebben/f%C3%B6rfattare?" +
    "fras=doktor&bare&empty=&repeat=%2f&repeat=%2F&" +
    "visa=pj%C3%A4ser&visa=kringtexter",
    { maxRedirects: 0 }
  )

  expect(response.status()).toBe(308)
  const location = new URL(response.headers().location!, "http://127.0.0.1")
  expect(location.pathname).toBe("/dramawebben/pj%C3%A4ser")
  expect([...location.searchParams]).toEqual([
    ["visa", "författare"],
    ["fras", "doktor"],
    ["bare", ""],
    ["empty", ""],
    ["repeat", "/"],
    ["repeat", "/"]
  ])
})

test("the Dramawebben author alias redirects only safe methods", async ({ request }) => {
  const head = await request.fetch("/dramawebben/f%C3%B6rfattare?empty=", {
    method: "HEAD",
    maxRedirects: 0
  })

  expect(head.status()).toBe(308)
  expect(head.headers().location).toBe(
    "/dramawebben/pj%C3%A4ser?visa=f%C3%B6rfattare&empty="
  )

  const post = await request.post("/dramawebben/f%C3%B6rfattare", {
    maxRedirects: 0
  })
  expect(post.status()).toBe(404)
  expect(post.headers().location).toBeUndefined()
})

test("nested and prefix lookalikes are not redirected", async ({ request }) => {
  for (const path of [
    "/nytt-extra",
    "/dramawebben/f%C3%B6rfattare/",
    "/dramawebben/f%C3%B6rfattare/extra",
    "/dramawebben/f%C3%B6rfattare-extra",
    "/sok/extra",
    "/sok-extra",
    "/titlar/extra",
    "/forfattare/extra"
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })

    expect(response.status(), path).toBe(404)
    expect(response.headers().location, path).toBeUndefined()
  }
})
