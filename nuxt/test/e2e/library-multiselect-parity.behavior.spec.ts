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

test("Library multiselect main area opens without a close-reopen flicker", async ({ page }) => {
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const keywords = page.locator("[data-library-keywords]")
  const control = keywords.locator(".multiselect")
  const closedMainArea = keywords.locator(".search-multiselect__main-trigger")

  await control.evaluate(element => {
    element.setAttribute("data-expanded-transitions", "")
    const observer = new MutationObserver(() => {
      const transitions = element.getAttribute("data-expanded-transitions") ?? ""
      const expanded = element.getAttribute("aria-expanded") ?? ""
      element.setAttribute("data-expanded-transitions", `${transitions},${expanded}`)
    })
    observer.observe(element, { attributes: true, attributeFilter: ["aria-expanded"] })
  })
  await closedMainArea.click()
  await page.waitForTimeout(100)
  await expect(control).toHaveAttribute("aria-expanded", "true")
  await expect(control).toHaveAttribute("data-expanded-transitions", ",true")
  await expect(keywords.locator(".multiselect__content-wrapper")).toBeVisible()
})

test("Library searchable author multiselect closes when its active area is clicked again", async ({
  page
}) => {
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const root = page.locator("[data-library-about-authors]")
  const control = root.locator(".multiselect")
  const activeArea = root.getByRole("textbox", {
    name: "Om ett författarskap",
    exact: true
  })

  await activeArea.click()
  await expect(control).toHaveClass(/multiselect--active/)
  await activeArea.click()
  await expect(control).not.toHaveClass(/multiselect--active/)
})

test("Library multiselect selected main area toggles the dropdown closed", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&keywords=" +
      "texttype%3Aess%C3%A4%3Bess%C3%A4samling," +
      "texttype%3Asakprosa%3Bkringtexter%3Bavhandling%3Breferensverk",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  const keywords = page.locator("[data-library-keywords]")
  const control = keywords.locator(".multiselect")
  const mainArea = keywords.locator(".search-multiselect__input-row")

  await mainArea.click()
  await expect(control).toHaveAttribute("aria-expanded", "true")
  await mainArea.click()
  await expect(control).toHaveAttribute("aria-expanded", "false")
  await expect(keywords.locator(".multiselect__content-wrapper")).toBeHidden()
})

