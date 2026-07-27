import { createHash } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { slaArticleFixtures } from "../fixtures/sla-article-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

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

const priorBaselineHashes = {
  "author-document-bibliografi-desktop.png": "6fecbaa1bebd416c28b47539d7fa87bbb7585458815ae731141f27e57306d34a",
  "author-document-bibliografi-mobile.png": "f1ff84fc2ed027dcfa237e083bb175c1e592e705f2043e63cdf2f2e81ee23406",
  "author-document-omtexterna-desktop.png": "28aea366a1f7ce94400b752638ed1c795043aa72d737ecaa8c2232fd52eccbb3",
  "author-document-omtexterna-mobile.png": "7caedcebe8097cc225226dcc626ff45eee777d60a95a60effd2985e3a16cbc35",
  "author-document-presentation-desktop.png": "e7ed508b2a90168c9c4542e6efb32e94656922ce4a0e28612a730662cca588e7",
  "author-document-presentation-mobile.png": "b755b3fc493e2d68d2b5e262dd636a6703a870bbc8e81276a09b103950519581",
  "author-document-semer-desktop.png": "1bf831130e8dbe685f100d6f4a28765fc0bf73c7bffd3b8c15227c3e61f8f0ca",
  "author-document-semer-mobile.png": "5bcbddbaa6abc3370a1900b833df728aeee6fa302d34454dfca271bcb1764dec"
} as const

const representativeCases = [
  ["textkritiska-riktlinjer", "TextkritiskaRiktlinjer.html", "Textkritiska riktlinjer för Selma Lagerlöf-arkivet"],
  ["introduktion", "Introduktion.html", "Introduktion"],
  ["fore-gosta-berling", "ForeGostaBerling.html", "Tiden före Gösta Berlings saga"],
  ["sprakandringar-gbs", "SprakandringarGBS.html", "Språkliga förändringar i Gösta Berlings saga"],
  ["about-archive", "AboutTheSLagerlofArchive.html", "About The Selma Lagerlöf Archive"]
] as const

const bodyAuthority = {
  "TextkritiskaRiktlinjer.html": {
    byline: "Petra Söderlund",
    tables: 0,
    footnotes: 0,
    internalLinks: 2,
    internalHash: "56c81ea154677332d90ff42137ffbf022da4a5cfe5f5be4800ceab8db7d44fa1",
    externalLinks: 0,
    externalHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    otherHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  },
  "Introduktion.html": {
    byline: "Maria Karlsson",
    tables: 0,
    footnotes: 16,
    internalLinks: 42,
    internalHash: "62eee37b09f0918f9fe314a87e293f9ccf6e818619256c17bcbe18751a0f6446",
    externalLinks: 0,
    externalHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    otherHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  },
  "ForeGostaBerling.html": {
    byline: "Lisbeth Stenberg",
    tables: 0,
    footnotes: 68,
    internalLinks: 172,
    internalHash: "5d21d677b8fcb984c010f6cceb4e08ab438bfc1a6867da499ade7509a9fcfe00",
    externalLinks: 1,
    externalHash: "ed103eb54f393cb5710b0f340f261706d83cbc27ecaf7beddf47183c4b869402",
    otherHash: "75ee8d688b058e6883d94ddf486b7c7ef3cfa21abaa53990e31139e04315af42"
  },
  "SprakandringarGBS.html": {
    byline: "Carin Östman",
    tables: 6,
    footnotes: 5,
    internalLinks: 23,
    internalHash: "6d5b13640654479c5aced7526ff1de10a0432edef429b58dd9cf0f48f79bd074",
    externalLinks: 0,
    externalHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    otherHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  },
  "AboutTheSLagerlofArchive.html": {
    byline: null,
    tables: 0,
    footnotes: 0,
    internalLinks: 8,
    internalHash: "2ca348d1899da4cc6e4c831a79f64d851248819ce04b79ba0b6b867a6656dc2e",
    externalLinks: 0,
    externalHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    otherHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  }
} as const

