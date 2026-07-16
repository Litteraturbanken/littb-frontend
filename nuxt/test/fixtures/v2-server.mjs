import { readFileSync } from "node:fs"
import { createServer } from "node:http"

import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"

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

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
let requests = []
let contactSubmissions = []
let failure = null

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

function resourceFor(pathname) {
  if (pathname === "/v2/stats") return "stats"
  if (pathname === "/v2/works/popular") return "works"
  if (pathname === "/v2/epubs/popular") return "epubs"
  return null
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

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
    contactSubmissions = []
    return sendJson(response, 200, { contactSubmissions })
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

  const content = aboutContent.get(url.pathname)
  if (request.method === "GET" && content) {
    requests.push(`${url.pathname}${url.search}`)
    if (failure === "content" && content[0].startsWith("text/html")) {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
    }
    return sendBody(response, 200, content[0], content[1])
  }

  if (request.method === "POST" && url.pathname === "/v2/contact") {
    requests.push(`${url.pathname}${url.search}`)
    contactSubmissions.push(await readJson(request))
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

  const resource = resourceFor(url.pathname)
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
  process.on(signal, () => server.close(() => process.exit(0)))
}
