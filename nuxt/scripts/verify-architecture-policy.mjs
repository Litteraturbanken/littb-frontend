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
const tsIgnoreToken = ["@ts", "ignore"].join("-")
const tsExpectedErrorToken = ["@ts", "expect-error"].join("-")
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
const capabilityIssuers = new Set(reviewedCapabilityExports.filter(name => name.startsWith("issue")))
const knownCapabilityFields = new Set([
  "bodyHtml",
  "captionHtml",
  "href",
  "introductionHtml",
  "sourceHtml",
  "styleText",
  "textContent"
])
const reviewedDomPolicies = new Map([
  [rendererPath, {
    provenance: [],
    operations: [
      { source: `name !== "${domHtmlToken}"`, count: 1 },
      { source: `${domHtmlToken}: props.html`, count: 1 }
    ]
  }],
  ["app/lib/author-profile.ts", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "const { document } = parseHTML(", count: 1 },
      { source: "const container = document.createElement(", count: 1 }
    ],
    operations: [
      { source: `container.${domHtmlToken} = value`, count: 1 },
      { source: `issueAuthorProfileHtml(container.${domHtmlToken})`, count: 1 }
    ]
  }],
  ["app/lib/reader-dictionary.ts", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "const { document } = parseHTML(", count: 1 },
      { source: "const root = document.querySelector(", count: 1 }
    ],
    operations: [{ source: `const html = root.${domHtmlToken}`, count: 1 }]
  }],
  ["app/lib/search-hit-highlight.ts", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "const { document } = parseHTML(", count: 2 },
      { source: "const root = document.querySelector(", count: 2 }
    ],
    operations: [
      { source: `return root.${domHtmlToken}`, count: 1 },
      { source: `issueReaderOcrHtml(root.${domHtmlToken})`, count: 1 }
    ]
  }],
  ["app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "const { document } = parseHTML(", count: 1 },
      { source: "const root = document.querySelector(", count: 1 }
    ],
    operations: [{ source: `return root.${domHtmlToken}`, count: 1 }]
  }],
  ["app/pages/presentationer/presentation-parser.ts", {
    provenance: [
      { source: `import { DOMParser } from "linkedom"`, count: 1 },
      { source: "new DOMParser().parseFromString(", count: 2 },
      { source: `const body = document.querySelector("body")`, count: 1 }
    ],
    operations: [
      { source: `${domHtmlToken}: string`, count: 1 },
      { source: `issueManagedPresentationHtml(body.${domHtmlToken})`, count: 1 }
    ]
  }],
  ["server/utils/author-document.ts", {
    provenance: parsedBodyProvenance("ParsedAuthorDocument"),
    operations: [
      { source: `${domHtmlToken}: string`, count: 1 },
      { source: `issueAuthorDocumentHtml(body.${domHtmlToken})`, count: 1 }
    ]
  }],
  ["server/utils/dramawebben-document.ts", {
    provenance: parsedBodyProvenance("ParsedDramawebbenDocument"),
    operations: [
      { source: `${domHtmlToken}: string`, count: 1 },
      { source: `issueDramawebbenDocumentHtml(body.${domHtmlToken})`, count: 1 }
    ]
  }],
  ["server/utils/editor-reader-html.ts", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "const { document } = parseHTML(", count: 1 }
    ],
    operations: [
      { source: `body: { ${domHtmlToken}: string, querySelectorAll:`, count: 1 },
      { source: `const html = document.body.${domHtmlToken}`, count: 1 }
    ]
  }],
  ["server/utils/reader-source-info.ts", {
    provenance: [
      { source: `import { parseHTML } from "linkedom"`, count: 1 },
      { source: "({ document } = parseHTML(", count: 2 },
      { source: `const bodies = [...document.querySelectorAll("body")]`, count: 1 },
      { source: "const body = bodies[0]!", count: 1 },
      { source: `const texts = [...document.querySelectorAll("text")]`, count: 1 }
    ],
    operations: [
      { source: `${domHtmlToken}: string`, count: 1 },
      { source: `issueReaderSourceInfoHtml(body.${domHtmlToken})`, count: 1 },
      { source: `return texts[0]!.${domHtmlToken}`, count: 1 }
    ]
  }],
  ["server/utils/sla-article.ts", {
    provenance: parsedBodyProvenance("ParsedSlaArticle"),
    operations: [
      { source: `${domHtmlToken}: string`, count: 1 },
      { source: `issueSlaArticleHtml(body.${domHtmlToken})`, count: 1 }
    ]
  }]
])

