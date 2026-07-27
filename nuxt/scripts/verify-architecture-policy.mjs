import { lstatSync, readFileSync, readdirSync } from "node:fs"
import { extname, relative, resolve, sep } from "node:path"

const root = resolve(process.argv[2] ?? process.cwd())
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"])
const rendererPath = "app/components/global/RenderableHtmlContent.vue"
const capabilityPath = "shared/utils/renderable-html.ts"
const contractAllowlist = new Set([
  "test/nuxt/author-works-contract.ts",
  "test/nuxt/reader-source-info-contract.ts",
  "test/nuxt/renderable-html-contract.ts"
])
const detachedDomAllowlist = new Set([
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
])
const expectedEslintIgnores = [
  ".nuxt/**",
  ".output/**",
  "node_modules/**",
  "app/lib/api/generated/**",
  "coverage/**",
  "playwright-report/**",
  "test-results*/**"
]
const lintDisableToken = ["eslint", "disable"].join("-")
const tsIgnoreToken = ["@ts", "ignore"].join("-")
const tsExpectedErrorToken = ["@ts", "expect-error"].join("-")
const vueHtmlToken = ["v", "html"].join("-")
const domHtmlToken = ["inner", "HTML"].join("")
const capabilityTypes = [
  "ManagedAssetHtml",
  "ManagedStyleText",
  "ManagedStylesheetHref",
  "RenderableCapability",
  "RenderableHtml",
  "SanitizedHtml"
]
const capabilityAlternation = capabilityTypes.join("|")
const capabilityAssertionPattern = new RegExp(
  `\\bas\\s+(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?(?:${capabilityAlternation})(?:\\s*<|\\b)`,
  "gu"
)
const exportedGenericFunctionPattern = /\bexport\s+function\s+[A-Za-z_$][\w$]*\s*<([\s\S]*?)>\s*\(([\s\S]*?)\)/gu
const exportedGenericArrowPattern = /\bexport\s+const\s+[A-Za-z_$][\w$]*\s*=\s*<([\s\S]*?)>\s*\(([\s\S]*?)\)/gu
const exportedCapabilityHelperPattern = /\bexport\s*(?:\{[^}]*\bcapability\b[^}]*\}|(?:function|const)\s+capability\b)/gu

const violations = []
let auditedFileCount = 0

function normalizedRelativePath(absolutePath) {
  return relative(root, absolutePath).split(sep).join("/")
}

function isIgnoredPath(relativePath) {
  const parts = relativePath.split("/")
  const directories = parts.slice(0, -1)
  if (directories.some(part => part === ".nuxt" || part === ".output" || part === "node_modules")) return true
  if (directories.some(part => part === "coverage" || part === "playwright-report")) return true
  if (directories.some(part => part.startsWith("test-results"))) return true
  return parts[0] === "app" && parts[1] === "lib" && parts[2] === "api" && parts[3] === "generated"
}

function isProductionPath(relativePath) {
  return relativePath.startsWith("app/")
    || relativePath.startsWith("server/")
    || relativePath.startsWith("shared/")
}

function addViolation(path, line, message) {
  violations.push({ path, line, message })
}

function lineNumberAt(source, index) {
  let line = 1
  for (let position = 0; position < index; position += 1) {
    if (source.charCodeAt(position) === 10) line += 1
  }
  return line
}

function addTokenViolations(relativePath, source, token, message) {
  let fromIndex = 0
  while (fromIndex < source.length) {
    const index = source.indexOf(token, fromIndex)
    if (index === -1) return
    addViolation(relativePath, lineNumberAt(source, index), message)
    fromIndex = index + token.length
  }
}

function addPatternViolations(relativePath, source, pattern, message) {
  pattern.lastIndex = 0
  for (const match of source.matchAll(pattern)) {
    addViolation(relativePath, lineNumberAt(source, match.index), message)
  }
}

function addAliasedCapabilityAssertions(relativePath, source) {
  const aliases = new Set()
  const importRanges = []
  const importPattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["']/gu
  for (const match of source.matchAll(importPattern)) {
    importRanges.push([match.index, match.index + match[0].length])
    const aliasPattern = new RegExp(`\\b(?:${capabilityAlternation})\\s+as\\s+([A-Za-z_$][\\w$]*)`, "gu")
    for (const alias of match[1].matchAll(aliasPattern)) aliases.add(alias[1])
  }
  const typeAliases = [...source.matchAll(
    /\btype\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)?([A-Za-z_$][\w$]*)/gu
  )]
  let addedAlias = true
  while (addedAlias) {
    addedAlias = false
    for (const match of typeAliases) {
      if (capabilityTypes.includes(match[2]) || aliases.has(match[2])) {
        const size = aliases.size
        aliases.add(match[1])
        if (aliases.size !== size) addedAlias = true
      }
    }
  }

  for (const alias of aliases) {
    const assertionPattern = new RegExp(`\\bas\\s+${alias}\\b`, "gu")
    for (const match of source.matchAll(assertionPattern)) {
      if (importRanges.some(([start, end]) => match.index >= start && match.index < end)) continue
      addViolation(
        relativePath,
        lineNumberAt(source, match.index),
        "capability assertions are limited to the private capability helper"
      )
    }
  }

  const genericConstraintPattern = new RegExp(
    `\\b([A-Za-z_$][\\w$]*)\\s+extends\\s+(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?([A-Za-z_$][\\w$]*)`,
    "gu"
  )
  const constrainedParameters = new Set()
  for (const match of source.matchAll(genericConstraintPattern)) {
    if (capabilityTypes.includes(match[2]) || aliases.has(match[2])) {
      constrainedParameters.add(match[1])
    }
  }
  for (const parameter of constrainedParameters) {
    addPatternViolations(
      relativePath,
      source,
      new RegExp(`\\bas\\s+${parameter}\\b`, "gu"),
      "capability assertions are limited to the private capability helper"
    )
  }
}