test("Library searchable author facet keeps its input left of visible chips and filters locally", async ({
  page
}) => {
  await page.goto(
    "/bibliotek?avancerat=1&about_authors=LagerlofS",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  const about = page.locator("[data-library-about-authors]")
  const control = about.locator(".multiselect")
  const closedInput = about.locator(".search-multiselect__input-row")
  const chips = about.locator(".select2-selection__choice")

  await expect(closedInput).toBeVisible()
  await expect(chips).toHaveCount(1)
  await expect(chips.filter({ hasText: "Selma Lagerlöf" })).toBeVisible()

  const [closedInputBox, firstClosedChipBox] = await Promise.all([
    closedInput.boundingBox(),
    chips.first().boundingBox()
  ])
  expect(closedInputBox).not.toBeNull()
  expect(firstClosedChipBox).not.toBeNull()
  await expect(closedInput).toHaveCSS("position", "static")
  expect(closedInputBox!.width).toBeCloseTo(350, 1)
  expect(firstClosedChipBox!.width).toBeCloseTo(149.65625, 0)
  expect(firstClosedChipBox!.x - (closedInputBox!.x + closedInputBox!.width))
    .toBeCloseTo(8, 1)

  await closedInput.click()
  await expect(control).toHaveAttribute("aria-expanded", "true")
  const activeSearch = about.locator("input.select2-search__field")
  await expect(activeSearch).toBeVisible()
  await expect(chips).toHaveCount(1)

  const [activeSearchBox, firstOpenChipBox] = await Promise.all([
    activeSearch.boundingBox(),
    chips.first().boundingBox()
  ])
  expect(activeSearchBox).not.toBeNull()
  expect(firstOpenChipBox).not.toBeNull()
  expect(activeSearchBox!.width).toBeCloseTo(350, 1)
  expect(firstOpenChipBox!.x - (activeSearchBox!.x + activeSearchBox!.width))
    .toBeCloseTo(8, 1)

  const selmaOption = about.getByRole("option", { name: "Selma Lagerlöf", exact: true })
  await activeSearch.fill("ingen träff")
  await expect(selmaOption).toBeHidden()
  await activeSearch.fill("Selma")
  await expect(selmaOption).toBeVisible()
  expect(new URL(page.url()).searchParams.get("about_authors"))
    .toBe("LagerlofS")

  await page.keyboard.press("Escape")
  await expect(closedInput).toBeVisible()
  await expect(chips).toHaveCount(1)
})

test("Library multiselect matches the production selected-row geometry", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&keywords=" +
      "texttype%3Aess%C3%A4%3Bess%C3%A4samling," +
      "texttype%3Asakprosa%3Bkringtexter%3Bavhandling%3Breferensverk" +
      "&keywords_aux=" +
      "texttype%3Anovellsamling%3Bnovell,texttype%3Areseskildring",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  for (const selector of [
    "[data-library-keywords] .search-multiselect__input-row",
    "[data-library-narrowing] .search-multiselect__input-row"
  ]) {
    const placeholder = page.locator(selector)
    const placeholderColor = await placeholder.evaluate(element => {
      if (element instanceof HTMLInputElement) {
        return getComputedStyle(element, "::placeholder").color
      }
      return getComputedStyle(element).color
    })
    expect(placeholderColor).toBe("rgb(158, 158, 158)")
  }

  for (const { selector, chipWidths } of [
    { selector: "[data-library-keywords]", chipWidths: [77.9375, 98.59375] },
    { selector: "[data-library-narrowing]", chipWidths: [100.5625, 155.203125] }
  ]) {
    const root = page.locator(selector)
    const control = root.locator(".multiselect")
    const input = root.locator(".search-multiselect__input-row")
    const chips = root.locator(".select2-selection__choice")
    await expect(chips).toHaveCount(2)

    await expect(control).toHaveCSS("border-top-width", "0px")
    await expect(control).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(input).toHaveCSS("border-top-color", "rgb(153, 153, 153)")
    await expect(input).toHaveCSS("font-size", "16px")
    await expect(input).toHaveCSS("line-height", "19.2px")
    await expect(input).toHaveCSS("margin-right", "8px")
    await expect(chips.nth(0)).toHaveCSS("font-size", "16px")
    await expect(chips.nth(0)).toHaveCSS("line-height", "19.2px")
    await expect(chips.nth(0)).toHaveCSS("margin", "5px 6px 4px 0px")
    await expect(chips.nth(0)).toHaveCSS("padding", "0px 5px 2px")
    await expect(chips.nth(0).locator(".select2-selection__choice__remove"))
      .toHaveCSS("font-weight", "700")
    await expect(root.locator(".multiselect__select b")).toBeHidden()

    const [rootBox, inputBox, firstChipBox, secondChipBox] = await Promise.all([
      root.boundingBox(),
      input.boundingBox(),
      chips.nth(0).boundingBox(),
      chips.nth(1).boundingBox()
    ])
    expect(rootBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    expect(firstChipBox).not.toBeNull()
    expect(secondChipBox).not.toBeNull()
    expect(rootBox!.height).toBeCloseTo(34.1875, 1)
    expect(inputBox!.x).toBeCloseTo(rootBox!.x, 1)
    expect(inputBox!.y - rootBox!.y).toBeCloseTo(1.5, 1)
    expect(inputBox!.width).toBeCloseTo(350, 1)
    expect(inputBox!.height).toBeCloseTo(31.1875, 1)
    expect(firstChipBox!.x - (inputBox!.x + inputBox!.width)).toBeCloseTo(8, 1)
    expect(firstChipBox!.y - rootBox!.y).toBeCloseTo(5, 1)
    expect(firstChipBox!.height).toBeCloseTo(25.1875, 1)
    expect(firstChipBox!.width).toBeCloseTo(chipWidths[0]!, 0)
    expect(secondChipBox!.x - (firstChipBox!.x + firstChipBox!.width)).toBeCloseTo(6, 1)
    expect(secondChipBox!.y).toBeCloseTo(firstChipBox!.y, 1)
    expect(secondChipBox!.width).toBeCloseTo(chipWidths[1]!, 0)
  }

  const gender = page.locator("[data-library-gender]")
  await expect(gender).toHaveCSS("border-top-color", "rgb(153, 153, 153)")
  await expect(gender).toHaveCSS("font-size", "16px")
  const genderBox = await gender.boundingBox()
  expect(genderBox).not.toBeNull()
  expect(genderBox!.x).toBeCloseTo(400, 1)
  expect(genderBox!.y).toBeCloseTo(283.375, 1)
  expect(genderBox!.width).toBeCloseTo(350, 1)
  expect(genderBox!.height).toBeCloseTo(31, 1)

  const genderArrowBox = await page
    .locator("[data-library-gender-visual] .select2-selection__arrow")
    .boundingBox()
  expect(genderArrowBox).not.toBeNull()
  expect(genderArrowBox!.x).toBeCloseTo(729, 1)
  expect(genderArrowBox!.y).toBeCloseTo(284.375, 1)
  expect(genderArrowBox!.width).toBeCloseTo(20, 1)
  expect(genderArrowBox!.height).toBeCloseTo(26, 1)
})

test("Library multiselect matches the production open-dropdown geometry", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&keywords="
      + "texttype%3Aess%C3%A4%3Bess%C3%A4samling,"
      + "texttype%3Asakprosa%3Bkringtexter%3Bavhandling%3Breferensverk",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  const keywords = page.locator("[data-library-keywords]")
  await keywords.locator(".search-multiselect__input-row").click()
  const dropdown = keywords.locator(".multiselect__content-wrapper")
  await expect(dropdown).toBeVisible()
  await expect(dropdown).toHaveCSS("max-height", "501px")
  await expect(dropdown).toHaveCSS("border-top-width", "0px")
  await expect(dropdown).toHaveCSS("border-right", "1px solid rgb(51, 51, 51)")
  await expect(dropdown).toHaveCSS("border-bottom", "1px solid rgb(51, 51, 51)")
  await expect(dropdown).toHaveCSS("border-left", "1px solid rgb(51, 51, 51)")

  const dropdownBox = await dropdown.boundingBox()
  expect(dropdownBox).not.toBeNull()
  expect(dropdownBox!.width).toBeCloseTo(350, 1)
  expect(dropdownBox!.height).toBeCloseTo(501, 1)

  const group = keywords.locator(".select2-results__group").first()
  await expect(group).toHaveCSS("display", "block")
  await expect(group).toHaveCSS("padding", "6px 6px 0px")
  await expect(group).toHaveCSS("margin", "16px 0px 0px 10px")
  await expect(group).toHaveCSS("font-size", "17.6px")
  await expect(group).toHaveCSS("line-height", "21.12px")
  await expect(group).toHaveCSS("color", "rgb(153, 153, 153)")

  const option = keywords.getByRole("option", { name: "Brev", exact: true })
    .locator(".multiselect__option")
  await expect(option).toHaveCSS("padding", "6px 6px 6px 8px")
  await expect(option).toHaveCSS("font-size", "16px")
  await expect(option).toHaveCSS("line-height", "19.2px")
  const optionBox = await option.boundingBox()
  expect(optionBox).not.toBeNull()
  expect(optionBox!.x - dropdownBox!.x).toBeCloseTo(17, 1)
  expect(optionBox!.width).toBeCloseTo(332, 1)
  expect(optionBox!.height).toBeCloseTo(31.1875, 1)

  const selected = keywords.getByRole("option", { name: "Sakprosa", exact: true })
    .locator(".multiselect__option")
  await expect(selected).toHaveCSS("background-color", "rgb(221, 221, 221)")
  await expect(selected).toHaveCSS("color", "rgb(51, 51, 51)")
  await expect(selected).toHaveCSS("font-weight", "400")
})
