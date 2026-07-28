import { lstatSync, readFileSync, readdirSync } from "node:fs"
import { dirname, extname, relative, resolve, sep } from "node:path"

import { ElementTypes, NodeTypes, parse as parseVueTemplate } from "@vue/compiler-dom"
import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

const root = resolve(process.argv[2] ?? process.cwd())
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"])
const capabilityPath = "shared/utils/renderable-html.ts"
const rendererPath = "app/components/global/RenderableHtmlContent.vue"
const contractAllowlist = new Set([
  "test/nuxt/author-works-contract.ts",
  "test/nuxt/reader-source-info-contract.ts",
  "test/nuxt/renderable-html-contract.ts"
])
const rootOutputDirectories = new Set([
  ".nuxt",
  ".output",
  "coverage",
  "false",
  "node_modules",
  "playwright-report"
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
const canonicalCapabilitySource = `import type { ManagedAssetHtml, ManagedStyleText, ManagedStylesheetHref, RenderableCapability, RenderableHtml, SanitizedHtml } from "../types/renderable-html"
function capability<T extends RenderableCapability>(value: string): T { return value as T }
export function issueAuthorProfileHtml(value: string): SanitizedHtml<"author-profile"> { return capability<SanitizedHtml<"author-profile">>(value) }
export function issueAuthorDocumentHtml(value: string): SanitizedHtml<"author-document"> { return capability<SanitizedHtml<"author-document">>(value) }
export function issueDramawebbenDocumentHtml(value: string): SanitizedHtml<"dramawebben-document"> { return capability<SanitizedHtml<"dramawebben-document">>(value) }
export function issueSlaArticleHtml(value: string): SanitizedHtml<"sla-article"> { return capability<SanitizedHtml<"sla-article">>(value) }
export function issueDictionaryArticleHtml(value: string): SanitizedHtml<"dictionary-article"> { return capability<SanitizedHtml<"dictionary-article">>(value) }
export function issueReaderOcrHtml(value: string): SanitizedHtml<"reader-ocr"> { return capability<SanitizedHtml<"reader-ocr">>(value) }
export function issueReaderSourceInfoHtml(value: string): SanitizedHtml<"reader-source-info"> { return capability<SanitizedHtml<"reader-source-info">>(value) }
export function issueEditorEtextHtml(value: string): SanitizedHtml<"editor-etext"> { return capability<SanitizedHtml<"editor-etext">>(value) }
export function issueManagedReaderHtml(value: string): ManagedAssetHtml<"reader-etext"> { return capability<ManagedAssetHtml<"reader-etext">>(value) }
export function issueManagedHomeHtml(value: string): ManagedAssetHtml<"home-editorial"> { return capability<ManagedAssetHtml<"home-editorial">>(value) }
export function issueManagedAboutHtml(value: string): ManagedAssetHtml<"about-editorial"> { return capability<ManagedAssetHtml<"about-editorial">>(value) }
export function issueManagedPresentationHtml(value: string): ManagedAssetHtml<"presentation-editorial"> { return capability<ManagedAssetHtml<"presentation-editorial">>(value) }
export function issueManagedPresentationStyle(value: string): ManagedStyleText<"presentation-editorial"> { return capability<ManagedStyleText<"presentation-editorial">>(value) }
export function issueManagedPresentationStylesheetHref(value: string): ManagedStylesheetHref<"presentation-editorial"> { return capability<ManagedStylesheetHref<"presentation-editorial">>(value) }
export function emptyRenderableHtml<Value extends RenderableHtml>(): Value { return capability<Value>("") }
export function joinReaderSourceRows(values: readonly SanitizedHtml<"reader-source-info">[]): SanitizedHtml<"reader-source-info"> { return capability<SanitizedHtml<"reader-source-info">>(values.join("<br>")) }
export function transformManagedReaderHtml(value: ManagedAssetHtml<"reader-etext">, transform: (value: string) => string): ManagedAssetHtml<"reader-etext"> { return capability<ManagedAssetHtml<"reader-etext">>(transform(value)) }
`
const capabilityTypes = new Set([
  "ManagedAssetHtml",
  "ManagedStyleText",
  "ManagedStylesheetHref",
  "RenderableCapability",
  "RenderableHtml",
  "SanitizedHtml"
])
const capabilityIssuers = new Set([
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
  "issueManagedPresentationStylesheetHref"
])
const reviewedDomPolicies = new Map([
  [rendererPath, [
    { kind: "object", value: "props.html", count: 1 }
  ]],
  ["app/lib/author-profile.ts", [
    { functionName: "sanitizeAuthorHtml", kind: "write", base: "container", count: 1 },
    { functionName: "sanitizeAuthorHtml", kind: "read", base: "container", issuer: "issueAuthorProfileHtml", count: 1 }
  ]],
  ["app/lib/reader-dictionary.ts", [
    { functionName: "sanitizeDictionaryArticle", kind: "read", base: "root", count: 1 }
  ]],
  ["app/lib/search-hit-highlight.ts", [
    { functionName: "markSimpleContiguousWords", kind: "read", base: "root", count: 1 },
    { functionName: "markReaderSearchOcrHtml", kind: "read", base: "root", issuer: "issueReaderOcrHtml", count: 1 }
  ]],
  ["app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue", [
    { functionName: "markReaderHtml", kind: "read", base: "root", count: 1 }
  ]],
  ["app/pages/presentationer/presentation-parser.ts", [
    { functionName: "parsePresentationDocument", kind: "read", base: "body", issuer: "issueManagedPresentationHtml", count: 1 }
  ]],
  ["server/utils/author-document.ts", [
    { functionName: "parseAuthorDocumentBody", kind: "read", base: "body", issuer: "issueAuthorDocumentHtml", count: 1 }
  ]],
  ["server/utils/dramawebben-document.ts", [
    { functionName: "parseDramawebbenDocumentBody", kind: "read", base: "body", issuer: "issueDramawebbenDocumentHtml", count: 1 }
  ]],
  ["server/utils/editor-reader-html.ts", [
    { functionName: "sanitizeEditorEtextHtml", kind: "read", base: "document", count: 1 }
  ]],
  ["server/utils/reader-source-info.ts", [
    { functionName: "sanitizeReaderSourceInfoHtml", kind: "read", base: "body", issuer: "issueReaderSourceInfoHtml", count: 1 },
    { functionName: "unwrapLicenseText", kind: "read", base: "texts", count: 1 }
  ]],
  ["server/utils/sla-article.ts", [
    { functionName: "parseSlaArticleBody", kind: "read", base: "body", issuer: "issueSlaArticleHtml", count: 1 }
  ]]
])

const violations = []
const violationKeys = new Set()
const sourceRecords = []
const lineStartsBySource = new Map()
let auditedFileCount = 0

function normalizedRelativePath(absolutePath) {
  return relative(root, absolutePath).split(sep).join("/")
}

function isIgnoredPath(relativePath) {
  const [first] = relativePath.split("/")
  if (rootOutputDirectories.has(first) || first.startsWith("test-results")) return true
  return relativePath === "app/lib/api/generated"
    || relativePath.startsWith("app/lib/api/generated/")
}

function isProductionPath(relativePath) {
  return relativePath.startsWith("app/")
    || relativePath.startsWith("server/")
    || relativePath.startsWith("shared/")
}

function addViolation(path, line, message) {
  const key = `${path}\0${line}\0${message}`
  if (violationKeys.has(key)) return
  violationKeys.add(key)
  violations.push({ path, line, message })
}

function lineNumberAt(source, index) {
  let lineStarts = lineStartsBySource.get(source)
  if (!lineStarts) {
    lineStarts = [0]
    for (let position = 0; position < source.length; position += 1) {
      const code = source.charCodeAt(position)
      if (code === 13) {
        if (source.charCodeAt(position + 1) === 10) position += 1
        lineStarts.push(position + 1)
      } else if (code === 10 || code === 0x2028 || code === 0x2029) {
        lineStarts.push(position + 1)
      }
    }
    lineStartsBySource.set(source, lineStarts)
  }
  let lower = 0
  let upper = lineStarts.length
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (lineStarts[middle] <= index) lower = middle + 1
    else upper = middle
  }
  return lower
}

function scriptKindFor(relativePath, language) {
  if (language === "tsx" || extname(relativePath) === ".tsx") return ts.ScriptKind.TSX
  if (language === "jsx" || extname(relativePath) === ".jsx") return ts.ScriptKind.JSX
  if (language === "js" || [".cjs", ".js", ".mjs"].includes(extname(relativePath))) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function paddedSource(source, start, content) {
  return source.slice(0, start).replace(/[^\r\n\u2028\u2029]/g, " ") + content
}

function createScriptUnit(record, content, start, language, kind = "script") {
  const text = start === 0 && content === record.source
    ? content
    : paddedSource(record.source, start, content)
  const scriptKind = scriptKindFor(record.relativePath, language)
  return {
    kind,
    record,
    commentSource: content,
    commentOffset: start,
    sourceFile: ts.createSourceFile(
      record.relativePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    ),
    scriptKind
  }
}

function collectTemplateExpressions(node, templateStart, expressions, comments) {
  if (node.type === NodeTypes.COMMENT) {
    comments.push({
      body: node.content,
      start: templateStart + node.loc.start.offset
    })
  }
  if (node.type === NodeTypes.INTERPOLATION) {
    expressions.push(node.content)
  }
  if (node.type === NodeTypes.ELEMENT) {
    for (const property of node.props) {
      if (property.type !== NodeTypes.DIRECTIVE) continue
      if (property.exp) expressions.push(property.exp)
      if (property.arg && !property.arg.isStatic) expressions.push(property.arg)
    }
  }
  for (const child of node.children ?? []) {
    collectTemplateExpressions(child, templateStart, expressions, comments)
  }
}

function parseVueRecord(record) {
  const parsed = parseVueSfc(record.source, { filename: record.relativePath })
  const scripts = [parsed.descriptor.script, parsed.descriptor.scriptSetup].filter(Boolean)
  for (const block of scripts) {
    record.units.push(createScriptUnit(
      record,
      block.content,
      block.loc.start.offset,
      block.lang
    ))
  }

  const templateBlock = parsed.descriptor.template
  const templateContent = templateBlock?.content ?? (scripts.length === 0 ? record.source : null)
  if (templateContent === null) return
  const templateStart = templateBlock?.loc.start.offset ?? 0
  const templateAst = parseVueTemplate(templateContent, {
    comments: true,
    onError: () => {}
  })
  record.template = { ast: templateAst, start: templateStart }
  const expressions = []
  collectTemplateExpressions(templateAst, templateStart, expressions, record.htmlComments)
  const seen = new Set()
  for (const expression of expressions) {
    const start = templateStart + expression.loc.start.offset
    const key = `${start}\0${expression.content}`
    if (seen.has(key) || !expression.content.trim()) continue
    seen.add(key)
    record.units.push(createScriptUnit(
      record,
      expression.content,
      start,
      "ts",
      "template-expression"
    ))
  }
}

function parseRecord(record) {
  if (extname(record.relativePath) === ".vue") {
    parseVueRecord(record)
  } else {
    record.units.push(createScriptUnit(record, record.source, 0))
  }
}

function commentBody(tokenText) {
  if (tokenText.startsWith("//")) return tokenText.slice(2)
  if (tokenText.startsWith("/*")) return tokenText.slice(2, -2)
  return tokenText
}

function extractScriptComments(unit) {
  const languageVariant = [ts.ScriptKind.JSX, ts.ScriptKind.TSX].includes(unit.scriptKind)
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    languageVariant,
    unit.commentSource
  )
  const comments = []
  let token = scanner.scan()
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia
      || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      comments.push({
        body: commentBody(scanner.getTokenText()),
        start: unit.commentOffset + scanner.getTokenPos()
      })
    }
    token = scanner.scan()
  }
  return comments
}

