import { readFileSync } from "node:fs"
import { createServer } from "node:http"

import {
  forvillelserReaderCss,
  forvillelserReaderPageHtml,
  forvillelserReaderWorkInfoResponse,
  lagerlofBibliography,
  lagerlofOmtexterna,
  semerAuthorDocumentAssets,
  semerAuthorDocumentDescriptor,
  soderbergPresentation,
  sparseDocument
} from "./author-document-data.mjs"
import { authorProfiles } from "./author-profile-data.mjs"
import {
  authorWorksById,
  malformedAuthorWorksResponse,
  unsafeUrlAuthorWorksResponse
} from "./author-works-data.mjs"
import { historyAuthorSummaries } from "./history-data.mjs"
import {
  dramawebbenCatalogAuthors,
  dramawebbenCatalogResponse
} from "./dramawebben-catalog-data.mjs"
import { libraryPdfResponse } from "./library-pdf-data.mjs"
import {
  libraryPartsResponseForQuery,
  libraryQueryStringResponse
} from "./library-query-data.mjs"
import { libraryRelevanceResponse } from "./library-relevance-data.mjs"
import { quickSearchResponse } from "./quick-search-data.mjs"
import {
  slaArticleDescriptors,
  slaArticleFixtures
} from "./sla-article-data.mjs"
import {
  editorMetadataResponse,
  editorManifestResponse,
  readerAarnsethFacsimileWorkInfoResponse,
  readerBoyeWorkInfoResponse,
  readerFacsimileJpegFile,
  readerFacsimileWorkInfoResponse,
  readerManifestResponse,
  readerPageHtmlByIndex,
  readerPartsPageHtmlByIndex,
  readerPartsWorkInfoResponse,
  readerSearchHitResponse,
  readerWorkInfoResponse,
  sharedReaderCss,
  workScopedReaderPageHtmlByIndex,
  workReaderCss
} from "./reader-data.mjs"
import {
  doktorGlasSimilarWorks,
  navigableSparseSourceInfo,
  sourceInfoByIdentity,
  sourceInfoLicenses,
  sourceInfoProvenance
} from "./reader-source-info-data.mjs"
import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"
import {
  productionSizedPresentationBackground,
  productionSizedPresentationDocument
} from "./presentation-boundary-data.mjs"
import {
  textSearchAboutAuthors,
  textSearchAuthors,
  textSearchBackgroundBase64
} from "./text-search-data.mjs"
import { workLookupResponse } from "./work-lookup-data.mjs"

const aboutContent = new Map([
  ["/red/om/ide/omlitteraturbanken.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/ide.html", import.meta.url))]],
  ["/red/om/ide/organisation.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/organisation.html", import.meta.url))]],
  ["/red/om/rattigheter/rattigheter.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/rattigheter.html", import.meta.url))]],
  ["/red/om/tack.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/tack.html", import.meta.url))]],
  ["/red/om/hjalp/hjalp.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/hjalp.html", import.meta.url))]],
  ["/red/om/visioner/visioner.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/mal.html", import.meta.url))]],
  ["/red/om/ide/english.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/english.html", import.meta.url))]],
  ["/red/om/ide/deutsch.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/deutsch.html", import.meta.url))]],
  ["/red/om/ide/francais.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/francais.html", import.meta.url))]],
  ["/red/om/rattigheter/cc_by.png", ["image/png", readFileSync(new URL("./about-content/cc_by.png", import.meta.url))]],
  ["/red/om/rattigheter/cc_publicdomain.png", ["image/png", readFileSync(new URL("./about-content/cc_publicdomain.png", import.meta.url))]]
])

