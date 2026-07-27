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
const renderableCapabilityType = ["Renderable", "Capability"].join("")
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
    `name !== "${domHtmlProperty}"`,
    `${domHtmlProperty}: props.html`
  ].join("\n"),
  "app/lib/author-profile.ts": [
    `container.${domHtmlProperty} = value`,
    `issueAuthorProfileHtml(container.${domHtmlProperty})`
  ].join("\n"),
  "app/lib/reader-dictionary.ts": `const html = root.${domHtmlProperty}`,
  "app/lib/search-hit-highlight.ts": [
    `return root.${domHtmlProperty}`,
    `issueReaderOcrHtml(root.${domHtmlProperty})`
  ].join("\n"),
  "app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue": `return root.${domHtmlProperty}`,
  "app/pages/presentationer/presentation-parser.ts": [
    `${domHtmlProperty}: string`,
    `issueManagedPresentationHtml(body.${domHtmlProperty})`
  ].join("\n"),
  "server/utils/author-document.ts": [
    `${domHtmlProperty}: string`,
    `issueAuthorDocumentHtml(body.${domHtmlProperty})`
  ].join("\n"),
  "server/utils/dramawebben-document.ts": [
    `${domHtmlProperty}: string`,
    `issueDramawebbenDocumentHtml(body.${domHtmlProperty})`
  ].join("\n"),
  "server/utils/editor-reader-html.ts": [
    `body: { ${domHtmlProperty}: string, querySelectorAll:`,
    `const html = document.body.${domHtmlProperty}`
  ].join("\n"),
  "server/utils/reader-source-info.ts": [
    `${domHtmlProperty}: string`,
    `issueReaderSourceInfoHtml(body.${domHtmlProperty})`,
    `return texts[0]!.${domHtmlProperty}`
  ].join("\n"),
  "server/utils/sla-article.ts": [
    `${domHtmlProperty}: string`,
    `issueSlaArticleHtml(body.${domHtmlProperty})`
  ].join("\n")
}

const capabilityExports = [
  "issueAuthorProfileHtml",
  "issueAuthorDocumentHtml",
  "issueDramawebbenDocumentHtml",
  "issueSlaArticleHtml",
  "issueDictionaryArticleHtml",
  "issueReaderOcrHtml",
  "issueReaderSourceInfoHtml",
  "issueEditorEtextHtml",
  "issueManagedReaderHtml",
  "issueManagedHomeHtml",
  "issueManagedAboutHtml",
  "issueManagedPresentationHtml",
  "issueManagedPresentationStyle",
  "issueManagedPresentationStylesheetHref",
  "emptyRenderableHtml",
  "joinReaderSourceRows",
  "transformManagedReaderHtml"
]

function reviewedCapabilityModule(): string {
  return [
    `function capability<T extends ${renderableCapabilityType}>(value: string): T {`,
    `  return value ${castKeyword} T`,
    "}",
    ...capabilityExports.map(name => `export function ${name}(value: string): unknown { return capability(value) }`)
  ].join("\n")
}

function writeSource(root: string, relativePath: string, source: string): void {
  const absolutePath = resolve(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, source)
}

function eslintConfig(ignores: readonly string[] = expectedIgnores, extra = ""): string {
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

function runVerifier(root: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
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
    ["generic exported brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport function brand<T>(value: string): T { return value ${castKeyword} T }`, "capability utility exports must equal the reviewed issuer surface"],
    ["generic exported named-policy brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport function brand<T extends ${sanitizedHtmlType}<"author-profile">>(value: string): T { return capability<T>(value) }`, "capability utility exports must equal the reviewed issuer surface"],
    ["generic exported arrow brander", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport const brand = <T>(value: string): T => value ${castKeyword} T`, "capability utility exports must equal the reviewed issuer surface"],
    ["exported private capability helper", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport { capability }`, "capability utility exports must equal the reviewed issuer surface"],
    ["exported private capability alias", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport const brand = capability`, "capability utility exports must equal the reviewed issuer surface"],
    ["default-exported private capability", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nexport default capability`, "capability utility exports must equal the reviewed issuer surface"],
    ["private capability alias", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nconst brand = capability`, "the private capability constructor must not be aliased"],
    ["second private assertion", "shared/utils/renderable-html.ts", `${reviewedCapabilityModule()}\nconst forged = value ${castKeyword} T`, "exactly one private capability assertion is required"]
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
    expect(result.stderr).toContain(`${path}:3: DOM HTML access does not match the reviewed signature`)
  })

  test("rejects duplicated reviewed DOM operations by cardinality", () => {
    const root = createTree()
    const path = "app/lib/author-profile.ts"
    writeSource(root, path, `${reviewedDomSources[path]}\ncontainer.${domHtmlProperty} = value`)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}: reviewed DOM HTML signature cardinality changed`)
  })

  test("rejects a rules override and any widened ESLint ignore", () => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", eslintConfig([...expectedIgnores, "fixtures/**"], "rules: {}"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("eslint.config.mjs:5: ESLint rules overrides are forbidden")
    expect(result.stderr).toContain("eslint.config.mjs:4: ESLint ignores must equal the seven reviewed path families")
  })

  test.each([
    ["computed rules", `export default withNuxt({ ["rules"]: {} , ignores: ${JSON.stringify(expectedIgnores)} })`, "ESLint rules overrides are forbidden"],
    ["duplicate rules", `export default withNuxt({ rules: {}, ["rules"]: {} , ignores: ${JSON.stringify(expectedIgnores)} })`, "ESLint rules overrides are forbidden"],
    ["computed ignores", `export default withNuxt({ ["ignores"]: ${JSON.stringify(expectedIgnores)} })`, "ESLint ignores must equal the seven reviewed path families"],
    ["second ignores", `export default withNuxt({ ignores: ${JSON.stringify(expectedIgnores)}, ["ignores"]: ${JSON.stringify(expectedIgnores)} })`, "ESLint ignores must equal the seven reviewed path families"]
  ])("rejects %s in the ESLint config", (_name, config, expectedMessage) => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", config)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`eslint.config.mjs:1: ${expectedMessage}`)
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