function auditComments(record) {
  const comments = [
    ...record.htmlComments,
    ...record.units.flatMap(extractScriptComments)
  ].sort((left, right) => left.start - right.start)
  for (const comment of comments) {
    const body = comment.body.trim().replace(/^\*+\s*/u, "")
    const line = lineNumberAt(record.source, comment.start)
    if (/^(?:eslint(?:\b|-)|global\b|exported\b)/u.test(body)) {
      addViolation(record.relativePath, line, "ESLint inline configuration comments are forbidden")
    }
    const ignoreIndex = comment.body.indexOf("@ts-ignore")
    if (ignoreIndex !== -1) {
      addViolation(record.relativePath, line, "TypeScript ignore comments are forbidden")
    }
    const expectedErrorIndex = comment.body.indexOf("@ts-expect-error")
    if (expectedErrorIndex === -1) continue
    if (!contractAllowlist.has(record.relativePath)) {
      addViolation(record.relativePath, line, "expected-error directives are limited to compile contracts")
    }
    const suffix = comment.body
      .slice(expectedErrorIndex + "@ts-expect-error".length)
      .split(/[\r\n\u2028\u2029]/u, 1)[0]
      .trim()
    if (suffix.length === 0) {
      addViolation(record.relativePath, line, "expected-error directives require a description")
    }
  }
}

