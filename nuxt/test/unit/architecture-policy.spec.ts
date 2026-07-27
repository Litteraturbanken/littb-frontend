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
  "server/utils/reader-source-info.ts",
  "server/utils/sla-article.ts"
]

const reviewedDomSources: Readonly<Record<string, string>> = {
  "app/components/global/RenderableHtmlContent.vue": [
    "const forwardedAttrs = Object.fromEntries(",
    "  Object.entries(attrs).filter(([name]) => name !== \"innerHTML\" && name !== \"textContent\")",
    ")",
    "return h(props.as, {",
    "  ...forwardedAttrs,",
    `  ${domHtmlProperty}: props.html`,
    "})"
  ].join("\n"),
  "app/lib/author-profile.ts": [
    "import { parseHTML } from \"linkedom\"",
    "const { document } = parseHTML(\"<!doctype html><html><body></body></html>\")",
    "const container = document.createElement(\"div\")",
    `container.${domHtmlProperty} = value`,
    `issueAuthorProfileHtml(container.${domHtmlProperty})`
  ].join("\n"),
  "app/lib/reader-dictionary.ts": [
    "import { parseHTML } from \"linkedom\"",
    "const { document } = parseHTML(`<div data-dictionary-root>${markup}</div>`)",
    "const root = document.querySelector(\"[data-dictionary-root]\")",
    `const html = root.${domHtmlProperty}`
  ].join("\n"),
  "app/lib/search-hit-highlight.ts": [
    "import { parseHTML } from \"linkedom\"",
    "const { document } = parseHTML(`<div data-editor-highlight-root>${html}</div>`)",
    "const root = document.querySelector(\"[data-editor-highlight-root]\")",
    `return root.${domHtmlProperty}`,
    "const { document } = parseHTML(`<div data-reader-highlight-root>${html}</div>`)",
    "const root = document.querySelector(\"[data-reader-highlight-root]\")",
    `issueReaderOcrHtml(root.${domHtmlProperty})`
  ].join("\n"),
  "app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue": [
    "import { parseHTML } from \"linkedom\"",
    "const { document } = parseHTML(`<div data-reader-highlight-root>${source}</div>`)",
    "const root = document.querySelector(\"[data-reader-highlight-root]\")",
    `return root.${domHtmlProperty}`
  ].join("\n"),
  "app/pages/presentationer/presentation-parser.ts": [
    "import { DOMParser } from \"linkedom\"",
    `${domHtmlProperty}: string`,
    "const document = new DOMParser().parseFromString(source, \"text/html\") as unknown as ParsedDocument",
    "const body = document.querySelector(\"body\")",
    `issueManagedPresentationHtml(body.${domHtmlProperty})`,
    "const document = new DOMParser().parseFromString(source, \"text/xml\") as unknown as ParsedDocument"
  ].join("\n"),
  "server/utils/author-document.ts": [
    "import { parseHTML } from \"linkedom\"",
    `${domHtmlProperty}: string`,
    "({ document } = parseHTML(source) as unknown as { document: ParsedAuthorDocument })",
    "const bodies = [...document.querySelectorAll(\"body\")]",
    "const body = bodies[0]!",
    `issueAuthorDocumentHtml(body.${domHtmlProperty})`
  ].join("\n"),
  "server/utils/dramawebben-document.ts": [
    "import { parseHTML } from \"linkedom\"",
    `${domHtmlProperty}: string`,
    "({ document } = parseHTML(source) as unknown as { document: ParsedDramawebbenDocument })",
    "const bodies = [...document.querySelectorAll(\"body\")]",
    "const body = bodies[0]!",
    `issueDramawebbenDocumentHtml(body.${domHtmlProperty})`
  ].join("\n"),
  "server/utils/editor-reader-html.ts": [
    "import { parseHTML } from \"linkedom\"",
    "const { document } = parseHTML(source) as unknown as { document: {",
    `body: { ${domHtmlProperty}: string, querySelectorAll:`,
    `const html = document.body.${domHtmlProperty}`
  ].join("\n"),
  "server/utils/reader-source-info.ts": [
    "import { parseHTML } from \"linkedom\"",
    `${domHtmlProperty}: string`,
    "({ document } = parseHTML(source) as unknown as { document: ParsedDocument })",
    "const bodies = [...document.querySelectorAll(\"body\")]",
    "const body = bodies[0]!",
    `issueReaderSourceInfoHtml(body.${domHtmlProperty})`,
    "({ document } = parseHTML(source) as unknown as { document: ParsedDocument })",
    "const texts = [...document.querySelectorAll(\"text\")]",
    `return texts[0]!.${domHtmlProperty}`
  ].join("\n"),
  "server/utils/sla-article.ts": [
    "import { parseHTML } from \"linkedom\"",
    `${domHtmlProperty}: string`,
    "({ document } = parseHTML(source) as unknown as { document: ParsedSlaArticle })",
    "const bodies = [...document.querySelectorAll(\"body\")]",
    "const body = bodies[0]!",
    `issueSlaArticleHtml(body.${domHtmlProperty})`
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
    writeSource(root, path, `${reviewedDomSources[path]}\n${liveSink}`)

    const result = runVerifier(root)
    const liveSinkLine = reviewedDomSources[path]!.split("\n").length + 1

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:${liveSinkLine}: DOM HTML access does not match the reviewed signature`)
  })

  test("rejects an extra live DOM sink beside the sole renderer setter", () => {
    const root = createTree()
    const path = "app/components/global/RenderableHtmlContent.vue"
    writeSource(root, path, `${reviewedDomSources[path]}\ndocument.body.${domHtmlProperty} = unsafe`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:8: DOM HTML access does not match the reviewed signature`)
  })

  test("rejects duplicated reviewed DOM operations by cardinality", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, `${reviewedDomSources[path]}\ncontainer.${domHtmlProperty} = value`)

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
    writeSource(root, path, `${reviewedDomSources[path]}\ndocument.body["inner" + "HTML"] = unsafe`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:8: computed DOM HTML access is forbidden`)
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
    ["multiline assertion", `const reviewed = value\n  ${castKeyword}\n  ${sanitizedHtmlType}<"author-profile">`],
    ["comment-separated import alias", `import type { ${sanitizedHtmlType} /* reviewed */ ${castKeyword} Reviewed } from "../../shared/types/renderable-html"\nconst reviewed = value ${castKeyword} Reviewed`],
    ["ReturnType issuer alias", `import { issueAuthorProfileHtml } from "../../shared/utils/renderable-html"\ntype Reviewed = ReturnType<typeof issueAuthorProfileHtml>\nconst reviewed = value ${castKeyword} Reviewed`],
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
    ["default export", (source: string) => `${source}\nexport default issueAuthorProfileHtml`]
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