const immutableAuthority = {
  "TextkritiskaRiktlinjer.html": {
    domHash: "66dd9827d44d52f2206a7fe4f56588ed3666e2f5797f9ab79c7578c1a22587d3",
    textHash: "0b08414b87f14ec586c8287df3decc196dc162327cf3d4b2afa61fdefd48c40b",
    inventoryHash: "95935de328a24d6de3cf366430687a481325e7d6d178fde4b0149334cbaae01c",
    desktopHash: "999953ed4e7ea81b938709df421b0a721225eeffcf60a45c456adc3b4a176c37",
    mobileHash: "2d8326e08089ad3f172e2b7334b00b55548b5dd6d2d4e77e1f00750a5cd996f0"
  },
  "Introduktion.html": {
    domHash: "e0d917f5b8ccfdacd8f1ef6db551cc0b3cae3dfc8e003f0ba3f0153c5c6189ca",
    textHash: "e11a543c16b33e48328908b410b0742a4a99594d96b01b32a5962209e9586c36",
    inventoryHash: "d49d9e95c8b366b4a364e3df3b02abb5683e752d67dad52c1f90bd5392498680",
    desktopHash: "bf103f79c6e458a203e053365c3c4d58b6e592b5c33419e71262195c8b952bf3",
    mobileHash: "eb561ede6031885b5c0ab39f9bc8e50d76b35b46fdf2921c2c38240972d97ece"
  },
  "ForeGostaBerling.html": {
    domHash: "315ecef77f3dbb79ce7c9470516849f5f4091e359662ac3daa29e25065e03b40",
    textHash: "ea4d98e69a2dd0d0d9f9c03a4ffce1763e7d0465c44940a4458b5383a33f6cc2",
    inventoryHash: "f23c6698c230e3aa6d25a981addb73afd8860630a7d2e346028974fb30778375",
    desktopHash: "069903eb2af763abf8f41890f4e6732d97cf074964d13373f07533dd3d38cbbd",
    mobileHash: "bb10c701e03b7a560cdd5c71bdfae420c48e8bd91ccc1811977fedee7bdbdd8f"
  },
  "SprakandringarGBS.html": {
    domHash: "bd5f5c6bf97781301ab53d79bb762a0fe06c23f1383f8f0bbe99828602d2c4c5",
    textHash: "ab15594367a4dfec2115e1d7b5f80c9ae12fb120ca1f8fe79aa6d4f01269a558",
    inventoryHash: "05770b07e13cf0cc33ee9bfb12724931e54ca2f51cca73067a29f45cbeeae105",
    desktopHash: "cafd8889f88d1dc5c27675bf98bc9e2b7205f43974e65b8d70f665f8948bcd78",
    mobileHash: "78150b8fad794df1e490e8ae792876819187b4c70055acd2c978f789dbe32a0d"
  },
  "AboutTheSLagerlofArchive.html": {
    domHash: "63cb0ba77a42a2918cb4a8059caa56099af0730747e87391a4cd94a2311d1b07",
    textHash: "f4930bb6f54b2a57b900be6b3c8fe988b38a5ab6841cfcb903232645bd3c66f5",
    inventoryHash: "1d8bb20e4215e3e60810e9f1cad54a444d2e999bbedd5a210db83c8c2ccfedf8",
    desktopHash: "7c3e915ba8c4b68198e7a63927099efc0ecba6cd30583e2c2d65a975c92b110f",
    mobileHash: "ea776978c90b14d846019ad4d26d4c07eb24e7980f7c076f5af62785d0e3680d"
  }
} as const

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
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

function shellStaticKey(url: URL) {
  return `${url.pathname}${url.search}`
}

function expectedWorkRequests(authorityOrigin: string) {
  const shared = "exclude=text,parts,sourcedesc,pages,errata&sort_field=sortkey|desc&to=10000"
  const allTypes = "etext,faksimil,pdf,etext-part,faksimil-part"
  return [
    `/api/list_all/etext,faksimil,pdf,infopost/LagerlöfS?author_type=main,scholar&${shared}`,
    "/api/list_parts_in_others_works/LagerlöfS?sort_field=sortkey|desc",
    ...["photographer", "illustrator", "editor", "translator"].map(authorType =>
      `/api/list_all/${allTypes}/LagerlöfS?author_type=${authorType}&${shared}`
    ),
    `/api/list_all/etext,faksimil,pdf,infopost/LagerlöfS?about_author=true&${shared}`,
    "/api/list_parts_in_others_works/LagerlöfS?about_author=true&sort_field=main_author.name_for_index|desc",
    `/api/list_all/etext,faksimil,pdf/LagerlöfS?about_author=true&author_type=editor&${shared}`,
    `/api/list_all/etext,faksimil,pdf/LagerlöfS?about_author=true&author_type=translator&${shared}`
  ].map(value => requestSignature(new URL(value, authorityOrigin)))
}

const legacySelma = {
  authorid: "LagerlöfS",
  authorid_norm: "LagerlofS",
  full_name: "Selma Lagerlöf",
  surname: "Lagerlöf",
  birth: { plain: "1858" },
  death: { plain: "1940" },
  intro: "<p>Introduktion finns.</p>",
  intro_author: null,
  sources: [],
  pseudonym: [],
  other_name: [],
  picture: false,
  pictureinfo: null,
  presentation: false,
  bibliography: false,
  searchable: true,
  external_ref: null,
  wikidata: {},
  dramawebben: { intro: null, sources: [] }
}