function visitAst(node, callback) {
  callback(node)
  ts.forEachChild(node, child => visitAst(child, callback))
}

function unwrapExpression(node) {
  let current = node
  while (current && (
    ts.isAsExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isTypeAssertionExpression(current)
  )) current = current.expression
  return current
}

function propertyNameText(name, unit, semantic, atNode) {
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name)) return constantString(name.expression, unit, semantic, atNode)
  return null
}

function lexicalScope(node) {
  let current = node.parent
  while (current) {
    if (ts.isSourceFile(current) || ts.isBlock(current) || ts.isCaseBlock(current)
      || ts.isFunctionLike(current)) return current
    current = current.parent
  }
  return node.getSourceFile()
}

function scopeChain(node) {
  const scopes = []
  let current = node
  while (current) {
    if (ts.isSourceFile(current) || ts.isBlock(current) || ts.isCaseBlock(current)
      || ts.isFunctionLike(current)) scopes.push(current)
    current = current.parent
  }
  return scopes
}

function bindingIdentifiers(name, output = []) {
  if (ts.isIdentifier(name)) output.push(name)
  else for (const element of name.elements) {
    if (ts.isBindingElement(element)) bindingIdentifiers(element.name, output)
  }
  return output
}

function assignedIdentifiers(left, output = []) {
  const expression = unwrapExpression(left)
  if (ts.isIdentifier(expression)) output.push(expression)
  else if (ts.isObjectLiteralExpression(expression)) {
    for (const property of expression.properties) {
      if (ts.isShorthandPropertyAssignment(property)) output.push(property.name)
      else if (ts.isPropertyAssignment(property)) assignedIdentifiers(property.initializer, output)
    }
  } else if (ts.isArrayLiteralExpression(expression)) {
    for (const element of expression.elements) assignedIdentifiers(element, output)
  }
  return output
}

function assignedProperty(left, name) {
  const expression = unwrapExpression(left)
  if (!ts.isObjectLiteralExpression(expression)) return null
  for (const property of expression.properties) {
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) return name
    if (ts.isPropertyAssignment(property)) {
      const identifiers = assignedIdentifiers(property.initializer)
      if (identifiers.some(identifier => identifier.text === name)) {
        return ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : name
      }
    }
  }
  return null
}

function buildSemantic(unit) {
  const declarations = new Map()
  const assignments = []
  const registerDeclaration = (identifier, node) => {
    const entries = declarations.get(identifier.text) ?? []
    entries.push({ identifier, node, scope: lexicalScope(node) })
    declarations.set(identifier.text, entries)
  }
  visitAst(unit.sourceFile, node => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node))
      && ts.isIdentifier(node.name)) {
      for (const identifier of bindingIdentifiers(node.name)) {
        registerDeclaration(identifier, node)
      }
    }
    if (ts.isBindingElement(node)) {
      for (const identifier of bindingIdentifiers(node.name)) {
        registerDeclaration(identifier, node)
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) registerDeclaration(node.name, node)
    if (ts.isClassDeclaration(node) && node.name) registerDeclaration(node.name, node)
    if (ts.isImportSpecifier(node)) registerDeclaration(node.name, node)
    if (ts.isNamespaceImport(node)) registerDeclaration(node.name, node)
    if (ts.isImportClause(node) && node.name) registerDeclaration(node.name, node)
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      for (const identifier of assignedIdentifiers(node.left)) {
        assignments.push({ identifier, node, name: identifier.text })
      }
    }
  })
  return { assignments, declarations }
}

function importedBinding(localName, unit, semantic, atNode) {
  const entry = resolveDeclaration(localName, atNode, semantic)
  if (!entry || !ts.isImportSpecifier(entry.node)) return null
  const declaration = entry.node.parent.parent.parent
  if (!ts.isImportDeclaration(declaration)
    || !ts.isStringLiteralLike(declaration.moduleSpecifier)) return null
  return {
    importedName: entry.node.propertyName?.text ?? entry.node.name.text,
    moduleSpecifier: declaration.moduleSpecifier.text
  }
}

function isTrustedLinkedomBinding(localName, importedName, unit, semantic, atNode) {
  const binding = importedBinding(localName, unit, semantic, atNode)
  return binding?.importedName === importedName && binding.moduleSpecifier === "linkedom"
}

