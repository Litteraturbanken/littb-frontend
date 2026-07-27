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
const expectedEslintIgnores = [
  ".nuxt/**",
  ".output/**",
  "node_modules/**",
  "app/lib/api/generated/**",
  "coverage/**",
  "playwright-report/**",
  "test-results*/**"
]
const tsIgnoreToken = ["@ts", "ignore"].join("-")
const tsExpectedErrorToken = ["@ts", "expect-error"].join("-")
const vueHtmlToken = ["v", "html"].join("-")
const domHtmlToken = ["inner", "HTML"].join("")
const assertionKeyword = ["a", "s"].join("")
const capabilityTypes = [
  "ManagedAssetHtml",
  "ManagedStyleText",
  "ManagedStylesheetHref",
  "RenderableCapability",
  "RenderableHtml",
  "SanitizedHtml"
]
const capabilityAlternation = capabilityTypes.join("|")
const reviewedCapabilityExports = [
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
const privateCapabilityConstructor = [
  "function capability<T extends RenderableCapability>(value: string): T {",
  `  return value ${assertionKeyword} T`,
  "}"
].join("\n")
const reviewedDomSignatures = new Map([
  [rendererPath, [`name !== "${domHtmlToken}"`, `${domHtmlToken}: props.html`]],
  ["app/lib/author-profile.ts", [
    `container.${domHtmlToken} = value`,
    `issueAuthorProfileHtml(container.${domHtmlToken})`
  ]],
  ["app/lib/reader-dictionary.ts", [`const html = root.${domHtmlToken}`]],
  ["app/lib/search-hit-highlight.ts", [
    `return root.${domHtmlToken}`,
    `issueReaderOcrHtml(root.${domHtmlToken})`
  ]],
  ["app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue", [
    `return root.${domHtmlToken}`
  ]],
  ["app/pages/presentationer/presentation-parser.ts", [
    `${domHtmlToken}: string`,
    `issueManagedPresentationHtml(body.${domHtmlToken})`
  ]],
  ["server/utils/author-document.ts", [
    `${domHtmlToken}: string`,
    `issueAuthorDocumentHtml(body.${domHtmlToken})`
  ]],
  ["server/utils/dramawebben-document.ts", [
    `${domHtmlToken}: string`,
    `issueDramawebbenDocumentHtml(body.${domHtmlToken})`
  ]],
  ["server/utils/editor-reader-html.ts", [
    `body: { ${domHtmlToken}: string, querySelectorAll:`,
    `const html = document.body.${domHtmlToken}`
  ]],
  ["server/utils/reader-source-info.ts", [
    `${domHtmlToken}: string`,
    `issueReaderSourceInfoHtml(body.${domHtmlToken})`,
    `return texts[0]!.${domHtmlToken}`
  ]],
  ["server/utils/sla-article.ts", [
    `${domHtmlToken}: string`,
    `issueSlaArticleHtml(body.${domHtmlToken})`
  ]]
])

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
    const code = source.charCodeAt(position)
    if (code === 13) {
      line += 1
      if (source.charCodeAt(position + 1) === 10) position += 1
    } else if (code === 10 || code === 0x2028 || code === 0x2029) {
      line += 1
    }
  }
  return line
}

function tokenIndexes(source, token) {
  const indexes = []
  let fromIndex = 0
  while (fromIndex < source.length) {
    const index = source.indexOf(token, fromIndex)
    if (index === -1) break
    indexes.push(index)
    fromIndex = index + token.length
  }
  return indexes
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

function capabilityAliases(source) {
  const aliases = new Set()
  const importRanges = []
  const importPattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["']/gu
  for (const match of source.matchAll(importPattern)) {
    importRanges.push([match.index, match.index + match[0].length])
    const aliasPattern = new RegExp(`\\b(?:${capabilityAlternation})\\s+as\\s+([A-Za-z_$][\\w$]*)`, "gu")
    for (const alias of match[1].matchAll(aliasPattern)) aliases.add(alias[1])
  }
  const typeAliases = [...source.matchAll(/\btype\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\r\n\u2028\u2029]+)/gu)]
  let addedAlias = true
  while (addedAlias) {
    addedAlias = false
    for (const match of typeAliases) {
      const rightHandSide = match[2]
      if (capabilityTypes.some(type => new RegExp(`\\b${type}\\b`, "u").test(rightHandSide))
        || [...aliases].some(alias => new RegExp(`\\b${alias}\\b`, "u").test(rightHandSide))) {
        const size = aliases.size
        aliases.add(match[1])
        if (aliases.size !== size) addedAlias = true
      }
    }
  }
  return { aliases, importRanges }
}

function hasCapabilityReference(source, aliases) {
  return capabilityTypes.some(type => new RegExp(`\\b${type}\\b`, "u").test(source))
    || [...aliases].some(alias => new RegExp(`\\b${alias}\\b`, "u").test(source))
}

