import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const angularEmail = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_requests`),
    request.delete(`${fixture}/_contact_submissions`),
    request.delete(`${fixture}/_contact_defer`),
    request.delete(`${fixture}/_failure`)
  ])
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function openContact(page: Page, path = "/om/kontakt") {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
}

async function submissions(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_contact_submissions`)
  return (await response.json()).contactSubmissions as Record<string, unknown>[]
}

async function waitForSubmissions(request: APIRequestContext, count = 1) {
  await expect.poll(async () => (await submissions(request)).length).toBe(count)
  return submissions(request)
}

async function fillContact(page: Page, values = {
  name: "Anna Andersson",
  email: "anna@example.test",
  message: "Hej!"
}) {
  await page.locator("#nameInput").fill(values.name)
  await page.locator("#emailInput").fill(values.email)
  await page.locator(".contactform textarea").fill(values.message)
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => request.delete(`${fixture}/_contact_defer`))

test("renders exact copy, pristine controls, Angular email grammar, and dirty-blurred errors", async ({ page }) => {
  const problems = await openContact(page)
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Litteraturbankens kontaktforumlär och utskicksanmälan."
  )
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  await expect(page.locator("ul.links a.active")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Kontakt", exact: true })).toHaveClass(/\bactive\b/)
  await expect(page.locator("#nameInput")).toBeFocused()

  const contactButton = page.locator("form.contactform button.submit")
  const newsletterButton = page.locator("form.subscribeform button.submit")
  await expect(contactButton).toBeDisabled()
  await expect(newsletterButton).toBeDisabled()
  await expect(page.locator(".contactform .error_msg")).toHaveCount(2)
  await expect(page.locator(".contactform .error_msg").nth(0)).toBeHidden()
  await expect(page.locator(".contactform .error_msg").nth(1)).toBeHidden()

  await page.locator("#emailInput").fill("not-an-email")
  await expect(page.locator("#emailInput + .error_msg")).toBeHidden()
  await page.locator(".contactform textarea").fill("x")
  await page.locator(".contactform textarea").fill("   ")
  await expect(page.locator(".msg_box > .error_msg")).toBeHidden()
  await page.locator(".header").click()
  await expect(page.locator(".contactform textarea")).toHaveValue("")
  await expect(page.locator("#emailInput + .error_msg")).toBeVisible()
  await expect(page.locator(".msg_box > .error_msg")).toBeVisible()
  await expect(contactButton).toBeDisabled()

  expect(angularEmail.test("a@b")).toBe(true)
  await page.locator("#emailInput").fill("a@b")
  await page.locator(".contactform textarea").fill("Hej")
  await expect(contactButton).toBeEnabled()

  await page.locator("#newsletterEmail").fill("invalid")
  await expect(newsletterButton).toBeDisabled()
  await page.locator("#newsletterEmail").fill("a@b")
  await expect(newsletterButton).toBeEnabled()
  expect(problems).toEqual([])
})

test("submits trimmed Contact data, exposes only its spinner, and clears fields four seconds after success", async ({ page, request }) => {
  await openContact(page)
  await page.evaluate(() => document.fonts.ready)
  await page.clock.install()
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page, {
    name: "  Anna Andersson  ",
    email: "  anna@example.test  ",
    message: "  Hej!  "
  })

  await page.locator("form.contactform button.submit").click()
  expect(await waitForSubmissions(request)).toEqual([{
    sender_name: "Anna Andersson",
    sender_address: "anna@example.test",
    message: "Hej!",
    audience: "litteraturbanken"
  }])
  const spinner = page.locator(".contactform .spinner.fa.fa-spinner.fa-pulse")
  await expect(spinner).toBeVisible()
  const spinnerBox = await spinner.boundingBox()
  expect(spinnerBox?.width).toBeGreaterThan(0)
  expect(spinnerBox?.height).toBeGreaterThan(0)
  const spinnerStyle = await spinner.evaluate(element => {
    const style = getComputedStyle(element)
    const before = getComputedStyle(element, "::before")
    return {
      fontFamily: style.fontFamily,
      beforeContent: before.content
    }
  })
  expect(spinnerStyle.fontFamily).toContain("FontAwesome")
  expect(spinnerStyle.beforeContent).not.toBe("")
  expect(spinnerStyle.beforeContent).not.toBe("none")
  await expect(page.locator(".subscribeform .spinner")).toHaveCount(0)
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()

  await request.delete(`${fixture}/_contact_defer`)
  const status = page.getByText("Tack för ditt meddelande, vi svarar så fort vi kan.", { exact: true })
  await expect(status).toBeVisible()
  await expect(page.locator(".page-contactForm > div").first()).toBeHidden()
  await expect(page.locator("#nameInput")).toHaveValue("Anna Andersson")
  await page.clock.fastForward(3_999)
  await expect(status).toBeVisible()
  await page.clock.fastForward(1)
  await expect(status).toBeHidden()
  await expect(page.locator("#nameInput")).toHaveValue("")
  await expect(page.locator("#emailInput")).toHaveValue("")
  await expect(page.locator(".contactform textarea")).toHaveValue("")
})