function isTrustedCapabilityIssuer(localName, unit, semantic, atNode) {
  const binding = importedBinding(localName, unit, semantic, atNode)
  if (!binding || !capabilityIssuers.has(binding.importedName)) return null
  if (binding.moduleSpecifier === "#shared/utils/renderable-html") {
    return binding.importedName
  }
  if (!binding.moduleSpecifier.startsWith(".")) return null
  const importedPath = resolve(
    "/",
    dirname(unit.record.relativePath),
    binding.moduleSpecifier
  ).slice(1).replace(/\.(?:[cm]?[jt]sx?)$/u, "")
  return importedPath === capabilityPath.replace(/\.ts$/u, "")
    ? binding.importedName
    : null
}

function resolveDeclaration(name, atNode, semantic) {
  const entries = semantic.declarations.get(name) ?? []
  for (const scope of scopeChain(atNode)) {
    const inScope = entries.filter(entry => entry.scope === scope)
    if (inScope.length > 0) {
      return inScope.sort((left, right) => right.node.pos - left.node.pos)[0]
    }
  }
  return null
}

function assignmentInitializer(entry, useNode, semantic) {
  if (!entry) return null
  const matches = semantic.assignments.filter(assignment =>
    assignment.name === entry.identifier.text
    && assignment.node.pos < useNode.pos
    && resolveDeclaration(assignment.name, assignment.node, semantic)?.node === entry.node
  )
  const latest = matches.sort((left, right) => right.node.pos - left.node.pos)[0]
  return latest
    ? {
        expression: latest.node.right,
        extracted: assignedProperty(latest.node.left, entry.identifier.text)
      }
    : null
}

function declarationInitializer(entry, useNode, semantic) {
  if (!entry) return null
  if (ts.isBindingElement(entry.node)) {
    let owner = entry.node.parent.parent
    while (ts.isBindingElement(owner)) owner = owner.parent.parent
    if (owner.initializer) {
      const extracted = entry.node.propertyName && (
        ts.isIdentifier(entry.node.propertyName)
        || ts.isStringLiteralLike(entry.node.propertyName)
      )
        ? entry.node.propertyName.text
        : entry.identifier.text
      return { expression: owner.initializer, extracted }
    }
    return assignmentInitializer(entry, useNode, semantic)
  }
  return entry.node.initializer
    ? { expression: entry.node.initializer, extracted: null }
    : assignmentInitializer(entry, useNode, semantic)
}

function constantString(node, unit, semantic, atNode = node, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (ts.isStringLiteralLike(expression)) return expression.text
  if (ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isBinaryExpression(expression)
    && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantString(expression.left, unit, semantic, atNode, seen)
    const right = constantString(expression.right, unit, semantic, atNode, seen)
    return left === null || right === null ? null : left + right
  }
  if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
    seen.add(expression.text)
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    const initializer = declarationInitializer(entry, atNode, semantic)
    return initializer
      ? constantString(initializer.expression, unit, semantic, atNode, seen)
      : null
  }
  return null
}

function expressionLineage(node, unit, semantic, atNode = node, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (!expression) return null
  if (ts.isIdentifier(expression)) {
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    if (!entry || seen.has(entry.node)) return null
    seen.add(entry.node)
    const initializer = declarationInitializer(entry, atNode, semantic)
    if (!initializer) return null
    const kind = expressionLineage(initializer.expression, unit, semantic, atNode, seen)
    if (initializer.extracted === "document" && kind === "parse-result") return "document"
    return kind
  }
  if (ts.isCallExpression(expression)) {
    if (ts.isIdentifier(expression.expression)
      && isTrustedLinkedomBinding(
        expression.expression.text,
        "parseHTML",
        unit,
        semantic,
        expression.expression
      )) {
      return "parse-result"
    }
    if (ts.isPropertyAccessExpression(expression.expression)) {
      const method = expression.expression.name.text
      const receiver = expression.expression.expression
      if (method === "parseFromString"
        && ts.isNewExpression(unwrapExpression(receiver))
        && ts.isIdentifier(unwrapExpression(receiver).expression)
        && isTrustedLinkedomBinding(
          unwrapExpression(receiver).expression.text,
          "DOMParser",
          unit,
          semantic,
          unwrapExpression(receiver).expression
        )) return "document"
      const receiverKind = expressionLineage(receiver, unit, semantic, atNode, seen)
      if (method === "createElement" && receiverKind === "document") return "element"
      if (method === "querySelector" && ["document", "element"].includes(receiverKind)) return "element"
      if (method === "querySelectorAll" && ["document", "element"].includes(receiverKind)) return "collection"
      if (method === "filter" && receiverKind === "collection") return "collection"
    }
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const receiverKind = expressionLineage(expression.expression, unit, semantic, atNode, seen)
    if (expression.name.text === "document" && receiverKind === "parse-result") return "document"
    if (expression.name.text === "body" && receiverKind === "document") return "element"
    return receiverKind
  }
  if (ts.isElementAccessExpression(expression)) {
    const receiverKind = expressionLineage(expression.expression, unit, semantic, atNode, seen)
    return receiverKind === "collection" ? "element" : receiverKind
  }
  if (ts.isArrayLiteralExpression(expression)) {
    for (const element of expression.elements) {
      const candidate = ts.isSpreadElement(element) ? element.expression : element
      const kind = expressionLineage(candidate, unit, semantic, atNode, seen)
      if (kind) return kind
    }
  }
  if (ts.isSpreadElement(expression)) {
    return expressionLineage(expression.expression, unit, semantic, atNode, seen)
  }
  return null
}

function enclosingNamedFunction(node) {
  let current = node.parent
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
    if (ts.isMethodDeclaration(current) && current.name) {
      return propertyNameText(current.name, null, null, current)
    }
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
        return current.parent.name.text
      }
      if (ts.isPropertyAssignment(current.parent)) {
        return propertyNameText(current.parent.name, null, null, current)
      }
    }
    current = current.parent
  }
  return null
}

