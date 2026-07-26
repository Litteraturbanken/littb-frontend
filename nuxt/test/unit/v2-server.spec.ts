import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { request as httpRequest } from "node:http"
import { fileURLToPath } from "node:url"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test
} from "vitest"

import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"
import {
  authorProfiles,
  dramaOnlyAuthorProfile,
  lagerlofAuthorProfile,
  managedHtmlProbeAuthorProfile,
  noIntroAuthorProfile,
  rfc3986AuthorProfile,
  strindbergAuthorProfile
} from "../fixtures/author-profile-data.mjs"
import {
  authorWorksById,
  emptyAuthorWorks,
  malformedAuthorWorksResponse,
  rfc3986AuthorWorks,
  richAuthorWorks,
  sparseAuthorWorks
} from "../fixtures/author-works-data.mjs"
import {
  authorDocumentProvenance,
  forvillelserReaderPageHtml,
  forvillelserReaderWorkInfoResponse,
  lagerlofBibliography,
  lagerlofOmtexterna,
  semerAuthorDocumentAssets,
  semerAuthorDocumentDescriptor,
  soderbergPresentation,
  sparseDocument
} from "../fixtures/author-document-data.mjs"
import {
  libraryPdfFilteredResponse,
  libraryPdfMalformedRowResponse,
  libraryPdfPageOneResponse,
  libraryPdfPageTwoResponse
} from "../fixtures/library-pdf-data.mjs"
import {
  readerFacsimileWorkInfoResponse,
  readerPageHtmlByIndex,
  readerPartsWorkInfoResponse,
  readerSearchHitResponse
} from "../fixtures/reader-data.mjs"
import {
  doktorGlasSimilarWorks,
  doktorGlasSourceInfo,
  dramaSourceInfo,
  malformedSourceInfo,
  oversizedSourceInfo,
  sourceInfoLicenses,
  sourceInfoProvenance,
  sparseSourceInfo
} from "../fixtures/reader-source-info-data.mjs"

type ReaderHitOperation = paths["/works/{work_id}/search-hits"]["get"]
type ReaderHitResponse = components["schemas"]["WorkSearchHitsResponse"]
type AuthorWorksOperation = paths["/authors/{author_id}/works"]["get"]
type AuthorWorksResponse = components["schemas"]["AuthorWorksResponse"]
type AuthorWorkReadAction = components["schemas"]["AuthorWorkReadAction"]
type AuthorWorkDownloadAction = components["schemas"]["AuthorWorkDownloadAction"]
type AuthorDocumentOperation = paths[
  "/authors/{author_id}/documents/{document_kind}"
]["get"]
type LegacyAuthorRouteOperation = paths["/legacy-author-routes/resolve"]["post"]
type AuthorDocumentDescriptor = components["schemas"]["AuthorDocumentDescriptor"]
type LegacyAuthorRouteResolution = components["schemas"]["LegacyAuthorRouteResolution"]
type TextSearchResultsRequest = components["schemas"]["TextSearchResultsRequest"]
type TextSearchCountRequest = components["schemas"]["TextSearchCountRequest"]
type TextSearchOptionsRequest = components["schemas"]["TextSearchOptionsRequest"]
type TextSearchOptionsResponse = components["schemas"]["TextSearchOptionsResponse"]
type TextSearchResultsOperation = paths["/text-search/results"]["post"]
type TextSearchCountOperation = paths["/text-search/count"]["post"]
type TextSearchOptionsOperation = paths["/text-search/options"]["post"]
type SourceInfoOperation = paths["/works/{author_id}/{title_path}/source-info"]["get"]
type SourceInfoResponse = components["schemas"]["WorkSourceInfoResponse"]
type SimilarWorksOperation = paths["/works/{work_id}/similar"]["get"]
type SimilarWorksResponse = components["schemas"]["SimilarWorksResponse"]

const generatedReaderHitContract: ReaderHitOperation = null as unknown as
  operations["v2_get_work_search_hits"]
const generatedAuthorWorksContract: AuthorWorksOperation = null as unknown as
  operations["v2_get_author_works"]
const generatedAuthorDocumentContract: AuthorDocumentOperation = null as unknown as
  operations["v2_get_author_document"]
const generatedLegacyAuthorRouteContract: LegacyAuthorRouteOperation = null as unknown as
  operations["v2_post_legacy_author_route_resolve"]
const generatedTextSearchResultsContract: TextSearchResultsOperation = null as unknown as
  operations["v2_post_text_search_results"]
const generatedTextSearchCountContract: TextSearchCountOperation = null as unknown as
  operations["v2_post_text_search_count"]
const generatedTextSearchOptionsContract: TextSearchOptionsOperation = null as unknown as
  operations["v2_post_text_search_options"]
const generatedSourceInfoContract: SourceInfoOperation = null as unknown as
  operations["v2_get_work_source_info"]
const generatedSimilarWorksContract: SimilarWorksOperation = null as unknown as
  operations["v2_get_similar_works"]
const generatedAuthorDocumentDescriptor: AuthorDocumentDescriptor = soderbergPresentation
const generatedSlaAuthorDocumentDescriptor: AuthorDocumentDescriptor = lagerlofOmtexterna
const generatedLegacyAuthorRouteResolution: LegacyAuthorRouteResolution = {
  author_id: "SöderbergH",
  title_id: "Förvillelser"
}
const generatedAuthorWorksResponse: AuthorWorksResponse = null as unknown as
  operations["v2_get_author_works"]["responses"][200]["content"]["application/json"]
const validAuthorWorkReadAction: AuthorWorkReadAction = {
  media_type: "etext",
  kind: "read",
  url: "/reader",
  download_filename: null
}
const validAuthorWorkDownloadAction: AuthorWorkDownloadAction = {
  media_type: "epub",
  kind: "download",
  url: "/book.epub",
  download_filename: "book.epub"
}
const generatedReaderHitResponse: ReaderHitResponse = {
  query: "doktor glas",
  media_type: "etext",
  offset: 0,
  limit: 3,
  total_hits: 1,
  items: [{
    index: 0,
    page_name: "-2",
    page_index: 2,
    highlight: { from_word_id: "w2_1", to_word_id: "w2_2" }
  }]
}

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const port = 42_000 + process.pid % 10_000
const origin = `http://127.0.0.1:${port}`
let fixture: ChildProcess

async function waitUntilReady() {
  await waitUntilReadyAt(origin)
}