const violations = []
let auditedFileCount = 0

function parsedBodyProvenance(parsedType) {
  return [
    { source: `import { parseHTML } from "linkedom"`, count: 1 },
    {
      source: `({ document } = parseHTML(source) ${assertionKeyword} unknown ${assertionKeyword} { document: ${parsedType} })`,
      count: 1
    },
    { source: `const bodies = [...document.querySelectorAll("body")]`, count: 1 },
    { source: "const body = bodies[0]!", count: 1 }
  ]
}

const reviewedCapabilityDeclarations = [
  `export function issueAuthorProfileHtml(value: string): SanitizedHtml<"author-profile"> {`,
  `export function issueAuthorDocumentHtml(value: string): SanitizedHtml<"author-document"> {`,
  `export function issueDramawebbenDocumentHtml(value: string): SanitizedHtml<"dramawebben-document"> {`,
  `export function issueSlaArticleHtml(value: string): SanitizedHtml<"sla-article"> {`,
  `export function issueDictionaryArticleHtml(value: string): SanitizedHtml<"dictionary-article"> {`,
  `export function issueReaderOcrHtml(value: string): SanitizedHtml<"reader-ocr"> {`,
  `export function issueReaderSourceInfoHtml(value: string): SanitizedHtml<"reader-source-info"> {`,
  `export function issueEditorEtextHtml(value: string): SanitizedHtml<"editor-etext"> {`,
  `export function issueManagedReaderHtml(value: string): ManagedAssetHtml<"reader-etext"> {`,
  `export function issueManagedHomeHtml(value: string): ManagedAssetHtml<"home-editorial"> {`,
  `export function issueManagedAboutHtml(value: string): ManagedAssetHtml<"about-editorial"> {`,
  `export function issueManagedPresentationHtml(value: string): ManagedAssetHtml<"presentation-editorial"> {`,
  `export function issueManagedPresentationStyle(value: string): ManagedStyleText<"presentation-editorial"> {`,
  `export function issueManagedPresentationStylesheetHref(value: string): ManagedStylesheetHref<"presentation-editorial"> {`,
  `export function emptyRenderableHtml<Value extends RenderableHtml>(): Value {`,
  `export function joinReaderSourceRows(values: readonly SanitizedHtml<"reader-source-info">[]): SanitizedHtml<"reader-source-info"> {`,
  `export function transformManagedReaderHtml(value: ManagedAssetHtml<"reader-etext">, transform: (value: string) => string): ManagedAssetHtml<"reader-etext"> {`
]
const reviewedCapabilityCalls = [
  `capability<SanitizedHtml<"author-profile">>(value)`,
  `capability<SanitizedHtml<"author-document">>(value)`,
  `capability<SanitizedHtml<"dramawebben-document">>(value)`,
  `capability<SanitizedHtml<"sla-article">>(value)`,
  `capability<SanitizedHtml<"dictionary-article">>(value)`,
  `capability<SanitizedHtml<"reader-ocr">>(value)`,
  `capability<SanitizedHtml<"reader-source-info">>(value)`,
  `capability<SanitizedHtml<"editor-etext">>(value)`,
  `capability<ManagedAssetHtml<"reader-etext">>(value)`,
  `capability<ManagedAssetHtml<"home-editorial">>(value)`,
  `capability<ManagedAssetHtml<"about-editorial">>(value)`,
  `capability<ManagedAssetHtml<"presentation-editorial">>(value)`,
  `capability<ManagedStyleText<"presentation-editorial">>(value)`,
  `capability<ManagedStylesheetHref<"presentation-editorial">>(value)`,
  `capability<Value>("")`,
  `capability<SanitizedHtml<"reader-source-info">>(values.join("<br>"))`,
  `capability<ManagedAssetHtml<"reader-etext">>(transform(value))`
]

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

function isLineTerminator(character) {
  return character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
}

function canStartRegularExpression(tokens) {
  const previous = tokens.at(-1)?.value
  return previous === undefined || [
    "(", "[", "{", ",", ":", ";", "=", "!", "?", "&", "|", ">",
    "case", "delete", "else", "in", "instanceof", "new", "return", "throw", "typeof", "void", "yield"
  ].includes(previous)
}

