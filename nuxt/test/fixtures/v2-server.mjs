import { readFileSync } from "node:fs"
import { createServer } from "node:http"

import { historyAuthorSummaries } from "./history-data.mjs"
import { libraryRelevanceResponse } from "./library-relevance-data.mjs"
import { quickSearchResponse } from "./quick-search-data.mjs"
import {
  readerPageHtml,
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
  ["/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg", ["image/jpeg", readFileSync(new URL("./library-content/biblioteket_bakgrund.jpg", import.meta.url))]]
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
let homeRequests = []
let homeFailure = false
let presentationRequests = []
let presentationFailures = new Set()
let litteraturkartanRequests = []
let readerRequests = []
let libraryRelevanceRequests = []
let libraryRelevanceFailure = false
let libraryRelevanceDelays = {}

const errorByResource = {
  stats: ["stats_unavailable", "Unable to load statistics"],
  works: ["popular_works_unavailable", "Unable to load popular works"],
  epubs: ["popular_epubs_unavailable", "Unable to load popular EPUBs"]
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

function waitForLibraryRelevanceDelay(query) {
  const exactKey = `${query.q || ""}|${query.sort_field || ""}`
  const delay = libraryRelevanceDelays[exactKey] || libraryRelevanceDelays[query.q || ""] || 0
  return new Promise(resolve => setTimeout(resolve, delay))
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
  const url = new URL(request.url, `http://${request.headers.host}`)
  const apiPathname = url.pathname.replace(/^\/private-v2(?=\/|$)/, "/v2")

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
    return sendJson(response, 200, readerWorkInfoResponse)
  }

  if (
    request.method === "GET" &&
    url.pathname === "/txt/lb-reader-doktor-glas/res_00002.html"
  ) {
    readerRequests.push(`${url.pathname}${url.search}`)
    if (url.searchParams.get("username") !== "app") {
      return sendBody(response, 404, "text/plain; charset=utf-8", "missing username")
    }
    return sendBody(response, 200, "text/html; charset=utf-8", readerPageHtml)
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
      historyAuthorSummaries.map(author => [author.author_id, author])
    )
    return sendJson(response, 200, {
      items: authorIds.flatMap(authorId => {
        const author = authorsById.get(authorId)
        return author ? [author] : []
      })
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
