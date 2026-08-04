import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

const verifier = resolve(import.meta.dirname, "../../scripts/verify-architecture-policy.mjs")
const vueHtmlDirective = ["v", "html"].join("-")
const lintDisable = ["eslint", "disable"].join("-")
const lintEnable = ["eslint", "enable"].join("-")
const lintEnvironment = ["eslint", "env"].join("-")
const lintInline = ["eslint"].join("")
const lintGlobal = ["glob", "al"].join("")
const lintExported = ["export", "ed"].join("")
const tsIgnore = ["@ts", "ignore"].join("-")
const tsExpectError = ["@ts", "expect-error"].join("-")
const domHtmlProperty = ["inner", "HTML"].join("")
const castKeyword = ["a", "s"].join("")
const sanitizedHtmlType = ["Sanitized", "Html"].join("")
const managedAssetHtmlType = ["Managed", "Asset", "Html"].join("")
const managedStyleTextType = ["Managed", "Style", "Text"].join("")
const managedStylesheetHrefType = ["Managed", "Stylesheet", "Href"].join("")
const renderableCapabilityType = ["Renderable", "Capability"].join("")
const renderableHtmlType = ["Renderable", "Html"].join("")
const temporaryTrees: string[] = []

const expectedIgnores = [
  ".nuxt/**",
  ".output/**",
  "node_modules/**",
  "app/lib/api/generated/**",
  "coverage/**",
  "playwright-report/**",
  "test-results*/**"
]

const canonicalEslintConfig = `import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  ignores: [
    ".nuxt/**",
    ".output/**",
    "node_modules/**",
    "app/lib/api/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results*/**"
  ]
})
`

const detachedDomAllowlist = [
  "app/lib/author-profile.ts",
  "app/lib/reader-dictionary.ts",
  "app/lib/search-hit-highlight.ts",
  "app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue",
  "app/pages/presentationer/presentation-parser.ts",
  "server/utils/author-document.ts",
  "server/utils/dramawebben-document.ts",
  "server/utils/editor-reader-html.ts",
  "server/utils/reader-source-info-projection.ts",
  "server/utils/reader-source-info-sanitizer.ts",
  "server/utils/sla-article.ts"
]

const reviewedDomSources: Readonly<Record<string, string>> = {
  "app/components/global/RenderableHtmlContent.vue": [
    "<script lang=\"ts\">",
    "export default defineComponent((props, { attrs }) => () => {",
    "  const forwardedAttrs = Object.fromEntries(",
    "    Object.entries(attrs).filter(([name]) => name !== \"innerHTML\" && name !== \"textContent\")",
    "  )",
    "  return h(props.as, {",
    "    ...forwardedAttrs,",
    `    ${domHtmlProperty}: props.html`,
    "  })",
    "})",
    "</script>"
  ].join("\n"),
  "app/lib/author-profile.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueAuthorProfileHtml } from \"#shared/utils/renderable-html\"",
    "export function sanitizeAuthorHtml(value: string) {",
    "  const { document } = parseHTML(\"<!doctype html><html><body></body></html>\")",
    "  const container = document.createElement(\"div\")",
    `  container.${domHtmlProperty} = value`,
    `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "app/lib/reader-dictionary.ts": [
    "import { parseHTML } from \"linkedom\"",
    "export function sanitizeDictionaryArticle(markup: string) {",
    "  const { document } = parseHTML(`<div data-dictionary-root>${markup}</div>`)",
    "  const root = document.querySelector(\"[data-dictionary-root]\")!",
    `  const html = root.${domHtmlProperty}`,
    "  return issueDictionaryArticleHtml(html)",
    "}"
  ].join("\n"),
  "app/lib/search-hit-highlight.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueReaderOcrHtml } from \"#shared/utils/renderable-html\"",
    "function markSimpleContiguousWords(html: string) {",
    "  const { document } = parseHTML(`<div data-editor-highlight-root>${html}</div>`)",
    "  const root = document.querySelector(\"[data-editor-highlight-root]\")!",
    `  return root.${domHtmlProperty}`,
    "}",
    "export function markReaderSearchOcrHtml(html: string) {",
    "  const { document } = parseHTML(`<div data-reader-highlight-root>${html}</div>`)",
    "  const root = document.querySelector(\"[data-reader-highlight-root]\")!",
    `  return issueReaderOcrHtml(root.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue": [
    "<script setup lang=\"ts\">",
    "import { parseHTML } from \"linkedom\"",
    "function markReaderHtml(source: string) {",
    "  return transformManagedReaderHtml(source, value => {",
    "    const { document } = parseHTML(`<div data-reader-highlight-root>${value}</div>`)",
    "    const root = document.querySelector(\"[data-reader-highlight-root]\")!",
    `    return root.${domHtmlProperty}`,
    "  })",
    "}",
    "</script>"
  ].join("\n"),
  "app/pages/presentationer/presentation-parser.ts": [
    "import { DOMParser } from \"linkedom\"",
    "import { issueManagedPresentationHtml } from \"#shared/utils/renderable-html\"",
    "export function parsePresentationDocument(source: string) {",
    "  const document = new DOMParser().parseFromString(source, \"text/html\") as unknown as ParsedDocument",
    "  const body = document.querySelector(\"body\")!",
    `  return issueManagedPresentationHtml(body.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "server/utils/author-document.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueAuthorDocumentHtml } from \"#shared/utils/renderable-html\"",
    "export function parseAuthorDocumentBody(source: string) {",
    "  let document: ParsedAuthorDocument",
    "  ({ document } = parseHTML(source) as unknown as { document: ParsedAuthorDocument })",
    "  const bodies = [...document.querySelectorAll(\"body\")]",
    "  const body = bodies[0]!",
    `  return issueAuthorDocumentHtml(body.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "server/utils/dramawebben-document.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueDramawebbenDocumentHtml } from \"#shared/utils/renderable-html\"",
    "export function parseDramawebbenDocumentBody(source: string) {",
    "  let document: ParsedDramawebbenDocument",
    "  ({ document } = parseHTML(source) as unknown as { document: ParsedDramawebbenDocument })",
    "  const bodies = [...document.querySelectorAll(\"body\")]",
    "  const body = bodies[0]!",
    `  return issueDramawebbenDocumentHtml(body.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "server/utils/editor-reader-html.ts": [
    "import { parseHTML } from \"linkedom\"",
    "export function sanitizeEditorEtextHtml(source: string) {",
    "  const { document } = parseHTML(source)",
    `  const html = document.body.${domHtmlProperty}`,
    "  return issueEditorEtextHtml(html)",
    "}"
  ].join("\n"),
  "server/utils/reader-source-info-sanitizer.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueReaderSourceInfoHtml } from \"#shared/utils/renderable-html\"",
    "export function sanitizeReaderSourceInfoHtml(source: string) {",
    "  let document: ParsedDocument",
    "  ({ document } = parseHTML(source) as unknown as { document: ParsedDocument })",
    "  const bodies = [...document.querySelectorAll(\"body\")]",
    "  const body = bodies[0]!",
    `  return issueReaderSourceInfoHtml(body.${domHtmlProperty})`,
    "}"
  ].join("\n"),
  "server/utils/reader-source-info-projection.ts": [
    "import { parseHTML } from \"linkedom\"",
    "function unwrapLicenseText(source: string) {",
    "  let document: ParsedDocument",
    "  ({ document } = parseHTML(source) as unknown as { document: ParsedDocument })",
    "  const texts = [...document.querySelectorAll(\"text\")]",
    `  return texts[0]!.${domHtmlProperty}`,
    "}"
  ].join("\n"),
  "server/utils/sla-article.ts": [
    "import { parseHTML } from \"linkedom\"",
    "import { issueSlaArticleHtml } from \"#shared/utils/renderable-html\"",
    "export function parseSlaArticleBody(source: string) {",
    "  let document: ParsedSlaArticle",
    "  ({ document } = parseHTML(source) as unknown as { document: ParsedSlaArticle })",
    "  const bodies = [...document.querySelectorAll(\"body\")]",
    "  const body = bodies[0]!",
    `  return issueSlaArticleHtml(body.${domHtmlProperty})`,
    "}"
  ].join("\n")
}

function reviewedCapabilityModule(): string {
  return [
    `import type { ${managedAssetHtmlType}, ${managedStyleTextType}, ${managedStylesheetHrefType}, ${renderableCapabilityType}, ${renderableHtmlType}, ${sanitizedHtmlType} } from "../types/renderable-html"`,
    `function capability<T extends ${renderableCapabilityType}>(value: string): T {`,
    `  return value ${castKeyword} T`,
    "}",
    `export function issueAuthorProfileHtml(value: string): ${sanitizedHtmlType}<"author-profile"> { return capability<${sanitizedHtmlType}<"author-profile">>(value) }`,
    `export function issueAuthorDocumentHtml(value: string): ${sanitizedHtmlType}<"author-document"> { return capability<${sanitizedHtmlType}<"author-document">>(value) }`,
    `export function issueDramawebbenDocumentHtml(value: string): ${sanitizedHtmlType}<"dramawebben-document"> { return capability<${sanitizedHtmlType}<"dramawebben-document">>(value) }`,
    `export function issueSlaArticleHtml(value: string): ${sanitizedHtmlType}<"sla-article"> { return capability<${sanitizedHtmlType}<"sla-article">>(value) }`,
    `export function issueDictionaryArticleHtml(value: string): ${sanitizedHtmlType}<"dictionary-article"> { return capability<${sanitizedHtmlType}<"dictionary-article">>(value) }`,
    `export function issueReaderOcrHtml(value: string): ${sanitizedHtmlType}<"reader-ocr"> { return capability<${sanitizedHtmlType}<"reader-ocr">>(value) }`,
    `export function issueReaderSourceInfoHtml(value: string): ${sanitizedHtmlType}<"reader-source-info"> { return capability<${sanitizedHtmlType}<"reader-source-info">>(value) }`,
    `export function issueEditorEtextHtml(value: string): ${sanitizedHtmlType}<"editor-etext"> { return capability<${sanitizedHtmlType}<"editor-etext">>(value) }`,
    `export function issueManagedReaderHtml(value: string): ${managedAssetHtmlType}<"reader-etext"> { return capability<${managedAssetHtmlType}<"reader-etext">>(value) }`,
    `export function issueManagedHomeHtml(value: string): ${managedAssetHtmlType}<"home-editorial"> { return capability<${managedAssetHtmlType}<"home-editorial">>(value) }`,
    `export function issueManagedAboutHtml(value: string): ${managedAssetHtmlType}<"about-editorial"> { return capability<${managedAssetHtmlType}<"about-editorial">>(value) }`,
    `export function issueManagedPresentationHtml(value: string): ${managedAssetHtmlType}<"presentation-editorial"> { return capability<${managedAssetHtmlType}<"presentation-editorial">>(value) }`,
    `export function issueManagedPresentationStyle(value: string): ${managedStyleTextType}<"presentation-editorial"> { return capability<${managedStyleTextType}<"presentation-editorial">>(value) }`,
    `export function issueManagedPresentationStylesheetHref(value: string): ${managedStylesheetHrefType}<"presentation-editorial"> { return capability<${managedStylesheetHrefType}<"presentation-editorial">>(value) }`,
    `export function emptyRenderableHtml<Value extends ${renderableHtmlType}>(): Value { return capability<Value>("") }`,
    `export function joinReaderSourceRows(values: readonly ${sanitizedHtmlType}<"reader-source-info">[]): ${sanitizedHtmlType}<"reader-source-info"> { return capability<${sanitizedHtmlType}<"reader-source-info">>(values.join("<br>")) }`,
    `export function transformManagedReaderHtml(value: ${managedAssetHtmlType}<"reader-etext">, transform: (value: string) => string): ${managedAssetHtmlType}<"reader-etext"> { return capability<${managedAssetHtmlType}<"reader-etext">>(transform(value)) }`
  ].join("\n")
}

function writeSource(root: string, relativePath: string, source: string): void {
  const absolutePath = resolve(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, source)
}

function eslintConfig(ignores: readonly string[] = expectedIgnores, extra = ""): string {
  if (ignores === expectedIgnores && extra === "") return canonicalEslintConfig
  return `import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  ignores: ${JSON.stringify(ignores)},
  ${extra}
})
`
}

function createTree(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-architecture-policy-"))
  temporaryTrees.push(root)
  writeSource(root, "eslint.config.mjs", eslintConfig())
  writeSource(
    root,
    "shared/utils/renderable-html.ts",
    reviewedCapabilityModule()
  )
  writeSource(root, "shared/types/policy-dtos.ts", [
    `interface ReaderOcrOverlay { html: ${sanitizedHtmlType}<"reader-ocr">; width: number }`,
    `interface ReaderEtextPage { html: ${managedAssetHtmlType}<"reader-etext">; mediaType: "etext" }`,
    `interface EditorReaderPage { html: ${sanitizedHtmlType}<"editor-etext"> | null; workId: string }`,
    `interface AuthorProfileView { introductionHtml: ${sanitizedHtmlType}<"author-profile">; authorId: string }`,
    `interface PresentationDocument { bodyHtml: ${managedAssetHtmlType}<"presentation-editorial">; title: string }`,
    `interface ReaderSourceInfoErrataRow { cellsHtml: ${sanitizedHtmlType}<"reader-source-info">[] }`,
    `interface ReaderSourceInfoDramawebben { historyHtml: ${sanitizedHtmlType}<"reader-source-info"> | null }`,
    `interface AuthorSupplementalPage { bodyHtml: ${sanitizedHtmlType}<"author-document">; documentKind: string }`,
    `interface DramawebbenManagedDocument { bodyHtml: ${sanitizedHtmlType}<"dramawebben-document">; documentKind: string }`,
    `interface SlaArticlePage { bodyHtml: ${sanitizedHtmlType}<"sla-article">; articleId: string }`
  ].join("\n"))
  for (const [path, source] of Object.entries(reviewedDomSources)) {
    writeSource(root, path, source)
  }
  for (const contract of [
    "author-works-contract.ts",
    "reader-source-info-contract.ts",
    "renderable-html-contract.ts"
  ]) {
    writeSource(
      root,
      `test/nuxt/${contract}`,
      `// ${tsExpectError} Deliberately rejects an invalid contract fixture.\nconst invalid: never = "bad"\n`
    )
  }
  return root
}