let authorityFonts: Buffer
let ordinaryBackground: Buffer

test.beforeAll(async () => {
  ;[authorityFonts, ordinaryBackground] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/forf2_bkg.jpg"))
  ])
})

test("retains every prior author-document and SLA landing baseline byte", async () => {
  for (const [filename, expectedHash] of Object.entries(priorBaselineHashes)) {
    const bytes = await readFile(resolve(import.meta.dirname, `baselines/${filename}`))
    expect(sha256(bytes), filename).toBe(expectedHash)
  }
})

for (const [name, articleId, title] of representativeCases) {
  test(`captures deterministic Angular SLA article authority: ${name}`, async ({ page }, testInfo) => {
    const authorityOrigin = new URL(String(testInfo.project.use.baseURL)).origin
    const article = slaArticleFixtures.find(candidate => candidate.articleId === articleId)!
    const sourceBody = await readFile(resolve(
      import.meta.dirname,
      `../fixtures/sla-article-content/${article.file}`
    ))
    expect(sourceBody).toHaveLength(article.bytes)
    expect(sha256(sourceBody)).toBe(article.sha256)

    const routePath = `/författare/Lagerl%C3%B6fS/omtexterna/${articleId}`
    const expectedShellDocument = new URL(routePath, authorityOrigin)
    const expectedWorks = expectedWorkRequests(authorityOrigin)
    const mapSearch = JSON.stringify({
      query: {
        query_string: {
          query: "status:published AND lb_author.authorid:LagerlöfS",
          fields: ["lb_author.authorid"]
        }
      }
    })
    const expectedMapSignature = requestSignature(new URL(
      `/api/query/litteraturkartan?to=0&search=${encodeURIComponent(mapSearch)}`,
      authorityOrigin
    ))
    const expectedAudioSignature = `${audioOrigin}${requestSignature(new URL(
      `${audioOrigin}/ljudochbild/wp-json/wp/v2/pages?slug=lagerlofs&_fields=slug`
    ))}`
    const authorRequests: string[] = []
    const authorsRequests: string[] = []
    const workRequests: string[] = []
    const audioRequests: string[] = []
    const mapRequests: string[] = []
    const contentRequests: string[] = []
    const bootstrapRequests: string[] = []
    const backgroundRequests: string[] = []
    const shellRequests: string[] = []
    const unexpectedRequests: string[] = []
    const productionRequests: string[] = []
    const rejectedProbes: string[] = []
    const problems: string[] = []
    const knownSelectorWarnings: string[] = []
    let probing = false

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (!probing && ["error", "warning"].includes(message.type())) {
        const problem = `console ${message.type()}: ${message.text()}`
        if (message.text().includes("unrecognized expression: a.footnote[href^=#ftn]")) {
          knownSelectorWarnings.push(problem)
        } else {
          problems.push(problem)
        }
      }
    })

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const label = `${request.method()} ${request.url()}`
      const signature = requestSignature(url)
      let decodedPathname = url.pathname
      try {
        decodedPathname = decodeURIComponent(url.pathname)
      } catch {
        // A malformed path is rejected below by the closed firewall.
      }

      if (request.method() === "GET" && url.origin === authorityOrigin
        && decodedPathname === "/api/get_author/LagerlöfS" && !url.search) {
        authorRequests.push(signature)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: legacySelma }) })
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
          body: JSON.stringify([{ slug: "lagerlofs" }])
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === article.sourcePath && !url.search) {
        contentRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: article.mediaType, body: sourceBody })
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
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: ordinaryBackground })
      }
      if (request.method() === "GET" && url.origin === "https://cloud.typography.com"
        && url.pathname === "/7426274/770508/css/fonts.css" && !url.search) {
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
      if (probing) rejectedProbes.push(label)
      else if (url.origin !== authorityOrigin) productionRequests.push(label)
      else unexpectedRequests.push(label)
      return route.abort("blockedbyclient")
    })

    const response = await page.goto(routePath, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.site-sla.ready")).toHaveCount(1)
    expect(await page.locator("body").evaluate(body => [...body.classList]
      .filter(className => className !== "ng-scope")
      .sort()
    )).toEqual(["focus", "page-authorInfo", "ready", "site-sla"].sort())
    await expect.poll(() => unexpectedRequests).toEqual([])
    await expect(page.locator("#mainview > author-info-page > div > h1"))
      .toHaveText("Selma Lagerlöf (1858-1940)")
    await expect(page.locator("#mainview > author-info-page > div > h1")).toBeVisible()
    await expect(page.locator("#mainview > author-info-page > div > ul.links")).toBeHidden()
    await expect(page.locator("#mainview > author-info-page > div > ul.links a")).toHaveText([
      "Introduktion",
      "Verk",
      "Ljud",
      "Dramawebben",
      "Sök i texterna"
    ])
    await expect(page.locator(".portrait_container")).toHaveCount(0)
    await expect(page.locator(".preloader")).toBeHidden()
    await expect(page.locator(".logo_link_monogram .lb-logo")).toBeVisible()
    await expect(page.locator(".mainnav")).toBeVisible()
    expect(await page.title()).toBe("Selma Lagerlöf, Om texterna | Litteraturbanken")
    await expect(page.locator('meta[name="description"]'))
      .toHaveAttribute("content", "Selma Lagerlöf, Om texterna")

    const content = page.locator(".page_content > div[ng-switch-default] > .content.unbox")
    await expect(content).toHaveCount(1)
    await expect(content.getByRole("heading", { name: title, exact: true }).first()).toBeVisible()
    const expectedBody = bodyAuthority[articleId]
    if (expectedBody.byline) {
      await expect(content.locator("h3.author").first()).toHaveText(expectedBody.byline)
      await expect(content.locator("h3.author").first()).toBeVisible()
    } else {
      await expect(content.locator("h3.author")).toHaveCount(0)
    }
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    const background = await page.locator("html").evaluate(async root => {
      const backgroundImage = getComputedStyle(root).backgroundImage
      const match = backgroundImage.match(/^url\(["']?(.+?)["']?\)$/u)
      const image = new Image()
      image.src = new URL(match![1]!, document.baseURI).href
      await image.decode()
      return {
        url: image.src,
        width: image.naturalWidth,
        height: image.naturalHeight
      }
    })
    expect(background).toEqual({
      url: `${authorityOrigin}/img/forf2_bkg.jpg`,
      width: 2_464,
      height: 1_953
    })

    const rendered = await content.evaluate(root => {
      const descendants = [...root.querySelectorAll("*")]
      const hrefs = descendants
        .filter((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement)
        .filter(anchor => anchor.hasAttribute("href"))
        .map(anchor => anchor.getAttribute("href"))
      const inventory = descendants.map(element => ({
        tag: element.tagName.toLowerCase(),
        attributes: [...element.attributes]
          .map(attribute => [attribute.name, attribute.value])
          .sort(([left], [right]) => left!.localeCompare(right!)),
        children: element.children.length
      }))
      const style = getComputedStyle(root)
      return {
        html: root.innerHTML,
        text: root.textContent,
        hrefs,
        inventory,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        tables: root.querySelectorAll("table").length,
        footnoteReferences: root.querySelectorAll('a.footnote[href^="#ftn."]').length,
        footnoteTargets: root.querySelectorAll('.footnotes .footnote[id^="ftn."]').length
      }
    })
    const internalHrefs = rendered.hrefs.filter(href => href?.startsWith("/") || href?.startsWith("#"))
    const externalHrefs = rendered.hrefs.filter(href => /^https?:\/\//u.test(href ?? ""))
    const otherHrefs = rendered.hrefs.filter(href =>
      !internalHrefs.includes(href) && !externalHrefs.includes(href)
    )
    expect(rendered.hrefs).toHaveLength(article.linkCount)
    expect(sha256(JSON.stringify(rendered.hrefs))).toBe(article.linkSha256)
    expect(internalHrefs).toHaveLength(expectedBody.internalLinks)
    expect(sha256(JSON.stringify(internalHrefs))).toBe(expectedBody.internalHash)
    expect(externalHrefs).toHaveLength(expectedBody.externalLinks)
    expect(sha256(JSON.stringify(externalHrefs))).toBe(expectedBody.externalHash)
    expect(sha256(JSON.stringify(otherHrefs))).toBe(expectedBody.otherHash)
    expect(rendered.tables).toBe(expectedBody.tables)
    expect(rendered.footnoteReferences).toBe(expectedBody.footnotes)
    expect(rendered.footnoteReferences).toBe(rendered.footnoteTargets)
    expect(rendered.fontFamily).toBe('"Requiem Text A", "Requiem Text B", georgia, serif')
    expect(rendered.fontSize).toBe("20px")
    expect(rendered.lineHeight).toBe("24px")

    const firstReference = content.locator('a.footnote[href^="#ftn."]').first()
    if (rendered.footnoteReferences > 0) {
      const href = await firstReference.getAttribute("href")
      const targetId = href!.slice(1)
      const beforeContentRequests = [...contentRequests]
      const beforeScrollY = await page.evaluate(() => scrollY)
      await firstReference.click()
      await expect.poll(() => new URL(page.url()).hash).toBe(href)
      const target = page.locator(`[id="${targetId}"]`)
      await expect(target).toBeInViewport()
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(beforeScrollY)
      await expect(page.locator(".note_popover:visible")).toHaveCount(0)
      expect(contentRequests).toEqual(beforeContentRequests)
      await page.evaluate(() => {
        history.replaceState(history.state, "", `${location.pathname}${location.search}`)
        scrollTo(0, 0)
      })
    } else {
      await expect(firstReference).toHaveCount(0)
      await expect(page.locator(".note_popover:visible")).toHaveCount(0)
    }

    expect(authorRequests).toEqual(["/api/get_author/Lagerl%C3%B6fS"])
    expect(authorsRequests).toEqual([requestSignature(new URL(
      `/api/get_authors?exclude=${encodeURIComponent(authorExclude)}`,
      authorityOrigin
    ))])
    expect(workRequests.sort()).toEqual([...expectedWorks].sort())
    expect(audioRequests).toEqual([expectedAudioSignature])
    expect(mapRequests).toEqual([expectedMapSignature])
    expect(contentRequests).toEqual([article.sourcePath])
    expect(bootstrapRequests.sort()).toEqual([
      "/red/bilder/bakgrundsbilder/backgrounds.xml?username=app",
      "/red/css/etext.css",
      "https://cloud.typography.com/7426274/770508/css/fonts.css",
      "https://www.googletagmanager.com/gtag/js?id=UA-132486790-1"
    ].sort())
    expect(backgroundRequests.sort()).toEqual([
      "/img/dramawebben_fade_more.jpg",
      "/img/forf2_bkg.jpg",
      "/img/forf2_bkg.jpg",
      "/img/forf2_bkg.jpg"
    ].sort())
    const shellUrls = shellRequests.map(label => new URL(label.replace(/^GET /u, "")))
    expect(shellUrls.filter(url => url.href === expectedShellDocument.href)).toHaveLength(1)
    expect(shellUrls.filter(url => allowedShellStaticRequests.has(shellStaticKey(url)))
      .map(shellStaticKey)
      .sort()
    ).toEqual([...allowedShellStaticRequests].sort())
    expect(shellRequests).toHaveLength(allowedShellStaticRequests.size + 1)
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(knownSelectorWarnings).toHaveLength(1)
    expect(problems).toEqual([])

    const probes = [
      { method: "GET", url: `${authorityOrigin}${article.sourcePath}?authority=exact` },
      { method: "POST", url: `${authorityOrigin}${article.sourcePath}` },
      { method: "GET", url: `${authorityOrigin}/red/sla/NotRegistered.html` },
      { method: "GET", url: `${authorityOrigin}/red/sla/${articleId.toLowerCase()}` },
      { method: "GET", url: `${authorityOrigin}/red/sla/omtexterna/${articleId}` },
      { method: "GET", url: `https://red.litteraturbanken.se${article.sourcePath}` },
      { method: "GET", url: `${authorityOrigin}/scripts/task-3-unlisted.js` },
      { method: "GET", url: "http://cloud.typography.com/7426274/770508/css/fonts.css" },
      { method: "GET", url: "https://www.googletagmanager.com:444/gtag/js?id=UA-132486790-1" }
    ]
    probing = true
    const probeResults = await page.evaluate(async selected => await Promise.all(selected.map(
      async probe => {
        try {
          await fetch(probe.url, { method: probe.method })
          return true
        } catch {
          return false
        }
      }
    )), probes)
    probing = false
    expect(probeResults).toEqual(probes.map(() => false))
    expect(rejectedProbes.sort()).toEqual(probes.map(
      probe => `${probe.method} ${new URL(probe.url).href}`
    ).sort())
    expect(contentRequests).toEqual([article.sourcePath])
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    const screenshotPath = resolve(directory, `sla-article-${name}-${device}.png`)
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
    const screenshotHash = sha256(await readFile(screenshotPath))
    const expected = immutableAuthority[articleId]
    const actual = {
      domHash: sha256(rendered.html),
      textHash: sha256(rendered.text ?? ""),
      inventoryHash: sha256(JSON.stringify(rendered.inventory)),
      screenshotHash
    }
    expect(actual, `${articleId} ${device}`).toEqual({
      domHash: expected.domHash,
      textHash: expected.textHash,
      inventoryHash: expected.inventoryHash,
      screenshotHash: device === "mobile" ? expected.mobileHash : expected.desktopHash
    })
  })
}
