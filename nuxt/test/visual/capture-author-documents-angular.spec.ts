import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import {
  lagerlofBibliography,
  semerAuthorDocumentAssets,
  semerAuthorDocumentDescriptor,
  soderbergPresentation
} from "../fixtures/author-document-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const audioOrigin = "https://litteraturbanken.se"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const frontendRoot = resolve(import.meta.dirname, "../../..")
const fsRoot = `/@fs${frontendRoot}`
const allowedShellStaticRequests = new Set([
  `${fsRoot}/node_modules/.vite/deps/angular-animate.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-aria.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-route.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-spinner.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-touch.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_buttons.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_collapse.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_dropdown.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_modal.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_pagination.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_popover.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_tooltip.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_typeahead.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-select2_src_select2__js.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angularjs-slider.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/bodybuilder.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-43VAUSZK.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-MSAYGMWU.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-NMJR4R66.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-O2IEGSCI.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-SX436VLB.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-UIMFB7KA.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-ZLALJZVY.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/jquery.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/lodash.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/underscore__string.js?v=d83e272d`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/position/position.css`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/tooltip/tooltip.css`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/typeahead/typeahead.css`,
  `${fsRoot}/node_modules/angularjs-slider/dist/rzslider.css`,
  `${fsRoot}/node_modules/font-awesome/fonts/fontawesome-webfont.woff2?v=4.4.0`,
  `${fsRoot}/node_modules/font-awesome/scss/font-awesome.scss`,
  `${fsRoot}/node_modules/select2/dist/css/select2.css`,
  `${fsRoot}/node_modules/vite/dist/client/env.mjs`,
  "/@vite/client",
  "/img/SA_logo_type.svg",
  "/img/SA_logo_type.svg?import&url",
  "/lib/FileSaver.js",
  "/lib/angular-ellipsis.js",
  "/lib/angular-locale_sv-se.js",
  "/lib/jquery.ui.position.js",
  "/lib/select2.js",
  "/main.js",
  "/scripts/app.js",
  "/scripts/components/about-page/index.js",
  "/scripts/components/author-info-page/index.js",
  "/scripts/components/autocomplete-global/index.js",
  "/scripts/components/contact-form/index.js",
  "/scripts/components/help-page/index.js",
  "/scripts/components/history-page/index.js",
  "/scripts/components/id-page/index.js",
  "/scripts/components/lexicon-global/index.js",
  "/scripts/components/library/downloadPopover.html?import&url",
  "/scripts/components/library/library.html?import&url",
  "/scripts/components/library/works_list.html?import&url",
  "/scripts/components/page-start/index.js",
  "/scripts/components/presentations-page/index.js",
  "/scripts/components/search/template.html?import&url",
  "/scripts/components/sla-biblinfo/index.js",
  "/scripts/components/sla-omtexterna/index.js",
  "/scripts/components/stats-page/index.js",
  "/scripts/controllers.js",
  "/scripts/directives.js",
  "/scripts/dramaweb_controller.js",
  "/scripts/features/stats/popularWorks.mjs",
  "/scripts/library_controller.js",
  "/scripts/query.ts",
  "/scripts/search_controller.js",
  "/scripts/services.js",
  "/scripts/services/backend.js",
  "/scripts/util.js",
  "/styles/bootstrap.scss",
  "/styles/styles.scss",
  "/styles/tailwind.css",
  "/views/about.html?import&url",
  "/views/authorInfo.html",
  "/views/authorInfo.html?import&url",
  "/views/contactForm.html?import&url",
  "/views/dramaweb.html?import&url",
  "/views/help.html?import&url",
  "/views/id.html?import&url",
  "/views/presentations.html?import&url",
  "/views/search.html?import&url",
  "/views/sla/biblinfo.html?import&url",
  "/views/sourceInfo.html?import&url",
  "/views/start.html?import&raw",
  "/views/stats.html?import&url"
])

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

function shellStaticKey(url: URL) {
  return `${url.pathname}${url.search}`
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

const cases = [
  {
    name: "presentation",
    route: "/författare/S%C3%B6derbergH/presentation",
    descriptor: soderbergPresentation,
    bodyFile: "SoderbergH-presentation.html",
    expectedBody: "Hjalmar Söderberg, född 1869"
  },
  {
    name: "bibliografi",
    route: "/författare/Lagerl%C3%B6fS/bibliografi",
    descriptor: lagerlofBibliography,
    bodyFile: "LagerlofS-bibliografi.html",
    expectedBody: "Selma Lagerlöf. Bibliografi"
  },
  {
    name: "semer",
    route: "/författare/AlmqvistCJL/semer",
    descriptor: semerAuthorDocumentDescriptor,
    bodyFile: "AlmqvistCJL-semer.html",
    expectedBody: "Mera om och av författaren"
  }
] as const

function legacyAuthor(documentCase: typeof cases[number]) {
  const value = documentCase.descriptor
  return {
    authorid: value.author_id,
    authorid_norm: value.normalized_author_id,
    full_name: value.full_name,
    surname: value.full_name.split(" ").at(-1),
    birth: value.birth_year ? { plain: value.birth_year } : null,
    death: value.death_year ? { plain: value.death_year } : null,
    intro: value.has_introduction ? "<p>Introduktion finns.</p>" : null,
    intro_author: null,
    sources: [],
    pseudonym: [],
    other_name: [],
    picture: false,
    pictureinfo: null,
    presentation: documentCase.name === "presentation",
    bibliography: documentCase.name === "bibliografi",
    searchable: Boolean(value.search_url),
    external_ref: null,
    wikidata: {},
    dramawebben: value.has_dramawebben ? { intro: null, sources: [] } : null
  }
}

let authorityFonts: Buffer
let ordinaryBackground: Buffer
let dramawebbenBackground: Buffer
let semerAssets: Map<string, Buffer>

test.beforeAll(async () => {
  ;[authorityFonts, ordinaryBackground, dramawebbenBackground] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/forf2_bkg.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade_more.jpg"))
  ])
  semerAssets = new Map(await Promise.all(semerAuthorDocumentAssets.map(async asset => [
    asset.path,
    await readFile(resolve(
      import.meta.dirname,
      `../fixtures/author-document-content/${asset.file}`
    ))
  ] as const)))
})

for (const documentCase of cases) {
  test(`captures the Angular ${documentCase.name} authority`, async ({ page }, testInfo) => {
    expect(testInfo.project.use.baseURL).toBe(authorityOrigin)
    const profile = legacyAuthor(documentCase)
    const body = await readFile(resolve(
      import.meta.dirname,
      `../fixtures/author-document-content/${documentCase.bodyFile}`
    ))
    const expectedWorks = expectedWorkRequests(profile.authorid)
    const mapSearch = JSON.stringify({
      query: {
        query_string: {
          query: `status:published AND lb_author.authorid:${profile.authorid}`,
          fields: ["lb_author.authorid"]
        }
      }
    })
    const expectedMapSignature = requestSignature(new URL(
      `/api/query/litteraturkartan?to=0&search=${encodeURIComponent(mapSearch)}`,
      authorityOrigin
    ))
    const expectedAudioSignature = `${audioOrigin}${requestSignature(new URL(
      `${audioOrigin}/ljudochbild/wp-json/wp/v2/pages?slug=${encodeURIComponent(profile.authorid_norm.toLowerCase())}&_fields=slug`
    ))}`
    const selectedAssets = documentCase.name === "semer"
      ? new Map(semerAssets)
      : new Map<string, Buffer>()
    const expectedShellDocument = new URL(documentCase.route, authorityOrigin)
    const authorRequests: string[] = []
    const authorsRequests: string[] = []
    const workRequests: string[] = []
    const audioRequests: string[] = []
    const mapRequests: string[] = []
    const contentRequests: string[] = []
    const assetRequests: string[] = []
    const bootstrapRequests: string[] = []
    const backgroundRequests: string[] = []
    const shellRequests: string[] = []
    const unexpectedRequests: string[] = []
    const productionRequests: string[] = []
    const rejectedNegativeProbes: string[] = []
    const problems: string[] = []
    const knownAuthorityProblems: string[] = []
    let probing = false

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (!probing && ["error", "warning"].includes(message.type())) {
        const problem = `console ${message.type()}: ${message.text()}`
        if (message.text().includes("unrecognized expression: a.footnote[href^=#ftn]")) {
          knownAuthorityProblems.push(problem)
        } else {
          problems.push(problem)
        }
      }
    })

    const negativeProbes = documentCase.name === "semer"
      ? [
          { method: "GET", url: `${authorityOrigin}/red/forfattare/AlmqvistCJL/presentation/index.html` },
          { method: "GET", url: `${authorityOrigin}/red/forfattare/WrongAuthor/semer/index.html` },
          { method: "GET", url: `${authorityOrigin}${documentCase.descriptor.source_path}?extra=1` },
          { method: "GET", url: `${authorityOrigin}/red/forfattare/AlmqvistCJL/semer/pictures/unlisted.jpg` },
          { method: "GET", url: `${authorityOrigin}/red/forfattare/AlmqvistCJL/semer/redirect` },
          {
            method: "GET",
            url: `${authorityOrigin}/api/get_authors?exclude=${encodeURIComponent(authorExclude)}` +
              `&exclude=${encodeURIComponent(authorExclude)}`
          },
          { method: "GET", url: `https://red.litteraturbanken.se${documentCase.descriptor.source_path}` },
          { method: "POST", url: `${authorityOrigin}${documentCase.descriptor.source_path}` }
        ]
      : []
    const negativeProbeLabels = negativeProbes.map(probe => `${probe.method} ${probe.url}`)
    const closedFirewallProbes = documentCase.name === "semer"
      ? [
          `${authorityOrigin}/scripts/task-4-unlisted.js`,
          `${authorityOrigin}/views/task-4-unlisted.html?import&url`,
          "http://cloud.typography.com/7426274/770508/css/fonts.css",
          "https://cloud.typography.com:444/7426274/770508/css/fonts.css",
          "http://www.googletagmanager.com/gtag/js?id=UA-132486790-1",
          "https://www.googletagmanager.com:444/gtag/js?id=UA-132486790-1"
        ]
      : []

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const label = `${request.method()} ${request.url()}`
      const decodedPathname = decodeURIComponent(url.pathname)
      const signature = requestSignature(url)

      if (request.method() === "GET" && url.origin === authorityOrigin
        && decodedPathname === `/api/get_author/${profile.authorid}` && !url.search) {
        authorRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: profile }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/get_authors"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["exclude", authorExclude]])) {
        authorsRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && expectedWorks.includes(signature)) {
        workRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && signature === expectedMapSignature) {
        mapRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hits: 0 }) })
      }
      if (request.method() === "GET" && url.origin === audioOrigin
        && `${url.origin}${signature}` === expectedAudioSignature) {
        audioRequests.push(`${url.origin}${signature}`)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(documentCase.descriptor.audio_url
            ? [{ slug: profile.authorid_norm.toLowerCase() }]
            : [])
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === documentCase.descriptor.source_path && !url.search) {
        contentRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.search === "" && selectedAssets.has(url.pathname)) {
        assetRequests.push(url.pathname)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: selectedAssets.get(url.pathname)
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["username", "app"]])) {
        bootstrapRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/css/etext.css" && !url.search) {
        bootstrapRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "text/css", body: "" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && ["/img/forf2_bkg.jpg", "/img/dramawebben_fade_more.jpg"].includes(url.pathname)
        && !url.search) {
        backgroundRequests.push(url.pathname)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: url.pathname.includes("dramawebben") ? dramawebbenBackground : ordinaryBackground
        })
      }
      if (request.method() === "GET" && url.origin === "https://cloud.typography.com"
        && url.pathname === "/7426274/770508/css/fonts.css" && url.search === "") {
        bootstrapRequests.push(`${url.origin}${url.pathname}`)
        return route.fulfill({ status: 200, contentType: "text/css", body: authorityFonts })
      }
      if (request.method() === "GET" && url.origin === "https://www.googletagmanager.com"
        && url.pathname === "/gtag/js"
        && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["id", "UA-132486790-1"]])) {
        bootstrapRequests.push(`${url.origin}${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && (url.href === expectedShellDocument.href
          || allowedShellStaticRequests.has(shellStaticKey(url)))) {
        shellRequests.push(label)
        return route.continue()
      }
      if (probing) {
        rejectedNegativeProbes.push(label)
      } else if (url.origin !== authorityOrigin) {
        productionRequests.push(label)
      } else {
        unexpectedRequests.push(label)
      }
      return route.abort("blockedbyclient")
    })

    const response = await page.goto(documentCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await expect.poll(() => unexpectedRequests).toEqual([])
    await expect(page.locator("#mainview > author-info-page > div > h1"))
      .toContainText(documentCase.descriptor.full_name)
    await expect(page.locator(".page_content .content.unbox")).toContainText(documentCase.expectedBody)
    await expect(page.locator("ul.links a")).toHaveText([
      ...(documentCase.descriptor.has_introduction ? ["Introduktion"] : []),
      "Verk",
      ...(documentCase.descriptor.audio_url ? ["Ljud"] : []),
      ...(documentCase.descriptor.has_dramawebben ? ["Dramawebben"] : []),
      ...(documentCase.descriptor.search_url ? ["Sök i texterna"] : [])
    ])
    await expect(page.locator("ul.links li.active")).toHaveCount(0)
    await expect(page.locator(".preloader")).toBeHidden()
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    if (selectedAssets.size) {
      await expect(page.locator(".page_content img")).toHaveCount(selectedAssets.size)
      expect(await page.locator(".page_content img").evaluateAll(images => images.every(image => {
        const selected = image as HTMLImageElement
        return selected.complete && selected.naturalWidth > 0 && selected.naturalHeight > 0
      }))).toBe(true)
    }

    expect(authorRequests).toEqual([`/api/get_author/${encodeURIComponent(profile.authorid)}`])
    expect(authorsRequests).toEqual([requestSignature(new URL(
      `/api/get_authors?exclude=${encodeURIComponent(authorExclude)}`,
      authorityOrigin
    ))])
    expect(workRequests.sort()).toEqual([...expectedWorks].sort())
    expect(audioRequests).toEqual([expectedAudioSignature])
    expect(mapRequests).toEqual([expectedMapSignature])
    expect(contentRequests).toEqual([documentCase.descriptor.source_path])
    expect(assetRequests.sort()).toEqual([...selectedAssets.keys()].sort())
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
    const shellUrls = shellRequests.map(label => new URL(label.replace(/^GET /, "")))
    expect(shellUrls.filter(url => url.href === expectedShellDocument.href)).toHaveLength(1)
    expect(shellUrls.filter(url => allowedShellStaticRequests.has(shellStaticKey(url)))
      .map(shellStaticKey)
      .sort()
    ).toEqual([...allowedShellStaticRequests].sort())
    expect(shellRequests).toHaveLength(allowedShellStaticRequests.size + 1)
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(knownAuthorityProblems).toHaveLength(1)
    expect(problems).toEqual([])

    probing = true
    const probeResults = await page.evaluate(async probes => await Promise.all(probes.map(
      async probe => {
        try {
          await fetch(probe.url, { method: probe.method })
          return true
        } catch {
          return false
        }
      }
    )), negativeProbes)
    probing = false
    expect(probeResults).toEqual(negativeProbes.map(() => false))
    expect(rejectedNegativeProbes.sort()).toEqual([...negativeProbeLabels].sort())
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    probing = true
    const closedFirewallResults = await page.evaluate(async urls => await Promise.all(urls.map(
      async url => {
        try {
          await fetch(url)
          return true
        } catch {
          return false
        }
      }
    )), closedFirewallProbes)
    probing = false
    expect(closedFirewallResults).toEqual(closedFirewallProbes.map(() => false))
    expect(rejectedNegativeProbes.sort()).toEqual([
      ...negativeProbeLabels,
      ...closedFirewallProbes.map(url => `GET ${url}`)
    ].sort())
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `author-document-${documentCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