function auditCapabilityAssertions(relativePath, source) {
  const { aliases, importRanges } = capabilityAliases(source)
  const genericParameters = new Set()
  const genericDeclarations = [
    /\bfunction\s+[A-Za-z_$][\w$]*\s*<([^>]+)>/gu,
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*<([^>]+)>\s*\(/gu,
    /\b(?:type|interface)\s+[A-Za-z_$][\w$]*\s*<([^>]+)>/gu
  ]
  for (const pattern of genericDeclarations) {
    for (const match of source.matchAll(pattern)) {
      for (const parameter of match[1].split(",")) {
        const name = parameter.trim().match(/^([A-Za-z_$][\w$]*)\b/u)?.[1]
        if (name !== undefined) genericParameters.add(name)
      }
    }
  }
  for (const match of source.matchAll(/\bas\b/gu)) {
    if (importRanges.some(([start, end]) => match.index >= start && match.index < end)) continue
    const end = source.slice(match.index).search(/[;\r\n\u2028\u2029]/u)
    const assertedType = source.slice(match.index + match[0].length, end === -1 ? source.length : match.index + end)
    const assertedName = assertedType.trim().match(/^([A-Za-z_$][\w$]*)\b/u)?.[1]
    const genericForgery = assertedName !== undefined
      && genericParameters.has(assertedName)
      && hasCapabilityReference(source, aliases)
    if (hasCapabilityReference(assertedType, aliases) || genericForgery) {
      addViolation(
        relativePath,
        lineNumberAt(source, match.index),
        "capability assertions are limited to the private capability helper"
      )
    }
  }

  const angleAssertionPattern = /(^|[=([{,:;!?&|]\s*)<([^\r\n\u2028\u2029]{1,500}?)>\s*(?=[A-Za-z_$"'([{])/gmu
  for (const match of source.matchAll(angleAssertionPattern)) {
    if (hasCapabilityReference(match[2], aliases)) {
      const assertionIndex = match.index + match[1].length
      addViolation(
        relativePath,
        lineNumberAt(source, assertionIndex),
        "capability assertions are limited to the private capability helper"
      )
    }
  }
}

function auditCapabilityUtility(relativePath, source) {
  const constructorCount = tokenIndexes(source, privateCapabilityConstructor).length
  const assertionCount = [...source.matchAll(/\bas\b/gu)].length
  if (constructorCount !== 1 || assertionCount !== 1) {
    addViolation(relativePath, 1, "exactly one private capability assertion is required")
  }

  if (/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*capability\b/u.test(source)) {
    addViolation(relativePath, 1, "the private capability constructor must not be aliased")
  }

  const exportFunctions = [...source.matchAll(/\bexport\s+function\s+([A-Za-z_$][\w$]*)/gu)]
  const actualExports = exportFunctions.map(match => match[1])
  const everyExport = [...source.matchAll(/\bexport\b/gu)]
  const exactSurface = actualExports.length === reviewedCapabilityExports.length
    && actualExports.every((name, index) => name === reviewedCapabilityExports[index])
    && everyExport.length === exportFunctions.length
  if (!exactSurface) {
    addViolation(relativePath, 1, "capability utility exports must equal the reviewed issuer surface")
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

function auditInlineEslintConfiguration(relativePath, source) {
  const commentPattern = /\/\*([\s\S]*?)\*\/|\/\/([^\r\n\u2028\u2029]*)/gu
  for (const match of source.matchAll(commentPattern)) {
    const body = (match[1] ?? match[2] ?? "").trim()
    if (/^(?:eslint(?:\b|-)|global\b|exported\b)/u.test(body)) {
      addViolation(
        relativePath,
        lineNumberAt(source, match.index),
        "ESLint inline configuration comments are forbidden"
      )
    }
  }
}

function auditDomHtml(relativePath, source) {
  if (!isProductionPath(relativePath) || !source.includes(domHtmlToken)) return
  const reviewedSignatures = reviewedDomSignatures.get(relativePath)
  if (reviewedSignatures === undefined) {
    addTokenViolations(relativePath, source, domHtmlToken, "DOM HTML access is not in the reviewed allowlist")
    return
  }

  const coveredRanges = []
  let cardinalityChanged = false
  for (const signature of reviewedSignatures) {
    const indexes = tokenIndexes(source, signature)
    if (indexes.length !== 1) cardinalityChanged = true
    for (const index of indexes) coveredRanges.push([index, index + signature.length])
  }
  if (cardinalityChanged) {
    addViolation(relativePath, 0, "reviewed DOM HTML signature cardinality changed")
  }
  for (const index of tokenIndexes(source, domHtmlToken)) {
    if (!coveredRanges.some(([start, end]) => index >= start && index < end)) {
      addViolation(relativePath, lineNumberAt(source, index), "DOM HTML access does not match the reviewed signature")
    }
  }
}

function auditSource(relativePath, source) {
  auditInlineEslintConfiguration(relativePath, source)
  addTokenViolations(relativePath, source, tsIgnoreToken, "TypeScript ignore comments are forbidden")
  auditExpectedErrors(relativePath, source)

  if (extname(relativePath) === ".vue") {
    addPatternViolations(
      relativePath,
      source,
      new RegExp(`\\b${vueHtmlToken}(?=\\s*(?:[.:][\\w-]+)*\\s*=)`, "gu"),
      "Vue raw-HTML directives are forbidden"
    )
  }

  auditDomHtml(relativePath, source)

  if (relativePath === capabilityPath) {
    auditCapabilityUtility(relativePath, source)
    return
  }
  auditCapabilityAssertions(relativePath, source)
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

  const propertyPattern = name => new RegExp(
    `(?:\\[\\s*["']${name}["']\\s*\\]|\\b${name}\\b)\\s*:`,
    "gu"
  )
  const rulesProperties = [...source.matchAll(propertyPattern("rules"))]
  for (const match of rulesProperties) {
    addViolation(relativePath, lineNumberAt(source, match.index), "ESLint rules overrides are forbidden")
  }

  const ignoreProperties = [...source.matchAll(propertyPattern("ignores"))]
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
    || ignoreProperties.length !== 1
    || parsed.length !== expectedEslintIgnores.length
    || parsed.some((value, index) => value !== expectedEslintIgnores[index])) {
    const index = ignoreProperties[0]?.index ?? 0
    addViolation(relativePath, lineNumberAt(source, index), "ESLint ignores must equal the seven reviewed path families")
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