function rootIdentifier(node) {
  let expression = unwrapExpression(node)
  while (expression) {
    if (ts.isIdentifier(expression)) return expression.text
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      expression = unwrapExpression(expression.expression)
      continue
    }
    return null
  }
  return null
}

function directIssuer(node, unit, semantic) {
  let current = node
  while (current.parent && (
    ts.isParenthesizedExpression(current.parent)
    || ts.isAsExpression(current.parent)
    || ts.isNonNullExpression(current.parent)
  )) current = current.parent
  if (!ts.isCallExpression(current.parent) || !current.parent.arguments.includes(current)) return null
  return ts.isIdentifier(current.parent.expression)
    ? isTrustedCapabilityIssuer(current.parent.expression.text, unit, semantic, current.parent.expression)
    : null
}

function operationKind(node) {
  const parent = node.parent
  return ts.isBinaryExpression(parent)
    && parent.left === node
    && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
    && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ? "write"
    : "read"
}

function operationMatches(operation, policy) {
  return operation.kind === policy.kind
    && (policy.functionName === undefined || operation.functionName === policy.functionName)
    && (policy.base === undefined || operation.base === policy.base)
    && (policy.issuer === undefined || operation.issuer === policy.issuer)
    && (policy.value === undefined || operation.value === policy.value)
}

function mayBeDomReceiver(node, unit, semantic, atNode = node, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (!expression || seen.has(expression)) return false
  seen.add(expression)
  if (ts.isIdentifier(expression)) {
    if (expression.text === "document") return true
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    if (!entry) return false
    if (entry.node.type && /(?:^|\W)(?:Document|Element|HTMLElement|SVGElement)(?:\W|$)/u
      .test(entry.node.type.getText(unit.sourceFile))) return true
    const initializer = declarationInitializer(entry, atNode, semantic)
    return initializer
      ? mayBeDomReceiver(initializer.expression, unit, semantic, atNode, seen)
      : expressionLineage(expression, unit, semantic, atNode) !== null
  }
  if (ts.isPropertyAccessExpression(expression)) {
    if (expression.name.text === "document") {
      const owner = unwrapExpression(expression.expression)
      return ts.isIdentifier(owner) && ["globalThis", "window"].includes(owner.text)
    }
    if ([
      "body",
      "documentElement",
      "firstElementChild",
      "lastElementChild",
      "parentElement"
    ].includes(expression.name.text)) {
      return mayBeDomReceiver(expression.expression, unit, semantic, atNode, seen)
    }
    return false
  }
  if (ts.isElementAccessExpression(expression)) {
    return expressionLineage(expression, unit, semantic, atNode) !== null
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const method = expression.expression.name.text
    return /^(?:createElement|getElementById|querySelector|closest)$/u.test(method)
      && mayBeDomReceiver(expression.expression.expression, unit, semantic, atNode, seen)
  }
  return expressionLineage(expression, unit, semantic, atNode) !== null
}

function collectDomOperations(unit) {
  const semantic = buildSemantic(unit)
  const operations = []
  visitAst(unit.sourceFile, node => {
    let receiver = null
    let property = null
    let computed = false
    if (ts.isPropertyAccessExpression(node)) {
      receiver = node.expression
      property = node.name.text
    } else if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      receiver = node.expression
      property = constantString(node.argumentExpression, unit, semantic, node)
      computed = true
    }
    const dynamicDomAccess = receiver && computed && property === null
      && !ts.isNumericLiteral(unwrapExpression(node.argumentExpression))
      && mayBeDomReceiver(receiver, unit, semantic, node)
    if (receiver && (property === "innerHTML" || dynamicDomAccess)) {
      let computedOrigin = node
      if (computed && property !== null && ts.isIdentifier(node.argumentExpression)) {
        const entry = resolveDeclaration(node.argumentExpression.text, node, semantic)
        if (entry) computedOrigin = entry.identifier
      }
      operations.push({
        node,
        base: rootIdentifier(receiver),
        computed,
        computedOrigin,
        detached: expressionLineage(receiver, unit, semantic, node) !== null,
        functionName: enclosingNamedFunction(node),
        issuer: directIssuer(node, unit, semantic),
        kind: operationKind(node),
        unit
      })
    }
    if (ts.isBindingElement(node)) {
      const propertyName = propertyNameText(node.propertyName ?? node.name, unit, semantic, node)
      const computedBinding = node.propertyName
        ? ts.isComputedPropertyName(node.propertyName)
        : false
      const declaration = ts.isObjectBindingPattern(node.parent) ? node.parent.parent : null
      const bindingReceiver = declaration && ts.isVariableDeclaration(declaration)
        ? declaration.initializer
        : null
      const dynamicDomBinding = computedBinding && propertyName === null && bindingReceiver
        && mayBeDomReceiver(bindingReceiver, unit, semantic, node)
      if (propertyName === "innerHTML" || dynamicDomBinding) {
        operations.push({
          node,
          base: bindingReceiver ? rootIdentifier(bindingReceiver) : null,
          computed: computedBinding,
          computedOrigin: node.propertyName ?? node,
          detached: bindingReceiver
            ? expressionLineage(bindingReceiver, unit, semantic, node) !== null
            : false,
          functionName: enclosingNamedFunction(node),
          issuer: null,
          kind: "read",
          unit
        })
      }
    }
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const assignment = ts.isObjectLiteralExpression(node.parent)
        && ts.isBinaryExpression(node.parent.parent)
        && node.parent.parent.left === node.parent
        && node.parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? node.parent.parent
        : null
      const propertyName = propertyNameText(node.name, unit, semantic, node)
      const computedProperty = ts.isComputedPropertyName(node.name)
      const dynamicDomAssignment = assignment && computedProperty && propertyName === null
        && mayBeDomReceiver(assignment.right, unit, semantic, node)
      if (assignment && (propertyName === "innerHTML" || dynamicDomAssignment)) {
        operations.push({
          node,
          base: rootIdentifier(assignment.right),
          computed: computedProperty,
          computedOrigin: node.name,
          detached: expressionLineage(assignment.right, unit, semantic, node) !== null,
          functionName: enclosingNamedFunction(node),
          issuer: null,
          kind: "read",
          unit
        })
        return
      }
      if (propertyName !== "innerHTML") return
      const initializer = ts.isPropertyAssignment(node) ? node.initializer : node.name
      operations.push({
        node,
        base: null,
        computed: computedProperty,
        detached: false,
        functionName: enclosingNamedFunction(node),
        issuer: null,
        kind: "object",
        unit,
        value: initializer.getText(unit.sourceFile).replace(/\s+/gu, "")
      })
    }
  })
  return operations
}