async function waitUntilReadyAt(targetOrigin: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${targetOrigin}/health`)
      if (response.ok) return
    } catch {
      // The fixture process has not bound its port yet.
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error("v2 fixture server did not become ready")
}

async function contactSubmissions() {
  return await contactSubmissionsAt(origin)
}

async function contactSubmissionsAt(targetOrigin: string) {
  return await (await fetch(`${targetOrigin}/_contact_submissions`)).json() as {
    contactSubmissions: unknown[]
  }
}

async function waitForContactSubmission() {
  return await waitForContactSubmissionAt(origin)
}

async function waitForContactSubmissionAt(targetOrigin: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ledger = await contactSubmissionsAt(targetOrigin)
    if (ledger.contactSubmissions.length > 0) return ledger
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error("Contact submission was not recorded")
}

async function quickSearchRequests() {
  return await (await fetch(`${origin}/_quick_search_requests`)).json() as {
    queries: string[]
  }
}

async function workLookupRequests() {
  return await (await fetch(`${origin}/_work_lookup_requests`)).json() as {
    requests: Array<{ path: string, body: unknown }>
  }
}

async function postWorkLookup(path: string, body: unknown) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

async function authorResolveRequests() {
  return await (await fetch(`${origin}/_author_resolve_requests`)).json() as {
    requests: Array<{ path: string, body: unknown }>
  }
}

async function sourceInfoRequests() {
  return await (await fetch(`${origin}/_source_info_requests`)).json() as {
    requests: Array<{
      scope: "private" | "public"
      path: string
      query: string
    }>
  }
}

async function similarWorkRequests() {
  return await (await fetch(`${origin}/_similar_work_requests`)).json() as {
    requests: Array<{
      scope: "private" | "public"
      path: string
      query: string
    }>
  }
}

async function sourceInfoStaticRequests() {
  return await (await fetch(`${origin}/_source_info_static_requests`)).json() as {
    requests: string[]
  }
}

async function authorProfileRequests() {
  return await (await fetch(`${origin}/_author_profile_requests`)).json() as {
    requests: string[]
  }
}

async function authorWorksRequests() {
  return await (await fetch(`${origin}/_author_works_requests`)).json() as {
    requests: string[]
  }
}

async function rawGet(path: string) {
  return await new Promise<{ status: number, body: unknown }>((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      method: "GET",
      path
    }, response => {
      const chunks: Buffer[] = []
      response.on("data", chunk => chunks.push(Buffer.from(chunk)))
      response.on("end", () => {
        try {
          resolve({
            status: response.statusCode || 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on("error", reject)
    request.end()
  })
}

async function rawStatus(
  path: string,
  method: "GET" | "POST" = "GET",
  body: unknown = undefined
) {
  return await new Promise<number>((resolve, reject) => {
    const encodedBody = body === undefined ? null : JSON.stringify(body)
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      method,
      path,
      headers: encodedBody === null
        ? undefined
        : {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(encodedBody)
          }
    }, response => {
      response.resume()
      response.on("end", () => resolve(response.statusCode || 0))
    })
    request.on("error", reject)
    if (encodedBody !== null) request.write(encodedBody)
    request.end()
  })
}

async function postAuthorResolve(path: string, body: unknown) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

async function homeRequests() {
  return await (await fetch(`${origin}/_home_requests`)).json() as {
    requests: string[]
  }
}

async function presentationRequests() {
  return await (await fetch(`${origin}/_presentation_requests`)).json() as {
    requests: string[]
  }
}

async function authorDocumentAssetRequests() {
  return await (await fetch(`${origin}/_author_document_asset_requests`)).json() as {
    requests: string[]
  }
}

async function litteraturkartanRequests() {
  return await (await fetch(`${origin}/_litteraturkartan_requests`)).json() as {
    requests: string[]
  }
}

async function libraryRelevanceRequests() {
  return await (await fetch(`${origin}/_library_relevance_requests`)).json() as {
    requests: Array<{ path: string, query: Record<string, string> }>
  }
}

async function libraryQueryRequests() {
  return await (await fetch(`${origin}/_library_query_requests`)).json() as {
    requests: Array<{ path: string, query: Record<string, string> }>
  }
}

async function readerHitRequests() {
  return await (await fetch(`${origin}/_reader_hit_requests`)).json() as {
    requests: Array<{ path: string, query: string }>
  }
}

async function authorDocumentRequests() {
  return await (await fetch(`${origin}/_author_document_requests`)).json() as {
    requests: Array<{ kind: "descriptor" | "content", path: string }>
  }
}

async function legacyAuthorRouteRequests() {
  return await (await fetch(`${origin}/_legacy_author_route_requests`)).json() as {
    requests: Array<{ path: string, body: unknown }>
  }
}

async function dramawebbenExcludedDataRequests() {
  return await (await fetch(`${origin}/_dramawebben_excluded_data_requests`)).json() as {
    requests: Array<{ method: string, path: string }>
  }
}

async function slaExcludedDataRequests() {
  return await (await fetch(`${origin}/_sla_excluded_data_requests`)).json() as {
    requests: Array<{ method: string, path: string }>
  }
}

async function authorDocumentPdfRequests() {
  return await (await fetch(`${origin}/_author_document_pdf_requests`)).json() as {
    requests: string[]
  }
}

async function postTextSearchResults(body: TextSearchResultsRequest) {
  return await postTextSearch("results", body)
}

async function postTextSearch(
  operation: "results" | "count" | "options",
  body: TextSearchResultsRequest | TextSearchCountRequest | TextSearchOptionsRequest
) {
  return await fetch(`${origin}/v2/text-search/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

function textSearchResultsRequest(
  query: string,
  overrides: Partial<TextSearchResultsRequest> = {}
): TextSearchResultsRequest {
  return {
    query,
    include_modernized: true,
    prefix: false,
    suffix: false,
    word_form_only: true,
    highlight_limit: 5,
    page: 1,
    page_size: 30,
    ...overrides
  }
}

function textSearchCountRequest(
  query: string,
  overrides: Partial<TextSearchCountRequest> = {}
): TextSearchCountRequest {
  return {
    query,
    include_modernized: true,
    prefix: false,
    suffix: false,
    word_form_only: true,
    ...overrides
  }
}

function textSearchOptionsRequest(
  titleFilter: string,
  overrides: Partial<TextSearchOptionsRequest> = {}
): TextSearchOptionsRequest {
  return {
    include_modernized: true,
    include_static_options: true,
    prefix: false,
    suffix: false,
    title_filter: titleFilter,
    title_limit: 30,
    word_form_only: true,
    ...overrides
  }
}

async function textSearchRequests() {
  return await (await fetch(`${origin}/_text_search/requests`)).json() as {
    results: Array<{ method: string, path: string, body: unknown }>
    count: Array<{ method: string, path: string, body: unknown }>
    options: Array<{ method: string, path: string, body: unknown }>
  }
}

describe("v2 fixture server operations", () => {
  beforeAll(async () => {
    fixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(port) },
      stdio: "ignore"
    })
    await waitUntilReady()
  })

  afterAll(async () => {
    await fetch(`${origin}/_contact_defer`, { method: "DELETE" }).catch(() => {})
    if (!fixture.killed && fixture.exitCode === null) {
      const exited = once(fixture, "exit")
      fixture.kill("SIGTERM")
      const forceKill = setTimeout(() => fixture.kill("SIGKILL"), 1_000)
      await exited
      clearTimeout(forceKill)
    }
  })

  beforeEach(async () => {
    await Promise.all([
      fetch(`${origin}/_requests`, { method: "DELETE" }),
      fetch(`${origin}/_contact_submissions`, { method: "DELETE" }),
      fetch(`${origin}/_failure`, { method: "DELETE" }),
      fetch(`${origin}/_contact_defer`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_requests`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_failure`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_delays`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_requests`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_failure`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_delays`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_failure`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_delays`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_scenario`, { method: "DELETE" }),
      fetch(`${origin}/_source_info_requests`, { method: "DELETE" }),
      fetch(`${origin}/_similar_work_requests`, { method: "DELETE" }),
      fetch(`${origin}/_similar_work_failure`, { method: "DELETE" }),
      fetch(`${origin}/_similar_work_malformed`, { method: "DELETE" }),
      fetch(`${origin}/_source_info_static_requests`, { method: "DELETE" }),
      fetch(`${origin}/_source_info_failure`, { method: "DELETE" }),
      fetch(`${origin}/_source_info_delays`, { method: "DELETE" }),
      fetch(`${origin}/_source_info_static_failure`, { method: "DELETE" }),
      fetch(`${origin}/_author_profile_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_profile_failure`, { method: "DELETE" }),
      fetch(`${origin}/_author_works_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_works_failures`, { method: "DELETE" }),
      fetch(`${origin}/_author_works_delays`, { method: "DELETE" }),
      fetch(`${origin}/_home_requests`, { method: "DELETE" }),
      fetch(`${origin}/_home_failure`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_requests`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_failures`, { method: "DELETE" }),
      fetch(`${origin}/_litteraturkartan_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_failure`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_delays`, { method: "DELETE" }),
      fetch(`${origin}/_library_query_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_query_failure`, { method: "DELETE" }),
      fetch(`${origin}/_library_query_delays`, { method: "DELETE" }),
      fetch(`${origin}/_library_metadata_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_download_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_metadata_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_html_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_ocr_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_jpeg_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_hit_requests`, { method: "DELETE" }),
      fetch(`${origin}/_reader_hit_failure`, { method: "DELETE" }),
      fetch(`${origin}/_reader_hit_delays`, { method: "DELETE" }),
      fetch(`${origin}/_export_faksimil_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_document_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_document_asset_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_document_failure`, { method: "DELETE" }),
      fetch(`${origin}/_author_document_delay`, { method: "DELETE" }),
      fetch(`${origin}/_legacy_author_route_requests`, { method: "DELETE" }),
      fetch(`${origin}/_legacy_author_route_failure`, { method: "DELETE" }),
      fetch(`${origin}/_dramawebben_excluded_data_requests`, { method: "DELETE" }),
      fetch(`${origin}/_sla_excluded_data_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_document_pdf_requests`, { method: "DELETE" }),
      fetch(`${origin}/_text_search/requests`, { method: "DELETE" }),
      fetch(`${origin}/_text_search/failures`, { method: "DELETE" }),
      fetch(`${origin}/_text_search/delays`, { method: "DELETE" })
    ])
  })

  afterEach(async () => {
    await fetch(`${origin}/_contact_defer`, { method: "DELETE" })
  })

  test("serves deterministic source information through public and private v2 paths", async () => {
    expect(generatedSourceInfoContract).toBeNull()

    const normal = await fetch(
      `${origin}/v2/works/S%C3%B6derbergH/DoktorGlas/source-info?media_type=etext`
    )
    const drama = await fetch(
      `${origin}/private-v2/works/Alml%C3%B6fN/Affarer/source-info?media_type=faksimil`
    )
    const sparse = await fetch(
      `${origin}/private-v2/works/SparseA/SparseTitle/source-info`
    )

    expect(normal.status).toBe(200)
    expect(await normal.json() as SourceInfoResponse).toEqual(doktorGlasSourceInfo)
    expect(drama.status).toBe(200)
    expect(await drama.json() as SourceInfoResponse).toEqual(dramaSourceInfo)
    expect(sparse.status).toBe(200)
    expect(await sparse.json() as SourceInfoResponse).toEqual(sparseSourceInfo)
    expect(await sourceInfoRequests()).toEqual({
      requests: [
        {
          scope: "public",
          path: "/v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
          query: "?media_type=etext"
        },
        {
          scope: "private",
          path: "/private-v2/works/Alml%C3%B6fN/Affarer/source-info",
          query: "?media_type=faksimil"
        },
        {
          scope: "private",
          path: "/private-v2/works/SparseA/SparseTitle/source-info",
          query: ""
        }
      ]
    })
  })

  test("serves exact bounded similar works and failure controls", async () => {
    expect(generatedSimilarWorksContract).toBeNull()

    const normal = await fetch(
      `${origin}/v2/works/lb1728740/similar?media_type=etext`
    )
    const empty = await fetch(
      `${origin}/private-v2/works/lbSparse1/similar?media_type=faksimil`
    )

    expect(normal.status).toBe(200)
    expect(await normal.json() as SimilarWorksResponse).toEqual(doktorGlasSimilarWorks)
    expect(empty.status).toBe(200)
    expect(await empty.json() as SimilarWorksResponse).toEqual({ items: [] })
    expect(await similarWorkRequests()).toEqual({
      requests: [
        {
          scope: "public",
          path: "/v2/works/lb1728740/similar",
          query: "?media_type=etext"
        },
        {
          scope: "private",
          path: "/private-v2/works/lbSparse1/similar",
          query: "?media_type=faksimil"
        }
      ]
    })

    expect((await fetch(`${origin}/v2/works/lb1728740/similar`)).status).toBe(422)
    expect((await fetch(
      `${origin}/v2/works/lb1728740/similar?media_type=pdf`
    )).status).toBe(422)
    await fetch(`${origin}/_similar_work_failure`, { method: "PUT" })
    expect((await fetch(
      `${origin}/v2/works/lb1728740/similar?media_type=etext`
    )).status).toBe(503)
  })

  test("serves missing failed malformed oversized and delayed source-info scenarios", async () => {
    expect((await fetch(
      `${origin}/v2/works/MissingA/MissingTitle/source-info`
    )).status).toBe(404)

    expect(await (await fetch(
      `${origin}/v2/works/MalformedA/MalformedTitle/source-info`
    )).json()).toEqual(malformedSourceInfo)
    expect(await (await fetch(
      `${origin}/v2/works/OversizedA/OversizedTitle/source-info`
    )).json()).toEqual(oversizedSourceInfo)

    await fetch(`${origin}/_source_info_failure`, { method: "PUT" })
    expect((await fetch(
      `${origin}/v2/works/S%C3%B6derbergH/DoktorGlas/source-info`
    )).status).toBe(503)
    await fetch(`${origin}/_source_info_failure`, { method: "DELETE" })

    await fetch(`${origin}/_source_info_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "SöderbergH|DoktorGlas": 25 })
    })
    const startedAt = Date.now()
    expect((await fetch(
      `${origin}/v2/works/S%C3%B6derbergH/DoktorGlas/source-info`
    )).status).toBe(200)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20)
  })

  test("serves byte-representative provenance and license resources with ledgers", async () => {
    const provenance = await fetch(`${origin}/red/etc/provenance/provenance.json`)
    const licenses = await fetch(`${origin}/red/etc/license/license.json`)

    expect(provenance.status).toBe(200)
    expect(provenance.headers.get("content-type")).toContain("application/json")
    expect(await provenance.json()).toEqual(sourceInfoProvenance)
    expect(await licenses.json()).toEqual(sourceInfoLicenses)
    expect(await sourceInfoStaticRequests()).toEqual({
      requests: [
        "/red/etc/provenance/provenance.json",
        "/red/etc/license/license.json"
      ]
    })
  })

  test("controls malformed oversized and failed static source-info resources", async () => {
    for (const scenario of ["malformed", "oversized", "failed"]) {
      await fetch(`${origin}/_source_info_static_failure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario })
      })
      const response = await fetch(`${origin}/red/etc/license/license.json`)
      if (scenario === "failed") expect(response.status).toBe(503)
      else if (scenario === "malformed") expect(await response.text()).toBe("{not-json")
      else expect((await response.text()).length).toBeGreaterThan(1_048_576)
    }
  })

  test("serves exact author document descriptors and byte-frozen XHTML provenance", async () => {
    expect(generatedAuthorDocumentContract).toBeNull()
    expect(generatedLegacyAuthorRouteContract).toBeNull()
    expect(generatedAuthorDocumentDescriptor).toEqual(soderbergPresentation)
    expect(generatedLegacyAuthorRouteResolution).toEqual({
      author_id: "SöderbergH",
      title_id: "Förvillelser"
    })
    expect(soderbergPresentation).toEqual({
      author_id: "SöderbergH",
      normalized_author_id: "SoderbergH",
      full_name: "Hjalmar Söderberg",
      birth_year: "1869",
      death_year: "1941",
      has_introduction: true,
      has_dramawebben: false,
      search_url: "/sok?forfattare=S%C3%B6derbergH&avancerad",
      audio_url: "https://litteraturbanken.se/ljudochbild/författare/soderbergh",
      document_kind: "presentation",
      source_path: "/red/forfattare/SoderbergH/presentation/index.html"
    })
    expect(lagerlofBibliography).toEqual({
      author_id: "LagerlöfS",
      normalized_author_id: "LagerlofS",
      full_name: "Selma Lagerlöf",
      birth_year: "1858",
      death_year: "1940",
      has_introduction: true,
      has_dramawebben: true,
      search_url: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
      audio_url: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs",
      document_kind: "bibliografi",
      source_path: "/red/forfattare/LagerlofS/bibliografi/index.html"
    })
    expect(semerAuthorDocumentDescriptor).toEqual({
      author_id: "AlmqvistCJL",
      normalized_author_id: "AlmqvistCJL",
      full_name: "Carl Jonas Love Almqvist",
      birth_year: "1793",
      death_year: "1866",
      has_introduction: true,
      has_dramawebben: false,
      search_url: "/sok?forfattare=AlmqvistCJL&avancerad",
      audio_url: null,
      document_kind: "semer",
      source_path: "/red/forfattare/AlmqvistCJL/semer/index.html"
    })
    expect(sparseDocument).toEqual({
      author_id: "SparseDocument",
      normalized_author_id: "SparseDocument",
      full_name: "Författare utan tilläggsnavigering",
      birth_year: null,
      death_year: null,
      has_introduction: false,
      has_dramawebben: false,
      search_url: null,
      audio_url: null,
      document_kind: "presentation",
      source_path: "/red/forfattare/SparseDocument/presentation/index.html"
    })
    expect(authorDocumentProvenance).toEqual([
      {
        path: "/red/forfattare/SoderbergH/presentation/index.html",
        sourceUrl: "https://red.litteraturbanken.se/red/forfattare/SoderbergH/presentation/index.html",
        sha256: "80bb28b296759b1bc38fc400c6e27ce0ca51bb59e261203e0f901cff00528980"
      },
      {
        path: "/red/forfattare/LagerlofS/bibliografi/index.html",
        sourceUrl: "https://red.litteraturbanken.se/red/forfattare/LagerlofS/bibliografi/index.html",
        sha256: "54d289da89e61225fdfbfc68aed19762614529c06c6f2707ed50a493359d179b"
      },
      {
        path: "/red/sla/omtexterna.html",
        sourceUrl: "https://red.litteraturbanken.se/red/sla/omtexterna.html",
        bytes: 7225,
        sha256: "ca4812e8f5a88342f1699b3a41471da556ba27760bcd51bb635c0c0e20485928"
      },
      {
        path: "/red/forfattare/AlmqvistCJL/semer/index.html",
        sourceUrl: "https://litteraturbanken.se/red/forfattare/AlmqvistCJL/semer/index.html",
        retrievedFrom: "https://red.litteraturbanken.se/red/forfattare/AlmqvistCJL/semer/index.html",
        sha256: "49c0eed3a775926c301ae011b79be8c6c557d9d9c7f868f390869bcdc510c824"
      }
    ])
    expect(semerAuthorDocumentAssets).toHaveLength(13)

    for (const [path, descriptor] of [
      ["/v2/authors/S%C3%B6derbergH/documents/presentation", soderbergPresentation],
      ["/private-v2/authors/Lagerl%C3%B6fS/documents/bibliografi", lagerlofBibliography],
      ["/v2/authors/AlmqvistCJL/documents/semer", semerAuthorDocumentDescriptor],
      ["/v2/authors/SparseDocument/documents/presentation", sparseDocument]
    ] as const) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(200)
      expect(await response.json(), path).toEqual(descriptor)
    }

    for (const provenance of authorDocumentProvenance) {
      const requestPath = provenance.path === lagerlofOmtexterna.source_path
        ? provenance.path
        : `${provenance.path}?authority=exact`
      const response = await fetch(`${origin}${requestPath}`)
      expect(response.status, provenance.path).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
      const body = Buffer.from(await response.arrayBuffer())
      if ("bytes" in provenance) expect(body).toHaveLength(provenance.bytes)
      expect(createHash("sha256").update(body).digest("hex"))
        .toBe(provenance.sha256)
    }

    const selectedAsset = semerAuthorDocumentAssets[0]!
    const queriedAsset = await fetch(`${origin}${selectedAsset.path}?download=1`)
    expect(queriedAsset.status).toBe(404)
    const unlistedSibling = await fetch(
      `${origin}/red/forfattare/AlmqvistCJL/semer/pictures/not-listed.jpeg`
    )
    expect(unlistedSibling.status).toBe(404)
    expect(await authorDocumentAssetRequests()).toEqual({ requests: [] })

    for (const asset of semerAuthorDocumentAssets) {
      const response = await fetch(`${origin}${asset.path}`)
      expect(response.status, asset.path).toBe(200)
      expect(response.headers.get("content-type")).toBe("image/jpeg")
      expect(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"))
        .toBe(asset.sha256)
    }

    expect(await authorDocumentRequests()).toEqual({
      requests: [
        { kind: "descriptor", path: "/v2/authors/S%C3%B6derbergH/documents/presentation" },
        { kind: "descriptor", path: "/private-v2/authors/Lagerl%C3%B6fS/documents/bibliografi" },
        { kind: "descriptor", path: "/v2/authors/AlmqvistCJL/documents/semer" },
        { kind: "descriptor", path: "/v2/authors/SparseDocument/documents/presentation" },
        ...authorDocumentProvenance.map(({ path }) => ({
          kind: "content" as const,
          path: path === lagerlofOmtexterna.source_path
            ? path
            : `${path}?authority=exact`
        }))
      ]
    })
    expect(await authorDocumentAssetRequests()).toEqual({
      requests: semerAuthorDocumentAssets.map(({ path }) => path)
    })
  })

  test("serves only the exact SLA omtexterna descriptor and byte-frozen landing source", async () => {
    const descriptorPath = "/v2/authors/Lagerl%C3%B6fS/documents/omtexterna"
    const sourcePath = "/red/sla/omtexterna.html"

    expect(generatedSlaAuthorDocumentDescriptor).toEqual(lagerlofOmtexterna)
    const descriptorResponse = await fetch(`${origin}${descriptorPath}`)
    expect(descriptorResponse.status).toBe(200)
    expect(await descriptorResponse.json()).toEqual(lagerlofOmtexterna)

    const sourceResponse = await fetch(`${origin}${sourcePath}`)
    const source = Buffer.from(await sourceResponse.arrayBuffer())
    expect(sourceResponse.status).toBe(200)
    expect(sourceResponse.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(source).toHaveLength(7_225)
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("ca4812e8f5a88342f1699b3a41471da556ba27760bcd51bb635c0c0e20485928")

    expect(await authorDocumentRequests()).toEqual({
      requests: [
        { kind: "descriptor", path: descriptorPath },
        { kind: "content", path: sourcePath }
      ]
    })

    await fetch(`${origin}/_author_document_requests`, { method: "DELETE" })
    for (const [path, method] of [
      ["/v2/authors/S%C3%B6derbergH/documents/omtexterna", "GET"],
      ["/v2/authors/LagerlofS/documents/omtexterna", "GET"],
      [`${descriptorPath}?authority=exact`, "GET"],
      [descriptorPath, "POST"],
      [`${sourcePath}?authority=exact`, "GET"],
      [sourcePath, "POST"],
      ["/red/sla/omtexterna/TextkritiskaRiktlinjer.html", "GET"],
      ["/red/forfattare/LagerlofS/omtexterna/index.html", "GET"]
    ] as const) {
      expect(await rawStatus(path, method), `${method} ${path}`).toBe(404)
    }
    expect(await authorDocumentRequests()).toEqual({
      requests: [
        {
          kind: "descriptor",
          path: "/v2/authors/S%C3%B6derbergH/documents/omtexterna"
        },
        {
          kind: "descriptor",
          path: "/v2/authors/LagerlofS/documents/omtexterna"
        }
      ]
    })
  })

  test("author document failure and delay controls are exact, bounded, and independent", async () => {
    expect(await (await fetch(`${origin}/_author_document_failure`)).json())
      .toEqual({ failure: null })
    expect(await (await fetch(`${origin}/_author_document_delay`)).json())
      .toEqual({ delay: 0 })

    const descriptorPath = "/private-v2/authors/S%C3%B6derbergH/documents/presentation"
    const contentPath = soderbergPresentation.source_path
    for (const [failure, path, status] of [
      ["descriptor-404", descriptorPath, 404],
      ["descriptor-503", descriptorPath, 503],
      ["content-404", contentPath, 404],
      ["content-503", contentPath, 503]
    ] as const) {
      await fetch(`${origin}/_author_document_failure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ failure })
      })
      expect((await fetch(`${origin}${path}`)).status, failure).toBe(status)
    }

    for (const failure of [
      "malformed-descriptor",
      "unsafe-source-path",
      "malformed-content"
    ]) {
      await fetch(`${origin}/_author_document_failure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ failure })
      })
      const response = await fetch(`${origin}${failure === "malformed-content"
        ? contentPath
        : descriptorPath}`)
      expect(response.status, failure).toBe(200)
      if (failure === "malformed-descriptor") {
        expect(await response.json()).not.toEqual(soderbergPresentation)
      } else if (failure === "unsafe-source-path") {
        expect((await response.json()).source_path).toBe("//evil.test/index.html")
      } else {
        expect(await response.text())
          .toBe("<html><head><title>Malformed</title></head></html>")
      }
    }

    await fetch(`${origin}/_author_document_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "oversized-content" })
    })
    const oversized = await fetch(`${origin}${contentPath}`)
    expect(oversized.status).toBe(200)
    expect((await oversized.arrayBuffer()).byteLength).toBe(1_048_577)

    const slaContentPath = lagerlofOmtexterna.source_path
    for (const [failure, expectedType, expectedLength] of [
      ["wrong-content-type", "application/xhtml+xml; charset=utf-8", null],
      ["oversized-declared", "text/html; charset=utf-8", 262_145],
      ["oversized-streamed", "text/html; charset=utf-8", null]
    ] as const) {
      await fetch(`${origin}/_author_document_failure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ failure })
      })
      const response = await fetch(`${origin}${slaContentPath}`)
      expect(response.status, failure).toBe(200)
      expect(response.headers.get("content-type"), failure).toBe(expectedType)
      if (expectedLength === null) {
        expect(response.headers.get("content-length"), failure).toBeNull()
      } else {
        expect(Number(response.headers.get("content-length")), failure).toBe(expectedLength)
      }
      if (failure === "oversized-streamed") {
        expect((await response.arrayBuffer()).byteLength).toBe(262_145)
      }
    }

    await fetch(`${origin}/_author_document_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "fetch-rejection" })
    })
    await expect(fetch(`${origin}${slaContentPath}`)).rejects.toThrow()
    expect(await (await fetch(`${origin}/_author_document_failure`)).json())
      .toEqual({ failure: "fetch-rejection" })

    const invalidFailure = await fetch(`${origin}/_author_document_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "other" })
    })
    expect(invalidFailure.status).toBe(422)
    for (const delay of [-1, 5001, 1.5, "10"]) {
      const response = await fetch(`${origin}/_author_document_delay`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delay })
      })
      expect(response.status, String(delay)).toBe(422)
    }

    await fetch(`${origin}/_author_document_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_document_failure`)).json())
      .toEqual({ failure: null })
    await fetch(`${origin}/_author_document_delay`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delay: 60 })
    })
    const started = Date.now()
    expect((await fetch(`${origin}${descriptorPath}`)).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(50)
    expect(await (await fetch(`${origin}/_author_document_delay`)).json())
      .toEqual({ delay: 60 })
    await fetch(`${origin}/_author_document_delay`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_document_delay`)).json())
      .toEqual({ delay: 0 })
  })

  test("legacy author route resolver maps only the three exact authority cases", async () => {
    const cases = [
      [
        { normalized_author_id: "SoderbergH", normalized_title_id: null, media_type: null },
        { author_id: "SöderbergH", title_id: null }
      ],
      [
        { normalized_author_id: "LagerlofS", normalized_title_id: null, media_type: null },
        { author_id: "LagerlöfS", title_id: null }
      ],
      [
        {
          normalized_author_id: "SoderbergH",
          normalized_title_id: "Forvillelser",
          media_type: "etext"
        },
        { author_id: "SöderbergH", title_id: "Förvillelser" }
      ]
    ] as const

    for (const [body, expected] of cases) {
      const response = await fetch(`${origin}/private-v2/legacy-author-routes/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }

    const missingBody = {
      normalized_author_id: "Other",
      normalized_title_id: null,
      media_type: null
    }
    const missing = await fetch(`${origin}/v2/legacy-author-routes/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(missingBody)
    })
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe("legacy_author_route_not_found")
    expect(await legacyAuthorRouteRequests()).toEqual({
      requests: [
        ...cases.map(([body]) => ({
          path: "/private-v2/legacy-author-routes/resolve",
          body
        })),
        { path: "/v2/legacy-author-routes/resolve", body: missingBody }
      ]
    })
  })

  test("legacy author route failure control isolates malformed 200 and typed 503", async () => {
    const path = "/private-v2/legacy-author-routes/resolve"
    const body = {
      normalized_author_id: "SoderbergH",
      normalized_title_id: null,
      media_type: null
    }
    const post = () => fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    expect(await (await fetch(`${origin}/_legacy_author_route_failure`)).json())
      .toEqual({ failure: null })

    await fetch(`${origin}/_legacy_author_route_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "malformed-200" })
    })
    const malformed = await post()
    expect(malformed.status).toBe(200)
    expect(await malformed.json()).toEqual({ author_id: 7, title_id: null })

    await fetch(`${origin}/_legacy_author_route_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "resolver-503" })
    })
    const unavailable = await post()
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toEqual({
      error: {
        code: "legacy_author_route_unavailable",
        message: "Unable to resolve legacy author route",
        details: null
      }
    })
    const invalid = await fetch(`${origin}/_legacy_author_route_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failure: "other" })
    })
    expect(invalid.status).toBe(422)

    await fetch(`${origin}/_legacy_author_route_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_legacy_author_route_failure`)).json())
      .toEqual({ failure: null })
    expect((await post()).status).toBe(200)
  })

  test("legacy author route matching is independent of JSON property order", async () => {
    const response = await fetch(`${origin}/v2/legacy-author-routes/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        media_type: "etext",
        normalized_title_id: "Forvillelser",
        normalized_author_id: "SoderbergH"
      })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      author_id: "SöderbergH",
      title_id: "Förvillelser"
    })
  })

  test("serves distinct Förvillelser Reader metadata and canonical page 3", async () => {
    const metadata = await fetch(
      `${origin}/api/get_work_info?authorid=${encodeURIComponent("SöderbergH")}`
      + `&titlepath=${encodeURIComponent("Förvillelser")}`
    )
    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toEqual(forvillelserReaderWorkInfoResponse)
    expect(forvillelserReaderWorkInfoResponse.data[0]).toMatchObject({
      lbworkid: "lb-reader-forvillelser",
      startpagename: "3",
      title: "Förvillelser. Roman",
      titlepath: "Förvillelser",
      pages: [{ pagename: "3", pageindex: 3 }]
    })

    const page = await fetch(
      `${origin}/txt/lb-reader-forvillelser/res_00003.html?username=app`
    )
    expect(page.status).toBe(200)
    expect(await page.text()).toBe(forvillelserReaderPageHtml)
    expect(forvillelserReaderPageHtml).toContain("KANONISK SIDA TRE")
    expect(forvillelserReaderPageHtml).not.toContain("DOKTOR GLAS")
    const css = await fetch(`${origin}/txt/css/lb-reader-forvillelser-etext.css`)
    expect(css.status).toBe(200)
    expect(await css.text()).toContain("forvillelser-reader")
  })

  test("serves faksimil Reader metadata while search-hits remains e-text only", async () => {
    const metadataPath =
      `/api/get_work_info?authorid=${encodeURIComponent("LagerlöfS")}` +
      "&exclude=content_vector&titlepath=GostaBerlingsSaga"
    const metadata = await fetch(`${origin}${metadataPath}`)
    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toEqual(readerFacsimileWorkInfoResponse)
    expect(readerFacsimileWorkInfoResponse.data[0]).toMatchObject({
      faksimil_sizes: [1, 2, 3, 4],
      lbworkid: "lb-reader-gosta-berlings-saga",
      mediatype: "faksimil",
      pages: [
        { pagename: "1", pageindex: 0, imagenumber: 7 },
        { pagename: "3", pageindex: 1, imagenumber: 9 },
        { pagename: "5", pageindex: 2, imagenumber: 12 }
      ],
      startpagename: "3",
      width: { size_2: 450, size_3: 625, size_4: 900, size_5: 1250 }
    })

    const searchHits = await fetch(
      `${origin}/v2/works/lb-reader-gosta-berlings-saga/search-hits` +
        "?media_type=faksimil&query=g%C3%B6sta"
    )
    expect(searchHits.status).toBe(422)
    expect(await (await fetch(`${origin}/_reader_metadata_requests`)).json()).toEqual({
      requests: [metadataPath]
    })
    expect(await readerHitRequests()).toEqual({ requests: [] })
  })

  test("serves the part-rich Reader graph only for the exact metadata query", async () => {
    const metadataPath =
      `/api/get_work_info?authorid=${encodeURIComponent("SöderbergH")}`
      + "&exclude=content_vector&titlepath=DoktorGlasParts"
    const metadata = await fetch(`${origin}${metadataPath}`)

    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toEqual(readerPartsWorkInfoResponse)
    expect(readerPartsWorkInfoResponse.data[0].parts.map(part => ({
      authors: part.authors.map(author => author.authorid),
      end: part.endpagename,
      start: part.startpagename,
      title: part.title
    }))).toEqual([
      { authors: ["SöderbergH"], end: "1", start: "-4", title: "Den yttre delen" },
      { authors: ["MörikeE"], end: "-2", start: "-3", title: "Den nästlade mellandelen" },
      {
        authors: ["RilkeRM", "ShelleyPB"],
        end: "1",
        start: "-2",
        title: "Den överlappande delen"
      },
      { authors: ["SöderbergH"], end: "5", start: "3", title: "Den senare delen" },
      { authors: ["MörikeE"], end: "4", start: "3", title: "Delen med samma start" }
    ])
    expect(await (await fetch(`${origin}/_reader_metadata_requests`)).json()).toEqual({
      requests: [metadataPath]
    })

    const withExtra = await fetch(`${origin}${metadataPath}&unexpected=1`)
    expect(withExtra.status).toBe(422)
    expect(await withExtra.json()).toEqual({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: null
      }
    })
  })

  test("records Reader metadata, HTML, OCR, JPEG, and search hits separately", async () => {
    const metadataPath = "/api/get_work_info?titlepath=GostaBerlingsSaga"
    const htmlPath = "/txt/lb-reader-gosta-berlings-saga/res_00001.html?username=app"
    const ocrPath = "/txt/lb-reader-gosta-berlings-saga/ocr_00009.html"
    const jpegPath = "/txt/lb-reader-gosta-berlings-saga/" +
      "lb-reader-gosta-berlings-saga_3/" +
      "lb-reader-gosta-berlings-saga_3_0009.jpeg"
    const hitPath = "/v2/works/lb-reader-doktor-glas/search-hits" +
      "?media_type=etext&query=doktor"

    expect((await fetch(`${origin}${metadataPath}`)).status).toBe(200)
    expect((await fetch(`${origin}${htmlPath}`)).status).toBe(200)
    expect((await fetch(`${origin}${ocrPath}`)).status).toBe(200)
    const jpeg = await fetch(`${origin}${jpegPath}`)
    expect(jpeg.status).toBe(200)
    expect(jpeg.headers.get("content-type")).toBe("image/jpeg")
    const jpegBytes = new Uint8Array(await jpeg.arrayBuffer())
    expect(Array.from(jpegBytes.slice(0, 2))).toEqual([0xff, 0xd8])
    expect(Array.from(jpegBytes.slice(-2))).toEqual([0xff, 0xd9])
    expect((await fetch(`${origin}${hitPath}`)).status).toBe(200)

    expect(await (await fetch(`${origin}/_reader_metadata_requests`)).json())
      .toEqual({ requests: [metadataPath] })
    expect(await (await fetch(`${origin}/_reader_html_requests`)).json())
      .toEqual({ requests: [htmlPath] })
    expect(await (await fetch(`${origin}/_reader_ocr_requests`)).json())
      .toEqual({ requests: [ocrPath] })
    expect(await (await fetch(`${origin}/_reader_jpeg_requests`)).json())
      .toEqual({ requests: [jpegPath] })
    expect(await readerHitRequests()).toEqual({
      requests: [{
        path: "/v2/works/lb-reader-doktor-glas/search-hits",
        query: "media_type=etext&query=doktor"
      }]
    })
  })

  test("serves only the two author document PDFs with exact browser headers", async () => {
    const pdfCases = [
      [
        "/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf",
        "attachment; filename=\"SoderbergH_presentation.pdf\""
      ],
      [
        "/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf",
        "inline; filename=\"LagerlofS_bibliografi.pdf\""
      ]
    ] as const
    let authorityHash: string | null = null
    for (const [path, disposition] of pdfCases) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/pdf")
      expect(response.headers.get("content-disposition")).toBe(disposition)
      const hash = createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex")
      authorityHash ??= hash
      expect(hash).toBe(authorityHash)
    }
    expect((await fetch(
      `${origin}/red/forfattare/SoderbergH/presentation/unknown.pdf`
    )).status).toBe(404)
    expect(await authorDocumentPdfRequests()).toEqual({
      requests: pdfCases.map(([path]) => path)
    })
  })

  test("author document XHTML and PDF dispatch reject every raw traversal alias", async () => {
    const xhtmlAliases = [
      "/red/forfattare/SoderbergH/presentation/../presentation/index.html",
      "/red/forfattare/SoderbergH/presentation/%2e%2e/presentation/index.html",
      "/red/forfattare/SoderbergH/presentation/%252e%252e/presentation/index.html",
      "/red/forfattare/SoderbergH/presentation%2Findex.html",
      "/red/forfattare/SoderbergH/presentation%5Cindex.html"
    ]
    const pdfAliases = [
      "/red/forfattare/SoderbergH/presentation/../presentation/SoderbergH_presentation.pdf",
      "/red/forfattare/SoderbergH/presentation/%2e%2e/presentation/SoderbergH_presentation.pdf",
      "/red/forfattare/SoderbergH/presentation/%252e%252e/presentation/SoderbergH_presentation.pdf",
      "/red/forfattare/SoderbergH/presentation%2FSoderbergH_presentation.pdf",
      "/red/forfattare/SoderbergH/presentation%5CSoderbergH_presentation.pdf"
    ]

    for (const path of [...xhtmlAliases, ...pdfAliases]) {
      expect(await rawStatus(path), path).toBe(404)
    }
    expect(await authorDocumentRequests()).toEqual({ requests: [] })
    expect(await authorDocumentPdfRequests()).toEqual({ requests: [] })
  })

  test("legacy author route dispatch rejects raw normalized aliases without ledgering", async () => {
    const body = {
      normalized_author_id: "SoderbergH",
      normalized_title_id: null,
      media_type: null
    }
    const aliases = [
      "/v2/unrelated/../legacy-author-routes/resolve",
      "/v2/unrelated/%2e%2e/legacy-author-routes/resolve",
      "/v2/unrelated/%252e%252e/legacy-author-routes/resolve",
      "/v2/unrelated%2F..%2Flegacy-author-routes%2Fresolve",
      "/v2/unrelated%5C..%5Clegacy-author-routes%5Cresolve"
    ]

    for (const path of aliases) {
      expect(await rawStatus(path, "POST", body), path).toBe(404)
    }
    expect(await legacyAuthorRouteRequests()).toEqual({ requests: [] })
  })

  test("author document raw-path ledgers preserve accepted paths and query bytes", async () => {
    const contentPath = `${soderbergPresentation.source_path}?probe=%2f&repeat=one&repeat=two`
    const pdfPath = [
      "/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf",
      "?probe=%2f&repeat=one&repeat=two"
    ].join("")

    expect(await rawStatus(contentPath)).toBe(200)
    expect(await rawStatus(pdfPath)).toBe(200)
    expect(await authorDocumentRequests()).toEqual({
      requests: [{ kind: "content", path: contentPath }]
    })
    expect(await authorDocumentPdfRequests()).toEqual({ requests: [pdfPath] })
  })

  test("legacy author route ledger preserves accepted raw path and query bytes", async () => {
    const path = "/v2/legacy-author-routes/resolve?probe=%2f&repeat=one&repeat=two"
    const body = {
      normalized_author_id: "SoderbergH",
      normalized_title_id: null,
      media_type: null
    }

    expect(await rawStatus(path, "POST", body)).toBe(200)
    expect(await legacyAuthorRouteRequests()).toEqual({
      requests: [{ path, body }]
    })
  })

  test("records and resets exact otherwise-unhandled Dramawebben data probes", async () => {
    const paths = [
      "/api/get_authors?exclude=dramawebben&repeat=one&repeat=two",
      "/api/list_all/etext,faksimil,pdf,infopost?filter_and=Dramawebben"
    ]

    for (const path of paths) expect((await fetch(`${origin}${path}`)).status).toBe(404)
    expect(await dramawebbenExcludedDataRequests()).toEqual({
      requests: paths.map(path => ({ method: "GET", path }))
    })

    await fetch(`${origin}/_dramawebben_excluded_data_requests`, { method: "DELETE" })
    expect(await dramawebbenExcludedDataRequests()).toEqual({ requests: [] })
  })

  test("records and independently resets exact otherwise-unhandled SLA data probes", async () => {
    const probes = [
      {
        method: "GET",
        path: "/api/get_author/Lagerl%C3%B6fS?probe=%2f&repeat=one&repeat=two"
      },
      {
        method: "POST",
        path: "/api/get_authors?exclude=dramawebben&repeat=one&repeat=two"
      },
      {
        method: "GET",
        path: "/api/list_all/etext,faksimil,pdf,infopost/Lagerl%C3%B6fS?author_type=main%2Cscholar&repeat=one&repeat=two"
      },
      {
        method: "GET",
        path: "/api/list_parts_in_others_works/Lagerl%C3%B6fS?sort_field=sortkey%7Cdesc&repeat=one&repeat=two"
      },
      {
        method: "GET",
        path: "/api/query/litteraturkartan?search=%7B%22author%22%3A%22Lagerl%C3%B6fS%22%7D&repeat=one&repeat=two"
      }
    ] as const

    for (const probe of probes) {
      expect(await rawStatus(probe.path, probe.method), `${probe.method} ${probe.path}`).toBe(404)
    }
    expect(await slaExcludedDataRequests()).toEqual({ requests: probes })

    expect((await dramawebbenExcludedDataRequests()).requests).toHaveLength(1)
    await fetch(`${origin}/v2/authors/S%C3%B6derbergH/documents/presentation`)
    expect((await authorDocumentRequests()).requests).toHaveLength(1)

    await fetch(`${origin}/_sla_excluded_data_requests`, { method: "DELETE" })
    expect(await slaExcludedDataRequests()).toEqual({ requests: [] })
    expect((await dramawebbenExcludedDataRequests()).requests).toHaveLength(1)
    expect((await authorDocumentRequests()).requests).toHaveLength(1)

    expect(await rawStatus("/api/get_author/S%C3%B6derbergH?repeat=one&repeat=two"))
      .toBe(404)
    expect(await rawStatus("/api/list_all/etext,faksimil,pdf,infopost/StrindbergA?repeat=one"))
      .toBe(404)
    expect(await slaExcludedDataRequests()).toEqual({ requests: [] })
  })

  test("author document, resolver, and PDF ledgers reset independently", async () => {
    await fetch(`${origin}/v2/authors/S%C3%B6derbergH/documents/presentation`)
    await fetch(`${origin}${soderbergPresentation.source_path}`)
    await fetch(`${origin}/v2/legacy-author-routes/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        normalized_author_id: "SoderbergH",
        normalized_title_id: null,
        media_type: null
      })
    })
    await fetch(
      `${origin}/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf`
    )

    await fetch(`${origin}/_author_document_requests`, { method: "DELETE" })
    expect(await authorDocumentRequests()).toEqual({ requests: [] })
    expect((await legacyAuthorRouteRequests()).requests).toHaveLength(1)
    expect((await authorDocumentPdfRequests()).requests).toHaveLength(1)

    await fetch(`${origin}/_legacy_author_route_requests`, { method: "DELETE" })
    expect(await legacyAuthorRouteRequests()).toEqual({ requests: [] })
    expect((await authorDocumentPdfRequests()).requests).toHaveLength(1)
    await fetch(`${origin}/_author_document_pdf_requests`, { method: "DELETE" })
    expect(await authorDocumentPdfRequests()).toEqual({ requests: [] })
  })

  test("serves complete deterministic author profiles on public and private paths", async () => {
    expect([...authorProfiles.values()]).toEqual([
      strindbergAuthorProfile,
      lagerlofAuthorProfile,
      dramaOnlyAuthorProfile,
      noIntroAuthorProfile,
      rfc3986AuthorProfile,
      managedHtmlProbeAuthorProfile
    ])

    const expectedRequests: string[] = []
    for (const profile of authorProfiles.values()) {
      const encodedId = encodeURIComponent(profile.author_id).replace(
        /[!'()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      for (const prefix of ["/v2", "/private-v2"]) {
        const path = `${prefix}/authors/${encodedId}`
        const response = await fetch(`${origin}${path}`)

        expect(response.status, path).toBe(200)
        expect(await response.json(), path).toEqual(profile)
        expectedRequests.push(path)
      }
    }

    expect(await authorProfileRequests()).toEqual({ requests: expectedRequests })
  })

  test("serves complete deterministic Author Works on public and private paths", async () => {
    expect([...authorWorksById.values()]).toEqual([
      richAuthorWorks,
      sparseAuthorWorks,
      emptyAuthorWorks,
      rfc3986AuthorWorks
    ])

    const expectedRequests: string[] = []
    for (const works of authorWorksById.values()) {
      const encodedId = encodeURIComponent(works.author.author_id).replace(
        /[!'()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      for (const prefix of ["/v2", "/private-v2"]) {
        const path = `${prefix}/authors/${encodedId}/works`
        const response = await fetch(`${origin}${path}`)

        expect(response.status, path).toBe(200)
        expect(await response.json(), path).toEqual(works)
        expectedRequests.push(path)
      }
    }

    expect(await authorWorksRequests()).toEqual({ requests: expectedRequests })
    expect(sparseAuthorWorks.author.related_links).toEqual([
      {
        label: "Presentation",
        url: "/författare/Lagerl%C3%B6fS/titlar/PresentationOmLagerlof/sida/-1/etext"
      },
      {
        label: "Bibliografi",
        url: "/författare/Lagerl%C3%B6fS/bibliografi"
      }
    ])
  })

  test("Author Works request ledger preserves the exact query string", async () => {
    const path = "/private-v2/authors/StrindbergA/works?probe=fixture&repeat=one&repeat=two"

    expect((await fetch(`${origin}${path}`)).status).toBe(200)
    expect(await authorWorksRequests()).toEqual({ requests: [path] })
  })

  test("Author Works returns typed missing, invalid, failed, and malformed states", async () => {
    const missing = await fetch(`${origin}/v2/authors/MissingA/works`)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({
      error: { code: "not_found", message: "Resource not found", details: null }
    })

    for (const path of [
      "/v2/authors/%25/works",
      "/private-v2/authors/%20StrindbergA/works",
      `/v2/authors/${"x".repeat(101)}/works`
    ]) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(422)
      expect((await response.json()).error.code).toBe("validation_error")
    }

    await fetch(`${origin}/_author_works_failures`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ StrindbergA: true })
    })
    const failed = await fetch(`${origin}/private-v2/authors/StrindbergA/works`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "backend_unavailable",
        message: "Search backend unavailable",
        details: null
      }
    })
    expect((await fetch(`${origin}/v2/authors/Lagerl%C3%B6fS/works`)).status).toBe(200)

    const malformed = await fetch(`${origin}/v2/authors/MalformedA/works`)
    expect(malformed.status).toBe(200)
    expect(await malformed.json()).toEqual(malformedAuthorWorksResponse)

    await fetch(`${origin}/_author_works_failures`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_works_failures`)).json()).toEqual({
      failures: []
    })
    expect((await fetch(`${origin}/v2/authors/StrindbergA/works`)).status).toBe(200)
  })

  test("Author Works keyed delays are observable and latest request can finish first", async () => {
    await fetch(`${origin}/_author_works_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ StrindbergA: 80, "LagerlöfS": 0 })
    })

    const completion: string[] = []
    const slow = fetch(`${origin}/v2/authors/StrindbergA/works`).then(response => {
      completion.push("slow")
      return response
    })
    const fast = fetch(`${origin}/v2/authors/Lagerl%C3%B6fS/works`).then(response => {
      completion.push("fast")
      return response
    })

    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await authorWorksRequests()).requests.length === 2) break
      await new Promise(resolve => setTimeout(resolve, 2))
    }
    expect(await authorWorksRequests()).toEqual({
      requests: [
        "/v2/authors/StrindbergA/works",
        "/v2/authors/Lagerl%C3%B6fS/works"
      ]
    })
    expect((await fast).status).toBe(200)
    expect(completion).toEqual(["fast"])
    expect((await slow).status).toBe(200)
    expect(completion).toEqual(["fast", "slow"])

    await fetch(`${origin}/_author_works_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_works_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("Author Works ledgers and controls reset independently", async () => {
    await fetch(`${origin}/v2/authors/StrindbergA/works`)
    await fetch(`${origin}/v2/authors/StrindbergA`)
    await fetch(`${origin}/v2/stats`)
    await fetch(
      `${origin}/api/query_string/etext,faksimil,pdf?q=authorid%3AStrindbergA&sort_field=sortkey%7Casc&from=0&to=19`
    )
    await fetch(
      `${origin}/v2/works/lb-reader-doktor-glas/search-hits?media_type=etext&query=doktor`
    )

    await fetch(`${origin}/_author_works_requests`, { method: "DELETE" })
    expect(await authorWorksRequests()).toEqual({ requests: [] })
    expect(await authorProfileRequests()).toEqual({
      requests: ["/v2/authors/StrindbergA"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect((await libraryQueryRequests()).requests).toHaveLength(1)
    expect((await readerHitRequests()).requests).toHaveLength(1)

    await fetch(`${origin}/v2/authors/StrindbergA/works`)
    await fetch(`${origin}/_author_profile_requests`, { method: "DELETE" })
    await fetch(`${origin}/_library_query_requests`, { method: "DELETE" })
    await fetch(`${origin}/_reader_hit_requests`, { method: "DELETE" })
    expect(await authorWorksRequests()).toEqual({
      requests: ["/v2/authors/StrindbergA/works"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
  })

  test("author profiles return standard 404s and record the original encoded path", async () => {
    const paths = [
      "/v2/authors/Missing%20Author",
      "/private-v2/authors/Ok%C3%A4nd"
    ]

    for (const path of paths) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: {
          code: "not_found",
          message: "Resource not found",
          details: null
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profiles reject malformed encoded IDs with typed validation errors", async () => {
    const paths = [
      "/v2/authors/%25",
      "/private-v2/authors/%20StrindbergA",
      "/v2/authors/StrindbergA%2Fextra",
      "/private-v2/authors/bad%5Csegment",
      "/v2/authors/bad%C2%85segment",
      "/v2/authors/bad%ZZsegment"
    ]

    for (const path of paths) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(422)
      expect(await response.json(), path).toEqual({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profiles reject and record literal and encoded dot segments", async () => {
    const paths = [
      "/v2/authors/.",
      "/private-v2/authors/..",
      "/v2/authors/%2E",
      "/private-v2/authors/%2e%2e"
    ]

    for (const path of paths) {
      expect(await rawGet(path)).toEqual({
        status: 422,
        body: {
          error: {
            code: "validation_error",
            message: "Request validation failed",
            details: null
          }
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profile failures are typed, resettable, and isolated", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)

    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: false
    })
    await fetch(`${origin}/_author_profile_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: true
    })

    const response = await fetch(`${origin}/private-v2/authors/StrindbergA`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: "author_profile_unavailable",
        message: "Unable to load author profile",
        details: null
      }
    })
    expect(await authorProfileRequests()).toEqual({
      requests: ["/private-v2/authors/StrindbergA"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })

    await fetch(`${origin}/_author_profile_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: false
    })
    expect((await fetch(`${origin}/v2/authors/StrindbergA`)).status).toBe(200)
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
  })

  test("accepts and separately records the exact submitted body", async () => {
    const body = {
      sender_name: "Anna Andersson",
      sender_address: "anna@example.test",
      message: "Hej!",
      audience: "litteraturbanken"
    }
    const response = await fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ status: "accepted" })
    expect(response.headers.get("access-control-allow-methods")).toContain("POST")
    expect(await (await fetch(`${origin}/_contact_submissions`)).json()).toEqual({
      contactSubmissions: [body]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/contact"]
    })
  })

  test("returns a typed 502 failure and reset removes recorded attempts", async () => {
    await fetch(`${origin}/_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: "contact" })
    })

    const response = await fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sender_name: null,
        sender_address: "a@b",
        message: "Hej!",
        audience: "oversattarlexikon"
      })
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: {
        code: "contact_delivery_failed",
        message: "Unable to send contact message",
        details: null
      }
    })

    await fetch(`${origin}/_contact_submissions`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_contact_submissions`)).json()).toEqual({
      contactSubmissions: []
    })
  })

  test("records a deferred submission before releasing its response", async () => {
    const body = {
      sender_name: null,
      sender_address: "a@b",
      message: "Vänta",
      audience: "litteraturbanken"
    }
    await fetch(`${origin}/_contact_defer`, { method: "PUT" })

    let settled = false
    const pendingResponse = fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(response => {
      settled = true
      return response
    })

    expect(await waitForContactSubmission()).toEqual({
      contactSubmissions: [body]
    })
    expect(settled).toBe(false)
    expect(await (await fetch(`${origin}/_contact_defer`)).json()).toEqual({
      deferred: true,
      pending: 1
    })

    await fetch(`${origin}/_contact_defer`, { method: "DELETE" })
    const response = await pendingResponse
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ status: "accepted" })
  })

  test("SIGTERM exits with an outstanding deferred Contact request", async () => {
    const shutdownPort = port + 2
    const shutdownOrigin = `http://127.0.0.1:${shutdownPort}`
    const shutdownFixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(shutdownPort) },
      stdio: "ignore"
    })
    const exited = once(shutdownFixture, "exit")
    let forced = false

    try {
      await waitUntilReadyAt(shutdownOrigin)
      await fetch(`${shutdownOrigin}/_contact_defer`, { method: "PUT" })
      void fetch(`${shutdownOrigin}/v2/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sender_name: null,
          sender_address: "a@b",
          message: "Vänta",
          audience: "litteraturbanken"
        })
      }).catch(() => {})
      await waitForContactSubmissionAt(shutdownOrigin)

      shutdownFixture.kill("SIGTERM")
      let timeout: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("fixture did not exit after SIGTERM")),
            500
          )
        })
      ]).finally(() => clearTimeout(timeout))
    } finally {
      if (shutdownFixture.exitCode === null) {
        forced = true
        shutdownFixture.kill("SIGKILL")
        await exited
      }
    }

    expect(forced).toBe(false)
  })

  test("returns deterministic typed Quick Search rows, correction, and no-hit envelopes", async () => {
    const populated = await (await fetch(
      `${origin}/v2/quick-search?query=strindberg`
    )).json()
    const correction = await (await fetch(
      `${origin}/v2/quick-search?query=strindbrg`
    )).json()
    const noHit = await (await fetch(
      `${origin}/v2/quick-search?query=inga`
    )).json()

    expect(populated).toEqual({
      items: [
        {
          kind: "author",
          label: "Strindberg, August (1849-1912)",
          url: "/författare/StrindbergA",
          type_label: "Författare",
          media_type_label: null
        },
        {
          kind: "work",
          label: "Strindberg – Röda rummet",
          url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
          type_label: "Verk",
          media_type_label: "etext"
        },
        {
          kind: "part",
          label: "Lagerlöf – Landskapet",
          url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
          type_label: "Del",
          media_type_label: "faksimil"
        }
      ],
      correction: null
    })
    expect(correction).toEqual({ items: [], correction: "strindberg" })
    expect(noHit).toEqual({ items: [], correction: null })
  })

  test("serves a deterministic rich text-search results response", async () => {
    const response = await postTextSearchResults(textSearchResultsRequest("frihet"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      query: "frihet",
      page: 1,
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
    })
  })

  test("generates all text-search operations and title author facet schemas", () => {
    expect(generatedTextSearchResultsContract).toBeNull()
    expect(generatedTextSearchCountContract).toBeNull()
    expect(generatedTextSearchOptionsContract).toBeNull()

    const options: TextSearchOptionsResponse = {
      authors: [],
      about_authors: [],
      title_options: [],
      title_author_facets: [{
        author_id: "StrindbergA",
        name_for_index: "Strindberg, August",
        count: 1
      }],
      title_total: 0,
      year_from: null,
      year_to: null
    }
    expect(options.title_author_facets[0]?.author_id).toBe("StrindbergA")
  })

  test("serves zero and overflow results plus deterministic counts", async () => {
    const empty = await postTextSearchResults(textSearchResultsRequest("inga"))
    const overflow = await postTextSearchResults(textSearchResultsRequest("overflow"))
    const richCount = await postTextSearch("count", textSearchCountRequest("frihet"))
    const emptyCount = await postTextSearch("count", textSearchCountRequest("inga"))
    const overflowCount = await postTextSearch("count", textSearchCountRequest("overflow"))

    expect(await empty.json()).toEqual({
      query: "inga",
      page: 1,
      page_size: 30,
      total_work_hits: 0,
      author_facets: [],
      works: []
    })
    const overflowBody = await overflow.json()
    expect(overflowBody).toMatchObject({
      query: "overflow",
      total_work_hits: 64
    })
    expect(overflowBody.works[0]).toMatchObject({ has_more_highlights: true })
    expect(await richCount.json()).toEqual({
      query: "frihet",
      total_documents: 2,
      total_highlights: 3
    })
    expect(await emptyCount.json()).toEqual({
      query: "inga",
      total_documents: 0,
      total_highlights: 0
    })
    expect(await overflowCount.json()).toEqual({
      query: "overflow",
      total_documents: 64,
      total_highlights: 512
    })
  })

  test("serves advanced options, overflow, and selected-title preservation", async () => {
    const advanced = await postTextSearch("options", textSearchOptionsRequest("lager", {
      query: "frihet",
      categories: ["texttype:roman"],
      languages: ["language:swe"],
      gender: "female",
      year_from: 1850,
      year_to: 1950
    }))
    const overflow = await postTextSearch("options", textSearchOptionsRequest("overflow"))
    const preserved = await postTextSearch("options", textSearchOptionsRequest("inga", {
      selected_work_ids: ["lb238704"]
    }))

    expect(await advanced.json()).toEqual({
      authors: [{
        author_id: "LagerlöfS",
        name_for_index: "Lagerlöf, Selma",
        birth_year: "1858",
        death_year: "1940"
      }],
      about_authors: [{
        author_id: "StrindbergA",
        name_for_index: "Strindberg, August",
        birth_year: "1849",
        death_year: "1912"
      }],
      title_options: [{
        work_id: "lb278171",
        title: "Gösta Berlings saga",
        author_name: "Selma Lagerlöf"
      }],
      title_author_facets: [{
        author_id: "LagerlöfS",
        name_for_index: "Lagerlöf, Selma",
        count: 1
      }],
      title_total: 1,
      year_from: 1849,
      year_to: 1940
    })
    const overflowBody = await overflow.json() as TextSearchOptionsResponse
    expect(overflowBody.title_total).toBe(731)
    expect(overflowBody.title_options).toHaveLength(30)
    expect(overflowBody.title_author_facets).toEqual([{
      author_id: "OverflowAuthor",
      name_for_index: "Överflöd, Test",
      count: 731
    }])
    expect(await preserved.json()).toMatchObject({
      title_total: 0,
      title_options: [{
        work_id: "lb238704",
        title: "Röda rummet",
        author_name: "August Strindberg"
      }],
      title_author_facets: [{
        author_id: "StrindbergA",
        name_for_index: "Strindberg, August",
        count: 1
      }]
    })
  })

  test("logs exact text-search method, path, body, and order with isolated resets", async () => {
    const resultsBody = textSearchResultsRequest("frihet", { author_ids: ["StrindbergA"] })
    const countBody = textSearchCountRequest("frihet")
    const optionsBody = textSearchOptionsRequest("lager")
    await postTextSearchResults(resultsBody)
    await postTextSearch("results", textSearchResultsRequest("inga"))
    await postTextSearch("count", countBody)
    await postTextSearch("options", optionsBody)

    expect(await textSearchRequests()).toEqual({
      results: [
        { method: "POST", path: "/v2/text-search/results", body: resultsBody },
        {
          method: "POST",
          path: "/v2/text-search/results",
          body: textSearchResultsRequest("inga")
        }
      ],
      count: [{ method: "POST", path: "/v2/text-search/count", body: countBody }],
      options: [{ method: "POST", path: "/v2/text-search/options", body: optionsBody }],
      chronology: []
    })

    await fetch(`${origin}/_text_search/requests/results`, { method: "DELETE" })
    expect(await textSearchRequests()).toEqual({
      results: [],
      count: [{ method: "POST", path: "/v2/text-search/count", body: countBody }],
      options: [{ method: "POST", path: "/v2/text-search/options", body: optionsBody }],
      chronology: []
    })
  })

  test.each(["results", "count", "options"])(
    "requires POST for the text-search %s operation",
    async (operation) => {
      const response = await fetch(`${origin}/v2/text-search/${operation}`)

      expect(response.status).toBe(405)
      expect(await textSearchRequests()).toEqual({
        results: [], count: [], options: [], chronology: []
      })
    }
  )

  test("rejects malformed or structurally invalid JSON without ledgering", async () => {
    const malformedJson = await fetch(`${origin}/v2/text-search/count`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    })
    const unknownField = await fetch(`${origin}/v2/text-search/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...textSearchOptionsRequest(""), unknown: true })
    })

    expect(malformedJson.status).toBe(400)
    expect(unknownField.status).toBe(422)
    expect(await textSearchRequests()).toEqual({
      results: [], count: [], options: [], chronology: []
    })
  })

  test("rejects legacy text-search filter values longer than 100 characters", async () => {
    const response = await postTextSearchResults(textSearchResultsRequest("frihet", {
      legacy_filters: [{ field: "keyword", value: "x".repeat(101) }]
    }))

    expect(response.status).toBe(422)
    expect(await textSearchRequests()).toEqual({
      results: [], count: [], options: [], chronology: []
    })
  })

  test.each(["application/jsonp", "application/json-patch+json"])(
    "rejects non-JSON text-search content type %s",
    async (contentType) => {
      const response = await fetch(`${origin}/v2/text-search/results`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: JSON.stringify(textSearchResultsRequest("frihet"))
      })

      expect(response.status).toBe(422)
      expect(await textSearchRequests()).toEqual({
        results: [], count: [], options: [], chronology: []
      })
    }
  )

  test("accepts application/json text-search bodies with a charset parameter", async () => {
    const response = await fetch(`${origin}/v2/text-search/results`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(textSearchResultsRequest("frihet"))
    })

    expect(response.status).toBe(200)
  })

  test("fails text-search operations independently and rejects unknown controls", async () => {
    const configured = await fetch(`${origin}/_text_search/failures`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "count" })
    })
    expect(configured.status).toBe(200)

    const results = await postTextSearchResults(textSearchResultsRequest("frihet"))
    const count = await postTextSearch("count", textSearchCountRequest("frihet"))
    const options = await postTextSearch("options", textSearchOptionsRequest(""))
    expect(results.status).toBe(200)
    expect(count.status).toBe(503)
    expect(await count.json()).toEqual({
      error: {
        code: "text_search_count_unavailable",
        message: "Unable to count text-search results",
        details: null
      }
    })
    expect(options.status).toBe(200)

    const unknown = await fetch(`${origin}/_text_search/failures`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "unknown" })
    })
    expect(unknown.status).toBe(422)
    expect(await (await fetch(`${origin}/_text_search/failures`)).json()).toEqual({
      failures: ["count"]
    })
  })

  test("applies independent per-query and per-title-filter delays then resets them", async () => {
    for (const control of [
      { operation: "results", selector: "overflow", delay: 80 },
      { operation: "results", selector: "inga", delay: 0 },
      { operation: "options", selector: "lager", delay: 70 }
    ]) {
      const response = await fetch(`${origin}/_text_search/delays`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(control)
      })
      expect(response.status).toBe(200)
    }

    const completionOrder: string[] = []
    await Promise.all([
      postTextSearchResults(textSearchResultsRequest("overflow")).then(() => {
        completionOrder.push("overflow")
      }),
      postTextSearchResults(textSearchResultsRequest("inga")).then(() => {
        completionOrder.push("inga")
      })
    ])
    expect(completionOrder).toEqual(["inga", "overflow"])

    const optionCompletionOrder: string[] = []
    await Promise.all([
      postTextSearch("options", textSearchOptionsRequest("lager")).then(() => {
        optionCompletionOrder.push("lager")
      }),
      postTextSearch("options", textSearchOptionsRequest("inga")).then(() => {
        optionCompletionOrder.push("inga")
      })
    ])
    expect(optionCompletionOrder).toEqual(["inga", "lager"])

    await fetch(`${origin}/_text_search/delays/results`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_text_search/delays`)).json()).toEqual({
      delays: {
        results: {},
        count: {},
        options: { lager: 70 },
        chronology: {}
      }
    })
  })

  test("records and resets Quick Search queries without changing the general request ledger", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg%20r%C3%B6da`)

    expect(await quickSearchRequests()).toEqual({
      queries: ["strindberg röda"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })

    await fetch(`${origin}/_quick_search_requests`, { method: "DELETE" })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
  })

  test("returns a typed Quick Search 503 until its independent failure control is reset", async () => {
    await fetch(`${origin}/_quick_search_failure`, { method: "PUT" })

    const failed = await fetch(`${origin}/v2/quick-search?query=strindberg`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "quick_search_unavailable",
        message: "Unable to load quick-search results",
        details: null
      }
    })

    await fetch(`${origin}/_quick_search_failure`, { method: "DELETE" })
    const restored = await fetch(`${origin}/v2/quick-search?query=strindberg`)
    expect(restored.status).toBe(200)
    expect((await restored.json()).items).toHaveLength(3)
  })

  test("applies per-query delays so a later Quick Search response can finish first", async () => {
    await fetch(`${origin}/_quick_search_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strindberg: 80, inga: 0 })
    })

    const completionOrder: string[] = []
    const slow = fetch(`${origin}/v2/quick-search?query=strindberg`).then(() => {
      completionOrder.push("strindberg")
    })
    const fast = fetch(`${origin}/v2/quick-search?query=inga`).then(() => {
      completionOrder.push("inga")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["inga", "strindberg"])
    expect(await quickSearchRequests()).toEqual({
      queries: ["strindberg", "inga"]
    })
    expect(await (await fetch(`${origin}/_quick_search_delays`)).json()).toEqual({
      delays: { strindberg: 80, inga: 0 }
    })

    await fetch(`${origin}/_quick_search_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_quick_search_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("work lookup serves deterministic rows for exact ID and title bodies with CORS", async () => {
    const byId = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })
    const byTitles = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["Röda rummet", "Gösta Berlings saga"]
    })

    expect(byId.status).toBe(200)
    expect(byId.headers.get("access-control-allow-origin")).toBe("*")
    expect(byId.headers.get("access-control-allow-methods")).toContain("POST")
    expect(await byId.json()).toEqual({
      items: [
        {
          work_id: "lb238704",
          author: {
            label: "Strindberg",
            url: "/författare/StrindbergA"
          },
          title: {
            label: "Röda rummet",
            url: "/författare/StrindbergA/titlar/RodaRummet/etext"
          },
          media: [
            {
              label: "etext",
              url: "/författare/StrindbergA/titlar/RodaRummet/etext"
            },
            {
              label: "faksimil",
              url: "/författare/StrindbergA/titlar/RodaRummet/faksimil"
            }
          ]
        }
      ]
    })
    expect(byTitles.status).toBe(200)
    expect((await byTitles.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704", "lb278171"])
  })

  test("work lookup matches the lowercase compact Unicode route title", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["rödarummet"]
    })

    expect(response.status).toBe(200)
    expect((await response.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704"])
  })

  test("work lookup matches the visual authority title aliases", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["Titel", "Titel två"]
    })

    expect(response.status).toBe(200)
    expect((await response.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704", "lb278171"])
  })

  test("work lookup records path and body then resets without touching other ledgers", async () => {
    const body = { work_id: null, titles: ["Röda rummet"] }
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await postWorkLookup("/v2/works/lookup", body)

    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/v2/works/lookup", body }]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })

    await fetch(`${origin}/_work_lookup_requests`, { method: "DELETE" })
    expect(await workLookupRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
  })

  test("work lookup has an independent exact 503 control", async () => {
    await fetch(`${origin}/_work_lookup_failure`, { method: "PUT" })

    const failed = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })

    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "work_lookup_unavailable",
        message: "Unable to load ID lookup results",
        details: null
      }
    })
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)
    expect((await fetch(
      `${origin}/v2/quick-search?query=strindberg`
    )).status).toBe(200)

    await fetch(`${origin}/_work_lookup_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_work_lookup_failure`)).json()).toEqual({
      failure: false
    })
    expect((await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })).status).toBe(200)

    await fetch(`${origin}/_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: "works" })
    })
    expect((await fetch(`${origin}/v2/works/popular`)).status).toBe(503)
    expect((await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })).status).toBe(200)
  })

  test("work lookup uses serialized bodies for deterministic latest-response ordering", async () => {
    const slowBody = { work_id: null, titles: ["Röda rummet"] }
    const fastBody = { work_id: "lb278171", titles: [] }
    const delays = {
      [JSON.stringify(slowBody)]: 80,
      [JSON.stringify(fastBody)]: 0
    }
    await fetch(`${origin}/_work_lookup_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delays)
    })

    const completionOrder: string[] = []
    const slow = postWorkLookup("/v2/works/lookup", slowBody).then(() => {
      completionOrder.push("slow")
    })
    const fast = postWorkLookup("/v2/works/lookup", fastBody).then(() => {
      completionOrder.push("fast")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["fast", "slow"])
    expect(await workLookupRequests()).toEqual({
      requests: [
        { path: "/v2/works/lookup", body: slowBody },
        { path: "/v2/works/lookup", body: fastBody }
      ]
    })
    expect(await (await fetch(`${origin}/_work_lookup_delays`)).json()).toEqual({
      delays
    })

    await fetch(`${origin}/_work_lookup_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_work_lookup_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("work lookup exposes a separately addressable duplicate representation", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb-duplicate",
      titles: []
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].media).toEqual([
      {
        label: "etext",
        url: "/författare/TestAuthor/titlar/Duplicate/etext"
      },
      {
        label: "etext",
        url: "/författare/TestAuthor/titlar/Duplicate/etext"
      }
    ])
  })

  test("author resolve accepts public and private requests with normalized request ordering", async () => {
    const body = {
      author_ids: [" StrindbergA ", "UnknownAuthor", "LongNameAuthor", "LagerlofS"]
    }
    const expected = {
      items: [
        {
          author_id: "StrindbergA",
          full_name: "August Strindberg",
          surname: "Strindberg"
        },
        {
          author_id: "LongNameAuthor",
          full_name: "Anna Maria Lovisa Charlotta von Långnamn",
          surname: null
        },
        {
          author_id: "LagerlofS",
          full_name: "Selma Lagerlöf",
          surname: "Lagerlöf"
        }
      ]
    }

    const publicResponse = await postAuthorResolve("/v2/authors/resolve", body)
    const privateResponse = await postAuthorResolve("/private-v2/authors/resolve", body)

    expect(publicResponse.status).toBe(200)
    expect(await publicResponse.json()).toEqual(expected)
    expect(privateResponse.status).toBe(200)
    expect(await privateResponse.json()).toEqual(expected)
    expect(await authorResolveRequests()).toEqual({
      requests: [
        { path: "/v2/authors/resolve", body },
        { path: "/private-v2/authors/resolve", body }
      ]
    })
  })

  test("author resolve failure and ledger resets remain isolated from other fixture state", async () => {
    const lookupBody = { work_id: "lb238704", titles: [] }
    await fetch(`${origin}/v2/stats`)
    await postWorkLookup("/v2/works/lookup", lookupBody)
    await postAuthorResolve("/v2/authors/resolve", { author_ids: ["StrindbergA"] })

    await fetch(`${origin}/_author_resolve_requests`, { method: "DELETE" })
    expect(await authorResolveRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/v2/works/lookup", body: lookupBody }]
    })

    await fetch(`${origin}/_author_resolve_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_author_resolve_failure`)).json()).toEqual({
      failure: true
    })
    const failedBody = { author_ids: ["LagerlofS"] }
    const failed = await postAuthorResolve("/private-v2/authors/resolve", failedBody)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "author_resolve_unavailable",
        message: "Unable to resolve authors",
        details: null
      }
    })
    expect(await authorResolveRequests()).toEqual({
      requests: [{ path: "/private-v2/authors/resolve", body: failedBody }]
    })

    await fetch(`${origin}/_author_resolve_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_resolve_failure`)).json()).toEqual({
      failure: false
    })
    expect((await postAuthorResolve(
      "/v2/authors/resolve",
      { author_ids: ["LagerlofS"] }
    )).status).toBe(200)
  })

  test("author resolve uses serialized bodies for deterministic delayed responses", async () => {
    const slowBody = { author_ids: ["StrindbergA"] }
    const fastBody = { author_ids: ["LagerlofS"] }
    const delays = {
      [JSON.stringify(slowBody)]: 80,
      [JSON.stringify(fastBody)]: 0
    }
    await fetch(`${origin}/_author_resolve_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delays)
    })

    const completionOrder: string[] = []
    const slow = postAuthorResolve("/v2/authors/resolve", slowBody).then(() => {
      completionOrder.push("slow")
    })
    const fast = postAuthorResolve("/v2/authors/resolve", fastBody).then(() => {
      completionOrder.push("fast")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["fast", "slow"])
    expect(await authorResolveRequests()).toEqual({
      requests: [
        { path: "/v2/authors/resolve", body: slowBody },
        { path: "/v2/authors/resolve", body: fastBody }
      ]
    })
    expect(await (await fetch(`${origin}/_author_resolve_delays`)).json()).toEqual({
      delays
    })

    await fetch(`${origin}/_author_resolve_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_resolve_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("author resolve rejects every invalid strict request without recording it", async () => {
    const invalidBodies: unknown[] = [
      { author_ids: [] },
      { author_ids: ["Duplicate", "Duplicate"] },
      { author_ids: ["Duplicate", " Duplicate "] },
      { author_ids: Array.from({ length: 51 }, (_, index) => `Author${index}`) },
      { author_ids: [" "] },
      { author_ids: ["x".repeat(101)] },
      {},
      { author_ids: "StrindbergA" },
      { author_ids: ["StrindbergA", 42] },
      { author_ids: ["StrindbergA"], unexpected: true },
      null,
      ["StrindbergA"]
    ]

    for (const body of invalidBodies) {
      const response = await postAuthorResolve("/v2/authors/resolve", body)
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }
    expect(await authorResolveRequests()).toEqual({ requests: [] })
  })

  test("work lookup private-v2 dispatch preserves original paths for every v2 fixture", async () => {
    const contactBody = {
      sender_name: null,
      sender_address: "a@b",
      message: "Hej!",
      audience: "litteraturbanken"
    }
    const lookupBody = { work_id: "lb238704", titles: [] }
    const responses = [
      await fetch(`${origin}/private-v2/stats`),
      await fetch(`${origin}/private-v2/works/popular?limit=1`),
      await fetch(`${origin}/private-v2/epubs/popular?limit=1`),
      await fetch(`${origin}/private-v2/quick-search?query=strindberg`),
      await fetch(`${origin}/private-v2/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactBody)
      }),
      await postWorkLookup("/private-v2/works/lookup", lookupBody)
    ]

    expect(responses.map(response => response.status)).toEqual([
      200, 200, 200, 200, 202, 200
    ])
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: [
        "/private-v2/stats",
        "/private-v2/works/popular?limit=1",
        "/private-v2/epubs/popular?limit=1",
        "/private-v2/contact"
      ]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await contactSubmissions()).toEqual({
      contactSubmissions: [contactBody]
    })
    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/private-v2/works/lookup", body: lookupBody }]
    })
  })

  test("serves and separately records the exact Home fragment and rendered assets", async () => {
    await fetch(`${origin}/v2/stats`)

    const fragment = await fetch(
      `${origin}/red/om/start/startsida-ny.html?fixture-cache`
    )
    const stylesheet = await fetch(
      `${origin}/red/css/startsida.css?fixture-cache`
    )
    const background = await fetch(
      `${origin}/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg`
    )

    expect(fragment.status).toBe(200)
    expect(fragment.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(createHash("sha256").update(await fragment.text()).digest("hex")).toBe(
      "d6b6c2c33c1043d6df34ee2d8dae9d5f612754546f51a7f78b5f9b7ef39d6688"
    )
    expect(stylesheet.status).toBe(200)
    expect(stylesheet.headers.get("content-type")).toBe("text/css; charset=utf-8")
    expect(createHash("sha256").update(await stylesheet.text()).digest("hex")).toBe(
      "80e9c19f1fcfa3c2364edcdad9755192e358000bab3449e78867fa9daccdb2ea"
    )
    expect(background.status).toBe(200)
    expect(background.headers.get("content-type")).toBe("image/jpeg")
    expect(createHash("sha256").update(Buffer.from(await background.arrayBuffer())).digest("hex"))
      .toBe("e3a36d33654320df4bbb81fb7c70b3cc716c8d9ed425d06547a4f52951e52922")

    expect(await homeRequests()).toEqual({
      requests: [
        "/red/om/start/startsida-ny.html?fixture-cache",
        "/red/css/startsida.css?fixture-cache",
        "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"
      ]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await contactSubmissions()).toEqual({ contactSubmissions: [] })

    await fetch(`${origin}/_home_requests`, { method: "DELETE" })
    expect(await homeRequests()).toEqual({ requests: [] })
  })

  test("Home content failure is independent and resettable without failing its assets", async () => {
    await fetch(`${origin}/_home_failure`, { method: "PUT" })

    const failed = await fetch(
      `${origin}/red/om/start/startsida-ny.html?failed-cache`
    )
    expect(failed.status).toBe(503)
    expect(failed.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(await failed.text()).toBe("content unavailable")
    expect((await fetch(`${origin}/red/css/startsida.css?failed-cache`)).status).toBe(200)
    expect((await fetch(
      `${origin}/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg`
    )).status).toBe(200)
    expect((await fetch(`${origin}/v2/quick-search?query=strindberg`)).status).toBe(200)
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)

    await fetch(`${origin}/_home_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_home_failure`)).json()).toEqual({ failure: false })
    expect((await fetch(
      `${origin}/red/om/start/startsida-ny.html?restored-cache`
    )).status).toBe(200)
  })

  test("does not serve a near-match for the fixed Home content path", async () => {
    const response = await fetch(
      `${origin}/red/om/start/startsida-ny-copy.html?fixture-cache`
    )

    expect(response.status).toBe(404)
    expect(await homeRequests()).toEqual({ requests: [] })
  })

  test("serves exact Presentation XHTML, XML, and rendered assets with isolated accounting", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await fetch(`${origin}/red/om/start/startsida-ny.html`)

    const expected = [
      ["/red/presentationer/presentationerForfattare.html?fixture-cache", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/Censur.html", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/Rostratt.html", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html", "text/html; charset=utf-8"],
      ["/red/presentationer/vandringar/VandringElam.html", "text/html; charset=utf-8"],
      ["/red/bilder/bakgrundsbilder/backgrounds.xml", "application/xml; charset=utf-8"],
      ["/red/presentationer/specialomraden/Rostratt.css", "text/css; charset=utf-8"],
      ["/app/style/litteraturbanken.css", "text/css; charset=utf-8"],
      ["/app/style/date.css", "text/css; charset=utf-8"],
      ...Array.from({ length: 10 }, (_, index) => [
        `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`,
        "image/jpeg"
      ] as const),
      ["/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf", "application/pdf"],
      ["/red/bilder/bakgrundsbilder/rostratt_a.jpg", "image/jpeg"],
      ["/red/bilder/bakgrundsbilder/rostratt_b.jpg", "image/jpeg"]
    ] as const

    for (const [path, contentType] of expected) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(200)
      expect(response.headers.get("content-type"), path).toBe(contentType)
      expect((await response.arrayBuffer()).byteLength, path).toBeGreaterThan(0)
    }

    expect(await presentationRequests()).toEqual({
      requests: expected.map(([path]) => path)
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await homeRequests()).toEqual({
      requests: ["/red/om/start/startsida-ny.html"]
    })

    await fetch(`${origin}/_presentation_requests`, { method: "DELETE" })
    expect(await presentationRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await homeRequests()).toEqual({
      requests: ["/red/om/start/startsida-ny.html"]
    })
  })

  test("Presentation XHTML, XML, and asset failures are independent and resettable", async () => {
    const fail = async (resource: "xhtml" | "xml" | "asset") => {
      await fetch(`${origin}/_presentation_failures`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource })
      })
    }

    await fail("xhtml")
    await fail("asset")
    expect(await (await fetch(`${origin}/_presentation_failures`)).json()).toEqual({
      failures: ["xhtml", "asset"]
    })
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Censur.html`)).status)
      .toBe(503)
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Rostratt.css`)).status)
      .toBe(503)
    expect((await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)).status)
      .toBe(200)

    await fetch(`${origin}/_presentation_failures`, { method: "DELETE" })
    await fail("xml")
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Censur.html`)).status)
      .toBe(200)
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Rostratt.css`)).status)
      .toBe(200)
    const xml = await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)
    expect(xml.status).toBe(503)
    expect(xml.headers.get("content-type")).toBe("text/plain; charset=utf-8")

    await fetch(`${origin}/_presentation_failures`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_presentation_failures`)).json()).toEqual({
      failures: []
    })
    expect((await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)).status)
      .toBe(200)
  })

  test("records but never serves non-allowlisted Presentation paths", async () => {
    const unknownDocument = "/red/presentationer/specialomraden/FutureEditorialAddition.html"
    const unknownAsset = "/red/presentationer/specialomraden/Rostratt-copy.css"

    expect((await fetch(`${origin}${unknownDocument}?probe=1`)).status).toBe(404)
    expect((await fetch(`${origin}${unknownAsset}`)).status).toBe(404)
    expect(await presentationRequests()).toEqual({
      requests: [`${unknownDocument}?probe=1`, unknownAsset]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({ requests: [] })
    expect(await homeRequests()).toEqual({ requests: [] })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await contactSubmissions()).toEqual({ contactSubmissions: [] })
  })

  test("serves Litteraturkartan paths and resets only its exact request ledger", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await fetch(`${origin}/red/om/ide/omlitteraturbanken.html?content=1`)
    await fetch(`${origin}/red/om/start/startsida-ny.html?home=1`)

    const root = await fetch(`${origin}/litteraturkartan`)
    const nestedPath = "/litteraturkartan/region/%C3%96land/%E2%80%93?view=text%2Fbild&empty="
    const nested = await fetch(`${origin}${nestedPath}`)

    expect(root.status).toBe(200)
    expect(root.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(await root.text()).toContain("litteraturkartan-upstream-fixture")
    expect(nested.status).toBe(200)
    expect(await nested.text()).toContain("litteraturkartan-upstream-fixture")
    expect(await litteraturkartanRequests()).toEqual({
      requests: ["/litteraturkartan", nestedPath]
    })

    const genericLedger = await (await fetch(`${origin}/_requests`)).json()
    const quickSearchLedger = await quickSearchRequests()
    const homeLedger = await homeRequests()

    await fetch(`${origin}/_litteraturkartan_requests`, { method: "DELETE" })

    expect(await litteraturkartanRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual(genericLedger)
    expect(await quickSearchRequests()).toEqual(quickSearchLedger)
    expect(await homeRequests()).toEqual(homeLedger)
  })

  test("serves exact public and private Library EPUB query-string pages and background", async () => {
    const types = "etext,faksimil,pdf"
    const publicPath = `/api/query_string/${types}`
    const privatePath = `/legacy-api/query_string/${types}`
    const q = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)"
    const publicParams = new URLSearchParams({
      q,
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    })
    const privateParams = new URLSearchParams({
      q,
      sort_field: "sort_date_imprint.plain|asc",
      from: "100",
      to: "200"
    })

    const publicResponse = await fetch(`${origin}${publicPath}?${publicParams}`)
    const privateResponse = await fetch(`${origin}${privatePath}?${privateParams}`)
    const background = await fetch(
      `${origin}/red/bilder/bakgrundsbilder/ljudlandskap.jpg`
    )

    expect(publicResponse.status).toBe(200)
    expect(privateResponse.status).toBe(200)
    const publicBody = await publicResponse.json() as { data: unknown[] }
    expect(publicBody).toMatchObject({
      hits: 201,
      distinct_hits: 201,
      suggest: [],
      data: expect.any(Array)
    })
    expect(publicBody.data[0]).toEqual({
      _index: "etext",
      lbworkid: "lb-DoktorGlas",
      titlepath: "DoktorGlas",
      titleid: "DoktorGlas",
      work_titleid: "DoktorGlas",
      shorttitle: "Doktor Glas",
      title: "Doktor Glas. Roman",
      texttype: "roman",
      mediatype: "etext",
      searchable: true,
      startpagename: "-2",
      has_epub: true,
      sort_date_imprint: { plain: "1905" },
      main_author: {
        authorid: "SöderbergH",
        full_name: "Hjalmar Söderberg",
        surname: "Söderberg"
      },
      work_authors: [{ authorid: "SöderbergH", surname: "Söderberg" }],
      export: [
        { type: "epub", size: 530557 },
        { type: "txt", size: 1024 }
      ]
    })
    expect(await privateResponse.json()).toMatchObject({
      hits: 201,
      distinct_hits: 201,
      suggest: [],
      data: [{
        titleid: "GostaBerlingsSaga",
        shorttitle: "Gösta Berlings saga",
        main_author: { authorid: "LagerlofS", surname: "Lagerlöf" }
      }]
    })
    expect(background.status).toBe(200)
    expect(background.headers.get("content-type")).toBe("image/jpeg")
    expect(createHash("sha256").update(Buffer.from(await background.arrayBuffer())).digest("hex"))
      .toBe("f5d78b0ff6d97dc197aaf9c62f504af684a778f7dd0bdeac8057e21c13b83d04")

    expect(await libraryQueryRequests()).toEqual({
      requests: [
        {
          path: publicPath,
          query: {
            q,
            sort_field: "popularity|desc",
            from: "0",
            to: "100"
          }
        },
        {
          path: privatePath,
          query: {
            q,
            sort_field: "sort_date_imprint.plain|asc",
            from: "100",
            to: "200"
          }
        }
      ]
    })

    expect((await fetch(`${origin}/api/query_string/etext,faksimil?${publicParams}`)).status)
      .toBe(404)
    expect((await libraryQueryRequests()).requests).toHaveLength(2)
    expect(await libraryRelevanceRequests()).toEqual({ requests: [] })
  })

  test("serves and records strict Library about-author metadata on public and private paths", async () => {
    const publicKeywords = await fetch(`${origin}/api/get_authorkeywords`)
    const privateAuthors = await fetch(
      `${origin}/legacy-api/get_authors?exclude=intro%2Cdb_*`
    )

    expect(publicKeywords.status).toBe(200)
    expect(await publicKeywords.json()).toEqual(["LagerlöfS", "StrindbergA"])
    expect(privateAuthors.status).toBe(200)
    expect((await privateAuthors.json()).data).toEqual(expect.arrayContaining([
        { authorid: "StrindbergA", full_name: "August Strindberg" },
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }
    ].map(author => expect.objectContaining(author))))
    expect(await (await fetch(`${origin}/_library_metadata_requests`)).json()).toEqual({
      requests: [
        { path: "/api/get_authorkeywords", query: {} },
        { path: "/legacy-api/get_authors", query: { exclude: "intro,db_*" } }
      ]
    })

    await fetch(`${origin}/_library_metadata_requests`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_library_metadata_requests`)).json())
      .toEqual({ requests: [] })
  })

  test("serves independently selectable duplicate Library metadata variants", async () => {
    for (const variant of ["duplicate-authors", "duplicate-keywords"] as const) {
      const configured = await fetch(`${origin}/_library_metadata_variant`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variant })
      })
      expect(configured.status).toBe(200)
      expect(await configured.json()).toEqual({ variant })

      const authors = await (await fetch(
        `${origin}/api/get_authors?exclude=intro%2Cdb_*`
      )).json() as { data: Array<{ authorid: string }> }
      const keywords = await (await fetch(`${origin}/api/get_authorkeywords`)).json() as string[]
      expect(authors.data.filter(author => author.authorid === "LagerlöfS")).toHaveLength(
        variant === "duplicate-authors" ? 2 : 1
      )
      expect(keywords.filter(authorId => authorId === "LagerlöfS")).toHaveLength(
        variant === "duplicate-keywords" ? 2 : 1
      )
    }

    const reset = await fetch(`${origin}/_library_metadata_variant`, { method: "DELETE" })
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ variant: "normal" })
  })

  test("selects deterministic Library EPUB filter and malformed response variants", async () => {
    const path = "/api/query_string/etext,faksimil,pdf"
    const prefixed = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const responseFor = async (marker: string) => {
      const q = `${prefixed} (has_epub:true AND (${marker}))`
      const params = new URLSearchParams({
        q,
        sort_field: "popularity|desc",
        from: "0",
        to: "100"
      })
      return await (await fetch(`${origin}${path}?${params}`)).json() as Record<string, unknown>
    }

    const filtered = await responseFor("Selma")
    expect(filtered).toMatchObject({
      hits: 1,
      distinct_hits: 1,
      suggest: [],
      data: [{
        titleid: "GostaBerlingsSaga",
        main_author: { authorid: "LagerlofS", full_name: "Selma Lagerlöf" }
      }]
    })

    const absentSuggest = await responseFor("missing-suggest")
    expect(Object.hasOwn(absentSuggest, "suggest")).toBe(false)
    expect(absentSuggest).toMatchObject({ hits: 201, distinct_hits: 201 })

    const nullSuggest = await responseFor("null-suggest")
    expect(nullSuggest).toMatchObject({
      hits: 201,
      distinct_hits: 201,
      suggest: null
    })

    expect(await responseFor("malformed-top")).toEqual({
      data: "invalid",
      hits: 0,
      distinct_hits: 0,
      suggest: []
    })

    const malformedRows = await responseFor("malformed-row") as { data: unknown[] }
    expect(malformedRows.data).toHaveLength(4)
    expect(malformedRows.data[0]).toMatchObject({ titleid: "DoktorGlas" })
    expect(malformedRows.data[1]).toBeNull()
    expect(malformedRows.data[2]).toEqual({ _index: "etext", title: "Ofullständig" })
    expect(malformedRows.data[3]).toMatchObject({
      titleid: "UnsafeWork",
      main_author: { authorid: "../unsafe" }
    })

    expect(await responseFor("inga")).toEqual({
      data: [],
      hits: 0,
      distinct_hits: 0,
      suggest: []
    })
  })

  test("serves a delimiter-bearing Library source-work boundary", async () => {
    const params = new URLSearchParams({
      q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian " +
        "(unsafe download token) AND export>type:(xml OR txt OR workdb)",
      sort_field: "popularity|desc",
      author_aggregation: "true",
      from: "0",
      to: "100"
    })
    const response = await fetch(`${origin}/api/query_string/etext,faksimil,pdf?${params}`)
    expect(response.status).toBe(200)
    const body = await response.json() as { data: Array<Record<string, unknown>> }
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ lbworkid: "lb-SafeDownload" }),
      expect.objectContaining({ lbworkid: "lb-Unsafe,Injected-etext-txt" })
    ]))
  })

  test("Library EPUB failure, exact-state delay, and reset controls stay isolated", async () => {
    const queryPath = "/api/query_string/etext,faksimil,pdf"
    const q = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)"
    const params = (to: string) => new URLSearchParams({
      q,
      sort_field: "popularity|desc",
      from: "0",
      to
    })
    const delayKey = `${q}|popularity|desc|0|100`

    await fetch(`${origin}/api/relevance/test?q=%28preserved%29`)
    await fetch(`${origin}/api/get_work_info?titleid=DoktorGlas`)
    await fetch(`${origin}/_library_query_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [delayKey]: 150 })
    })
    expect(await (await fetch(`${origin}/_library_query_delays`)).json()).toEqual({
      delays: { [delayKey]: 150 }
    })

    const exactStarted = Date.now()
    let exactSettled = false
    const exactRequest = fetch(`${origin}${queryPath}?${params("100")}`).then((response) => {
      exactSettled = true
      return response
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect((await fetch(`${origin}${queryPath}?${params("99")}`)).status).toBe(200)
    expect(exactSettled).toBe(false)
    expect((await exactRequest).status).toBe(200)
    expect(Date.now() - exactStarted).toBeGreaterThanOrEqual(140)

    await fetch(`${origin}/_library_query_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_library_query_failure`)).json())
      .toEqual({ failure: true })
    const failed = await fetch(`${origin}${queryPath}?${params("101")}`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "library_query_unavailable",
        message: "Unable to load Library EPUBs"
      }
    })
    expect((await fetch(`${origin}/api/relevance/test?q=%28still-available%29`)).status)
      .toBe(200)
    expect((await fetch(`${origin}/api/get_work_info?titleid=DoktorGlas`)).status)
      .toBe(200)

    await fetch(`${origin}/_library_query_failure`, { method: "DELETE" })
    await fetch(`${origin}/_library_relevance_failure`, { method: "PUT" })
    expect((await fetch(`${origin}${queryPath}?${params("102")}`)).status).toBe(200)
    expect((await fetch(`${origin}/api/relevance/test?q=%28failed%29`)).status).toBe(503)

    const relevanceLedger = await libraryRelevanceRequests()
    const readerLedger = await (await fetch(`${origin}/_reader_requests`)).json()
    await fetch(`${origin}/_library_query_requests`, { method: "DELETE" })
    await fetch(`${origin}/_library_query_failure`, { method: "DELETE" })
    await fetch(`${origin}/_library_query_delays`, { method: "DELETE" })

    expect(await libraryQueryRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_library_query_failure`)).json())
      .toEqual({ failure: false })
    expect(await (await fetch(`${origin}/_library_query_delays`)).json())
      .toEqual({ delays: {} })
    expect(await libraryRelevanceRequests()).toEqual(relevanceLedger)
    expect(await (await fetch(`${origin}/_reader_requests`)).json()).toEqual(readerLedger)
    expect(await (await fetch(`${origin}/_library_relevance_failure`)).json())
      .toEqual({ failure: true })
  })

  test("serves exact public and private Library PDF pages, sorts, filter, and request ledger", async () => {
    const publicPath = "/api/query_string/etext,faksimil,pdf"
    const privatePath = "/legacy-api/query_string/etext,faksimil,pdf"
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const q = `${prefix} (${predicate})`
    const filteredQ = `${prefix} (${predicate} AND (Selma Lagerlöf))`
    const requests = [
      {
        path: publicPath,
        query: { q, sort_field: "popularity|desc", from: "0", to: "100" }
      },
      {
        path: privatePath,
        query: { q, sort_field: "sort_date_imprint.date|desc", from: "100", to: "200" }
      },
      {
        path: publicPath,
        query: {
          q,
          sort_field: "main_author.name_for_index|asc,sortkey|asc",
          from: "0",
          to: "100"
        }
      },
      {
        path: privatePath,
        query: { q: filteredQ, sort_field: "sortkey|asc", from: "0", to: "100" }
      }
    ]

    const responses = await Promise.all(requests.map(async ({ path, query }) => {
      const response = await fetch(`${origin}${path}?${new URLSearchParams(query)}`)
      expect(response.status).toBe(200)
      return await response.json() as Record<string, unknown>
    }))

    expect(responses[0]).toEqual(libraryPdfPageOneResponse)
    expect(responses[1]).toEqual(libraryPdfPageTwoResponse)
    expect(responses[3]).toEqual(libraryPdfFilteredResponse)
    const pageOne = responses[0] as { data: Array<Record<string, unknown>> }
    expect(pageOne).toMatchObject({ hits: 307, distinct_hits: 201, suggest: [] })
    expect(JSON.stringify(pageOne)).not.toContain('"url"')
    expect(JSON.stringify(pageOne)).not.toContain('"filename"')

    const representations = Object.groupBy(
      pageOne.data,
      row => String(row.titleid)
    )
    expect(representations.GostaBerlingsSaga).toMatchObject([{
      mediatype: "etext",
      license: "pd",
      export: [{ type: "pdf", size: 1_482_731 }]
    }])
    expect(representations.SvenskaFolkvisor).toMatchObject([{
      mediatype: "faksimil",
      license: "pd",
      main_author: { authorid: "GeijerEGA", full_name: "Erik Gustaf Geijer" },
      work_authors: [{ authorid: "AfzeliusAA", surname: "Afzelius" }],
      export: [{ type: "pdf", size: 1_720_419 }]
    }])
    expect(representations.RodaRummet).toMatchObject([{
      mediatype: "pdf",
      main_author: { authorid: "StrindbergA" },
      authors: [{ authorid: "ArchiveA", surname: "Arkiv" }]
    }])
    expect(representations.RodaRummet?.[0]).not.toHaveProperty("export")
    expect(representations.NilsHolgersson).toMatchObject([
      {
        mediatype: "pdf",
        work_titleid: "NilsHolgerssonPdf",
        work_authors: [{ authorid: "DirectPdfA", surname: "Direkt" }]
      },
      {
        mediatype: "faksimil",
        work_titleid: "NilsHolgersson",
        work_authors: [{ authorid: "LagerlofS" }],
        export: [{ type: "pdf", size: 2_210_001 }]
      }
    ])
    expect(representations.NilsHolgersson?.[0]).not.toHaveProperty("export")
    expect(representations.Jerusalem).toMatchObject([{
      mediatype: "etext",
      export: [
        { type: "pdf", size: 1_100_001 },
        { type: "pdf", size: 1_100_002 }
      ]
    }])
    expect(representations.RestrictedExport).toMatchObject([{
      mediatype: "faksimil",
      license: "restricted",
      export: [{ type: "pdf", size: 900_001 }]
    }])
    for (const row of pageOne.data) {
      for (const descriptor of Array.isArray(row.export) ? row.export : []) {
        expect(Object.keys(descriptor as Record<string, unknown>).sort()).toEqual(["size", "type"])
      }
    }

    expect(responses[1]).toMatchObject({
      hits: 307,
      distinct_hits: 201,
      data: [{
        titleid: "DoktorGlas",
        mediatype: "faksimil",
        sort_date_imprint: { plain: "1905" },
        main_author: { authorid: "SöderbergH", full_name: "Hjalmar Söderberg" },
        export: [{ type: "pdf", size: 1_930_005 }]
      }]
    })
    expect(responses[2]).toEqual(responses[0])
    expect(responses[3]).toMatchObject({
      hits: 2,
      distinct_hits: 1,
      data: [{
        titleid: "GostaBerlingsSaga",
        license: "pd",
        export: [{ type: "pdf" }]
      }]
    })

    expect(await libraryQueryRequests()).toEqual({ requests })

    await fetch(`${origin}/api/relevance/test?q=%28preserved-pdf-ledger%29`)
    const relevanceLedger = await libraryRelevanceRequests()
    await fetch(`${origin}/_library_query_requests`, { method: "DELETE" })
    expect(await libraryQueryRequests()).toEqual({ requests: [] })
    expect(await libraryRelevanceRequests()).toEqual(relevanceLedger)
  })

  test("projects PDF license and fallback authors only when the include requests them", async () => {
    const path = "/api/query_string/etext,faksimil,pdf"
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const epubInclude = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
    const request = async (include: string) => {
      const params = new URLSearchParams({
        q: `${prefix} (${predicate})`,
        sort_field: "popularity|desc",
        from: "0",
        to: "100",
        include
      })
      return await (await fetch(`${origin}${path}?${params}`)).json() as {
        data: Array<Record<string, unknown>>
      }
    }

    const reduced = await request(epubInclude)
    expect(reduced.data.every(row => !Object.hasOwn(row, "license"))).toBe(true)
    expect(reduced.data.every(row => !Object.hasOwn(row, "authors"))).toBe(true)

    const full = await request(`${epubInclude},license,authors.authorid,authors.surname`)
    expect(full).toEqual(libraryPdfPageOneResponse)
    expect(full.data.find(row => row.titleid === "GostaBerlingsSaga"))
      .toMatchObject({ license: "pd" })
    expect(full.data.find(row => row.titleid === "RodaRummet")).toMatchObject({
      license: "restricted",
      authors: [{ authorid: "ArchiveA", surname: "Arkiv" }]
    })
  })

  test.each(["tuple-collision", "tuple collision"])(
    "serves exact-tuple PDF grouping collisions for %s without sharing Angular's concatenated key",
    async marker => {
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const params = new URLSearchParams({
      q: `${prefix} (${predicate} AND (${marker}))`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    })
    const response = await fetch(
      `${origin}/api/query_string/etext,faksimil,pdf?${params}`
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: [
        { titleid: "TupleCollisionOne", titlepath: "ab", lbworkid: "c" },
        { titleid: "TupleCollisionTwo", titlepath: "a", lbworkid: "bc" },
        { titleid: "SamePathOne", titlepath: "shared-path", lbworkid: "lb-same-path-one" },
        { titleid: "SamePathTwo", titlepath: "shared-path", lbworkid: "lb-same-path-two" },
        { titleid: "SameWorkOne", titlepath: "same-work-one", lbworkid: "lb-shared-work" },
        { titleid: "SameWorkTwo", titlepath: "same-work-two", lbworkid: "lb-shared-work" },
        {
          titleid: "ExactTupleFirst",
          titlepath: "exact-tuple",
          lbworkid: "lb-exact-tuple",
          main_author: { authorid: "FirstTupleA" },
          export: [{ type: "pdf", size: 710_001 }]
        },
        {
          titleid: "ExactTupleSecond",
          titlepath: "exact-tuple",
          lbworkid: "lb-exact-tuple",
          main_author: { authorid: "SecondTupleA" },
          export: [{ type: "pdf", size: 710_002 }]
        },
        {
          titleid: "LaterExportGroupMain",
          titlepath: "later-export-group",
          lbworkid: "lb-later-export-group",
          mediatype: "etext",
          main_author: { authorid: "GroupMainA" }
        },
        {
          titleid: "LaterExportRepresentation",
          titlepath: "later-export-group",
          lbworkid: "lb-later-export-group",
          mediatype: "faksimil",
          main_author: { authorid: "LaterExportA" },
          export: [{ type: "pdf", size: 720_002 }]
        }
      ],
      hits: 10,
      distinct_hits: 8,
      suggest: []
    })
    }
  )

  test.each([
    ["primitive-envelope", "primitive envelope", null],
    ["invalid-hits", "invalid hits", { data: [], hits: "307", distinct_hits: 0, suggest: [] }],
    ["invalid-distinct", "invalid distinct", { data: [], hits: 0, distinct_hits: null, suggest: [] }],
    ["invalid-suggest", "invalid suggest", { data: [], hits: 0, distinct_hits: 0, suggest: {} }]
  ])("serves the %s PDF envelope boundary", async (marker, sanitizedMarker, expected) => {
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const params = new URLSearchParams({
      q: `${prefix} (${predicate} AND (${marker}))`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    })
    for (const value of [marker, sanitizedMarker]) {
      params.set("q", `${prefix} (${predicate} AND (${value}))`)
      const response = await fetch(
        `${origin}/api/query_string/etext,faksimil,pdf?${params}`
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  })

  test("serves preferred-author and same-group malformed PDF boundaries", async () => {
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const params = new URLSearchParams({
      q: `${prefix} (${predicate} AND (malformed-row))`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    })
    const response = await fetch(
      `${origin}/api/query_string/etext,faksimil,pdf?${params}`
    )
    const body = await response.json() as { data: Array<Record<string, unknown>> }
    const byTitle = Object.groupBy(body.data, row => String(row?.titleid))

    expect(byTitle.UnsafeWorkAuthor?.[0]).toMatchObject({
      work_authors: [{ authorid: "../unsafe" }],
      main_author: { authorid: "SafeA" }
    })
    expect(byTitle.MalformedAuthors?.[0]).toMatchObject({
      authors: [null],
      main_author: { authorid: "SafeA" }
    })
    expect(byTitle.EmptyWorkAuthors?.[0]).toMatchObject({
      work_authors: [],
      main_author: { authorid: "SafeA" }
    })
    expect(byTitle.MissingYear?.[0]).not.toHaveProperty("sort_date_imprint")
    expect(byTitle.MissingDisplayTitle?.[0]).toMatchObject({ shorttitle: "", title: "" })
    expect(byTitle.MissingAuthorName?.[0]).toMatchObject({
      main_author: { authorid: "SafeA", surname: "Säker" }
    })
    expect(byTitle.MissingAuthorName?.[0]?.main_author).not.toHaveProperty("full_name")
    expect(byTitle.MalformedGroupedFallback).toMatchObject([
      {
        titlepath: "MalformedGroupedFallback",
        lbworkid: "lb-MalformedGroupedFallback",
        mediatype: "faksimil",
        export: [{ type: "pdf" }]
      },
      {
        titlepath: "MalformedGroupedFallback",
        lbworkid: "lb-MalformedGroupedFallback",
        mediatype: "pdf",
        work_authors: [{ authorid: "../unsafe" }]
      }
    ])
  })

  test("does not select PDF fixtures for an EPUB query containing predicate-like filter text", async () => {
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const params = new URLSearchParams({
      q: `${prefix} (has_epub:true AND (${predicate}))`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    })
    const response = await fetch(
      `${origin}/api/query_string/etext,faksimil,pdf?${params}`
    )
    const body = await response.json() as { data: Array<{ titleid: string }> }

    expect(response.status).toBe(200)
    expect(body.data.map(row => row.titleid)).toEqual([
      "DoktorGlas",
      "SvenskaFolkvisor",
      "BlandTomtarOchTroll"
    ])
  })

  test("selects deterministic Library PDF empty, suggest, and unsafe response variants", async () => {
    const path = "/api/query_string/etext,faksimil,pdf"
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const responseFor = async (marker: string) => {
      const q = `${prefix} (${predicate} AND (${marker}))`
      const params = new URLSearchParams({
        q,
        sort_field: "popularity|desc",
        from: "0",
        to: "100"
      })
      return await (await fetch(`${origin}${path}?${params}`)).json() as Record<string, unknown>
    }

    const absentSuggest = await responseFor("missing-suggest")
    expect(Object.hasOwn(absentSuggest, "suggest")).toBe(false)
    expect(absentSuggest).toMatchObject({
      hits: 307,
      distinct_hits: 201,
      data: expect.any(Array)
    })

    const nullSuggest = await responseFor("null-suggest")
    expect(nullSuggest).toMatchObject({
      hits: 307,
      distinct_hits: 201,
      suggest: null,
      data: expect.any(Array)
    })

    expect(await responseFor("malformed-top")).toEqual({
      data: "invalid",
      hits: 0,
      distinct_hits: 0,
      suggest: []
    })

    const malformedRows = await responseFor("malformed-row") as { data: unknown[] }
    expect(malformedRows).toEqual(libraryPdfMalformedRowResponse)
    expect(malformedRows.data).toHaveLength(19)
    expect(malformedRows.data[0]).toMatchObject({
      titleid: "GostaBerlingsSaga",
      export: [{ type: "pdf", size: 1_482_731 }]
    })
    expect(malformedRows.data[1]).toBeNull()
    expect(malformedRows.data[2]).toEqual({ _index: "pdf", title: "Ofullständig" })
    expect(malformedRows.data[3]).toMatchObject({
      titleid: "UnsafeAuthor",
      main_author: { authorid: "../unsafe" }
    })
    expect(malformedRows.data[4]).toMatchObject({ titleid: "Unsafe/Title" })
    expect(malformedRows.data[5]).toMatchObject({
      titleid: "UnsupportedAudio",
      mediatype: "audio",
      lbworkid: "lb-UnsupportedAudio"
    })
    expect(malformedRows.data[6]).toMatchObject({ titleid: "UnsafeDotWork", lbworkid: ".." })
    expect(malformedRows.data[7]).toMatchObject({
      titleid: "UnsafeSlashWork",
      lbworkid: "lb/unsafe"
    })
    expect(malformedRows.data[8]).toMatchObject({
      titleid: "UnsafeControlWork",
      lbworkid: "lb-\u0000unsafe"
    })
    expect(malformedRows.data[9]).toMatchObject({
      titleid: "NumericWork",
      lbworkid: 123
    })
    expect(malformedRows.data[10]).toMatchObject({
      titleid: "UnencodableWork",
      lbworkid: "\uD800"
    })

    expect(await responseFor("inga")).toEqual({
      data: [],
      hits: 0,
      distinct_hits: 0,
      suggest: []
    })
  })

  test("Library PDF delay and failure controls snapshot exact outstanding identities", async () => {
    const path = "/api/query_string/etext,faksimil,pdf"
    const prefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
    const predicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
    const q = `${prefix} (${predicate})`
    const filteredQ = `${prefix} (${predicate} AND (Selma Lagerlöf))`
    const identities = [
      { q: filteredQ, sort_field: "popularity|desc", from: "0", to: "100" },
      { q, sort_field: "sortkey|asc", from: "0", to: "100" },
      { q, sort_field: "popularity|desc", from: "1", to: "100" },
      { q, sort_field: "popularity|desc", from: "0", to: "101" }
    ]
    const delays = Object.fromEntries(identities.map(query => [
      [query.q, query.sort_field, query.from, query.to].join("|"),
      100
    ]))

    await fetch(`${origin}/_library_query_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delays)
    })
    await fetch(`${origin}/_library_query_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_library_query_delays`)).json())
      .toEqual({ delays })
    expect(await (await fetch(`${origin}/_library_query_failure`)).json())
      .toEqual({ failure: true })

    const startedAt = Date.now()
    const settled = identities.map(() => false)
    const outstanding = identities.map((query, index) => fetch(
      `${origin}${path}?${new URLSearchParams(query)}`
    ).then((response) => {
      settled[index] = true
      return response
    }))

    await new Promise(resolve => setTimeout(resolve, 15))
    expect(settled).toEqual([false, false, false, false])

    await fetch(`${origin}/_library_query_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_library_query_delays`)).json())
      .toEqual({ delays: {} })
    expect(await (await fetch(`${origin}/_library_query_failure`)).json())
      .toEqual({ failure: true })

    await fetch(`${origin}/_library_query_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_library_query_failure`)).json())
      .toEqual({ failure: false })
    expect((await fetch(`${origin}${path}?${new URLSearchParams(identities[0]!)}`)).status)
      .toBe(200)

    const failed = await Promise.all(outstanding)
    expect(failed.map(response => response.status)).toEqual([503, 503, 503, 503])
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(90)
    expect(await failed[0]!.json()).toEqual({
      error: {
        code: "library_query_unavailable",
        message: "Unable to load Library PDFs"
      }
    })
  })

  test("serves public and private legacy Library relevance responses with isolated accounting", async () => {
    const types = "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
    const query = "q=%28R%C3%B6da+rummet%29&from=0&to=100&sort_field=_score%7Cdesc"
    const publicResponse = await fetch(`${origin}/api/relevance/${types}?${query}`)
    const privateResponse = await fetch(`${origin}/legacy-api/relevance/${types}?q=%28Selma%29`)
    const background = await fetch(
      `${origin}/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg`
    )
    const mixedResponse = await fetch(`${origin}/api/relevance/${types}?q=%28blandat%29`)
    const malformedResponse = await fetch(
      `${origin}/api/relevance/${types}?q=%28malformed-top%29`
    )

    expect(publicResponse.status).toBe(200)
    expect(privateResponse.status).toBe(200)
    expect(background.status).toBe(200)
    expect(background.headers.get("content-type")).toBe("image/jpeg")
    expect(createHash("sha256").update(Buffer.from(await background.arrayBuffer())).digest("hex"))
      .toBe("4191d7e2db8638781fa15ae06e12d8f05eff57caeb3c3f37661cbe8846465c1c")
    expect((await mixedResponse.json() as { data: unknown[] }).data).toHaveLength(17)
    expect(await malformedResponse.json()).toEqual({ data: "invalid", hits: 0, suggest: [] })
    const publicBody = await publicResponse.json() as { data: unknown[], hits: number }
    const privateBody = await privateResponse.json() as { data: unknown[], hits: number }
    expect(publicBody.hits).toBe(publicBody.data.length)
    expect(privateBody.hits).toBe(privateBody.data.length)
    expect(publicBody.data).not.toEqual(privateBody.data)
    expect(await libraryRelevanceRequests()).toEqual({
      requests: [
        {
          path: `/api/relevance/${types}`,
          query: {
            q: "(Röda rummet)",
            from: "0",
            to: "100",
            sort_field: "_score|desc"
          }
        },
        {
          path: `/legacy-api/relevance/${types}`,
          query: { q: "(Selma)" }
        },
        {
          path: `/api/relevance/${types}`,
          query: { q: "(blandat)" }
        },
        {
          path: `/api/relevance/${types}`,
          query: { q: "(malformed-top)" }
        }
      ]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({ requests: [] })
  })

  test("exposes the generated Reader hit contract and page-specific source word spans", () => {
    expect(generatedReaderHitContract).toBeNull()
    expect(generatedReaderHitResponse.items[0]?.highlight).toEqual({
      from_word_id: "w2_1",
      to_word_id: "w2_2"
    })
    expect(readerPageHtmlByIndex[1]).toContain('pname="-3"')
    expect(readerPageHtmlByIndex[1]).toContain('<span class="w" id="w1_1">')
    expect(readerPageHtmlByIndex[1]).not.toContain('id="w2_1"')
    expect(readerPageHtmlByIndex[2]).toContain('pname="-2"')
    expect(readerPageHtmlByIndex[2]).toContain('<span class="w" id="w2_1">DOKTOR</span>')
    expect(readerPageHtmlByIndex[2]).toContain('<span class="w" id="w2_2">GLAS</span>')
    expect(readerPageHtmlByIndex[3]).toContain('pname="-1"')
    expect(readerPageHtmlByIndex[3]).toContain('<span class="w" id="w3_1">')
    expect(readerPageHtmlByIndex[3]).toContain('<span class="w" id="w3_2">')
    expect(readerPageHtmlByIndex[3]).not.toContain('id="w2_2"')
  })

  test("serves the matching Reader HTML body for every declared source page", async () => {
    for (const [pageIndex, pageName, wordId] of [
      [1, "-3", "w1_1"],
      [2, "-2", "w2_1"],
      [3, "-1", "w3_1"]
    ] as const) {
      const response = await fetch(
        `${origin}/txt/lb-reader-doktor-glas/res_${String(pageIndex).padStart(5, "0")}.html` +
        "?username=app"
      )
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain(`pname="${pageName}"`)
      expect(html).toContain(`id="${wordId}"`)
    }
  })

  test("serves exact public and private Reader hit windows with absolute indices", async () => {
    const publicQuery = "media_type=etext&query=doktor%20glas"
    const privateQuery = [
      "media_type=etext",
      "query=doktor%20glas",
      "offset=1",
      "limit=3",
      "word_forms=true",
      "include_older_spellings=false",
      "prefix=true",
      "suffix=true"
    ].join("&")
    const publicPath = `/v2/works/lb-reader-doktor-glas/search-hits?${publicQuery}`
    const privatePath = `/private-v2/works/lb-reader-doktor-glas/search-hits?${privateQuery}`

    const publicResponse = await fetch(`${origin}${publicPath}`)
    const privateResponse = await fetch(`${origin}${privatePath}`)

    expect(publicResponse.status).toBe(200)
    expect(await publicResponse.json()).toEqual(readerSearchHitResponse(
      "lb-reader-doktor-glas",
      "doktor glas"
    ))
    expect(privateResponse.status).toBe(200)
    expect(await privateResponse.json()).toEqual(readerSearchHitResponse(
      "lb-reader-doktor-glas",
      "doktor glas",
      1,
      3
    ))
    expect(await readerHitRequests()).toEqual({
      requests: [
        { path: "/v2/works/lb-reader-doktor-glas/search-hits", query: publicQuery },
        { path: "/private-v2/works/lb-reader-doktor-glas/search-hits", query: privateQuery }
      ]
    })
  })

  test("models phrase, single, empty, out-of-range, and malformed hit variants", async () => {
    const request = async (query: string, offset = "0", limit = "20") => {
      const params = new URLSearchParams({ media_type: "etext", query, offset, limit })
      return await fetch(
        `${origin}/v2/works/lb-reader-doktor-glas/search-hits?${params}`
      )
    }

    const phrase = await (await request("doktor glas")).json() as ReaderHitResponse
    expect(phrase.total_hits).toBe(5)
    expect(phrase.items.map(item => [item.index, item.page_name])).toEqual([
      [0, "-3"], [1, "-2"], [2, "-2"], [3, "-1"], [4, "-1"]
    ])
    expect(phrase.items[1]?.highlight).toEqual({
      from_word_id: "w2_1",
      to_word_id: "w2_2"
    })

    const single = await (await request("glas")).json() as ReaderHitResponse
    expect(single.items).toEqual([
      {
        index: 0,
        page_name: "-2",
        page_index: 2,
        highlight: { from_word_id: "w2_2", to_word_id: "w2_2" }
      }
    ])
    expect(await (await request("inga")).json()).toMatchObject({ total_hits: 0, items: [] })
    expect(await (await request("doktor glas", "99", "3")).json()).toMatchObject({
      offset: 99,
      limit: 3,
      total_hits: 5,
      items: []
    })
    expect(await (await request("malformed-response")).json()).toEqual({
      query: "malformed-response",
      media_type: "etext",
      offset: 0,
      limit: 20,
      total_hits: "invalid",
      items: []
    })
    expect(await (await request("missing-range")).json()).toMatchObject({
      items: [{
        page_name: "-2",
        highlight: { from_word_id: "missing", to_word_id: "w2_2" }
      }]
    })
    expect(await (await request("reversed-range")).json()).toMatchObject({
      items: [{
        page_name: "-2",
        highlight: { from_word_id: "w2_2", to_word_id: "w2_1" }
      }]
    })
    expect(await (await request("page-mismatch")).json()).toMatchObject({
      items: [{ page_name: "-1", page_index: 3 }]
    })
  })

  test("rejects malformed or extra Reader hit input without recording it", async () => {
    const invalidQueries = [
      "query=doktor",
      "media_type=faksimil&query=doktor",
      "media_type=etext&query=",
      `media_type=etext&query=${"a".repeat(201)}`,
      "media_type=etext&query=doktor&offset=-1",
      "media_type=etext&query=doktor&offset=1.5",
      "media_type=etext&query=doktor&limit=0",
      "media_type=etext&query=doktor&limit=21",
      "media_type=etext&query=doktor&word_forms=1",
      "media_type=etext&query=doktor&include_older_spellings=yes",
      "media_type=etext&query=doktor&extra=1"
    ]
    const invalidPaths = [
      "/v2/works/not-a-work/search-hits?media_type=etext&query=doktor",
      "/private-v2/works/lb%25unsafe/search-hits?media_type=etext&query=doktor"
    ]

    for (const query of invalidQueries) {
      const response = await fetch(
        `${origin}/v2/works/lb-reader-doktor-glas/search-hits?${query}`
      )
      expect(response.status, query).toBe(422)
      expect(await response.json(), query).toEqual({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }
    for (const path of invalidPaths) {
      expect((await fetch(`${origin}${path}`)).status, path).toBe(422)
    }
    expect(await readerHitRequests()).toEqual({ requests: [] })
  })

  test("keeps Reader hit failure, stable delay identity, and reset state isolated", async () => {
    const delayKey = [
      "lb-reader-doktor-glas",
      "doktor glas",
      "1",
      "2",
      "true",
      "false",
      "true",
      "true"
    ].join("|")
    await fetch(`${origin}/_reader_hit_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [delayKey]: 120 })
    })
    expect(await (await fetch(`${origin}/_reader_hit_delays`)).json()).toEqual({
      delays: { [delayKey]: 120 }
    })

    const delayedParams = [
      "media_type=etext",
      "query=doktor%20glas",
      "offset=1",
      "limit=2",
      "word_forms=true",
      "include_older_spellings=false",
      "prefix=true",
      "suffix=true"
    ].join("&")
    let delayedSettled = false
    const delayed = fetch(
      `${origin}/private-v2/works/lb-reader-doktor-glas/search-hits?${delayedParams}`
    ).then((response) => {
      delayedSettled = true
      return response
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    const distinctKeys = [
      `/v2/works/lb-reader-other/search-hits?${delayedParams}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("doktor%20glas", "glas")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("offset=1", "offset=0")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("limit=2", "limit=3")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("word_forms=true", "word_forms=false")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("include_older_spellings=false", "include_older_spellings=true")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("prefix=true", "prefix=false")}`,
      `/v2/works/lb-reader-doktor-glas/search-hits?${delayedParams.replace("suffix=true", "suffix=false")}`
    ]
    expect(await Promise.all(distinctKeys.map(async path => (await fetch(`${origin}${path}`)).status)))
      .toEqual(Array(distinctKeys.length).fill(200))
    expect(delayedSettled).toBe(false)
    expect((await delayed).status).toBe(200)

    await fetch(`${origin}/api/get_work_info?titleid=DoktorGlas`)
    await fetch(`${origin}/v2/quick-search?query=doktor`)
    const readerLedger = await (await fetch(`${origin}/_reader_requests`)).json()
    const quickLedger = await quickSearchRequests()

    await fetch(`${origin}/_reader_hit_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_reader_hit_failure`)).json()).toEqual({
      failure: true
    })
    const failed = await fetch(
      `${origin}/v2/works/lb-reader-doktor-glas/search-hits?media_type=etext&query=glas`
    )
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "backend_unavailable",
        message: "Search backend unavailable",
        details: null
      }
    })

    await fetch(`${origin}/_reader_hit_requests`, { method: "DELETE" })
    await fetch(`${origin}/_reader_hit_failure`, { method: "DELETE" })
    await fetch(`${origin}/_reader_hit_delays`, { method: "DELETE" })
    expect(await readerHitRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_reader_hit_failure`)).json()).toEqual({
      failure: false
    })
    expect(await (await fetch(`${origin}/_reader_hit_delays`)).json()).toEqual({ delays: {} })
    expect(await (await fetch(`${origin}/_reader_requests`)).json()).toEqual(readerLedger)
    expect(await quickSearchRequests()).toEqual(quickLedger)
  })

  test("Library relevance failure, delay, and reset controls are isolated", async () => {
    await fetch(`${origin}/_library_relevance_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "(slow)|sortkey|asc": 30 })
    })
    const started = Date.now()
    expect((await fetch(
      `${origin}/api/relevance/test?q=%28slow%29&sort_field=sortkey%7Casc`
    )).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(20)

    await fetch(`${origin}/_library_relevance_failure`, { method: "PUT" })
    expect((await fetch(`${origin}/legacy-api/relevance/test?q=%28failed%29`)).status).toBe(503)
    expect(await (await fetch(`${origin}/_library_relevance_failure`)).json())
      .toEqual({ failure: true })

    await fetch(`${origin}/_library_relevance_requests`, { method: "DELETE" })
    await fetch(`${origin}/_library_relevance_failure`, { method: "DELETE" })
    await fetch(`${origin}/_library_relevance_delays`, { method: "DELETE" })
    expect(await libraryRelevanceRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_library_relevance_failure`)).json())
      .toEqual({ failure: false })
    expect(await (await fetch(`${origin}/_library_relevance_delays`)).json())
      .toEqual({ delays: {} })
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)
  })
})