test("keeps Contact submission available while pending and sends each duplicate attempt", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page)

  const submit = page.locator("form.contactform button.submit")
  await submit.click()
  await expect(submit).toBeEnabled()
  await submit.click()

  const payload = {
    sender_name: "Anna Andersson",
    sender_address: "anna@example.test",
    message: "Hej!",
    audience: "litteraturbanken"
  }
  expect(await waitForSubmissions(request, 2)).toEqual([payload, payload])
  await expect(submit).toBeEnabled()
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()

  await request.delete(`${fixture}/_contact_defer`)
  await expect(page.getByText("Tack för ditt meddelande, vi svarar så fort vi kan.", { exact: true })).toBeVisible()
})

test("a failed Contact submission restores the mounted form after four seconds and retains values", async ({ page, request }) => {
  await request.put(`${fixture}/_failure`, { data: { resource: "contact" } })
  await openContact(page)
  await page.clock.install()
  await fillContact(page)
  await page.locator("form.contactform button.submit").click()

  const status = page.getByText("Ett fel uppstod. Vänligen försök igen senare.", { exact: true })
  await expect(status).toBeVisible()
  await expect(page.locator(".contactform .spinner")).toBeHidden()
  await expect(page.locator(".page-contactForm > div").first()).toBeHidden()
  await page.clock.fastForward(4_000)
  await expect(status).toBeHidden()
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()
  await expect(page.locator("#nameInput")).toHaveValue("Anna Andersson")
  await expect(page.locator("#emailInput")).toHaveValue("anna@example.test")
  await expect(page.locator(".contactform textarea")).toHaveValue("Hej!")
})

test("captures SOL and school flags once, composes the exact payload, and fixes the SOL audience", async ({ page, request }) => {
  await openContact(page, "/om/kontakt?sol=&skola=1")
  await expect(page.locator(".contactform textarea")).toHaveValue("[Ang. Översättarlexikon]\n\n")
  await expect(page.locator("form.contactform button.submit")).toBeDisabled()
  await page.locator("#emailInput").fill("a@b")
  await expect(page.locator("form.contactform button.submit")).toBeEnabled()
  await page.locator("form.contactform button.submit").click()

  expect(await waitForSubmissions(request)).toEqual([{
    sender_name: null,
    sender_address: "a@b",
    message: "[skola] [Ang. Översättarlexikon]\n\n",
    audience: "oversattarlexikon"
  }])
  await expect(page.getByText("Tack för ditt meddelande, vi svarar så fort vi kan.", { exact: true })).toBeVisible()

  await page.goto("/om/kontakt")
  await expect(page.locator(".contactform textarea")).toHaveValue("")
})

test("newsletter always targets Litteraturbanken, has no spinner, retains its address, and clears Contact fields", async ({ page, request }) => {
  await openContact(page, "/om/kontakt?sol")
  await page.clock.install()
  await fillContact(page)
  await page.locator("#newsletterEmail").fill("  utskick@example.test  ")
  await page.locator("form.subscribeform button.submit").click()

  expect(await waitForSubmissions(request)).toEqual([{
    sender_name: "Utskickslista",
    sender_address: "utskick@example.test",
    message: "utskick@example.test vill bli tillagd på utskickslistan.",
    audience: "litteraturbanken"
  }])
  await expect(page.locator(".page-contactForm .spinner")).toBeHidden()
  const status = page.getByText("Tack för din anmälan.", { exact: true })
  await expect(status).toBeVisible()
  await page.clock.fastForward(4_000)
  await expect(status).toBeHidden()
  await expect(page.locator("#nameInput")).toHaveValue("")
  await expect(page.locator("#emailInput")).toHaveValue("")
  await expect(page.locator(".contactform textarea")).toHaveValue("")
  await expect(page.locator("#newsletterEmail")).toHaveValue("utskick@example.test")
})

test("keeps newsletter submission available while pending and sends each duplicate attempt", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await page.locator("#newsletterEmail").fill("utskick@example.test")

  const submit = page.locator("form.subscribeform button.submit")
  await submit.click()
  await expect(submit).toBeEnabled()
  await submit.click()

  const payload = {
    sender_name: "Utskickslista",
    sender_address: "utskick@example.test",
    message: "utskick@example.test vill bli tillagd på utskickslistan.",
    audience: "litteraturbanken"
  }
  expect(await waitForSubmissions(request, 2)).toEqual([payload, payload])
  await expect(submit).toBeEnabled()
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()
  await expect(page.locator(".page-contactForm .spinner")).toBeHidden()

  await request.delete(`${fixture}/_contact_defer`)
  await expect(page.getByText("Tack för din anmälan.", { exact: true })).toBeVisible()
})

test("legacy Contact alias preserves query and fragment in the browser", async ({ page }) => {
  await page.goto("/kontakt?sol=1&skola=1#newsletter")
  await expect(page).toHaveURL("/om/kontakt?sol=1&skola=1#newsletter")
  await expect(page.locator(".contactform textarea")).toHaveValue("[Ang. Översättarlexikon]\n\n")
})
