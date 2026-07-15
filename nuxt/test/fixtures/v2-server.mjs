import { createServer } from "node:http"

import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
let requests = []
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
    "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type"
  })
  response.end(JSON.stringify(body))
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
  if (url.pathname === "/_failure" && request.method === "PUT") {
    const body = await readJson(request)
    failure = body.resource ?? null
    return sendJson(response, 200, { failure })
  }
  if (url.pathname === "/_failure" && request.method === "DELETE") {
    failure = null
    return sendJson(response, 200, { failure })
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