function operationLine(operation) {
  return lineNumberAt(
    operation.unit.record.source,
    operation.node.getStart(operation.unit.sourceFile)
  )
}

function operationComputedLine(operation) {
  return lineNumberAt(
    operation.unit.record.source,
    operation.computedOrigin.getStart(operation.unit.sourceFile)
  )
}

function auditDomOperations(record) {
  if (!isProductionPath(record.relativePath)) return
  const operations = record.units.flatMap(collectDomOperations)
  const policies = reviewedDomPolicies.get(record.relativePath)
  if (!policies) {
    for (const operation of operations) {
      if (operation.computed) {
        addViolation(
          record.relativePath,
          operationComputedLine(operation),
          "computed DOM HTML access is forbidden"
        )
      }
      addViolation(
        record.relativePath,
        operationLine(operation),
        "DOM HTML access is not in the reviewed allowlist"
      )
    }
    return
  }

  let cardinalityChanged = false
  let provenanceChanged = false
  const matched = new Set()
  for (const policy of policies) {
    const matches = operations.filter(operation => operationMatches(operation, policy))
    if (matches.length !== policy.count) {
      cardinalityChanged = true
      provenanceChanged = true
    }
    for (const operation of matches) {
      matched.add(operation)
      if (policy.kind !== "object" && !operation.detached) provenanceChanged = true
    }
  }
  if (provenanceChanged && record.relativePath !== rendererPath) {
    addViolation(record.relativePath, 0, "reviewed detached DOM provenance changed")
  }
  if (cardinalityChanged) {
    addViolation(record.relativePath, 0, "reviewed DOM HTML signature cardinality changed")
  }
  for (const operation of operations) {
    if (operation.computed) {
      addViolation(
        record.relativePath,
        operationComputedLine(operation),
        "computed DOM HTML access is forbidden"
      )
    }
    if (!matched.has(operation)) {
      addViolation(
        record.relativePath,
        operationLine(operation),
        "DOM HTML access does not match the reviewed signature"
      )
    }
  }
}

function recordConstantOrigin(record, name, expected) {
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    const candidates = semantic.declarations.get(name) ?? []
    for (const entry of candidates) {
      if (constantString(entry.identifier, unit, semantic, entry.identifier) === expected) {
        return { node: entry.identifier, unit }
      }
    }
  }
  return null
}

function auditVueTemplate(record) {
  if (!record.template) return
  const { ast, start } = record.template
  const visit = node => {
    if (node.type === NodeTypes.ELEMENT) {
      const native = node.tagType === ElementTypes.ELEMENT
      for (const property of node.props) {
        if (property.type !== NodeTypes.DIRECTIVE) continue
        const line = lineNumberAt(record.source, start + property.loc.start.offset)
        if (property.name === "html") {
          addViolation(record.relativePath, line, "Vue raw-HTML directives are forbidden")
        }
        if (native && property.name === "bind" && !property.arg) {
          addViolation(record.relativePath, line, "native object v-bind can forward raw HTML properties")
        }
        if (native && property.name === "bind" && property.arg && !property.arg.isStatic) {
          addViolation(record.relativePath, line, "dynamic Vue argument bindings are forbidden")
          const origin = recordConstantOrigin(record, property.arg.content, "innerHTML")
          if (origin) {
            addViolation(
              record.relativePath,
              lineNumberAt(record.source, origin.node.getStart(origin.unit.sourceFile)),
              "computed DOM HTML access is forbidden"
            )
          }
        }
        if (native && property.name === "bind" && property.arg?.isStatic
          && property.arg.content === "innerHTML") {
          addViolation(record.relativePath, line, "DOM HTML access is not in the reviewed allowlist")
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(ast)
}

function importAliases(unit) {
  const aliases = new Map()
  const namespaces = new Set()
  for (const statement of unit.sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        aliases.set(specifier.name.text, specifier.propertyName?.text ?? specifier.name.text)
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text)
    }
  }
  return { aliases, namespaces }
}

function typeDeclarationName(node) {
  return (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
    || ts.isClassDeclaration(node)) && node.name
    ? node.name.text
    : null
}

function simpleTypeName(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isQualifiedName(node)) return node.right.text
  return null
}

function functionIdentity(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text
  if (ts.isMethodDeclaration(node) && node.name) {
    const method = ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)
      ? node.name.text
      : null
    const object = node.parent && ts.isObjectLiteralExpression(node.parent)
      && ts.isVariableDeclaration(node.parent.parent)
      && ts.isIdentifier(node.parent.parent.name)
      ? node.parent.parent.name.text
      : null
    return object && method ? `${object}.${method}` : method
  }
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
      return node.parent.name.text
    }
    if (ts.isPropertyAssignment(node.parent)) {
      const property = ts.isIdentifier(node.parent.name) || ts.isStringLiteralLike(node.parent.name)
        ? node.parent.name.text
        : null
      const object = node.parent.parent && ts.isObjectLiteralExpression(node.parent.parent)
        && ts.isVariableDeclaration(node.parent.parent.parent)
        && ts.isIdentifier(node.parent.parent.parent.name)
        ? node.parent.parent.parent.name.text
        : null
      return object && property ? `${object}.${property}` : property
    }
  }
  return null
}

