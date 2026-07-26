import { expect, test, type Locator, type Page } from "@playwright/test"

async function waitForHydration(page: Page) {
  await page.locator('[data-library-mounted="true"]').waitFor({ state: "attached" })
}

async function choose(page: Page, control: Locator, labels: readonly string[]) {
  await control.click()
  for (const label of labels) await control.getByText(label, { exact: true }).click()
  await page.keyboard.press("Escape")
}

test("Library vue-multiselect facets preserve groups, history, reload state, and disabled narrowing", async ({
  page
}) => {
  const consoleErrors: string[] = []
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") consoleErrors.push(message.text())
  })
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const keywords = page.locator("[data-library-keywords]")
  const aboutAuthors = page.locator("[data-library-about-authors]")
  const narrowing = page.locator("[data-library-narrowing]")
  const media = page.locator("[data-library-media]")
  const languages = page.locator("[data-library-languages]")
  for (const control of [keywords, aboutAuthors, narrowing, media, languages]) {
    await expect(control.locator(".multiselect")).toHaveCount(1)
    await expect(control.locator("select[multiple]")).toHaveCount(0)
  }

  const focusableControls = [
    page.getByRole("combobox", {
      name: "Filtrera: Kategorier / Utgivare", exact: true
    }),
    page.getByRole("textbox", { name: "Om ett författarskap", exact: true }),
    page.getByRole("combobox", { name: "Avgränsa sökningen", exact: true }),
    page.getByRole("combobox", { name: "Utgivningsformat", exact: true }),
    page.getByRole("combobox", { name: "Språk …", exact: true })
  ]
  for (const control of focusableControls) {
    await expect(control).toHaveCount(1)
    await control.focus()
    await expect(control).toBeFocused()
  }

  await keywords.click()
  await expect(keywords).toContainText("Kategorier")
  await expect(keywords).toContainText("Utgivare")
  await keywords.getByText("Romaner", { exact: true }).press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords"))
    .toBe("texttype:brev;brevsamling")
  await page.keyboard.press("Escape")

  await narrowing.click()
  await expect(narrowing.getByText("Brev", { exact: true })).toHaveAttribute("aria-disabled", "true")
  await narrowing.getByText("Humoristiska verk", { exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords_aux"))
    .toBe("keyword:Humor")
  await page.keyboard.press("Escape")

  await choose(page, media, ["Etext"])
  await choose(page, languages, ["Svenska"])
  await expect.poll(() => new URL(page.url()).searchParams.get("languages")).toBe("language:swe")
  expect([...new URL(page.url()).searchParams.entries()]).toEqual([
    ["avancerat", "1"],
    ["keywords", "texttype:brev;brevsamling"],
    ["keywords_aux", "keyword:Humor"],
    ["mediatypes", "mediatype:etext"],
    ["languages", "language:swe"]
  ])

  await page.goBack()
  await expect(languages.locator(".select2-selection__choice")).toHaveCount(0)
  await page.goForward()
  await expect(languages.locator(".select2-selection__choice")).toContainText("Svenska")
  await page.reload({ waitUntil: "networkidle" })
  await expect(keywords.locator(".select2-selection__choice")).toContainText("Brev")
  expect(consoleErrors).toEqual([])
})
