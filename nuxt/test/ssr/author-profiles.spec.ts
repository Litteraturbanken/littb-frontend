import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

import { managedHtmlRawProbes } from "../fixtures/author-profile-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`

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

function compactText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders the complete ordinary author profile from one private request", async ({
  request
}) => {
  const response = await request.get("/författare/StrindbergA")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe("August Strindberg, Introduktion | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("August Strindberg, Introduktion")
  expect(document.body.className).toBe("focus page-authorInfo ready")
  expect(document.documentElement.getAttribute("style")).toContain("forf2_bkg.jpg")
  expect(compactText(document.querySelector("h1.text-balance.max-w-5xl")?.textContent))
    .toBe("August Strindberg (1849-1912)")

  const navigation = document.querySelector('nav[aria-label="Författarsidor"]')
  const introduction = navigation?.querySelector('a[href="/f%C3%B6rfattare/StrindbergA"]')
  expect(introduction?.textContent?.trim()).toBe("Introduktion")
  expect(introduction?.parentElement?.classList.contains("active")).toBe(true)
  expect(introduction?.getAttribute("aria-current")).toBe("page")
  expect(navigation?.querySelector('a[href="/f%C3%B6rfattare/StrindbergA/titlar"]')?.textContent?.trim())
    .toBe("Verk")
  expect(navigation?.querySelector('a[href="/f%C3%B6rfattare/StrindbergA/dramawebben"]')?.textContent?.trim())
    .toBe("Dramawebben")
  expect(navigation?.querySelector('a[href="/s%C3%B6k?forfattare=StrindbergA&avancerad"]')?.textContent?.trim())
    .toBe("Sök i texterna")

  const intro = document.querySelector(".page_content .introtext.content.unbox.show_more")
  expect(intro).not.toBeNull()
  expect(intro?.firstElementChild?.localName).toBe("div")
  expect(intro?.firstElementChild?.innerHTML).toBe(
    '<p>August Strindberg var författare och dramatiker.</p>'
    + '<p>Han debuterade med <a href="/författare/StrindbergA/titlar/Fritankaren/etext">'
    + "<i>Fritänkaren</i></a>.</p>"
  )
  expect(compactText(intro?.textContent)).toContain("August Strindberg var författare och dramatiker.")
  expect(compactText(intro?.textContent)).toContain("Han debuterade med Fritänkaren.")
  expect(intro?.querySelector("a")?.getAttribute("href"))
    .toBe("/författare/StrindbergA/titlar/Fritankaren/etext")
  expect(intro?.querySelector(".introauthor em")?.textContent?.trim()).toBe("Gösta M. Bergman")
  expect(intro?.querySelector(".source_header")?.textContent?.trim()).toBe("Källor")
  expect([...intro?.querySelectorAll(".source_content") ?? []].map(node => compactText(node.textContent)))
    .toEqual(["Svenskt biografiskt lexikon", "Litteraturbanken"])
  expect(intro?.querySelector(".source_content")?.localName).toBe("div")
  expect(intro?.querySelector(".source_content")?.innerHTML)
    .toBe("<i>Svenskt biografiskt lexikon</i>")
  expect(compactText(intro?.querySelector(".pseudonym")?.textContent))
    .toBe("Pseudonymer Härved Ulf, Frater Sylvester")
  expect(compactText(intro?.querySelector(".other_name")?.textContent))
    .toBe("Andra namn Johan August Strindberg, August Strindberg d.y.")

  const portrait = document.querySelector(".portrait_container")
  expect(portrait?.querySelector("img.author_img")?.getAttribute("src"))
    .toBe("/red/forfattare/StrindbergA/StrindbergA_large.jpeg")
  expect(portrait?.querySelector("img.author_img")?.getAttribute("alt"))
    .toBe("Porträtt av August Strindberg")
  expect(compactText(portrait?.querySelector("figcaption")?.textContent))
    .toBe("August Strindberg, fotograferad 1902.")
  expect(portrait?.querySelector("figcaption")?.localName).toBe("figcaption")
  expect(portrait?.querySelector("figcaption")?.innerHTML)
    .toBe("August Strindberg, fotograferad 1902.")
  const linkBoxes = [...portrait?.querySelectorAll(".ext_links") ?? []]
  expect(linkBoxes).toHaveLength(2)
  expect(linkBoxes.map(box => box.querySelector("h3")?.textContent?.trim()))
    .toEqual(["Mer om författarskapet", "Författaren i uppslagsverk"])
  expect([...linkBoxes[0]!.querySelectorAll("a")].map(link => link.textContent?.trim()))
    .toEqual([
      "Texter om August Strindberg",
      "Presentation",
      "Bibliografi",
      "Strindbergsmuseet",
      "Litteraturkartan"
    ])
  expect(linkBoxes[0]!.querySelector("a")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/StrindbergA/mer")
  const mapLink = linkBoxes[0]!.querySelector('a[href*="litteraturkartan"]')
  expect(mapLink?.getAttribute("href"))
    .toBe("https://litteraturbanken.se/litteraturkartan?s=lb_author.authorid:StrindbergA")
  expect(mapLink?.getAttribute("target")).toBe("_blank")
  expect(mapLink?.getAttribute("rel")?.split(/\s+/u))
    .toEqual(expect.arrayContaining(["noopener", "noreferrer"]))
  expect([...linkBoxes[1]!.querySelectorAll("a")].map(link => link.textContent?.trim()))
    .toEqual(["Svenskt biografiskt lexikon", "Wikipedia"])

  expect(document.querySelectorAll("script .introtext, [onclick], [ng-click], [v-html]"))
    .toHaveLength(0)
  expect(document.body.textContent).not.toContain("<p>")
  expect(document.documentElement.outerHTML).not.toContain("javascript:")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/StrindbergA"])
})

test("SSR omits an unsafe backend author search URL", async ({ request }) => {
  const response = await request.get("/författare/UnsafeSearch")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector('nav[aria-label="Författarsidor"]')

  expect(navigation?.querySelector('a[href*="evil.invalid"]')).toBeNull()
  expect([...navigation?.querySelectorAll("a") ?? []].map(link => link.textContent?.trim()))
    .not.toContain("Sök i texterna")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/UnsafeSearch"])
})

test("SSR drops an unsafe backend portrait and its dependent caption", async ({ request }) => {
  const response = await request.get("/författare/UnsafePortrait")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.querySelector('img[src*="evil.invalid"]')).toBeNull()
  expect(html).not.toContain("evil.invalid")
  expect(document.querySelector("figcaption")).toBeNull()
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/UnsafePortrait"])
})