function callIdentity(expression) {
  const callee = unwrapExpression(expression)
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.getText().replace(/\s+/gu, "")
  return null
}

function enclosingFunction(node) {
  let current = node.parent
  while (current) {
    if (ts.isFunctionLike(current)) return current
    current = current.parent
  }
  return null
}

function buildCapabilityRegistry(records) {
  const units = records.flatMap(record => record.units)
  const unitContexts = new Map(units.map(unit => [unit, {
    ...importAliases(unit),
    semantic: buildSemantic(unit),
    taintedGenericParameters: new Map()
  }]))
  const declarations = []
  const taintedNames = new Set(capabilityTypes)
  for (const unit of units) {
    visitAst(unit.sourceFile, node => {
      const name = typeDeclarationName(node)
      if (name) declarations.push({ name, node, unit })
    })
  }

  const declaredMembers = declaration => {
    if (ts.isInterfaceDeclaration(declaration.node) || ts.isClassDeclaration(declaration.node)) {
      return declaration.node.members
    }
    if (ts.isTypeAliasDeclaration(declaration.node)
      && ts.isTypeLiteralNode(declaration.node.type)) {
      return declaration.node.type.members
    }
    return []
  }

  const indexedPropertyName = node => {
    if (!ts.isLiteralTypeNode(node)) return null
    return ts.isStringLiteralLike(node.literal) || ts.isNumericLiteral(node.literal)
      ? node.literal.text
      : null
  }

  const declaredPropertyName = node => {
    if (!node.name) return null
    return ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)
      || ts.isNumericLiteral(node.name)
      ? node.name.text
      : null
  }

  const typeCarries = (node, unit, atNode = node, seen = new Set()) => {
    if (!node) return false
    const context = unitContexts.get(unit)
    if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)
      || ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
      return typeCarries(node.type, unit, atNode, seen)
    }
    if (ts.isTypeReferenceNode(node)) {
      const localName = simpleTypeName(node.typeName)
      const originalName = localName ? context.aliases.get(localName) ?? localName : null
      if (originalName && taintedNames.has(originalName)) return true
      const owner = enclosingFunction(atNode)
      const taintedParameters = owner ? context.taintedGenericParameters.get(owner) : null
      if (localName && taintedParameters?.has(localName)) return true
      const constrainedParameter = localName
        ? owner?.typeParameters?.find(parameter => parameter.name.text === localName)
        : null
      if (constrainedParameter?.constraint
        && typeCarries(constrainedParameter.constraint, unit, constrainedParameter, seen)) {
        return true
      }
      return node.typeArguments?.some(argument => typeCarries(argument, unit, atNode, seen)) ?? false
    }
    if (ts.isImportTypeNode(node)) {
      if (node.qualifier && taintedNames.has(simpleTypeName(node.qualifier))) return true
      return node.typeArguments?.some(argument => typeCarries(argument, unit, atNode, seen)) ?? false
    }
    if (ts.isTypeQueryNode(node)) {
      const name = simpleTypeName(node.exprName)
      if (name && capabilityIssuers.has(context.aliases.get(name) ?? name)) return true
      if (name) return valueCarriesIdentifier(name, unit, atNode, new Set())
      return false
    }
    if (ts.isIndexedAccessTypeNode(node)) {
      const property = indexedPropertyName(node.indexType)
      const object = ts.isTypeReferenceNode(node.objectType)
        ? simpleTypeName(node.objectType.typeName)
        : null
      const originalObject = object ? context.aliases.get(object) ?? object : null
      if (property && originalObject) {
        const matchingDeclarations = declarations.filter(declaration =>
          declaration.name === originalObject
        )
        const matchingMembers = matchingDeclarations.flatMap(declaration =>
          declaredMembers(declaration)
            .filter(member => declaredPropertyName(member) === property)
            .map(member => ({ declaration, member }))
        )
        if (matchingMembers.length > 0) {
          return matchingMembers.some(({ declaration, member }) => member.type
            && typeCarries(member.type, declaration.unit, member, seen))
        }
      }
      return typeCarries(node.objectType, unit, atNode, seen)
    }
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
      return typeCarries(node.type, unit, atNode, seen)
    }
    if (ts.isTypeLiteralNode(node)) {
      return node.members.some(member => member.type && typeCarries(member.type, unit, atNode, seen))
    }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      return node.types.some(type => typeCarries(type, unit, atNode, seen))
    }
    if (ts.isTupleTypeNode(node)) {
      return node.elements.some(type => typeCarries(type, unit, atNode, seen))
    }
    if (ts.isArrayTypeNode(node)) return typeCarries(node.elementType, unit, atNode, seen)
    return false
  }

  const declarationCarries = declaration => {
    if (seenDeclaration(declaration, taintedNames)) return true
    if (ts.isTypeAliasDeclaration(declaration.node)) {
      return typeCarries(declaration.node.type, declaration.unit, declaration.node)
    }
    if (ts.isInterfaceDeclaration(declaration.node) || ts.isClassDeclaration(declaration.node)) {
      return declaration.node.members.some(member => member.type
        && typeCarries(member.type, declaration.unit, member))
        || (declaration.node.heritageClauses?.some(clause => clause.types.some(type => {
          const name = simpleTypeName(type.expression)
          return name ? taintedNames.has(name) : false
        })) ?? false)
    }
    return false
  }

  function seenDeclaration(declaration, names) {
    return names.has(declaration.name)
  }

  function valueCarriesIdentifier(name, unit, atNode, seen) {
    const context = unitContexts.get(unit)
    const entry = resolveDeclaration(name, atNode, context.semantic)
    if (!entry || seen.has(entry.node)) return false
    seen.add(entry.node)
    if (entry.node.type && typeCarries(entry.node.type, unit, entry.node)) return true
    const initializer = declarationInitializer(entry, atNode, context.semantic)
    if (!initializer) return false
    const expression = unwrapExpression(initializer.expression)
    if (ts.isCallExpression(expression)) {
      const identity = callIdentity(expression.expression)
      const original = identity ? context.aliases.get(identity) ?? identity : null
      if (original && capabilityIssuers.has(original)) return true
    }
    if (ts.isIdentifier(expression)) {
      return valueCarriesIdentifier(expression.text, unit, expression, seen)
    }
    return false
  }

  let changed = true
  while (changed) {
    changed = false
    for (const declaration of declarations) {
      if (!taintedNames.has(declaration.name) && declarationCarries(declaration)) {
        taintedNames.add(declaration.name)
        changed = true
      }
    }
  }

  const genericFunctions = new Map()
  for (const unit of units) {
    visitAst(unit.sourceFile, node => {
      if (!ts.isFunctionLike(node) || !node.typeParameters?.length) return
      const identity = functionIdentity(node)
      if (!identity) return
      const entries = genericFunctions.get(identity) ?? []
      entries.push({ node, unit })
      genericFunctions.set(identity, entries)
    })
  }

  const resolvedCallIdentity = (expression, unit, atNode, seen = new Set()) => {
    const target = unwrapExpression(expression)
    const identity = callIdentity(target)
    if (!ts.isIdentifier(target) || seen.has(target.text)) return identity
    seen.add(target.text)
    const context = unitContexts.get(unit)
    const entry = resolveDeclaration(target.text, atNode, context.semantic)
    const initializer = declarationInitializer(entry, atNode, context.semantic)
    return initializer
      ? resolvedCallIdentity(initializer.expression, unit, atNode, seen) ?? identity
      : identity
  }

  for (const unit of units) {
    visitAst(unit.sourceFile, node => {
      if (!ts.isCallExpression(node) || !node.typeArguments?.length) return
      const identity = resolvedCallIdentity(node.expression, unit, node)
      if (!identity) return
      for (const declaration of genericFunctions.get(identity) ?? []) {
        const targetContext = unitContexts.get(declaration.unit)
        const names = targetContext.taintedGenericParameters.get(declaration.node) ?? new Set()
        node.typeArguments.forEach((argument, index) => {
          if (typeCarries(argument, unit, node)) {
            const parameter = declaration.node.typeParameters?.[index]
            if (parameter) names.add(parameter.name.text)
          }
        })
        targetContext.taintedGenericParameters.set(declaration.node, names)
      }
    })
  }

  return { typeCarries, unitContexts }
}

