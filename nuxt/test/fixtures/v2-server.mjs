import { readFileSync } from "node:fs"
import { createServer } from "node:http"

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
  readerPageHtmlByIndex,
  readerSearchHitResponse,
  readerWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "./reader-data.mjs"
import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"
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
  ["/red/bilder/bakgrundsbilder/ljudlandskap.jpg", ["image/jpeg", readFileSync(new URL("./library-content/ljudlandskap.jpg", import.meta.url))]]
])

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

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
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

function sendBody(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "access-control-allow-origin": "*"
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

function readerMetadataResponse(titlePath) {
  switch (titlePath) {
    case "Rfc!Reader'()*":
      return {
        hits: 1,
        data: [readerRepresentation(titlePath, {
          authors: [{ authorid: "O'Neil!()*A", full_name: "RFC Reader" }],
          pages: [{ pagename: "-2!'()*", pageindex: 2 }],
          startpagename: "-2!'()*"
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

const server = createServer(async (request, response) => {
  const rawPathname = request.url.split("?", 1)[0]
  const url = new URL(request.url, `http://${request.headers.host}`)
  const apiPathname = url.pathname.replace(/^\/private-v2(?=\/|$)/, "/v2")
  const rawApiPathname = rawPathname.replace(/^\/private-v2(?=\/|$)/, "/v2")

  if (request.method === "OPTIONS") return sendJson(response, 204, null)
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true })
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

  if (request.method === "GET" && url.pathname === "/api/get_work_info") {
    readerRequests.push(`${url.pathname}${url.search}`)
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
    readerRequests.push(`${url.pathname}${url.search}`)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    const pageHtml = readerPageHtmlByIndex[Number(readerPageMatch[1])]
    return sendBody(response, 200, "text/html; charset=utf-8", pageHtml)
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

server.listen(port, "127.0.0.1", () => {
  console.log(`LB API fixture listening on http://127.0.0.1:${port}`)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    releaseContactSubmissions()
    server.close(() => process.exit(0))
    server.closeAllConnections()
    setTimeout(() => process.exit(0), 250).unref()
  })
}