test("SSR removes credential links and hardens named author-profile targets", async ({ request }) => {
  const response = await request.get("/författare/ManagedHtmlProbe")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)
  const links = new Map(
    [...document.querySelectorAll(".introtext a")].map(link => [link.textContent, link])
  )

  expect(links.get("Credential profile link")?.getAttribute("href")).toBeNull()
  expect(html).not.toContain("reader:secret@evil.invalid")
  expect(links.get("Named profile link")?.getAttribute("rel"))
    .toBe("editorial noopener noreferrer")
  expect(links.get("Named profile link")?.getAttribute("target")).toBe("author_profile")
  expect(links.get("Self profile link")?.getAttribute("rel")).toBe("author")
  expect(links.get("Self profile link")?.getAttribute("target")).toBe("_self")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/ManagedHtmlProbe"])
})

test("SSR falls back from sanitized-empty Drama prose while retaining its variant portrait", async ({
  request
}) => {
  const response = await request.get("/författare/SanitizedFallback/dramawebben")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)
  const intro = document.querySelector(".introtext")

  expect(compactText(intro?.textContent)).toContain("Ordinary fallback introduction.")
  expect(compactText(intro?.querySelector(".introauthor em")?.textContent))
    .toBe("Ordinary fallback editor")
  expect(compactText(intro?.querySelector(".source_content")?.textContent))
    .toBe("Ordinary fallback source")
  expect(intro?.querySelector('.drama_subtitle a[href="/dramawebben"]')).not.toBeNull()
  expect(document.querySelector(".portrait_container img")?.getAttribute("src"))
    .toBe("/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg")
  expect(compactText(document.querySelector("figcaption")?.textContent))
    .toBe("Drama portrait remains variant-owned.")
  expect(html).not.toMatch(/Drama removed (?:introduction|editor|source)/u)
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/SanitizedFallback"])
})

