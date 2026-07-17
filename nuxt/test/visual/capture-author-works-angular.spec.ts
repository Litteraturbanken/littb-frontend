import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import {
  lagerlofAuthorProfile,
  strindbergAuthorProfile
} from "../fixtures/author-profile-data.mjs"
import {
  richAuthorWorks,
  sparseAuthorWorks
} from "../fixtures/author-works-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const restrictedPrefixes = [
  "/api/",
  "/red/",
  "/txt/",
  "/export/",
  "/query/",
  "/bilder/",
  "/css/",
  "/xhr/",
  "/ws/"
]

type FrozenProfile = typeof strindbergAuthorProfile | typeof lagerlofAuthorProfile
type FrozenWorks = typeof richAuthorWorks | typeof sparseAuthorWorks
type FrozenSection = FrozenWorks["authored_sections"][number] | FrozenWorks["about_sections"][number]
type FrozenWork = FrozenSection["items"][number]
type LegacyPerson = {
  authorid: string
  full_name: string
  name_for_index: string
  surname: string | null
}
type LegacyRow = {
  lbworkid: string
  titlepath: string
  titleid: string
  work_titleid: string
  title: string
  shorttitle: string | null
  sortkey: string
  imprintyear: string | null
  mediatype: string
  doc_type: string
  startpagename: string | null
  authors: LegacyPerson[]
  main_author: LegacyPerson
  work_authors?: LegacyPerson[]
  workshorttitle?: string
  export: { type: "epub" | "pdf", size: number }[]
  keyword?: string[]
}
type VisualCase = {
  name: "rich-titlar" | "rich-mer" | "sparse-titlar"
  route: string
  page: "titlar" | "mer"
  profile: FrozenProfile
  works: FrozenWorks
}

const visualCases: VisualCase[] = [
  {
    name: "rich-titlar",
    route: "/författare/StrindbergA/titlar",
    page: "titlar",
    profile: strindbergAuthorProfile,
    works: richAuthorWorks
  },
  {
    name: "rich-mer",
    route: "/författare/StrindbergA/mer",
    page: "mer",
    profile: strindbergAuthorProfile,
    works: richAuthorWorks
  },
  {
    name: "sparse-titlar",
    route: "/författare/Lagerl%C3%B6fS/titlar",
    page: "titlar",
    profile: lagerlofAuthorProfile,
    works: sparseAuthorWorks
  }
]