function regularExpressionEnd(source, start) {
  let index = start + 1
  let inCharacterClass = false
  while (index < source.length && !isLineTerminator(source[index])) {
    if (source[index] === "\\") {
      index += 2
      continue
    }
    if (source[index] === "[") inCharacterClass = true
    else if (source[index] === "]") inCharacterClass = false
    else if (source[index] === "/" && !inCharacterClass) {
      index += 1
      while (index < source.length && /[A-Za-z]/u.test(source[index])) index += 1
      return index
    }
    index += 1
  }
  return null
}

function lexSource(source) {
  const tokens = []
  const comments = []
  let index = 0
  const pushToken = (start, end, kind = "punctuator") => {
    tokens.push({ value: source.slice(start, end), start, end, kind })
  }
  while (index < source.length) {
    const character = source[index]
    if (/\s/u.test(character)) {
      index += 1
      continue
    }
    if (source.startsWith("//", index)) {
      const start = index
      const bodyStart = index + 2
      index = bodyStart
      while (index < source.length && !isLineTerminator(source[index])) index += 1
      comments.push({ start, body: source.slice(bodyStart, index) })
      continue
    }
    if (source.startsWith("/*", index)) {
      const start = index
      const bodyStart = index + 2
      const close = source.indexOf("*/", bodyStart)
      index = close === -1 ? source.length : close + 2
      comments.push({ start, body: source.slice(bodyStart, close === -1 ? source.length : close) })
      continue
    }
    if (source.startsWith("<!--", index)) {
      const start = index
      const bodyStart = index + 4
      const close = source.indexOf("-->", bodyStart)
      index = close === -1 ? source.length : close + 3
      comments.push({ start, body: source.slice(bodyStart, close === -1 ? source.length : close) })
      continue
    }
    if (character === "/" && canStartRegularExpression(tokens)) {
      const end = regularExpressionEnd(source, index)
      if (end !== null) {
        pushToken(index, end, "regexp")
        index = end
        continue
      }
    }
    if (character === "\"" || character === "'" || character === "`") {
      const start = index
      const quote = character
      index += 1
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2
          continue
        }
        if (source[index] === quote) {
          index += 1
          break
        }
        index += 1
      }
      pushToken(start, index, quote === "`" ? "template" : "string")
      continue
    }
    if (/[A-Za-z_$]/u.test(character)) {
      const start = index
      index += 1
      while (index < source.length && /[A-Za-z0-9_$]/u.test(source[index])) index += 1
      pushToken(start, index, "identifier")
      continue
    }
    if (/[0-9]/u.test(character)) {
      const start = index
      index += 1
      while (index < source.length && /[0-9A-Za-z_.]/u.test(source[index])) index += 1
      pushToken(start, index, "number")
      continue
    }
    pushToken(index, index + 1)
    index += 1
  }
  return { tokens, comments }
}

function sequenceValues(source) {
  return lexSource(source).tokens.map(token => token.value)
}

function sequenceMatches(tokens, source) {
  const expected = sequenceValues(source)
  const matches = []
  if (expected.length === 0) return matches
  for (let start = 0; start <= tokens.length - expected.length; start += 1) {
    if (expected.every((value, offset) => tokens[start + offset].value === value)) {
      matches.push({ start, end: start + expected.length })
    }
  }
  return matches
}

function importAliasIndexes(tokens) {
  const indexes = new Set()
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "import" || tokens[index + 1]?.value === "(") continue
    let cursor = index + 1
    while (cursor < tokens.length && tokens[cursor].value !== "from" && tokens[cursor].value !== ";") {
      if (tokens[cursor].value === assertionKeyword) indexes.add(cursor)
      cursor += 1
    }
  }
  return indexes
}

function statementTokens(tokens, equalsIndex) {
  const values = []
  let depth = 0
  const startLine = lineNumberAtToken(tokens[equalsIndex])
  for (let index = equalsIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value
    const previous = values.at(-1)?.value
    const lineContinuation = ["&", "|", ".", "?", "[", "<"].includes(value)
      || ["&", "|", ".", "?", "[", "<", "extends", "keyof", "readonly", "typeof"].includes(previous)
    if (depth === 0 && (value === ";" || (values.length > 0
      && lineNumberAtToken(tokens[index]) > startLine
      && !lineContinuation))) break
    if (["(", "[", "{", "<"].includes(value)) depth += 1
    if ([")", "]", "}", ">"].includes(value) && depth > 0) depth -= 1
    values.push(tokens[index])
  }
  return values
}