for (const [variant, path, intended] of [
  [
    "ordinary",
    "/författare/ManagedHtmlProbe",
    ["Ordinary intended intro", "Ordinary intended source", "Ordinary intended caption"]
  ],
  [
    "Dramawebben",
    "/författare/ManagedHtmlProbe/dramawebben",
    ["Drama intended intro", "Drama intended source", "Drama intended caption"]
  ]
] as const) {
  test(`SSR ${variant} payload contains only sanitized managed HTML`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const { document } = parseHTML(html)

    expect(document.querySelector(".introtext")?.textContent).toContain(intended[0])
    expect(document.querySelector(".source_content")?.textContent).toContain(intended[1])
    expect(document.querySelector("figcaption")?.textContent).toContain(intended[2])
    for (const probe of managedHtmlRawProbes) expect(html, probe).not.toContain(probe)
    expect(await profileRequests(request)).toEqual(["/private-v2/authors/ManagedHtmlProbe"])
  })
}

test("SSR renders RFC3986 author IDs once with canonical profile links", async ({ request }) => {
  const response = await request.get("/f%C3%B6rfattare/O%27Neil%28A", {
    maxRedirects: 0
  })
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Pat O'Neil (A)")
  expect([...document.querySelectorAll("ul.links a")].map(link => [
    link.textContent?.trim(),
    link.getAttribute("href")
  ])).toEqual([
    ["Introduktion", "/f%C3%B6rfattare/O%27Neil%28A"],
    ["Verk", "/f%C3%B6rfattare/O%27Neil%28A/titlar"],
    ["Dramawebben", "/f%C3%B6rfattare/O%27Neil%28A/dramawebben"]
  ])
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/O'Neil(A"])
})

test("SSR omits absent sparse-profile sections without inventing fallbacks", async ({ request }) => {
  const response = await request.get("/författare/Lagerl%C3%B6fS")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Selma Lagerlöf, Introduktion | Litteraturbanken")
  expect(compactText(document.querySelector("h1")?.textContent)).toBe("Selma Lagerlöf (1858-1940)")
  expect(document.querySelector(".introtext")?.textContent?.trim())
    .toBe("Selma Lagerlöf var författare och Nobelpristagare.")
  expect(document.querySelector(".introauthor, .source, .pseudonym, .other_name"))
    .toBeNull()
  expect(document.querySelector(".portrait_container, .ext_links"))
    .toBeNull()
  expect([...document.querySelectorAll("ul.links a")].map(node => node.textContent?.trim()))
    .toEqual(["Introduktion", "Verk"])
  expect(document.querySelector('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"]'))
    .not.toBeNull()
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/Lagerl%C3%B6fS"])
})

