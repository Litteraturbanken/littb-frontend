import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
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

async function navigateContactClient(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } }
      }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    await router.push(target)
  }, path)
}

async function submissions(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_contact_submissions`)
  return (await response.json()).contactSubmissions as Record<string, unknown>[]
}

async function waitForSubmissions(request: APIRequestContext, count = 1) {
  await expect.poll(async () => (await submissions(request)).length).toBe(count)
  return submissions(request)
}

function waitForContactResponse(page: Page) {
  return page.waitForResponse(response => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v2/contact"
  ))
}

async function waitForFeedbackRender(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
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
  await expect(page.getByRole("textbox", { name: "Meddelande", exact: true })).toHaveCount(1)
  const messageLabelStyles = await page.locator('label[for="messageInput"]').evaluate(element => {
    const style = getComputedStyle(element)
    return {
      position: style.position,
      height: style.height,
      overflow: style.overflow,
      clip: style.clip
    }
  })
  expect(messageLabelStyles).toEqual({
    position: "absolute",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0px, 0px, 0px, 0px)"
  })

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

test("Contact validation exposes each visual error through its invalid field", async ({ page }) => {
  await openContact(page)
  const contactName = page.getByRole("textbox", { name: "Namn", exact: true })
  const contactEmail = page.getByRole("textbox", { name: "Epost", exact: true }).first()
  const message = page.getByRole("textbox", { name: "Meddelande", exact: true })
  const newsletterEmail = page.getByRole("textbox", { name: "Epost", exact: true }).last()

  await expect(contactName).toHaveAttribute("aria-invalid", "false")
  await expect(contactEmail).toHaveAttribute("aria-invalid", "false")
  await expect(contactEmail).toHaveAttribute("aria-errormessage", "contact-email-error")
  await expect(message).toHaveAttribute("aria-invalid", "false")
  await expect(message).toHaveAttribute("aria-errormessage", "contact-message-error")
  await expect(newsletterEmail).toHaveAttribute("aria-invalid", "false")
  await expect(newsletterEmail).toHaveAttribute("aria-errormessage", "newsletter-email-error")

  await contactEmail.fill("invalid")
  await message.fill("x")
  await message.fill(" ")
  await newsletterEmail.fill("invalid")
  await page.locator(".header").click()

  for (const [field, error, copy] of [
    [contactEmail, page.locator("#contact-email-error"), "Skriv din epostadress"],
    [message, page.locator("#contact-message-error"), "Meddelandet är tomt."],
    [newsletterEmail, page.locator("#newsletter-email-error"), "Skriv din epostadress"]
  ] as const) {
    await expect(field).toHaveAttribute("aria-invalid", "true")
    await expect(error).toBeVisible()
    await expect(error).toHaveText(copy)
  }

  await contactEmail.fill("anna@example.test")
  await message.fill("Hej")
  await newsletterEmail.fill("utskick@example.test")
  await expect(contactEmail).toHaveAttribute("aria-invalid", "false")
  await expect(message).toHaveAttribute("aria-invalid", "false")
  await expect(newsletterEmail).toHaveAttribute("aria-invalid", "false")
})

test("keyboard-submits trimmed Contact data, exposes one polite status, and clears fields four seconds after success", async ({ page, request }) => {
  await openContact(page)
  await page.evaluate(() => document.fonts.ready)
  await page.clock.install()
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page, {
    name: "  Anna Andersson  ",
    email: "  anna@example.test  ",
    message: "  Hej!  "
  })

  await page.locator("form.contactform button.submit").press("Enter")
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
  const status = page.getByRole("status")
  await expect(status).toBeVisible()
  await expect(status).toHaveText("Tack för ditt meddelande, vi svarar så fort vi kan.")
  await expect(status).toHaveAttribute("aria-live", "polite")
  await expect(page.getByRole("status")).toHaveCount(1)
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

test("prevents duplicate pending Contact submits from double-click, Enter, and requestSubmit", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page)

  const submit = page.locator("form.contactform button.submit")
  const form = page.locator("form.contactform")
  await submit.dblclick()
  await expect(submit).toBeDisabled()
  await submit.press("Enter")
  await form.evaluate(element => (element as HTMLFormElement).requestSubmit())

  const payload = {
    sender_name: "Anna Andersson",
    sender_address: "anna@example.test",
    message: "Hej!",
    audience: "litteraturbanken"
  }
  expect(await waitForSubmissions(request)).toEqual([payload])
  await expect(form).toHaveAttribute("aria-busy", "true")
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()

  await request.delete(`${fixture}/_contact_defer`)
  await expect(page.getByText("Tack för ditt meddelande, vi svarar så fort vi kan.", { exact: true })).toBeVisible()
  await expect(submit).toBeEnabled()
  await expect(form).toHaveAttribute("aria-busy", "false")
})

test("a failed Contact submission alerts before restoring the mounted form after four seconds", async ({ page, request }) => {
  await request.put(`${fixture}/_failure`, { data: { resource: "contact" } })
  await openContact(page)
  await page.clock.install()
  await fillContact(page)
  await page.locator("form.contactform button.submit").click()

  const status = page.getByRole("alert")
  await expect(status).toBeVisible()
  await expect(status).toHaveText("Ett fel uppstod. Vänligen försök igen senare.")
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

test("client query transitions use the current SOL and school flags without reloading Contact", async ({
  page,
  request
}) => {
  await openContact(page)
  await page.clock.install()

  await navigateContactClient(page, "/om/kontakt?sol=&skola=1&other=bevarad")
  await expect(page).toHaveURL("/om/kontakt?sol=&skola=1&other=bevarad")
  await page.locator("#emailInput").fill("sol@example.test")
  await page.locator(".contactform textarea").fill("Efter SOL-navigering")
  await page.locator("form.contactform button.submit").click()
  expect(await waitForSubmissions(request)).toEqual([{
    sender_name: null,
    sender_address: "sol@example.test",
    message: "[skola] Efter SOL-navigering",
    audience: "oversattarlexikon"
  }])
  await page.clock.fastForward(4_000)

  await navigateContactClient(page, "/om/kontakt?skola=1&other=bevarad")
  await expect(page).toHaveURL("/om/kontakt?skola=1&other=bevarad")
  await page.locator("#emailInput").fill("ordinarie@example.test")
  await page.locator(".contactform textarea").fill("Efter vanlig navigering")
  await page.locator("form.contactform button.submit").click()
  expect(await waitForSubmissions(request, 2)).toEqual([
    {
      sender_name: null,
      sender_address: "sol@example.test",
      message: "[skola] Efter SOL-navigering",
      audience: "oversattarlexikon"
    },
    {
      sender_name: null,
      sender_address: "ordinarie@example.test",
      message: "[skola] Efter vanlig navigering",
      audience: "litteraturbanken"
    }
  ])
})

test("pointer-submitted newsletter has one polite status, retains its address, and clears Contact fields", async ({ page, request }) => {
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
  const status = page.getByRole("status")
  await expect(status).toBeVisible()
  await expect(status).toHaveText("Tack för din anmälan.")
  await expect(status).toHaveAttribute("aria-live", "polite")
  await expect(page.getByRole("status")).toHaveCount(1)
  await page.clock.fastForward(4_000)
  await expect(status).toBeHidden()
  await expect(page.locator("#nameInput")).toHaveValue("")
  await expect(page.locator("#emailInput")).toHaveValue("")
  await expect(page.locator(".contactform textarea")).toHaveValue("")
  await expect(page.locator("#newsletterEmail")).toHaveValue("utskick@example.test")
})

test("concurrent Contact and newsletter successes expose only the final status", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page)
  await page.locator("#newsletterEmail").fill("utskick@example.test")

  await page.locator("form.contactform button.submit").click()
  await page.locator("form.subscribeform button.submit").click()
  await waitForSubmissions(request, 2)
  await request.delete(`${fixture}/_contact_defer`)

  const statuses = page.getByRole("status")
  await expect(statuses).toHaveCount(1)
  await expect(statuses).toHaveText("Tack för din anmälan.")
})

test("only the latest delayed submission may publish feedback or own its timeout", async ({ page, request }) => {
  await openContact(page)
  await page.clock.install()
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page)
  await page.locator("#newsletterEmail").fill("utskick@example.test")

  await page.locator("form.contactform button.submit").click()
  await waitForSubmissions(request)
  await page.clock.fastForward(1_000)
  await page.locator("form.subscribeform button.submit").click()
  await waitForSubmissions(request, 2)

  const oldResponse = waitForContactResponse(page)
  await request.post(`${fixture}/_contact_release`, { data: { sender_name: "Anna Andersson" } })
  await oldResponse
  await waitForFeedbackRender(page)
  await expect(page.getByRole("status")).toHaveCount(0)
  await expect(page.locator("form.contactform button.submit")).toBeEnabled()
  await expect(page.locator("form.subscribeform button.submit")).toBeDisabled()
  await page.clock.fastForward(1_000)
  const newResponse = waitForContactResponse(page)
  await request.post(`${fixture}/_contact_release`, { data: { sender_name: "Utskickslista" } })
  await newResponse

  const status = page.getByRole("status")
  await expect(status).toHaveText("Tack för din anmälan.")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await page.clock.fastForward(3_000)
  await expect(status).toBeVisible()
})

test("an older delayed failure cannot replace newer success feedback", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await fillContact(page)
  await page.locator("#newsletterEmail").fill("utskick@example.test")

  await page.locator("form.contactform button.submit").click()
  await page.locator("form.subscribeform button.submit").click()
  await waitForSubmissions(request, 2)

  const newResponse = waitForContactResponse(page)
  await request.post(`${fixture}/_contact_release`, { data: { sender_name: "Utskickslista" } })
  await newResponse
  const status = page.getByRole("status")
  await expect(status).toHaveText("Tack för din anmälan.")
  const oldResponse = waitForContactResponse(page)
  await request.post(`${fixture}/_contact_release`, {
    data: { sender_name: "Anna Andersson", failure: true }
  })
  await oldResponse
  await waitForFeedbackRender(page)

  await expect(status).toHaveText("Tack för din anmälan.")
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("prevents duplicate pending newsletter submits from keyboard and requestSubmit", async ({ page, request }) => {
  await openContact(page)
  await request.put(`${fixture}/_contact_defer`)
  await page.locator("#newsletterEmail").fill("utskick@example.test")

  const submit = page.locator("form.subscribeform button.submit")
  const form = page.locator("form.subscribeform")
  await submit.press("Enter")
  await expect(submit).toBeDisabled()
  await form.evaluate(element => (element as HTMLFormElement).requestSubmit())

  const payload = {
    sender_name: "Utskickslista",
    sender_address: "utskick@example.test",
    message: "utskick@example.test vill bli tillagd på utskickslistan.",
    audience: "litteraturbanken"
  }
  expect(await waitForSubmissions(request)).toEqual([payload])
  await expect(form).toHaveAttribute("aria-busy", "true")
  await expect(page.locator(".page-contactForm > div").first()).toBeVisible()
  await expect(page.locator(".page-contactForm .spinner")).toBeHidden()

  await request.delete(`${fixture}/_contact_defer`)
  await expect(page.getByText("Tack för din anmälan.", { exact: true })).toBeVisible()
  await expect(submit).toBeEnabled()
  await expect(form).toHaveAttribute("aria-busy", "false")
})

test("legacy Contact alias preserves query and fragment in the browser", async ({ page }) => {
  await page.goto("/kontakt?sol=1&skola=1#newsletter")
  await expect(page).toHaveURL("/om/kontakt?sol=1&skola=1#newsletter")
  await expect(page.locator(".contactform textarea")).toHaveValue("[Ang. Översättarlexikon]\n\n")
})
