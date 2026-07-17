import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"

const fixture = "http://127.0.0.1:4100"
const portraitBytes = readFileSync(new URL("../../app/assets/img/lagerlof_portrait.jpg", import.meta.url))

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`)
  ])
}

async function profileRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_author_profile_requests`)
  return (await response.json() as { requests: string[] }).requests
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push: (path: string) => Promise<void> }
          }
        }
      }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    await router?.push(target)
  }, path)
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text())
  })
  return problems
}

test.beforeEach(async ({ page, request }) => {
  await reset(request)
  await page.route("**/red/forfattare/**/*.jpeg", route => route.fulfill({
    status: 200,
    contentType: "image/jpeg",
    body: portraitBytes
  }))
})

test("hydrates the rich profile without warnings or duplicate browser requests", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  await expect(page.locator("h1")).toContainText("August Strindberg")
  await expect(page.locator(".introtext")).toContainText("Han debuterade med Fritänkaren.")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/StrindbergA"])
  expect(problems).toEqual([])
})

test("client author navigation uses one public request and replaces every profile field", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await reset(request)

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page).toHaveTitle("Selma Lagerlöf, Introduktion | Litteraturbanken")
  await expect(page.locator(".introtext")).toContainText("Nobelpristagare")
  await expect(page.locator("body")).not.toContainText("August Strindberg")
  await expect(page.locator(".pseudonym, .other_name, .portrait_container, .ext_links"))
    .toHaveCount(0)
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"]'))
    .toHaveCount(1)

  expect(await profileRequests(request)).toEqual(["/v2/authors/Lagerl%C3%B6fS"])
  expect(problems).toEqual([])
})

test("ordinary and Dramawebben navigation cleans metadata, background, and active content", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  await routerPush(page, "/f%C3%B6rfattare/StrindbergA/dramawebben")
  await expect(page).toHaveTitle(
    "August Strindberg, Introduktion av Dramawebben | Litteraturbanken"
  )
  await expect(page.locator("html")).toHaveAttribute("style", /dramawebben_fade_more\.jpg/)
  await expect(page.locator("ul.links li.active a")).toHaveText("Dramawebben")
  await expect(page.locator(".introtext")).toContainText("förnyade det svenska dramat")
  await expect(page.locator(".introtext")).not.toContainText("debuterade")
  await expect(page.locator(".drama_subtitle")).toBeVisible()
  await expect(page.locator(".page_content .ext_links")).toHaveCount(0)

  await routerPush(page, "/f%C3%B6rfattare/StrindbergA")
  await expect(page).toHaveTitle("August Strindberg, Introduktion | Litteraturbanken")
  await expect(page.locator("html")).toHaveAttribute("style", /forf2_bkg\.jpg/)
  await expect(page.locator("ul.links li.active a")).toHaveText("Introduktion")
  await expect(page.locator(".introtext")).toContainText("debuterade")
  await expect(page.locator(".introtext")).not.toContainText("förnyade det svenska dramat")
  await expect(page.locator(".drama_subtitle")).toHaveCount(0)
  await expect(page.locator(".page_content .ext_links")).toHaveCount(2)
  expect(problems).toEqual([])
})

test("Dramawebben source heading exposes only its singular semantic label", async ({ page }) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/dramawebben", { waitUntil: "networkidle" })

  const sourceBlock = page.locator(".drama-source")
  await expect(sourceBlock).toMatchAriaSnapshot(`
    - text: Källa
    - list:
      - listitem: "* Dramawebben"
  `)
  expect(problems).toEqual([])
})

test("direct Dramawebben client navigation without a block replace-redirects to root", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/dramawebben?fran=test")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS\?fran=test$/)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  expect(await profileRequests(request)).toEqual(["/v2/authors/Lagerl%C3%B6fS"])

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  expect(problems).toEqual([])
})

test("profile links remain encoded ordinary anchors and blank targets are hardened", async ({
  page
}) => {
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  const internalHrefs = await page.locator(".page_content a").evaluateAll(links => links
    .map(link => link.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.startsWith("/"))))
  expect(internalHrefs).toEqual([
    "/författare/StrindbergA/titlar/Fritankaren/etext",
    "/författare/StrindbergA/presentation",
    "/författare/StrindbergA/bibliografi",
    "/presentationer/specialomraden/Strindberg.html"
  ])
  expect(await page.locator("ul.links a").evaluateAll(links => links.every(link => link.tagName === "A")))
    .toBe(true)
  expect(await page.locator(".page_content a").evaluateAll(links => links.every(link => link.tagName === "A")))
    .toBe(true)

  const encyclopedia = page.locator(".ext_links").nth(1).locator("a")
  await expect(encyclopedia).toHaveCount(2)
  for (const link of await encyclopedia.all()) {
    await expect(link).toHaveAttribute("target", "_blank")
    const rel = (await link.getAttribute("rel"))?.split(/\s+/) ?? []
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer"]))
  }

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS"]')).toHaveCount(1)
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"]'))
    .toHaveCount(1)
})
