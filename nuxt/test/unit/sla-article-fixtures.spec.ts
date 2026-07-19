import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { parseHTML } from "linkedom"
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest"

import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"
import {
  SLA_ARTICLE_REGISTRY,
  SLA_ARTICLE_REGISTRY_BY_ID,
  type SlaArticleId
} from "../../shared/types/sla-article"
import {
  slaArticleDescriptors,
  slaArticleFixtures
} from "../fixtures/sla-article-data.mjs"

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const port = 32_000 + process.pid % 10_000
const origin = `http://127.0.0.1:${port}`
let fixture: ChildProcess

type SlaArticleOperation = paths["/authors/{author_id}/documents/omtexterna/articles/{article_id}"]["get"]
type SlaArticleDescriptor = components["schemas"]["SlaArticleDescriptor"]
type SlaArticleOperationById = operations["v2_get_sla_article"]
type AssertNever<Value extends never> = Value
type MissingGeneratedArticle = AssertNever<
  Exclude<SlaArticleId, keyof typeof SLA_ARTICLE_REGISTRY_BY_ID>
>
type ExtraRuntimeArticle = AssertNever<
  Exclude<keyof typeof SLA_ARTICLE_REGISTRY_BY_ID, SlaArticleId>
>

const generatedTypeSentinel: {
  descriptor: SlaArticleDescriptor
  operation: SlaArticleOperation
  operationById: SlaArticleOperationById
} | null = null
const registryCompletenessSentinel: [MissingGeneratedArticle, ExtraRuntimeArticle] | null = null