function sortedQuery(url: URL) {
  return [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
}

function requestSignature(url: URL) {
  const query = sortedQuery(url)
  return query ? `${url.pathname}?${query}` : url.pathname
}

function personFromUrl(url: string, fallbackName: string): LegacyPerson {
  const match = new URL(url, authorityOrigin).pathname.match(/^\/f%C3%B6rfattare\/([^/]+)/)
    ?? decodeURIComponent(new URL(url, authorityOrigin).pathname).match(/^\/författare\/([^/]+)/)
  const authorid = decodeURIComponent(match?.[1] ?? fallbackName.replaceAll(" ", ""))
  return {
    authorid,
    full_name: fallbackName,
    name_for_index: fallbackName,
    surname: fallbackName.split(",", 1)[0] || null
  }
}

function legacyPerson(person: FrozenWork["display_author"] | NonNullable<FrozenWork["containing_work"]>["author"]): LegacyPerson {
  return {
    authorid: person.author_id,
    full_name: person.name_for_index,
    name_for_index: person.name_for_index,
    surname: person.surname
  }
}

function startPage(url: string) {
  const match = decodeURIComponent(new URL(url, authorityOrigin).pathname).match(/\/sida\/([^/]+)\/[^/]+$/)
  return match?.[1] ?? null
}

function legacyRows(work: FrozenWork, kind: string): LegacyRow[] {
  const firstAction = work.actions[0]
  const actionPerson = personFromUrl(firstAction.url, work.display_author?.name_for_index ?? "Författare")
  const displayPerson = work.display_author ? legacyPerson(work.display_author) : actionPerson
  const base = {
    lbworkid: work.work_id,
    titlepath: work.title_path,
    titleid: work.title_id,
    work_titleid: work.title_id,
    title: work.title,
    shorttitle: work.short_title,
    sortkey: `${work.title.toLocaleLowerCase("sv")}-${work.work_id}`,
    imprintyear: work.imprint_year,
    authors: [displayPerson],
    main_author: displayPerson,
    ...(work.containing_work
      ? {
          work_authors: [legacyPerson(work.containing_work.author)],
          workshorttitle: work.containing_work.title
        }
      : {}),
    ...(kind === "about" && work.title.includes("levnadsteckning")
      ? { keyword: ["LB-författarpresentation"] }
      : {})
  }
  const readable = work.actions.filter(action => action.kind === "read")
  const rows: LegacyRow[] = readable.map(action => ({
    ...base,
    mediatype: action.media_type,
    doc_type: action.media_type,
    startpagename: startPage(action.url),
    export: []
  }))
  const realPdf = work.actions.find(action => action.kind === "download"
    && action.media_type === "pdf" && action.url.startsWith("/txt/"))
  if (realPdf) {
    rows.push({
      ...base,
      mediatype: "pdf",
      doc_type: "pdf",
      startpagename: null,
      export: []
    })
  }
  const generated = work.actions.filter(action => action.kind === "download"
    && (action.media_type === "epub" || action.url.startsWith("/export/")))
  for (const action of generated) {
    let target = rows.find(row => row.mediatype === (action.media_type === "epub" ? "etext" : "faksimil"))
      ?? rows.find(row => !row.export.length)
    if (!target) {
      target = {
        ...base,
        mediatype: action.media_type,
        doc_type: action.media_type,
        startpagename: null,
        export: []
      }
      rows.push(target)
    }
    target.export.push({ type: action.media_type, size: 1024 })
  }
  return rows
}

function expectedWorkRequests(authorId: string) {
  const shared = "exclude=text,parts,sourcedesc,pages,errata&sort_field=sortkey|desc&to=10000"
  const allTypes = "etext,faksimil,pdf,etext-part,faksimil-part"
  return [
    `/api/list_all/etext,faksimil,pdf,infopost/${authorId}?author_type=main,scholar&${shared}`,
    `/api/list_parts_in_others_works/${authorId}?sort_field=sortkey|desc`,
    ...["photographer", "illustrator", "editor", "translator"].map(authorType =>
      `/api/list_all/${allTypes}/${authorId}?author_type=${authorType}&${shared}`
    ),
    `/api/list_all/etext,faksimil,pdf,infopost/${authorId}?about_author=true&${shared}`,
    `/api/list_parts_in_others_works/${authorId}?about_author=true&sort_field=main_author.name_for_index|desc`,
    `/api/list_all/etext,faksimil,pdf/${authorId}?about_author=true&author_type=editor&${shared}`,
    `/api/list_all/etext,faksimil,pdf/${authorId}?about_author=true&author_type=translator&${shared}`
  ].map(value => requestSignature(new URL(value, authorityOrigin)))
}

function workResponses(works: FrozenWorks) {
  const requests = expectedWorkRequests(works.author.author_id)
  const sections = [...works.authored_sections, ...works.about_sections]
  return new Map(requests.map((signature, index) => [
    signature,
    sections[index].items.flatMap(item => legacyRows(item, sections[index].kind))
  ]))
}

function legacyProfile(profile: FrozenProfile, works: FrozenWorks) {
  const related = new Map(works.author.related_links.map(link => [link.label, link.url]))
  const encyclopedia = new Map(works.author.encyclopedia_links.map(link => [link.label, link.url]))
  const sbl = encyclopedia.get("Svenskt biografiskt lexikon")
  const externalReferences = works.author.related_links
    .filter(link => !["Presentation", "Bibliografi"].includes(link.label))
    .map(link => ({ label: link.label, url: link.url.replace(/^\//, "") }))
  return {
    authorid: works.author.author_id,
    authorid_norm: works.author.author_id,
    full_name: works.author.full_name,
    surname: profile.surname,
    birth: works.author.birth_year ? { plain: works.author.birth_year } : null,
    death: works.author.death_year ? { plain: works.author.death_year } : null,
    intro: works.author.has_introduction ? profile.introduction_html : null,
    intro_author: profile.introduction_by?.author_id ?? null,
    sources: [...profile.source_html],
    pseudonym: [],
    other_name: [],
    picture: Boolean(works.author.portrait),
    pictureinfo: works.author.portrait?.caption_html ?? null,
    searchable: Boolean(works.author.search_url),
    presentation: related.has("Presentation"),
    bibliography: related.has("Bibliografi"),
    external_ref: externalReferences.length ? externalReferences : null,
    wikidata: {
      sbl_link: sbl ? new URL(sbl).searchParams.get("id") : null,
      wikipedia: encyclopedia.get("Wikipedia") ?? null
    },
    dramawebben: works.author.has_dramawebben ? { intro: null } : null
  }
}

async function expectReady(page: Page, visualCase: VisualCase) {
  const sections = visualCase.page === "titlar"
    ? visualCase.works.authored_sections
    : visualCase.works.about_sections
  const populated = sections.filter(section => section.items.length)
  const rowCount = populated.reduce((count, section) => count + section.items.length, 0)
  await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
  await expect(page.locator("#mainview h1")).toContainText(visualCase.works.author.full_name)
  await expect(page.locator(".preloader")).toBeHidden()
  await expect(page.locator("#mainview > author-info-page > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".page_content")).toBeVisible()
  await expect(page.locator(".page_content h2:visible")).toHaveCount(populated.length)
  await expect(page.locator(".page_content h2:visible")).toHaveText(populated.map(section => section.label))
  await expect(page.locator(".page_content .contenttable:visible")).toHaveCount(populated.length)
  await expect(page.locator(".page_content .contenttable tr:visible")).toHaveCount(rowCount)
  await expect(page.locator("ul.links li.active")).toHaveText(visualCase.page === "titlar" ? "Verk" : [])
  if (visualCase.name === "rich-titlar") {
    await expect(page.locator(".page_content .contenttable").first().locator("td.mediatypes a"))
      .toHaveText(["etext", "faksimil", "infopost", "epub", "pdf"])
    await expect(page.locator(".page_content .contenttable tr").first()).toContainText("Röda rummet")
    await expect(page.locator(".portrait_container .author_img")).toBeVisible()
    await expect(page.locator(".ext_links")).toHaveCount(2)
  } else if (visualCase.name === "rich-mer") {
    await expect(page.locator(".page_content .contenttable tr").first())
      .toContainText("August Strindberg (1940)")
    await expect(page.locator(".portrait_container .author_img")).toHaveCount(0)
    await expect(page.locator(".ext_links")).toHaveCount(0)
  } else {
    await expect(page.locator(".page_content .contenttable tr").first())
      .toContainText("Gösta Berlings saga (1891)")
    await expect(page.locator(".page_content .contenttable tr").first()).toContainText("faksimil")
    await expect(page.locator(".portrait_container .author_img")).toBeHidden()
    await expect(page.locator(".ext_links")).toHaveCount(1)
  }
  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  expect(await page.evaluate(() => [...document.images]
    .filter(image => image.currentSrc)
    .every(image => image.complete && image.naturalWidth > 0))).toBe(true)
}

let authorityFonts: Buffer
let ordinaryBackground: Buffer
let dramawebbenBackground: Buffer
let portrait: Buffer

test.beforeAll(async () => {
  ;[authorityFonts, ordinaryBackground, dramawebbenBackground, portrait] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/forf2_bkg.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade_more.jpg")),
    readFile(resolve(import.meta.dirname, "../../app/assets/img/lagerlof_portrait.jpg"))
  ])
})

for (const visualCase of visualCases) {
  test(`captures the Angular Author Works ${visualCase.name} authority`, async ({ page }, testInfo) => {
    const profile = legacyProfile(visualCase.profile, visualCase.works)
    const expectedResponses = workResponses(visualCase.works)
    const workRequests: string[] = []
    const authorRequests: string[] = []
    const authorsRequests: string[] = []
    const mapRequests: string[] = []
    const audioRequests: string[] = []
    const managedDocumentRequests: string[] = []
    const portraitRequests: string[] = []
    const backgroundRequests: string[] = []
    const bootstrapRequests: string[] = []
    const forbiddenProductionRequests: string[] = []
    const unexpectedApplicationRequests: string[] = []
    const rejectedNegativeProbes: string[] = []
    const problems: string[] = []
    let probing = false

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (!probing && ["error", "warning"].includes(message.type())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })

    const probeUrls = [
      `${authorityOrigin}/api/list_all/etext/${encodeURIComponent(profile.authorid)}?negative=work`,
      `${authorityOrigin}/api/query/litteraturkartan?negative=auxiliary`,
      "https://litteraturbanken.se/ljudochbild/wp-json/wp/v2/pages?slug=negative&_fields=slug",
      `${authorityOrigin}/red/forfattare/${encodeURIComponent(profile.authorid_norm)}/semer/negative.html`,
      `${authorityOrigin}/red/css/negative.css`,
      `http://127.0.0.1:3000/api/v2/authors/${encodeURIComponent(profile.authorid)}/works`
    ]
    const probeSet = new Set(probeUrls)

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const decodedPathname = decodeURIComponent(url.pathname)
      const signature = requestSignature(url)
      const label = `${request.method()} ${request.url()}`

      if (request.method() === "GET" && probeSet.has(request.url())) {
        rejectedNegativeProbes.push(request.url())
        return route.abort("blockedbyclient")
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && decodedPathname === `/api/get_author/${profile.authorid}` && url.search === "") {
        authorRequests.push(signature)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: profile })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/get_authors"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["exclude", authorExclude]])) {
        authorsRequests.push(signature)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: [] })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin && expectedResponses.has(signature)) {
        workRequests.push(signature)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: expectedResponses.get(signature) })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/query/litteraturkartan") {
        const mapSearch = JSON.stringify({
          query: {
            query_string: {
              query: `status:published AND lb_author.authorid:${profile.authorid}`,
              fields: ["lb_author.authorid"]
            }
          }
        })
        const expected = requestSignature(new URL(
          `/api/query/litteraturkartan?to=0&search=${encodeURIComponent(mapSearch)}`,
          authorityOrigin
        ))
        if (signature === expected) {
          mapRequests.push(signature)
          return route.fulfill({
            status: 200,
            contentType: "application/json; charset=utf-8",
            body: JSON.stringify({ hits: visualCase.works.author.map_url ? 1 : 0 })
          })
        }
      }
      if (request.method() === "GET" && url.hostname === "litteraturbanken.se"
        && url.pathname === "/ljudochbild/wp-json/wp/v2/pages") {
        const expected = requestSignature(new URL(
          `https://litteraturbanken.se/ljudochbild/wp-json/wp/v2/pages?slug=${encodeURIComponent(profile.authorid_norm.toLowerCase())}&_fields=slug`
        ))
        if (signature === expected) {
          audioRequests.push(signature)
          return route.fulfill({
            status: 200,
            contentType: "application/json; charset=utf-8",
            body: JSON.stringify(visualCase.works.author.audio_url
              ? [{ slug: profile.authorid_norm.toLowerCase() }]
              : [])
          })
        }
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === `/red/forfattare/${profile.authorid_norm}/semer/index.html`
        && visualCase.page === "mer" && url.search === "") {
        managedDocumentRequests.push(signature)
        return route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><html><body></body></html>"
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["username", "app"]])) {
        bootstrapRequests.push(signature)
        return route.fulfill({
          status: 200,
          contentType: "application/xml; charset=utf-8",
          body: "<backgrounds />"
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && ["forf2_bkg.jpg", "dramawebben_fade_more.jpg"].some(name => url.pathname.endsWith(name))) {
        backgroundRequests.push(url.pathname)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: url.pathname.endsWith("dramawebben_fade_more.jpg")
            ? dramawebbenBackground
            : ordinaryBackground
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && visualCase.works.author.portrait && url.pathname === visualCase.works.author.portrait.url) {
        portraitRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: portrait })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/css/etext.css" && url.search === "") {
        bootstrapRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
      }
      if (request.method() === "GET" && url.hostname === "cloud.typography.com"
        && url.pathname === "/7426274/770508/css/fonts.css" && url.search === "") {
        bootstrapRequests.push(`${url.origin}${url.pathname}`)
        return route.fulfill({
          status: 200,
          contentType: "text/css; charset=utf-8",
          body: authorityFonts
        })
      }
      if (request.method() === "GET" && url.hostname === "www.googletagmanager.com"
        && url.pathname === "/gtag/js"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["id", "UA-132486790-1"]])) {
        bootstrapRequests.push(`${url.origin}${signature}`)
        return route.fulfill({
          status: 200,
          contentType: "application/javascript; charset=utf-8",
          body: ""
        })
      }
      if (url.origin !== authorityOrigin) {
        forbiddenProductionRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (restrictedPrefixes.some(prefix => url.pathname.startsWith(prefix))) {
        unexpectedApplicationRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expectReady(page, visualCase)
    await expect.poll(() => workRequests.length).toBe(10)

    const expectedAuthorSignature = requestSignature(new URL(
      `/api/get_author/${encodeURIComponent(profile.authorid)}`,
      authorityOrigin
    ))
    const expectedAuthorsSignature = requestSignature(new URL(
      `/api/get_authors?exclude=${encodeURIComponent(authorExclude)}`,
      authorityOrigin
    ))
    const expectedManaged = visualCase.page === "mer"
      ? [`/red/forfattare/${profile.authorid_norm}/semer/index.html`]
      : []
    const expectedPortrait = visualCase.page === "titlar" && visualCase.works.author.portrait
      ? [visualCase.works.author.portrait.url]
      : []

    expect(authorRequests).toEqual([expectedAuthorSignature])
    expect(authorsRequests).toEqual([expectedAuthorsSignature])
    expect(workRequests.sort()).toEqual([...expectedResponses.keys()].sort())
    expect(mapRequests).toHaveLength(1)
    expect(audioRequests).toHaveLength(1)
    expect(managedDocumentRequests).toEqual(expectedManaged)
    expect(portraitRequests).toEqual(expectedPortrait)
    expect(bootstrapRequests.sort()).toEqual([
      "/red/bilder/bakgrundsbilder/backgrounds.xml?username=app",
      "/red/css/etext.css",
      "https://cloud.typography.com/7426274/770508/css/fonts.css",
      "https://www.googletagmanager.com/gtag/js?id=UA-132486790-1"
    ].sort())
    expect(backgroundRequests.sort()).toEqual([
      "/img/dramawebben_fade_more.jpg",
      "/img/forf2_bkg.jpg",
      "/img/forf2_bkg.jpg"
    ].sort())
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(problems).toEqual([])

    probing = true
    const probeResults = await page.evaluate(async urls => await Promise.all(urls.map(async url => {
      try {
        await fetch(url)
        return true
      } catch {
        return false
      }
    })), probeUrls)
    probing = false
    expect(probeResults).toEqual(probeUrls.map(() => false))
    expect(rejectedNegativeProbes.sort()).toEqual([...probeUrls].sort())
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(problems).toEqual([])

    await page.evaluate(() => scrollTo(0, 0))
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0])
    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `author-works-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(problems).toEqual([])
  })
}
