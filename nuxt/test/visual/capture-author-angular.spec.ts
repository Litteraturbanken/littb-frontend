import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import {
  lagerlofAuthorProfile,
  strindbergAuthorProfile
} from "../fixtures/author-profile-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const optionalListAllPrefix = "/api/list_all/"
const optionalPartsPrefix = "/api/list_parts_in_others_works/"

type FrozenProfile = typeof strindbergAuthorProfile | typeof lagerlofAuthorProfile
type LegacyAuthorProfile = ReturnType<typeof legacyProfile>
type VisualCase = {
  name: "rich" | "sparse" | "dramawebben"
  route: string
  profile: FrozenProfile
  variant: "ordinary" | "dramawebben"
}

const visualCases: VisualCase[] = [
  {
    name: "rich",
    route: "/författare/StrindbergA",
    profile: strindbergAuthorProfile,
    variant: "ordinary"
  },
  {
    name: "sparse",
    route: "/författare/Lagerl%C3%B6fS",
    profile: lagerlofAuthorProfile,
    variant: "ordinary"
  },
  {
    name: "dramawebben",
    route: "/författare/StrindbergA/dramawebben",
    profile: strindbergAuthorProfile,
    variant: "dramawebben"
  }
]

function legacyProfile(profile: FrozenProfile) {
  const related = new Map(profile.related_links.map(link => [link.label, link.url]))
  const encyclopedia = new Map(profile.encyclopedia_links.map(link => [link.label, link.url]))
  const sbl = encyclopedia.get("Svenskt biografiskt lexikon")
  const externalReferences = profile.related_links
    .filter(link => !["Presentation", "Bibliografi"].includes(link.label))
    .map(link => ({ label: link.label, url: link.url.replace(/^\//, "") }))

  return {
    authorid: profile.author_id,
    authorid_norm: profile.author_id,
    full_name: profile.full_name,
    surname: profile.surname,
    birth: profile.birth_year ? { plain: profile.birth_year } : null,
    death: profile.death_year ? { plain: profile.death_year } : null,
    intro: profile.introduction_html,
    intro_author: profile.introduction_by?.author_id ?? null,
    sources: [...profile.source_html],
    pseudonym: profile.pseudonyms.map(person => ({
      authorid: person.author_id,
      full_name: person.full_name,
      surname: person.surname
    })),
    other_name: [...profile.other_names],
    picture: Boolean(profile.portrait),
    pictureinfo: profile.portrait?.caption_html ?? null,
    searchable: Boolean(profile.search_url),
    presentation: related.has("Presentation"),
    bibliography: related.has("Bibliografi"),
    external_ref: externalReferences.length ? externalReferences : null,
    wikidata: {
      sbl_link: sbl ? new URL(sbl).searchParams.get("id") : null,
      wikipedia: encyclopedia.get("Wikipedia") ?? null
    },
    dramawebben: profile.dramawebben
      ? {
          intro: profile.dramawebben.introduction_html,
          intro_author: profile.dramawebben.introduction_by?.author_id ?? null,
          sources: [...profile.dramawebben.source_html],
          picture: Boolean(profile.dramawebben.portrait),
          picture_info: profile.dramawebben.portrait?.caption_html ?? null
        }
      : null
  }
}

function bylineAuthors(profile: FrozenProfile) {
  const people = [profile.introduction_by, profile.dramawebben?.introduction_by]
    .filter(person => person !== null && person !== undefined)
  return people.map(person => ({
    authorid: person.author_id,
    full_name: person.full_name,
    surname: person.surname
  }))
}

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

function expectedOptionalRequests(authorId: string) {
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
  ].map(signature => {
    const url = new URL(signature, authorityOrigin)
    return requestSignature(url)
  }).sort()
}

async function expectAuthorReady(page: Page, visualCase: VisualCase) {
  const profile = visualCase.profile
  await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
  await expect(page.locator("#mainview h1")).toContainText(profile.full_name)
  await expect(page.locator(".preloader")).toBeHidden()
  await expect(page.locator("#mainview > author-info-page > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".page_content")).toBeVisible()
  await expect(page.locator(".introtext")).toContainText(
    visualCase.variant === "dramawebben"
      ? "Strindberg förnyade det svenska dramat."
      : profile.full_name === "August Strindberg"
        ? "Han debuterade med Fritänkaren."
        : "Selma Lagerlöf var författare och Nobelpristagare."
  )

  if (visualCase.name === "rich") {
    await expect(page.locator(".introauthor")).toContainText("Gösta M. Bergman")
    await expect(page.locator(".source li")).toHaveCount(2)
    await expect(page.locator(".portrait_container .author_img")).toBeVisible()
    await expect(page.locator(".ext_links")).toHaveCount(2)
    await expect(page.getByRole("link", {
      name: `Texter om ${profile.full_name}`
    })).toBeVisible()
  } else if (visualCase.name === "sparse") {
    await expect(page.locator(".introauthor em")).toHaveText("")
    await expect(page.locator(".source")).toBeHidden()
    await expect(page.locator(".pseudonym")).toBeHidden()
    await expect(page.locator(".other_name")).toBeHidden()
    await expect(page.locator(".ext_links")).toHaveCount(0)
    await expect(page.locator(".portrait_container .author_img")).toBeHidden()
  } else {
    await expect(page.locator("ul.links li.active")).toHaveText("Dramawebben")
    await expect(page.locator(".introauthor")).toContainText("Dramawebbens redaktion")
    await expect(page.locator(".drama_subtitle")).toBeVisible()
    await expect(page.locator(".portrait_container .author_img")).toBeVisible()
    await expect(page.locator(".ext_links")).toHaveCount(0)
  }

  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  await expect.poll(() => page.locator(".author_img").evaluateAll(images =>
    images.filter(image => (image as HTMLImageElement).currentSrc).every(image =>
      (image as HTMLImageElement).complete
      && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
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
  test(`captures the current Angular Author ${visualCase.name} authority`, async ({
    page
  }, testInfo) => {
    const frozenProfile = visualCase.profile
    const profile = legacyProfile(frozenProfile)
    const optionalRequests: string[] = []
    const managedDocumentRequests: string[] = []
    const portraitRequests: string[] = []
    const backgroundRequests: string[] = []
    const profileRequests: string[] = []
    const bylineRequests: string[] = []
    const audioRequests: string[] = []
    const mapRequests: string[] = []
    const bootstrapRequests: string[] = []
    const forbiddenProductionRequests: string[] = []
    const unexpectedApplicationRequests: string[] = []
    const problems: string[] = []
    const allowedProblems: string[] = []
    const sparseMissingBylineWarning = "console warning: ID missing in author database: null"
    const expectedAllowedProblems = visualCase.name === "sparse"
      ? Array(7).fill(sparseMissingBylineWarning)
      : []

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        const problem = `console ${message.type()}: ${message.text()}`
        if (visualCase.name === "sparse" && problem === sparseMissingBylineWarning) {
          allowedProblems.push(problem)
        } else {
          problems.push(problem)
        }
      }
    })

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const decodedPathname = decodeURIComponent(url.pathname)
      const label = `${request.method()} ${request.url()}`

      if (request.method() === "GET" && url.origin === authorityOrigin
        && decodedPathname === `/api/get_author/${profile.authorid}` && url.search === "") {
        profileRequests.push(requestSignature(url))
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: profile })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/get_authors"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["exclude", authorExclude]])) {
        bylineRequests.push(requestSignature(url))
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: bylineAuthors(frozenProfile) })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && [optionalListAllPrefix, optionalPartsPrefix].some(prefix => decodedPathname.startsWith(prefix))) {
        optionalRequests.push(requestSignature(url))
        const isAboutWorkProbe = frozenProfile.has_more
          && decodedPathname.startsWith("/api/list_all/etext,faksimil,pdf,infopost/")
          && url.searchParams.get("about_author") === "true"
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({
            data: isAboutWorkProbe
              ? [{
                  titlepath: "ParityProbe",
                  lbworkid: "lb-parity-probe",
                  mediatype: "etext",
                  main_author: { authorid: frozenProfile.author_id },
                  work_titleid: "ParityProbe",
                  startpagename: "1",
                  imported: "1900"
                }]
              : []
          })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/query/litteraturkartan") {
        mapRequests.push(requestSignature(url))
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ hits: frozenProfile.map_url ? 1 : 0 })
        })
      }
      if (request.method() === "GET" && url.hostname === "litteraturbanken.se"
        && url.pathname === "/ljudochbild/wp-json/wp/v2/pages") {
        audioRequests.push(requestSignature(url))
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: "[]"
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === `/red/forfattare/${profile.authorid_norm}/dramawebben/index.html`
        && visualCase.variant === "dramawebben") {
        managedDocumentRequests.push(requestSignature(url))
        return route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><html><body></body></html>"
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["username", "app"]])) {
        bootstrapRequests.push(requestSignature(url))
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
        && url.pathname === (visualCase.variant === "dramawebben"
          ? `/red/forfattare/${profile.authorid_norm}/${profile.authorid_norm}_dw_large.jpeg`
          : `/red/forfattare/${profile.authorid_norm}/${profile.authorid_norm}_large.jpeg`)) {
        portraitRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: portrait })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/css/etext.css" && url.search === "") {
        bootstrapRequests.push(requestSignature(url))
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
        bootstrapRequests.push(`${url.origin}${requestSignature(url)}`)
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
      if (["/api/", "/red/", "/txt/", "/export/", "/query/", "/bilder/", "/css/", "/xhr/", "/ws/"].some(
        prefix => url.pathname.startsWith(prefix)
      )) {
        unexpectedApplicationRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expectAuthorReady(page, visualCase)
    await expect.poll(() => optionalRequests.length).toBe(10)

    expect(profileRequests).toEqual([
      requestSignature(new URL(`/api/get_author/${encodeURIComponent(profile.authorid)}`, authorityOrigin))
    ])
    expect(bylineRequests).toEqual([
      requestSignature(new URL(`/api/get_authors?exclude=${encodeURIComponent(authorExclude)}`, authorityOrigin))
    ])
    expect(optionalRequests.sort()).toEqual(expectedOptionalRequests(profile.authorid))
    const mapSearch = JSON.stringify({
      query: {
        query_string: {
          query: `status:published AND lb_author.authorid:${profile.authorid}`,
          fields: ["lb_author.authorid"]
        }
      }
    })
    expect(mapRequests).toEqual([
      requestSignature(new URL(
        `/api/query/litteraturkartan?to=0&search=${encodeURIComponent(mapSearch)}`,
        authorityOrigin
      ))
    ])
    expect(audioRequests).toEqual([
      requestSignature(new URL(
        `https://litteraturbanken.se/ljudochbild/wp-json/wp/v2/pages?slug=${encodeURIComponent(profile.authorid_norm.toLowerCase())}&_fields=slug`
      ))
    ])
    expect(managedDocumentRequests).toEqual(visualCase.variant === "dramawebben"
      ? [`/red/forfattare/${profile.authorid_norm}/dramawebben/index.html`]
      : [])
    expect(bootstrapRequests.sort()).toEqual([
      "/red/bilder/bakgrundsbilder/backgrounds.xml?username=app",
      "/red/css/etext.css",
      "https://cloud.typography.com/7426274/770508/css/fonts.css",
      "https://www.googletagmanager.com/gtag/js?id=UA-132486790-1"
    ].sort())
    expect(backgroundRequests.sort()).toEqual((visualCase.variant === "dramawebben"
      ? ["/img/dramawebben_fade_more.jpg", "/img/dramawebben_fade_more.jpg", "/img/forf2_bkg.jpg"]
      : ["/img/dramawebben_fade_more.jpg", "/img/forf2_bkg.jpg", "/img/forf2_bkg.jpg"]
    ).sort())
    expect(portraitRequests).toHaveLength(profile.picture ? 1 : 0)
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(allowedProblems).toEqual(expectedAllowedProblems)
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `author-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(allowedProblems).toEqual(expectedAllowedProblems)
    expect(problems).toEqual([])
  })
}