function lineNumberAtToken(token) {
  return token.line ?? 1
}

function enrichTokenLines(source, tokens) {
  let line = 1
  let position = 0
  for (const token of tokens) {
    while (position < token.start) {
      const code = source.charCodeAt(position)
      if (code === 13) {
        line += 1
        if (source.charCodeAt(position + 1) === 10) position += 1
      } else if (code === 10 || code === 0x2028 || code === 0x2029) {
        line += 1
      }
      position += 1
    }
    token.line = line
  }
}

function hasTaintedType(tokens, aliases, values, genericParameters = new Set()) {
  const identifiers = new Set(tokens.filter(token => token.kind === "identifier").map(token => token.value))
  if (capabilityTypes.some(type => identifiers.has(type))) return true
  if ([...aliases].some(alias => identifiers.has(alias))) return true
  if ([...values].some(value => identifiers.has(value))) return true
  if ([...capabilityIssuers].some(issuer => identifiers.has(issuer))) return true
  if (tokens.some(token => token.value === "[")
    && tokens.some(token => knownCapabilityFields.has(token.value) || knownCapabilityFields.has(literalText(token)))) {
    return true
  }
  return [...genericParameters].some(parameter => identifiers.has(parameter))
}

function capabilityTaint(tokens) {
  const aliases = new Set()
  const values = new Set()
  const importAliases = importAliasIndexes(tokens)
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if ((capabilityTypes.includes(tokens[index].value) || capabilityIssuers.has(tokens[index].value))
      && tokens[index + 1].value === assertionKeyword
      && tokens[index + 2].kind === "identifier") {
      aliases.add(tokens[index + 2].value)
    }
  }
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (!["const", "let", "var"].includes(tokens[index].value)
      || tokens[index + 1].kind !== "identifier"
      || tokens[index + 2].value !== "=") continue
    const assigned = statementTokens(tokens, index + 2)
    if (assigned.some(token => capabilityIssuers.has(token.value))) values.add(tokens[index + 1].value)
  }
  const typeAliases = []
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (tokens[index].value !== "type"
      || tokens[index + 1].kind !== "identifier"
      || tokens[index + 2].value !== "=") continue
    typeAliases.push({ name: tokens[index + 1].value, rightHandSide: statementTokens(tokens, index + 2) })
  }
  let changed = true
  while (changed) {
    changed = false
    for (const alias of typeAliases) {
      if (!aliases.has(alias.name) && hasTaintedType(alias.rightHandSide, aliases, values)) {
        aliases.add(alias.name)
        changed = true
      }
    }
  }
  return { aliases, values, importAliases }
}

function genericParameters(tokens) {
  const parameters = new Set()
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "<") continue
    const declaredFunction = tokens[index - 2]?.value === "function"
      && tokens[index - 1]?.kind === "identifier"
    const declaredAnonymousFunction = tokens[index - 1]?.value === "function"
    const declaredArrow = tokens[index - 1]?.value === "="
      || (tokens[index - 1]?.value === "async" && tokens[index - 2]?.value === "=")
    if (!declaredFunction && !declaredAnonymousFunction && !declaredArrow) continue
    let depth = 1
    let end = index + 1
    while (end < tokens.length && depth > 0) {
      if (tokens[end].value === "<") depth += 1
      if (tokens[end].value === ">") depth -= 1
      end += 1
    }
    if (depth !== 0 || tokens[end]?.value !== "(") continue
    for (const token of tokens.slice(index + 1, end - 1)) {
      if (token.kind === "identifier" && /^[A-Z][A-Za-z0-9_$]*$/u.test(token.value)) {
        parameters.add(token.value)
        break
      }
    }
  }
  return parameters
}

function assertedTypeTokens(tokens, assertionIndex) {
  const asserted = []
  let depth = 0
  let latestLine = lineNumberAtToken(tokens[assertionIndex])
  for (let index = assertionIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value
    const previous = asserted.at(-1)?.value
    const lineContinuation = ["&", "|", ".", "?", "[", "<"].includes(value)
      || ["&", "|", ".", "?", "[", "<", "extends", "keyof", "readonly", "typeof"].includes(previous)
    if (depth === 0 && ([";", "=", ",", "}", ")", "]", assertionKeyword].includes(value)
      || (asserted.length > 0 && lineNumberAtToken(tokens[index]) > latestLine && !lineContinuation))) break
    if (["(", "[", "{", "<"].includes(value)) depth += 1
    if ([")", "]", "}", ">"].includes(value) && depth > 0) depth -= 1
    asserted.push(tokens[index])
    latestLine = lineNumberAtToken(tokens[index])
  }
  return asserted
}