function runVerifier(root: string, timeout?: number): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout
  })
}

afterEach(() => {
  for (const root of temporaryTrees.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("architecture policy verifier", () => {
  test("accepts every reviewed renderer, detached DOM, contract, and ignored-path boundary", () => {
    const root = createTree()
    for (const directory of [
      ".nuxt",
      ".output",
      "node_modules",
      "app/lib/api/generated",
      "coverage",
      "playwright-report",
      "test-results-policy"
    ]) {
      writeSource(root, `${directory}/ignored.vue`, `<div ${vueHtmlDirective}="unsafe" />`)
    }

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toMatch(/^Architecture policy passed: audited \d+ files\.\n$/u)
  })

  test("accepts the exact imported HTML document helper as detached provenance", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!
        .replace(
          'import { parseHTML } from "linkedom"',
          'import { parseHtmlDocument } from "./html-document"'
        )
        .replace(
          'const { document } = parseHTML("<!doctype html><html><body></body></html>")',
          'const document = parseHtmlDocument("<!doctype html><html><body></body></html>")'
        )
    )
    writeSource(
      root,
      "app/lib/html-document.ts",
      [
        "export function parseHtmlDocument(markup: string): Document {",
        '  return new DOMParser().parseFromString(markup, "text/html")',
        "}"
      ].join("\n")
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("accepts reordered capability issuer declarations", () => {
    const root = createTree()
    const [importLine, ...bodyLines] = reviewedCapabilityModule().split("\n")
    const capabilityLines = bodyLines.slice(0, 3)
    const issuerLines = bodyLines.slice(3).reverse()
    writeSource(
      root,
      "shared/utils/renderable-html.ts",
      [importLine, ...capabilityLines, ...issuerLines].join("\n")
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("accepts unrelated strict ESLint rules in scalar and option-array forms", () => {
    const root = createTree()
    writeSource(
      root,
      "eslint.config.mjs",
      eslintConfig(
        expectedIgnores,
        'rules: { eqeqeq: "error", curly: 2, quotes: ["error", "double"], semi: [2, "always"] }'
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    ["off severity", 'rules: { "vue/no-v-html": "off" }'],
    ["warn severity", 'rules: { eqeqeq: "warn" }'],
    ["off option-array severity", 'rules: { quotes: [0, "double"] }'],
    ["warn option-array severity", 'rules: { semi: [1, "always"] }']
  ])("rejects an ESLint rule with %s", (_description, rules) => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", eslintConfig(expectedIgnores, rules))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "eslint.config.mjs:1: ESLint configuration must equal the canonical reviewed file"
    )
  })

  test.each([
    ["files", 'files: ["app/**/*.ts"]'],
    ["languageOptions", 'languageOptions: { globals: { unsafe: "readonly" } }'],
    ["arbitrary property", 'name: "scope-altering-config"']
  ])("rejects the scope-altering ESLint config property %s", (_description, property) => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", eslintConfig(expectedIgnores, property))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "eslint.config.mjs:1: ESLint configuration must equal the canonical reviewed file"
    )
  })

  test("accepts the Nuxt alias for the exact HTML document helper", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!
        .replace(
          'import { parseHTML } from "linkedom"',
          'import { parseHtmlDocument } from "~/lib/html-document"'
        )
        .replace(
          'const { document } = parseHTML("<!doctype html><html><body></body></html>")',
          'const document = parseHtmlDocument("<!doctype html><html><body></body></html>")'
        )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("rejects an identically named HTML document helper from another module", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!
        .replace(
          'import { parseHTML } from "linkedom"',
          'import { parseHtmlDocument } from "./unsafe-html-document"'
        )
        .replace(
          'const { document } = parseHTML("<!doctype html><html><body></body></html>")',
          'const document = parseHtmlDocument("<!doctype html><html><body></body></html>")'
        )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test("accepts the unshadowed platform DOMParser as detached provenance", () => {
    const root = createTree()
    const path = "app/pages/presentationer/presentation-parser.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace('import { DOMParser } from "linkedom"\n', "")
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("rejects a local DOMParser shadow at a reviewed detached-DOM boundary", () => {
    const root = createTree()
    const path = "app/pages/presentationer/presentation-parser.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!
        .replace('import { DOMParser } from "linkedom"\n', "")
        .replace(
          "export function parsePresentationDocument(source: string) {",
          [
            "export function parsePresentationDocument(source: string) {",
            "  const DOMParser = class {",
            "    parseFromString() { return globalThis.document }",
            "  }"
          ].join("\n")
        )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test.each([
    ["app/lib/unsafe.ts", 'fetch("/api/get_work_info")'],
    ["server/utils/unsafe.ts", 'fetch("/get_work_info")'],
    ["shared/unsafe.ts", 'fetch("/count_pages/lb1/etext")']
  ])("rejects legacy Reader metadata ownership in %s", (path, source) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "legacy Reader/Editor metadata endpoints are forbidden"
    )
  })

  test.each([
    [
      "app/lib/template-bypass.ts",
      "const id = getId()\nfetch(`/count_pages/${id}/etext`)"
    ],
    [
      "server/utils/concatenation-bypass.ts",
      'fetch(("/api/" + "get_") + ("work" + "_info"))'
    ]
  ])("rejects statically recoverable legacy endpoint bypass in %s", (path, source) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "legacy Reader/Editor metadata endpoints are forbidden"
    )
  })

  test.each([
    [
      "app/lib/template-identifier-bypass.ts",
      [
        'const prefix = "/api"',
        'const operation = "get_work_info"',
        'fetch(`${prefix}/${operation}`)'
      ].join("\n")
    ],
    [
      "server/utils/concatenated-identifier-bypass.ts",
      [
        'const root = ("/api")',
        'const prefix = (root)',
        'const stem = ("get_")',
        'const operation = (stem + "work_info")',
        'fetch((prefix + "/") + operation)'
      ].join("\n")
    ]
  ])("rejects const-resolvable legacy endpoint bypass in %s", (path, source) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "legacy Reader/Editor metadata endpoints are forbidden"
    )
  })

  test("resolves a const alias at its lexical declaration site", () => {
    const root = createTree()
    writeSource(
      root,
      "app/lib/lexical-shadow-bypass.ts",
      'const operation="get_"; const alias=operation; { const operation=getOperation(); fetch(`/api/${alias}work_info`) }'
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "legacy Reader/Editor metadata endpoints are forbidden"
    )
  })

  test("does not treat a reassigned mutable binding as constant", () => {
    const root = createTree()
    writeSource(
      root,
      "server/utils/mutable-operation.ts",
      'let operation="get_"; operation=getOperation(); fetch(`/api/${operation}work_info`)'
    )

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    ["href", '<a href="/count_pages/lb1/etext">Read</a>'],
    ["action", '<form action="/api/get_work_info"></form>'],
    ["ordinary attribute", '<div data-endpoint="/get_work_info"></div>']
  ])("rejects a legacy endpoint in a static Vue %s", (_kind, element) => {
    const root = createTree()
    writeSource(root, "app/pages/static-endpoint.vue", [
      "<template>",
      `  ${element}`,
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe(
      "app/pages/static-endpoint.vue:2: legacy Reader/Editor metadata endpoints are forbidden\n"
    )
  })

  test("accepts harmless static Vue attributes", () => {
    const root = createTree()
    writeSource(root, "app/pages/static-safe.vue", [
      "<template>",
      '  <a href="/api/v2/works/lb1" class="count_pages" data-operation="get_work_info">Read</a>',
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("reports one Vue source violation across static, directive, and script literals", () => {
    const root = createTree()
    writeSource(root, "app/pages/static-and-directive.vue", [
      "<script setup>",
      'const endpoint = "/get_work_info"',
      "</script>",
      "<template>",
      '  <a href="/count_pages/lb1/etext" :data-endpoint="\'/api/get_work_info\'">Read</a>',
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe(
      "app/pages/static-and-directive.vue:2: legacy Reader/Editor metadata endpoints are forbidden\n"
    )
  })

  test("does not combine static fragments across dynamic endpoint expressions", () => {
    const root = createTree()
    writeSource(root, "shared/safe-dynamic.ts", [
      'const suffix = getSuffix()',
      'const dynamicConcatenation = "/api/get_" + suffix',
      'const dynamicTemplate = `/count_${suffix}pages/`',
      'const incompleteLiteral = "/count_pages"',
      'void [dynamicConcatenation, dynamicTemplate, incompleteLiteral]'
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("reports one deterministic sorted legacy-endpoint violation per source", () => {
    const root = createTree()
    writeSource(
      root,
      "shared/z-last.ts",
      [
        'const prefix = "safe"',
        'fetch(prefix)',
        'fetch("/get_" + "work_info")',
        'const api = "/api"',
        'const operation = "get_work_info"',
        'fetch(`${api}/${operation}`)'
      ].join("\n")
    )
    writeSource(
      root,
      "app/a-first.ts",
      'const id = getId()\nfetch(`/count_pages/${id}/etext`)'
    )
    writeSource(root, "server/middle.ts", 'fetch("/api/get_work_info")')

    const first = runVerifier(root)
    const second = runVerifier(root)
    const expected = [
      "app/a-first.ts:2: legacy Reader/Editor metadata endpoints are forbidden",
      "server/middle.ts:1: legacy Reader/Editor metadata endpoints are forbidden",
      "shared/z-last.ts:3: legacy Reader/Editor metadata endpoints are forbidden"
    ].join("\n") + "\n"

    expect(first.status).toBe(1)
    expect(first.stderr).toBe(expected)
    expect(second.status).toBe(1)
    expect(second.stderr).toBe(expected)
  })

  test("keeps generated, fixture, test, and Angular capture sources outside the legacy endpoint scan", () => {
    const root = createTree()
    for (const path of [
      "app/lib/api/generated/unsafe.ts",
      "test/fixtures/v2-server.mjs",
      "test/unit/legacy-endpoint.spec.ts",
      "test/visual/capture-editor-angular.spec.ts"
    ]) {
      writeSource(root, path, 'fetch("/api/get_work_info")')
    }

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    ["Vue raw HTML directive", "app/pages/unsafe.vue", `<div ${vueHtmlDirective}="source" />`, "Vue raw-HTML directives are forbidden"],
    ["Vue raw HTML modifier", "app/pages/unsafe.vue", `<div ${vueHtmlDirective}.foo="source" />`, "Vue raw-HTML directives are forbidden"],
    ["Vue raw HTML argument", "app/pages/unsafe.vue", `<div ${vueHtmlDirective}:foo="source" />`, "Vue raw-HTML directives are forbidden"],
    ["ESLint suppression", "app/pages/unsafe.ts", `// ${lintDisable}-next-line\nunsafe()`, "ESLint inline configuration comments are forbidden"],
    ["TypeScript ignore", "test/unit/unsafe.spec.ts", `// ${tsIgnore}\nunsafe()`, "TypeScript ignore comments are forbidden"],
    ["undescribed expected error", "test/nuxt/renderable-html-contract.ts", `// ${tsExpectError}\nconst value: never = 1`, "expected-error directives require a description"],
    ["expected error outside a contract", "test/unit/unsafe.spec.ts", `// ${tsExpectError} Invalid value must fail.\nconst value: never = 1`, "expected-error directives are limited to compile contracts"],
    ["live DOM serialization", "app/pages/unsafe.ts", `element.${domHtmlProperty} = source`, "DOM HTML access is not in the reviewed allowlist"],
    ["detached DOM serialization", "server/utils/unreviewed-sanitizer.ts", `const value = root.${domHtmlProperty}`, "DOM HTML access is not in the reviewed allowlist"],
    ["capability assertion", "app/lib/unsafe.ts", `const reviewed = value ${castKeyword} ${sanitizedHtmlType}<"author-profile">`, "capability assertions are limited to the private capability helper"],
    ["angle capability assertion", "app/lib/unsafe.ts", `const reviewed = <${sanitizedHtmlType}<"author-profile">>value`, "capability assertions are limited to the private capability helper"],
    ["parenthesized capability assertion", "app/lib/unsafe.ts", `const reviewed = value ${castKeyword} (${sanitizedHtmlType}<"author-profile">)`, "capability assertions are limited to the private capability helper"],
    ["intersection capability assertion", "app/lib/unsafe.ts", `const reviewed = value ${castKeyword} ${sanitizedHtmlType}<"author-profile"> & Readonly<{}>`, "capability assertions are limited to the private capability helper"],
    ["readonly capability assertion", "app/lib/unsafe.ts", `const reviewed = value ${castKeyword} Readonly<${sanitizedHtmlType}<"author-profile">>`, "capability assertions are limited to the private capability helper"],
    ["import-query capability assertion", "test/unit/unsafe.spec.ts", `const reviewed = value ${castKeyword} import("../../shared/types/renderable-html").${sanitizedHtmlType}<"author-profile">`, "capability assertions are limited to the private capability helper"],
    ["aliased capability assertion", "app/lib/unsafe.ts", `import type { ${sanitizedHtmlType} ${castKeyword} Reviewed } from "../../shared/types/renderable-html"\nconst reviewed = value ${castKeyword} Reviewed`, "capability assertions are limited to the private capability helper", 2],
    ["namespace capability assertion", "app/lib/unsafe.ts", `import type * ${castKeyword} Html from "../../shared/types/renderable-html"\nconst reviewed = value ${castKeyword} Html.${sanitizedHtmlType}<"author-profile">`, "capability assertions are limited to the private capability helper", 2],
    ["transitively aliased capability assertion", "app/lib/unsafe.ts", `type Reviewed = Readonly<${sanitizedHtmlType}<"author-profile">>\ntype AlsoReviewed = Reviewed & {}\nconst reviewed = value ${castKeyword} AlsoReviewed`, "capability assertions are limited to the private capability helper", 3],
    ["generic arrow capability assertion", "app/lib/unsafe.ts", `const brand = <T>(value: string): T => value ${castKeyword} T\nconst reviewed = brand<${sanitizedHtmlType}<"author-profile">>(value)`, "capability assertions are limited to the private capability helper"],
    ["generic exported brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport function brand<T>(value: string): T { return value ${castKeyword} T }`, "capability utility must equal the reviewed structural surface"],
    ["generic exported named-policy brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport function brand<T extends ${sanitizedHtmlType}<"author-profile">>(value: string): T { return capability<T>(value) }`, "capability utility must equal the reviewed structural surface"],
    ["generic exported arrow brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport const brand = <T>(value: string): T => value ${castKeyword} T`, "capability utility must equal the reviewed structural surface"],
    ["exported private capability helper", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport { capability }`, "capability utility must equal the reviewed structural surface"],
    ["exported private capability alias", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport const brand = capability`, "capability utility must equal the reviewed structural surface"],
    ["default-exported private capability", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport default capability`, "capability utility must equal the reviewed structural surface"],
    ["private capability alias", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nconst brand = capability`, "capability utility must equal the reviewed structural surface"],
    ["second private assertion", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nconst forged = value ${castKeyword} T`, "capability utility must equal the reviewed structural surface"]
  ])("rejects %s", (_name, path, source, expectedMessage, expectedLine = 1) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:${expectedLine}: ${expectedMessage}`)
  })

  test.each(detachedDomAllowlist.flatMap(path => [
    [path, `document.body.${domHtmlProperty} = unsafe`],
    [path, `window.document.documentElement.${domHtmlProperty} = unsafe`]
  ]))("rejects an extra live DOM sink in reviewed detached context %s", (path, liveSink) => {
    const root = createTree()
    const source = path.endsWith(".vue")
      ? reviewedDomSources[path]!.replace("\n</script>", `\n${liveSink}\n</script>`)
      : `${reviewedDomSources[path]}\n${liveSink}`
    writeSource(root, path, source)

    const result = runVerifier(root)
    const liveSinkLine = path.endsWith(".vue")
      ? reviewedDomSources[path]!.split("\n").length
      : reviewedDomSources[path]!.split("\n").length + 1

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:${liveSinkLine}: DOM HTML access does not match the reviewed signature`)
  })

  test("rejects an extra live DOM sink beside the sole renderer setter", () => {
    const root = createTree()
    const path = "app/components/global/RenderableHtmlContent.vue"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        "\n</script>",
        `\ndocument.body.${domHtmlProperty} = unsafe\n</script>`
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:11: DOM HTML access does not match the reviewed signature`)
  })

  test("rejects duplicated reviewed DOM operations by cardinality", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
        `  container.${domHtmlProperty} = value\n  return issueAuthorProfileHtml(container.${domHtmlProperty})`
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed DOM HTML signature cardinality changed`)
  })

  test("rejects a live document body substituted for the reviewed detached author container", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        "const container = document.createElement(\"div\")",
        "const container = globalThis.document.body"
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test("comments cannot satisfy reviewed provenance or DOM operations beside a computed live sink", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, [
      "const { document } = parseHTML(\"<!doctype html><html><body></body></html>\")",
      "const container = globalThis.document.body",
      "// const container = document.createElement(\"div\")",
      `// container.${domHtmlProperty} = value`,
      `// issueAuthorProfileHtml(container.${domHtmlProperty})`,
      "document.body[\"inner\" + \"HTML\"] = value"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
    expect(result.stderr).toContain(`${path}:6: computed DOM HTML access is forbidden`)
  })

  test("rejects a computed live setter beside the sole renderer setter", () => {
    const root = createTree()
    const path = "app/components/global/RenderableHtmlContent.vue"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        "\n</script>",
        "\ndocument.body[\"inner\" + \"HTML\"] = unsafe\n</script>"
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:11: computed DOM HTML access is forbidden`)
  })

  test.each([
    `<div ${vueHtmlDirective}:[foo]="source" />`,
    `<div ${vueHtmlDirective}.bar="source" />`,
    `<div ${vueHtmlDirective}:[foo].bar="source" />`
  ])("rejects every static and dynamic raw-HTML directive variant %s", source => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/pages/unsafe.vue:1: Vue raw-HTML directives are forbidden")
  })

  test("rejects dynamic Vue argument bindings at the strict renderable-content boundary", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<script setup>",
      "const key = \"inner\" + \"HTML\"",
      "</script>",
      "<template>",
      "  <div :[key]=\"source\" />",
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/pages/unsafe.vue:5: dynamic Vue argument bindings are forbidden")
    expect(result.stderr).toContain("app/pages/unsafe.vue:2: computed DOM HTML access is forbidden")
  })

  test("rejects a computed DOM HTML key before its dynamic setter", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "const key = \"inner\" + \"HTML\"",
      "document.body[key] = unsafe"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/lib/unsafe.ts:1: computed DOM HTML access is forbidden")
  })

  test("does not let regular-expression punctuation hide a later DOM sink", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "const punctuation = /[!'()*]/gu",
      `document.body.${domHtmlProperty} = unsafe`
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:2: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test.each([
    ["await regex", "const matched = await /[!']+/u.test(value)"],
    ["unary-plus regex", "const numeric = +/[!']+/u.test(value)"],
    ["for-of regex", "for (const matcher of [/[!']+/u]) matcher.test(value)"],
    ["template interpolation", "const rendered = `${document.body.innerHTML}`"]
  ])("parses the executable body after %s", (_name, prefix) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      prefix,
      `document.body.${domHtmlProperty} = unsafe`
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:2: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test("audits executable expressions inside Vue template interpolation", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<template>",
      `  <div>{{ document.body.${domHtmlProperty} }}</div>`,
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/pages/unsafe.vue:2: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test("resolves script import aliases inside Vue template capability assertions", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<script setup lang=\"ts\">",
      `import type { ${sanitizedHtmlType} ${castKeyword} Reviewed } from "#shared/types/renderable-html"`,
      "</script>",
      `<template>{{ value ${castKeyword} Reviewed }}</template>`
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test("audits suppression comments inside template-literal expressions", () => {
    const root = createTree()
    writeSource(
      root,
      "app/lib/unsafe.ts",
      `const rendered = \`${"${"}(() => { /* ${lintDisable} */ return safe })()}\``
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:1: ESLint inline configuration comments are forbidden"
    )
  })

  test("rejects an indirect computed DOM property access, not only its key declaration", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "const key = \"inner\" + \"HTML\"",
      "document.body[key] = unsafe"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:2: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test("rejects a runtime-computed property on a live DOM receiver", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "const key = getPropertyName()",
      "document.body[key] = unsafe"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:2: computed DOM HTML access is forbidden"
    )
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:2: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test("rejects innerHTML read through object destructuring", () => {
    const root = createTree()
    writeSource(
      root,
      "app/lib/unsafe.ts",
      `const { ${domHtmlProperty}: serialized } = document.body`
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:1: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test("rejects a runtime-computed DOM key in a destructuring assignment", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "const key = getPropertyName()",
      "let serialized",
      "({ [key]: serialized } = document.body)"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:3: computed DOM HTML access is forbidden"
    )
    expect(result.stderr).toContain(
      "app/lib/unsafe.ts:3: DOM HTML access is not in the reviewed allowlist"
    )
  })

  test.each([
    ["Reflect.set static key", `Reflect.set(document.body, "${domHtmlProperty}", unsafe)`],
    ["Reflect.set dynamic key", "Reflect.set(document.body, key, unsafe)"],
    [
      "Object.defineProperty static key",
      `Object.defineProperty(document.body, "${domHtmlProperty}", { value: unsafe })`
    ],
    [
      "Object.defineProperty dynamic key",
      "Object.defineProperty(document.body, key, { value: unsafe })"
    ],
    [
      "Reflect.defineProperty static key",
      `Reflect.defineProperty(document.body, "${domHtmlProperty}", { value: unsafe })`
    ],
    ["Object.assign dynamic bag", "Object.assign(document.body, JSON.parse(raw))"],
    [
      "querySelectorAll indexed receiver",
      "document.querySelectorAll('div')[0]![key] = unsafe"
    ],
    [
      "typed function-return receiver",
      "function target(): HTMLElement { return document.body }\ntarget()[key] = unsafe"
    ],
    ["aliased Reflect.set", "const set = Reflect.set\nset(document.body, key, unsafe)"],
    [
      "typed method-return receiver",
      "declare const api: { target(): HTMLElement }\nReflect.set(api.target(), key, unsafe)"
    ],
    [
      "Object.defineProperties dynamic bag",
      "const descriptors = JSON.parse(raw)\nObject.defineProperties(document.body, descriptors)"
    ]
  ])("rejects DOM mutation through %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/lib/unsafe.ts:")
    expect(result.stderr).toMatch(/DOM HTML (?:access|mutation)/u)
  })

  test.each([
    ["Reflect.set", "const { set: mutate } = Reflect\nmutate(document.body, key, unsafe)"],
    [
      "Reflect.defineProperty",
      "const { defineProperty: mutate } = Reflect\nmutate(document.body, key, { value: unsafe })"
    ],
    [
      "Object.defineProperty",
      "const { defineProperty: mutate } = Object\nmutate(document.body, key, { value: unsafe })"
    ],
    ["Object.assign", "const { assign: mutate } = Object\nmutate(document.body, props)"],
    [
      "Object.defineProperties",
      "const { defineProperties: mutate } = Object\nmutate(document.body, descriptors)"
    ]
  ])("rejects DOM mutation through a destructured %s alias", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("DOM HTML mutation API is forbidden")
  })

  test.each([
    ["direct method", "document.body.insertAdjacentHTML('beforeend', unsafe)"],
    [
      "destructured method",
      "const { insertAdjacentHTML: mutate } = document.body\nmutate('beforeend', unsafe)"
    ]
  ])("rejects live insertAdjacentHTML through a %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("DOM HTML mutation API is forbidden")
  })

  test("allows a non-DOM insertAdjacentHTML-shaped method", () => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", [
      "declare const formatter: { insertAdjacentHTML(position: string, value: string): void }",
      "formatter.insertAdjacentHTML('beforeend', value)"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    ["h dynamic bag", "h('div', JSON.parse(raw))"],
    ["h computed HTML key", "h('div', { [key]: unsafe })"],
    ["createVNode dynamic bag", "createVNode('div', props)"],
    ["createVNode computed HTML key", "createVNode('div', { [key]: unsafe })"],
    ["aliased Vue h", "import { h as render } from 'vue'\nrender('div', props)"],
    ["namespaced Vue h", "import * as Vue from 'vue'\nVue.h('div', props)"]
  ])("rejects native vnode props through %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("native vnode props can forward raw HTML properties")
  })

  test.each([
    "h('div', null)",
    "h('div', { class: 'safe' })",
    "createVNode('span', { title: 'safe' })"
  ])("allows an explicit safe native vnode prop bag %s", source => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    '<component is="div" v-bind="$attrs" />',
    '<component :is="\'div\'" v-bind="props" />',
    '<component is="div" :innerHTML="source" />',
    '<component :is="\'div\'" :[key]="source" />'
  ])("rejects native dynamic-component sink %s", source => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", `<template>${source}</template>`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/(?:native object v-bind|dynamic Vue argument|DOM HTML access)/u)
  })

  test.each([
    ['<component :is="target" v-bind="props" />', "native object v-bind"],
    ['<component :is="target" :[key]="source" />', "dynamic Vue argument"],
    ['<component :is="target" :innerHTML="source" />', "DOM HTML access"]
  ])("rejects an unresolved dynamic-component sink %s", (source, expected) => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", `<template>${source}</template>`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(expected)
  })

  test.each([
    '<component is="SafeComponent" v-bind="props" />',
    [
      '<script setup lang="ts">',
      'import SafeComponent from "~/components/SafeComponent.vue"',
      "</script>",
      '<template><component :is="SafeComponent" v-bind="props" /></template>'
    ].join("\n")
  ])("allows a proven component-only dynamic target %s", source => {
    const root = createTree()
    writeSource(root, "app/pages/safe.vue", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    [
      "inline DTO type",
      "function read(payload: { innerHTML: string }) { return payload.innerHTML }"
    ],
    [
      "named DTO type",
      "interface Payload { innerHTML: string }\ndeclare const payload: Payload\nvoid payload.innerHTML"
    ]
  ])("allows an ordinary %s innerHTML read", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("keeps an unresolved innerHTML receiver conservative", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", "function read(payload) { return payload.innerHTML }")

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("DOM HTML access is not in the reviewed allowlist")
  })

  test("rejects no-argument object v-bind on a native Vue element", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<template>",
      "  <div v-bind=\"attrs\" />",
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/pages/unsafe.vue:2: native object v-bind can forward raw HTML properties"
    )
  })

  test("allows component-only attrs forwarding", () => {
    const root = createTree()
    writeSource(root, "app/pages/safe.vue", [
      "<template>",
      "  <SafeComponent v-bind=\"$attrs\" />",
      "</template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("rejects a const-bound native dynamic-component sink", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<script setup lang=\"ts\">",
      "const tag = 'div'",
      "</script>",
      "<template><component :is=\"tag\" v-bind=\"props\" /></template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("native object v-bind can forward raw HTML properties")
  })

  test("rejects a constant-member native dynamic-component sink", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", [
      "<script setup lang=\"ts\">",
      "const tags = { root: 'div' } as const",
      "</script>",
      "<template><component :is=\"tags.root\" v-bind=\"props\" /></template>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("native object v-bind can forward raw HTML properties")
  })

  test("rejects dead detached provenance beside a live same-name shadow", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, [
      "import { parseHTML } from \"linkedom\"",
      "export function sanitizeAuthorHtml(value: string) {",
      "  {",
      "    const { document } = parseHTML(\"<body></body>\")",
      "    const container = document.createElement(\"div\")",
      "    void container",
      "  }",
      "  const container = globalThis.document.body",
      `  container.${domHtmlProperty} = value`,
      `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
      "}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test("rejects a local parseHTML shadow at a reviewed detached-DOM boundary", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        "export function sanitizeAuthorHtml(value: string) {",
        [
          "export function sanitizeAuthorHtml(value: string) {",
          "  const parseHTML = () => ({ document: globalThis.document })"
        ].join("\n")
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test("rejects a local capability-issuer shadow at a reviewed DOM boundary", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(
      root,
      path,
      reviewedDomSources[path]!.replace(
        "export function sanitizeAuthorHtml(value: string) {",
        [
          "export function sanitizeAuthorHtml(value: string) {",
          "  const issueAuthorProfileHtml = (source: string) => source"
        ].join("\n")
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed DOM HTML signature cardinality changed`)
  })

  test("rejects a reviewed receiver with one live reaching definition", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, [
      "import { parseHTML } from \"linkedom\"",
      "import { issueAuthorProfileHtml } from \"#shared/utils/renderable-html\"",
      "export function sanitizeAuthorHtml(value: string, live: boolean) {",
      "  let container",
      "  if (live) container = document.body",
      "  else {",
      "    const { document } = parseHTML(\"<body></body>\")",
      "    container = document.createElement(\"div\")",
      "  }",
      `  container.${domHtmlProperty} = value`,
      `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
      "}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed detached DOM provenance changed`)
  })

  test("rejects a live reaching definition followed textually by a non-DOM branch", () => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", [
      "let target",
      "if (flag) target = document.body",
      "else target = {}",
      "Reflect.set(target, key, unsafe)"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("computed DOM HTML access is forbidden")
    expect(result.stderr).toContain("DOM HTML mutation API is forbidden")
  })

  test("allows a reviewed receiver when every reaching definition is detached", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, [
      "import { parseHTML } from \"linkedom\"",
      "import { issueAuthorProfileHtml } from \"#shared/utils/renderable-html\"",
      "export function sanitizeAuthorHtml(value: string, first: boolean) {",
      "  let container",
      "  if (first) {",
      "    const { document } = parseHTML(\"<body></body>\")",
      "    container = document.createElement(\"div\")",
      "  } else {",
      "    const { document } = parseHTML(\"<main></main>\")",
      "    container = document.createElement(\"main\")",
      "  }",
      `  container.${domHtmlProperty} = value`,
      `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
      "}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("allows a reviewed receiver after an unconditional detached overwrite", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, [
      "import { parseHTML } from 'linkedom'",
      "import { issueAuthorProfileHtml } from '#shared/utils/renderable-html'",
      "export function sanitizeAuthorHtml(value: string) {",
      "  let container = document.body",
      "  const { document: parsed } = parseHTML('<body></body>')",
      "  container = parsed.createElement('div')",
      `  container.${domHtmlProperty} = value`,
      `  return issueAuthorProfileHtml(container.${domHtmlProperty})`,
      "}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    ["multiline assertion", `const reviewed = value ${castKeyword}\n  ${sanitizedHtmlType}<"author-profile">`],
    ["comment-separated import alias", `import type { ${sanitizedHtmlType} /* reviewed */ ${castKeyword} Reviewed } from "../../shared/types/renderable-html"\nconst reviewed = value ${castKeyword} Reviewed`],
    ["ReturnType issuer alias", `import { issueAuthorProfileHtml } from "../../shared/utils/renderable-html"\ntype Reviewed = ReturnType<typeof issueAuthorProfileHtml>\nconst reviewed = value ${castKeyword} Reviewed`],
    ["tuple-index wrapper", `const reviewed = value ${castKeyword} [${sanitizedHtmlType}<"author-profile">][0]`],
    ["indexed policy DTO field", `import type { AuthorProfileView } from "../author-profile"\ntype Reviewed = AuthorProfileView["introductionHtml"]\nconst reviewed = value ${castKeyword} Reviewed`],
    ["typeof issuer value", `const branded = issueAuthorProfileHtml(value)\ntype Reviewed = typeof branded\nconst reviewed = value ${castKeyword} Reviewed`],
    ["function-expression derived cast", `type Reviewed = ReturnType<typeof issueAuthorProfileHtml>\nconst brand = function (value: string) { return value ${castKeyword} Reviewed }`],
    ["object-method derived cast", `type Reviewed = ReturnType<typeof issueAuthorProfileHtml>\nconst brander = { brand(value: string) { return value ${castKeyword} Reviewed } }`],
    ["return angle assertion", `function brand(value: string) { return <${sanitizedHtmlType}<"author-profile">>value }`],
    ["multiline return angle assertion", `function brand(value: string) { return <\n${sanitizedHtmlType}<"author-profile">\n>value }`]
  ])("rejects derived or structurally wrapped capability forgery: %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/lib/unsafe.ts:")
    expect(result.stderr).toContain("capability assertions are limited to the private capability helper")
  })

  test.each([
    ["Reader OCR overlay", "ReaderOcrOverlay", "html"],
    ["Reader e-text page", "ReaderEtextPage", "html"],
    ["Editor Reader page", "EditorReaderPage", "html"],
    ["Author profile introduction", "AuthorProfileView", "introductionHtml"],
    ["Presentation body", "PresentationDocument", "bodyHtml"],
    ["Reader errata cells", "ReaderSourceInfoErrataRow", "cellsHtml"],
    ["Reader source history", "ReaderSourceInfoDramawebben", "historyHtml"],
    ["Author supplemental body", "AuthorSupplementalPage", "bodyHtml"],
    ["Dramawebben body", "DramawebbenManagedDocument", "bodyHtml"],
    ["SLA body", "SlaArticlePage", "bodyHtml"]
  ])("rejects an indexed cast through the real branded DTO field: %s", (_name, dto, field) => {
    const root = createTree()
    writeSource(
      root,
      "app/lib/unsafe.ts",
      `const reviewed = value ${castKeyword} ${dto}["${field}"]`
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test("allows an indexed cast through an unbranded field on a capability-bearing DTO", () => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", "const width = value as ReaderOcrOverlay[\"width\"]")

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    [
      "lowercase second generic in a function expression",
      `const brand = function <safe, forged>(value: string): forged { return value ${castKeyword} forged }\nbrand<string, ${sanitizedHtmlType}<"author-profile">>(value)`
    ],
    [
      "lowercase second generic in an object method",
      `const brander = { brand<safe, forged>(value: string): forged { return value ${castKeyword} forged } }\nbrander.brand<string, ${sanitizedHtmlType}<"author-profile">>(value)`
    ],
    [
      "angle cast in a generic arrow",
      `const brand = <forged>(value: string): forged => <forged>value\nbrand<${sanitizedHtmlType}<"author-profile">>(value)`
    ],
    [
      "template interpolation cast",
      `const rendered = \`${"${"}(value ${castKeyword} ${sanitizedHtmlType}<"author-profile">)}\``
    ]
  ])("rejects an AST-hidden capability forgery: %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test.each([
    [
      "generic constraint",
      `function forge<T extends ${sanitizedHtmlType}<"author-profile">>(value: string): T { return value ${castKeyword} T }`
    ],
    [
      "generic function value alias",
      `function forge<T>(value: string): T { return value ${castKeyword} T }\nconst alias = forge\nalias<${sanitizedHtmlType}<"author-profile">>(value)`
    ]
  ])("rejects capability forgery through a %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test.each([
    [
      "wrapper function ReturnType",
      `function wrapped() { return issueAuthorProfileHtml(value) }\ntype Reviewed = ReturnType<typeof wrapped>\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "wrapper arrow ReturnType",
      `const wrapped = () => issueAuthorProfileHtml(value)\ntype Reviewed = ReturnType<typeof wrapped>\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "Parameters consumer extraction",
      `function consume(value: ${sanitizedHtmlType}<"author-profile">) {}\ntype Reviewed = Parameters<typeof consume>[0]\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "mapped property",
      `type Fields = { [Key in "html"]: ${sanitizedHtmlType}<"author-profile"> }\nconst forged = value ${castKeyword} Fields["html"]`
    ],
    [
      "conditional inferred return",
      `type Result<Value> = Value extends () => infer Output ? Output : never\ntype Reviewed = Result<() => ${sanitizedHtmlType}<"author-profile">>\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "generic object alias",
      `type Box<Value> = { html: Value }\ntype Reviewed = Box<${sanitizedHtmlType}<"author-profile">>["html"]\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "nested generic object alias",
      `type Box<Value> = { nested: { html: Value } }\ntype Reviewed = Box<${sanitizedHtmlType}<"author-profile">>["nested"]["html"]\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "nested generic aliases reusing a parameter name",
      `type Outer<Value> = Inner<Value>\ntype Inner<Value> = Value\ntype Reviewed = Outer<${sanitizedHtmlType}<"author-profile">>\nconst forged = value ${castKeyword} Reviewed`
    ],
    [
      "destructured generic method",
      `const brander = { forge<Value>(value: string): Value { return value ${castKeyword} Value } }\nconst { forge } = brander\nforge<${sanitizedHtmlType}<"author-profile">>(value)`
    ],
    [
      "instantiation expression",
      `function forge<Value>(value: string): Value { return value ${castKeyword} Value }\nconst brand = forge<${sanitizedHtmlType}<"author-profile">>\nbrand(value)`
    ],
    [
      "namespace wrapper typeof",
      `import * ${castKeyword} Html from "#shared/utils/renderable-html"\nconst wrapped = { issue: Html.issueAuthorProfileHtml }\ntype Reviewed = ReturnType<typeof wrapped.issue>\nconst forged = value ${castKeyword} Reviewed`
    ]
  ])("rejects type-derived capability forgery through %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test.each([
    `const forged: ${sanitizedHtmlType}<"author-profile"> = JSON.parse(raw)`,
    `declare function parse(value: string): any\nconst forged: ${sanitizedHtmlType}<"author-profile"> = parse(raw)`,
    `function forge(): ${sanitizedHtmlType}<"author-profile"> { return JSON.parse(raw) }`,
    `const forge = (): ${sanitizedHtmlType}<"author-profile"> => JSON.parse(raw)`,
    `let forged: ${sanitizedHtmlType}<"author-profile">\nforged = JSON.parse(raw)`,
    `declare const target: { html: ${sanitizedHtmlType}<"author-profile"> }\ntarget.html = JSON.parse(raw)`,
    `declare const payload: any\nconst forged: ${sanitizedHtmlType}<"author-profile"> = payload.html`,
    `declare const target: { html: ${sanitizedHtmlType}<"author-profile"> }\ntarget["html"] = JSON.parse(raw)`,
    `type Loose = any\ndeclare const payload: Loose\nconst forged: ${sanitizedHtmlType}<"author-profile"> = payload`,
    `declare const payload: { html: any }\nconst forged: ${sanitizedHtmlType}<"author-profile"> = payload.html`,
    `declare const parser: { parse(): any }\nconst forged: ${sanitizedHtmlType}<"author-profile"> = parser.parse()`,
    `declare const state: { target: { html: ${sanitizedHtmlType}<"author-profile"> } }\nstate.target.html = JSON.parse(raw)`
  ])("rejects any-valued direct capability flow %s", source => {
    const root = createTree()
    writeSource(root, "app/lib/unsafe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability values must originate from a reviewed issuer"
    )
  })

  test.each([
    "type Overlay = ReaderOcrOverlay\nconst width = value as Overlay[\"width\"]",
    "const width = value as NonNullable<ReaderOcrOverlay>[\"width\"]",
    `type Fields = { [Key in "html" | "width"]: Key extends "html" ? ${sanitizedHtmlType}<"author-profile"> : number }\nconst width = value ${castKeyword} Fields["width"]`,
    `type Box<Value> = { nested: { html: Value, width: number } }\nconst width = value ${castKeyword} Box<${sanitizedHtmlType}<"author-profile">>["nested"]["width"]`,
    `type Selected<Key> = Key extends "html" ? ${sanitizedHtmlType}<"author-profile"> : number\nconst width = value ${castKeyword} Selected<"width">`
  ])("allows safe indexed DTO wrapper %s", source => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("keeps same-named module-local safe and capability types independent", () => {
    const root = createTree()
    writeSource(root, "app/lib/capability.ts", [
      `type Payload = { html: ${sanitizedHtmlType}<"author-profile"> }`,
      "export {}"
    ].join("\n"))
    writeSource(root, "app/lib/safe.ts", [
      "type Payload = { width: number }",
      `const width = value ${castKeyword} Payload`,
      "export {}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("resolves an imported safe type independently of a same-named capability type", () => {
    const root = createTree()
    writeSource(root, "app/lib/capability.ts", [
      `export type Payload = { html: ${sanitizedHtmlType}<"author-profile"> }`
    ].join("\n"))
    writeSource(root, "app/lib/safe-type.ts", "export type Payload = { width: number }")
    writeSource(root, "app/lib/safe.ts", [
      "import type { Payload } from './safe-type'",
      `const width = value ${castKeyword} Payload`
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("rejects capability derivation through a renamed default import", () => {
    const root = createTree()
    writeSource(
      root,
      "app/lib/cap-default.ts",
      `export default interface InternalCapability { html: ${sanitizedHtmlType}<"author-profile"> }`
    )
    writeSource(root, "app/lib/unsafe.ts", [
      "import Payload from './cap-default'",
      `const forged = value ${castKeyword} Payload["html"]`
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "capability assertions are limited to the private capability helper"
    )
  })

  test.each([
    `const reviewed: ${sanitizedHtmlType}<"author-profile"> = issueAuthorProfileHtml(value)`,
    `let reviewed: ${sanitizedHtmlType}<"author-profile">\nreviewed = issueAuthorProfileHtml(value)`,
    `function issue(value: string): ${sanitizedHtmlType}<"author-profile"> { return issueAuthorProfileHtml(value) }\nconst reviewed: ${sanitizedHtmlType}<"author-profile"> = issue(value)`,
    `declare function useRequestFetch(): any\nconst requestFetch = useRequestFetch()\ninterface Page { html: ${sanitizedHtmlType}<"author-profile"> }\nfunction requestPage(): Promise<Page> { return requestFetch<Page>("/api") }`,
    `function consume(width: number, html: ${sanitizedHtmlType}<"author-profile">) {}\nconst safe = value ${castKeyword} Parameters<typeof consume>[0]`,
    `type Box<Value> = { width: number, html: Value }\nconst safe = value ${castKeyword} Box<${sanitizedHtmlType}<"author-profile">>["width"]`
  ])("allows an issuer-backed or exact safe-field capability flow %s", source => {
    const root = createTree()
    writeSource(root, "app/lib/safe.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test.each([
    [
      "generic issuer replacement",
      (source: string) => source.replace(
        `export function issueAuthorProfileHtml(value: string): ${sanitizedHtmlType}<"author-profile"> { return capability<${sanitizedHtmlType}<"author-profile">>(value) }`,
        `export function issueAuthorProfileHtml<T extends ${renderableCapabilityType}>(value: string): T { return capability<T>(value) }`
      )
    ],
    ["Object.assign escape", (source: string) => `${source}\nObject.assign(issueAuthorProfileHtml, { brand: capability })`],
    ["comment-separated helper alias", (source: string) => `${source}\nconst brand = /* reviewed */ capability`],
    ["aliased re-export", (source: string) => `${source}\nexport { issueAuthorProfileHtml as brand }`],
    ["default export", (source: string) => `${source}\nexport default issueAuthorProfileHtml`],
    ["Reflect helper escape", (source: string) => `${source}\nReflect.apply(capability, null, [value])`],
    ["template interpolation helper escape", (source: string) => `${source}\nconst leaked = \`${"${"}capability(value)}\``]
  ])("rejects an issuer-module structural escape: %s", (_name, mutate) => {
    const root = createTree()
    writeSource(root, "shared/utils/renderable-html.ts", mutate(reviewedCapabilityModule()))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("shared/utils/renderable-html.ts:1: capability utility must equal the reviewed structural surface")
  })

  test("rejects a rules override and any widened ESLint ignore", () => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", eslintConfig([...expectedIgnores, "fixtures/**"], "rules: {}"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("eslint.config.mjs:1: ESLint configuration must equal the canonical reviewed file")
  })

  test.each([
    ["computed rules", `export default withNuxt({ ["rules"]: {} , ignores: ${JSON.stringify(expectedIgnores)} })`],
    ["duplicate rules", `export default withNuxt({ rules: {}, ["rules"]: {} , ignores: ${JSON.stringify(expectedIgnores)} })`],
    ["computed ignores", `export default withNuxt({ ["ignores"]: ${JSON.stringify(expectedIgnores)} })`],
    ["second ignores", `export default withNuxt({ ignores: ${JSON.stringify(expectedIgnores)}, ["ignores"]: ${JSON.stringify(expectedIgnores)} })`]
  ])("rejects %s in the ESLint config", (_name, config) => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", config)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("eslint.config.mjs:1: ESLint configuration must equal the canonical reviewed file")
  })

  test.each([
    ["template-derived shorthand", `const ignores = [\`.nuxt/**\`]\nconst alternate = { ignores }`],
    ["concatenated shorthand", `const ignores = [".nuxt/" + "**"]\nconst alternate = { ignores }`],
    ["getter property", "const alternate = { get ignores() { return [] } }"],
    ["second config object", "const alternate = withNuxt({})"],
    ["additional imported config", `import alternate from "./alternate-eslint.config.mjs"`]
  ])("rejects non-canonical ESLint configuration structure: %s", (_name, extra) => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", `${eslintConfig()}\n${extra}\n`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("eslint.config.mjs:1: ESLint configuration must equal the canonical reviewed file")
  })

  test.each([
    [`/* ${lintDisable} */`, "ESLint inline configuration comments are forbidden"],
    [`// ${lintEnable}`, "ESLint inline configuration comments are forbidden"],
    [`/* ${lintEnvironment} node */`, "ESLint inline configuration comments are forbidden"],
    [`/* ${lintInline} no-alert: "off" */`, "ESLint inline configuration comments are forbidden"],
    [`/* ${lintGlobal} injected */`, "ESLint inline configuration comments are forbidden"],
    [`/* ${lintExported} injected */`, "ESLint inline configuration comments are forbidden"]
  ])("rejects inline lint configuration %s", (comment, expectedMessage) => {
    const root = createTree()
    writeSource(root, "test/unit/unsafe.spec.ts", comment)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`test/unit/unsafe.spec.ts:1: ${expectedMessage}`)
  })

  test("rejects an ESLint directive in a Vue HTML comment", () => {
    const root = createTree()
    writeSource(root, "app/pages/unsafe.vue", `<!-- ${lintDisable} vue/no-v-html -->`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/pages/unsafe.vue:1: ESLint inline configuration comments are forbidden")
  })

  test.each(["\n", "\r\n", "\r", "\u2028", "\u2029"])(
    "requires a description before the %j expected-error line terminator",
    separator => {
      const root = createTree()
      writeSource(
        root,
        "test/nuxt/renderable-html-contract.ts",
        `// ${tsExpectError}${separator}const value: never = 1`
      )

      const result = runVerifier(root)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain("test/nuxt/renderable-html-contract.ts:1: expected-error directives require a description")
    }
  )

  test.each([
    ["URL string", `const documentation = "https://${lintInline}.org/docs"`],
    ["directive fixture string", `const fixture = "// ${lintDisable}-next-line"`],
    ["capability prose comment", `// This example reads value ${castKeyword} ${sanitizedHtmlType}<"author-profile"> but is not executable.\nconst safe = true`]
  ])("ignores policy-like prose in a %s", (_name, source) => {
    const root = createTree()
    writeSource(root, "test/unit/safe-prose.spec.ts", source)

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("treats regexes, strings, and template data as data while parsing their executable contexts", () => {
    const root = createTree()
    writeSource(root, "app/lib/safe-parser-contexts.ts", [
      "async function inspect(value: string) {",
      "  const awaited = await /[!'@ts-ignore]+/u.test(value)",
      "  const numeric = +/[!'eslint-disable]+/u.test(value)",
      "  for (const entry of [/[!'innerHTML]+/u, \"v-html\", `RenderableCapability`]) {",
      "    entry.toString()",
      "  }",
      "  return `${awaited}:${numeric}:${value}`",
      "}"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("counts LF, CRLF, CR, and Unicode line separators exactly once", () => {
    const root = createTree()
    writeSource(
      root,
      "test/unit/line-endings.spec.ts",
      `one\ntwo\r\nthree\rfour\u2028five\u2029// ${tsIgnore}`
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("test/unit/line-endings.spec.ts:6: TypeScript ignore comments are forbidden")
  })

  test("scans a large source without quadratic token line enrichment", () => {
    const root = createTree()
    writeSource(
      root,
      "test/unit/large-source.spec.ts",
      Array.from({ length: 10_000 }, (_value, index) => `const safeValue${index} = ${index}`).join("\n")
    )

    const result = runVerifier(root, 2_000)

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
  })

  test("reports many violations without quadratic line rescanning", () => {
    const root = createTree()
    const violationCount = 30_000
    writeSource(
      root,
      "app/lib/many-violations.ts",
      Array.from({ length: violationCount }, () => `/* ${lintDisable} */`).join(" ")
    )

    const result = runVerifier(root, 2_000)

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "app/lib/many-violations.ts:1: ESLint inline configuration comments are forbidden"
    )
  })

  test("audits 3,000 Vue interpolations without source-sized padding per expression", () => {
    const root = createTree()
    writeSource(root, "app/pages/many-interpolations.vue", [
      "<template>",
      ...Array.from({ length: 3_000 }, (_value, index) => `  <span>{{ safe${index} }}</span>`),
      "</template>"
    ].join("\n"))

    const result = runVerifier(root, 2_000)

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
  })

  test("audits nested generics that reuse a type-parameter name without overflowing", () => {
    const root = createTree()
    writeSource(root, "app/pages/nested-generics.vue", [
      "<template>{{ label }}</template>",
      "<script setup lang=\"ts\">",
      "type Outer<Value> = Inner<Value>",
      "type Inner<Value> = Value",
      "const label: Outer<string> = \"root\"",
      "</script>"
    ].join("\n"))

    const result = runVerifier(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("reports every violation in stable path and line order", () => {
    const root = createTree()
    writeSource(
      root,
      "app/pages/z-last.vue",
      `const first = true\n<div ${vueHtmlDirective}="first" />\n<div ${vueHtmlDirective}="second" />\n`
    )
    writeSource(
      root,
      "app/pages/a-first.ts",
      `const first = true\n// ${lintDisable}-next-line\nconst second = true\n// ${tsIgnore}\n`
    )

    const first = runVerifier(root)
    const second = runVerifier(root)

    expect(first.status).toBe(1)
    expect(first.stderr).toBe(second.stderr)
    expect(first.stderr.trim().split("\n")).toEqual([
      "app/pages/a-first.ts:2: ESLint inline configuration comments are forbidden",
      "app/pages/a-first.ts:4: TypeScript ignore comments are forbidden",
      "app/pages/z-last.vue:2: Vue raw-HTML directives are forbidden",
      "app/pages/z-last.vue:3: Vue raw-HTML directives are forbidden"
    ])
  })

  test.each([
    [".nuxt-copy/unsafe.ts", `// ${tsIgnore}`, "TypeScript ignore comments are forbidden"],
    ["coverage-copy/unsafe.ts", `// ${lintDisable}`, "ESLint inline configuration comments are forbidden"],
    ["app/lib/api/generated-copy/unsafe.vue", `<div ${vueHtmlDirective}="unsafe" />`, "Vue raw-HTML directives are forbidden"],
    ["server/utils/sla-article-copy.ts", `const html = root.${domHtmlProperty}`, "DOM HTML access is not in the reviewed allowlist"]
  ])("does not widen an ignored or allowlisted path to %s", (path, source, expectedMessage) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(expectedMessage)
  })

  test.each(
    ["app", "server", "shared", "scripts", "test"].flatMap(sourceRoot =>
      [
        ".nuxt",
        ".output",
        "node_modules",
        "coverage",
        "playwright-report",
        "test-results-backdoor",
        "app/lib/api/generated"
      ].map(outputFamily => [`${sourceRoot}/${outputFamily}/unsafe.ts`, sourceRoot, outputFamily])
    )
  )("does not ignore nested output-family path %s", (path, _sourceRoot, _outputFamily) => {
    const root = createTree()
    writeSource(root, path, `// ${tsIgnore}`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:1: TypeScript ignore comments are forbidden`)
  })

  test("rejects an unaudited source symlink instead of traversing outside the root", () => {
    const root = createTree()
    symlinkSync(resolve(root, "shared/utils/renderable-html.ts"), resolve(root, "app/symlink.ts"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/symlink.ts: symbolic links are not part of the audited source tree")
  })

  test("rejects a binary source file instead of silently skipping its policy surface", () => {
    const root = createTree()
    const path = resolve(root, "app/binary.ts")
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, Buffer.from([0xff, 0xfe]))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app/binary.ts: source files must be valid UTF-8 text")
  })
})
