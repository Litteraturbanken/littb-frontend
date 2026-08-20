import { expect, test } from "@playwright/test"
import { parseHTML } from "linkedom"

test("the no-script shell uses the monolithic Requiem authority stylesheet", async ({
  request
}) => {
  const response = await request.get("/om/ide")
  expect(response.ok()).toBe(true)

  const { document } = parseHTML(await response.text())
  const stylesheet = document.querySelector<HTMLLinkElement>(
    "noscript link[rel=stylesheet]"
  )

  expect(stylesheet?.getAttribute("href")).toBe(
    "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
  )
})