function auditCapabilityAssertions(relativePath, source, lexical) {
  const { tokens } = lexical
  const { aliases, values, importAliases } = capabilityTaint(tokens)
  const generics = genericParameters(tokens)
  const sourceCarriesCapability = hasTaintedType(tokens, aliases, values)
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== assertionKeyword
      || importAliases.has(index)
      || tokens[index + 1]?.value === ":") continue
    const asserted = assertedTypeTokens(tokens, index)
    const genericForgery = sourceCarriesCapability && hasTaintedType(asserted, new Set(), new Set(), generics)
    if (hasTaintedType(asserted, aliases, values) || genericForgery) {
      addViolation(
        relativePath,
        lineNumberAt(source, tokens[index].start),
        "capability assertions are limited to the private capability helper"
      )
    }
  }

  const allowedBefore = new Set(["=", "(", "[", "{", ",", ":", "return", "=>"])
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "<" || !allowedBefore.has(tokens[index - 1]?.value ?? "=")) continue
    let depth = 1
    let end = index + 1
    while (end < tokens.length && depth > 0) {
      if (tokens[end].value === "<") depth += 1
      if (tokens[end].value === ">") depth -= 1
      end += 1
    }
    if (depth !== 0 || tokens[end]?.value === "(" || tokens[end]?.value === "=>") continue
    if (hasTaintedType(tokens.slice(index + 1, end - 1), aliases, values)) {
      addViolation(
        relativePath,
        lineNumberAt(source, tokens[index].start),
        "capability assertions are limited to the private capability helper"
      )
    }
  }
}

function auditCapabilityUtility(relativePath, source, lexical) {
  const { tokens } = lexical
  const exportNames = []
  let exportCount = 0
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "export") continue
    exportCount += 1
    if (tokens[index + 1]?.value === "function") exportNames.push(tokens[index + 2]?.value)
  }
  const aliasIndexes = importAliasIndexes(tokens)
  const assertionCount = tokens.filter((token, index) => token.value === assertionKeyword && !aliasIndexes.has(index)).length
  const constructor = `function capability<T extends RenderableCapability>(value: string): T { return value ${assertionKeyword} T }`
  const structuralSurfaceMatches = sequenceMatches(tokens, constructor).length === 1
    && assertionCount === 1
    && exportCount === reviewedCapabilityExports.length
    && exportNames.length === reviewedCapabilityExports.length
    && exportNames.every((name, index) => name === reviewedCapabilityExports[index])
    && reviewedCapabilityDeclarations.every(declaration => sequenceMatches(tokens, declaration).length === 1)
    && reviewedCapabilityCalls.every(call => sequenceMatches(tokens, call).length === 1)
    && tokens.filter(token => token.value === "capability").length === reviewedCapabilityCalls.length + 1
  if (!structuralSurfaceMatches) {
    addViolation(relativePath, 1, "capability utility must equal the reviewed structural surface")
  }
}

function auditTypeScriptDirectives(relativePath, source, comments) {
  for (const comment of comments) {
    const ignoreIndex = comment.body.indexOf(tsIgnoreToken)
    if (ignoreIndex !== -1) {
      addViolation(relativePath, lineNumberAt(source, comment.start), "TypeScript ignore comments are forbidden")
    }
    const index = comment.body.indexOf(tsExpectedErrorToken)
    if (index === -1) continue
    const line = lineNumberAt(source, comment.start)
    if (!contractAllowlist.has(relativePath)) {
      addViolation(relativePath, line, "expected-error directives are limited to compile contracts")
    }
    const suffix = comment.body
      .slice(index + tsExpectedErrorToken.length)
      .split(/[\r\n\u2028\u2029]/u, 1)[0]
      .trim()
    if (suffix.length === 0) {
      addViolation(relativePath, line, "expected-error directives require a description")
    }
  }
}

function auditInlineEslintConfiguration(relativePath, source, comments) {
  for (const comment of comments) {
    const body = comment.body.trim().replace(/^\*+\s*/u, "")
    if (/^(?:eslint(?:\b|-)|global\b|exported\b)/u.test(body)) {
      addViolation(
        relativePath,
        lineNumberAt(source, comment.start),
        "ESLint inline configuration comments are forbidden"
      )
    }
  }
}