test("SSR renders the Dramawebben variant and keeps ordinary link boxes out", async ({ request }) => {
  const response = await request.get("/författare/StrindbergA/dramawebben", {
    maxRedirects: 0
  })
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("August Strindberg, Introduktion av Dramawebben | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("August Strindberg, Introduktion av Dramawebben")
  expect(document.body.className).toBe("focus page-authorInfo ready")
  expect(document.documentElement.getAttribute("style")).toContain("dramawebben_fade_more.jpg")
  const active = document.querySelector("ul.links li.active a")
  expect(active?.textContent?.trim()).toBe("Dramawebben")
  expect(active?.getAttribute("aria-current")).toBe("page")

  const intro = document.querySelector(".introtext.content.sm\\:inline-block.show_more")
  expect(compactText(intro?.textContent)).toContain("Strindberg förnyade det svenska dramat.")
  expect(compactText(intro?.textContent)).not.toContain("August Strindberg var författare")
  expect(intro?.querySelector(".introauthor em")?.textContent?.trim())
    .toBe("Dramawebbens redaktion")
  expect(intro?.querySelector(".drama_subtitle a")?.getAttribute("href")).toBe("/dramawebben")
  expect(intro?.querySelector(".drama_subtitle a")?.textContent?.trim()).toBe("Dramawebben")
  expect(intro?.querySelector(".source_header")?.textContent?.trim()).toBe("Källa")
  expect(intro?.querySelector(".source_content")?.textContent?.trim()).toBe("Dramawebben")
  expect(compactText(intro?.querySelector(".pseudonym")?.textContent))
    .toBe("Pseudonymer Härved Ulf, Frater Sylvester")
  expect(document.querySelector(".portrait_container img")?.getAttribute("src"))
    .toBe("/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg")
  expect(document.querySelector(".portrait_container img")?.getAttribute("alt"))
    .toBe("Porträtt av August Strindberg")
  expect(document.querySelector(".portrait_container figcaption")?.textContent?.trim())
    .toBe("Porträtt ur Dramawebbens samling.")
  expect(document.querySelector(".page_content .ext_links")).toBeNull()
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/StrindbergA"])
})

test("SSR renders a sparse Dramawebben-only profile without ordinary content", async ({ request }) => {
  const response = await request.get("/författare/DramaOnly/dramawebben")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Dramatikern, Introduktion av Dramawebben | Litteraturbanken")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Dramatikern")
  expect([...document.querySelectorAll("ul.links a")].map(node => node.textContent?.trim()))
    .toEqual(["Verk", "Dramawebben"])
  expect(document.querySelector(".introtext")?.textContent).toContain(
    "Den här introduktionen finns bara på Dramawebben."
  )
  expect(document.querySelector(".introauthor em, .source, .pseudonym, .other_name"))
    .toBeNull()
  expect(document.querySelector(".portrait_container img")?.getAttribute("src"))
    .toBe("/red/forfattare/DramaOnly/DramaOnly_dw_large.jpeg")
  expect(document.querySelector(".portrait_container img")?.getAttribute("alt"))
    .toBe("Porträtt av Dramatikern")
  expect(document.querySelector(".portrait_container figcaption, .ext_links")).toBeNull()
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/DramaOnly"])
})

test("SSR returns page-local non-leaking 404 and 503 author errors", async ({ request }) => {
  const missing = await request.get("/författare/Ok%C3%A4nd")
  expect(missing.status()).toBe(404)
  const missingDocument = parseHTML(await missing.text()).document
  expect(compactText(missingDocument.querySelector(".error")?.textContent))
    .toBe("Ett fel har inträffat: författarid Okänd kan inte hittas. Kontrollera adressen.")
  expect(missingDocument.querySelector(".error code")?.textContent).toBe("Okänd")
  expect(missingDocument.querySelector("h1, ul.links, .page_content")).toBeNull()

  await reset(request)
  await request.put(`${fixture}/_author_profile_failure`)
  const failed = await request.get("/författare/StrindbergA/dramawebben")
  expect(failed.status()).toBe(503)
  const failedHtml = await failed.text()
  const failedDocument = parseHTML(failedHtml).document
  expect(compactText(failedDocument.querySelector(".error")?.textContent))
    .toBe("Ett fel har inträffat. Författarprofilen kan inte visas just nu.")
  expect(failedDocument.querySelector("h1, ul.links, .page_content")).toBeNull()
  expect(failedHtml).not.toContain("author_profile_unavailable")
  expect(failedHtml).not.toContain("Unable to load author profile")
})

for (const [author, expectedPath] of [
  ["DramaOnly", "/författare/DramaOnly/dramawebben"],
  ["NoIntro", "/författare/NoIntro/titlar"]
] as const) {
  test(`SSR temporarily redirects ${author} to its canonical profile and preserves queries`, async ({
    request
  }) => {
    const response = await request.get(`/författare/${author}?visning=kort&tagg=a&tagg=b`, {
      maxRedirects: 0
    })
    expect(response.status()).toBe(307)
    const location = new URL(response.headers().location!, "http://litteraturbanken.test")
    expect(decodeURIComponent(location.pathname)).toBe(expectedPath)
    expect(location.searchParams.get("visning")).toBe("kort")
    expect(location.searchParams.getAll("tagg")).toEqual(["a", "b"])
    expect(await profileRequests(request)).toEqual([`/private-v2/authors/${author}`])
  })
}
