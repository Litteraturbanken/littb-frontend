import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

const verifier = resolve(import.meta.dirname, "../../scripts/verify-architecture-policy.mjs")
const vueHtmlDirective = ["v", "html"].join("-")
const lintDisable = ["eslint", "disable"].join("-")
const tsIgnore = ["@ts", "ignore"].join("-")
const tsExpectError = ["@ts", "expect-error"].join("-")
const domHtmlProperty = ["inner", "HTML"].join("")
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
    "function capability<T>(value: string): T { return value as T }\n"
  )
  writeSource(
    root,
    "app/components/global/RenderableHtmlContent.vue",
    `export const props = { ${domHtmlProperty}: "reviewed" }\n`
  )
  for (const path of detachedDomAllowlist) {
    writeSource(root, path, `export const serialized = node.${domHtmlProperty}\n`)
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
    ["ESLint suppression", "app/pages/unsafe.ts", `// ${lintDisable}-next-line\nunsafe()`, "ESLint suppression comments are forbidden"],
    ["TypeScript ignore", "test/unit/unsafe.spec.ts", `// ${tsIgnore}\nunsafe()`, "TypeScript ignore comments are forbidden"],
    ["undescribed expected error", "test/nuxt/renderable-html-contract.ts", `// ${tsExpectError}\nconst value: never = 1`, "expected-error directives require a description"],
    ["expected error outside a contract", "test/unit/unsafe.spec.ts", `// ${tsExpectError} Invalid value must fail.\nconst value: never = 1`, "expected-error directives are limited to compile contracts"],
    ["live DOM serialization", "app/pages/unsafe.ts", `element.${domHtmlProperty} = source`, "DOM HTML access is not in the reviewed allowlist"],
    ["detached DOM serialization", "server/utils/unreviewed-sanitizer.ts", `const value = root.${domHtmlProperty}`, "DOM HTML access is not in the reviewed allowlist"],
    ["capability assertion", "app/lib/unsafe.ts", "const reviewed = value as SanitizedHtml<\"author-profile\">", "capability assertions are limited to the private capability helper"],
    ["aliased capability assertion", "app/lib/unsafe.ts", "import type { SanitizedHtml as Reviewed } from \"../../shared/types/renderable-html\"\nconst reviewed = value as Reviewed", "capability assertions are limited to the private capability helper", 2],
    ["namespace capability assertion", "app/lib/unsafe.ts", "import type * as Html from \"../../shared/types/renderable-html\"\nconst reviewed = value as Html.SanitizedHtml<\"author-profile\">", "capability assertions are limited to the private capability helper", 2],
    ["transitively aliased capability assertion", "app/lib/unsafe.ts", "type Reviewed = SanitizedHtml<\"author-profile\">\ntype AlsoReviewed = Reviewed\nconst reviewed = value as AlsoReviewed", "capability assertions are limited to the private capability helper", 3],
    ["generic arrow capability assertion", "app/lib/unsafe.ts", "const brand = <T extends SanitizedHtml<\"author-profile\">>(value: string): T => value as T", "capability assertions are limited to the private capability helper"],
    ["generic exported brander", "shared/utils/renderable-html.ts", "export function brand<T extends RenderableCapability>(value: string): T { return capability<T>(value) }", "generic capability branders must remain private"],
    ["generic exported named-policy brander", "shared/utils/renderable-html.ts", "export function brand<T extends SanitizedHtml<\"author-profile\">>(value: string): T { return capability<T>(value) }", "generic capability branders must remain private"],
    ["generic exported arrow brander", "shared/utils/renderable-html.ts", "export const brand = <T extends RenderableCapability>(value: string): T => capability<T>(value)", "generic capability branders must remain private"],
    ["exported private capability helper", "shared/utils/renderable-html.ts", "function capability<T>(value: string): T { return value as T }\nexport { capability }", "the generic capability helper must not be exported", 2]
  ])("rejects %s", (_name, path, source, expectedMessage, expectedLine = 1) => {
    const root = createTree()
    writeSource(root, path, source)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${path}:${expectedLine}: ${expectedMessage}`)
  })

  test("rejects a rules override and any widened ESLint ignore", () => {
    const root = createTree()
    writeSource(root, "eslint.config.mjs", eslintConfig([...expectedIgnores, "fixtures/**"], "rules: {}"))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("eslint.config.mjs: ESLint rules overrides are forbidden")
    expect(result.stderr).toContain("eslint.config.mjs: ESLint ignores must equal the seven reviewed path families")
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
      "app/pages/a-first.ts:2: ESLint suppression comments are forbidden",
      "app/pages/a-first.ts:4: TypeScript ignore comments are forbidden",
      "app/pages/z-last.vue:2: Vue raw-HTML directives are forbidden",
      "app/pages/z-last.vue:3: Vue raw-HTML directives are forbidden"
    ])
  })

  test.each([
    [".nuxt-copy/unsafe.ts", `// ${tsIgnore}`, "TypeScript ignore comments are forbidden"],
    ["coverage-copy/unsafe.ts", `// ${lintDisable}`, "ESLint suppression comments are forbidden"],
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
