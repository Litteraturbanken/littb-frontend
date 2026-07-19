import { readFileSync } from "node:fs"
import { createServer } from "node:http"

import {
  forvillelserReaderCss,
  forvillelserReaderPageHtml,
  forvillelserReaderWorkInfoResponse,
  lagerlofBibliography,
  semerAuthorDocumentAssets,
  semerAuthorDocumentDescriptor,
  soderbergPresentation,
  sparseDocument
} from "./author-document-data.mjs"
import { authorProfiles } from "./author-profile-data.mjs"
import {
  authorWorksById,
  malformedAuthorWorksResponse
} from "./author-works-data.mjs"
import { historyAuthorSummaries } from "./history-data.mjs"
import { libraryQueryStringResponse } from "./library-query-data.mjs"
import { libraryRelevanceResponse } from "./library-relevance-data.mjs"
import { quickSearchResponse } from "./quick-search-data.mjs"
import {
  readerFacsimileJpegFile,
  readerFacsimileWorkInfoResponse,
  readerPageHtmlByIndex,
  readerSearchHitResponse,
  readerWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "./reader-data.mjs"
import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"
import { textSearchBackgroundBase64 } from "./text-search-data.mjs"
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

const sharedContent = new Map([
  ["/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg", ["image/jpeg", readFileSync(new URL("./library-content/biblioteket_bakgrund.jpg", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/ljudlandskap.jpg", ["image/jpeg", readFileSync(new URL("./library-content/ljudlandskap.jpg", import.meta.url))]],
  ["/red/bilder/bakgrundsbilder/sok_bkg.jpg", ["image/jpeg", Buffer.from(textSearchBackgroundBase64, "base64")]]
])
const readerFacsimileJpeg = readFileSync(readerFacsimileJpegFile)

const presentationContent = new Map([
  ["/red/presentationer/presentationerForfattare.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/presentationerForfattare.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/Censur.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/Censur.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/Rostratt.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/Rostratt.html", import.meta.url))]],
  ["/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/FigurdiktenSomBarockBlandkonst.html", import.meta.url))]],
  ["/red/presentationer/vandringar/VandringElam.html", ["xhtml", "text/html; charset=utf-8", readFileSync(new URL("./presentation-content/VandringElam.html", import.meta.url))]],
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
  '<div class="safe" id="drop" onclick="bad()">safe-visible-probe</div>',
  '<a href="javascript:alert(1)">unsafe-js-link</a>',
  '<a href="data:text/html,evil">unsafe-data-link</a>',
  '<a href="http://evil.test/path">unsafe-http-link</a>',
  '<a href="/%252e%252e/private">unsafe-traversal-link</a>',
  '<a href="https://example.test/safe" target="_blank" rel="external">blank-probe</a>',
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
  [`${semerAuthorDocumentDescriptor.author_id}|${semerAuthorDocumentDescriptor.document_kind}`, semerAuthorDocumentDescriptor],
  [`${sparseDocument.author_id}|${sparseDocument.document_kind}`, sparseDocument]
])

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const redirectTargetPort = port + 1
const redirectTargetOrigin = `http://127.0.0.1:${redirectTargetPort}`
let requests = []
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
let authorProfileRequests = []
let authorProfileFailure = false
let authorWorksRequests = []
let authorWorksFailures = new Set()
let authorWorksDelays = {}
let homeRequests = []
let homeFailure = false
let presentationRequests = []
let presentationFailures = new Set()
let litteraturkartanRequests = []
let readerRequests = []
let readerMetadataRequests = []
let readerHtmlRequests = []
let readerOcrRequests = []
let readerJpegRequests = []
let readerMetadataDelays = {}
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
let authorDocumentRequests = []
let authorDocumentAssetRequests = []
let authorDocumentFailure = null
let authorDocumentDelay = 0
let legacyAuthorRouteRequests = []
let legacyAuthorRouteFailure = null
let authorDocumentPdfRequests = []
let authorDocumentRedirectTargetRequests = []
let dramawebbenDocumentRequests = []
let dramawebbenDocumentFailure = null
let dramawebbenDocumentRedirectTargetRequests = []
let textSearchRequests = { results: [], count: [], options: [] }
let textSearchFailures = new Set()
let textSearchDelays = { results: {}, count: {}, options: {} }
let textSearchAuthorityMode = false

const textSearchOperations = new Set(["results", "count", "options"])

const errorByResource = {
  stats: ["stats_unavailable", "Unable to load statistics"],
  works: ["popular_works_unavailable", "Unable to load popular works"],
  epubs: ["popular_epubs_unavailable", "Unable to load popular EPUBs"]
}

const libraryQueryPaths = new Set([
  "/api/query_string/etext,faksimil,pdf",
  "/legacy-api/query_string/etext,faksimil,pdf"
])

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

function waitForContactRelease() {
  if (!deferContactSubmissions) return Promise.resolve()
  return new Promise(resolve => pendingContactReleases.push(resolve))
}