const homeContent = new Map([
  ["/red/om/start/startsida-ny.html", ["text/html; charset=utf-8", readFileSync(new URL("./home-content/startsida-ny.html", import.meta.url))]],
  ["/red/css/startsida.css", ["text/css; charset=utf-8", readFileSync(new URL("./home-content/startsida.css", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg", ["image/jpeg", readFileSync(new URL("./home-content/start_bkg_172_2026.jpg", import.meta.url))]]
])

const readerFacsimileJpeg = readFileSync(readerFacsimileJpegFile)
const sourceInfoCoverIds = [
  "lb1728740",
  "lb31230",
  "lbSparse1",
  "lbLongErrata1",
  "lbHugeErrata1",
  "lbEmptyErrata1",
  "lb-dramat-002"
]
const sharedContent = new Map([
  ["/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg", ["image/jpeg", readFileSync(new URL("./library-content/biblioteket_bakgrund.jpg", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/ljudlandskap.jpg", ["image/jpeg", readFileSync(new URL("./library-content/ljudlandskap.jpg", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/sok_bkg.jpg", ["image/jpeg", Buffer.from(textSearchBackgroundBase64, "base64")]],
  ...sourceInfoCoverIds.flatMap(workId => [
    [`/txt/${workId}/${workId}_small.jpeg`, ["image/jpeg", readerFacsimileJpeg]],
    [`/txt/${workId}/${workId}_large.jpeg`, ["image/jpeg", readerFacsimileJpeg]]
  ]),
  ...Array.from({ length: 5 }, (_, index) => {
    const size = index + 1
    return [
      `/txt/lb31230/lb31230_${size}/lb31230_${size}_0001.jpeg`,
      ["image/jpeg", readerFacsimileJpeg]
    ]
  }),
  ["/red/bilder/gemensamt/gublogga.png", ["image/png", readFileSync(new URL("./about-content/cc_by.png", import.meta.url))]],
  ["/red/bilder/gemensamt/kblogga.png", ["image/png", readFileSync(new URL("./about-content/cc_by.png", import.meta.url))]],
  ["/red/bilder/gemensamt/cc-128x128.png", ["image/png", readFileSync(new URL("./about-content/cc_by.png", import.meta.url))]],
  ["/red/bilder/gemensamt/cc0-128x128.png", ["image/png", readFileSync(new URL("./about-content/cc_publicdomain.png", import.meta.url))]],
  ["/red/bilder/gemensamt/cc-pd-128x128.png", ["image/png", readFileSync(new URL("./about-content/cc_publicdomain.png", import.meta.url))]],
  ["/red/bilder/gemensamt/dramawebben_svart.svg", [
    "image/svg+xml",
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')
  ]]
])

const presentationContent = new Map([
  ["/red/presentationer/presentationerForfattare.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/presentationerForfattare.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/Censur.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/Censur.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/Rostratt.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/Rostratt.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/FigurdiktenSomBarockBlandkonst.html", import.meta.url))]],
  ["/red/presentationer/vandringar/VandringElam.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/VandringElam.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/ProductionSized.html", ["xhtml", "text/html; charset=utf-8", productionSizedPresentationDocument]],
  ["/red/bilder/bakgrundsbilder/backgrounds.xml", ["xml", "application/xml; charset=utf-8", readFileSync(new URL("./presentation-content/backgrounds.xml", import.meta.url))]],
  ["/red/presentationer/specialomraden/Rostratt.css", ["asset", "text/css; charset=utf-8", readFileSync(new URL("./presentation-content/Rostratt.css", import.meta.url))]],
  ["/app/style/litteraturbanken.css", ["asset", "text/css; charset=utf-8", readFileSync(new URL("./presentation-content/app-style-litteraturbanken.css", import.meta.url))]],
  ["/app/style/date.css", ["asset", "text/css; charset=utf-8", readFileSync(new URL("./presentation-content/app-style-date.css", import.meta.url))]],
  ...Array.from({ length: 10 }, (_, index) => [
    `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`,
    ["asset", "image/jpeg", readFileSync(new URL(`./presentation-content/burman-${index + 1}.jpg`, import.meta.url))]
  ]),
  ["/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf", ["asset", "application/pdf", readFileSync(new URL("./presentation-content/Figurdiktensombarockblandkonst.pdf", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/rostratt_a.jpg", ["asset", "image/jpeg", readFileSync(new URL("./presentation-content/rostratt-a.jpg", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/rostratt_b.jpg", ["asset", "image/jpeg", readFileSync(new URL("./presentation-content/rostratt-b.jpg", import.meta.url))]]
])

const authorDocumentContent = new Map([
  [
    soderbergPresentation.source_path,
    readFileSync(new URL("./author-document-content/SoderbergH-presentation.html", import.meta.url))
  ],
  [
    lagerlofBibliography.source_path,
    readFileSync(new URL("./author-document-content/LagerlofS-bibliografi.html", import.meta.url))
  ],
  [
    lagerlofOmtexterna.source_path,
    readFileSync(new URL("./author-document-content/LagerlofS-omtexterna.html", import.meta.url))
  ],
  [
    semerAuthorDocumentDescriptor.source_path,
    readFileSync(new URL("./author-document-content/AlmqvistCJL-semer.html", import.meta.url))
  ],
  [
    sparseDocument.source_path,
    readFileSync(new URL("./author-document-content/sparse.html", import.meta.url))
  ]
])
const dramawebbenDocumentContent = new Map([
  [
    "/red/dramawebben/om.html",
    readFileSync(new URL("./dramawebben-content/om.html", import.meta.url))
  ],
  [
    "/red/dramawebben/kringtexter/kringtexter.html",
    readFileSync(new URL("./dramawebben-content/kringtexter.html", import.meta.url))
  ]
])
const maliciousDramawebbenDocument = Buffer.from([
  "<!doctype html><html><head><title>upstream-payload-probe</title></head><body>",
  '<div class="safe\u0085unsafe" id="drop" onclick="bad()">safe-visible-probe</div>',
  '<a href="javascript:alert(1)">unsafe-js-link</a>',
  '<a href="data:text/html,evil">unsafe-data-link</a>',
  '<a href="http://evil.test/path">unsafe-http-link</a>',
  '<a href="/%252e%252e/private">unsafe-traversal-link</a>',
  '<a href="https://example.test/safe" target="_blank" rel="external unsafe_token">blank-probe</a>',
  "<!-- comment-probe --><script>script-probe</script>",
  "<form><p>form-probe</p></form><svg><text>svg-probe</text></svg>",
  "</body></html>"
].join(""))
const oversizedDramawebbenPrefix = Buffer.from("<!doctype html><html><body><p>")
const oversizedDramawebbenSuffix = Buffer.from(
  "upstream-payload-probe</p></body></html>"
)
const oversizedDramawebbenDocument = Buffer.concat([
  oversizedDramawebbenPrefix,
  Buffer.alloc(
    262_145 - oversizedDramawebbenPrefix.length - oversizedDramawebbenSuffix.length,
    "x"
  ),
  oversizedDramawebbenSuffix
])
const authorDocumentAssets = new Map(semerAuthorDocumentAssets.map(asset => [
  asset.path,
  readFileSync(new URL(`./author-document-content/${asset.file}`, import.meta.url))
]))
const malformedAuthorDocumentContent = "<html><head><title>Malformed</title></head></html>"
const oversizedAuthorDocumentPrefix = Buffer.from("<html><body>")
const oversizedAuthorDocumentSuffix = Buffer.from(
  "upstream-provider-payload-probe</body></html>"
)
const oversizedAuthorDocumentContent = Buffer.concat([
  oversizedAuthorDocumentPrefix,
  Buffer.alloc(
    1_048_577 - oversizedAuthorDocumentPrefix.length - oversizedAuthorDocumentSuffix.length,
    "x"
  ),
  oversizedAuthorDocumentSuffix
])
const oversizedSlaAuthorDocumentPrefix = Buffer.from("<!doctype html><html><body><p>")
const oversizedSlaAuthorDocumentSuffix = Buffer.from(
  "upstream-provider-payload-probe</p></body></html>"
)
const oversizedSlaAuthorDocumentContent = Buffer.concat([
  oversizedSlaAuthorDocumentPrefix,
  Buffer.alloc(
    262_145 - oversizedSlaAuthorDocumentPrefix.length
      - oversizedSlaAuthorDocumentSuffix.length,
    "x"
  ),
  oversizedSlaAuthorDocumentSuffix
])
const exactSlaArticlePrefix = Buffer.from(
  "<!doctype html><html><body><p>cap-boundary-start"
)
const exactSlaArticleSuffix = Buffer.from(
  "cap-boundary-end</p></body></html>"
)
const exactSlaArticleContent = Buffer.concat([
  exactSlaArticlePrefix,
  Buffer.alloc(
    262_144 - exactSlaArticlePrefix.length - exactSlaArticleSuffix.length,
    "x"
  ),
  exactSlaArticleSuffix
])
const authorDocumentPdf = readFileSync(
  new URL("./presentation-content/Figurdiktensombarockblandkonst.pdf", import.meta.url)
)
const authorDocumentPdfs = new Map([
  [
    "/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf",
    "attachment; filename=\"SoderbergH_presentation.pdf\""
  ],
  [
    "/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf",
    "inline; filename=\"LagerlofS_bibliografi.pdf\""
  ]
])
const authorDocumentDescriptors = new Map([
  [`${soderbergPresentation.author_id}|${soderbergPresentation.document_kind}`, soderbergPresentation],
  [`${lagerlofBibliography.author_id}|${lagerlofBibliography.document_kind}`, lagerlofBibliography],
  [`${lagerlofOmtexterna.author_id}|${lagerlofOmtexterna.document_kind}`, lagerlofOmtexterna],
  [`${semerAuthorDocumentDescriptor.author_id}|${semerAuthorDocumentDescriptor.document_kind}`, semerAuthorDocumentDescriptor],
  [`${sparseDocument.author_id}|${sparseDocument.document_kind}`, sparseDocument]
])
const slaArticleContent = new Map(slaArticleFixtures.map(article => [
  article.sourcePath,
  readFileSync(new URL(`./sla-article-content/${article.file}`, import.meta.url))
]))
const slaArticleDescriptorMap = new Map(Object.entries(slaArticleDescriptors))

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const redirectTargetPort = port + 1
const redirectTargetOrigin = `http://127.0.0.1:${redirectTargetPort}`
let requests = []
let observabilityRequests = []
let contactSubmissions = []
let deferContactSubmissions = false
let pendingContactReleases = []
let failure = null
let quickSearchQueries = []
let quickSearchFailure = false
let quickSearchDelays = {}
let workLookupRequests = []
let workLookupFailure = false
let workLookupDelays = {}
let authorResolveRequests = []
let authorResolveFailure = false
let authorResolveDelays = {}
let authorResolveScenario = null
let sourceInfoRequests = []
let sourceInfoStaticRequests = []
let sourceInfoFailure = false
let sourceInfoDelays = {}
let sourceInfoStaticFailure = null
let similarWorkRequests = []
let similarWorkFailure = false
let similarWorkMalformed = false
let authorProfileRequests = []
let authorProfileFailure = false
let malformedAuthorProfileIdentity = false
let bibliographyRequests = []
let dictionaryRequests = []
let bibliographyFailure = false
let bibliographyDisconnect = false
let bibliographyDelays = {}
let authorWorksRequests = []
let authorWorksFailures = new Set()
let authorWorksDelays = {}
let homeRequests = []
let homeFailure = false
let homeHostileBackground = false
let presentationRequests = []
let presentationFailures = new Set()
let presentationProductionShape = false
let presentationHostileSubresources = false
let litteraturkartanRequests = []
let readerRequests = []
let readerMetadataRequests = []
let readerHtmlRequests = []
let readerOcrRequests = []
let readerJpegRequests = []
let readerMetadataDelays = {}
let readerManifestDelays = {}
let readerManifestRequests = []
let editorManifestRequests = []
let editorFacsimileRequests = []
let editorMetadataFailure = false
let readerHitRequests = []
let readerHitFailure = false
let readerHitDelays = {}
let exportFaksimilRequests = []
let libraryRelevanceRequests = []
let libraryRelevanceFailure = false
let libraryRelevanceDelays = {}
let libraryQueryRequests = []
let libraryQueryFailure = false
let libraryQueryDelays = {}
const defaultLibraryImprintRange = {
  start_year: { value_as_string: "1800" },
  end_year: { value_as_string: "2026" }
}
let libraryImprintRange = structuredClone(defaultLibraryImprintRange)
let libraryImprintFailure = false
let libraryImprintRequests = []
let libraryMetadataRequests = []
let libraryMetadataVariant = "normal"
let libraryDownloadRequests = []
let libraryV2Requests = { options: [], search: [], counts: [] }
let libraryV2Failures = {
  options: new Set(),
  search: new Set(),
  counts: new Set()
}
let libraryV2Delays = { options: 0, search: {}, counts: {} }
let authorDocumentRequests = []
let authorDocumentAssetRequests = []
let authorDocumentFailure = null
let authorDocumentDelay = 0
let legacyAuthorRouteRequests = []
let legacyAuthorRouteFailure = null
let legacyDramawebbenRouteRequests = []
let legacyDramawebbenRouteFailure = null
let legacyDramawebbenRouteLocation = null
let legacyDramawebbenRedirectTargetRequests = []
let authorDocumentPdfRequests = []
let authorDocumentRedirectTargetRequests = []
let dramawebbenDocumentRequests = []
let dramawebbenDocumentFailure = null
let dramawebbenDocumentRedirectTargetRequests = []
let dramawebbenExcludedDataRequests = []
let dramawebbenCatalogRequests = []
let dramawebbenCatalogFailure = null
let slaExcludedDataRequests = []
let slaArticleDescriptorRequests = []
let slaArticleSourceRequests = []
let slaArticleDescriptorFailure = null
let slaArticleSourceFailure = null
let slaArticleRedirectTargetRequests = []
let slaArticleSourceCancellations = []
let slaArticleRequestHeaders = { descriptor: [], source: [] }
let textSearchRequests = { results: [], count: [], options: [], chronology: [] }
let textSearchFailures = new Set()
let textSearchDelays = { results: {}, count: {}, options: {}, chronology: {} }
let textSearchAuthorityMode = false

const bibliographyEntries = [
  {
    resource: "manus",
    title: "Gösta Berlings saga",
    isbn: "978-00-1",
    issn: "",
    archive: "SE/ULA/123"
  },
  {
    resource: "tryckt_material",
    title: "En herrgårdssägen",
    isbn: null,
    issn: "1400-0001",
    archive: null
  },
  {
    resource: "forskning",
    title: "Jerusalem i forskningen",
    isbn: "978-00-3",
    issn: null,
    archive: "SE/KB/456"
  }
]

const textSearchOperations = new Set(["results", "count", "options", "chronology"])

const errorByResource = {
  stats: ["stats_unavailable", "Unable to load statistics"],
  works: ["popular_works_unavailable", "Unable to load popular works"],
  epubs: ["popular_epubs_unavailable", "Unable to load popular EPUBs"]
}

const libraryQueryPaths = new Set([
  "/api/query_string/etext,faksimil,pdf",
  "/legacy-api/query_string/etext,faksimil,pdf",
  "/api/query_string/etext-part,faksimil-part",
  "/legacy-api/query_string/etext-part,faksimil-part"
])
const libraryPdfPredicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
const libraryQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
const libraryAuthorExcludeValues = new Set([
  "intro,db_*",
  "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
])
const dramawebbenExcludedDataPaths = new Set([
  "/api/get_authors",
  "/api/list_all/etext,faksimil,pdf,infopost"
])

const dramawebbenMediaPriority = ["etext", "faksimil", "pdf", "infopost"]

function dramawebbenCatalogAuthor(author) {
  return {
    author_id: author.authorid,
    full_name: author.full_name,
    name_for_index: author.name_for_index,
    surname: author.surname ?? null,
    gender: author.gender ?? null,
    birth_year: author.birth?.plain ?? null,
    death_year: author.death?.plain ?? null
  }
}

function dramawebbenCatalogMedia(row) {
  const mediaType = row.mediatype
  const authorId = row.authors[0].authorid
  let url
  if (mediaType === "pdf") {
    const workId = encodeURIComponent(row.lbworkid)
    url = `/txt/${workId}/${workId}.pdf`
  } else if (mediaType === "infopost") {
    url = "/dramawebben/pj%C3%A4ser?om-boken"
      + `&authorid=${encodeURIComponent(authorId)}`
      + `&titlepath=${encodeURIComponent(row.titlepath)}`
  } else {
    url = `/författare/${encodeURIComponent(authorId)}`
      + `/titlar/${encodeURIComponent(row.titleid)}`
      + `/sida/${encodeURIComponent(row.startpagename)}/${mediaType}`
  }
  return {
    media_type: mediaType,
    url,
    downloadable: mediaType === "pdf"
  }
}

function dramawebbenCatalogFixture() {
  const authors = dramawebbenCatalogAuthors.map(dramawebbenCatalogAuthor)
  const groups = new Map()
  for (const row of dramawebbenCatalogResponse.data) {
    const key = `${row.titlepath}\u0000${row.lbworkid}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const works = [...groups.values()].map(rows => {
    const ordered = [...rows].sort((left, right) => (
      dramawebbenMediaPriority.indexOf(left.mediatype)
      - dramawebbenMediaPriority.indexOf(right.mediatype)
    ))
    const main = ordered[0]
    const dramawebben = main.dramawebben ?? {}
    const optionalInteger = field => {
      const value = dramawebben[field]
      return value === undefined || value === null ? null : Number(value)
    }
    return {
      work_id: main.lbworkid,
      title_path: main.titlepath,
      title: main.title,
      short_title: main.shorttitle ?? null,
      authors: main.authors.map(dramawebbenCatalogAuthor),
      media: ordered.map(dramawebbenCatalogMedia),
      is_childrens_play: main.keyword?.includes("Barnlitteratur") ?? false,
      number_of_acts: optionalInteger("number_of_acts"),
      number_of_roles: optionalInteger("number_of_roles"),
      number_of_pages: optionalInteger("number_of_pages"),
      female_roles: optionalInteger("female_roles"),
      male_roles: optionalInteger("male_roles"),
      other_roles: optionalInteger("other_roles")
    }
  })
  return { works, authors }
}

function isSlaExcludedDataPath(pathname) {
  return pathname === "/api/get_author/Lagerl%C3%B6fS"
    || pathname === "/api/get_authors"
    || /^\/api\/list_all\/[^/]+\/Lagerl%C3%B6fS$/.test(pathname)
    || pathname === "/api/list_parts_in_others_works/Lagerl%C3%B6fS"
    || pathname === "/api/query/litteraturkartan"
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type"
  })
  response.end(JSON.stringify(body))
}

function sendBody(response, status, contentType, body, headers = {}) {
  response.writeHead(status, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    ...headers
  })
  response.end(body)
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}
}

async function readText(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

function waitForContactRelease(submission) {
  if (!deferContactSubmissions) return Promise.resolve({ failure: false })
  return new Promise(resolve => pendingContactReleases.push({ resolve, submission }))
}

function releaseContactSubmissions() {
  deferContactSubmissions = false
  const releases = pendingContactReleases
  pendingContactReleases = []
  for (const release of releases) release.resolve({ failure: false })
}

function waitForQuickSearchDelay(query) {
  const delay = quickSearchDelays[query] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function waitForWorkLookupDelay(body) {
  const delay = workLookupDelays[JSON.stringify(body)] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function waitForAuthorResolveDelay(body) {
  const delay = authorResolveDelays[JSON.stringify(body)] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function waitForSourceInfoDelay(authorId, titlePath) {
  const delay = Number(sourceInfoDelays[`${authorId}|${titlePath}`] || 0)
  return delay > 0 ? new Promise(resolve => setTimeout(resolve, delay)) : Promise.resolve()
}

function waitForAuthorWorksDelay(authorId) {
  return new Promise(resolve => setTimeout(resolve, authorWorksDelays[authorId] || 0))
}

function waitForLibraryRelevanceDelay(query) {
  const exactKey = `${query.q || ""}|${query.sort_field || ""}`
  const delay = libraryRelevanceDelays[exactKey] || libraryRelevanceDelays[query.q || ""] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function waitForLibraryQueryDelay(query) {
  const key = [query.q || "", query.sort_field || "", query.from || "", query.to || ""].join("|")
  return new Promise(resolve => setTimeout(resolve, libraryQueryDelays[key] || 0))
}

function isLibraryPdfQuery(query) {
  const value = query.q || ""
  return value === `${libraryQueryPrefix} (${libraryPdfPredicate})`
    || (
      value.startsWith(`${libraryQueryPrefix} (${libraryPdfPredicate} AND (`)
      && value.endsWith("))")
    )
}

function readerHitDelayKey(input) {
  return [
    input.workId,
    input.query,
    input.offset,
    input.limit,
    input.wordForms,
    input.includeOlderSpellings,
    input.prefix,
    input.suffix
  ].join("|")
}

function waitForReaderHitDelay(input) {
  return new Promise(resolve => setTimeout(
    resolve,
    readerHitDelays[readerHitDelayKey(input)] || 0
  ))
}

function waitForReaderMetadataDelay(titlePath) {
  return new Promise(resolve => setTimeout(resolve, readerMetadataDelays[titlePath] || 0))
}

function waitForReaderManifestDelay(titlePath) {
  return new Promise(resolve => setTimeout(resolve, readerManifestDelays[titlePath] || 0))
}

function waitForAuthorDocumentDelay() {
  return new Promise(resolve => setTimeout(resolve, authorDocumentDelay))
}

function textSearchSelector(operation, body) {
  if (operation === "chronology") return ""
  return operation === "options" ? body.title_filter : body.query
}

function waitForTextSearchDelay(operation, body) {
  const selector = textSearchSelector(operation, body)
  const scopedSelector = operation === "results" && !body.facet_author_id
    ? `${selector}:unfiltered`
    : null
  const delay = (scopedSelector && textSearchDelays[operation][scopedSelector])
    || textSearchDelays[operation][selector]
    || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function readerRepresentation(titlePath, overrides = {}) {
  const representation = structuredClone(readerWorkInfoResponse.data[0])
  if (Object.hasOwn(overrides, "pages") && !Object.hasOwn(overrides, "parts")) {
    representation.parts = []
    delete representation.endpagename
  }
  return {
    ...representation,
    shorttitle: titlePath,
    title: `${titlePath}. Roman`,
    titlepath: titlePath,
    ...overrides
  }
}

function readerFacsimileRepresentation(titlePath, overrides = {}) {
  const representation = structuredClone(readerFacsimileWorkInfoResponse.data[0])
  return {
    ...representation,
    shorttitle: titlePath,
    title: `${titlePath}. Roman`,
    titlepath: titlePath,
    ...overrides
  }
}

function readerPartsRepresentation(titlePath, overrides = {}) {
  const representation = structuredClone(readerPartsWorkInfoResponse.data[0])
  return {
    ...representation,
    shorttitle: titlePath,
    title: `${titlePath}. Roman`,
    titlepath: titlePath,
    ...overrides
  }
}

function readerLocalPartAuthorRepresentation(titlePath, author) {
  const representation = structuredClone(readerPartsWorkInfoResponse.data[0])
  return readerPartsRepresentation(titlePath, {
    authors: [representation.authors[0], author],
    parts: [{
      ...representation.parts[0],
      authors: [{ authorid: author.authorid }]
    }]
  })
}

function readerMetadataResponse(titlePath) {
  switch (titlePath) {
    case "DoktorGlas": {
      const etext = readerRepresentation(titlePath, {
        editor_lbworkid: "lb-editor-doktor-glas",
        shorttitle: "Doktor Glas",
        title: "Doktor Glas. Roman",
        urn: "urn:nbn:se:lb-lb-reader-doktor-glas"
      })
      const faksimil = readerFacsimileRepresentation(titlePath, {
        authors: structuredClone(etext.authors),
        endpagename: "-1",
        lbworkid: etext.lbworkid,
        pages: [
          { pagename: "-3", pageindex: 1, imagenumber: 1 },
          { pagename: "-2", pageindex: 2, imagenumber: 2 },
          { pagename: "-1", pageindex: 3, imagenumber: 3 }
        ],
        parts: structuredClone(etext.parts),
        shorttitle: etext.shorttitle,
        startpagename: "-2",
        title: etext.title,
        titlepath: etext.titlepath
      })
      return { hits: 2, data: [etext, faksimil] }
    }
    case "Rallarliv":
      return { hits: 0, data: [] }
    case "NyaVagarReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { keyword: ["1800"] })]
      }
    case "DoktorGlasParts":
      return readerPartsWorkInfoResponse
    case "SparseKeyboardReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          endpagename: "57",
          lbworkid: "lb-reader-sparse-keyboard",
          page_count: 58,
          pages: [
            { pagename: "2", pageindex: 2 },
            { pagename: "12", pageindex: 12 },
            { pagename: "57", pageindex: 57 }
          ],
          parts: [],
          startpagename: "2"
        })]
      }
    case "CountedSliderReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          page_count: 4,
          pages: [
            { pagename: "0", pageindex: 0 },
            { pagename: "-3", pageindex: 1 },
            { pagename: "-2", pageindex: 2 },
            { pagename: "-1", pageindex: 3 }
          ]
        })]
      }
    case "InvalidCountSliderReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          endpagename: "57",
          lbworkid: "lb-reader-sparse-keyboard",
          page_count: 57,
          pages: [
            { pagename: "2", pageindex: 2 },
            { pagename: "12", pageindex: 12 },
            { pagename: "57", pageindex: 57 }
          ],
          parts: [],
          startpagename: "2"
        })]
      }
    case "OnePageSliderReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          endpagename: "0",
          lbworkid: "lb-reader-one-page",
          page_count: 1,
          pages: [{ pagename: "0", pageindex: 0 }],
          parts: [],
          startpagename: "0"
        })]
      }
    case "PartlessReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { endpagename: "-1", parts: [] })]
      }
    case "UnsearchableEtextReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { searchable: false })]
      }
    case "UnsearchableFacsimileReader":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, { searchable: false })]
      }
    case "ReaderAuthorOmission":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: [{
            ...structuredClone(readerPartsWorkInfoResponse.data[0].parts[0]),
            authors: [{ authorid: "MissingSummaryAuthor" }]
          }]
        })]
      }
    case "ReaderAuthorNullSurname":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: [{
            ...structuredClone(readerPartsWorkInfoResponse.data[0].parts[0]),
            authors: [{ authorid: "NullSurnameAuthor" }]
          }]
        })]
      }
    case "ReaderLocalWhitespaceName":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: "MörikeE",
          full_name: " Eduard Mörike",
          surname: "Mörike"
        })]
      }
    case "ReaderLocalControlName":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: "MörikeE",
          full_name: "Eduard\nMörike",
          surname: "Mörike"
        })]
      }
    case "ReaderLocalWhitespaceSurname":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: "MörikeE",
          full_name: "Eduard Mörike",
          surname: " Mörike"
        })]
      }
    case "ReaderLocalControlSurname":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: "MörikeE",
          full_name: "Eduard Mörike",
          surname: "Mörike\n"
        })]
      }
    case "ReaderMatchingWhitespaceAuthorId":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: " MörikeE",
          full_name: "Eduard Mörike",
          surname: "Mörike"
        })]
      }
    case "ReaderMatchingControlAuthorId":
      return {
        hits: 1,
        data: [readerLocalPartAuthorRepresentation(titlePath, {
          authorid: "MörikeE\n",
          full_name: "Eduard Mörike",
          surname: "Mörike"
        })]
      }
    case "ReaderUnsafePartAuthor":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: [{
            ...structuredClone(readerPartsWorkInfoResponse.data[0].parts[0]),
            authors: [{ authorid: " unsafe " }]
          }]
        })]
      }
    case "ReaderTooManyAuthors":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: Array.from({ length: 51 }, (_, index) => ({
            authors: [{ authorid: `UnresolvedAuthor${index}` }],
            endpagename: "-4",
            navtitle: `Del ${index}`,
            shorttitle: `Del ${index}`,
            startpagename: "-4",
            title: `Del ${index}`,
            titleid: `part-${index}`
          }))
        })]
      }
    case "MalformedPartsReader":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, { parts: {} })]
      }
    case "UnknownPartPageReader":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: [{
            ...structuredClone(readerPartsWorkInfoResponse.data[0].parts[0]),
            startpagename: "missing"
          }]
        })]
      }
    case "ReversedPartReader":
      return {
        hits: 1,
        data: [readerPartsRepresentation(titlePath, {
          parts: [{
            ...structuredClone(readerPartsWorkInfoResponse.data[0].parts[0]),
            startpagename: "1",
            endpagename: "-4"
          }]
        })]
      }
    case "GostaBerlingsSaga":
      return readerFacsimileWorkInfoResponse
    case "SparseFacsimileSizes":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, {
          faksimil_sizes: [1, 3],
          lbworkid: "lb-reader-sparse-facsimile-sizes"
        })]
      }
    case "EttVerkligtJordiskt":
      return readerBoyeWorkInfoResponse
    case "Affarer":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, {
          authors: [{
            authorid: "AlmlöfN",
            full_name: "Nils Almlöf",
            surname: "Almlöf"
          }],
          endpagename: "-1",
          imprintyear: "1905",
          lbworkid: "lb31230",
          page_count: 2,
          pages: [
            { pagename: "-2", pageindex: 1, imagenumber: 1 },
            { pagename: "-1", pageindex: 2, imagenumber: 2 }
          ],
          parts: [{
            authors: [{ authorid: "AlmlöfN" }],
            endpagename: "-1",
            navtitle: "Affärer",
            shorttitle: "Affärer",
            startpagename: "-2",
            title: "Affärer",
            titleid: "Affarer"
          }],
          shorttitle: "Affärer",
          sort_date_imprint: { plain: "1905" },
          startpagename: "-2",
          texttype: "drama",
          title: "Affärer",
          dramawebben: {}
        })]
      }
    case "SparseTitle":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{
            authorid: "SparseA",
            full_name: "Sparsamt Författarnamn",
            surname: "Författarnamn"
          }],
          parts: [],
          shorttitle: "Glest verk",
          title: "Glest verk",
          texttype: null
        })]
      }
    case "LongErrata":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{
            authorid: "LongErrataA",
            full_name: "Rita Redaktör",
            surname: "Redaktör",
            type: "editor"
          }],
          shorttitle: "Lång errata",
          title: "Lång errata"
        })]
      }
    case "HugeErrata":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{
            authorid: "HugeErrataA",
            full_name: "Hugo Granskare",
            surname: "Granskare",
            type: "editor"
          }],
          shorttitle: "Omfattande errata",
          title: "Omfattande errata"
        })]
      }
    case "EmptyErrata":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{
            authorid: "EmptyErrataA",
            full_name: "Erik Exempel",
            surname: "Exempel"
          }],
          parts: [],
          shorttitle: "Tom errata",
          title: "Tom errata"
        })]
      }
    case "MalformedFacsimileImageReader":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, {
          pages: [
            { pagename: "1", pageindex: 0, imagenumber: 7 },
            { pagename: "3", pageindex: 1, imagenumber: "9" },
            { pagename: "5", pageindex: 2, imagenumber: 12 }
          ]
        })]
      }
    case "MalformedFacsimileSizesReader":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, {
          faksimil_sizes: [0, 2, 2]
        })]
      }
    case "MalformedFacsimileWidthReader":
      return {
        hits: 1,
        data: [readerFacsimileRepresentation(titlePath, {
          width: { size_2: 450, size_3: 0, size_4: 900, size_5: 1250 }
        })]
      }
    case "Förvillelser":
      return forvillelserReaderWorkInfoResponse
    case "WorkScopedIdsReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          lbworkid: "lb7604979",
          pages: [
            { pagename: "-2", pageindex: 13 },
            { pagename: "-1", pageindex: 14 }
          ],
          startpagename: "-2"
        })]
      }
    case "Rfc!Reader'()*":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{ authorid: "O'Neil!()*A", full_name: "RFC Reader" }],
          pages: [{ pagename: "-2!'()*", pageindex: 2 }],
          startpagename: "-2!'()*"
        })]
      }
    case "RodaRummet":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{
            authorid: "StrindbergA",
            full_name: "August Strindberg",
            surname: "Strindberg"
          }],
          lbworkid: "lb238704",
          pages: [{ pagename: "1", pageindex: 1 }],
          shorttitle: "Röda rummet",
          startpagename: "1"
        })]
      }
    case "SiblingPagesReader": {
      const sharedWorkId = "lb-reader-doktor-glas"
      const etext = readerRepresentation(titlePath, {
        lbworkid: sharedWorkId,
        pages: undefined
      })
      const faksimil = readerRepresentation(titlePath, {
        lbworkid: sharedWorkId,
        mediatype: "faksimil"
      })
      return { hits: 2, data: [etext, faksimil] }
    }
    case "MissingReader":
      return readerWorkInfoResponse
    case "NoRequestedMediaReader":
    case "MediaMismatchReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { mediatype: "faksimil" })]
      }
    case "WrongAuthorReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{ authorid: "OtherAuthor", full_name: "Other Author" }]
        })]
      }
    case "MissingStartReader": {
      const representation = readerRepresentation(titlePath)
      delete representation.startpagename
      return { hits: 1, data: [representation] }
    }
    case "MalformedStartReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { startpagename: 2 })]
      }
    case "OutOfListStartReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { startpagename: "99" })]
      }
    case "MalformedPagesReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, { pages: "malformed" })]
      }
    case "NullPageIndexReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          pages: [{ pagename: "-2", pageindex: null }]
        })]
      }
    case "FalsePageIndexReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          pages: [{ pagename: "-2", pageindex: false }]
        })]
      }
    case "EmptyPageIndexReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          pages: [{ pagename: "-2", pageindex: "" }]
        })]
      }
    case "StringPageIndexReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          pages: [{ pagename: "-2", pageindex: "2" }]
        })]
      }
    case "UnsafePageIndexReader":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          pages: [{ pagename: "-2", pageindex: Number.MAX_SAFE_INTEGER + 1 }]
        })]
      }
    case "MalformedReader":
      return { hits: 1, data: "malformed" }
    default:
      return readerWorkInfoResponse
  }
}

function validationError(response) {
  return sendJson(response, 422, {
    error: {
      code: "validation_error",
      message: "Request validation failed",
      details: null
    }
  })
}

function methodNotAllowed(response, allowed) {
  response.setHeader("allow", allowed.join(", "))
  return sendJson(response, 405, {
    error: {
      code: "method_not_allowed",
      message: "Method not allowed",
      details: null
    }
  })
}

const textSearchCategories = new Set([
  "texttype:brev;brevsamling", "texttype:drama;dramasamling",
  "texttype:essä;essäsamling", "texttype:novellsamling;novell",
  "texttype:diktsamling;dikt", "texttype:roman",
  "texttype:sakprosa;kringtexter;avhandling;referensverk",
  "keyword:Barnlitteratur", "keyword:Biografika|texttype:brev;brevsamling",
  "keyword:Finlandssvenskt", "keyword:Flickböcker", "texttype:herdaminne",
  "keyword:Humor", "texttype:kistebrev", "texttype:kringtext",
  "texttype:kåseri;kåserisamling", "texttype:reseskildring",
  "keyword:Rösträtt", "keyword:Sapmi", "keyword:Folktryck",
  "keyword:sentpajorden", "keyword:OrdenPrövas", "keyword:LB-antologi",
  "keyword:1800", "source:bibliotekariesidor", "source:diktensmuseum",
  "keyword:Dramawebben", "source:skolan", "source:litteraturkartan",
  "source:ljudochbild", "source:sol", "keyword:SLS-FI",
  "provenance.library:SVELITT", "provenance.library:SA",
  "provenance.library:SFS", "provenance.library:SVA",
  "author_ids:KunglSamfundet", "provenance.library:SVS"
])
const textSearchLanguages = new Set([
  "modernized:true", "modernized:false", "translation:true", "original:true",
  "language:swe", "foreign:true", "language:eng", "language:deu",
  "language:fra", "language:lat", "language:smi", "proofread:true",
  "proofread:false"
])
const libraryMedia = new Set([
  "mediatype:etext", "mediatype:faksimil", "has_epub:true", "mediatype:pdf"
])

function validDistinctStringArray(value, maximum, allowed = null) {
  return validStringArray(value, maximum, allowed) && new Set(value).size === value.length
}

function validLibraryIdentifier(value) {
  const characters = typeof value === "string" ? [...value] : []
  return characters.length >= 1 && characters.length <= 100
    && characters.every(character => /^[\p{L}\p{N}_-]$/u.test(character))
}

function validLibraryIdentifierArray(value) {
  return Array.isArray(value) && value.length <= 50
    && new Set(value).size === value.length
    && value.every(validLibraryIdentifier)
}

function validLibraryFilters(filters) {
  const fields = [
    "query", "gender", "categories", "narrowing_categories", "about_author_ids",
    "media", "languages", "year_from", "year_to"
  ]
  if (filters === null || typeof filters !== "object" || Array.isArray(filters)
    || Object.keys(filters).length !== fields.length
    || fields.some(field => !Object.hasOwn(filters, field))) return false
  if (typeof filters.query !== "string" || [...filters.query].length > 500
    || /[\p{Cc}\p{Cs}]/u.test(filters.query)) return false
  if (filters.gender !== null && filters.gender !== "female" && filters.gender !== "male") return false
  if (!validDistinctStringArray(filters.categories, 38, textSearchCategories)
    || !validDistinctStringArray(filters.narrowing_categories, 38, textSearchCategories)
    || !validLibraryIdentifierArray(filters.about_author_ids)
    || !validDistinctStringArray(filters.media, 4, libraryMedia)
    || !validDistinctStringArray(filters.languages, 13, textSearchLanguages)) return false
  for (const field of ["year_from", "year_to"]) {
    if (filters[field] !== null
      && (!Number.isInteger(filters[field]) || filters[field] < 1000 || filters[field] > 3000)) return false
  }
  return (filters.year_from === null) === (filters.year_to === null)
    && (filters.year_from === null || filters.year_from <= filters.year_to)
}

const librarySearchFields = {
  all: ["mode", "filters", "sort", "reverse", "page"],
  authors: ["mode", "filters", "sort", "reverse", "limit"],
  works: ["mode", "filters", "sort", "reverse", "page", "source_only"],
  parts: ["mode", "filters", "sort", "reverse", "page"],
  latest: ["mode", "filters", "reverse", "page", "hide_1800"],
  epub: ["mode", "filters", "sort", "reverse", "page"],
  pdf: ["mode", "filters", "sort", "reverse", "page"]
}
const librarySorts = {
  all: new Set(["relevance", "author", "title", "chronology"]),
  authors: new Set(["name", "popularity", "chronology"]),
  works: new Set(["author", "title", "popularity", "chronology"]),
  parts: new Set(["author", "title"]),
  epub: new Set(["author", "title", "popularity", "chronology"]),
  pdf: new Set(["author", "title", "popularity", "chronology"])
}

function hasExactFields(body, fields) {
  return Object.keys(body).length === fields.length
    && fields.every(field => Object.hasOwn(body, field))
}

function validLibrarySearchBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false
  if (!Object.hasOwn(librarySearchFields, body.mode)) return false
  const fields = librarySearchFields[body.mode]
  if (!fields || !hasExactFields(body, fields) || !validLibraryFilters(body.filters)
    || typeof body.reverse !== "boolean") return false
  if (body.mode !== "latest" && !librarySorts[body.mode].has(body.sort)) return false
  if (body.mode === "authors") return Number.isInteger(body.limit) && body.limit >= 150 && body.limit <= 10_000
  if (!Number.isInteger(body.page) || body.page < 1 || body.page > 100) return false
  if (body.mode === "works") return typeof body.source_only === "boolean"
  if (body.mode === "latest") return typeof body.hide_1800 === "boolean"
  return true
}

function validLibraryCountBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    && hasExactFields(body, ["mode", "filters"])
    && ["epub", "pdf", "works", "parts"].includes(body.mode)
    && validLibraryFilters(body.filters)
}

function canonicalLibraryIdentity(body) {
  const filters = {
    query: body.filters.query,
    gender: body.filters.gender,
    categories: body.filters.categories,
    narrowing_categories: body.filters.narrowing_categories,
    about_author_ids: body.filters.about_author_ids,
    media: body.filters.media,
    languages: body.filters.languages,
    year_from: body.filters.year_from,
    year_to: body.filters.year_to
  }
  if (body.mode === "all") return JSON.stringify({ mode: body.mode, filters, sort: body.sort, reverse: body.reverse, page: body.page })
  if (body.mode === "authors") return JSON.stringify({ mode: body.mode, filters, sort: body.sort, reverse: body.reverse, limit: body.limit })
  if (body.mode === "works") return JSON.stringify({ mode: body.mode, filters, sort: body.sort, reverse: body.reverse, page: body.page, source_only: body.source_only })
  if (body.mode === "latest") return JSON.stringify({ mode: body.mode, filters, reverse: body.reverse, page: body.page, hide_1800: body.hide_1800 })
  if (body.mode === "parts" || body.mode === "epub" || body.mode === "pdf") {
    return JSON.stringify({ mode: body.mode, filters, sort: body.sort, reverse: body.reverse, page: body.page })
  }
  return JSON.stringify({ mode: body.mode, filters })
}

const libraryAuthors = {
  strindberg: { author_id: "StrindbergA", full_name: "August Strindberg", surname: "Strindberg", role: "author", birth_year: null, death_year: null },
  lagerlof: { author_id: "LagerlofS", full_name: "Selma Lagerlöf", surname: "Lagerlöf", role: null, birth_year: "1858", death_year: "1940" },
  soderberg: { author_id: "SöderbergH", full_name: "Hjalmar Söderberg", surname: "Söderberg", role: null, birth_year: "1869", death_year: "1941" },
  geijer: { author_id: "GeijerEGA", full_name: "Erik Gustaf Geijer", surname: "Geijer", role: "editor", birth_year: "1783", death_year: "1847" },
  bauer: { author_id: "BauerJ", full_name: "John Bauer", surname: "Bauer", role: "illustrator", birth_year: "1882", death_year: "1918" },
  longEditor: { author_id: "LongEditorA", full_name: "Linnéa Det mycket långa redaktörsefternamnet", surname: "Det mycket långa redaktörsefternamnet", role: "editor", birth_year: null, death_year: null },
  poet: { author_id: "PoetP", full_name: "Pia Poet", surname: "Poet", role: "editor", birth_year: null, death_year: null }
}

function libraryAllAuthor(authorId, nameForIndex, birthYear = null, deathYear = null, popularity = 0) {
  return {
    kind: "author", author_id: authorId, birth_year: birthYear, death_year: deathYear,
    name_for_index: nameForIndex, popularity, highlights: []
  }
}

function libraryAllText({
  title, shortTitle = title, year, author, titleId, pageName = "1", mediaType = "etext",
  highlights = []
}) {
  return {
    kind: "text", index: mediaType, source_label: "roman", title,
    short_title: shortTitle, imprint_year: year, reader_author_id: author.author_id,
    title_id: titleId, page_name: pageName, media_type: mediaType, main_author: author,
    highlights
  }
}

function libraryBrowseItem({
  title, fullTitle, year, author, titleId, workId = `lb-${titleId}`,
  routeAuthorId = author.author_id, mediaType = "etext", titlePath = titleId,
  actions = [], sourceExports = []
}) {
  const encodedAuthor = encodeURIComponent(author.author_id)
  const encodedRouteAuthor = encodeURIComponent(routeAuthorId)
  const encodedTitle = encodeURIComponent(titleId)
  const encodedPath = encodeURIComponent(titlePath)
  const encodedWork = encodeURIComponent(workId)
  const titleUrl = mediaType === "pdf"
    ? `/txt/${encodedWork}/${encodedWork}.pdf`
    : `/f%C3%B6rfattare/${encodedRouteAuthor}/titlar/${encodedTitle}/sida/-2/${mediaType}`
  return {
    actions, author, author_url: `/f%C3%B6rfattare/${encodedAuthor}`,
    full_title: fullTitle, key: `${encodedPath}:${encodedWork}`,
    route_author_id: routeAuthorId, route_media_type: mediaType,
    route_title_id: titleId, source_exports: sourceExports, title, title_path: titlePath,
    title_url: titleUrl, year
  }
}

function libraryReadAction(authorId, titleId, mediaType = "etext") {
  const url = `/f%C3%B6rfattare/${encodeURIComponent(authorId)}/titlar/${encodeURIComponent(titleId)}/sida/-2/${mediaType}`
  return { kind: "read", label: `Läs som ${mediaType}`, url, download_filename: null }
}

function libraryAboutAction(authorId, titleId, mediaType = "etext") {
  const url = `/f%C3%B6rfattare/${encodeURIComponent(authorId)}/titlar/${encodeURIComponent(titleId)}/sida/-2/${mediaType}?om-boken`
  return { kind: "about", label: "Läs mer om verket", url, download_filename: null }
}

function libraryDownloadItem({
  title, fullTitle, year, author, titleId, mediaType = "etext",
  downloadFilename = "", downloadUrl
}) {
  const encodedAuthor = encodeURIComponent(author.author_id)
  const encodedTitle = encodeURIComponent(titleId)
  return {
    author, author_url: `/f%C3%B6rfattare/${encodedAuthor}`,
    download_filename: downloadFilename,
    download_url: downloadUrl ?? `/txt/epub/${encodedAuthor}_${encodedTitle}.epub`,
    full_title: fullTitle, route_author_id: author.author_id,
    route_media_type: mediaType, route_title_id: titleId, title,
    title_url: `/f%C3%B6rfattare/${encodedAuthor}/titlar/${encodedTitle}/${mediaType}?om-boken`,
    year
  }
}

const doktorGlasWork = libraryBrowseItem({
  title: "Doktor Glas", fullTitle: "Doktor Glas. Roman", year: "1905",
  author: libraryAuthors.soderberg, titleId: "DoktorGlas",
  actions: [
    libraryReadAction("SöderbergH", "DoktorGlas"),
    libraryReadAction("SöderbergH", "DoktorGlas", "faksimil"),
    { kind: "download", label: "Ladda ner epub", url: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", download_filename: "SöderbergH_DoktorGlas.epub" },
    { kind: "download", label: "Ladda ner pdf", url: "/export/faksimil/lb-DoktorGlas.pdf", download_filename: "SöderbergH_DoktorGlas.pdf" },
    { kind: "search", label: "Gör en sökning i verket", url: "/sok?forfattare=S%C3%B6derbergH&titlar=lb-DoktorGlas&avancerad", download_filename: null },
    libraryAboutAction("SöderbergH", "DoktorGlas")
  ],
  sourceExports: [
    { format: "txt", media_type: "etext", size: 1024, work_id: "lb1728740" },
    { format: "pdf", media_type: "faksimil", size: 730000, work_id: "lb1728740" }
  ]
})
const folkvisorWork = libraryBrowseItem({
  title: "Svenska folkvisor", fullTitle: "Svenska folkvisor", year: "1814",
  author: libraryAuthors.geijer, titleId: "SvenskaFolkvisor",
  actions: [
    libraryReadAction("GeijerEGA", "SvenskaFolkvisor"),
    { kind: "download", label: "Ladda ner epub", url: "/txt/epub/GeijerEGA_SvenskaFolkvisor.epub", download_filename: "GeijerEGA_SvenskaFolkvisor.epub" },
    libraryAboutAction("GeijerEGA", "SvenskaFolkvisor")
  ],
  sourceExports: [{ format: "xml", media_type: "etext", size: 2048, work_id: "lb123456" }]
})
const bauerWork = libraryBrowseItem({
  title: "Bland tomtar och troll", fullTitle: "x".repeat(501), year: "1915",
  author: libraryAuthors.bauer, titleId: "BlandTomtarOchTroll",
  actions: [
    libraryReadAction("BauerJ", "BlandTomtarOchTroll"),
    { kind: "download", label: "Ladda ner epub", url: "/txt/epub/BauerJ_BlandTomtarOchTroll.epub", download_filename: "BauerJ_BlandTomtarOchTroll.epub" },
    libraryAboutAction("BauerJ", "BlandTomtarOchTroll")
  ],
  sourceExports: [{ format: "workdb", media_type: "etext", size: 512, work_id: "lb234567" }]
})
const gostaWork = libraryBrowseItem({
  title: "Gösta Berlings saga", fullTitle: "Gösta Berlings saga. Roman", year: "1891",
  author: libraryAuthors.lagerlof, titleId: "GostaBerlingsSaga",
  actions: [
    libraryReadAction("LagerlofS", "GostaBerlingsSaga"),
    { kind: "download", label: "Ladda ner epub", url: "/txt/epub/LagerlofS_GostaBerlingsSaga.epub", download_filename: "LagerlofS_GostaBerlingsSaga.epub" },
    libraryAboutAction("LagerlofS", "GostaBerlingsSaga")
  ]
})
const partItem = {
  actions: [], author: libraryAuthors.poet, author_url: "/f%C3%B6rfattare/PoetP",
  full_title: "En novell i samlingen", key: "Novellsamling%2FEnNovell:lb-Novellsamling",
  route_author_id: "NovellA", route_media_type: "etext", route_title_id: "Novellsamling",
  source_exports: [], title: "En novell", title_path: "Novellsamling/EnNovell",
  title_url: "/f%C3%B6rfattare/NovellA/titlar/Novellsamling/sida/7/etext", year: "1903"
}

const doktorEpub = libraryDownloadItem({
  title: "Doktor Glas", fullTitle: "Doktor Glas. Roman", year: "1905",
  author: libraryAuthors.soderberg, titleId: "DoktorGlas"
})
const folkvisorEpub = libraryDownloadItem({
  title: "Svenska folkvisor", fullTitle: "Svenska folkvisor", year: "1814",
  author: libraryAuthors.geijer, titleId: "SvenskaFolkvisor"
})
const bauerEpub = libraryDownloadItem({
  title: "Bland tomtar och troll", fullTitle: "x".repeat(501), year: "1915",
  author: libraryAuthors.bauer, titleId: "BlandTomtarOchTroll"
})
const gostaEpub = libraryDownloadItem({
  title: "Gösta Berlings saga", fullTitle: "Gösta Berlings saga. Roman", year: "1891",
  author: libraryAuthors.lagerlof, titleId: "GostaBerlingsSaga"
})

function libraryPdfItem(title, fullTitle, year, author, titleId, downloadFilename, downloadUrl, mediaType = "faksimil") {
  return libraryDownloadItem({
    title, fullTitle, year, author, titleId, mediaType, downloadFilename, downloadUrl
  })
}

const defaultPdfItems = [
  libraryPdfItem("Gösta Berlings saga", "Gösta Berlings saga. Roman", "1891", libraryAuthors.lagerlof, "GostaBerlingsSaga", "LagerlofS_GostaBerlingsSaga.pdf", "/export/faksimil/lb-GostaBerlingsSaga.pdf", "etext"),
  libraryPdfItem("Svenska folkvisor", "Svenska folkvisor. Roman", "1814", { ...libraryAuthors.geijer, role: null, birth_year: null, death_year: null }, "SvenskaFolkvisor", "AfzeliusAA_SvenskaFolkvisor.pdf", "/export/faksimil/lb-SvenskaFolkvisor.pdf"),
  libraryPdfItem("Röda rummet", "Röda rummet. Skildringar ur artist- och författarlivet", "1879", { ...libraryAuthors.strindberg, role: null }, "RodaRummet", "ArchiveA_RodaRummet.pdf", "/txt/lb-RodaRummet/lb-RodaRummet.pdf"),
  libraryPdfItem("Nils Holgerssons underbara resa", "Nils Holgerssons underbara resa. Roman", "1906", { ...libraryAuthors.lagerlof, birth_year: null, death_year: null }, "NilsHolgersson", "DirectPdfA_NilsHolgerssonPdf.pdf", "/txt/lb-NilsHolgersson/lb-NilsHolgersson.pdf"),
  libraryPdfItem("Jerusalem", "Jerusalem. Roman", "1901", { ...libraryAuthors.lagerlof, birth_year: null, death_year: null }, "Jerusalem", "LagerlofS_Jerusalem.pdf", "/export/faksimil/lb-Jerusalem.pdf", "etext")
]
const tuplePdfItems = [
  ["Första tuple-kollisionen", "TupleA", "Första Kollision", "Kollision", "TupleCollisionOne", "/export/faksimil/c.pdf", "1903"],
  ["Andra tuple-kollisionen", "TupleB", "Andra Kollision", "Kollision", "TupleCollisionTwo", "/export/faksimil/bc.pdf", "1904"],
  ["Första delade sökvägen", "SamePathA", "Första delade sökvägen", "Sökväg", "SamePathOne", "/export/faksimil/lb-same-path-one.pdf", "1905"],
  ["Andra delade sökvägen", "SamePathB", "Andra delade sökvägen", "Sökväg", "SamePathTwo", "/export/faksimil/lb-same-path-two.pdf", "1906"],
  ["Första delade verket", "SameWorkA", "Första delade verket", "Verk", "SameWorkOne", "/export/faksimil/lb-shared-work.pdf", "1907"],
  ["Andra delade verket", "SameWorkB", "Andra delade verket", "Verk", "SameWorkTwo", "/export/faksimil/lb-shared-work.pdf", "1908"],
  ["Första exakta gruppen", "FirstTupleA", "Första exakta gruppen", "Första", "ExactTupleFirst", "/export/faksimil/lb-exact-tuple.pdf", "1909"],
  ["Grupphuvud utan export", "GroupMainA", "Grupphuvud Författare", "Grupphuvud", "LaterExportGroupMain", "/export/faksimil/lb-later-export-group.pdf", "1911"]
].map(([title, authorId, fullName, surname, titleId, url, year]) => libraryPdfItem(
  title, `${title}. Roman`, year, { author_id: authorId, full_name: fullName, surname, role: null, birth_year: null, death_year: null },
  titleId, `${authorId}_${titleId}.pdf`, url, title === "Grupphuvud utan export" || title === "Första exakta gruppen" ? "etext" : "faksimil"
))

function libraryLatestItem(item, importedOn, routeTitleId = item.route_title_id) {
  const latest = Object.fromEntries(Object.entries(item).filter(([key]) => (
    key !== "download_filename" && key !== "download_url"
  )))
  return { ...latest, route_title_id: routeTitleId, imported_on: importedOn }
}

const defaultLatestGroups = [
  {
    imported_on: "2026-07-18", source_count: 3,
    items: [
      libraryLatestItem(doktorEpub, "2026-07-18", "LegacyDoktorWorkId"),
      { ...libraryLatestItem(doktorEpub, "2026-07-18", "LegacyDoktorWorkId"), route_media_type: "faksimil", title_url: "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/LegacyDoktorWorkId/faksimil?om-boken" },
      libraryLatestItem(folkvisorEpub, "2026-07-18")
    ]
  },
  { imported_on: "2026-07-17", source_count: 1, items: [libraryLatestItem(bauerEpub, "2026-07-17")] }
]

const libraryAllPaginationItems = [
  ...Array.from({ length: 100 }, (_, index) => libraryAllAuthor(
    `AllPaginationA${index + 1}`,
    `Paginering, Träff ${index + 1}`
  )),
  libraryAllText({
    title: "Den unika träffen på sida två",
    year: "1902",
    author: libraryAuthors.lagerlof,
    titleId: "AllPaginationPageTwo"
  })
]

function libraryAllResponse(query, page) {
  if (query === "inga") return { mode: "all", total_hits: 0, items: [] }
  if (query === "Röda rummet") {
    return {
      mode: "all", total_hits: 1,
      items: [libraryAllText({
        title: "Röda rummet", year: "1879", author: libraryAuthors.strindberg,
        titleId: "RodaRummet",
        highlights: [
          { segments: [{ text: "Röda ", hit: false }, { text: "rummet", hit: true }] },
          { segments: [{ text: "August ", hit: false }, { text: "Strindberg", hit: true }] },
          { segments: [{ text: "<script>farligt</script><img src=x>", hit: false }] }
        ]
      })]
    }
  }
  if (query.includes("Selma")) {
    return { mode: "all", total_hits: 1, items: [libraryAllAuthor("LagerlofS", "Lagerlöf, Selma", 1858, 1940)] }
  }
  if (query === "Senaste") {
    return {
      mode: "all", total_hits: 1,
      items: [libraryAllText({
        title: "Senaste träffen", year: "1901",
        author: { author_id: "LatestA", full_name: "Senaste Författaren", surname: "Författaren", role: "author", birth_year: null, death_year: null },
        titleId: "LatestResult"
      })]
    }
  }
  if (query === "produktionsform") {
    return {
      mode: "all", total_hits: 100,
      items: [
        ...Array.from({ length: 99 }, (_, index) => libraryAllAuthor(`FixtureA${index}`, `Fixture, ${index}`)),
        { kind: "presentation", source_label: "Kringtexter", title: "sent på jorden (1932–1962): en samling", url: "https://litteraturbanken.se/presentationer/specialomraden/Spj_utg.html", byline: null, highlights: [] }
      ]
    }
  }
  if (query === "external-href-boundary") {
    return {
      mode: "all", total_hits: 3,
      items: [
        { kind: "presentation", source_label: "Kringtexter", title: "Säker intern kringtext", url: "/presentationer/forfattare/StrindbergA.html", byline: "Litteraturbanken", highlights: [] },
        { kind: "translator_lexicon", source_label: "Översättarlexikon", title: "Säker extern kringtext", url: "https://litteraturbanken.se/oversattarlexikon/artiklar/Saker", byline: "Litteraturbanken", highlights: [] },
        { kind: "wordpress", source_label: "Artikel", title: "Osäker extern kringtext", url: "javascript:globalThis.__libraryUnsafeHref = true", byline: "Litteraturbanken", highlights: [] }
      ]
    }
  }
  if (query === "all-pagination") {
    const pageStart = (page - 1) * 100
    return {
      mode: "all",
      total_hits: libraryAllPaginationItems.length,
      items: libraryAllPaginationItems.slice(pageStart, pageStart + 100)
    }
  }
  if (query === "titelmetadata") {
    return {
      mode: "all", total_hits: 4,
      items: [
        libraryAllText({
          title: "Den fullständiga titeln som ska visas som verktygstips när den korta titeln kapas",
          shortTitle: "En avsiktligt mycket lång korttitel som måste förkortas visuellt utan att flytta årtal eller författare i resultatraden",
          year: "1905", author: { author_id: "LongA", full_name: "Lång Titel", surname: "Titel", role: "author", birth_year: null, death_year: null },
          titleId: "LongShorttitle"
        }),
        { kind: "pdf", source_label: "roman", title: "Redaktörens bok", short_title: "Redaktörens bok", imprint_year: "1906", work_id: "lb-editor", main_author: { author_id: "EditorA", full_name: "Erik Redaktör", surname: "Redaktör", role: "editor", birth_year: null, death_year: null }, highlights: [] },
        libraryAllText({ title: "Illustratörens bok", year: "1907", author: { author_id: "IllustratorA", full_name: "Ida Illustratör", surname: "Illustratör", role: "illustrator", birth_year: null, death_year: null }, titleId: "IllustratorBook", mediaType: "faksimil" }),
        libraryAllText({ title: "Röda rummet", year: "1879", author: libraryAuthors.strindberg, titleId: "RodaRummet" })
      ]
    }
  }
  return {
    mode: "all", total_hits: 3,
    items: [
      libraryAllText({ title: "Röda rummet", year: "1879", author: libraryAuthors.strindberg, titleId: "RodaRummet" }),
      libraryAllAuthor("StrindbergA", "Strindberg, August", 1849, 1912),
      { kind: "presentation", source_label: "Kringtexter", title: "August Strindberg", url: "/presentationer/forfattare/StrindbergA.html", byline: "Litteraturbanken", highlights: [] }
    ]
  }
}

function libraryAuthorsResponse(query, limit) {
  if (query === "inga") return { mode: "authors", total_authors: 0, total_works: 0, total_parts: 0, items: [] }
  if (query.toLowerCase() === "strindberg") {
    const items = [
      libraryAllAuthor("StrindbergA", "Strindberg, August", 1849, 1912, 20),
      libraryAllAuthor("StrindbergE", "Strindberg, Erik", 1844, 1910, 12),
      libraryAllAuthor("StrindbergF", "Strindberg, Frida", 1872, 1943, 10),
      libraryAllAuthor("StrindbergN", "Strindberg, Nils", 1872, 1897, 8),
      libraryAllAuthor("StrindbergO", "Strindberg, Oskar", null, null, 7),
      libraryAllAuthor("StrindbergT", "Strindberg, Tore", 1882, 1968, 5),
      libraryAllAuthor("StrindbergV", "Strindberg, Vera", 1881, 1944, 4)
    ]
    return {
      mode: "authors", total_authors: 7, total_works: 465, total_parts: 1039,
      items: items.slice(0, limit)
    }
  }
  if (query.includes("Selma")) {
    return { mode: "authors", total_authors: 1, total_works: 1, total_parts: 0, items: [libraryAllAuthor("LagerlofS", "Lagerlöf, Selma", 1858, 1940)] }
  }
  const total = query === "många-författare" ? 151 : 156
  const seed = [
    libraryAllAuthor("SöderbergH", "Söderberg, Hjalmar", 1869, 1941, 11),
    libraryAllAuthor("BauerJ", "Bauer, John", 1882, 1918, 10),
    libraryAllAuthor("GeijerEGA", "Geijer, Erik Gustaf", 1783, 1847, 9),
    libraryAllAuthor("LagerlofS", "Lagerlöf, Selma", 1858, 1940, 8),
    libraryAllAuthor("StrindbergA", "Strindberg, August", 1849, 1912, 7)
  ]
  const items = [...seed, ...Array.from({ length: Math.max(0, total - seed.length) }, (_, index) => (
    libraryAllAuthor(`FixtureAuthor${index}`, `Författare, ${String(index + 1).padStart(3, "0")}`)
  ))].slice(0, limit)
  return { mode: "authors", total_authors: total, total_works: 3, total_parts: 201, items }
}

function libraryWorksResponse(query, page) {
  if (query === "inga") return { mode: "works", total_hits: 0, total_works: 0, items: [] }
  if (query === "source-pagination") {
    return {
      mode: "works",
      total_hits: 201,
      total_works: 201,
      items: page === 2
        ? [{
            ...gostaWork,
            source_exports: [{
              format: "txt", media_type: "etext", size: 4096,
              work_id: "lb278171"
            }]
          }]
        : [doktorGlasWork, folkvisorWork, bauerWork]
    }
  }
  if (query === "download-title-width") {
    return { mode: "works", total_hits: 1, total_works: 1, items: [
      libraryBrowseItem({
        title: "En avsiktligt mycket lång nedladdningstitel som måste kortas inom verkets kolumn",
        fullTitle: "En avsiktligt mycket lång nedladdningstitel som måste kortas inom verkets kolumn",
        year: "1905", author: libraryAuthors.soderberg, titleId: "LongDownloadTitle",
        sourceExports: [
          { format: "txt", media_type: "etext", size: 1024, work_id: "lb345678" }
        ]
      })
    ] }
  }
  if (query === "role-suffix-width") {
    return { mode: "works", total_hits: 1, total_works: 1, items: [
      libraryBrowseItem({
        title: "Redaktörens långa efternamn", fullTitle: "Redaktörens långa efternamn",
        year: "1906", author: libraryAuthors.longEditor, titleId: "LongEditorSurname"
      })
    ] }
  }
  if (query.toLowerCase() === "strindberg") {
    return { mode: "works", total_hits: 611, total_works: 465, items: [
      libraryBrowseItem({
        title: "Röda rummet", fullTitle: "Röda rummet", year: "1879",
        author: libraryAuthors.strindberg, titleId: "RodaRummet"
      })
    ] }
  }
  if (query.includes("Selma")) return { mode: "works", total_hits: 1, total_works: 1, items: [gostaWork] }
  if (query === "unsafe-download-token") {
    const safe = libraryBrowseItem({
      title: "Säkert källmaterial", fullTitle: "Säkert källmaterial. Roman", year: "1905",
      author: libraryAuthors.soderberg, titleId: "SafeDownload",
      actions: [libraryReadAction("SöderbergH", "SafeDownload"), libraryAboutAction("SöderbergH", "SafeDownload")],
      sourceExports: [{ format: "txt", media_type: "etext", size: 1024, work_id: "lb456789" }]
    })
    const unsafe = libraryBrowseItem({
      title: "Osäkert källmaterial", fullTitle: "Osäkert källmaterial. Roman", year: "1905",
      author: libraryAuthors.soderberg, titleId: "UnsafeDownload", workId: "lb-Unsafe,Injected-etext-txt",
      actions: [libraryReadAction("SöderbergH", "UnsafeDownload"), libraryAboutAction("SöderbergH", "UnsafeDownload")],
      sourceExports: [{ format: "txt", media_type: "etext", size: 1024, work_id: "lbUnsafe,Injected" }]
    })
    return { mode: "works", total_hits: 2, total_works: 2, items: [safe, unsafe] }
  }
  if (query === "unsafe-work-actions") {
    return { mode: "works", total_hits: 1, total_works: 1, items: [libraryBrowseItem({
      title: "Säkerhetsgranskat verk", fullTitle: "Säkerhetsgranskat verk", year: "1905",
      author: libraryAuthors.soderberg, titleId: "SafeActions",
      actions: [
        libraryReadAction("SöderbergH", "SafeActions"),
        { kind: "read", label: "Osäker läsning", url: "javascript:globalThis.__libraryUnsafeAction = true", download_filename: null },
        { kind: "search", label: "Föråldrad externmarkör", url: "/#external-link", download_filename: null },
        { kind: "download", label: "Osäker hämtning", url: "https://evil.test/book.epub", download_filename: "book.epub" },
        { kind: "download", label: "Säker PDF", url: "/txt/lb-SafeActions/lb-SafeActions.pdf", download_filename: "SafeActions.pdf" }
      ]
    })] }
  }
  return { mode: "works", total_hits: 4, total_works: 3, items: [doktorGlasWork, folkvisorWork, bauerWork] }
}

function libraryDownloadResponse(body) {
  const query = body.filters.query
  if (query === "inga") return { mode: body.mode, total_hits: 0, total_works: 0, items: [] }
  if (body.mode === "epub") {
    if (query === "unsafe-tooltip-text") {
      return { mode: "epub", total_hits: 3, total_works: 3, items: [
        { ...doktorEpub, title: "C1-titel", full_title: "C1-titel\u0085Roman" },
        {
          ...folkvisorEpub,
          title: "Surrogatförfattare",
          author: { ...folkvisorEpub.author, full_name: "Erik\ud800Geijer" }
        },
        { ...gostaEpub, title: "Astraltitel", full_title: "Astraltitel 😀" }
      ] }
    }
    if (query === "unsafe-download-href") {
      return { mode: "epub", total_hits: 1, total_works: 1, items: [{
        ...doktorEpub,
        title: "Osäker EPUB-hämtning",
        download_url: "javascript:globalThis.__libraryUnsafeDownload = true"
      }] }
    }
    if (query === "unsafe-navigation-hrefs") {
      return { mode: "epub", total_hits: 2, total_works: 2, items: [
        {
          ...doktorEpub,
          title: "Osäker navigering",
          title_url: "javascript:globalThis.__libraryUnsafeTitle = true",
          author_url: "https://evil.test/author"
        },
        gostaEpub
      ] }
    }
    if (query.toLowerCase() === "strindberg") {
      return {
        mode: "epub", total_hits: 136, total_works: 136,
        items: [libraryDownloadItem({
          title: "Röda rummet", fullTitle: "Röda rummet", year: "1879",
          author: libraryAuthors.strindberg, titleId: "RodaRummet"
        })]
      }
    }
    const items = query.includes("Selma") || body.page === 2 || (query === "sort race" && body.reverse)
      ? [gostaEpub] : [doktorEpub, folkvisorEpub, bauerEpub]
    let total = 201
    if (query === "bounded") total = 10_001
    else if (query === "pagination window") total = 1700
    else if (query.includes("Selma")) total = 1
    return { mode: "epub", total_hits: total, total_works: total, items }
  }
  if (query.toLowerCase() === "strindberg") {
    return {
      mode: "pdf", total_hits: 265, total_works: 265,
      items: [libraryPdfItem(
        "Röda rummet", "Röda rummet", "1879", libraryAuthors.strindberg,
        "RodaRummet", "StrindbergA_RodaRummet.pdf", "/export/faksimil/lb-RodaRummet.pdf"
      )]
    }
  }
  if (query === "unsafe-download-href") {
    return { mode: "pdf", total_hits: 1, total_works: 1, items: [{
      ...defaultPdfItems[0],
      title: "Osäker PDF-hämtning",
      download_url: "https://evil.test/book.pdf"
    }] }
  }
  if (query === "tuple-collision") return { mode: "pdf", total_hits: 10, total_works: 8, items: tuplePdfItems }
  let items = defaultPdfItems
  if (query.includes("Selma")) items = [defaultPdfItems[0]]
  else if (body.page === 2) {
    items = [libraryPdfItem("Doktor Glas", "Doktor Glas. Roman", "1905", libraryAuthors.soderberg, "DoktorGlas", "SöderbergH_DoktorGlas.pdf", "/export/faksimil/lb-DoktorGlas.pdf")]
  }
  let totalWorks = 201
  if (query === "bounded") totalWorks = 10_001
  else if (query.includes("Selma")) totalWorks = 1
  let totalHits = 307
  if (query === "bounded") totalHits = 10_001
  else if (query.includes("Selma")) totalHits = 2
  return { mode: "pdf", total_hits: totalHits, total_works: totalWorks, items }
}

function libraryWorksCountTotal(query, empty) {
  if (empty) return 0
  if (query === "strindberg") return 465
  if (query.includes("selma")) return 1
  if (query === "unsafe-download-token") return 2
  if (query === "role-suffix-width" || query === "download-title-width") return 1
  return 3
}

function libraryWorksAuthorIds(query, empty) {
  if (empty) return []
  if (query.includes("selma")) return ["LagerlofS"]
  if (query === "strindberg") {
    return ["StrindbergA", "StrindbergE", "StrindbergF", "StrindbergN", "StrindbergO", "StrindbergT", "StrindbergV"]
  }
  if (query === "unsafe-download-token") return ["SöderbergH"]
  if (query === "role-suffix-width") return ["LongEditorA"]
  if (query === "download-title-width") return ["SöderbergH"]
  return ["SöderbergH", "GeijerEGA", "BauerJ"]
}

function librarySearchResponse(body) {
  const query = body.filters.query
  if (body.mode === "all") return libraryAllResponse(query, body.page)
  if (body.mode === "authors") return libraryAuthorsResponse(query, body.limit)
  if (body.mode === "works") return libraryWorksResponse(query, body.page)
  if (body.mode === "parts") {
    if (query.toLowerCase() === "strindberg") {
      return { mode: "parts", total_parts: 1039, items: [] }
    }
    return { mode: "parts", total_parts: query ? 0 : 201, items: query ? [] : [partItem] }
  }
  if (body.mode === "latest") {
    const filtered = query.includes("Selma")
    return {
      mode: "latest", total_hits: filtered ? 1 : 4, total_works: filtered ? 1 : 4,
      groups: filtered
        ? [{ imported_on: "2026-07-16", source_count: 1, items: [libraryLatestItem(gostaEpub, "2026-07-16")] }]
        : defaultLatestGroups
    }
  }
  if (body.mode === "epub" || body.mode === "pdf") return libraryDownloadResponse(body)
  throw new Error(`Unsupported Library fixture mode: ${body.mode}`)
}

function libraryCountResponse(mode, filters) {
  const query = filters.query.toLowerCase()
  const empty = query === "inga"
  if (mode === "works") {
    return {
      mode,
      total: libraryWorksCountTotal(query, empty),
      author_ids: libraryWorksAuthorIds(query, empty)
    }
  }
  if (mode === "parts") {
    return {
      mode, total: query === "strindberg" ? 1039 : query ? 0 : 201,
      author_ids: query === "strindberg" ? ["StrindbergA"] : query ? [] : ["PoetP"]
    }
  }
  if (mode === "pdf" && query === "invalid-hits") return { mode, total: null }
  if (query === "strindberg") return { mode, total: mode === "epub" ? 136 : 265 }
  return { mode, total: empty ? 0 : query.includes("selma") ? 1 : 201 }
}
const textSearchLegacyFields = new Set([
  "author_ids", "keyword", "language", "main_author.gender", "mediatype",
  "modernized", "proofread", "provenance.library", "source", "texttype"
])
const textSearchCommonFields = new Set([
  "about_author_ids", "author_ids", "categories", "facet_author_id", "gender",
  "include_modernized", "languages", "legacy_filters", "prefix", "query",
  "suffix", "word_form_only", "work_ids", "year_from", "year_to"
])

function validBoundedString(value, maximum = 100, allowEmpty = false) {
  return typeof value === "string" && value.length <= maximum &&
    (allowEmpty || value.length >= 1)
}

function validStringArray(value, maximum, allowed = null) {
  return Array.isArray(value) && value.length <= maximum && value.every(item => (
    validBoundedString(item) && (allowed === null || allowed.has(item))
  ))
}

function validTextSearchCommon(body) {
  if (
    typeof body.include_modernized !== "boolean" || typeof body.prefix !== "boolean"
    || typeof body.suffix !== "boolean" || typeof body.word_form_only !== "boolean"
  ) return false
  for (const field of ["about_author_ids", "author_ids", "work_ids"]) {
    if (Object.hasOwn(body, field) && !validStringArray(body[field], 50)) return false
  }
  if (
    Object.hasOwn(body, "categories")
    && !validStringArray(body.categories, 38, textSearchCategories)
  ) return false
  if (
    Object.hasOwn(body, "languages")
    && !validStringArray(body.languages, 13, textSearchLanguages)
  ) return false
  if (
    Object.hasOwn(body, "facet_author_id") && body.facet_author_id !== null
    && !validBoundedString(body.facet_author_id)
  ) return false
  if (
    Object.hasOwn(body, "gender") && body.gender !== null
    && body.gender !== "female" && body.gender !== "male"
  ) return false
  if (Object.hasOwn(body, "legacy_filters")) {
    if (!Array.isArray(body.legacy_filters) || body.legacy_filters.length > 20) return false
    for (const filter of body.legacy_filters) {
      if (
        filter === null || typeof filter !== "object" || Array.isArray(filter)
        || Object.keys(filter).length !== 2 || !textSearchLegacyFields.has(filter.field)
        || !validBoundedString(filter.value, 100)
      ) return false
    }
  }
  for (const field of ["year_from", "year_to"]) {
    if (
      Object.hasOwn(body, field) && body[field] !== null
      && (!Number.isInteger(body[field]) || body[field] < 1000 || body[field] > 2200)
    ) return false
  }
  return true
}

function validTextSearchBody(operation, body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false
  const allowed = new Set(textSearchCommonFields)
  if (operation === "results") {
    allowed.add("highlight_limit")
    allowed.add("page")
    allowed.add("page_size")
  }
  if (operation === "options") {
    allowed.add("include_static_options")
    allowed.add("selected_work_ids")
    allowed.add("title_filter")
    allowed.add("title_limit")
  }
  if (Object.keys(body).some(field => !allowed.has(field))) return false
  if (!validTextSearchCommon(body)) return false

  if (operation === "results" || operation === "count") {
    if (!validBoundedString(body.query, 200)) return false
  } else if (
    Object.hasOwn(body, "query") && body.query !== null
    && !validBoundedString(body.query, 200)
  ) return false

  if (operation === "results") {
    return Number.isInteger(body.highlight_limit) && body.highlight_limit >= 5
      && body.highlight_limit <= 500 && Number.isInteger(body.page)
      && body.page >= 1 && body.page <= 10_000 && body.page_size === 30
  }
  if (operation === "options") {
    return typeof body.include_static_options === "boolean"
      && validBoundedString(body.title_filter, 200, true)
      && [0, 30, 500].includes(body.title_limit)
      && (!Object.hasOwn(body, "selected_work_ids")
        || validStringArray(body.selected_work_ids, 50))
  }
  return true
}

function decodedReaderHitWorkId(pathname) {
  const match = /^\/v2\/works\/([^/]+)\/search-hits$/.exec(pathname)
  if (!match) return null

  let workId
  try {
    workId = decodeURIComponent(match[1])
  } catch {
    return { valid: false }
  }

  const valid = workId.length >= 2 &&
    workId.length <= 100 &&
    workId.trim() === workId &&
    workId.toLowerCase().startsWith("lb") &&
    !workId.includes("%") &&
    !workId.includes("/") &&
    !workId.includes("\\") &&
    !/\p{Cc}/u.test(workId) &&
    workId !== "." &&
    workId !== ".."
  return { valid, workId: workId.toLowerCase() }
}

function parseReaderHitQuery(searchParams) {
  const allowed = new Set([
    "media_type",
    "query",
    "offset",
    "limit",
    "word_forms",
    "include_older_spellings",
    "prefix",
    "suffix"
  ])
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) return null
  }

  const mediaType = searchParams.get("media_type")
  const rawQuery = searchParams.get("query")
  if ((mediaType !== "etext" && mediaType !== "faksimil") || rawQuery === null) return null
  const query = rawQuery.trim()
  if (query.length < 1 || query.length > 200) return null

  const integer = (name, fallback, minimum, maximum) => {
    const raw = searchParams.get(name)
    if (raw === null) return fallback
    if (!/^\d+$/.test(raw)) return null
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum
      ? value
      : null
  }
  const boolean = (name, fallback) => {
    const raw = searchParams.get(name)
    if (raw === null) return fallback
    if (raw === "true") return true
    if (raw === "false") return false
    return null
  }

  const offset = integer("offset", 0, 0, 1_000_000)
  const limit = integer("limit", 3, 1, 20)
  const wordForms = boolean("word_forms", false)
  const includeOlderSpellings = boolean("include_older_spellings", true)
  const prefix = boolean("prefix", false)
  const suffix = boolean("suffix", false)
  if (
    offset === null ||
    limit === null ||
    wordForms === null ||
    includeOlderSpellings === null ||
    prefix === null ||
    suffix === null
  ) return null

  return {
    mediaType,
    query,
    offset,
    limit,
    wordForms,
    includeOlderSpellings,
    prefix,
    suffix
  }
}

function normalizedAuthorIds(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, "author_ids")) return null
  if (!Array.isArray(body.author_ids)) return null
  if (body.author_ids.length < 1 || body.author_ids.length > 50) return null

  const authorIds = []
  const seen = new Set()
  for (const authorId of body.author_ids) {
    if (typeof authorId !== "string") return null
    const normalized = authorId.trim()
    if (normalized.length < 1 || normalized.length > 100 || seen.has(normalized)) return null
    authorIds.push(normalized)
    seen.add(normalized)
  }
  return authorIds
}

function legacyAuthorRouteResolution(body) {
  if (
    body === null || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 3
    || !Object.hasOwn(body, "normalized_author_id")
    || !Object.hasOwn(body, "normalized_title_id")
    || !Object.hasOwn(body, "media_type")
  ) return null
  if (
    body.normalized_author_id === semerAuthorDocumentDescriptor.normalized_author_id
    && body.normalized_title_id === null
    && body.media_type === null
  ) return { author_id: semerAuthorDocumentDescriptor.author_id, title_id: null }
  if (
    body.normalized_author_id === "SoderbergH"
    && body.normalized_title_id === null
    && body.media_type === null
  ) return { author_id: "SöderbergH", title_id: null }
  if (
    body.normalized_author_id === "LagerlofS"
    && body.normalized_title_id === null
    && body.media_type === null
  ) return { author_id: "LagerlöfS", title_id: null }
  if (
    body.normalized_author_id === "SoderbergH"
    && body.normalized_title_id === "Forvillelser"
    && body.media_type === "etext"
  ) return { author_id: "SöderbergH", title_id: "Förvillelser" }
  return null
}

function legacyDramawebbenRouteResolution(body) {
  if (
    body === null || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 2
    || !Object.hasOwn(body, "kind")
    || !Object.hasOwn(body, "legacy_url")
  ) return null
  if (body.kind === "play" && body.legacy_url === "fiskargossarne") {
    return {
      location: "/författare/StrindbergA/titlar/Fiskargossarne/sida/1/etext"
    }
  }
  if (body.kind === "play" && body.legacy_url === "pdf-only") {
    return { location: "/txt/lb9/lb9.pdf" }
  }
  if (body.kind === "play" && body.legacy_url === "information-only") {
    return {
      location: "/dramawebben/pj%C3%A4ser?om-boken&authorid=StrindbergA&titlepath=Info"
    }
  }
  if (body.kind === "author" && body.legacy_url === "strindberg") {
    return { location: "/författare/StrindbergA/dramawebben" }
  }
  return null
}

function decodedProfileAuthorId(pathname) {
  const match = /^\/v2\/authors\/([^/]+)$/.exec(pathname)
  if (!match) return null

  let authorId
  try {
    authorId = decodeURIComponent(match[1])
  } catch {
    return { valid: false, authorId: null }
  }

  const valid = authorId.length >= 1 &&
    authorId.length <= 100 &&
    authorId.trim() === authorId &&
    !authorId.includes("%") &&
    !authorId.includes("/") &&
    !authorId.includes("\\") &&
    !/\p{Cc}/u.test(authorId) &&
    authorId !== "." &&
    authorId !== ".."
  return { valid, authorId }
}

function decodedAuthorWorksAuthorId(pathname) {
  const match = /^\/v2\/authors\/([^/]+)\/works$/.exec(pathname)
  if (!match) return null

  let authorId
  try {
    authorId = decodeURIComponent(match[1])
  } catch {
    return { valid: false, authorId: null }
  }

  const valid = authorId.length >= 1 &&
    authorId.length <= 100 &&
    authorId.trim() === authorId &&
    !authorId.includes("%") &&
    !authorId.includes("/") &&
    !authorId.includes("\\") &&
    !/\p{Cc}/u.test(authorId) &&
    authorId !== "." &&
    authorId !== ".."
  return { valid, authorId }
}

function decodedSourceInfoIdentity(pathname) {
  const match = /^\/v2\/works\/([^/]+)\/([^/]+)\/source-info$/.exec(pathname)
  if (!match) return null

  let authorId
  let titlePath
  try {
    authorId = decodeURIComponent(match[1])
    titlePath = decodeURIComponent(match[2])
  } catch {
    return { valid: false, authorId: null, titlePath: null }
  }

  const validSegment = (value, maximum) => value.length >= 1
    && value.length <= maximum
    && value.trim() === value
    && !value.includes("%")
    && !value.includes("/")
    && !value.includes("\\")
    && !/\p{Cc}/u.test(value)
    && value !== "."
    && value !== ".."
  return {
    valid: validSegment(authorId, 100) && validSegment(titlePath, 200),
    authorId,
    titlePath
  }
}

function sourceInfoMedia(searchParams) {
  for (const key of searchParams.keys()) {
    if (key !== "media_type" || searchParams.getAll(key).length !== 1) return null
  }
  const mediaType = searchParams.get("media_type")
  return mediaType === null || mediaType === "etext" || mediaType === "faksimil"
    ? mediaType
    : null
}

function decodedSimilarWorkId(pathname) {
  const match = /^\/v2\/works\/([^/]+)\/similar$/.exec(pathname)
  if (!match) return null

  let workId
  try {
    workId = decodeURIComponent(match[1])
  } catch {
    return { valid: false, workId: null }
  }
  const valid = workId.length >= 2
    && workId.length <= 100
    && workId === workId.trim()
    && workId.toLowerCase().startsWith("lb")
    && !workId.includes("%")
    && !workId.includes("/")
    && !workId.includes("\\")
    && !/\p{Cc}/u.test(workId)
    && workId !== "."
    && workId !== ".."
  return { valid, workId: workId.toLowerCase() }
}

function requiredSimilarMedia(searchParams) {
  if (
    [...searchParams.keys()].some(key => key !== "media_type")
    || searchParams.getAll("media_type").length !== 1
  ) return null
  const mediaType = searchParams.get("media_type")
  return mediaType === "etext" || mediaType === "faksimil" ? mediaType : null
}

function resourceFor(pathname) {
  if (pathname === "/v2/stats") return "stats"
  if (pathname === "/v2/works/popular") return "works"
  if (pathname === "/v2/epubs/popular") return "epubs"
  return null
}

function isPresentationRequest(pathname) {
  return pathname.startsWith("/red/presentationer/") ||
    pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml" ||
    pathname === "/red/bilder/bakgrundsbilder/rostratt_a.jpg" ||
    pathname === "/red/bilder/bakgrundsbilder/rostratt_b.jpg" ||
    pathname === "/app/style/litteraturbanken.css" ||
    pathname === "/app/style/date.css"
}

function richTextSearchResponse(body) {
  return {
    query: body.query,
    page: body.page,
    page_size: 30,
    total_work_hits: 2,
    author_facets: [
      { author_id: "StrindbergA", name_for_index: "Strindberg, August", count: 1 },
      { author_id: "LagerlöfS", name_for_index: "Lagerlöf, Selma", count: 1 }
    ],
    works: [
      {
        lbworkid: "lb238704",
        author_id: "StrindbergA",
        author_name: "August Strindberg",
        title: "Röda rummet",
        title_id: "RodaRummet",
        mediatype: "etext",
        has_more_highlights: false,
        highlights: [{
          left_context: [{ word: "ropade", word_id: "w1_10", page_name: "1" }],
          match: [{ word: "frihet", word_id: "w1_11", page_name: "1" }],
          right_context: [{ word: "och", word_id: "w1_12", page_name: "1" }]
        }]
      },
      {
        lbworkid: "lb278171",
        author_id: "LagerlöfS",
        author_name: "Selma Lagerlöf",
        title: "Gösta Berlings saga",
        title_id: "GostaBerlingsSaga",
        mediatype: "faksimil",
        has_more_highlights: true,
        highlights: [{
          left_context: [{ word: "sin", word_id: "w3_20", page_name: "3" }],
          match: [{ word: "frihet", word_id: "w3_21", page_name: "3" }],
          right_context: [{ word: "sökte", word_id: "w3_22", page_name: "3" }]
        }]
      }
    ]
  }
}

function textSearchResultsResponse(body) {
  if (body.query === "inga") {
    return {
      query: body.query,
      page: body.page,
      page_size: 30,
      total_work_hits: 0,
      author_facets: [],
      works: []
    }
  }
  const rich = richTextSearchResponse(body)
  if (body.query === "frihet" && body.page > 1 && hasExactFields(body, [
    "query", "page", "page_size", "highlight_limit", "prefix", "suffix",
    "word_form_only", "include_modernized"
  ])) {
    rich.works = []
    return rich
  }
  if (body.query === "overflow") {
    rich.total_work_hits = 64
    rich.works[0].has_more_highlights = true
    rich.author_facets[0].count = 41
    rich.author_facets[1].count = 23
  }
  if (body.query === "five-context") {
    rich.total_work_hits = 1
    rich.author_facets = [{ ...rich.author_facets[0], count: 1 }]
    rich.works = [rich.works[0]]
    rich.works[0].highlights[0].match[0].word = body.query
    rich.works[0].highlights[0].right_context = Array.from({ length: 5 }, (_, index) => ({
      word: String(index + 1).repeat(29),
      word_id: `w1_${index + 12}`,
      page_name: "1"
    }))
  }
  if (body.work_ids?.length) {
    const workIds = new Set(body.work_ids)
    rich.works = rich.works.filter(work => workIds.has(work.lbworkid))
    const authorIds = new Set(rich.works.map(work => work.author_id))
    rich.author_facets = rich.author_facets
      .filter(facet => authorIds.has(facet.author_id))
      .map(facet => ({ ...facet, count: 1 }))
    rich.total_work_hits = rich.works.length
  }
  if (body.facet_author_id) {
    rich.works = rich.works.filter(work => work.author_id === body.facet_author_id)
    rich.author_facets = rich.author_facets
      .filter(facet => facet.author_id === body.facet_author_id)
      .map(facet => ({ ...facet, count: rich.works.length }))
    rich.total_work_hits = rich.works.length
  }
  if (body.highlight_limit === 100) {
    for (const work of rich.works) {
      work.has_more_highlights = false
      if (work.lbworkid === "lb278171") {
        work.highlights.push({
          left_context: [{ word: "drömde", word_id: "w4_30", page_name: "4" }],
          match: [{ word: body.query, word_id: "w4_31", page_name: "4" }],
          right_context: [{ word: "vidare", word_id: "w4_32", page_name: "4" }]
        })
      }
    }
  }
  return rich
}

function textSearchCountResponse(body) {
  if (body.query === "inga") {
    return { query: body.query, total_documents: 0, total_highlights: 0 }
  }
  if (body.query === "overflow") {
    return { query: body.query, total_documents: 64, total_highlights: 512 }
  }
  if (body.query === "five-context") {
    return { query: body.query, total_documents: 1, total_highlights: 1 }
  }
  if (body.facet_author_id) {
    return { query: body.query, total_documents: 1, total_highlights: 1 }
  }
  return { query: body.query, total_documents: 2, total_highlights: 3 }
}

function authorityWords(pageName, row, words, offset) {
  return words.map((word, index) => ({
    word,
    word_id: `w${row}_${offset + index}`,
    page_name: pageName
  }))
}

function authorityHighlight(pageName, index, query, left, right) {
  const matchOffset = left.length + 1
  return {
    left_context: authorityWords(pageName, index, left, 1),
    match: authorityWords(pageName, index, [query], matchOffset),
    right_context: authorityWords(pageName, index, right, matchOffset + 1)
  }
}

function authorityTextSearchResultsResponse(body) {
  if (body.query === "inga") return textSearchResultsResponse(body)
  const response = richTextSearchResponse(body)
  response.total_work_hits = 2
  response.works[0].highlights = [
    authorityHighlight("1", 1, body.query, ["det", "är", "icke", "blott"], ["för", "människan", "."]),
    authorityHighlight("2", 2, body.query, ["han", "ropade", "högt", ","], ["för", "människan", "."]),
    authorityHighlight("3", 3, body.query, ["och", "drömmen", "om"], ["för", "människan", "."]),
    authorityHighlight("4", 4, body.query, ["den", "nya", "tiden", "gav"], ["för", "människan", "."]),
    authorityHighlight("5", 5, body.query, ["att", "vinna", "sin"], ["för", "människan", "."])
  ]
  response.works[0].has_more_highlights = true
  response.works[1].highlights = [authorityHighlight(
    "3", 6, body.query, ["hon", "sökte", "sin"], ["bortom", "bergen", "."]
  )]
  response.works[1].has_more_highlights = false
  response.author_facets[0].count = 1
  response.author_facets[1].count = 1
  return response
}

const textSearchTitleCatalog = [
  {
    option: { work_id: "lb238704", title: "Röda rummet", author_name: "August Strindberg" },
    facet: { author_id: "StrindbergA", name_for_index: "Strindberg, August", count: 1 }
  },
  {
    option: { work_id: "lb278171", title: "Gösta Berlings saga", author_name: "Selma Lagerlöf" },
    facet: { author_id: "LagerlöfS", name_for_index: "Lagerlöf, Selma", count: 1 }
  }
]

function selectedTextSearchTitleOptions(body, options) {
  const merged = [...options]
  for (const selectedWorkId of body.selected_work_ids || []) {
    const selected = textSearchTitleCatalog.find(
      item => item.option.work_id === selectedWorkId
    )?.option
    if (selected && !merged.some(option => option.work_id === selectedWorkId)) {
      merged.unshift(selected)
    }
  }
  return merged
}

function textSearchOptionsResponse(body) {
  const titleFilter = body.title_filter.toLocaleLowerCase("sv")
  if (titleFilter === "doktor") {
    const visibleCount = body.title_limit === 500 ? 41 : Math.min(body.title_limit, 30)
    return {
      authors: [],
      about_authors: [],
      title_options: selectedTextSearchTitleOptions(
        body,
        Array.from({ length: visibleCount }, (_, index) => ({
          work_id: `lb-doktor-${index + 1}`,
          title: `Doktortitel ${index + 1}`,
          author_name: "Test Doktor"
        }))
      ),
      title_author_facets: [],
      title_total: 43,
      year_from: null,
      year_to: null
    }
  }
  if (titleFilter === "overflow" || (body.query === "overflow" && !titleFilter)) {
    const visibleCount = Math.min(body.title_limit, 731)
    return {
      authors: [],
      about_authors: [],
      title_options: selectedTextSearchTitleOptions(
        body,
        Array.from({ length: visibleCount }, (_, index) => ({
          work_id: `lb-overflow-${index + 1}`,
          title: `Överflödestitel ${index + 1}`,
          author_name: "Test Överflöd"
        }))
      ),
      title_author_facets: [{
        author_id: "OverflowAuthor",
        name_for_index: "Överflöd, Test",
        count: 731
      }],
      title_total: 731,
      year_from: null,
      year_to: null
    }
  }

  const routeHasNoOptions = body.query === "inga" && body.author_ids?.includes("StrindbergA")
  let matching = routeHasNoOptions || titleFilter === "inga"
    ? []
    : titleFilter.includes("lager")
      ? [textSearchTitleCatalog[1]]
      : [...textSearchTitleCatalog]
  const titleTotal = matching.length
  for (const selectedWorkId of body.selected_work_ids || []) {
    const selected = textSearchTitleCatalog.find(item => item.option.work_id === selectedWorkId)
    if (selected && !matching.some(item => item.option.work_id === selectedWorkId)) {
      matching.push(selected)
    }
  }

  const visible = body.title_limit === 0 ? [] : matching.slice(0, body.title_limit)
  const authors = body.include_static_options && !routeHasNoOptions
    ? [{
        author_id: "LagerlöfS",
        name_for_index: "Lagerlöf, Selma",
        birth_year: "1858",
        death_year: "1940"
      }]
    : []
  const aboutAuthors = body.include_static_options && !routeHasNoOptions
    ? [{
        author_id: "StrindbergA",
        name_for_index: "Strindberg, August",
        birth_year: "1849",
        death_year: "1912"
      }, ...(body.about_author_ids?.includes("LagerlöfS")
        ? [{
            author_id: "LagerlöfS",
            name_for_index: "Lagerlöf, Selma",
            birth_year: "1858",
            death_year: "1940"
          }]
        : [])]
    : []
  return {
    authors,
    about_authors: aboutAuthors,
    title_options: visible.map(item => item.option),
    title_author_facets: visible.map(item => item.facet),
    title_total: titleTotal,
    year_from: matching.length ? 1849 : null,
    year_to: matching.length ? 1940 : null
  }
}

function textSearchResponse(operation, body) {
  if (textSearchAuthorityMode) {
    if (operation === "results") return authorityTextSearchResultsResponse(body)
    if (operation === "count") {
      return {
        query: body.query,
        total_documents: body.query === "inga" ? 0 : 2,
        total_highlights: body.query === "inga" ? 0 : 8
      }
    }
    const options = textSearchOptionsResponse(body)
    return {
      ...options,
      authors: [
        ...options.authors,
        ...(options.authors.some(author => author.author_id === "StrindbergA") ? [] : [{
          author_id: "StrindbergA",
          name_for_index: "Strindberg, August",
          birth_year: "1849",
          death_year: "1912"
        }])
      ],
      about_authors: [
        ...options.about_authors,
        ...(options.about_authors.some(author => author.author_id === "LagerlöfS") ? [] : [{
          author_id: "LagerlöfS",
          name_for_index: "Lagerlöf, Selma",
          birth_year: "1858",
          death_year: "1940"
        }])
      ],
      year_from: 1800,
      year_to: 1950
    }
  }
  if (operation === "results") return textSearchResultsResponse(body)
  if (operation === "count") return textSearchCountResponse(body)
  return textSearchOptionsResponse(body)
}

const server = createServer(async (request, response) => {
  const rawPathname = request.url.split("?", 1)[0]
  const url = new URL(request.url, `http://${request.headers.host}`)
  const apiPathname = url.pathname.replace(/^\/private-v2(?=\/|$)/, "/v2")
  const rawApiPathname = rawPathname.replace(/^\/private-v2(?=\/|$)/, "/v2")

  if (request.method === "OPTIONS") return sendJson(response, 204, null)
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true })
  }
  if (url.pathname === "/_observability_requests") {
    if (request.method === "GET") {
      return sendJson(response, 200, { requests: observabilityRequests })
    }
    if (request.method === "DELETE") {
      observabilityRequests = []
      return sendJson(response, 200, { requests: observabilityRequests })
    }
  }
  if (
    request.method === "POST"
    && apiPathname === "/v2/internal/observability/events"
  ) {
    const body = await readText(request)
    observabilityRequests.push({
      body,
      headers: request.headers
    })
    let parsed
    try {
      parsed = JSON.parse(body)
    } catch {
      return sendJson(response, 422, { accepted: 0 })
    }
    const accepted = Array.isArray(parsed.events) ? parsed.events.length : 0
    return sendJson(response, 202, { accepted })
  }
  if (["GET", "HEAD"].includes(request.method) && apiPathname === "/v2/openapi.json") {
    return sendJson(response, 200, {
      openapi: "3.1.0",
      path: rawPathname,
      query: url.searchParams.toString()
    })
  }
  if (request.method === "GET" && url.pathname === "/legacy-api/") {
    return sendJson(response, 200, { query: url.searchParams.toString() })
  }
  if (
    request.method === "POST"
    && (
      /^\/legacy-api\/(?:reader|editor|author-documents|dramawebben|dev)(?:\/|$)/u
        .test(url.pathname)
      || apiPathname === "/v2/dictionary/articles"
    )
  ) {
    return sendJson(response, 200, { proxied: true })
  }
  if (url.pathname === "/_library_v2/requests") {
    if (request.method === "GET") return sendJson(response, 200, libraryV2Requests)
    if (request.method === "DELETE") {
      libraryV2Requests = { options: [], search: [], counts: [] }
      return sendJson(response, 200, libraryV2Requests)
    }
    return validationError(response)
  }
  if (url.pathname === "/_library_v2/failures") {
    const serialized = () => ({
      options: [...libraryV2Failures.options],
      search: [...libraryV2Failures.search],
      counts: [...libraryV2Failures.counts]
    })
    if (request.method === "GET") return sendJson(response, 200, serialized())
    if (request.method === "DELETE") {
      libraryV2Failures = { options: new Set(), search: new Set(), counts: new Set() }
      return sendJson(response, 200, serialized())
    }
    if (request.method === "PUT") {
      let body
      try { body = await readJson(request) } catch { return validationError(response) }
      if (body === null || typeof body !== "object" || Array.isArray(body)) return validationError(response)
      if (body.operation === "options") {
        if (!hasExactFields(body, ["operation", "section"])
          || !["chronology", "about_authors"].includes(body.section)) return validationError(response)
        libraryV2Failures.options.add(body.section)
      } else if (body.operation === "search") {
        if (!hasExactFields(body, ["operation", "mode"])
          || !Object.hasOwn(librarySearchFields, body.mode)) return validationError(response)
        libraryV2Failures.search.add(body.mode)
      } else if (body.operation === "counts") {
        if (!hasExactFields(body, ["operation", "mode"])
          || !["epub", "pdf", "works", "parts"].includes(body.mode)) return validationError(response)
        libraryV2Failures.counts.add(body.mode)
      } else return validationError(response)
      return sendJson(response, 200, serialized())
    }
    return validationError(response)
  }
  if (url.pathname === "/_library_v2/delays") {
    if (request.method === "GET") return sendJson(response, 200, libraryV2Delays)
    if (request.method === "DELETE") {
      libraryV2Delays = { options: 0, search: {}, counts: {} }
      return sendJson(response, 200, libraryV2Delays)
    }
    if (request.method === "PUT") {
      let body
      try { body = await readJson(request) } catch { return validationError(response) }
      if (body === null || typeof body !== "object" || Array.isArray(body)
        || !Number.isInteger(body.delay) || body.delay < 0 || body.delay > 5000) {
        return validationError(response)
      }
      if (body.operation === "options") {
        if (!hasExactFields(body, ["operation", "delay"])) return validationError(response)
        libraryV2Delays.options = body.delay
      } else if (body.operation === "search") {
        if (!hasExactFields(body, ["operation", "body", "delay"])
          || !validLibrarySearchBody(body.body)) return validationError(response)
        libraryV2Delays.search[canonicalLibraryIdentity(body.body)] = body.delay
      } else if (body.operation === "counts") {
        if (!hasExactFields(body, ["operation", "body", "delay"])
          || !validLibraryCountBody(body.body)) return validationError(response)
        libraryV2Delays.counts[canonicalLibraryIdentity(body.body)] = body.delay
      } else return validationError(response)
      return sendJson(response, 200, libraryV2Delays)
    }
    return validationError(response)
  }
  const textSearchControlMatch = /^\/_text_search\/(requests|failures|delays)(?:\/([^/]+))?$/.exec(
    url.pathname
  )
  if (textSearchControlMatch) {
    const [, control, selectedOperation] = textSearchControlMatch
    if (selectedOperation && !textSearchOperations.has(selectedOperation)) {
      return validationError(response)
    }
    if (control === "requests") {
      if (request.method === "GET") {
        return selectedOperation
          ? sendJson(response, 200, { requests: textSearchRequests[selectedOperation] })
          : sendJson(response, 200, textSearchRequests)
      }
      if (request.method === "DELETE") {
        if (selectedOperation) textSearchRequests[selectedOperation] = []
        else textSearchRequests = { results: [], count: [], options: [], chronology: [] }
        return selectedOperation
          ? sendJson(response, 200, { requests: textSearchRequests[selectedOperation] })
          : sendJson(response, 200, textSearchRequests)
      }
    }
    if (control === "failures") {
      if (request.method === "GET" && !selectedOperation) {
        return sendJson(response, 200, { failures: [...textSearchFailures] })
      }
      if (request.method === "PUT" && !selectedOperation) {
        let body
        try {
          body = await readJson(request)
        } catch {
          return validationError(response)
        }
        if (
          body === null || typeof body !== "object" || Array.isArray(body)
          || Object.keys(body).length !== 1 || !textSearchOperations.has(body.operation)
        ) return validationError(response)
        textSearchFailures.add(body.operation)
        return sendJson(response, 200, { failures: [...textSearchFailures] })
      }
      if (request.method === "DELETE") {
        if (selectedOperation) textSearchFailures.delete(selectedOperation)
        else textSearchFailures = new Set()
        return sendJson(response, 200, { failures: [...textSearchFailures] })
      }
    }
    if (control === "delays") {
      if (request.method === "GET" && !selectedOperation) {
        return sendJson(response, 200, { delays: textSearchDelays })
      }
      if (request.method === "PUT" && !selectedOperation) {
        let body
        try {
          body = await readJson(request)
        } catch {
          return validationError(response)
        }
        if (
          body === null || typeof body !== "object" || Array.isArray(body)
          || Object.keys(body).length !== 3 || !textSearchOperations.has(body.operation)
          || !validBoundedString(body.selector, 200, true)
          || !Number.isInteger(body.delay) || body.delay < 0 || body.delay > 5000
        ) return validationError(response)
        textSearchDelays[body.operation][body.selector] = body.delay
        return sendJson(response, 200, { delays: textSearchDelays })
      }
      if (request.method === "DELETE") {
        if (selectedOperation) textSearchDelays[selectedOperation] = {}
        else textSearchDelays = { results: {}, count: {}, options: {}, chronology: {} }
        return sendJson(response, 200, { delays: textSearchDelays })
      }
    }
    return sendJson(response, 405, {
      error: { code: "method_not_allowed", message: "Method not allowed", details: null }
    })
  }
  if (url.pathname === "/_text_search/authority") {
    if (request.method === "GET") {
      return sendJson(response, 200, { enabled: textSearchAuthorityMode })
    }
    if (request.method === "PUT") {
      textSearchAuthorityMode = true
      return sendJson(response, 200, { enabled: textSearchAuthorityMode })
    }
    if (request.method === "DELETE") {
      textSearchAuthorityMode = false
      return sendJson(response, 200, { enabled: textSearchAuthorityMode })
    }
    return sendJson(response, 405, {
      error: { code: "method_not_allowed", message: "Method not allowed", details: null }
    })
  }
  if (url.pathname === "/_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests })
  }
  if (url.pathname === "/_source_info_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: sourceInfoRequests })
  }
  if (url.pathname === "/_source_info_requests" && request.method === "DELETE") {
    sourceInfoRequests = []
    return sendJson(response, 200, { requests: sourceInfoRequests })
  }
  if (url.pathname === "/_similar_work_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: similarWorkRequests })
  }
  if (url.pathname === "/_similar_work_requests" && request.method === "DELETE") {
    similarWorkRequests = []
    return sendJson(response, 200, { requests: similarWorkRequests })
  }
  if (url.pathname === "/_similar_work_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: similarWorkFailure })
  }
  if (url.pathname === "/_similar_work_failure" && request.method === "PUT") {
    similarWorkFailure = true
    return sendJson(response, 200, { failure: similarWorkFailure })
  }
  if (url.pathname === "/_similar_work_failure" && request.method === "DELETE") {
    similarWorkFailure = false
    return sendJson(response, 200, { failure: similarWorkFailure })
  }
  if (url.pathname === "/_similar_work_malformed" && request.method === "GET") {
    return sendJson(response, 200, { malformed: similarWorkMalformed })
  }
  if (url.pathname === "/_similar_work_malformed" && request.method === "PUT") {
    similarWorkMalformed = true
    return sendJson(response, 200, { malformed: similarWorkMalformed })
  }
  if (url.pathname === "/_similar_work_malformed" && request.method === "DELETE") {
    similarWorkMalformed = false
    return sendJson(response, 200, { malformed: similarWorkMalformed })
  }
  if (url.pathname === "/_source_info_static_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: sourceInfoStaticRequests })
  }
  if (url.pathname === "/_source_info_static_requests" && request.method === "DELETE") {
    sourceInfoStaticRequests = []
    return sendJson(response, 200, { requests: sourceInfoStaticRequests })
  }
  if (url.pathname === "/_source_info_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: sourceInfoFailure })
  }
  if (url.pathname === "/_source_info_failure" && request.method === "PUT") {
    sourceInfoFailure = true
    return sendJson(response, 200, { failure: sourceInfoFailure })
  }
  if (url.pathname === "/_source_info_failure" && request.method === "DELETE") {
    sourceInfoFailure = false
    return sendJson(response, 200, { failure: sourceInfoFailure })
  }
  if (url.pathname === "/_source_info_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: sourceInfoDelays })
  }
  if (url.pathname === "/_source_info_delays" && request.method === "PUT") {
    const body = await readJson(request)
    sourceInfoDelays = Object.fromEntries(
      Object.entries(body).map(([identity, delay]) => [identity, Number(delay)])
    )
    return sendJson(response, 200, { delays: sourceInfoDelays })
  }
  if (url.pathname === "/_source_info_delays" && request.method === "DELETE") {
    sourceInfoDelays = {}
    return sendJson(response, 200, { delays: sourceInfoDelays })
  }
  if (url.pathname === "/_source_info_static_failure" && request.method === "GET") {
    return sendJson(response, 200, { scenario: sourceInfoStaticFailure })
  }
  if (url.pathname === "/_source_info_static_failure" && request.method === "PUT") {
    const body = await readJson(request)
    sourceInfoStaticFailure = typeof body.scenario === "string" ? body.scenario : null
    return sendJson(response, 200, { scenario: sourceInfoStaticFailure })
  }
  if (url.pathname === "/_source_info_static_failure" && request.method === "DELETE") {
    sourceInfoStaticFailure = null
    return sendJson(response, 200, { scenario: sourceInfoStaticFailure })
  }

  if (
    request.method === "GET"
    && (url.pathname === "/red/etc/provenance/provenance.json"
      || url.pathname === "/red/etc/license/license.json")
  ) {
    sourceInfoStaticRequests.push(url.pathname)
    if (sourceInfoStaticFailure === "failed") {
      return sendJson(response, 503, {
        error: { code: "source_info_static_unavailable", message: "Unavailable", details: null }
      })
    }
    if (sourceInfoStaticFailure === "malformed") {
      return sendBody(response, 200, "application/json; charset=utf-8", "{not-json")
    }
    if (sourceInfoStaticFailure === "oversized") {
      return sendBody(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({ oversized: "x".repeat(1_048_577) })
      )
    }
    return sendJson(
      response,
      200,
      url.pathname.includes("provenance") ? sourceInfoProvenance : sourceInfoLicenses
    )
  }
  if (url.pathname === "/_requests" && request.method === "DELETE") {
    requests = []
    return sendJson(response, 200, { requests })
  }
  if (url.pathname === "/_contact_submissions" && request.method === "GET") {
    return sendJson(response, 200, { contactSubmissions })
  }
  if (url.pathname === "/_contact_submissions" && request.method === "DELETE") {
    releaseContactSubmissions()
    contactSubmissions = []
    return sendJson(response, 200, { contactSubmissions })
  }
  if (url.pathname === "/_contact_defer" && request.method === "GET") {
    return sendJson(response, 200, {
      deferred: deferContactSubmissions,
      pending: pendingContactReleases.length
    })
  }
  if (url.pathname === "/_contact_defer" && request.method === "PUT") {
    deferContactSubmissions = true
    return sendJson(response, 200, {
      deferred: deferContactSubmissions,
      pending: pendingContactReleases.length
    })
  }
  if (url.pathname === "/_contact_defer" && request.method === "DELETE") {
    releaseContactSubmissions()
    return sendJson(response, 200, {
      deferred: deferContactSubmissions,
      pending: pendingContactReleases.length
    })
  }
  if (url.pathname === "/_contact_release" && request.method === "POST") {
    const body = await readJson(request)
    const index = typeof body.sender_name === "string"
      ? pendingContactReleases.findIndex(release => release.submission.sender_name === body.sender_name)
      : Number(body.index)
    if (!Number.isInteger(index) || index < 0 || index >= pendingContactReleases.length) {
      return sendJson(response, 400, { error: "invalid pending Contact release index" })
    }
    const release = pendingContactReleases.splice(index, 1)[0]
    release.resolve({ failure: body.failure === true })
    return sendJson(response, 200, { pending: pendingContactReleases.length })
  }
  if (url.pathname === "/_quick_search_requests" && request.method === "GET") {
    return sendJson(response, 200, { queries: quickSearchQueries })
  }
  if (url.pathname === "/_quick_search_requests" && request.method === "DELETE") {
    quickSearchQueries = []
    return sendJson(response, 200, { queries: quickSearchQueries })
  }
  if (url.pathname === "/_quick_search_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: quickSearchFailure })
  }
  if (url.pathname === "/_quick_search_failure" && request.method === "PUT") {
    quickSearchFailure = true
    return sendJson(response, 200, { failure: quickSearchFailure })
  }
  if (url.pathname === "/_quick_search_failure" && request.method === "DELETE") {
    quickSearchFailure = false
    return sendJson(response, 200, { failure: quickSearchFailure })
  }
  if (url.pathname === "/_quick_search_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: quickSearchDelays })
  }
  if (url.pathname === "/_quick_search_delays" && request.method === "PUT") {
    const body = await readJson(request)
    quickSearchDelays = Object.fromEntries(
      Object.entries(body).map(([query, delay]) => [query, Number(delay)])
    )
    return sendJson(response, 200, { delays: quickSearchDelays })
  }
  if (url.pathname === "/_quick_search_delays" && request.method === "DELETE") {
    quickSearchDelays = {}
    return sendJson(response, 200, { delays: quickSearchDelays })
  }
  if (url.pathname === "/_work_lookup_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: workLookupRequests })
  }
  if (url.pathname === "/_work_lookup_requests" && request.method === "DELETE") {
    workLookupRequests = []
    return sendJson(response, 200, { requests: workLookupRequests })
  }
  if (url.pathname === "/_work_lookup_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: workLookupFailure })
  }
  if (url.pathname === "/_work_lookup_failure" && request.method === "PUT") {
    workLookupFailure = true
    return sendJson(response, 200, { failure: workLookupFailure })
  }
  if (url.pathname === "/_work_lookup_failure" && request.method === "DELETE") {
    workLookupFailure = false
    return sendJson(response, 200, { failure: workLookupFailure })
  }
  if (url.pathname === "/_work_lookup_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: workLookupDelays })
  }
  if (url.pathname === "/_work_lookup_delays" && request.method === "PUT") {
    const body = await readJson(request)
    workLookupDelays = Object.fromEntries(
      Object.entries(body).map(([key, delay]) => [key, Number(delay)])
    )
    return sendJson(response, 200, { delays: workLookupDelays })
  }
  if (url.pathname === "/_work_lookup_delays" && request.method === "DELETE") {
    workLookupDelays = {}
    return sendJson(response, 200, { delays: workLookupDelays })
  }
  if (url.pathname === "/_author_resolve_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorResolveRequests })
  }
  if (url.pathname === "/_author_resolve_requests" && request.method === "DELETE") {
    authorResolveRequests = []
    return sendJson(response, 200, { requests: authorResolveRequests })
  }
  if (url.pathname === "/_author_resolve_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: authorResolveFailure })
  }
  if (url.pathname === "/_author_resolve_failure" && request.method === "PUT") {
    authorResolveFailure = true
    return sendJson(response, 200, { failure: authorResolveFailure })
  }
  if (url.pathname === "/_author_resolve_failure" && request.method === "DELETE") {
    authorResolveFailure = false
    return sendJson(response, 200, { failure: authorResolveFailure })
  }
  if (url.pathname === "/_author_resolve_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: authorResolveDelays })
  }
  if (url.pathname === "/_author_resolve_delays" && request.method === "PUT") {
    const body = await readJson(request)
    authorResolveDelays = Object.fromEntries(
      Object.entries(body).map(([key, delay]) => [key, Number(delay)])
    )
    return sendJson(response, 200, { delays: authorResolveDelays })
  }
  if (url.pathname === "/_author_resolve_delays" && request.method === "DELETE") {
    authorResolveDelays = {}
    return sendJson(response, 200, { delays: authorResolveDelays })
  }
  if (url.pathname === "/_author_resolve_scenario" && request.method === "GET") {
    return sendJson(response, 200, { scenario: authorResolveScenario })
  }
  if (url.pathname === "/_author_resolve_scenario" && request.method === "PUT") {
    const body = await readJson(request)
    authorResolveScenario = typeof body.scenario === "string" ? body.scenario : null
    return sendJson(response, 200, { scenario: authorResolveScenario })
  }
  if (url.pathname === "/_author_resolve_scenario" && request.method === "DELETE") {
    authorResolveScenario = null
    return sendJson(response, 200, { scenario: authorResolveScenario })
  }
  if (url.pathname === "/_author_profile_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorProfileRequests })
  }
  if (url.pathname === "/_author_profile_requests" && request.method === "DELETE") {
    authorProfileRequests = []
    return sendJson(response, 200, { requests: authorProfileRequests })
  }
  if (url.pathname === "/_author_profile_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: authorProfileFailure })
  }
  if (url.pathname === "/_author_profile_failure" && request.method === "PUT") {
    authorProfileFailure = true
    return sendJson(response, 200, { failure: authorProfileFailure })
  }
  if (url.pathname === "/_author_profile_failure" && request.method === "DELETE") {
    authorProfileFailure = false
    return sendJson(response, 200, { failure: authorProfileFailure })
  }
  if (url.pathname === "/_author_profile_malformed_identity" && request.method === "PUT") {
    malformedAuthorProfileIdentity = true
    return sendJson(response, 200, { malformed: malformedAuthorProfileIdentity })
  }
  if (url.pathname === "/_author_profile_malformed_identity" && request.method === "DELETE") {
    malformedAuthorProfileIdentity = false
    return sendJson(response, 200, { malformed: malformedAuthorProfileIdentity })
  }
  if (url.pathname === "/_bibliography_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: bibliographyRequests })
  }
  if (url.pathname === "/_dictionary_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: dictionaryRequests })
  }
  if (url.pathname === "/_dictionary_requests" && request.method === "DELETE") {
    dictionaryRequests = []
    return sendJson(response, 200, { requests: dictionaryRequests })
  }
  if (url.pathname === "/_bibliography_requests" && request.method === "DELETE") {
    bibliographyRequests = []
    return sendJson(response, 200, { requests: bibliographyRequests })
  }
  if (url.pathname === "/_bibliography_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: bibliographyFailure })
  }
  if (url.pathname === "/_bibliography_failure" && request.method === "PUT") {
    bibliographyFailure = true
    return sendJson(response, 200, { failure: bibliographyFailure })
  }
  if (url.pathname === "/_bibliography_failure" && request.method === "DELETE") {
    bibliographyFailure = false
    return sendJson(response, 200, { failure: bibliographyFailure })
  }
  if (url.pathname === "/_bibliography_disconnect" && request.method === "PUT") {
    bibliographyDisconnect = true
    return sendJson(response, 200, { disconnect: bibliographyDisconnect })
  }
  if (url.pathname === "/_bibliography_disconnect" && request.method === "DELETE") {
    bibliographyDisconnect = false
    return sendJson(response, 200, { disconnect: bibliographyDisconnect })
  }
  if (url.pathname === "/_bibliography_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: bibliographyDelays })
  }
  if (url.pathname === "/_bibliography_delays" && request.method === "PUT") {
    const body = await readJson(request)
    bibliographyDelays = Object.fromEntries(
      Object.entries(body).map(([key, delay]) => [key, Number(delay)])
    )
    return sendJson(response, 200, { delays: bibliographyDelays })
  }
  if (url.pathname === "/_bibliography_delays" && request.method === "DELETE") {
    bibliographyDelays = {}
    return sendJson(response, 200, { delays: bibliographyDelays })
  }
  if (url.pathname === "/_author_works_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorWorksRequests })
  }
  if (url.pathname === "/_author_works_requests" && request.method === "DELETE") {
    authorWorksRequests = []
    return sendJson(response, 200, { requests: authorWorksRequests })
  }
  if (url.pathname === "/_author_works_failures" && request.method === "GET") {
    return sendJson(response, 200, { failures: [...authorWorksFailures] })
  }
  if (url.pathname === "/_author_works_failures" && request.method === "PUT") {
    const body = await readJson(request)
    authorWorksFailures = new Set(
      Object.entries(body)
        .filter(([, failed]) => Boolean(failed))
        .map(([authorId]) => authorId)
    )
    return sendJson(response, 200, { failures: [...authorWorksFailures] })
  }
  if (url.pathname === "/_author_works_failures" && request.method === "DELETE") {
    authorWorksFailures = new Set()
    return sendJson(response, 200, { failures: [] })
  }
  if (url.pathname === "/_author_works_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: authorWorksDelays })
  }
  if (url.pathname === "/_author_works_delays" && request.method === "PUT") {
    const body = await readJson(request)
    authorWorksDelays = Object.fromEntries(
      Object.entries(body).map(([authorId, delay]) => [authorId, Number(delay)])
    )
    return sendJson(response, 200, { delays: authorWorksDelays })
  }
  if (url.pathname === "/_author_works_delays" && request.method === "DELETE") {
    authorWorksDelays = {}
    return sendJson(response, 200, { delays: authorWorksDelays })
  }
  if (url.pathname === "/_home_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: homeRequests })
  }
  if (url.pathname === "/_home_requests" && request.method === "DELETE") {
    homeRequests = []
    return sendJson(response, 200, { requests: homeRequests })
  }
  if (url.pathname === "/_home_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: homeFailure })
  }
  if (url.pathname === "/_home_failure" && request.method === "PUT") {
    homeFailure = true
    return sendJson(response, 200, { failure: homeFailure })
  }
  if (url.pathname === "/_home_failure" && request.method === "DELETE") {
    homeFailure = false
    return sendJson(response, 200, { failure: homeFailure })
  }
  if (url.pathname === "/_home_hostile_background" && request.method === "PUT") {
    homeHostileBackground = true
    return sendJson(response, 200, { hostileBackground: homeHostileBackground })
  }
  if (url.pathname === "/_home_hostile_background" && request.method === "DELETE") {
    homeHostileBackground = false
    return sendJson(response, 200, { hostileBackground: homeHostileBackground })
  }
  if (url.pathname === "/_presentation_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: presentationRequests })
  }
  if (url.pathname === "/_presentation_requests" && request.method === "DELETE") {
    presentationRequests = []
    return sendJson(response, 200, { requests: presentationRequests })
  }
  if (url.pathname === "/_presentation_failures" && request.method === "GET") {
    return sendJson(response, 200, { failures: [...presentationFailures] })
  }
  if (url.pathname === "/_presentation_failures" && request.method === "PUT") {
    const { resource } = await readJson(request)
    if (["xhtml", "xml", "asset"].includes(resource)) presentationFailures.add(resource)
    return sendJson(response, 200, { failures: [...presentationFailures] })
  }
  if (url.pathname === "/_presentation_failures" && request.method === "DELETE") {
    presentationFailures = new Set()
    return sendJson(response, 200, { failures: [] })
  }
  if (url.pathname === "/_presentation_production_shape" && request.method === "GET") {
    return sendJson(response, 200, { enabled: presentationProductionShape })
  }
  if (url.pathname === "/_presentation_production_shape" && request.method === "PUT") {
    presentationProductionShape = true
    return sendJson(response, 200, { enabled: presentationProductionShape })
  }
  if (url.pathname === "/_presentation_production_shape" && request.method === "DELETE") {
    presentationProductionShape = false
    return sendJson(response, 200, { enabled: presentationProductionShape })
  }
  if (url.pathname === "/_presentation_hostile_subresources" && request.method === "GET") {
    return sendJson(response, 200, { enabled: presentationHostileSubresources })
  }
  if (url.pathname === "/_presentation_hostile_subresources" && request.method === "PUT") {
    presentationHostileSubresources = true
    return sendJson(response, 200, { enabled: presentationHostileSubresources })
  }
  if (url.pathname === "/_presentation_hostile_subresources" && request.method === "DELETE") {
    presentationHostileSubresources = false
    return sendJson(response, 200, { enabled: presentationHostileSubresources })
  }
  if (url.pathname === "/_litteraturkartan_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: litteraturkartanRequests })
  }
  if (url.pathname === "/_litteraturkartan_requests" && request.method === "DELETE") {
    litteraturkartanRequests = []
    return sendJson(response, 200, { requests: litteraturkartanRequests })
  }
  if (url.pathname === "/_reader_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: readerRequests })
  }
  if (url.pathname === "/_reader_requests" && request.method === "DELETE") {
    readerRequests = []
    return sendJson(response, 200, { requests: readerRequests })
  }
  for (const [controlPath, ledger] of [
    ["/_reader_manifest_requests", readerManifestRequests],
    ["/_editor_manifest_requests", editorManifestRequests],
    ["/_editor_facsimile_requests", editorFacsimileRequests],
    ["/_reader_metadata_requests", readerMetadataRequests],
    ["/_reader_html_requests", readerHtmlRequests],
    ["/_reader_ocr_requests", readerOcrRequests],
    ["/_reader_jpeg_requests", readerJpegRequests]
  ]) {
    if (url.pathname === controlPath && request.method === "GET") {
      return sendJson(response, 200, { requests: ledger })
    }
    if (url.pathname === controlPath && request.method === "DELETE") {
      ledger.length = 0
      return sendJson(response, 200, { requests: ledger })
    }
  }

  const readerManifestMatch = request.method === "GET"
    ? /^\/v2\/works\/([^/]+)\/([^/]+)\/manifest$/.exec(apiPathname)
    : null
  const editorManifestMatch = request.method === "GET"
    ? /^\/v2\/works\/([^/]+)\/editor-manifest$/.exec(apiPathname)
    : null
  if (readerManifestMatch || editorManifestMatch) {
    const manifestRequest = `${apiPathname}${url.search}`
    if (readerManifestMatch) readerManifestRequests.push(manifestRequest)
    else editorManifestRequests.push(manifestRequest)
    const validMediaQuery = url.searchParams.size === 1
      && url.searchParams.getAll("media_type").length === 1
      && ["etext", "faksimil"].includes(url.searchParams.get("media_type"))
    const decodeSegment = value => {
      try {
        const decoded = decodeURIComponent(value)
        return [...decoded].length >= 1
          && [...decoded].length <= 100
          && decoded === decoded.trim()
          && !/[\\/?#\p{Cc}\p{Cs}]/u.test(decoded)
          ? decoded
          : null
      } catch {
        return null
      }
    }
    if (!validMediaQuery) return validationError(response)
    const mediaType = url.searchParams.get("media_type")

    if (readerManifestMatch) {
      const authorId = decodeSegment(readerManifestMatch[1])
      const titlePath = decodeSegment(readerManifestMatch[2])
      if (authorId === null || titlePath === null) return validationError(response)
      await waitForReaderManifestDelay(titlePath)
      if (titlePath === "EmptyManifestReader") {
        return sendJson(response, 200, {})
      }
      if (titlePath === "UnavailableReader") {
        return sendJson(response, 503, {
          error: {
            code: "reader_manifest_unavailable",
            message: "Unable to load Reader manifest",
            details: null
          }
        })
      }
      try {
        const manifest = readerManifestResponse(
          titlePath,
          mediaType,
          titlePath === "Rallarliv"
            ? readerAarnsethFacsimileWorkInfoResponse
            : readerMetadataResponse(titlePath)
        )
        if (manifest === null || manifest.author_id !== authorId) {
          return sendJson(response, 404, {
            error: {
              code: "reader_manifest_not_found",
              message: "Reader manifest not found",
              details: null
            }
          })
        }
        return sendJson(response, 200, manifest)
      } catch {
        return sendJson(response, 500, {
          error: {
            code: "internal_error",
            message: "An unexpected error occurred",
            details: null
          }
        })
      }
    }

    const workId = decodeSegment(editorManifestMatch[1])
    if (workId === null) return validationError(response)
    if (workId === "lb-editor-empty-manifest") {
      return sendJson(response, 200, {})
    }
    if (workId === "lb-editor-unavailable"
      || (editorMetadataFailure && workId === "lb-editor-doktor")) {
      return sendJson(response, 503, {
        error: {
          code: "editor_manifest_unavailable",
          message: "Unable to load Editor manifest",
          details: null
        }
      })
    }
    try {
      const manifest = editorManifestResponse(workId, mediaType)
      if (manifest === null) {
        return sendJson(response, 404, {
          error: {
            code: "editor_manifest_not_found",
            message: "Editor manifest not found",
            details: null
          }
        })
      }
      return sendJson(response, 200, manifest)
    } catch {
      return sendJson(response, 500, {
        error: {
          code: "internal_error",
          message: "An unexpected error occurred",
          details: null
        }
      })
    }
  }
  if (url.pathname === "/_reader_metadata_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: readerMetadataDelays })
  }
  if (url.pathname === "/_reader_metadata_delays" && request.method === "PUT") {
    const body = await readJson(request)
    readerMetadataDelays = Object.fromEntries(
      Object.entries(body).map(([titlePath, delay]) => [titlePath, Number(delay)])
    )
    return sendJson(response, 200, { delays: readerMetadataDelays })
  }
  if (url.pathname === "/_reader_metadata_delays" && request.method === "DELETE") {
    readerMetadataDelays = {}
    return sendJson(response, 200, { delays: readerMetadataDelays })
  }
  if (url.pathname === "/_reader_manifest_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: readerManifestDelays })
  }
  if (url.pathname === "/_reader_manifest_delays" && request.method === "PUT") {
    const body = await readJson(request)
    readerManifestDelays = Object.fromEntries(
      Object.entries(body).map(([titlePath, delay]) => [titlePath, Number(delay)])
    )
    return sendJson(response, 200, { delays: readerManifestDelays })
  }
  if (url.pathname === "/_reader_manifest_delays" && request.method === "DELETE") {
    readerManifestDelays = {}
    return sendJson(response, 200, { delays: readerManifestDelays })
  }
  if (url.pathname === "/_reader_hit_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: readerHitRequests })
  }
  if (url.pathname === "/_reader_hit_requests" && request.method === "DELETE") {
    readerHitRequests = []
    return sendJson(response, 200, { requests: readerHitRequests })
  }
  if (url.pathname === "/_reader_hit_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: readerHitFailure })
  }
  if (url.pathname === "/_editor_metadata_failure" && request.method === "PUT") {
    editorMetadataFailure = true
    return sendJson(response, 200, { failure: true })
  }
  if (url.pathname === "/_editor_metadata_failure" && request.method === "DELETE") {
    editorMetadataFailure = false
    return sendJson(response, 200, { failure: false })
  }
  if (url.pathname === "/_reader_hit_failure" && request.method === "PUT") {
    readerHitFailure = true
    return sendJson(response, 200, { failure: readerHitFailure })
  }
  if (url.pathname === "/_reader_hit_failure" && request.method === "DELETE") {
    readerHitFailure = false
    return sendJson(response, 200, { failure: readerHitFailure })
  }
  if (url.pathname === "/_reader_hit_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: readerHitDelays })
  }
  if (url.pathname === "/_reader_hit_delays" && request.method === "PUT") {
    const body = await readJson(request)
    readerHitDelays = Object.fromEntries(
      Object.entries(body).map(([key, delay]) => [key, Number(delay)])
    )
    return sendJson(response, 200, { delays: readerHitDelays })
  }
  if (url.pathname === "/_reader_hit_delays" && request.method === "DELETE") {
    readerHitDelays = {}
    return sendJson(response, 200, { delays: readerHitDelays })
  }
  if (url.pathname === "/_export_faksimil_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: exportFaksimilRequests })
  }
  if (url.pathname === "/_export_faksimil_requests" && request.method === "DELETE") {
    exportFaksimilRequests = []
    return sendJson(response, 200, { requests: exportFaksimilRequests })
  }
  if (url.pathname === "/_library_relevance_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: libraryRelevanceRequests })
  }
  if (url.pathname === "/_library_relevance_requests" && request.method === "DELETE") {
    libraryRelevanceRequests = []
    return sendJson(response, 200, { requests: libraryRelevanceRequests })
  }
  if (url.pathname === "/_library_relevance_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: libraryRelevanceFailure })
  }
  if (url.pathname === "/_library_relevance_failure" && request.method === "PUT") {
    libraryRelevanceFailure = true
    return sendJson(response, 200, { failure: libraryRelevanceFailure })
  }
  if (url.pathname === "/_library_relevance_failure" && request.method === "DELETE") {
    libraryRelevanceFailure = false
    return sendJson(response, 200, { failure: libraryRelevanceFailure })
  }
  if (url.pathname === "/_library_relevance_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: libraryRelevanceDelays })
  }
  if (url.pathname === "/_library_relevance_delays" && request.method === "PUT") {
    const body = await readJson(request)
    libraryRelevanceDelays = Object.fromEntries(
      Object.entries(body).map(([query, delay]) => [query, Number(delay)])
    )
    return sendJson(response, 200, { delays: libraryRelevanceDelays })
  }
  if (url.pathname === "/_library_relevance_delays" && request.method === "DELETE") {
    libraryRelevanceDelays = {}
    return sendJson(response, 200, { delays: libraryRelevanceDelays })
  }
  if (url.pathname === "/_library_query_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: libraryQueryRequests })
  }
  if (url.pathname === "/_library_query_requests" && request.method === "DELETE") {
    libraryQueryRequests = []
    return sendJson(response, 200, { requests: libraryQueryRequests })
  }
  if (url.pathname === "/_library_query_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: libraryQueryFailure })
  }
  if (url.pathname === "/_library_query_failure" && request.method === "PUT") {
    libraryQueryFailure = true
    return sendJson(response, 200, { failure: libraryQueryFailure })
  }
  if (url.pathname === "/_library_query_failure" && request.method === "DELETE") {
    libraryQueryFailure = false
    return sendJson(response, 200, { failure: libraryQueryFailure })
  }
  if (url.pathname === "/_library_query_delays" && request.method === "GET") {
    return sendJson(response, 200, { delays: libraryQueryDelays })
  }
  if (url.pathname === "/_library_query_delays" && request.method === "PUT") {
    const body = await readJson(request)
    libraryQueryDelays = Object.fromEntries(
      Object.entries(body).map(([key, delay]) => [key, Number(delay)])
    )
    return sendJson(response, 200, { delays: libraryQueryDelays })
  }
  if (url.pathname === "/_library_query_delays" && request.method === "DELETE") {
    libraryQueryDelays = {}
    return sendJson(response, 200, { delays: libraryQueryDelays })
  }
  if (url.pathname === "/_library_imprint_range" && request.method === "PUT") {
    libraryImprintRange = await readJson(request)
    return sendJson(response, 200, libraryImprintRange)
  }
  if (url.pathname === "/_library_imprint_range" && request.method === "DELETE") {
    libraryImprintRange = structuredClone(defaultLibraryImprintRange)
    return sendJson(response, 200, libraryImprintRange)
  }
  if (url.pathname === "/_library_imprint_failure" && request.method === "PUT") {
    libraryImprintFailure = true
    return sendJson(response, 200, { failure: true })
  }
  if (url.pathname === "/_library_imprint_failure" && request.method === "DELETE") {
    libraryImprintFailure = false
    return sendJson(response, 200, { failure: false })
  }
  if (url.pathname === "/_library_imprint_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: libraryImprintRequests })
  }
  if (url.pathname === "/_library_imprint_requests" && request.method === "DELETE") {
    libraryImprintRequests = []
    return sendJson(response, 200, { requests: [] })
  }
  if (url.pathname === "/_library_metadata_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: libraryMetadataRequests })
  }
  if (url.pathname === "/_library_metadata_requests" && request.method === "DELETE") {
    libraryMetadataRequests = []
    return sendJson(response, 200, { requests: [] })
  }
  if (url.pathname === "/_library_metadata_variant" && request.method === "PUT") {
    let body
    try {
      body = await readJson(request)
    } catch {
      return validationError(response)
    }
    const variants = new Set(["normal", "duplicate-authors", "duplicate-keywords"])
    if (body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !variants.has(body.variant)) {
      return validationError(response)
    }
    libraryMetadataVariant = body.variant
    return sendJson(response, 200, { variant: libraryMetadataVariant })
  }
  if (url.pathname === "/_library_metadata_variant" && request.method === "DELETE") {
    libraryMetadataVariant = "normal"
    return sendJson(response, 200, { variant: libraryMetadataVariant })
  }
  if (url.pathname === "/_library_download_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: libraryDownloadRequests })
  }
  if (url.pathname === "/_library_download_requests" && request.method === "DELETE") {
    libraryDownloadRequests = []
    return sendJson(response, 200, { requests: [] })
  }
  if (url.pathname === "/_dramawebben_document_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: dramawebbenDocumentRequests })
  }
  if (url.pathname === "/_dramawebben_document_requests" && request.method === "DELETE") {
    dramawebbenDocumentRequests = []
    return sendJson(response, 200, { requests: dramawebbenDocumentRequests })
  }
  if (url.pathname === "/_dramawebben_excluded_data_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: dramawebbenExcludedDataRequests })
  }
  if (url.pathname === "/_dramawebben_excluded_data_requests" && request.method === "DELETE") {
    dramawebbenExcludedDataRequests = []
    return sendJson(response, 200, { requests: dramawebbenExcludedDataRequests })
  }
  if (url.pathname === "/_dramawebben_catalog_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: dramawebbenCatalogRequests })
  }
  if (url.pathname === "/_dramawebben_catalog_requests" && request.method === "DELETE") {
    dramawebbenCatalogRequests = []
    return sendJson(response, 200, { requests: dramawebbenCatalogRequests })
  }
  if (url.pathname === "/_dramawebben_catalog_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: dramawebbenCatalogFailure })
  }
  if (url.pathname === "/_dramawebben_catalog_failure" && request.method === "PUT") {
    let body
    try {
      body = await readJson(request)
    } catch {
      return validationError(response)
    }
    const allowed = new Set([
      "status-503",
      "malformed-200",
      "unsafe-media-url-200",
      "backslash-media-url-200",
      "dot-segment-media-url-200",
      "dot-segment-infopost-url-200",
      "reordered-infopost-query-200",
      "additive-catalog-fields-200",
      "array-media-type-200",
      "unsafe-author-id-200",
      "omitted-range-field-200",
      "pdf-primary-200",
      "long-mixed-media-author-200",
      "secondary-female-author-200"
    ])
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !allowed.has(body.failure)
    ) return validationError(response)
    dramawebbenCatalogFailure = body.failure
    return sendJson(response, 200, { failure: dramawebbenCatalogFailure })
  }
  if (url.pathname === "/_dramawebben_catalog_failure" && request.method === "DELETE") {
    dramawebbenCatalogFailure = null
    return sendJson(response, 200, { failure: dramawebbenCatalogFailure })
  }
  if (url.pathname === "/_sla_excluded_data_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: slaExcludedDataRequests })
  }
  if (url.pathname === "/_sla_excluded_data_requests" && request.method === "DELETE") {
    slaExcludedDataRequests = []
    return sendJson(response, 200, { requests: slaExcludedDataRequests })
  }
  if (url.pathname === "/_sla_article_descriptor_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: slaArticleDescriptorRequests })
  }
  if (url.pathname === "/_sla_article_descriptor_requests" && request.method === "DELETE") {
    slaArticleDescriptorRequests = []
    return sendJson(response, 200, { requests: slaArticleDescriptorRequests })
  }
  if (url.pathname === "/_sla_article_source_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: slaArticleSourceRequests })
  }
  if (url.pathname === "/_sla_article_source_requests" && request.method === "DELETE") {
    slaArticleSourceRequests = []
    return sendJson(response, 200, { requests: slaArticleSourceRequests })
  }
  if (url.pathname === "/_sla_article_descriptor_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: slaArticleDescriptorFailure })
  }
  if (url.pathname === "/_sla_article_descriptor_failure" && request.method === "PUT") {
    const body = await readJson(request)
    const allowed = new Set([
      "status-404",
      "status-503",
      "redirect-307",
      "redirect-308",
      "malformed-json",
      "source-query",
      "extra-field"
    ])
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !allowed.has(body.failure)
    ) return validationError(response)
    slaArticleDescriptorFailure = body.failure
    return sendJson(response, 200, { failure: slaArticleDescriptorFailure })
  }
  if (url.pathname === "/_sla_article_descriptor_failure" && request.method === "DELETE") {
    slaArticleDescriptorFailure = null
    return sendJson(response, 200, { failure: slaArticleDescriptorFailure })
  }
  if (url.pathname === "/_sla_article_source_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: slaArticleSourceFailure })
  }
  if (url.pathname === "/_sla_article_source_failure" && request.method === "PUT") {
    const body = await readJson(request)
    const allowed = new Set([
      "status-404",
      "status-503",
      "redirect-302",
      "wrong-media-type",
      "media-without-charset",
      "media-with-quoted-charset",
      "exact-declared-cap",
      "exact-streamed-cap",
      "oversized-declared",
      "oversized-streamed",
      "rejected-stream",
      "missing-body",
      "multiple-bodies"
    ])
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !allowed.has(body.failure)
    ) return validationError(response)
    slaArticleSourceFailure = body.failure
    return sendJson(response, 200, { failure: slaArticleSourceFailure })
  }
  if (url.pathname === "/_sla_article_source_failure" && request.method === "DELETE") {
    slaArticleSourceFailure = null
    return sendJson(response, 200, { failure: slaArticleSourceFailure })
  }
  if (
    url.pathname === "/_sla_article_redirect_target_requests"
    && request.method === "GET"
  ) {
    return sendJson(response, 200, { requests: slaArticleRedirectTargetRequests })
  }
  if (
    url.pathname === "/_sla_article_redirect_target_requests"
    && request.method === "DELETE"
  ) {
    slaArticleRedirectTargetRequests = []
    return sendJson(response, 200, { requests: slaArticleRedirectTargetRequests })
  }
  if (url.pathname === "/_sla_article_source_cancellations" && request.method === "GET") {
    return sendJson(response, 200, { requests: slaArticleSourceCancellations })
  }
  if (url.pathname === "/_sla_article_source_cancellations" && request.method === "DELETE") {
    slaArticleSourceCancellations = []
    return sendJson(response, 200, { requests: slaArticleSourceCancellations })
  }
  if (url.pathname === "/_sla_article_request_headers" && request.method === "GET") {
    return sendJson(response, 200, slaArticleRequestHeaders)
  }
  if (url.pathname === "/_sla_article_request_headers" && request.method === "DELETE") {
    slaArticleRequestHeaders = { descriptor: [], source: [] }
    return sendJson(response, 200, slaArticleRequestHeaders)
  }
  if (
    url.pathname === "/_dramawebben_document_redirect_target_requests"
    && request.method === "GET"
  ) {
    return sendJson(response, 200, { requests: dramawebbenDocumentRedirectTargetRequests })
  }
  if (
    url.pathname === "/_dramawebben_document_redirect_target_requests"
    && request.method === "DELETE"
  ) {
    dramawebbenDocumentRedirectTargetRequests = []
    return sendJson(response, 200, { requests: dramawebbenDocumentRedirectTargetRequests })
  }
  if (url.pathname === "/_dramawebben_document_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: dramawebbenDocumentFailure })
  }
  if (url.pathname === "/_dramawebben_document_failure" && request.method === "PUT") {
    const body = await readJson(request)
    const allowed = new Set([
      "content-404",
      "content-502",
      "content-redirect",
      "wrong-content-type",
      "malicious",
      "oversized-declared",
      "oversized-streamed"
    ])
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !allowed.has(body.failure)
    ) return validationError(response)
    dramawebbenDocumentFailure = body.failure
    return sendJson(response, 200, { failure: dramawebbenDocumentFailure })
  }
  if (url.pathname === "/_dramawebben_document_failure" && request.method === "DELETE") {
    dramawebbenDocumentFailure = null
    return sendJson(response, 200, { failure: dramawebbenDocumentFailure })
  }
  if (url.pathname === "/_author_document_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorDocumentRequests })
  }
  if (url.pathname === "/_author_document_requests" && request.method === "DELETE") {
    authorDocumentRequests = []
    return sendJson(response, 200, { requests: authorDocumentRequests })
  }
  if (url.pathname === "/_author_document_asset_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorDocumentAssetRequests })
  }
  if (url.pathname === "/_author_document_asset_requests" && request.method === "DELETE") {
    authorDocumentAssetRequests = []
    return sendJson(response, 200, { requests: authorDocumentAssetRequests })
  }
  if (
    url.pathname === "/_author_document_redirect_target_requests"
    && request.method === "GET"
  ) {
    return sendJson(response, 200, { requests: authorDocumentRedirectTargetRequests })
  }
  if (
    url.pathname === "/_author_document_redirect_target_requests"
    && request.method === "DELETE"
  ) {
    authorDocumentRedirectTargetRequests = []
    return sendJson(response, 200, { requests: authorDocumentRedirectTargetRequests })
  }
  if (url.pathname === "/_author_document_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: authorDocumentFailure })
  }
  if (url.pathname === "/_author_document_failure" && request.method === "PUT") {
    const body = await readJson(request)
    const allowed = new Set([
      "descriptor-404",
      "descriptor-503",
      "descriptor-redirect-307",
      "descriptor-redirect-308",
      "content-404",
      "content-503",
      "content-redirect",
      "oversized-content",
      "wrong-content-type",
      "oversized-declared",
      "oversized-streamed",
      "fetch-rejection",
      "malformed-descriptor",
      "unsafe-source-path",
      "malformed-content"
    ])
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !allowed.has(body.failure)
    ) return validationError(response)
    authorDocumentFailure = body.failure
    return sendJson(response, 200, { failure: authorDocumentFailure })
  }
  if (url.pathname === "/_author_document_failure" && request.method === "DELETE") {
    authorDocumentFailure = null
    return sendJson(response, 200, { failure: authorDocumentFailure })
  }
  if (url.pathname === "/_author_document_delay" && request.method === "GET") {
    return sendJson(response, 200, { delay: authorDocumentDelay })
  }
  if (url.pathname === "/_author_document_delay" && request.method === "PUT") {
    const body = await readJson(request)
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !Number.isInteger(body.delay)
      || body.delay < 0 || body.delay > 5000
    ) return validationError(response)
    authorDocumentDelay = body.delay
    return sendJson(response, 200, { delay: authorDocumentDelay })
  }
  if (url.pathname === "/_author_document_delay" && request.method === "DELETE") {
    authorDocumentDelay = 0
    return sendJson(response, 200, { delay: authorDocumentDelay })
  }
  if (url.pathname === "/_legacy_author_route_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: legacyAuthorRouteRequests })
  }
  if (url.pathname === "/_legacy_author_route_requests" && request.method === "DELETE") {
    legacyAuthorRouteRequests = []
    return sendJson(response, 200, { requests: legacyAuthorRouteRequests })
  }
  if (url.pathname === "/_legacy_author_route_failure" && request.method === "GET") {
    return sendJson(response, 200, { failure: legacyAuthorRouteFailure })
  }
  if (url.pathname === "/_legacy_author_route_failure" && request.method === "PUT") {
    const body = await readJson(request)
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1
      || ![
        "malformed-200",
        "extra-key-200",
        "resolver-503",
        "resolver-redirect-307",
        "resolver-redirect-308"
      ].includes(body.failure)
    ) return validationError(response)
    legacyAuthorRouteFailure = body.failure
    return sendJson(response, 200, { failure: legacyAuthorRouteFailure })
  }
  if (url.pathname === "/_legacy_author_route_failure" && request.method === "DELETE") {
    legacyAuthorRouteFailure = null
    return sendJson(response, 200, { failure: legacyAuthorRouteFailure })
  }
  if (url.pathname === "/_legacy_dramawebben_route_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: legacyDramawebbenRouteRequests })
  }
  if (url.pathname === "/_legacy_dramawebben_route_requests" && request.method === "DELETE") {
    legacyDramawebbenRouteRequests = []
    return sendJson(response, 200, { requests: legacyDramawebbenRouteRequests })
  }
  if (url.pathname === "/_legacy_dramawebben_route_failure" && request.method === "PUT") {
    const body = await readJson(request)
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1
      || ![
        "malformed-200",
        "extra-key-200",
        "resolver-503",
        "resolver-redirect-307",
        "resolver-redirect-308"
      ].includes(body.failure)
    ) return validationError(response)
    legacyDramawebbenRouteFailure = body.failure
    return sendJson(response, 200, { failure: legacyDramawebbenRouteFailure })
  }
  if (url.pathname === "/_legacy_dramawebben_route_failure" && request.method === "DELETE") {
    legacyDramawebbenRouteFailure = null
    return sendJson(response, 200, { failure: legacyDramawebbenRouteFailure })
  }
  if (url.pathname === "/_legacy_dramawebben_route_location" && request.method === "PUT") {
    const body = await readJson(request)
    if (
      body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1
      || typeof body.location !== "string"
    ) return validationError(response)
    legacyDramawebbenRouteLocation = body.location
    return sendJson(response, 200, { location: legacyDramawebbenRouteLocation })
  }
  if (url.pathname === "/_legacy_dramawebben_route_location" && request.method === "DELETE") {
    legacyDramawebbenRouteLocation = null
    return sendJson(response, 200, { location: legacyDramawebbenRouteLocation })
  }
  if (url.pathname === "/_legacy_dramawebben_redirect_target_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: legacyDramawebbenRedirectTargetRequests })
  }
  if (url.pathname === "/_legacy_dramawebben_redirect_target_requests" && request.method === "DELETE") {
    legacyDramawebbenRedirectTargetRequests = []
    return sendJson(response, 200, { requests: legacyDramawebbenRedirectTargetRequests })
  }
  if (url.pathname === "/_author_document_pdf_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: authorDocumentPdfRequests })
  }
  if (url.pathname === "/_author_document_pdf_requests" && request.method === "DELETE") {
    authorDocumentPdfRequests = []
    return sendJson(response, 200, { requests: authorDocumentPdfRequests })
  }
  if (url.pathname === "/_failure" && request.method === "PUT") {
    const body = await readJson(request)
    failure = body.resource ?? null
    return sendJson(response, 200, { failure })
  }
  if (url.pathname === "/_failure" && request.method === "DELETE") {
    failure = null
    return sendJson(response, 200, { failure })
  }

  const shared = sharedContent.get(url.pathname)
  if (request.method === "GET" && shared) {
    if (/^\/txt\/lb31230\/lb31230_([1-5])\/lb31230_\1_000[12]\.jpeg$/.test(url.pathname)) {
      readerJpegRequests.push(`${url.pathname}${url.search}`)
    }
    return sendBody(response, 200, shared[0], shared[1])
  }

  const home = homeContent.get(url.pathname)
  if (request.method === "GET" && home) {
    homeRequests.push(`${url.pathname}${url.search}`)
    if (homeFailure && url.pathname === "/red/om/start/startsida-ny.html") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
    }
    if (homeHostileBackground && url.pathname === "/red/om/start/startsida-ny.html") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        `<img bkg-img color="#333" src="/red/a');background:url(https://evil.test/x);/*"></img>`
          + '<p id="hostile-home-marker">Homeinnehållet är kvar</p>'
      )
    }
    return sendBody(response, 200, home[0], home[1])
  }

  const dramawebbenDocumentBody = dramawebbenDocumentContent.get(rawPathname)
  if (request.method === "GET" && dramawebbenDocumentBody && !url.search) {
    dramawebbenDocumentRequests.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization ?? null,
      cookie: request.headers.cookie ?? null
    })
    if (dramawebbenDocumentFailure === "content-404") {
      return sendBody(
        response,
        404,
        "text/plain; charset=utf-8",
        "upstream-payload-probe: content not found"
      )
    }
    if (dramawebbenDocumentFailure === "content-502") {
      return sendBody(
        response,
        502,
        "text/plain; charset=utf-8",
        "upstream-payload-probe: content unavailable"
      )
    }
    if (dramawebbenDocumentFailure === "content-redirect") {
      response.writeHead(302, {
        location: `${redirectTargetOrigin}/dramawebben-document/content`
      })
      return response.end()
    }
    if (dramawebbenDocumentFailure === "wrong-content-type") {
      return sendBody(
        response,
        200,
        "application/xhtml+xml; charset=utf-8",
        dramawebbenDocumentBody
      )
    }
    if (dramawebbenDocumentFailure === "oversized-declared") {
      return sendBody(response, 200, "text/html; charset=utf-8", oversizedDramawebbenDocument, {
        "content-length": oversizedDramawebbenDocument.length
      })
    }
    if (dramawebbenDocumentFailure === "oversized-streamed") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.write(oversizedDramawebbenDocument.subarray(0, 200_000))
      return response.end(oversizedDramawebbenDocument.subarray(200_000))
    }
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      dramawebbenDocumentFailure === "malicious"
        ? maliciousDramawebbenDocument
        : dramawebbenDocumentBody
    )
  }

  const authorDocumentPdfDisposition = authorDocumentPdfs.get(rawPathname)
  if (request.method === "GET" && authorDocumentPdfDisposition) {
    authorDocumentPdfRequests.push(request.url)
    return sendBody(response, 200, "application/pdf", authorDocumentPdf, {
      "content-disposition": authorDocumentPdfDisposition
    })
  }

  const authorDocumentAsset = authorDocumentAssets.get(rawPathname)
  if (request.method === "GET" && authorDocumentAsset && !url.search) {
    authorDocumentAssetRequests.push(rawPathname)
    return sendBody(response, 200, "image/jpeg", authorDocumentAsset)
  }

  const slaArticleBody = slaArticleContent.get(rawPathname)
  if (request.method === "GET" && slaArticleBody && !url.search) {
    slaArticleSourceRequests.push({ method: request.method, path: request.url })
    slaArticleRequestHeaders.source.push({
      authorization: request.headers.authorization ?? null,
      cookie: request.headers.cookie ?? null,
      origin: request.headers.origin ?? null
    })
    if (slaArticleSourceFailure === "status-404") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "source not found")
    }
    if (slaArticleSourceFailure === "status-503") {
      return sendBody(
        response,
        503,
        "text/plain; charset=utf-8",
        "upstream-provider-payload-probe"
      )
    }
    if (slaArticleSourceFailure === "redirect-302") {
      response.writeHead(302, {
        location: `${redirectTargetOrigin}/sla-article/source`
      })
      return response.end()
    }
    if (slaArticleSourceFailure === "wrong-media-type") {
      return sendBody(response, 200, "application/xhtml+xml; charset=utf-8", slaArticleBody)
    }
    if (slaArticleSourceFailure === "media-without-charset") {
      return sendBody(response, 200, "text/html", slaArticleBody)
    }
    if (slaArticleSourceFailure === "media-with-quoted-charset") {
      return sendBody(response, 200, "text/html; charset=\"utf-8\"", slaArticleBody)
    }
    if (slaArticleSourceFailure === "exact-declared-cap") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        exactSlaArticleContent,
        { "content-length": exactSlaArticleContent.length }
      )
    }
    if (slaArticleSourceFailure === "exact-streamed-cap") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.write(exactSlaArticleContent.subarray(0, 200_000))
      return response.end(exactSlaArticleContent.subarray(200_000))
    }
    if (slaArticleSourceFailure === "oversized-declared") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        oversizedSlaAuthorDocumentContent,
        { "content-length": oversizedSlaAuthorDocumentContent.length }
      )
    }
    if (slaArticleSourceFailure === "oversized-streamed") {
      const recordedRequest = { method: request.method, path: request.url }
      let finished = false
      response.once("finish", () => {
        finished = true
      })
      response.once("close", () => {
        if (!finished) slaArticleSourceCancellations.push(recordedRequest)
      })
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.write(oversizedSlaAuthorDocumentContent.subarray(0, 200_000))
      return setImmediate(() => {
        if (!response.destroyed) {
          response.write(oversizedSlaAuthorDocumentContent.subarray(200_000))
        }
      })
    }
    if (slaArticleSourceFailure === "rejected-stream") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.write("<!doctype html><html><body><p>upstream-provider-payload-probe")
      return setImmediate(() => request.socket.destroy())
    }
    if (slaArticleSourceFailure === "missing-body") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        "<!doctype html><html><head><title>Missing body</title></head></html>"
      )
    }
    if (slaArticleSourceFailure === "multiple-bodies") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        "<!doctype html><html><body><p>first</p></body><body><p>second</p></body></html>"
      )
    }
    return sendBody(response, 200, "text/html; charset=utf-8", slaArticleBody)
  }

  const authorDocumentBody = authorDocumentContent.get(rawPathname)
  const exactSlaSourceRequest = rawPathname !== lagerlofOmtexterna.source_path || !url.search
  if (request.method === "GET" && authorDocumentBody && exactSlaSourceRequest) {
    authorDocumentRequests.push({
      kind: "content",
      path: request.url
    })
    await waitForAuthorDocumentDelay()
    if (authorDocumentFailure === "content-404") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "content not found")
    }
    if (authorDocumentFailure === "content-503") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
    }
    if (authorDocumentFailure === "content-redirect") {
      response.writeHead(302, {
        location: `${redirectTargetOrigin}/author-document/content`
      })
      return response.end()
    }
    if (authorDocumentFailure === "fetch-rejection") {
      return request.socket.destroy()
    }
    if (authorDocumentFailure === "wrong-content-type") {
      return sendBody(
        response,
        200,
        "application/xhtml+xml; charset=utf-8",
        authorDocumentBody
      )
    }
    if (authorDocumentFailure === "oversized-declared") {
      return sendBody(
        response,
        200,
        "text/html; charset=utf-8",
        oversizedSlaAuthorDocumentContent,
        { "content-length": oversizedSlaAuthorDocumentContent.length }
      )
    }
    if (authorDocumentFailure === "oversized-streamed") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.write(oversizedSlaAuthorDocumentContent.subarray(0, 200_000))
      return response.end(oversizedSlaAuthorDocumentContent.subarray(200_000))
    }
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      authorDocumentFailure === "malformed-content"
        ? malformedAuthorDocumentContent
        : authorDocumentFailure === "oversized-content"
          ? oversizedAuthorDocumentContent
          : authorDocumentBody
    )
  }

  if (request.method === "GET" && url.pathname === "/api/get_work_info") {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerMetadataRequests.push(recordedRequest)
    const titlePath = url.searchParams.get("titlepath") || ""
    const editorWorkId = url.searchParams.get("lbworkid")
    if (editorWorkId === "lb-editor-fallback" || editorWorkId === "lb-editor-unavailable") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "editor metadata unavailable")
    }
    if (editorWorkId) {
      const editorMetadata = editorMetadataResponse(editorWorkId)
      if (editorMetadata.hits > 0) return sendJson(response, 200, editorMetadata)
    }
    await waitForReaderMetadataDelay(titlePath)
    if (titlePath === "UnavailableReader") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "reader unavailable")
    }
    if (
      titlePath === "DoktorGlasParts"
      && (
        url.searchParams.size !== 3
        || url.searchParams.get("authorid") !== "SöderbergH"
        || url.searchParams.get("exclude") !== "content_vector"
      )
    ) {
      return validationError(response)
    }
    return sendJson(response, 200, readerMetadataResponse(titlePath))
  }

  const editorPageCountMatch = request.method === "GET"
    ? /^\/count_pages\/(lb-editor-fallback|lb-editor-unavailable)\/(faksimil|etext)$/.exec(url.pathname)
    : null
  if (editorPageCountMatch) {
    if (editorPageCountMatch[1] === "lb-editor-unavailable") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "editor count unavailable")
    }
    return sendJson(response, 200, { count: 3 })
  }

  if (request.method === "GET" && url.pathname === "/legacy-api/get_work_info") {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerMetadataRequests.push(recordedRequest)
    const titlePath = url.searchParams.get("titlepath") || ""
    if (titlePath !== "Rallarliv") return sendJson(response, 200, { hits: 0, data: [] })
    if (
      url.searchParams.size !== 3
      || url.searchParams.get("authorid") !== "AarnsethF"
      || url.searchParams.get("exclude") !== "content_vector"
    ) {
      return validationError(response)
    }
    return sendJson(response, 200, readerAarnsethFacsimileWorkInfoResponse)
  }

  const readerPageMatch = request.method === "GET"
    ? /^\/txt\/lb-reader-doktor-glas\/res_0000([123])\.html$/.exec(url.pathname)
    : null
  if (readerPageMatch) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    const pageHtml = readerPageHtmlByIndex[Number(readerPageMatch[1])]
    return sendBody(response, 200, "text/html; charset=utf-8", pageHtml)
  }

  const editorEtextMatch = request.method === "GET"
    ? /^\/txt\/lb-editor-(?:doktor|doktor-glas)\/res_0000([012])\.html$/.exec(url.pathname)
    : null
  if (editorEtextMatch) {
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      `<div class="pname" onclick="globalThis.editorInjected=true">EDITORSSIDA ${editorEtextMatch[1]} <em class="emphasis">bevarad</em><a href="javascript:alert(1)">farlig länk</a><script>globalThis.editorInjected=true</script></div>`
    )
  }

  if (request.method === "GET" && /^\/txt\/lb-editor-doktor\/ocr_0000[012]\.html$/.test(url.pathname)) {
    return sendBody(response, 200, "text/html; charset=utf-8", '<body><div data-size="2500x3600"><span class="w">OCR</span></div></body>')
  }

  const editorBoyeOcrMatch = request.method === "GET"
    ? /^\/txt\/(lb8345227|lb-editor-boye)\/ocr_0000([4-6])\.html$/.exec(url.pathname)
    : null
  if (editorBoyeOcrMatch) {
    const pageName = String(Number(editorBoyeOcrMatch[2]) + 1)
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      `<body><div data-size="2500x3600"><span class="w" id="w${pageName}_1">brev</span> <span class="w" id="w${pageName}_2">till</span></div></body>`
    )
  }

  if (request.method === "GET" && /^\/txt\/lb-editor-fallback\/ocr_0000[012]\.html$/.test(url.pathname)) {
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<body><div data-size="625x900" id="toolkit-right" class="absolute parent" style="width:999999999999px;left:10px"><span id="mainview" class="w pointer-events-auto" onclick="alert(1)" style="top:12px">SAFE OCR</span><script>alert(1)</script></div></body>'
    )
  }

  if (
    ["GET", "HEAD"].includes(request.method) &&
    /^\/txt\/lb-editor-size-four\/lb-editor-size-four_4\/lb-editor-size-four_4_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    editorFacsimileRequests.push({ method: request.method, path: url.pathname })
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (
    ["GET", "HEAD"].includes(request.method) &&
    /^\/txt\/(lb8345227|lb-editor-(?:boye|doktor|fallback|malformed-contributor|malformed-part|no-contributors|no-ocr|mixed|long|sparse))\/\1_[234]\/\1_[234]_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  const readerPartsPageMatch = request.method === "GET"
    ? /^\/txt\/lb-reader-doktor-glas-parts\/res_0000([1-9])\.html$/.exec(url.pathname)
    : null
  if (readerPartsPageMatch) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    const pageIndex = Number(readerPartsPageMatch[1])
    const pageHtml = pageIndex === 3
      ? readerPageHtmlByIndex[2]
      : readerPartsPageHtmlByIndex[pageIndex]
    return sendBody(response, 200, "text/html; charset=utf-8", pageHtml)
  }

  const sparseKeyboardPageMatch = request.method === "GET"
    ? /^\/txt\/lb-reader-sparse-keyboard\/res_(00002|00012|00057)\.html$/.exec(
        url.pathname
      )
    : null
  if (sparseKeyboardPageMatch) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    const pageIndex = Number(sparseKeyboardPageMatch[1])
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      `<div class="pname" pname="${pageIndex}">Sparse page ${pageIndex}</div>`
    )
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb-reader-one-page/res_00000.html"
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<div class="pname" pname="0">En sida</div>'
    )
  }

  const workScopedReaderPageMatch = request.method === "GET"
    ? /^\/txt\/lb7604979\/res_000(13|14)\.html$/.exec(url.pathname)
    : null
  if (workScopedReaderPageMatch) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    const pageHtml = workScopedReaderPageHtmlByIndex[Number(workScopedReaderPageMatch[1])]
    return sendBody(response, 200, "text/html; charset=utf-8", pageHtml)
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb238704/res_00001.html"
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<div class="pname" pname="1"><span class="w" id="w1_10">ropade</span> <span class="w" id="w1_11">frihet</span> <span class="w" id="w1_12">och</span></div>'
    )
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb-reader-forvillelser/res_00003.html"
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      forvillelserReaderPageHtml
    )
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb-reader-gosta-berlings-saga/res_00001.html"
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerHtmlRequests.push(recordedRequest)
    return sendBody(response, 200, "text/html; charset=utf-8", "<div>HTML fixture</div>")
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb-reader-boye-jordiskt/res_00001.html"
  ) {
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<div class="pname" pname="3"><span class="w">ETT VERKLIGT JORDISKT</span></div>'
    )
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb-reader-gosta-berlings-saga\/ocr_\d{5}\.html$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerOcrRequests.push(recordedRequest)
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<body><div data-size="625x900"><span id="w3_147" class="w">OCR fixture</span></div></body>'
    )
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/lb-reader-boye-jordiskt/ocr_00001.html"
  ) {
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<body><div data-size="625x900"><span class="w">Boye OCR</span></div></body>'
    )
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb3203777\/ocr_(?:00002|00057|00098)\.html$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerOcrRequests.push(recordedRequest)
    const content = url.pathname.endsWith("00057.html")
      ? '<span class="w" style="top: 364px; left: 255.4px; font-size: 16.3408px"><span id="w58_123">kyrka </span><span id="w58_123">. </span></span>'
      : url.pathname.endsWith("00098.html")
        ? '<span class="w"><span id="w99_20">kyrka </span><span id="w99_21">igen</span></span>'
        : '<span class="w"><span id="w3_10">kyrka</span></span>'
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      `<div data-size="488.160004x756">${content}</div>`
    )
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb3203777\/lb3203777_[1-5]\/lb3203777_[1-5]_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerJpegRequests.push(recordedRequest)
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb-reader-gosta-berlings-saga\/lb-reader-gosta-berlings-saga_[1-5]\/lb-reader-gosta-berlings-saga_[1-5]_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerJpegRequests.push(recordedRequest)
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb-reader-sparse-facsimile-sizes\/lb-reader-sparse-facsimile-sizes_[24]\/lb-reader-sparse-facsimile-sizes_[24]_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerJpegRequests.push(recordedRequest)
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb-reader-boye-jordiskt\/lb-reader-boye-jordiskt_[1-5]\/lb-reader-boye-jordiskt_[1-5]_0003\.jpeg$/.test(url.pathname)
  ) {
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (
    request.method === "GET"
    && /^\/txt\/lb-reader-doktor-glas\/lb-reader-doktor-glas_[1-5]\/lb-reader-doktor-glas_[1-5]_\d{4}\.jpeg$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerJpegRequests.push(recordedRequest)
    return sendBody(response, 200, "image/jpeg", readerFacsimileJpeg)
  }

  if (request.method === "GET" && url.pathname === "/red/css/etext.css") {
    readerRequests.push(`${url.pathname}${url.search}`)
    return sendBody(response, 200, "text/css; charset=utf-8", sharedReaderCss)
  }

  if (
    request.method === "GET" &&
    (
      url.pathname === "/txt/css/lb-reader-doktor-glas-etext.css" ||
      url.pathname === "/txt/css/lb-reader-doktor-glas-parts-etext.css" ||
      url.pathname === "/txt/css/lb-reader-boye-jordiskt-etext.css" ||
      url.pathname === "/txt/css/lb238704-etext.css" ||
      url.pathname === "/txt/css/lb7604979-etext.css"
    )
  ) {
    readerRequests.push(`${url.pathname}${url.search}`)
    return sendBody(response, 200, "text/css; charset=utf-8", workReaderCss)
  }

  if (
    request.method === "GET"
    && url.pathname === "/txt/css/lb-reader-forvillelser-etext.css"
  ) {
    readerRequests.push(`${url.pathname}${url.search}`)
    return sendBody(response, 200, "text/css; charset=utf-8", forvillelserReaderCss)
  }

  if (request.method === "GET" && url.pathname === "/bilder/ornament/reader-fixture.png") {
    readerRequests.push(`${url.pathname}${url.search}`)
    return sendBody(response, 200, "image/png", Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    ))
  }

  if (
    request.method === "GET"
    && /^\/export\/faksimil(?:\/|$)/.test(url.pathname)
  ) {
    exportFaksimilRequests.push(`${url.pathname}${url.search}`)
    return sendBody(
      response,
      200,
      "application/pdf",
      Buffer.from("author-works-generated-pdf-fixture")
    )
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/litteraturkartan" || url.pathname.startsWith("/litteraturkartan/"))
  ) {
    litteraturkartanRequests.push(`${url.pathname}${url.search}`)
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      '<!doctype html><html><body><main id="litteraturkartan-upstream-fixture">Litteraturkartan upstream fixture</main></body></html>'
    )
  }

  if (request.method === "GET" && isPresentationRequest(url.pathname)) {
    presentationRequests.push(`${url.pathname}${url.search}`)
    const content = presentationContent.get(url.pathname)
    if (!content) {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    let [resource, contentType, body] = content
    if (presentationFailures.has(resource)) {
      return sendBody(response, 503, "text/plain; charset=utf-8", `${resource} unavailable`)
    }
    if (
      presentationProductionShape
      && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
    ) {
      contentType = "text/xml; charset=utf-8"
      body = productionSizedPresentationBackground
    }
    if (
      presentationHostileSubresources
      && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
    ) {
      body = Buffer.from(body).toString("utf8").replace(
        "</backgrounds>",
        [
          '<background target="/presentationer/specialomraden/ProductionSized.html">',
          '<style>@import url(https://evil.test/background-import.css); html { background-image: url(https://evil.test/background-image.jpg); } html { background-image: image-set("https://evil.test/background-image-set.jpg" 1x); }</style>',
          "</background>",
          "</backgrounds>"
        ].join("")
      )
    }
    if (
      presentationHostileSubresources
      && url.pathname === "/red/presentationer/specialomraden/ProductionSized.html"
    ) {
      body = Buffer.from(body).toString("utf8")
        .replace("</head>", [
          '<style>p.image { text-align: center; }</style>',
          '<style>@import url(https://evil.test/document-import.css); #css-safe-marker { background-image: url(https://evil.test/document-image.jpg); } #css-safe-marker { background-image: image-set("https://evil.test/document-image-set.jpg" 1x); }</style>',
          "</head>"
        ].join(""))
        .replace("</body>", [
        '<p id="css-safe-marker" class="image">Safe inline CSS remains active.</p>',
        '<img id="owned-subresource" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg">',
        '<img id="external-attribution" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg" attributionsrc="https://evil.test/image-attribution">',
        '<img id="external-src" src="https://evil.test/src.jpg">',
        '<img id="external-srcset" srcset="https://evil.test/srcset.jpg 1x">',
        '<table id="legacy-background" background="https://evil.test/background.jpg"><tr><td>Legacy</td></tr></table>',
        '<p id="inline-style" style="background-image:url(https://evil.test/style.jpg)">Styled</p>',
        "</body>"
        ].join(""))
    }
    return sendBody(response, 200, contentType, body)
  }

  if (request.method === "GET" && ["/api/imprint_range", "/legacy-api/imprint_range"]
    .includes(url.pathname)) {
    libraryImprintRequests.push({ path: url.pathname })
    if (libraryImprintFailure) {
      return sendJson(response, 503, {
        error: { code: "imprint_range_unavailable", message: "Unable to load imprint range" }
      })
    }
    return sendJson(response, 200, structuredClone(libraryImprintRange))
  }

  if (request.method === "GET" && ["/api/get_authorkeywords", "/legacy-api/get_authorkeywords"]
    .includes(url.pathname)) {
    libraryMetadataRequests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) })
    const ids = structuredClone(textSearchAboutAuthors)
    if (libraryMetadataVariant === "duplicate-keywords") ids.push("LagerlöfS")
    return sendJson(response, 200, ids)
  }

  if (request.method === "GET" && ["/api/get_authors", "/legacy-api/get_authors"]
    .includes(url.pathname)
    && url.searchParams.size === 1
    && libraryAuthorExcludeValues.has(url.searchParams.get("exclude") || "")) {
    libraryMetadataRequests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) })
    const authors = structuredClone(textSearchAuthors)
    if (libraryMetadataVariant === "duplicate-authors") {
      authors.push({
        ...authors.find(author => author.authorid === "LagerlöfS"),
        full_name: "Duplicerad Lagerlöf"
      })
    }
    return sendJson(response, 200, { data: authors })
  }

  if (request.method === "POST" && ["/api/download", "/legacy-api/download"]
    .includes(url.pathname)) {
    const body = new URLSearchParams(await readText(request))
    const files = (body.get("files") || "").split(",").filter(Boolean)
    libraryDownloadRequests.push({ path: url.pathname, files })
    return sendJson(response, 200, { files })
  }

  if (request.method === "GET" && libraryQueryPaths.has(url.pathname)) {
    const query = Object.fromEntries(url.searchParams)
    const pdfQuery = isLibraryPdfQuery(query)
    const queryFailure = libraryQueryFailure
    libraryQueryRequests.push({ path: url.pathname, query })
    await waitForLibraryQueryDelay(query)
    if (queryFailure) {
      return sendJson(response, 503, {
        error: {
          code: "library_query_unavailable",
          message: pdfQuery
            ? "Unable to load Library PDFs"
            : "Unable to load Library EPUBs"
        }
      })
    }
    return sendJson(
      response,
      200,
      url.pathname.endsWith("/etext-part,faksimil-part")
        ? libraryPartsResponseForQuery(query)
        : pdfQuery ? libraryPdfResponse(query) : libraryQueryStringResponse(query)
    )
  }

  const libraryRelevancePath = url.pathname.replace(/^\/(?:legacy-api|api)(?=\/)/, "")
  if (request.method === "GET" && libraryRelevancePath.startsWith("/relevance/")) {
    const query = Object.fromEntries(url.searchParams)
    libraryRelevanceRequests.push({ path: url.pathname, query })
    await waitForLibraryRelevanceDelay(query)
    if (libraryRelevanceFailure) {
      return sendJson(response, 503, {
        error: { code: "library_relevance_unavailable", message: "Unable to search Library" }
      })
    }
    const resultTypes = libraryRelevancePath.slice("/relevance/".length)
    return sendJson(
      response,
      200,
      libraryRelevanceResponse(query.q || "", resultTypes, query.from, query.to)
    )
  }

  const content = aboutContent.get(url.pathname)
  if (request.method === "GET" && content) {
    requests.push(`${url.pathname}${url.search}`)
    if (failure === "content" && content[0].startsWith("text/html")) {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
    }
    return sendBody(response, 200, content[0], content[1])
  }

  if (request.method === "POST" && apiPathname === "/v2/contact") {
    requests.push(`${url.pathname}${url.search}`)
    const submission = await readJson(request)
    contactSubmissions.push(submission)
    const release = await waitForContactRelease(submission)
    if (release.failure || failure === "contact") {
      return sendJson(response, 502, {
        error: {
          code: "contact_delivery_failed",
          message: "Unable to send contact message",
          details: null
        }
      })
    }
    return sendJson(response, 202, { status: "accepted" })
  }

  if (request.method === "GET" && apiPathname === "/v2/quick-search") {
    const query = url.searchParams.get("query") || ""
    quickSearchQueries.push(query)
    await waitForQuickSearchDelay(query)
    if (quickSearchFailure) {
      return sendJson(response, 503, {
        error: {
          code: "quick_search_unavailable",
          message: "Unable to load quick-search results",
          details: null
        }
      })
    }
    return sendJson(response, 200, quickSearchResponse(query))
  }

  if (request.method === "GET" && apiPathname === "/v2/dramawebben/catalog") {
    dramawebbenCatalogRequests.push({
      method: request.method,
      path: `${rawPathname}${url.search}`,
      authorization: request.headers.authorization ?? null,
      cookie: request.headers.cookie ?? null
    })
    if (dramawebbenCatalogFailure === "status-503") {
      return sendJson(response, 503, {
        error: {
          code: "dramawebben_catalog_unavailable",
          message: "Unable to load Dramawebben catalog",
          details: null
        }
      })
    }
    if (dramawebbenCatalogFailure === "malformed-200") {
      return sendJson(response, 200, {
        works: [{ title: "upstream-payload-probe" }],
        authors: []
      })
    }
    if (dramawebbenCatalogFailure === "unsafe-media-url-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.works[0].media[0].url = "javascript:alert('unsafe-media-url-probe')"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "backslash-media-url-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.works[0].media[0].url = "/författare/AgrellA\\escaped/titlar/Domd/sida/I/etext"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "dot-segment-media-url-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.works[0].media[0].url = "/författare/../titlar/Domd/sida/I/etext"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "dot-segment-infopost-url-200") {
      const catalog = dramawebbenCatalogFixture()
      const infopost = catalog.works
        .flatMap(work => work.media)
        .find(media => media.media_type === "infopost")
      infopost.url = "/dramawebben/%2e%2e/dramawebben/pj%C3%A4ser?om-boken"
        + "&authorid=Alml%C3%B6fN&titlepath=Affarer"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "reordered-infopost-query-200") {
      const catalog = dramawebbenCatalogFixture()
      const infopost = catalog.works
        .flatMap(work => work.media)
        .find(media => media.media_type === "infopost")
      infopost.url = "/dramawebben/pj%C3%A4ser?authorid=Alml%C3%B6fN"
        + "&titlepath=Affarer&om-boken"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "additive-catalog-fields-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.future_catalog_field = { version: 2 }
      catalog.works[0].future_work_field = "ignored"
      catalog.works[0].authors[0].future_author_field = "ignored"
      catalog.works[0].media[0].future_media_field = "ignored"
      catalog.authors[0].future_author_field = "ignored"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "array-media-type-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.works[0].media[0].media_type = ["etext"]
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "unsafe-author-id-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.authors[0].author_id = "unsafe\ud800author"
      catalog.works[0].authors[0].author_id = "unsafe\ud800author"
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "omitted-range-field-200") {
      const catalog = dramawebbenCatalogFixture()
      delete catalog.works[0].number_of_pages
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "pdf-primary-200") {
      const catalog = dramawebbenCatalogFixture()
      catalog.works[0].media = [{
        media_type: "pdf",
        url: "/txt/lb-dramat-001/lb-dramat-001.pdf",
        downloadable: true
      }]
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "secondary-female-author-200") {
      const catalog = dramawebbenCatalogFixture()
      const target = catalog.works.find(work => work.work_id === "lb-dramat-002")
      const primary = catalog.authors.find(author => author.author_id === "StrindbergA")
      const secondary = catalog.authors.find(author => author.author_id === "WahlenbergA")
      if (target && primary && secondary) target.authors = [primary, secondary]
      return sendJson(response, 200, catalog)
    }
    if (dramawebbenCatalogFailure === "long-mixed-media-author-200") {
      const catalog = dramawebbenCatalogFixture()
      const target = catalog.works.find(work => work.work_id === "lb-dramat-002")
      const firstAuthor = catalog.authors.find(author => author.author_id === "WahlenbergA")
      if (target && firstAuthor) {
        const infopostAuthor = target.authors[0]
        target.authors = [firstAuthor, infopostAuthor]
        target.media.unshift({
          media_type: "faksimil",
          url: "/författare/WahlenbergA/titlar/BarnensTeater/sida/1/faksimil",
          downloadable: false
        })
        const filler = catalog.works[0]
        catalog.works = [
          ...Array.from({ length: 24 }, (_, index) => ({
            ...filler,
            work_id: `${filler.work_id}-scroll-${index}`,
            title_path: `${filler.title_path}Scroll${index}`,
            title: `${filler.title} ${index + 1}`,
            short_title: `${filler.short_title} ${index + 1}`
          })),
          target
        ]
      }
      return sendJson(response, 200, catalog)
    }
    return sendJson(response, 200, dramawebbenCatalogFixture())
  }

  if (apiPathname === "/v2/library/options") {
    if (request.method !== "GET") return methodNotAllowed(response, ["GET"])
    if ([...url.searchParams.keys()].length > 0) return validationError(response)
    libraryV2Requests.options.push({
      method: request.method,
      path: url.pathname,
      scope: url.pathname.startsWith("/private-v2/") ? "private" : "public"
    })
    if (libraryV2Delays.options > 0) {
      await new Promise(resolve => setTimeout(resolve, libraryV2Delays.options))
    }
    return sendJson(response, 200, {
      chronology: libraryV2Failures.options.has("chronology")
        ? null
        : { year_from: 1800, year_to: 2026 },
      about_authors: libraryV2Failures.options.has("about_authors")
        ? null
        : [{ author_id: "LagerlofS", label: "Selma Lagerlöf" }]
    })
  }

  const libraryOperationMatch = /^\/v2\/library\/(search|counts)$/.exec(apiPathname)
  if (libraryOperationMatch) {
    const operation = libraryOperationMatch[1]
    if (request.method !== "POST") return methodNotAllowed(response, ["POST"])
    if ([...url.searchParams.keys()].length > 0) return validationError(response)
    const rawContentType = request.headers["content-type"]
    const contentType = typeof rawContentType === "string"
      ? rawContentType.split(";", 1)[0].trim().toLowerCase()
      : ""
    if (contentType !== "application/json") return validationError(response)
    let body
    try { body = await readJson(request) } catch { return validationError(response) }
    const valid = operation === "search"
      ? validLibrarySearchBody(body)
      : validLibraryCountBody(body)
    if (!valid) return validationError(response)
    libraryV2Requests[operation].push({
      method: request.method,
      path: url.pathname,
      scope: url.pathname.startsWith("/private-v2/") ? "private" : "public",
      body
    })
    const identity = canonicalLibraryIdentity(body)
    const delay = libraryV2Delays[operation][identity] ?? 0
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
    if (operation === "search" && libraryV2Failures.search.has(body.mode)) {
      return sendJson(response, 503, {
        error: {
          code: "library_search_unavailable",
          message: "Unable to load Library results",
          details: null
        }
      })
    }
    if (operation === "counts" && libraryV2Failures.counts.has(body.mode)) {
      return sendJson(response, 200, body.mode === "works" || body.mode === "parts"
        ? { mode: body.mode, total: null, author_ids: null }
        : { mode: body.mode, total: null })
    }
    return sendJson(response, 200, operation === "search"
      ? librarySearchResponse(body)
      : libraryCountResponse(body.mode, body.filters))
  }

  if (apiPathname === "/v2/text-search/chronology") {
    if (request.method !== "GET") return methodNotAllowed(response, ["GET"])
    const recordedRequest = {
      method: request.method,
      path: url.pathname,
      body: {},
      started_at: Date.now(),
      completed_at: null,
      results_started_before_completion: null
    }
    textSearchRequests.chronology.push(recordedRequest)
    await waitForTextSearchDelay("chronology", {})
    recordedRequest.completed_at = Date.now()
    recordedRequest.results_started_before_completion = textSearchRequests.results.length
    if (textSearchFailures.has("chronology")) {
      return sendJson(response, 503, {
        error: {
          code: "text_search_chronology_unavailable",
          message: "Unable to load text-search chronology",
          details: null
        }
      })
    }
    return sendJson(response, 200, textSearchAuthorityMode
      ? { year_from: 1800, year_to: 1950 }
      : { year_from: 1248, year_to: 2026 })
  }

  const textSearchMatch = /^\/v2\/text-search\/(results|count|options)$/.exec(apiPathname)
  if (textSearchMatch) {
    const operation = textSearchMatch[1]
    if (request.method !== "POST") {
      return sendJson(response, 405, {
        error: { code: "method_not_allowed", message: "Method not allowed", details: null }
      })
    }
    const rawContentType = request.headers["content-type"]
    const contentType = typeof rawContentType === "string"
      ? rawContentType.split(";", 1)[0].trim().toLowerCase()
      : ""
    if (contentType !== "application/json") {
      return validationError(response)
    }
    let body
    try {
      body = await readJson(request)
    } catch {
      return sendJson(response, 400, {
        error: { code: "invalid_json", message: "Malformed JSON body", details: null }
      })
    }
    if (!validTextSearchBody(operation, body)) return validationError(response)

    textSearchRequests[operation].push({ method: request.method, path: url.pathname, body })
    await waitForTextSearchDelay(operation, body)
    if (textSearchFailures.has(operation)) {
      const messages = {
        results: "Unable to load text-search results",
        count: "Unable to count text-search results",
        options: "Unable to load text-search options"
      }
      return sendJson(response, 503, {
        error: {
          code: `text_search_${operation}_unavailable`,
          message: messages[operation],
          details: null
        }
      })
    }
    return sendJson(response, 200, textSearchResponse(operation, body))
  }

  if (request.method === "POST" && apiPathname === "/v2/works/lookup") {
    const body = await readJson(request)
    workLookupRequests.push({ path: url.pathname, body })
    await waitForWorkLookupDelay(body)
    if (workLookupFailure) {
      return sendJson(response, 503, {
        error: {
          code: "work_lookup_unavailable",
          message: "Unable to load ID lookup results",
          details: null
        }
      })
    }
    return sendJson(response, 200, workLookupResponse(body))
  }

  if (request.method === "POST" && apiPathname === "/v2/authors/resolve") {
    const body = await readJson(request)
    const authorIds = normalizedAuthorIds(body)
    if (authorIds === null) {
      return sendJson(response, 422, {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }

    authorResolveRequests.push({ path: url.pathname, body })
    await waitForAuthorResolveDelay(body)
    if (authorResolveFailure) {
      return sendJson(response, 503, {
        error: {
          code: "author_resolve_unavailable",
          message: "Unable to resolve authors",
          details: null
        }
      })
    }

    if (authorResolveScenario === "disconnect") {
      request.socket.destroy()
      return
    }

    const authorsById = new Map(
      [
        ...historyAuthorSummaries,
        {
          author_id: "SöderbergH",
          full_name: "Hjalmar Söderberg",
          surname: "Söderberg"
        },
        {
          author_id: "MörikeE",
          full_name: "Eduard Mörike",
          surname: "Mörike"
        },
        {
          author_id: "RilkeRM",
          full_name: "Rainer Maria Rilke",
          surname: "Rilke"
        },
        {
          author_id: "ShelleyPB",
          full_name: "Percy Bysshe Shelley",
          surname: "Shelley"
        },
        {
          author_id: "NullSurnameAuthor",
          full_name: "Förnamn Efternamn",
          surname: null
        },
        {
          author_id: "DramaRedaktionen",
          full_name: "Dramawebbens redaktion",
          surname: null
        },
        {
          author_id: "LindgrenU",
          full_name: "Ulrika Lindgren",
          surname: "Lindgren"
        },
        {
          author_id: "Anonym",
          full_name: "Anonym",
          surname: "Anonym"
        }
      ].map(author => [author.author_id, author])
    )
    const items = authorIds.flatMap(authorId => {
      const author = authorsById.get(authorId)
      return author ? [author] : []
    })
    const first = items[0] || {
      author_id: authorIds[0],
      full_name: "Fixture Author",
      surname: "Author"
    }
    const scenarioResponses = {
      primitive: "malformed",
      "wrong-container": [],
      "non-array-items": { items: {} },
      "oversized-items": { items: Array.from({ length: 51 }, () => first) },
      "extra-top-key": { items, unexpected: true },
      "malformed-item": { items: [null] },
      "extra-item-key": { items: [{ ...first, unexpected: true }] },
      duplicate: { items: [first, first] },
      unrequested: {
        items: [{ author_id: "OtherAuthor", full_name: "Other Author", surname: "Author" }]
      },
      "empty-id": { items: [{ ...first, author_id: "" }] },
      "whitespace-id": { items: [{ ...first, author_id: ` ${first.author_id}` }] },
      "control-id": { items: [{ ...first, author_id: `${first.author_id}\n` }] },
      "overlong-id": { items: [{ ...first, author_id: "a".repeat(101) }] },
      "empty-name": { items: [{ ...first, full_name: "" }] },
      "whitespace-name": { items: [{ ...first, full_name: ` ${first.full_name}` }] },
      "control-name": { items: [{ ...first, full_name: `${first.full_name}\n` }] },
      "overlong-name": { items: [{ ...first, full_name: "n".repeat(2_001) }] },
      "wrong-surname": { items: [{ ...first, surname: 42 }] },
      "empty-surname": { items: [{ ...first, surname: "" }] },
      "whitespace-surname": { items: [{ ...first, surname: ` ${first.surname || "Author"}` }] },
      "control-surname": { items: [{ ...first, surname: `${first.surname || "Author"}\n` }] },
      "overlong-surname": { items: [{ ...first, surname: "s".repeat(2_001) }] }
    }
    return sendJson(
      response,
      200,
      authorResolveScenario && Object.hasOwn(scenarioResponses, authorResolveScenario)
        ? scenarioResponses[authorResolveScenario]
        : { items }
    )
  }

  const similarWorkIdentity = request.method === "GET"
    ? decodedSimilarWorkId(rawApiPathname)
    : null
  if (similarWorkIdentity !== null) {
    similarWorkRequests.push({
      scope: rawPathname.startsWith("/private-v2/") ? "private" : "public",
      path: rawPathname,
      query: url.search
    })
    const mediaType = requiredSimilarMedia(url.searchParams)
    if (!similarWorkIdentity.valid || mediaType === null) {
      return validationError(response)
    }
    if (similarWorkFailure) {
      return sendJson(response, 503, {
        error: {
          code: "backend_unavailable",
          message: "Search backend unavailable",
          details: null
        }
      })
    }
    if (similarWorkMalformed) {
      return sendJson(response, 200, {
        items: [{ ...doktorGlasSimilarWorks.items[0], label: "Bebådelse\n" }]
      })
    }
    return sendJson(
      response,
      200,
      similarWorkIdentity.workId === "lb1728740"
        ? doktorGlasSimilarWorks
        : { items: [] }
    )
  }

  const sourceInfoIdentity = request.method === "GET"
    ? decodedSourceInfoIdentity(rawApiPathname)
    : null
  if (sourceInfoIdentity !== null) {
    sourceInfoRequests.push({
      scope: rawPathname.startsWith("/private-v2/") ? "private" : "public",
      path: rawPathname,
      query: url.search
    })
    const mediaType = sourceInfoMedia(url.searchParams)
    if (!sourceInfoIdentity.valid || mediaType === null && url.searchParams.has("media_type")) {
      return validationError(response)
    }
    await waitForSourceInfoDelay(sourceInfoIdentity.authorId, sourceInfoIdentity.titlePath)
    if (sourceInfoFailure) {
      return sendJson(response, 503, {
        error: {
          code: "source_info_unavailable",
          message: "Unable to load source information",
          details: null
        }
      })
    }
    if (
      sourceInfoIdentity.authorId === "ValidationA"
      && sourceInfoIdentity.titlePath === "ValidationTitle"
    ) {
      return validationError(response)
    }
    if (
      sourceInfoIdentity.authorId === "ServerErrorA"
      && sourceInfoIdentity.titlePath === "ServerErrorTitle"
    ) {
      return sendJson(response, 500, {
        error: {
          code: "source_info_invalid_source",
          message: "Invalid source information",
          details: null
        }
      })
    }
    const item = sourceInfoIdentity.authorId === "CanonicalNotPublicA"
      && sourceInfoIdentity.titlePath === "DoktorGlas"
      ? {
          ...sourceInfoByIdentity.get("SöderbergH|DoktorGlas"),
          author_id: "OtherAuthor"
        }
      : sourceInfoIdentity.authorId === "SparseA"
        && sourceInfoIdentity.titlePath === "SparseTitle"
        && mediaType === "etext"
        ? navigableSparseSourceInfo
        : sourceInfoByIdentity.get(
          `${sourceInfoIdentity.authorId}|${sourceInfoIdentity.titlePath}`
        )
    if (!item) {
      return sendJson(response, 404, {
        error: { code: "source_info_not_found", message: "Work not found", details: null }
      })
    }
    if (
      mediaType !== null && item.media_type !== mediaType
      && sourceInfoIdentity.authorId !== "SöderbergH"
      && sourceInfoIdentity.authorId !== "AlmlöfN"
    ) {
      return sendJson(response, 404, {
        error: { code: "source_info_not_found", message: "Work not found", details: null }
      })
    }
    return sendJson(response, 200, item)
  }

  const slaArticleCandidate = request.method === "GET" && !url.search
    ? /^\/v2\/authors\/([^/]+)\/documents\/omtexterna\/articles\/([^/]+)$/.exec(
        rawApiPathname
      )
    : null
  if (slaArticleCandidate) {
    let authorId
    let articleId
    try {
      authorId = decodeURIComponent(slaArticleCandidate[1])
      articleId = decodeURIComponent(slaArticleCandidate[2])
    } catch {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    const descriptor = authorId === "LagerlöfS"
      ? slaArticleDescriptorMap.get(articleId)
      : null
    if (!descriptor) {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    slaArticleDescriptorRequests.push({ method: request.method, path: request.url })
    slaArticleRequestHeaders.descriptor.push({
      authorization: request.headers.authorization ?? null,
      cookie: request.headers.cookie ?? null,
      origin: request.headers.origin ?? null
    })
    if (slaArticleDescriptorFailure === "status-404") {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    if (slaArticleDescriptorFailure === "status-503") {
      return sendJson(response, 503, {
        error: {
          code: "sla_article_unavailable",
          message: "upstream-provider-payload-probe",
          details: null
        }
      })
    }
    if (
      slaArticleDescriptorFailure === "redirect-307"
      || slaArticleDescriptorFailure === "redirect-308"
    ) {
      response.writeHead(Number(slaArticleDescriptorFailure.slice(-3)), {
        location: `${redirectTargetOrigin}/sla-article/descriptor`
      })
      return response.end()
    }
    if (slaArticleDescriptorFailure === "malformed-json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" })
      return response.end("{")
    }
    if (slaArticleDescriptorFailure === "source-query") {
      return sendJson(response, 200, {
        ...descriptor,
        source_path: `${descriptor.source_path}?authority=lost`
      })
    }
    if (slaArticleDescriptorFailure === "extra-field") {
      return sendJson(response, 200, {
        ...descriptor,
        unexpected: "must not cross the private boundary"
      })
    }
    return sendJson(response, 200, descriptor)
  }

  const authorDocumentCandidate = request.method === "GET"
    ? /^\/v2\/authors\/([^/]+)\/documents\/(presentation|bibliografi|semer|omtexterna)$/.exec(rawApiPathname)
    : null
  const authorDocumentMatch = authorDocumentCandidate?.[2] !== "omtexterna" || !url.search
    ? authorDocumentCandidate
    : null
  if (authorDocumentMatch) {
    authorDocumentRequests.push({
      kind: "descriptor",
      path: request.url
    })
    let authorId
    try {
      authorId = decodeURIComponent(authorDocumentMatch[1])
    } catch {
      return validationError(response)
    }
    const valid = authorId.length >= 1
      && authorId.length <= 100
      && authorId.trim() === authorId
      && !authorId.includes("%")
      && !authorId.includes("/")
      && !authorId.includes("\\")
      && !/\p{Cc}/u.test(authorId)
      && authorId !== "."
      && authorId !== ".."
    if (!valid) return validationError(response)

    await waitForAuthorDocumentDelay()
    if (authorDocumentFailure === "descriptor-404") {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    if (authorDocumentFailure === "descriptor-503") {
      return sendJson(response, 503, {
        error: {
          code: "author_document_unavailable",
          message: "Unable to load author document",
          details: null
        }
      })
    }
    if (
      authorDocumentFailure === "descriptor-redirect-307"
      || authorDocumentFailure === "descriptor-redirect-308"
    ) {
      const status = Number(authorDocumentFailure.slice(-3))
      response.writeHead(status, {
        location: `${redirectTargetOrigin}/author-document/descriptor`
      })
      return response.end()
    }

    const descriptor = authorDocumentDescriptors.get(
      `${authorId}|${authorDocumentMatch[2]}`
    )
    if (!descriptor) {
      return sendJson(response, 404, {
        error: { code: "not_found", message: "Resource not found", details: null }
      })
    }
    if (authorDocumentFailure === "malformed-descriptor") {
      return sendJson(response, 200, { ...descriptor, full_name: null })
    }
    if (authorDocumentFailure === "unsafe-source-path") {
      return sendJson(response, 200, {
        ...descriptor,
        source_path: "//evil.test/index.html"
      })
    }
    return sendJson(response, 200, descriptor)
  }

  if (request.method === "POST" && rawApiPathname === "/v2/legacy-author-routes/resolve") {
    const body = await readJson(request)
    legacyAuthorRouteRequests.push({ path: request.url, body })
    if (legacyAuthorRouteFailure === "malformed-200") {
      return sendJson(response, 200, { author_id: 7, title_id: null })
    }
    if (legacyAuthorRouteFailure === "extra-key-200") {
      return sendJson(response, 200, {
        author_id: "LagerlöfS",
        title_id: null,
        unexpected: "must not cross the private boundary"
      })
    }
    if (legacyAuthorRouteFailure === "resolver-503") {
      return sendJson(response, 503, {
        error: {
          code: "legacy_author_route_unavailable",
          message: "Unable to resolve legacy author route",
          details: null
        }
      })
    }
    if (
      legacyAuthorRouteFailure === "resolver-redirect-307"
      || legacyAuthorRouteFailure === "resolver-redirect-308"
    ) {
      const status = Number(legacyAuthorRouteFailure.slice(-3))
      response.writeHead(status, {
        location: `${redirectTargetOrigin}/author-route/resolution`
      })
      return response.end()
    }
    const resolution = legacyAuthorRouteResolution(body)
    if (resolution) return sendJson(response, 200, resolution)
    return sendJson(response, 404, {
      error: {
        code: "legacy_author_route_not_found",
        message: "Legacy route not found",
        details: null
      }
    })
  }

  if (
    request.method === "POST"
    && rawApiPathname === "/v2/dramawebben/legacy-routes/resolve"
  ) {
    const body = await readJson(request)
    legacyDramawebbenRouteRequests.push({ path: request.url, body })
    if (legacyDramawebbenRouteLocation !== null) {
      return sendJson(response, 200, { location: legacyDramawebbenRouteLocation })
    }
    if (legacyDramawebbenRouteFailure === "malformed-200") {
      return sendJson(response, 200, { location: 7 })
    }
    if (legacyDramawebbenRouteFailure === "extra-key-200") {
      return sendJson(response, 200, {
        location: "/författare/StrindbergA/dramawebben",
        private: "must not cross the boundary"
      })
    }
    if (legacyDramawebbenRouteFailure === "resolver-503") {
      return sendJson(response, 503, {
        error: {
          code: "legacy_dramawebben_route_unavailable",
          message: "Unable to resolve legacy Dramawebben route",
          details: null
        }
      })
    }
    if (
      legacyDramawebbenRouteFailure === "resolver-redirect-307"
      || legacyDramawebbenRouteFailure === "resolver-redirect-308"
    ) {
      const status = Number(legacyDramawebbenRouteFailure.slice(-3))
      response.writeHead(status, {
        location: `${redirectTargetOrigin}/legacy-dramawebben-route/resolution`
      })
      return response.end()
    }
    const resolution = legacyDramawebbenRouteResolution(body)
    if (resolution) return sendJson(response, 200, resolution)
    return sendJson(response, 404, {
      error: {
        code: "legacy_dramawebben_route_not_found",
        message: "Legacy Dramawebben route not found",
        details: null
      }
    })
  }

  const readerHitWork = request.method === "GET"
    ? decodedReaderHitWorkId(rawApiPathname)
    : null
  if (readerHitWork !== null) {
    const query = parseReaderHitQuery(url.searchParams)
    if (!readerHitWork.valid || query === null) return validationError(response)

    const rawQuery = request.url.includes("?")
      ? request.url.slice(request.url.indexOf("?") + 1)
      : ""
    readerHitRequests.push({ path: rawPathname, query: rawQuery })
    const input = { workId: readerHitWork.workId, ...query }
    await waitForReaderHitDelay(input)
    if (readerHitFailure) {
      return sendJson(response, 503, {
        error: {
          code: "backend_unavailable",
          message: "Search backend unavailable",
          details: null
        }
      })
    }
    if (query.query === "malformed-response") {
      return sendJson(response, 200, {
        query: query.query,
        media_type: query.mediaType,
        offset: query.offset,
        limit: query.limit,
        total_hits: "invalid",
        items: []
      })
    }
    if (query.query === "incomplete-window") {
      return sendJson(response, 200, {
        query: query.query,
        media_type: query.mediaType,
        offset: query.offset,
        limit: query.limit,
        total_hits: query.offset + 2,
        items: []
      })
    }
    if (query.query === "malformed-highlight-ids") {
      const malformed = readerSearchHitResponse(
        readerHitWork.workId,
        "brev",
        query.offset,
        query.limit,
        query.mediaType,
        query
      )
      malformed.query = query.query
      malformed.items[0].highlight.from_word_id = ["w5_1"]
      malformed.items[0].highlight.to_word_id = ["w5_2"]
      return sendJson(response, 200, malformed)
    }
    if (query.query === "mismatched-submit-envelope") {
      const mismatched = readerSearchHitResponse(
        readerHitWork.workId,
        "brev",
        query.offset,
        query.limit,
        query.mediaType,
        query
      )
      mismatched.query = "different-query"
      return sendJson(response, 200, mismatched)
    }
    return sendJson(response, 200, readerSearchHitResponse(
      readerHitWork.workId,
      query.query,
      query.offset,
      query.limit,
      query.mediaType,
      query
    ))
  }

  const authorWorksAuthorId = request.method === "GET"
    ? decodedAuthorWorksAuthorId(rawApiPathname)
    : null
  if (authorWorksAuthorId !== null) {
    authorWorksRequests.push(`${rawPathname}${url.search}`)
    if (!authorWorksAuthorId.valid) return validationError(response)

    await waitForAuthorWorksDelay(authorWorksAuthorId.authorId)
    if (authorWorksFailures.has(authorWorksAuthorId.authorId)) {
      return sendJson(response, 503, {
        error: {
          code: "backend_unavailable",
          message: "Search backend unavailable",
          details: null
        }
      })
    }
    if (authorWorksAuthorId.authorId === "MalformedA") {
      return sendJson(response, 200, malformedAuthorWorksResponse)
    }
    if (authorWorksAuthorId.authorId === "UnsafeWorks") {
      return sendJson(response, 200, unsafeUrlAuthorWorksResponse)
    }
    if (authorWorksAuthorId.authorId === "WrongIdentityA") {
      return sendJson(response, 200, authorWorksById.get("StrindbergA"))
    }

    const works = authorWorksById.get(authorWorksAuthorId.authorId)
    if (works) return sendJson(response, 200, works)
    return sendJson(response, 404, {
      error: { code: "not_found", message: "Resource not found", details: null }
    })
  }

  if (request.method === "GET" && apiPathname === "/v2/bibliography/entries") {
    const resources = url.searchParams.getAll("resource")
    const wholeText = url.searchParams.get("whole_text") ?? ""
    bibliographyRequests.push(`${rawPathname}${url.search}`)
    const allowedResources = new Set(["manus", "tryckt_material", "annat_tryckt", "forskning"])
    if (
      [...url.searchParams.keys()].some(key => key !== "resource" && key !== "whole_text")
      || url.searchParams.getAll("whole_text").length > 1
      || wholeText.length > 200
      || resources.some(resource => !allowedResources.has(resource))
      || new Set(resources).size !== resources.length
    ) return validationError(response)
    const delay = Number(bibliographyDelays[wholeText] || 0)
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
    if (bibliographyDisconnect) return response.destroy()
    if (bibliographyFailure) {
      return sendJson(response, 503, {
        error: {
          code: "bibliography_unavailable",
          message: "Unable to load bibliography entries",
          details: null
        }
      })
    }
    const normalizedWholeText = wholeText.trim().toLocaleLowerCase("sv")
    const items = bibliographyEntries
      .filter(entry => !resources.length || resources.includes(entry.resource))
      .filter(entry => !normalizedWholeText
        || entry.title.toLocaleLowerCase("sv").includes(normalizedWholeText))
      .map(entry => Object.fromEntries(
        Object.entries(entry).filter(([key]) => key !== "resource")
      ))
    return sendJson(response, 200, { items })
  }

  if (request.method === "GET" && apiPathname === "/v2/dictionary/articles") {
    dictionaryRequests.push({
      scope: rawPathname.startsWith("/private-v2/") ? "private" : "public",
      path: rawPathname,
      query: url.search
    })
    const word = url.searchParams.get("word")
    if (!word || url.searchParams.size !== 1 || /\s/u.test(word) || word.length > 100) {
      return validationError(response)
    }
    if (word === "SAKNAS") {
      return sendJson(response, 404, {
        error: {
          code: "dictionary_article_not_found",
          message: "No dictionary article found",
          details: null
        }
      })
    }
    return sendJson(response, 200, {
      word,
      base_form: word,
      article_html: `<lemma id="unsafe" onclick="bad()"><grundform-clean>${word}</grundform-clean><grundform>${word}</grundform><lexem><def>En deterministisk ordboksartikel.</def></lexem><script>bad()</script></lemma>`
    })
  }

  const profileAuthorId = request.method === "GET"
    ? decodedProfileAuthorId(rawApiPathname)
    : null
  if (profileAuthorId !== null) {
    authorProfileRequests.push(rawPathname)
    if (!profileAuthorId.valid) {
      return sendJson(response, 422, {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }
    if (authorProfileFailure) {
      return sendJson(response, 503, {
        error: {
          code: "author_profile_unavailable",
          message: "Unable to load author profile",
          details: null
        }
      })
    }

    const profile = authorProfiles.get(profileAuthorId.authorId)
    if (profile) {
      const body = structuredClone(profile)
      if (malformedAuthorProfileIdentity) body.author_id = ".."
      return sendJson(response, 200, body)
    }
    return sendJson(response, 404, {
      error: { code: "not_found", message: "Resource not found", details: null }
    })
  }

  const resource = resourceFor(apiPathname)
  if (request.method === "GET" && resource) {
    requests.push(`${url.pathname}${url.search}`)
    if (failure === resource) {
      const [code, message] = errorByResource[resource]
      return sendJson(response, 503, {
        error: { code, message, details: null }
      })
    }

    const limit = Number(url.searchParams.get("limit") || 30)
    if (resource === "stats") return sendJson(response, 200, stats)
    if (resource === "works") {
      const items = structuredClone(popularWorks.slice(0, limit))
      if (failure === "malformed-stat-paths" && items[0]) {
        items[0].author.author_id = ".."
      }
      if (failure === "malformed-stat-paths" && items[2]) {
        items[2].representation.media_type = ["etext"]
      }
      return sendJson(response, 200, { items })
    }
    const items = structuredClone(popularEpubs.slice(0, limit))
    if (failure === "malformed-stat-paths" && items[0]) items[0].title_id = "."
    return sendJson(response, 200, { items })
  }

  if (dramawebbenExcludedDataPaths.has(rawPathname)) {
    dramawebbenExcludedDataRequests.push({ method: request.method, path: request.url })
  }
  if (isSlaExcludedDataPath(rawPathname)) {
    slaExcludedDataRequests.push({ method: request.method, path: request.url })
  }

  return sendJson(response, 404, {
    error: { code: "not_found", message: "Resource not found", details: null }
  })
})

const redirectTargetServer = createServer(async (request, response) => {
  let body = null
  if (request.method === "POST") body = await readJson(request)
  const recordedRequest = {
    method: request.method,
    path: request.url,
    body
  }

  if (request.url === "/legacy-dramawebben-route/resolution") {
    legacyDramawebbenRedirectTargetRequests.push(recordedRequest)
    return sendJson(response, 200, {
      location: "/författare/StrindbergA/dramawebben"
    })
  }

  if (request.url === "/sla-article/descriptor") {
    slaArticleRedirectTargetRequests.push(recordedRequest)
    return sendJson(response, 200, slaArticleDescriptorMap.get("PublishedWorks.html"))
  }
  if (request.url === "/sla-article/source") {
    slaArticleRedirectTargetRequests.push(recordedRequest)
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      slaArticleContent.get("/red/sla/PublishedWorks.html")
    )
  }
  if (request.url === "/dramawebben-document/content") {
    dramawebbenDocumentRedirectTargetRequests.push(recordedRequest)
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      dramawebbenDocumentContent.get("/red/dramawebben/om.html")
    )
  }
  authorDocumentRedirectTargetRequests.push(recordedRequest)

  if (request.method === "GET" && request.url === "/author-document/descriptor") {
    return sendJson(response, 200, soderbergPresentation)
  }
  if (request.method === "GET" && request.url === "/author-document/content") {
    return sendBody(
      response,
      200,
      "text/html; charset=utf-8",
      authorDocumentContent.get(soderbergPresentation.source_path)
    )
  }
  if (request.method === "POST" && request.url === "/author-route/resolution") {
    const resolution = legacyAuthorRouteResolution(body)
    if (resolution) return sendJson(response, 200, resolution)
  }
  return sendJson(response, 404, {
    error: { code: "not_found", message: "Resource not found", details: null }
  })
})

server.listen(port, "127.0.0.1", () => {
  console.log(`LB API fixture listening on http://127.0.0.1:${port}`)
})
redirectTargetServer.listen(redirectTargetPort, "127.0.0.1")

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    releaseContactSubmissions()
    server.close(() => process.exit(0))
    server.closeAllConnections()
    redirectTargetServer.close()
    redirectTargetServer.closeAllConnections()
    setTimeout(() => process.exit(0), 250).unref()
  })
}
