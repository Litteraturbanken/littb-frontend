import { expect, test } from "@playwright/test"
import { parseHTML } from "linkedom"

test("SSR All Titel sort keeps current filters and preserved repeated keys", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?filter=Selma&keep=ett&keep=tv%C3%A5"
  )

  expect(response.ok()).toBeTruthy()
  const { document } = parseHTML(await response.text())
  expect(document.querySelector('[data-library-sort="titlar"]')?.getAttribute("href")).toBe(
    "/bibliotek?keep=ett&keep=tv%C3%A5&filter=Selma&sort=titlar"
  )
})

test("SSR Latest Nytt sort keeps its enabled raw hide-1800 flag", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?visa=latest&sort=nytillkommet&filter=Selma&hide1800"
  )

  expect(response.ok()).toBeTruthy()
  const { document } = parseHTML(await response.text())
  expect(document.querySelector('[data-library-sort="nytillkommet"]')?.getAttribute("href")).toBe(
    "/bibliotek?visa=latest&filter=Selma&sort=nytillkommet&hide1800="
  )
})