function auditCapabilityAssertions(record, registry) {
  if (record.relativePath === capabilityPath) return
  for (const unit of record.units) {
    visitAst(unit.sourceFile, node => {
      if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return
      if (!registry.typeCarries(node.type, unit, node)) return
      addViolation(
        record.relativePath,
        lineNumberAt(record.source, node.getStart(unit.sourceFile)),
        "capability assertions are limited to the private capability helper"
      )
    })
  }
}

function astShape(node, sourceFile) {
  const children = node.getChildren(sourceFile)
  if (children.length === 0) {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return [node.kind, node.text]
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return [node.kind, node.text]
    return [node.kind]
  }
  return [node.kind, children.map(child => astShape(child, sourceFile))]
}

const canonicalCapabilityAst = (() => {
  const sourceFile = ts.createSourceFile(
    capabilityPath,
    canonicalCapabilitySource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  return JSON.stringify(sourceFile.statements.map(statement => astShape(statement, sourceFile)))
})()

function auditCapabilityUtility(record) {
  const unit = record.units[0]
  const fingerprint = unit
    ? JSON.stringify(unit.sourceFile.statements.map(statement => astShape(statement, unit.sourceFile)))
    : ""
  if (fingerprint !== canonicalCapabilityAst) {
    addViolation(record.relativePath, 1, "capability utility must equal the reviewed structural surface")
  }
}

function auditEslintConfig() {
  const relativePath = "eslint.config.mjs"
  try {
    if (readFileSync(resolve(root, relativePath), "utf8") !== canonicalEslintConfig) {
      addViolation(relativePath, 1, "ESLint configuration must equal the canonical reviewed file")
    }
  } catch {
    addViolation(relativePath, 0, "ESLint configuration is missing")
  }
}

function readSource(absolutePath, relativePath) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(absolutePath))
  } catch {
    addViolation(relativePath, 0, "source files must be valid UTF-8 text")
    return null
  }
}

function walk(absoluteDirectory) {
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
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
    if (!status.isFile() || !sourceExtensions.has(extname(relativePath))) continue
    const source = readSource(absolutePath, relativePath)
    if (source === null) continue
    auditedFileCount += 1
    const record = { relativePath, source, units: [], htmlComments: [], template: null }
    parseRecord(record)
    sourceRecords.push(record)
  }
}

walk(root)
auditEslintConfig()
const capabilityRegistry = buildCapabilityRegistry(sourceRecords)
for (const record of sourceRecords) {
  auditComments(record)
  auditVueTemplate(record)
  auditDomOperations(record)
  if (record.relativePath === capabilityPath) auditCapabilityUtility(record)
  else auditCapabilityAssertions(record, capabilityRegistry)
}

violations.sort((left, right) => left.path.localeCompare(right.path, "en")
  || left.line - right.line
  || left.message.localeCompare(right.message, "en"))
if (violations.length > 0) {
  for (const violation of violations) {
    const line = violation.line > 0 ? `:${violation.line}` : ""
    process.stderr.write(`${violation.path}${line}: ${violation.message}\n`)
  }
  process.exitCode = 1
} else {
  process.stdout.write(`Architecture policy passed: audited ${auditedFileCount} files.\n`)
}