function addExportedGenericBranderViolations(relativePath, source, pattern) {
  pattern.lastIndex = 0
  for (const match of source.matchAll(pattern)) {
    if (!capabilityTypes.some(type => new RegExp(`\\b${type}\\b`, "u").test(match[1]))) continue
    if (!/:\s*string\b/u.test(match[2])) continue
    addViolation(relativePath, lineNumberAt(source, match.index), "generic capability branders must remain private")
  }
}

function auditExpectedErrors(relativePath, source) {
  let fromIndex = 0
  while (fromIndex < source.length) {
    const index = source.indexOf(tsExpectedErrorToken, fromIndex)
    if (index === -1) return
    const line = lineNumberAt(source, index)
    if (!contractAllowlist.has(relativePath)) {
      addViolation(relativePath, line, "expected-error directives are limited to compile contracts")
    }
    const lineEnd = source.indexOf("\n", index)
    const suffix = source.slice(index + tsExpectedErrorToken.length, lineEnd === -1 ? source.length : lineEnd).trim()
    if (suffix.length === 0) {
      addViolation(relativePath, line, "expected-error directives require a description")
    }
    fromIndex = index + tsExpectedErrorToken.length
  }
}

function auditSource(relativePath, source) {
  addTokenViolations(relativePath, source, lintDisableToken, "ESLint suppression comments are forbidden")
  addTokenViolations(relativePath, source, tsIgnoreToken, "TypeScript ignore comments are forbidden")
  auditExpectedErrors(relativePath, source)

  if (extname(relativePath) === ".vue") {
    addPatternViolations(
      relativePath,
      source,
      new RegExp(`\\b${vueHtmlToken}\\s*=`, "gu"),
      "Vue raw-HTML directives are forbidden"
    )
  }

  if (!isProductionPath(relativePath)) return
  if (source.includes(domHtmlToken)
    && relativePath !== rendererPath
    && !detachedDomAllowlist.has(relativePath)) {
    addTokenViolations(relativePath, source, domHtmlToken, "DOM HTML access is not in the reviewed allowlist")
  }

  if (relativePath === capabilityPath) {
    addExportedGenericBranderViolations(relativePath, source, exportedGenericFunctionPattern)
    addExportedGenericBranderViolations(relativePath, source, exportedGenericArrowPattern)
    addPatternViolations(
      relativePath,
      source,
      exportedCapabilityHelperPattern,
      "the generic capability helper must not be exported"
    )
    return
  }

  addPatternViolations(
    relativePath,
    source,
    capabilityAssertionPattern,
    "capability assertions are limited to the private capability helper"
  )
  addAliasedCapabilityAssertions(relativePath, source)
}

function readSource(absolutePath, relativePath) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(absolutePath))
  } catch {
    addViolation(relativePath, 0, "source files must be valid UTF-8 text")
    return null
  }
}

function auditEslintConfig() {
  const relativePath = "eslint.config.mjs"
  const absolutePath = resolve(root, relativePath)
  let source
  try {
    source = readFileSync(absolutePath, "utf8")
  } catch {
    addViolation(relativePath, 0, "ESLint configuration is missing")
    return
  }

  if (/\brules\s*:/u.test(source)) {
    addViolation(relativePath, 0, "ESLint rules overrides are forbidden")
  }

  const ignoreBlocks = [...source.matchAll(/\bignores\s*:\s*\[([\s\S]*?)\]/gu)]
  const block = ignoreBlocks.length === 1 ? ignoreBlocks[0][1] : null
  const parsed = []
  let residual = block ?? "invalid"
  if (block !== null) {
    const quotedValue = /(["'])(.*?)\1/gu
    for (const match of block.matchAll(quotedValue)) parsed.push(match[2])
    residual = block.replace(quotedValue, "").replace(/[\s,]/gu, "")
  }
  if (residual.length > 0
    || parsed.length !== expectedEslintIgnores.length
    || parsed.some((value, index) => value !== expectedEslintIgnores[index])) {
    addViolation(relativePath, 0, "ESLint ignores must equal the seven reviewed path families")
  }
}

function walk(absoluteDirectory) {
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  for (const entry of entries) {
    const absolutePath = resolve(absoluteDirectory, entry.name)
    const relativePath = normalizedRelativePath(absolutePath)
    if (isIgnoredPath(relativePath)) continue
    const status = lstatSync(absolutePath)
    if (status.isSymbolicLink()) {
      addViolation(relativePath, 0, "symbolic links are not part of the audited source tree")
      continue
    }
    if (status.isDirectory()) {
      walk(absolutePath)
      continue
    }
    if (!status.isFile() || !sourceExtensions.has(extname(entry.name))) continue
    auditedFileCount += 1
    const source = readSource(absolutePath, relativePath)
    if (source !== null) auditSource(relativePath, source)
  }
}

walk(root)
auditEslintConfig()
violations.sort((left, right) => left.path < right.path
  ? -1
  : left.path > right.path
    ? 1
    : left.line - right.line || left.message.localeCompare(right.message))

if (violations.length > 0) {
  for (const violation of violations) {
    const location = violation.line > 0 ? `${violation.path}:${violation.line}` : violation.path
    process.stderr.write(`${location}: ${violation.message}\n`)
  }
  process.exitCode = 1
} else {
  process.stdout.write(`Architecture policy passed: audited ${auditedFileCount} files.\n`)
}