async function waitUntilReady() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${origin}/health`)).ok) return
    } catch {
      // The fixture has not bound its isolated port yet.
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error("SLA article fixture server did not become ready")
}

async function rawStatus(path: string, method = "GET") {
  return await new Promise<number>((resolve, reject) => {
    const request = fetch(`${origin}${path}`, { method, redirect: "manual" })
    request.then(response => resolve(response.status), reject)
  })
}

async function ledger(path: string) {
  const response = await fetch(`${origin}${path}`)
  expect(response.status, path).toBe(200)
  return await response.json() as { requests: Array<{ method: string, path: string }> }
}

describe("SLA article corpus fixture", () => {
  beforeAll(async () => {
    fixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(port) },
      stdio: "ignore"
    })
    await waitUntilReady()
  })

  afterAll(async () => {
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
      fetch(`${origin}/_sla_article_descriptor_requests`, { method: "DELETE" }),
      fetch(`${origin}/_sla_article_source_requests`, { method: "DELETE" })
    ])
  })

  test("freezes the exact closed registry and every first-party source byte", () => {
    expect(SLA_ARTICLE_REGISTRY).toEqual(slaArticleFixtures.map(article => ({
      articleId: article.articleId,
      sourcePath: article.sourcePath
    })))
    expect(SLA_ARTICLE_REGISTRY).toHaveLength(23)
    expect(new Set(SLA_ARTICLE_REGISTRY.map(article => article.articleId))).toHaveProperty(
      "size",
      23
    )
    expect(generatedTypeSentinel).toBeNull()
    expect(registryCompletenessSentinel).toBeNull()
    expect(Object.entries(SLA_ARTICLE_REGISTRY_BY_ID)).toEqual(
      slaArticleFixtures.map(article => [article.articleId, {
        sourcePath: article.sourcePath
      }])
    )
    expect(slaArticleFixtures.slice(0, 18).reduce((total, article) => total + article.bytes, 0))
      .toBe(608_574)
    expect(slaArticleFixtures.reduce((total, article) => total + article.bytes, 0))
      .toBe(666_098)

    for (const article of slaArticleFixtures) {
      const body = readFileSync(new URL(`../fixtures/sla-article-content/${article.file}`, import.meta.url))
      expect(body, article.articleId).toHaveLength(article.bytes)
      expect(createHash("sha256").update(body).digest("hex"), article.articleId)
        .toBe(article.sha256)
      expect(article.mediaType).toBe("text/html; charset=utf-8")
      expect(article.sourceUrl).toBe(`https://red.litteraturbanken.se${article.sourcePath}`)

      const { document } = parseHTML(body.toString("utf8"))
      expect(document.querySelectorAll("body"), article.articleId).toHaveLength(1)
      expect(document.querySelector("title")?.textContent?.trim(), article.articleId)
        .toBe(article.title)
      const hrefs = [...document.querySelectorAll("a[href]")]
        .map(anchor => anchor.getAttribute("href"))
      expect(hrefs, article.articleId).toHaveLength(article.linkCount)
      expect(createHash("sha256").update(JSON.stringify(hrefs)).digest("hex"), article.articleId)
        .toBe(article.linkSha256)
    }
  })

  test("keeps every public SLA article cross-link inside the exact registry", () => {
    const registered = new Set(SLA_ARTICLE_REGISTRY.map(article => article.articleId))
    for (const article of slaArticleFixtures) {
      const body = readFileSync(new URL(`../fixtures/sla-article-content/${article.file}`, import.meta.url))
      const { document } = parseHTML(body.toString("utf8"))
      const hrefs = [...document.querySelectorAll("a[href]")]
        .map(anchor => anchor.getAttribute("href"))
        .filter((href): href is string => href !== null)
      for (const href of hrefs) {
        const match
          = /^\/(?:författare\/LagerlöfS|forfattare\/LagerlofS)\/omtexterna\/([^?#]+\.html)(?:[?#].*)?$/u
            .exec(href)
        if (match) expect(registered.has(match[1]!), `${article.articleId}: ${href}`).toBe(true)
      }
    }
  })

  test("serves every fixed descriptor and source through independent exact ledgers", async () => {
    for (const article of slaArticleFixtures) {
      const descriptorPath = `/v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${article.articleId}`
      const descriptorResponse = await fetch(`${origin}${descriptorPath}`)
      expect(descriptorResponse.status, descriptorPath).toBe(200)
      expect(await descriptorResponse.json(), descriptorPath)
        .toEqual(slaArticleDescriptors[article.articleId])

      const sourceResponse = await fetch(`${origin}${article.sourcePath}`)
      expect(sourceResponse.status, article.sourcePath).toBe(200)
      expect(sourceResponse.headers.get("content-type"), article.sourcePath)
        .toBe(article.mediaType)
      const source = Buffer.from(await sourceResponse.arrayBuffer())
      expect(source, article.sourcePath).toHaveLength(article.bytes)
      expect(createHash("sha256").update(source).digest("hex"), article.sourcePath)
        .toBe(article.sha256)
    }

    expect(await ledger("/_sla_article_descriptor_requests")).toEqual({
      requests: slaArticleFixtures.map(article => ({
        method: "GET",
        path: `/v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${article.articleId}`
      }))
    })
    expect(await ledger("/_sla_article_source_requests")).toEqual({
      requests: slaArticleFixtures.map(article => ({
        method: "GET",
        path: article.sourcePath
      }))
    })
  })

  test("rejects wildcard, variant, query, traversal, and non-GET probes without ledger entries", async () => {
    const exactDescriptor = "/v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/Introduktion.html"
    const exactSource = "/red/sla/Introduktion.html"
    for (const [path, method] of [
      ["/v2/authors/S%C3%B6derbergH/documents/omtexterna/articles/Introduktion.html", "GET"],
      ["/v2/authors/LagerlofS/documents/omtexterna/articles/Introduktion.html", "GET"],
      [`${exactDescriptor}?authority=exact`, "GET"],
      [exactDescriptor, "POST"],
      [exactDescriptor.replace("Introduktion.html", "introduktion.html"), "GET"],
      [exactDescriptor.replace("Introduktion.html", "Introduktion.HTML"), "GET"],
      [exactDescriptor.replace("Introduktion.html", "*.html"), "GET"],
      [exactDescriptor.replace("Introduktion.html", "%252e%252e%252fIntroduktion.html"), "GET"],
      [`${exactSource}?authority=exact`, "GET"],
      [exactSource, "POST"],
      ["/red/sla/introduktion.html", "GET"],
      ["/red/sla/NotRegistered.html", "GET"],
      ["/red/sla/%252e%252e/Introduktion.html", "GET"]
    ] as const) {
      expect(await rawStatus(path, method), `${method} ${path}`).toBe(404)
    }
    expect(await ledger("/_sla_article_descriptor_requests"))
      .toEqual({ requests: [] })
    expect(await ledger("/_sla_article_source_requests"))
      .toEqual({ requests: [] })
  })

  test("resets descriptor and source ledgers independently", async () => {
    const article = slaArticleFixtures[0]!
    await fetch(`${origin}/v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${article.articleId}`)
    await fetch(`${origin}${article.sourcePath}`)

    await fetch(`${origin}/_sla_article_descriptor_requests`, { method: "DELETE" })
    expect(await ledger("/_sla_article_descriptor_requests")).toEqual({ requests: [] })
    expect((await ledger("/_sla_article_source_requests")).requests).toHaveLength(1)

    await fetch(`${origin}/_sla_article_source_requests`, { method: "DELETE" })
    expect(await ledger("/_sla_article_source_requests")).toEqual({ requests: [] })
  })
})