function releaseContactSubmissions() {
  deferContactSubmissions = false
  const releases = pendingContactReleases
  pendingContactReleases = []
  for (const release of releases) release()
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

function waitForAuthorDocumentDelay() {
  return new Promise(resolve => setTimeout(resolve, authorDocumentDelay))
}

function textSearchSelector(operation, body) {
  return operation === "options" ? body.title_filter : body.query
}

function waitForTextSearchDelay(operation, body) {
  const delay = textSearchDelays[operation][textSearchSelector(operation, body)] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
}

function readerRepresentation(titlePath, overrides = {}) {
  const representation = structuredClone(readerWorkInfoResponse.data[0])
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

function readerMetadataResponse(titlePath) {
  switch (titlePath) {
    case "GostaBerlingsSaga":
      return readerFacsimileWorkInfoResponse
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
  if (mediaType !== "etext" || rawQuery === null) return null
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
  if (body.query === "overflow") {
    rich.total_work_hits = 64
    rich.works[0].has_more_highlights = true
    rich.author_facets[0].count = 41
    rich.author_facets[1].count = 23
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

function textSearchOptionsResponse(body) {
  const titleFilter = body.title_filter.toLocaleLowerCase("sv")
  if (titleFilter === "overflow") {
    return {
      authors: [],
      about_authors: [],
      title_options: Array.from({ length: 30 }, (_, index) => ({
        work_id: `lb-overflow-${index + 1}`,
        title: `Överflödestitel ${index + 1}`,
        author_name: "Test Överflöd"
      })),
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
        else textSearchRequests = { results: [], count: [], options: [] }
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
        else textSearchDelays = { results: {}, count: {}, options: {} }
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
  if (url.pathname === "/_dramawebben_document_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests: dramawebbenDocumentRequests })
  }
  if (url.pathname === "/_dramawebben_document_requests" && request.method === "DELETE") {
    dramawebbenDocumentRequests = []
    return sendJson(response, 200, { requests: dramawebbenDocumentRequests })
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
    return sendBody(response, 200, shared[0], shared[1])
  }

  const home = homeContent.get(url.pathname)
  if (request.method === "GET" && home) {
    homeRequests.push(`${url.pathname}${url.search}`)
    if (homeFailure && url.pathname === "/red/om/start/startsida-ny.html") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
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

  const authorDocumentBody = authorDocumentContent.get(rawPathname)
  if (request.method === "GET" && authorDocumentBody) {
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
    await waitForReaderMetadataDelay(titlePath)
    if (titlePath === "UnavailableReader") {
      return sendBody(response, 503, "text/plain; charset=utf-8", "reader unavailable")
    }
    return sendJson(response, 200, readerMetadataResponse(titlePath))
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
    && /^\/txt\/lb-reader-gosta-berlings-saga\/ocr_\d{5}\.html$/.test(url.pathname)
  ) {
    const recordedRequest = `${url.pathname}${url.search}`
    readerRequests.push(recordedRequest)
    readerOcrRequests.push(recordedRequest)
    return sendBody(response, 200, "text/html; charset=utf-8", "<div>OCR fixture</div>")
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

  if (request.method === "GET" && url.pathname === "/red/css/etext.css") {
    readerRequests.push(`${url.pathname}${url.search}`)
    return sendBody(response, 200, "text/css; charset=utf-8", sharedReaderCss)
  }

  if (
    request.method === "GET" &&
    url.pathname === "/txt/css/lb-reader-doktor-glas-etext.css"
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
    const [resource, contentType, body] = content
    if (presentationFailures.has(resource)) {
      return sendBody(response, 503, "text/plain; charset=utf-8", `${resource} unavailable`)
    }
    return sendBody(response, 200, contentType, body)
  }

  if (request.method === "GET" && libraryQueryPaths.has(url.pathname)) {
    const query = Object.fromEntries(url.searchParams)
    libraryQueryRequests.push({ path: url.pathname, query })
    await waitForLibraryQueryDelay(query)
    if (libraryQueryFailure) {
      return sendJson(response, 503, {
        error: {
          code: "library_query_unavailable",
          message: "Unable to load Library EPUBs"
        }
      })
    }
    return sendJson(response, 200, libraryQueryStringResponse(query))
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
    return sendJson(response, 200, libraryRelevanceResponse(query.q || ""))
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
    contactSubmissions.push(await readJson(request))
    await waitForContactRelease()
    if (failure === "contact") {
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

    const authorsById = new Map(
      [
        ...historyAuthorSummaries,
        {
          author_id: "SöderbergH",
          full_name: "Hjalmar Söderberg",
          surname: "Söderberg"
        }
      ].map(author => [author.author_id, author])
    )
    return sendJson(response, 200, {
      items: authorIds.flatMap(authorId => {
        const author = authorsById.get(authorId)
        return author ? [author] : []
      })
    })
  }

  const authorDocumentMatch = request.method === "GET"
    ? /^\/v2\/authors\/([^/]+)\/documents\/(presentation|bibliografi|semer)$/.exec(rawApiPathname)
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
        media_type: "etext",
        offset: query.offset,
        limit: query.limit,
        total_hits: "invalid",
        items: []
      })
    }
    return sendJson(response, 200, readerSearchHitResponse(
      readerHitWork.workId,
      query.query,
      query.offset,
      query.limit
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
    if (authorWorksAuthorId.authorId === "WrongIdentityA") {
      return sendJson(response, 200, authorWorksById.get("StrindbergA"))
    }

    const works = authorWorksById.get(authorWorksAuthorId.authorId)
    if (works) return sendJson(response, 200, works)
    return sendJson(response, 404, {
      error: { code: "not_found", message: "Resource not found", details: null }
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
    if (profile) return sendJson(response, 200, profile)
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
      return sendJson(response, 200, { items: popularWorks.slice(0, limit) })
    }
    return sendJson(response, 200, { items: popularEpubs.slice(0, limit) })
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
