import { expect, test } from "@playwright/test"
import { parseHTML } from "linkedom"

test("the server head loads the monolithic Requiem stylesheet before hydration", async ({
  request
}) => {
  const response = await request.get("/om/ide")
  expect(response.ok()).toBe(true)

  const { document } = parseHTML(await response.text())
  const stylesheet = document.querySelector<HTMLLinkElement>(
    "head > link[rel=stylesheet][data-authority-fonts]"
  )

  expect(stylesheet?.getAttribute("href")).toBe(
    "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
  )
  expect(document.querySelector("noscript link[data-authority-fonts]")).toBeNull()
  expect(document.body.classList.contains("layout-fonts-loading")).toBe(false)
  expect(document.documentElement.classList.contains("layout-fonts-loading")).toBe(true)
})