function literalText(token) {
  if (token?.kind === "template") {
    const value = token.value.slice(1, -1)
    return value.includes("${") ? null : value
  }
  if (token?.kind !== "string") return null
  if (token.value.startsWith("\"")) {
    try {
      return JSON.parse(token.value)
    } catch {
      return null
    }
  }
  return token.value.slice(1, -1).replace(/\\'/gu, "'").replace(/\\\\/gu, "\\")
}

function auditComputedDomHtml(relativePath, source, tokens) {
  const violationStarts = new Set()
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (literalText(tokens[index]) === "inner"
      && tokens[index + 1].value === "+"
      && literalText(tokens[index + 2]) === "HTML") {
      violationStarts.add(tokens[index].start)
    }
    if (tokens[index].value !== "[") continue
    let cursor = index + 1
    const pieces = []
    while (cursor < tokens.length && tokens[cursor].value !== "]" && pieces.length < 12) {
      pieces.push(tokens[cursor])
      cursor += 1
    }
    if (tokens[cursor]?.value !== "]") continue
    const isStatic = pieces.length > 0 && pieces.every((token, offset) => offset % 2 === 0
      ? literalText(token) !== null
      : token.value === "+")
    if (isStatic && pieces.filter((_token, offset) => offset % 2 === 0)
      .map(token => literalText(token)).join("") === domHtmlToken) {
      violationStarts.add(tokens[index].start)
    }
  }
  for (const start of [...violationStarts].sort((left, right) => left - right)) {
    addViolation(relativePath, lineNumberAt(source, start), "computed DOM HTML access is forbidden")
  }
}

function auditVueDirectives(relativePath, source, tokens) {
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (tokens[index].value === "v"
      && tokens[index + 1].value === "-"
      && tokens[index + 2].value === "html") {
      addViolation(relativePath, lineNumberAt(source, tokens[index].start), "Vue raw-HTML directives are forbidden")
    }
    if (tokens[index].value === ":"
      && tokens[index + 1].value === "["
      && tokens[index].end === tokens[index + 1].start) {
      addViolation(relativePath, lineNumberAt(source, tokens[index].start), "dynamic Vue argument bindings are forbidden")
    }
  }
}

function auditDomHtml(relativePath, source, tokens) {
  if (!isProductionPath(relativePath)) return
  const reviewed = reviewedDomPolicies.get(relativePath)
  if (reviewed === undefined) {
    for (const token of tokens.filter(token => token.value === domHtmlToken)) {
      addViolation(relativePath, lineNumberAt(source, token.start), "DOM HTML access is not in the reviewed allowlist")
    }
    return
  }

  if (reviewed.provenance.some(operation => sequenceMatches(tokens, operation.source).length !== operation.count)) {
    addViolation(relativePath, 0, "reviewed detached DOM provenance changed")
  }
  const coveredTokenIndexes = new Set()
  let cardinalityChanged = false
  for (const operation of reviewed.operations) {
    const matches = sequenceMatches(tokens, operation.source)
    if (matches.length !== operation.count) cardinalityChanged = true
    for (const match of matches) {
      for (let index = match.start; index < match.end; index += 1) coveredTokenIndexes.add(index)
    }
  }
  if (cardinalityChanged) addViolation(relativePath, 0, "reviewed DOM HTML signature cardinality changed")
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === domHtmlToken && !coveredTokenIndexes.has(index)) {
      addViolation(relativePath, lineNumberAt(source, tokens[index].start), "DOM HTML access does not match the reviewed signature")
    }
  }
}

function auditSource(relativePath, source) {
  const lexical = lexSource(source)
  enrichTokenLines(source, lexical.tokens)
  auditInlineEslintConfiguration(relativePath, source, lexical.comments)
  auditTypeScriptDirectives(relativePath, source, lexical.comments)
  auditComputedDomHtml(relativePath, source, lexical.tokens)
  if (extname(relativePath) === ".vue") auditVueDirectives(relativePath, source, lexical.tokens)
  auditDomHtml(relativePath, source, lexical.tokens)

  if (relativePath === capabilityPath) {
    auditCapabilityUtility(relativePath, source, lexical)
    return
  }
  auditCapabilityAssertions(relativePath, source, lexical)
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

  if (source !== canonicalEslintConfig) {
    addViolation(relativePath, 1, "ESLint configuration must equal the canonical reviewed file")
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
