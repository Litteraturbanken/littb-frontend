import { lstatSync, readFileSync, readdirSync } from "node:fs"
import { dirname, extname, relative, resolve, sep } from "node:path"

import { ElementTypes, NodeTypes, parse as parseVueTemplate } from "@vue/compiler-dom"
import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

const root = resolve(process.argv[2] ?? process.cwd())
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"])
const capabilityPath = "shared/utils/renderable-html.ts"
const rendererPath = "app/components/global/RenderableHtmlContent.vue"
const chronologyRangeConsumerPaths = new Set([
  "app/pages/bibliotek.vue",
  "app/pages/sök.vue"
])
const htmlDocumentPath = "app/lib/html-document.ts"
const lbApiClientModulePath = "app/lib/api/client"
const lbApiClientOwnerPath = "app/composables/useLbApiClient.ts"
const restrictedLbApiClientExports = new Set([
  "createCorrelatedLbApiClient",
  "createLbApiClient"
])
const contractAllowlist = new Set([
  "test/nuxt/author-works-contract.ts",
  "test/nuxt/observability-contract.ts",
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
const legacyReaderEditorMetadataFragments = [
  "/api/get_work_info",
  "/get_work_info",
  "/count_pages/"
]
const requiredEslintIgnores = new Set([
  ".nuxt/**",
  ".output/**",
  "node_modules/**",
  "app/lib/api/generated/**",
  "coverage/**",
  "playwright-report/**",
  "test-results*/**"
])
const requiredSonarRules = new Set([
  "sonarjs/no-all-duplicated-branches",
  "sonarjs/no-collection-size-mischeck",
  "sonarjs/no-duplicated-branches",
  "sonarjs/no-identical-expressions",
  "sonarjs/no-identical-functions",
  "sonarjs/no-redundant-boolean"
])
const requiredTailwindRules = new Set([
  "tailwindcss/no-contradicting-classname"
])
const requiredSemanticReviewScripts = Object.freeze({
  "quality:review:inventory": "node scripts/run-semantic-review.mjs inventory",
  "quality:review:queue": "node scripts/run-semantic-review.mjs queue",
  "quality:review:packet": "node scripts/run-semantic-review.mjs packet",
  "quality:review:record": "node scripts/run-semantic-review.mjs record",
  "quality:review:check": "node scripts/run-semantic-review.mjs check"
})
const deepConditionalSelector = "ConditionalExpression ConditionalExpression ConditionalExpression"
const deepConditionalMessage = "Extract deeply nested ternary logic into named statements."
const deepConditionalRuleNames = new Set([
  "no-restricted-syntax",
  "vue/no-restricted-syntax"
])
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
  "issueManagedReaderStyle",
  "issueManagedHomeHtml",
  "issueManagedAboutHtml",
  "issueManagedPresentationHtml",
  "issueManagedPresentationStyle",
  "issueManagedPresentationStylesheetHref"
])
const capabilityIssuerReturnTypes = new Map([
  ["issueAuthorProfileHtml", 'SanitizedHtml<"author-profile">'],
  ["issueAuthorDocumentHtml", 'SanitizedHtml<"author-document">'],
  ["issueDramawebbenDocumentHtml", 'SanitizedHtml<"dramawebben-document">'],
  ["issueSlaArticleHtml", 'SanitizedHtml<"sla-article">'],
  ["issueDictionaryArticleHtml", 'SanitizedHtml<"dictionary-article">'],
  ["issueReaderOcrHtml", 'SanitizedHtml<"reader-ocr">'],
  ["issueReaderSourceInfoHtml", 'SanitizedHtml<"reader-source-info">'],
  ["issueEditorEtextHtml", 'SanitizedHtml<"editor-etext">'],
  ["issueManagedReaderHtml", 'ManagedAssetHtml<"reader-etext">'],
  ["issueManagedReaderStyle", 'ManagedStyleText<"reader-etext">'],
  ["issueManagedHomeHtml", 'ManagedAssetHtml<"home-editorial">'],
  ["issueManagedAboutHtml", 'ManagedAssetHtml<"about-editorial">'],
  ["issueManagedPresentationHtml", 'ManagedAssetHtml<"presentation-editorial">'],
  ["issueManagedPresentationStyle", 'ManagedStyleText<"presentation-editorial">'],
  ["issueManagedPresentationStylesheetHref", 'ManagedStylesheetHref<"presentation-editorial">']
])
const capabilityUtilityNames = new Set([
  "emptyRenderableHtml",
  "joinReaderSourceRows",
  "transformManagedReaderHtml"
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
    { functionName: "markReaderSearchHtml", kind: "read", base: "root", count: 1 }
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
  ["server/utils/reader-source-info-sanitizer.ts", [
    { functionName: "sanitizeReaderSourceInfoHtml", kind: "read", base: "body", issuer: "issueReaderSourceInfoHtml", count: 1 }
  ]],
  ["server/utils/reader-source-info-projection.ts", [
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
const checkerContexts = new WeakMap()
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

function createScriptUnit(record, content, start, language, kind = "script") {
  const scriptKind = scriptKindFor(record.relativePath, language)
  return {
    kind,
    record,
    commentSource: content,
    commentOffset: start,
    sourceOffset: start,
    sourceFile: ts.createSourceFile(
      record.relativePath,
      content,
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
  record.styles = parsed.descriptor.styles.map(block => block.content)
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
    if (/\bast-grep-ignore\b/u.test(comment.body)) {
      addViolation(record.relativePath, line, "ast-grep inline suppressions are forbidden")
    }
    if (/\bsemantic-review-ignore\b/u.test(comment.body)) {
      addViolation(record.relativePath, line, "semantic review inline suppressions are forbidden")
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

function containsLegacyReaderEditorMetadata(value) {
  return legacyReaderEditorMetadataFragments.some(fragment => value.includes(fragment))
}

function auditLegacyReaderEditorMetadata(record) {
  if (!isProductionPath(record.relativePath)) return
  let reported = false
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    const report = (value, node) => {
      if (reported || !containsLegacyReaderEditorMetadata(value)) return
      reported = true
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + node.getStart(unit.sourceFile)
        ),
        "legacy Reader/Editor metadata endpoints are forbidden"
      )
    }
    const auditNode = node => {
      if (reported) return
      if (ts.isTemplateExpression(node)) {
        const value = constantString(node, unit, semantic, node)
        if (value !== null) {
          report(value, node)
          return
        }
        report(node.head.text, node.head)
        for (const span of node.templateSpans) {
          auditNode(span.expression)
          report(span.literal.text, span.literal)
        }
        return
      }
      if (ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const value = constantString(node, unit, semantic, node)
        if (value !== null) {
          report(value, node)
          return
        }
      }
      if (ts.isStringLiteralLike(node)) report(node.text, node)
      ts.forEachChild(node, auditNode)
    }
    auditNode(unit.sourceFile)
  }
  if (reported || !record.template) return
  const auditTemplateNode = node => {
    if (reported) return
    if (node.type === NodeTypes.ELEMENT) {
      for (const property of node.props) {
        if (property.type !== NodeTypes.ATTRIBUTE || !property.value
          || !containsLegacyReaderEditorMetadata(property.value.content)) continue
        reported = true
        addViolation(
          record.relativePath,
          lineNumberAt(
            record.source,
            record.template.start + property.value.loc.start.offset
          ),
          "legacy Reader/Editor metadata endpoints are forbidden"
        )
        return
      }
    }
    for (const child of node.children ?? []) auditTemplateNode(child)
  }
  auditTemplateNode(record.template.ast)
}

function modulePathFrom(record, moduleSpecifier) {
  if (moduleSpecifier.startsWith("~~/") || moduleSpecifier.startsWith("@@/")) {
    return moduleSpecifier.slice(3).replace(/\.(?:[cm]?[jt]sx?)$/u, "")
  }
  if (moduleSpecifier.startsWith("~/") || moduleSpecifier.startsWith("@/")) {
    return `app/${moduleSpecifier.slice(2)}`.replace(/\.(?:[cm]?[jt]sx?)$/u, "")
  }
  if (!moduleSpecifier.startsWith(".")) return null
  return resolve("/", dirname(record.relativePath), moduleSpecifier)
    .slice(1)
    .replace(/\.(?:[cm]?[jt]sx?)$/u, "")
}

function isLbApiClientModule(record, moduleSpecifier) {
  return modulePathFrom(record, moduleSpecifier) === lbApiClientModulePath
}

function namedImportViolatesOwner(record, importedName) {
  if (!restrictedLbApiClientExports.has(importedName)) return false
  return record.relativePath !== lbApiClientOwnerPath
    || importedName !== "createCorrelatedLbApiClient"
}

function isTypeOnlyUse(node) {
  let current = node.parent
  while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
    if (ts.isTypeNode(current)) return true
    current = current.parent
  }
  return false
}

function isTransparentExpression(node) {
  return ts.isAsExpression(node)
    || ts.isNonNullExpression(node)
    || ts.isParenthesizedExpression(node)
    || ts.isSatisfiesExpression(node)
    || ts.isTypeAssertionExpression(node)
}

function directCallFor(node) {
  let current = node
  while (current.parent
    && isTransparentExpression(current.parent)
    && current.parent.expression === current) {
    current = current.parent
  }
  return ts.isCallExpression(current.parent) && current.parent.expression === current
    ? current.parent
    : null
}

function hasExportModifier(node) {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some(modifier => (
      modifier.kind === ts.SyntaxKind.ExportKeyword
      || modifier.kind === ts.SyntaxKind.DefaultKeyword
    ))
}

function ownerExportViolation(node) {
  if (ts.isExportAssignment(node)) return node
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return null
    if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return node
    return node.exportClause.elements.find(specifier => !specifier.isTypeOnly) ?? null
  }
  if (!hasExportModifier(node)
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)) return null
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text === "useLbApiClient" ? null : node
  }
  return node
}

function contextualOwnerFunction(unit) {
  const candidates = unit.sourceFile.statements.filter(statement => (
    ts.isFunctionDeclaration(statement)
    && statement.name?.text === "useLbApiClient"
    && hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    && !hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
  ))
  return candidates.length === 1 ? candidates[0] : null
}

function isUnshadowedZeroArgumentCall(expression, name, semantic) {
  const candidate = unwrapExpression(expression)
  return ts.isCallExpression(candidate)
    && candidate.arguments.length === 0
    && ts.isIdentifier(candidate.expression)
    && candidate.expression.text === name
    && !resolveDeclaration(name, candidate.expression, semantic)
}

function propertyAccessPath(expression) {
  const properties = []
  let current = unwrapExpression(expression)
  while (ts.isPropertyAccessExpression(current)) {
    properties.unshift(current.name.text)
    current = unwrapExpression(current.expression)
  }
  return { root: current, properties }
}

function isOwnerRuntimeBase(expression, semantic) {
  const path = propertyAccessPath(expression)
  const validPath = path.properties.length === 1 && path.properties[0] === "apiBase"
    || path.properties.length === 2
      && path.properties[0] === "public"
      && path.properties[1] === "apiBase"
  if (!validPath) return false
  return isUnshadowedZeroArgumentCall(path.root, "useRuntimeConfig", semantic)
}

function isOwnerRequestCorrelation(expression, semantic) {
  const candidate = unwrapExpression(expression)
  if (ts.isIdentifier(candidate) && candidate.text === "undefined"
    && !resolveDeclaration(candidate.text, candidate, semantic)) return true
  if (!ts.isCallExpression(candidate)
    || candidate.arguments.length !== 1
    || !ts.isIdentifier(candidate.expression)) return false
  const helper = resolveDeclaration(candidate.expression.text, candidate.expression, semantic)
  if (!helper || !ts.isFunctionDeclaration(helper.node)
    || helper.node.name?.text !== "requestCorrelation"
    || helper.node.parameters.length !== 1
    || enclosingFunction(helper.node) !== null
    || hasExportModifier(helper.node)) return false
  return isUnshadowedZeroArgumentCall(
    candidate.arguments[0],
    "useRequestEvent",
    semantic
  )
}

function isOwnerControlledFactoryCall(call, semantic, ownerFunction) {
  return ownerFunction !== null
    && enclosingFunction(call) === ownerFunction
    && call.arguments.length === 2
    && isOwnerRuntimeBase(call.arguments[0], semantic)
    && isOwnerRequestCorrelation(call.arguments[1], semantic)
}

function contextualOwnerImports(unit) {
  const imports = []
  for (const statement of unit.sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)
      || !ts.isStringLiteralLike(statement.moduleSpecifier)
      || !isLbApiClientModule(unit.record, statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const specifier of bindings.elements) {
      if (!specifier.isTypeOnly
        && (specifier.propertyName?.text ?? specifier.name.text)
          === "createCorrelatedLbApiClient") imports.push(specifier)
    }
  }
  return imports
}

function auditContextualOwner(record, unit, semantic) {
  if (record.relativePath !== lbApiClientOwnerPath) return
  const imports = contextualOwnerImports(unit)
  const ownerFunction = contextualOwnerFunction(unit)
  if (!ownerFunction || ownerFunction.parameters.length !== 0) {
    const violationNode = ownerFunction?.parameters[0] ?? ownerFunction ?? unit.sourceFile
    addViolation(
      record.relativePath,
      lineNumberAt(
        record.source,
        unit.sourceOffset + violationNode.getStart(unit.sourceFile)
      ),
      "contextual lb-api owner must export exactly a zero-argument useLbApiClient"
    )
  }
  visitAst(unit.sourceFile, node => {
    const exportViolation = node.parent === unit.sourceFile
      ? ownerExportViolation(node)
      : null
    if (exportViolation) {
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + exportViolation.getStart(unit.sourceFile)
        ),
        "low-level lb-api client capability must not escape its contextual owner"
      )
    }
    if (!ts.isIdentifier(node) || isTypeOnlyUse(node)) return
    const imported = imports.find(specifier => (
      node !== specifier.name
      && node !== specifier.propertyName
      && node.text === specifier.name.text
      && resolveDeclaration(node.text, node, semantic)?.node === specifier
    ))
    if (!imported) return
    const directCall = directCallFor(node)
    if (directCall) {
      if (isOwnerControlledFactoryCall(directCall, semantic, ownerFunction)) return
      addViolation(
        record.relativePath,
        lineNumberAt(record.source, unit.sourceOffset + node.getStart(unit.sourceFile)),
        "low-level lb-api client calls require owner-controlled runtime context"
      )
      return
    }
    addViolation(
      record.relativePath,
      lineNumberAt(record.source, unit.sourceOffset + node.getStart(unit.sourceFile)),
      "low-level lb-api client capability must not escape its contextual owner"
    )
  })
}

function auditLbApiClientCapability(record) {
  if (!record.relativePath.startsWith("app/")) return
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    auditContextualOwner(record, unit, semantic)
    visitAst(unit.sourceFile, node => {
      let violationNode = null
      if (ts.isImportDeclaration(node)
        && ts.isStringLiteralLike(node.moduleSpecifier)
        && isLbApiClientModule(record, node.moduleSpecifier.text)) {
        const clause = node.importClause
        if (clause && !clause.isTypeOnly) {
          if (clause.name || clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            violationNode = node
          } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            const forbidden = clause.namedBindings.elements.find(specifier => (
              !specifier.isTypeOnly
              && namedImportViolatesOwner(
                record,
                specifier.propertyName?.text ?? specifier.name.text
              )
            ))
            if (forbidden) violationNode = forbidden
          }
        }
      } else if (ts.isExportDeclaration(node)
        && node.moduleSpecifier
        && ts.isStringLiteralLike(node.moduleSpecifier)
        && isLbApiClientModule(record, node.moduleSpecifier.text)
        && !node.isTypeOnly) {
        if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
          violationNode = node
        } else {
          const forbidden = node.exportClause.elements.find(specifier => (
            !specifier.isTypeOnly
            && namedImportViolatesOwner(
              record,
              specifier.propertyName?.text ?? specifier.name.text
            )
          ))
          if (forbidden) violationNode = forbidden
        }
      } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
        const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
        const unshadowedRequire = ts.isIdentifier(node.expression)
          && node.expression.text === "require"
          && !resolveDeclaration("require", node, semantic)
        if (dynamicImport || unshadowedRequire) {
          const moduleSpecifier = constantString(
            node.arguments[0],
            unit,
            semantic,
            node
          )
          if (moduleSpecifier && isLbApiClientModule(record, moduleSpecifier)) {
            violationNode = node
          }
        }
      } else if (ts.isImportEqualsDeclaration(node)
        && !node.isTypeOnly
        && ts.isExternalModuleReference(node.moduleReference)
        && node.moduleReference.expression
        && ts.isStringLiteralLike(node.moduleReference.expression)
        && isLbApiClientModule(record, node.moduleReference.expression.text)) {
        violationNode = node
      }
      if (!violationNode) return
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + violationNode.getStart(unit.sourceFile)
        ),
        "low-level lb-api client capability is restricted to its contextual owner"
      )
    })
  }
}

function visitAst(node, callback) {
  callback(node)
  ts.forEachChild(node, child => visitAst(child, callback))
}

function unwrapExpression(node) {
  let current = node
  while (current && isTransparentExpression(current)) current = current.expression
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

function isTrustedDomParserConstructor(localName, unit, semantic, atNode) {
  if (isTrustedLinkedomBinding(localName, "DOMParser", unit, semantic, atNode)) return true
  return localName === "DOMParser" && !resolveDeclaration(localName, atNode, semantic)
}

function isTrustedHtmlDocumentBinding(localName, unit, semantic, atNode) {
  const binding = importedBinding(localName, unit, semantic, atNode)
  if (binding?.importedName !== "parseHtmlDocument") return false
  if (binding.moduleSpecifier === "~/lib/html-document") return true
  if (!binding.moduleSpecifier.startsWith(".")) return false
  const importedPath = resolve(
    "/",
    dirname(unit.record.relativePath),
    binding.moduleSpecifier
  ).slice(1).replace(/\.(?:[cm]?[jt]sx?)$/u, "")
  return importedPath === htmlDocumentPath.replace(/\.ts$/u, "")
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

function definitionInitializers(entry, useNode, semantic) {
  if (!entry) return []
  const definitions = []
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
      definitions.push({ expression: owner.initializer, extracted, atNode: owner })
    }
  } else if (entry.node.initializer) {
    definitions.push({ expression: entry.node.initializer, extracted: null, atNode: entry.node })
  }
  const assignments = semantic.assignments.filter(assignment => (
    assignment.name === entry.identifier.text
    && assignment.node.pos < useNode.pos
    && resolveDeclaration(assignment.name, assignment.node, semantic)?.node === entry.node
  ))
  const unconditional = assignments.filter(assignment => {
    let current = assignment.node.parent
    while (current && current !== entry.scope) {
      if (ts.isIfStatement(current) || ts.isConditionalExpression(current)
        || ts.isSwitchStatement(current) || ts.isForStatement(current)
        || ts.isForInStatement(current) || ts.isForOfStatement(current)
        || ts.isWhileStatement(current) || ts.isDoStatement(current)
        || ts.isTryStatement(current) || ts.isCatchClause(current)) return false
      current = current.parent
    }
    return current === entry.scope
  }).sort((left, right) => right.node.pos - left.node.pos)[0]
  if (unconditional) definitions.splice(0)
  for (const assignment of assignments) {
    if (unconditional && assignment.node.pos < unconditional.node.pos) continue
    definitions.push({
      expression: assignment.node.right,
      extracted: assignedProperty(assignment.node.left, entry.identifier.text),
      atNode: assignment.node
    })
  }
  return definitions
}

function constantString(node, unit, semantic, atNode = node, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (ts.isStringLiteralLike(expression)) return expression.text
  if (ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text
    for (const span of expression.templateSpans) {
      const component = constantString(span.expression, unit, semantic, atNode, seen)
      if (component === null) return null
      value += component + span.literal.text
    }
    return value
  }
  if (ts.isBinaryExpression(expression)
    && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantString(expression.left, unit, semantic, atNode, seen)
    const right = constantString(expression.right, unit, semantic, atNode, seen)
    return left === null || right === null ? null : left + right
  }
  if (ts.isIdentifier(expression)) {
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    if (!entry || seen.has(entry.node)
      || !ts.isVariableDeclaration(entry.node)
      || !ts.isVariableDeclarationList(entry.node.parent)
      || !(entry.node.parent.flags & ts.NodeFlags.Const)
      || !entry.node.initializer) return null
    return constantString(
      entry.node.initializer,
      unit,
      semantic,
      entry.node.initializer,
      new Set(seen).add(entry.node)
    )
  }
  return null
}

function expressionLineages(node, unit, semantic, atNode = node, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (!expression || seen.has(expression)) return new Set()
  const nextSeen = new Set(seen).add(expression)
  if (ts.isIdentifier(expression)) {
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    if (!entry) return expression.text === "document"
      ? new Set(["live-document"])
      : new Set()
    const lineages = new Set()
    for (const initializer of definitionInitializers(entry, atNode, semantic)) {
      for (const kind of expressionLineages(
        initializer.expression,
        unit,
        semantic,
        initializer.atNode,
        nextSeen
      )) {
        lineages.add(initializer.extracted === "document" && kind === "parse-result"
          ? "document"
          : kind)
      }
    }
    return lineages
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
      return new Set(["parse-result"])
    }
    if (ts.isIdentifier(expression.expression)
      && isTrustedHtmlDocumentBinding(
        expression.expression.text,
        unit,
        semantic,
        expression.expression
      )) {
      return new Set(["document"])
    }
    if (ts.isPropertyAccessExpression(expression.expression)) {
      const method = expression.expression.name.text
      const receiver = expression.expression.expression
      if (method === "parseFromString"
        && ts.isNewExpression(unwrapExpression(receiver))
        && ts.isIdentifier(unwrapExpression(receiver).expression)
        && isTrustedDomParserConstructor(
          unwrapExpression(receiver).expression.text,
          unit,
          semantic,
          unwrapExpression(receiver).expression
        )) return new Set(["document"])
      const receiverKinds = expressionLineages(receiver, unit, semantic, atNode, nextSeen)
      const result = new Set()
      for (const receiverKind of receiverKinds) {
        const live = receiverKind.startsWith("live-")
        const base = live ? receiverKind.slice("live-".length) : receiverKind
        const prefix = live ? "live-" : ""
        if (method === "createElement" && base === "document") result.add(`${prefix}element`)
        if (method === "querySelector" && ["document", "element"].includes(base)) {
          result.add(`${prefix}element`)
        }
        if (method === "querySelectorAll" && ["document", "element"].includes(base)) {
          result.add(`${prefix}collection`)
        }
        if (method === "filter" && base === "collection") result.add(`${prefix}collection`)
      }
      if (result.size > 0) return result
    }
    const target = unwrapExpression(expression.expression)
    if (ts.isIdentifier(target)) {
      const entry = resolveDeclaration(target.text, expression, semantic)
      const declaration = entry?.node
      const functionNode = declaration && ts.isFunctionDeclaration(declaration)
        ? declaration
        : declaration && ts.isVariableDeclaration(declaration)
          && declaration.initializer && ts.isFunctionLike(declaration.initializer)
          ? declaration.initializer
          : null
      const returnType = functionNode?.type ?? (
        declaration && ts.isVariableDeclaration(declaration) ? declaration.type : null
      )
      const typeText = returnType?.getText(unit.sourceFile) ?? ""
      if (/(?:^|\W)(?:HTML|SVG)?Element(?:\W|$)/u.test(typeText)) {
        return new Set(["live-element"])
      }
      if (/(?:^|\W)Document(?:\W|$)/u.test(typeText)) return new Set(["live-document"])
    }
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = unwrapExpression(expression.expression)
    if (expression.name.text === "document" && ts.isIdentifier(owner)
      && ["globalThis", "window"].includes(owner.text)) return new Set(["live-document"])
    const result = new Set()
    for (const receiverKind of expressionLineages(
      expression.expression,
      unit,
      semantic,
      atNode,
      nextSeen
    )) {
      const live = receiverKind.startsWith("live-")
      const base = live ? receiverKind.slice("live-".length) : receiverKind
      const prefix = live ? "live-" : ""
      if (expression.name.text === "document" && base === "parse-result") {
        result.add("document")
      } else if (["body", "documentElement"].includes(expression.name.text)
        && base === "document") {
        result.add(`${prefix}element`)
      } else {
        result.add(receiverKind)
      }
    }
    return result
  }
  if (ts.isElementAccessExpression(expression)) {
    const result = new Set()
    for (const receiverKind of expressionLineages(
      expression.expression,
      unit,
      semantic,
      atNode,
      nextSeen
    )) {
      const live = receiverKind.startsWith("live-")
      const base = live ? receiverKind.slice("live-".length) : receiverKind
      result.add(base === "collection" ? `${live ? "live-" : ""}element` : receiverKind)
    }
    return result
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const result = new Set()
    for (const element of expression.elements) {
      const candidate = ts.isSpreadElement(element) ? element.expression : element
      for (const kind of expressionLineages(candidate, unit, semantic, atNode, nextSeen)) {
        result.add(kind)
      }
    }
    return result
  }
  if (ts.isSpreadElement(expression)) {
    return expressionLineages(expression.expression, unit, semantic, atNode, nextSeen)
  }
  return new Set()
}

function hasOnlyDetachedLineage(node, unit, semantic, atNode = node) {
  const lineages = expressionLineages(node, unit, semantic, atNode)
  return lineages.size > 0 && [...lineages].every(kind => !kind.startsWith("live-"))
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
    return expressionLineages(expression, unit, semantic, atNode).size > 0
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
    return expressionLineages(expression, unit, semantic, atNode).size > 0
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const method = expression.expression.name.text
    const owner = unwrapExpression(expression.expression.expression)
    if (ts.isIdentifier(owner)) {
      const entry = resolveDeclaration(owner.text, atNode, semantic)
      if (entry?.node.type && methodReturnHasDomType(
        entry.node.type,
        method,
        unit,
        semantic
      )) return true
    }
    return /^(?:createElement|getElementById|querySelector|closest)$/u.test(method)
      && mayBeDomReceiver(expression.expression.expression, unit, semantic, atNode, seen)
  }
  return expressionLineages(expression, unit, semantic, atNode).size > 0
}

function methodReturnHasDomType(node, method, unit, semantic) {
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
    return methodReturnHasDomType(node.type, method, unit, semantic)
  }
  if (!ts.isTypeLiteralNode(node)) return false
  const member = node.members.find(candidate => candidate.name
    && propertyNameText(candidate.name, unit, semantic, candidate) === method)
  const returnType = member && (ts.isMethodSignature(member) || ts.isMethodDeclaration(member))
    ? member.type
    : member && ts.isPropertySignature(member) && member.type
      && ts.isFunctionTypeNode(member.type)
      ? member.type.type
      : null
  return Boolean(returnType && /(?:^|\W)(?:Document|Element|HTMLElement|SVGElement)(?:\W|$)/u
    .test(returnType.getText(unit.sourceFile)))
}

function localTypeDeclaration(unit, name) {
  return unit.sourceFile.statements.find(statement => (
    (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))
    && statement.name.text === name
  )) ?? null
}

function isExplicitlyNonDomType(node, unit, seen = new Set()) {
  if (!node) return false
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
    return isExplicitlyNonDomType(node.type, unit, seen)
  }
  if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword) {
    return false
  }
  if (/(?:^|\W)(?:Document|Element|HTMLElement|SVGElement)(?:\W|$)/u
    .test(node.getText(unit.sourceFile))) return false
  if (ts.isTypeLiteralNode(node)) return true
  if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)
    || seen.has(node.typeName.text)) return false
  const declaration = localTypeDeclaration(unit, node.typeName.text)
  if (!declaration) return false
  const nextSeen = new Set(seen).add(node.typeName.text)
  if (ts.isTypeAliasDeclaration(declaration)) {
    return isExplicitlyNonDomType(declaration.type, unit, nextSeen)
  }
  return declaration.heritageClauses === undefined
    && !/(?:^|\W)(?:Document|Element|HTMLElement|SVGElement)(?:\W|$)/u
      .test(declaration.getText(unit.sourceFile))
}

function isProvenNonDomReceiver(node, unit, semantic, atNode) {
  const expression = unwrapExpression(node)
  if (!ts.isIdentifier(expression)) return false
  const entry = resolveDeclaration(expression.text, atNode, semantic)
  return Boolean(entry?.node.type && isExplicitlyNonDomType(entry.node.type, unit))
}

function propertyArgumentCanBeHtml(node, unit, semantic, atNode) {
  const expression = unwrapExpression(node)
  if (ts.isNumericLiteral(expression)) return false
  const property = constantString(expression, unit, semantic, atNode)
  return property === "innerHTML" || property === null
}

function propBagCanContainHtml(node, unit, semantic, atNode) {
  const expression = unwrapExpression(node)
  if (expression.kind === ts.SyntaxKind.NullKeyword) return false
  if (!ts.isObjectLiteralExpression(expression)) return true
  for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) return true
    if (!property.name) return true
    const name = propertyNameText(property.name, unit, semantic, atNode)
    if (name === "innerHTML" || (name === null && ts.isComputedPropertyName(property.name))) {
      return true
    }
  }
  return false
}

function collectDomOperations(unit) {
  const semantic = buildSemantic(unit)
  const operations = []
  visitAst(unit.sourceFile, node => {
    if (ts.isCallExpression(node)) {
      const identity = resolvedValueIdentity(node.expression, unit, semantic, node)
      const adjacentHtml = identity?.endsWith(".insertAdjacentHTML") ?? false
      const target = adjacentHtml
        ? resolvedMethodReceiver(node.expression, unit, semantic, node)
        : node.arguments[0]
      if (target && mayBeDomReceiver(target, unit, semantic, node)) {
        let mutation = false
        let computedOrigin = node
        if (["Reflect.set", "Reflect.defineProperty", "Object.defineProperty"].includes(identity)) {
          const property = node.arguments[1]
          mutation = Boolean(property && propertyArgumentCanBeHtml(property, unit, semantic, node))
          if (property) computedOrigin = property
        } else if (identity === "Object.assign") {
          mutation = node.arguments.slice(1).some(source => (
            propBagCanContainHtml(source, unit, semantic, node)
          ))
          computedOrigin = node.arguments[1] ?? node
        } else if (identity === "Object.defineProperties") {
          const descriptors = node.arguments[1]
          mutation = Boolean(descriptors && propBagCanContainHtml(
            descriptors,
            unit,
            semantic,
            node
          ))
          computedOrigin = descriptors ?? node
        } else if (adjacentHtml) {
          mutation = true
          computedOrigin = node.expression
        }
        if (mutation) {
          operations.push({
            node,
            base: rootIdentifier(target),
            computed: !adjacentHtml,
            computedOrigin,
            detached: hasOnlyDetachedLineage(target, unit, semantic, node),
            functionName: enclosingNamedFunction(node),
            issuer: null,
            kind: "mutation",
            unit
          })
        }
      }
    }
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
    const staticDomAccess = receiver && property === "innerHTML"
      && (mayBeDomReceiver(receiver, unit, semantic, node)
        || !isProvenNonDomReceiver(receiver, unit, semantic, node))
    if (receiver && (staticDomAccess || dynamicDomAccess)) {
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
        detached: hasOnlyDetachedLineage(receiver, unit, semantic, node),
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
            ? hasOnlyDetachedLineage(bindingReceiver, unit, semantic, node)
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
          detached: hasOnlyDetachedLineage(assignment.right, unit, semantic, node),
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
    operation.unit.sourceOffset + operation.node.getStart(operation.unit.sourceFile)
  )
}

function operationComputedLine(operation) {
  return lineNumberAt(
    operation.unit.record.source,
    operation.unit.sourceOffset + operation.computedOrigin.getStart(operation.unit.sourceFile)
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
        operation.kind === "mutation"
          ? "DOM HTML mutation API is forbidden"
          : "DOM HTML access is not in the reviewed allowlist"
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
        operation.kind === "mutation"
          ? "DOM HTML mutation API is forbidden"
          : "DOM HTML access does not match the reviewed signature"
      )
    }
  }
}

function auditNativeVNodeCalls(record) {
  if (!isProductionPath(record.relativePath)) return
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    visitAst(unit.sourceFile, node => {
      if (!ts.isCallExpression(node)) return
      const identity = resolvedValueIdentity(node.expression, unit, semantic, node)
      if (!["h", "createVNode"].includes(identity) || node.arguments.length < 2) return
      const tag = constantString(node.arguments[0], unit, semantic, node)
      if (!tag || !/^[a-z][a-z0-9-]*$/u.test(tag)) return
      if (!propBagCanContainHtml(node.arguments[1], unit, semantic, node)) return
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + node.getStart(unit.sourceFile)
        ),
        "native vnode props can forward raw HTML properties"
      )
    })
  }
}

function resolvedValueIdentity(node, unit, semantic, atNode, seen = new Set()) {
  const expression = unwrapExpression(node)
  const identity = callIdentity(expression)
  if (ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(unwrapExpression(expression.expression))) {
    const owner = unwrapExpression(expression.expression)
    const entry = resolveDeclaration(owner.text, atNode, semantic)
    let declaration = entry?.node
    while (declaration && !ts.isImportDeclaration(declaration)) declaration = declaration.parent
    if (entry && ts.isNamespaceImport(entry.node) && declaration
      && ts.isStringLiteralLike(declaration.moduleSpecifier)
      && declaration.moduleSpecifier.text === "vue") {
      return expression.name.text
    }
  }
  if (!ts.isIdentifier(expression) || seen.has(expression.text)) return identity
  const binding = importedBinding(expression.text, unit, semantic, atNode)
  if (binding?.moduleSpecifier === "vue") return binding.importedName
  seen.add(expression.text)
  const entry = resolveDeclaration(expression.text, atNode, semantic)
  const initializer = declarationInitializer(entry, atNode, semantic)
  if (!initializer) return identity
  const ownerIdentity = resolvedValueIdentity(
    initializer.expression,
    unit,
    semantic,
    atNode,
    seen
  ) ?? identity
  return initializer.extracted && ownerIdentity
    ? `${ownerIdentity}.${initializer.extracted}`
    : ownerIdentity
}

function resolvedMethodReceiver(node, unit, semantic, atNode, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (ts.isPropertyAccessExpression(expression)
    && expression.name.text === "insertAdjacentHTML") {
    return expression.expression
  }
  if (!ts.isIdentifier(expression) || seen.has(expression.text)) return null
  seen.add(expression.text)
  const entry = resolveDeclaration(expression.text, atNode, semantic)
  const initializer = declarationInitializer(entry, atNode, semantic)
  if (!initializer) return null
  if (initializer.extracted === "insertAdjacentHTML") return initializer.expression
  return resolvedMethodReceiver(initializer.expression, unit, semantic, atNode, seen)
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

function vueConstantString(expression) {
  if (!expression?.content) return null
  const sourceFile = ts.createSourceFile(
    "template-expression.ts",
    `const value = ${expression.content}`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const statement = sourceFile.statements[0]
  return statement && ts.isVariableStatement(statement)
    && statement.declarationList.declarations[0]?.initializer
    && ts.isStringLiteralLike(statement.declarationList.declarations[0].initializer)
    ? statement.declarationList.declarations[0].initializer.text
    : null
}

function recordConstantString(record, name) {
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    for (const entry of semantic.declarations.get(name) ?? []) {
      const value = constantString(entry.identifier, unit, semantic, entry.identifier)
      if (value !== null) return value
    }
  }
  return null
}

function recordConstantExpression(record, expression) {
  if (/^[A-Za-z_$][\w$]*$/u.test(expression)) {
    return recordConstantString(record, expression)
  }
  const match = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/u.exec(expression)
  if (!match) return null
  const [, ownerName, propertyName] = match
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    for (const entry of semantic.declarations.get(ownerName) ?? []) {
      const initializer = declarationInitializer(entry, entry.identifier, semantic)
      const value = initializer && unwrapExpression(initializer.expression)
      if (!value || !ts.isObjectLiteralExpression(value)) continue
      const property = value.properties.find(candidate => candidate.name
        && propertyNameText(candidate.name, unit, semantic, candidate) === propertyName)
      if (property && ts.isPropertyAssignment(property)) {
        const constant = constantString(property.initializer, unit, semantic, property)
        if (constant !== null) return constant
      }
    }
  }
  return null
}

function isNativeDynamicComponent(node, record) {
  if (node.tag !== "component") return false
  for (const property of node.props) {
    if (property.type === NodeTypes.ATTRIBUTE && property.name === "is") {
      return Boolean(property.value?.content
        && /^[a-z][a-z0-9-]*$/u.test(property.value.content))
    }
    if (property.type === NodeTypes.DIRECTIVE && property.name === "bind"
      && property.arg?.isStatic && property.arg.content === "is") {
      const value = vueConstantString(property.exp) ?? (
        property.exp?.content
          ? recordConstantExpression(record, property.exp.content)
          : null
      )
      if (value) return /^[a-z][a-z0-9-]*$/u.test(value)
      if (property.exp?.content && recordHasComponentOnlyBinding(record, property.exp.content)) {
        return false
      }
      return true
    }
  }
  return true
}

function recordHasComponentOnlyBinding(record, expression) {
  if (!/^[A-Za-z_$][\w$]*$/u.test(expression)) return false
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    const entry = resolveDeclaration(expression, unit.sourceFile, semantic)
    if (!entry || !ts.isImportClause(entry.node) || !entry.node.name) continue
    const declaration = entry.node.parent
    if (ts.isImportDeclaration(declaration)
      && ts.isStringLiteralLike(declaration.moduleSpecifier)
      && declaration.moduleSpecifier.text.endsWith(".vue")) return true
  }
  return false
}

function auditVueTemplate(record) {
  if (!record.template) return
  const { ast, start } = record.template
  const visit = node => {
    if (node.type === NodeTypes.ELEMENT) {
      const native = node.tagType === ElementTypes.ELEMENT || isNativeDynamicComponent(node, record)
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
              lineNumberAt(
                record.source,
                origin.unit.sourceOffset + origin.node.getStart(origin.unit.sourceFile)
              ),
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

function auditChronologyRangeOwnership(record) {
  if (!chronologyRangeConsumerPaths.has(record.relativePath) || !record.template) return
  const { ast, start } = record.template
  let sharedComponentFound = false
  let rawTrackLine = null
  const pointerEvents = new Set([
    "lostpointercapture",
    "pointercancel",
    "pointerdown",
    "pointermove",
    "pointerup"
  ])
  const visit = node => {
    if (node.type === NodeTypes.ELEMENT) {
      if (node.tagType === ElementTypes.COMPONENT && node.tag === "ChronologyRangeSlider") {
        sharedComponentFound = true
      }
      for (const property of node.props) {
        const line = lineNumberAt(record.source, start + property.loc.start.offset)
        if (property.type === NodeTypes.ATTRIBUTE) {
          const values = property.value?.content.split(/\s+/u) ?? []
          if ((property.name === "class" && values.includes("rzslider"))
            || (node.tag === "input" && property.name === "type" && values.includes("range"))) {
            rawTrackLine ??= line
          }
          continue
        }
        if (property.type !== NodeTypes.DIRECTIVE) continue
        if (property.name === "on" && !property.arg?.isStatic
          && node.tag !== "ChronologyRangeSlider") {
          rawTrackLine ??= line
          continue
        }
        if (!property.arg?.isStatic) continue
        if (property.name === "bind" && property.arg.content === "class"
          && /(?:^|[^\w-])rzslider(?:$|[^\w-])/u.test(property.exp?.content ?? "")) {
          rawTrackLine ??= line
        }
        if (property.name === "bind" && property.arg.content === "type" && node.tag === "input") {
          rawTrackLine ??= line
        }
        if (property.name === "on" && pointerEvents.has(property.arg.content)
          && node.tag !== "ChronologyRangeSlider") {
          rawTrackLine ??= line
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(ast)
  if (!sharedComponentFound || rawTrackLine !== null) {
    addViolation(
      record.relativePath,
      rawTrackLine ?? 1,
      "Chronology range interaction must be owned by ChronologyRangeSlider"
    )
  }
}

function auditCrossEngineRangePointerSupport(record) {
  for (const style of record.styles) {
    const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(match => ({
      declarations: match[2] ?? "",
      selector: match[1] ?? ""
    }))
    const hasPointerEvents = (rule, value) => new RegExp(
      `(?:^|;)\\s*pointer-events\\s*:\\s*${value}\\s*(?:;|$)`,
      "u"
    ).test(rule.declarations)
    const disablesNativeRangePointers = rules.some(rule => (
      rule.selector.includes('input[type="range"]')
      && !rule.selector.includes("::")
      && hasPointerEvents(rule, "none")
    ))
    const restoresWebKitThumbPointers = rules.some(rule => (
      rule.selector.includes("::-webkit-slider-thumb")
      && hasPointerEvents(rule, "auto")
    ))
    const restoresFirefoxThumbPointers = rules.some(rule => (
      rule.selector.includes("::-moz-range-thumb")
      && hasPointerEvents(rule, "auto")
    ))
    if (disablesNativeRangePointers
      && restoresWebKitThumbPointers
      && !restoresFirefoxThumbPointers) {
      addViolation(
        record.relativePath,
        0,
        "WebKit-only range pointer restoration must include an equivalent ::-moz-range-thumb rule"
      )
    }
  }
}

function importAliases(unit) {
  const aliases = new Map()
  const namespaces = new Set()
  for (const statement of unit.sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    if (statement.importClause.name) {
      aliases.set(statement.importClause.name.text, statement.importClause.name.text)
    }
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
  const recordImports = new Map(records.map(record => {
    const aliases = new Map()
    const namespaces = new Set()
    for (const unit of record.units) {
      const imported = importAliases(unit)
      for (const [localName, importedName] of imported.aliases) {
        aliases.set(localName, importedName)
      }
      for (const namespace of imported.namespaces) namespaces.add(namespace)
    }
    return [record, { aliases, namespaces }]
  }))
  const unitContexts = new Map(units.map(unit => [unit, {
    ...recordImports.get(unit.record),
    semantic: buildSemantic(unit),
    taintedGenericParameters: new Map()
  }]))
  const declarations = []
  const taintedNames = new Set(capabilityTypes)
  const taintedDeclarations = new Set()
  for (const unit of units) {
    visitAst(unit.sourceFile, node => {
      const name = typeDeclarationName(node)
      if (name) declarations.push({ name, node, unit })
    })
  }

  const importedTypeTarget = (localName, unit) => {
    for (const candidateUnit of unit.record.units) {
      for (const statement of candidateUnit.sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause
          || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
        const isDefault = statement.importClause.name?.text === localName
        const bindings = statement.importClause.namedBindings
        const specifier = bindings && ts.isNamedImports(bindings)
          ? bindings.elements.find(element => element.name.text === localName)
          : null
        if ((!isDefault && !specifier) || !statement.moduleSpecifier.text.startsWith(".")) continue
        const base = resolve(
          "/",
          dirname(unit.record.relativePath),
          statement.moduleSpecifier.text
        ).slice(1)
        const targetRecord = records.find(record => [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.vue`,
          `${base}/index.ts`
        ].includes(record.relativePath))
        if (targetRecord) {
          return {
            default: isDefault,
            name: specifier?.propertyName?.text ?? specifier?.name.text ?? null,
            record: targetRecord
          }
        }
      }
    }
    return null
  }

  const declarationsFor = (name, unit, localName = name) => {
    const local = declarations.filter(declaration => (
      declaration.name === name && declaration.unit.record === unit.record
    ))
    if (local.length > 0) return local
    const target = importedTypeTarget(localName, unit)
    if (target) {
      return declarations.filter(declaration => (
        declaration.unit.record === target.record
        && (target.default
          ? declaration.node.modifiers?.some(modifier => (
              modifier.kind === ts.SyntaxKind.DefaultKeyword
            ))
          : declaration.name === target.name)
      ))
    }
    return declarations.filter(declaration => declaration.name === name)
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

  const typeCarries = (
    node,
    unit,
    atNode = node,
    seen = new Set(),
    substitutions = new Map()
  ) => {
    if (!node) return false
    const context = unitContexts.get(unit)
    if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)
      || ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
      return typeCarries(node.type, unit, atNode, seen, substitutions)
    }
    if (ts.isTypeReferenceNode(node)) {
      const localName = simpleTypeName(node.typeName)
      const originalName = localName ? context.aliases.get(localName) ?? localName : null
      const substitution = localName ? substitutions.get(localName) : null
      if (substitution) {
        return substitution.literal === undefined
          ? typeCarries(
              substitution.node,
              substitution.unit,
              substitution.node,
              seen,
              substitution.substitutions ?? substitutions
            )
          : false
      }
      if (originalName === "ReturnType" && node.typeArguments?.length === 1
        && ts.isTypeQueryNode(node.typeArguments[0])) {
        return entityNameCarries(node.typeArguments[0].exprName, unit, atNode, seen)
      }
      const matchingDeclarations = originalName
        ? declarationsFor(originalName, unit, localName ?? originalName)
        : []
      if (matchingDeclarations.length > 0) {
        const instantiated = node.typeArguments?.length
          ? matchingDeclarations.filter(declaration => declaration.node.typeParameters?.length)
          : []
        if (instantiated.length > 0) {
          return instantiated.some(declaration => {
            if (seen.has(declaration.node)) return false
            const instantiatedSeen = new Set(seen).add(declaration.node)
            const instantiatedSubstitutions = new Map(substitutions)
            declaration.node.typeParameters?.forEach((parameter, index) => {
              const argument = node.typeArguments?.[index]
              if (argument) {
                instantiatedSubstitutions.set(parameter.name.text, {
                  node: argument,
                  unit,
                  substitutions
                })
              }
            })
            if (ts.isTypeAliasDeclaration(declaration.node)) {
              return typeCarries(
                declaration.node.type,
                declaration.unit,
                declaration.node,
                instantiatedSeen,
                instantiatedSubstitutions
              )
            }
            return declaredMembers(declaration).some(member => member.type && typeCarries(
              member.type,
              declaration.unit,
              member,
              instantiatedSeen,
              instantiatedSubstitutions
            ))
          })
        }
        if (matchingDeclarations.some(declaration => taintedDeclarations.has(declaration))) {
          return true
        }
      } else if (originalName && taintedNames.has(originalName)) return true
      const owner = enclosingFunction(atNode)
      const taintedParameters = owner ? context.taintedGenericParameters.get(owner) : null
      if (localName && taintedParameters?.has(localName)) return true
      const constrainedParameter = localName
        ? owner?.typeParameters?.find(parameter => parameter.name.text === localName)
        : null
      if (constrainedParameter?.constraint
        && typeCarries(
          constrainedParameter.constraint,
          unit,
          constrainedParameter,
          seen,
          substitutions
        )) {
        return true
      }
      return node.typeArguments?.some(argument => (
        typeCarries(argument, unit, atNode, seen, substitutions)
      )) ?? false
    }
    if (ts.isImportTypeNode(node)) {
      if (node.qualifier && taintedNames.has(simpleTypeName(node.qualifier))) return true
      return node.typeArguments?.some(argument => (
        typeCarries(argument, unit, atNode, seen, substitutions)
      )) ?? false
    }
    if (ts.isTypeQueryNode(node)) {
      return entityNameCarries(node.exprName, unit, atNode, seen)
    }
    if (ts.isIndexedAccessTypeNode(node)) {
      const property = indexedPropertyName(node.indexType)
      if (property !== null) {
        const exactProperty = propertyCarries(
          node.objectType,
          property,
          unit,
          atNode,
          seen,
          substitutions
        )
        if (exactProperty !== null) return exactProperty
      }
      return typeCarries(node.objectType, unit, atNode, seen, substitutions)
    }
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
      return typeCarries(node.type, unit, atNode, seen, substitutions)
    }
    if (ts.isTypeLiteralNode(node)) {
      return node.members.some(member => member.type
        && typeCarries(member.type, unit, atNode, seen, substitutions))
    }
    if (ts.isMappedTypeNode(node)) return Boolean(node.type
      && typeCarries(node.type, unit, atNode, seen, substitutions))
    if (ts.isConditionalTypeNode(node)) {
      const check = concreteLiteralType(node.checkType, substitutions)
      const compared = concreteLiteralType(node.extendsType, substitutions)
      if (check !== null && compared !== null) {
        return typeCarries(
          check === compared ? node.trueType : node.falseType,
          unit,
          atNode,
          seen,
          substitutions
        )
      }
      return typeCarries(node.checkType, unit, atNode, seen, substitutions)
        || typeCarries(node.extendsType, unit, atNode, seen, substitutions)
        || typeCarries(node.trueType, unit, atNode, seen, substitutions)
        || typeCarries(node.falseType, unit, atNode, seen, substitutions)
    }
    if (ts.isInferTypeNode(node)) {
      return Boolean(node.typeParameter.constraint
        && typeCarries(node.typeParameter.constraint, unit, atNode, seen, substitutions))
    }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      return node.types.some(type => typeCarries(type, unit, atNode, seen, substitutions))
    }
    if (ts.isTupleTypeNode(node)) {
      return node.elements.some(type => typeCarries(type, unit, atNode, seen, substitutions))
    }
    if (ts.isArrayTypeNode(node)) {
      return typeCarries(node.elementType, unit, atNode, seen, substitutions)
    }
    return false
  }

  function concreteLiteralType(node, substitutions) {
    if (ts.isLiteralTypeNode(node)
      && (ts.isStringLiteralLike(node.literal) || ts.isNumericLiteral(node.literal))) {
      return node.literal.text
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const substitution = substitutions.get(node.typeName.text)
      if (!substitution) return null
      if (substitution.literal !== undefined) return substitution.literal
      return substitution.node
        ? concreteLiteralType(substitution.node, substitutions)
        : null
    }
    return null
  }

  const declarationCarries = declaration => {
    if (taintedDeclarations.has(declaration)) return true
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

  function valueCarriesIdentifier(name, unit, atNode, seen) {
    const context = unitContexts.get(unit)
    const entry = resolveDeclaration(name, atNode, context.semantic)
    if (!entry || seen.has(entry.node)) return false
    seen.add(entry.node)
    if (entry.node.type && typeCarries(entry.node.type, unit, entry.node, seen)) return true
    if (ts.isFunctionDeclaration(entry.node)) {
      if (entry.node.body) {
        let carries = false
        visitAst(entry.node.body, candidate => {
          if (ts.isReturnStatement(candidate) && candidate.expression
            && expressionCarries(candidate.expression, unit, candidate, seen)) carries = true
        })
        if (carries) return true
      }
      return false
    }
    const initializer = declarationInitializer(entry, atNode, context.semantic)
    if (!initializer) return false
    return expressionCarries(initializer.expression, unit, atNode, seen, initializer.extracted)
  }

  function entityNameParts(name) {
    return ts.isIdentifier(name)
      ? [name.text]
      : [...entityNameParts(name.left), name.right.text]
  }

  function entityNameCarries(name, unit, atNode, seen) {
    const parts = entityNameParts(name)
    const context = unitContexts.get(unit)
    if (parts.length === 1) {
      const original = context.aliases.get(parts[0]) ?? parts[0]
      if (capabilityIssuers.has(original)) return true
      return valueCarriesIdentifier(parts[0], unit, atNode, new Set(seen))
    }
    if (context.namespaces.has(parts[0]) && capabilityIssuers.has(parts.at(-1))) return true
    return valueCarriesProperty(parts, unit, atNode, seen)
  }

  function valueCarriesProperty(parts, unit, atNode, seen) {
    const context = unitContexts.get(unit)
    const entry = resolveDeclaration(parts[0], atNode, context.semantic)
    const initializer = declarationInitializer(entry, atNode, context.semantic)
    if (!initializer) return false
    let expression = unwrapExpression(initializer.expression)
    for (const part of parts.slice(1)) {
      if (!ts.isObjectLiteralExpression(expression)) return false
      const property = expression.properties.find(candidate => candidate.name
        && propertyNameText(candidate.name, unit, context.semantic, candidate) === part)
      if (!property) return false
      if (ts.isPropertyAssignment(property)) expression = unwrapExpression(property.initializer)
      else if (ts.isMethodDeclaration(property)) expression = property
      else return false
    }
    return expressionCarries(expression, unit, atNode, seen)
  }

  function expressionCarries(node, unit, atNode, seen, extracted = null) {
    const expression = unwrapExpression(node)
    const context = unitContexts.get(unit)
    if (extracted && ts.isIdentifier(expression)) {
      return valueCarriesProperty([expression.text, extracted], unit, atNode, seen)
    }
    if (ts.isCallExpression(expression)) {
      const identity = callIdentity(expression.expression)
      const original = identity ? context.aliases.get(identity) ?? identity : null
      if (original && capabilityIssuers.has(original)) return true
    }
    if (ts.isIdentifier(expression)) {
      return valueCarriesIdentifier(expression.text, unit, expression, new Set(seen))
    }
    if (ts.isPropertyAccessExpression(expression)) {
      return entityNameCarries(expression.name, unit, expression, seen)
        || valueCarriesProperty(
          expression.getText(unit.sourceFile).split("."),
          unit,
          expression,
          seen
        )
    }
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)
      || ts.isMethodDeclaration(expression)) {
      if (expression.type && typeCarries(expression.type, unit, expression, seen)) return true
      if (ts.isBlock(expression.body)) {
        let carries = false
        visitAst(expression.body, candidate => {
          if (ts.isReturnStatement(candidate) && candidate.expression
            && expressionCarries(candidate.expression, unit, candidate, seen)) carries = true
        })
        return carries
      }
      return expressionCarries(expression.body, unit, expression, seen)
    }
    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
      return typeCarries(expression.type, unit, expression, seen)
    }
    return false
  }

  function functionParameterCarries(name, index, unit, atNode, seen) {
    const parts = entityNameParts(name)
    if (parts.length !== 1) return false
    const context = unitContexts.get(unit)
    const entry = resolveDeclaration(parts[0], atNode, context.semantic)
    let functionNode = entry?.node
    if (functionNode && ts.isVariableDeclaration(functionNode)) {
      functionNode = functionNode.initializer
    }
    return Boolean(functionNode && ts.isFunctionLike(functionNode)
      && functionNode.parameters[index]?.type
      && typeCarries(functionNode.parameters[index].type, unit, functionNode.parameters[index], seen))
  }

  function selectedPropertyType(
    objectType,
    property,
    unit,
    atNode,
    seen,
    substitutions
  ) {
    if (ts.isParenthesizedTypeNode(objectType) || ts.isTypeOperatorNode(objectType)) {
      return selectedPropertyType(
        objectType.type,
        property,
        unit,
        atNode,
        seen,
        substitutions
      )
    }
    if (ts.isTypeLiteralNode(objectType)) {
      const member = objectType.members.find(candidate => (
        declaredPropertyName(candidate) === property
      ))
      return member?.type
        ? { node: member.type, unit, substitutions }
        : null
    }
    if (!ts.isTypeReferenceNode(objectType)) return null
    const context = unitContexts.get(unit)
    const localName = simpleTypeName(objectType.typeName)
    const originalName = localName ? context.aliases.get(localName) ?? localName : null
    if (!originalName) return null
    if (["NonNullable", "Readonly", "Required", "Partial"].includes(originalName)
      && objectType.typeArguments?.[0]) {
      return selectedPropertyType(
        objectType.typeArguments[0],
        property,
        unit,
        atNode,
        seen,
        substitutions
      )
    }
    for (const declaration of declarationsFor(originalName, unit, localName ?? originalName)) {
      if (ts.isTypeAliasDeclaration(declaration.node)
        && !ts.isTypeLiteralNode(declaration.node.type)) {
        const nested = selectedPropertyType(
          declaration.node.type,
          property,
          declaration.unit,
          declaration.node,
          seen,
          substitutions
        )
        if (nested) return nested
        continue
      }
      const member = declaredMembers(declaration)
        .find(candidate => declaredPropertyName(candidate) === property)
      if (!member?.type) continue
      const memberSubstitutions = new Map(substitutions)
      declaration.node.typeParameters?.forEach((parameter, index) => {
        const argument = objectType.typeArguments?.[index]
        if (argument) {
          memberSubstitutions.set(parameter.name.text, { node: argument, unit, substitutions })
        }
      })
      return { node: member.type, unit: declaration.unit, substitutions: memberSubstitutions }
    }
    return null
  }

  function propertyCarries(
    objectType,
    property,
    unit,
    atNode,
    seen,
    substitutions = new Map()
  ) {
    const context = unitContexts.get(unit)
    if (ts.isParenthesizedTypeNode(objectType) || ts.isTypeOperatorNode(objectType)) {
      return propertyCarries(objectType.type, property, unit, atNode, seen, substitutions)
    }
    if (ts.isUnionTypeNode(objectType) || ts.isIntersectionTypeNode(objectType)) {
      const results = objectType.types.map(type => (
        propertyCarries(type, property, unit, atNode, seen, substitutions)
      ))
      return results.some(result => result === null) ? null : results.some(Boolean)
    }
    if (ts.isIndexedAccessTypeNode(objectType)) {
      const selectedProperty = indexedPropertyName(objectType.indexType)
      if (selectedProperty === null) return null
      const selection = selectedPropertyType(
        objectType.objectType,
        selectedProperty,
        unit,
        atNode,
        seen,
        substitutions
      )
      return selection
        ? propertyCarries(
            selection.node,
            property,
            selection.unit,
            selection.node,
            seen,
            selection.substitutions
          )
        : null
    }
    if (ts.isTypeLiteralNode(objectType)) {
      const member = objectType.members.find(candidate => declaredPropertyName(candidate) === property)
      return member ? Boolean(member.type
        && typeCarries(member.type, unit, member, seen, substitutions)) : false
    }
    if (!ts.isTypeReferenceNode(objectType)) return null
    const localName = simpleTypeName(objectType.typeName)
    const originalName = localName ? context.aliases.get(localName) ?? localName : null
    if (!originalName) return null
    if (["NonNullable", "Readonly", "Required", "Partial"].includes(originalName)
      && objectType.typeArguments?.[0]) {
      return propertyCarries(
        objectType.typeArguments[0],
        property,
        unit,
        atNode,
        seen,
        substitutions
      )
    }
    if (originalName === "Parameters" && objectType.typeArguments?.[0]
      && ts.isTypeQueryNode(objectType.typeArguments[0]) && /^\d+$/u.test(property)) {
      return functionParameterCarries(
        objectType.typeArguments[0].exprName,
        Number(property),
        unit,
        atNode,
        seen
      )
    }
    const matchingDeclarations = declarationsFor(originalName, unit, localName ?? originalName)
    if (matchingDeclarations.length === 0) return null
    let resolved = false
    for (const declaration of matchingDeclarations) {
      if (ts.isTypeAliasDeclaration(declaration.node)) {
        if (ts.isMappedTypeNode(declaration.node.type)) {
          const mappedSubstitutions = new Map(substitutions)
          mappedSubstitutions.set(declaration.node.type.typeParameter.name.text, {
            literal: property
          })
          resolved = resolved || Boolean(declaration.node.type.type
            && typeCarries(
              declaration.node.type.type,
              declaration.unit,
              declaration.node,
              seen,
              mappedSubstitutions
            ))
          continue
        }
        if (!ts.isTypeLiteralNode(declaration.node.type)) {
          const nested = propertyCarries(
            declaration.node.type,
            property,
            declaration.unit,
            declaration.node,
            seen,
            substitutions
          )
          if (nested !== null) resolved = resolved || nested
          continue
        }
      }
      const member = declaredMembers(declaration)
        .find(candidate => declaredPropertyName(candidate) === property)
      if (!member?.type) continue
      const memberSubstitutions = new Map(substitutions)
      declaration.node.typeParameters?.forEach((parameter, index) => {
        const argument = objectType.typeArguments?.[index]
        if (argument) {
          memberSubstitutions.set(parameter.name.text, { node: argument, unit, substitutions })
        }
      })
      resolved = resolved || typeCarries(
        member.type,
        declaration.unit,
        member,
        seen,
        memberSubstitutions
      )
    }
    return resolved
  }

  function assignmentTargetCarries(target, unit, atNode) {
    const context = unitContexts.get(unit)
    const properties = []
    let current = unwrapExpression(target)
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      const property = ts.isPropertyAccessExpression(current)
        ? current.name.text
        : current.argumentExpression
          ? constantString(current.argumentExpression, unit, context.semantic, atNode)
          : null
      properties.unshift(property)
      current = unwrapExpression(current.expression)
    }
    if (!ts.isIdentifier(current)) return null
    const entry = resolveDeclaration(current.text, atNode, context.semantic)
    if (!entry?.node.type) return null
    if (properties.length === 0) return typeCarries(entry.node.type, unit, atNode)
    let selection = {
      node: entry.node.type,
      substitutions: new Map(),
      unit
    }
    for (let index = 0; index < properties.length; index += 1) {
      const property = properties[index]
      if (property === null) {
        return typeCarries(
          selection.node,
          selection.unit,
          atNode,
          new Set(),
          selection.substitutions
        )
      }
      if (index === properties.length - 1) {
        return propertyCarries(
          selection.node,
          property,
          selection.unit,
          atNode,
          new Set(),
          selection.substitutions
        )
      }
      const next = selectedPropertyType(
        selection.node,
        property,
        selection.unit,
        atNode,
        new Set(),
        selection.substitutions
      )
      if (!next) return null
      selection = next
    }
    return null
  }

  let changed = true
  while (changed) {
    changed = false
    for (const declaration of declarations) {
      if (!taintedDeclarations.has(declaration) && declarationCarries(declaration)) {
        taintedDeclarations.add(declaration)
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
    if (!initializer) return identity
    const resolved = resolvedCallIdentity(initializer.expression, unit, atNode, seen) ?? identity
    return initializer.extracted ? `${resolved}.${initializer.extracted}` : resolved
  }

  for (const unit of units) {
    visitAst(unit.sourceFile, node => {
      const application = ts.isCallExpression(node) && node.typeArguments?.length
        ? { expression: node.expression, typeArguments: node.typeArguments }
        : ts.isExpressionWithTypeArguments(node) && node.typeArguments?.length
          && !ts.isHeritageClause(node.parent)
          ? { expression: node.expression, typeArguments: node.typeArguments }
          : null
      if (!application) return
      const identity = resolvedCallIdentity(application.expression, unit, node)
      if (!identity) return
      for (const declaration of genericFunctions.get(identity) ?? []) {
        const targetContext = unitContexts.get(declaration.unit)
        const names = targetContext.taintedGenericParameters.get(declaration.node) ?? new Set()
        application.typeArguments.forEach((argument, index) => {
          if (typeCarries(argument, unit, node)) {
            const parameter = declaration.node.typeParameters?.[index]
            if (parameter) names.add(parameter.name.text)
          }
        })
        targetContext.taintedGenericParameters.set(declaration.node, names)
      }
    })
  }

  return { assignmentTargetCarries, propertyCarries, typeCarries, unitContexts }
}

function auditCapabilityAssertions(record, registry) {
  if (record.relativePath === capabilityPath) return
  for (const unit of record.units) {
    visitAst(unit.sourceFile, node => {
      if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return
      if (!registry.typeCarries(node.type, unit, node)) return
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + node.getStart(unit.sourceFile)
        ),
        "capability assertions are limited to the private capability helper"
      )
    })
  }
}

function checkerTypeIsAny(unit, node) {
  let context = checkerContexts.get(unit)
  if (!context) {
    const virtualPath = resolve(
      root,
      ".architecture-policy",
      `${unit.record.relativePath.replace(/[^a-zA-Z0-9_.-]/gu, "_")}-${unit.sourceOffset}.ts`
    )
    const options = {
      allowJs: true,
      checkJs: true,
      noEmit: true,
      noResolve: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ESNext
    }
    const host = ts.createCompilerHost(options)
    const defaultGetSourceFile = host.getSourceFile.bind(host)
    host.fileExists = fileName => fileName === virtualPath || ts.sys.fileExists(fileName)
    host.readFile = fileName => fileName === virtualPath
      ? unit.sourceFile.text
      : ts.sys.readFile(fileName)
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => (
      fileName === virtualPath
        ? ts.createSourceFile(
            virtualPath,
            unit.sourceFile.text,
            languageVersion,
            true,
            unit.scriptKind
          )
        : defaultGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    )
    const program = ts.createProgram([virtualPath], options, host)
    context = {
      checker: program.getTypeChecker(),
      sourceFile: program.getSourceFile(virtualPath)
    }
    checkerContexts.set(unit, context)
  }
  if (!context.sourceFile) return false
  const expectedStart = node.getStart(unit.sourceFile)
  let matchingNode = null
  visitAst(context.sourceFile, candidate => {
    if (matchingNode || candidate.kind !== node.kind) return
    if (candidate.getStart(context.sourceFile) === expectedStart) matchingNode = candidate
  })
  return Boolean(matchingNode
    && (context.checker.getTypeAtLocation(matchingNode).flags & ts.TypeFlags.Any) !== 0)
}

function explicitAnyType(node, unit, semantic, seen = new Set()) {
  if (!node) return false
  if (node.kind === ts.SyntaxKind.AnyKeyword) return true
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)
    || ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
    return explicitAnyType(node.type, unit, semantic, seen)
  }
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    return node.types.some(type => explicitAnyType(type, unit, semantic, seen))
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    && !seen.has(node.typeName.text)) {
    const nextSeen = new Set(seen).add(node.typeName.text)
    let alias = null
    visitAst(unit.sourceFile, candidate => {
      if (!alias && ts.isTypeAliasDeclaration(candidate)
        && candidate.name.text === node.typeName.text) alias = candidate
    })
    return Boolean(alias && explicitAnyType(alias.type, unit, semantic, nextSeen))
  }
  return false
}

function propertyTypeIsExplicitAny(node, property, unit, semantic, seen = new Set()) {
  if (!node) return false
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
    return propertyTypeIsExplicitAny(node.type, property, unit, semantic, seen)
  }
  if (ts.isTypeLiteralNode(node)) {
    const member = node.members.find(candidate => candidate.name
      && propertyNameText(candidate.name, unit, semantic, candidate) === property)
    return Boolean(member?.type && explicitAnyType(member.type, unit, semantic, seen))
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    && !seen.has(node.typeName.text)) {
    const nextSeen = new Set(seen).add(node.typeName.text)
    let alias = null
    visitAst(unit.sourceFile, candidate => {
      if (!alias && ts.isTypeAliasDeclaration(candidate)
        && candidate.name.text === node.typeName.text) alias = candidate
    })
    return Boolean(alias
      && propertyTypeIsExplicitAny(alias.type, property, unit, semantic, nextSeen))
  }
  return false
}

function methodReturnIsExplicitAny(node, method, unit, semantic, seen = new Set()) {
  if (!node) return false
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
    return methodReturnIsExplicitAny(node.type, method, unit, semantic, seen)
  }
  if (ts.isTypeLiteralNode(node)) {
    const member = node.members.find(candidate => candidate.name
      && propertyNameText(candidate.name, unit, semantic, candidate) === method)
    if (member && (ts.isMethodSignature(member) || ts.isMethodDeclaration(member))) {
      return explicitAnyType(member.type, unit, semantic, seen)
    }
    if (member && ts.isPropertySignature(member) && member.type
      && ts.isFunctionTypeNode(member.type)) {
      return explicitAnyType(member.type.type, unit, semantic, seen)
    }
    return false
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    && !seen.has(node.typeName.text)) {
    const nextSeen = new Set(seen).add(node.typeName.text)
    let alias = null
    visitAst(unit.sourceFile, candidate => {
      if (!alias && ts.isTypeAliasDeclaration(candidate)
        && candidate.name.text === node.typeName.text) alias = candidate
    })
    return Boolean(alias
      && methodReturnIsExplicitAny(alias.type, method, unit, semantic, nextSeen))
  }
  return false
}

function declarationExplicitlyReturnsAny(node, unit, semantic) {
  if (ts.isFunctionLike(node)) return explicitAnyType(node.type, unit, semantic)
  if (!ts.isVariableDeclaration(node)) return false
  if (node.type && ts.isFunctionTypeNode(node.type)) {
    return explicitAnyType(node.type.type, unit, semantic)
  }
  const initializer = node.initializer && unwrapExpression(node.initializer)
  return Boolean(initializer && ts.isFunctionLike(initializer)
    && explicitAnyType(initializer.type, unit, semantic))
}

function expressionIsAny(node, unit, semantic, atNode = node, seen = new Set()) {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    if (node.type.kind === ts.SyntaxKind.AnyKeyword) return true
    return expressionIsAny(node.expression, unit, semantic, atNode, seen)
  }
  const expression = unwrapExpression(node)
  if (ts.isCallExpression(expression)
    && callIdentity(expression.expression) === "JSON.parse") return true
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = unwrapExpression(expression.expression)
    if (ts.isIdentifier(owner)) {
      const entry = resolveDeclaration(owner.text, atNode, semantic)
      if (entry?.node.type && propertyTypeIsExplicitAny(
        entry.node.type,
        expression.name.text,
        unit,
        semantic
      )) return true
    }
    return expressionIsAny(expression.expression, unit, semantic, atNode, seen)
  }
  if (ts.isElementAccessExpression(expression)) {
    const owner = unwrapExpression(expression.expression)
    const property = expression.argumentExpression
      ? constantString(expression.argumentExpression, unit, semantic, atNode)
      : null
    if (property !== null && ts.isIdentifier(owner)) {
      const entry = resolveDeclaration(owner.text, atNode, semantic)
      if (entry?.node.type && propertyTypeIsExplicitAny(
        entry.node.type,
        property,
        unit,
        semantic
      )) return true
    }
    return expressionIsAny(expression.expression, unit, semantic, atNode, seen)
  }
  if (ts.isAwaitExpression(expression)) {
    return expressionIsAny(expression.expression, unit, semantic, atNode, seen)
  }
  if (ts.isConditionalExpression(expression)) {
    return expressionIsAny(expression.whenTrue, unit, semantic, atNode, new Set(seen))
      || expressionIsAny(expression.whenFalse, unit, semantic, atNode, new Set(seen))
  }
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
    const entry = resolveDeclaration(expression.expression.text, expression, semantic)
    if (entry && !ts.isImportSpecifier(entry.node)
      && declarationExplicitlyReturnsAny(entry.node, unit, semantic)
      && checkerTypeIsAny(unit, expression)) {
      return true
    }
  }
  if (ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)) {
    const owner = unwrapExpression(expression.expression.expression)
    if (ts.isIdentifier(owner)) {
      const entry = resolveDeclaration(owner.text, atNode, semantic)
      if (entry?.node.type && methodReturnIsExplicitAny(
        entry.node.type,
        expression.expression.name.text,
        unit,
        semantic
      )) return true
    }
  }
  if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
    seen.add(expression.text)
    const entry = resolveDeclaration(expression.text, atNode, semantic)
    if (entry?.node.type && explicitAnyType(entry.node.type, unit, semantic)) return true
    const initializer = declarationInitializer(entry, atNode, semantic)
    return Boolean(initializer
      && expressionIsAny(initializer.expression, unit, semantic, atNode, seen))
  }
  return false
}

function auditDirectCapabilityFlows(record, registry) {
  if (!isProductionPath(record.relativePath) || record.relativePath === capabilityPath) return
  for (const unit of record.units) {
    const semantic = buildSemantic(unit)
    visitAst(unit.sourceFile, node => {
      let targetType = null
      let exactTargetCarries = null
      let source = null
      if (ts.isVariableDeclaration(node) && node.type && node.initializer) {
        targetType = node.type
        source = node.initializer
      } else if (ts.isArrowFunction(node) && node.type && !ts.isBlock(node.body)) {
        targetType = node.type
        source = node.body
      } else if (ts.isReturnStatement(node) && node.expression) {
        targetType = enclosingFunction(node)?.type ?? null
        source = node.expression
      } else if (ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (ts.isIdentifier(unwrapExpression(node.left))
          || ts.isPropertyAccessExpression(unwrapExpression(node.left))
          || ts.isElementAccessExpression(unwrapExpression(node.left)))) {
        const target = unwrapExpression(node.left)
        exactTargetCarries = registry.assignmentTargetCarries(target, unit, node)
        source = node.right
      }
      const targetCarries = exactTargetCarries ?? Boolean(
        targetType && registry.typeCarries(targetType, unit, node)
      )
      if (!targetCarries || !source
        || !expressionIsAny(source, unit, semantic, node)) return
      addViolation(
        record.relativePath,
        lineNumberAt(
          record.source,
          unit.sourceOffset + node.getStart(unit.sourceFile)
        ),
        "capability values must originate from a reviewed issuer"
      )
    })
  }
}

function compactNodeText(node, sourceFile) {
  return node?.getText(sourceFile).replace(/\s+/gu, "") ?? ""
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === kind))
}

function singleReturnExpression(declaration) {
  if (!declaration.body || declaration.body.statements.length !== 1) return null
  const statement = declaration.body.statements[0]
  return ts.isReturnStatement(statement) && statement.expression
    ? unwrapExpression(statement.expression)
    : null
}

function directCapabilityCall(declaration, sourceFile, expectedType) {
  const expression = singleReturnExpression(declaration)
  if (!expression || !ts.isCallExpression(expression)
    || !ts.isIdentifier(expression.expression)
    || expression.expression.text !== "capability"
    || expression.typeArguments?.length !== 1
    || compactNodeText(expression.typeArguments[0], sourceFile) !== expectedType.replace(/\s+/gu, "")) {
    return null
  }
  return expression.arguments.length === 1 ? unwrapExpression(expression.arguments[0]) : null
}

function isIdentifierParameter(parameter, name, typeText, sourceFile) {
  return ts.isIdentifier(parameter.name)
    && parameter.name.text === name
    && !parameter.dotDotDotToken
    && !parameter.questionToken
    && !parameter.initializer
    && compactNodeText(parameter.type, sourceFile) === typeText.replace(/\s+/gu, "")
}

function validCapabilityHelper(declaration, sourceFile) {
  if (!declaration
    || hasModifier(declaration, ts.SyntaxKind.ExportKeyword)
    || hasModifier(declaration, ts.SyntaxKind.DefaultKeyword)
    || declaration.typeParameters?.length !== 1
    || declaration.parameters.length !== 1
    || compactNodeText(declaration.type, sourceFile) !== "T") return false
  const typeParameter = declaration.typeParameters[0]
  if (!ts.isIdentifier(typeParameter.name)
    || typeParameter.name.text !== "T"
    || compactNodeText(typeParameter.constraint, sourceFile) !== "RenderableCapability"
    || !isIdentifierParameter(declaration.parameters[0], "value", "string", sourceFile)) return false
  const statement = declaration.body?.statements[0]
  const expression = statement && ts.isReturnStatement(statement)
    ? statement.expression
    : null
  return Boolean(expression
    && ts.isAsExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === "value"
    && compactNodeText(expression.type, sourceFile) === "T")
}

function validCapabilityIssuer(declaration, sourceFile, expectedType) {
  if (!declaration
    || !hasModifier(declaration, ts.SyntaxKind.ExportKeyword)
    || hasModifier(declaration, ts.SyntaxKind.DefaultKeyword)
    || declaration.typeParameters?.length
    || declaration.parameters.length !== 1
    || compactNodeText(declaration.type, sourceFile) !== expectedType.replace(/\s+/gu, "")
    || !isIdentifierParameter(declaration.parameters[0], "value", "string", sourceFile)) return false
  const argument = directCapabilityCall(declaration, sourceFile, expectedType)
  return Boolean(argument && ts.isIdentifier(argument) && argument.text === "value")
}

function validEmptyRenderableHtml(declaration, sourceFile) {
  if (!declaration
    || !hasModifier(declaration, ts.SyntaxKind.ExportKeyword)
    || declaration.typeParameters?.length !== 1
    || declaration.parameters.length !== 0
    || compactNodeText(declaration.type, sourceFile) !== "Value") return false
  const typeParameter = declaration.typeParameters[0]
  const argument = directCapabilityCall(declaration, sourceFile, "Value")
  return ts.isIdentifier(typeParameter.name)
    && typeParameter.name.text === "Value"
    && compactNodeText(typeParameter.constraint, sourceFile) === "RenderableHtml"
    && Boolean(argument && ts.isStringLiteral(argument) && argument.text === "")
}

function validJoinReaderSourceRows(declaration, sourceFile) {
  const expectedType = 'SanitizedHtml<"reader-source-info">'
  if (!declaration
    || !hasModifier(declaration, ts.SyntaxKind.ExportKeyword)
    || declaration.typeParameters?.length
    || declaration.parameters.length !== 1
    || !isIdentifierParameter(
      declaration.parameters[0],
      "values",
      `readonly ${expectedType}[]`,
      sourceFile
    )
    || compactNodeText(declaration.type, sourceFile) !== expectedType.replace(/\s+/gu, "")) return false
  const argument = directCapabilityCall(declaration, sourceFile, expectedType)
  return Boolean(argument
    && ts.isCallExpression(argument)
    && ts.isPropertyAccessExpression(argument.expression)
    && ts.isIdentifier(argument.expression.expression)
    && argument.expression.expression.text === "values"
    && argument.expression.name.text === "join"
    && argument.arguments.length === 1
    && ts.isStringLiteral(argument.arguments[0])
    && argument.arguments[0].text === "<br>")
}

function validTransformManagedReaderHtml(declaration, sourceFile) {
  const expectedType = 'ManagedAssetHtml<"reader-etext">'
  if (!declaration
    || !hasModifier(declaration, ts.SyntaxKind.ExportKeyword)
    || declaration.typeParameters?.length
    || declaration.parameters.length !== 2
    || !isIdentifierParameter(declaration.parameters[0], "value", expectedType, sourceFile)
    || !isIdentifierParameter(
      declaration.parameters[1],
      "transform",
      "(value: string) => string",
      sourceFile
    )
    || compactNodeText(declaration.type, sourceFile) !== expectedType.replace(/\s+/gu, "")) return false
  const argument = directCapabilityCall(declaration, sourceFile, expectedType)
  return Boolean(argument
    && ts.isCallExpression(argument)
    && ts.isIdentifier(argument.expression)
    && argument.expression.text === "transform"
    && argument.arguments.length === 1
    && ts.isIdentifier(argument.arguments[0])
    && argument.arguments[0].text === "value")
}

function validCapabilityTypeImport(statement) {
  if (!ts.isImportDeclaration(statement)
    || statement.moduleSpecifier.text !== "../types/renderable-html"
    || !statement.importClause?.isTypeOnly
    || statement.importClause.name
    || !statement.importClause.namedBindings
    || !ts.isNamedImports(statement.importClause.namedBindings)) return false
  const imported = statement.importClause.namedBindings.elements.map(element => {
    if (element.propertyName || element.isTypeOnly) return null
    return element.name.text
  })
  return imported.every(Boolean)
    && imported.length === capabilityTypes.size
    && imported.every(name => capabilityTypes.has(name))
}

function auditCapabilityUtility(record) {
  const unit = record.units[0]
  let valid = Boolean(unit)
  if (unit) {
    const declarations = new Map()
    let importCount = 0
    for (const statement of unit.sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        importCount += 1
        valid &&= validCapabilityTypeImport(statement)
        continue
      }
      if (!ts.isFunctionDeclaration(statement) || !statement.name
        || declarations.has(statement.name.text)) {
        valid = false
        continue
      }
      declarations.set(statement.name.text, statement)
    }
    valid &&= importCount === 1
    const expectedNames = new Set([
      "capability",
      ...capabilityIssuerReturnTypes.keys(),
      ...capabilityUtilityNames
    ])
    valid &&= declarations.size === expectedNames.size
      && [...declarations.keys()].every(name => expectedNames.has(name))
    valid &&= validCapabilityHelper(declarations.get("capability"), unit.sourceFile)
    for (const [name, returnType] of capabilityIssuerReturnTypes) {
      valid &&= validCapabilityIssuer(declarations.get(name), unit.sourceFile, returnType)
    }
    valid &&= validEmptyRenderableHtml(declarations.get("emptyRenderableHtml"), unit.sourceFile)
    valid &&= validJoinReaderSourceRows(declarations.get("joinReaderSourceRows"), unit.sourceFile)
    valid &&= validTransformManagedReaderHtml(
      declarations.get("transformManagedReaderHtml"),
      unit.sourceFile
    )
  }
  if (!valid) {
    addViolation(record.relativePath, 1, "capability utility must equal the reviewed structural surface")
  }
}

function staticPropertyName(property) {
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) {
    return property.name.text
  }
  return null
}

function validEslintRuleSeverity(expression) {
  const severity = unwrapExpression(expression)
  return (ts.isStringLiteralLike(severity) && severity.text === "error")
    || (ts.isNumericLiteral(severity) && severity.text === "2")
}

function validDeepConditionalRule(expression) {
  const configuration = unwrapExpression(expression)
  if (!ts.isArrayLiteralExpression(configuration) || configuration.elements.length !== 2) {
    return false
  }
  const [severity, restrictionExpression] = configuration.elements
  if (!severity || !validEslintRuleSeverity(severity) || !restrictionExpression) return false
  const restriction = unwrapExpression(restrictionExpression)
  if (!ts.isObjectLiteralExpression(restriction) || restriction.properties.length !== 2) return false
  const values = new Map()
  for (const property of restriction.properties) {
    if (!ts.isPropertyAssignment(property)) return false
    const name = staticPropertyName(property)
    const value = unwrapExpression(property.initializer)
    if (name === null || values.has(name) || !ts.isStringLiteralLike(value)) return false
    values.set(name, value.text)
  }
  return values.get("selector") === deepConditionalSelector
    && values.get("message") === deepConditionalMessage
}

function validEslintRules(expression) {
  const rules = unwrapExpression(expression)
  if (!ts.isObjectLiteralExpression(rules)) return false
  const names = new Set()
  for (const property of rules.properties) {
    if (!ts.isPropertyAssignment(property)) return false
    const name = staticPropertyName(property)
    if (name === null || names.has(name)) return false
    names.add(name)
    const configuration = unwrapExpression(property.initializer)
    if (deepConditionalRuleNames.has(name)) {
      if (!validDeepConditionalRule(configuration)) return false
      continue
    }
    const severity = ts.isArrayLiteralExpression(configuration)
      ? configuration.elements[0]
      : configuration
    if (!severity || !validEslintRuleSeverity(severity)) return false
  }
  return [...deepConditionalRuleNames].every(name => names.has(name))
    && [...requiredSonarRules].every(name => names.has(name))
    && [...requiredTailwindRules].every(name => names.has(name))
}

function validDefaultImport(statement, moduleName, bindingName) {
  return ts.isImportDeclaration(statement)
    && statement.moduleSpecifier.text === moduleName
    && statement.importClause?.name?.text === bindingName
    && !statement.importClause.namedBindings
}

function validEslintPlugins(expression) {
  const plugins = unwrapExpression(expression)
  return ts.isObjectLiteralExpression(plugins)
    && plugins.properties.length === 2
    && plugins.properties.every(property => ts.isShorthandPropertyAssignment(property))
    && plugins.properties[0].name.text === "sonarjs"
    && plugins.properties[1].name.text === "tailwindcss"
}

function validEslintConfigSource(source) {
  const sourceFile = ts.createSourceFile(
    "eslint.config.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  if (sourceFile.parseDiagnostics.length > 0 || sourceFile.statements.length !== 4) return false
  const [sonarImport, tailwindImport, nuxtImport, exportStatement] = sourceFile.statements
  if (!validDefaultImport(sonarImport, "eslint-plugin-sonarjs", "sonarjs")
    || !validDefaultImport(tailwindImport, "eslint-plugin-tailwindcss", "tailwindcss")
    || !validDefaultImport(nuxtImport, "./.nuxt/eslint.config.mjs", "withNuxt")
    || !ts.isExportAssignment(exportStatement)
    || exportStatement.isExportEquals) return false
  const expression = unwrapExpression(exportStatement.expression)
  if (!ts.isCallExpression(expression)
    || !ts.isIdentifier(expression.expression)
    || expression.expression.text !== "withNuxt"
    || expression.arguments.length !== 1) return false
  const config = unwrapExpression(expression.arguments[0])
  if (!ts.isObjectLiteralExpression(config)) return false
  const properties = new Map()
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property)) return false
    const name = staticPropertyName(property)
    if (name === null || properties.has(name)) return false
    properties.set(name, unwrapExpression(property.initializer))
  }
  if ([...properties.keys()].some(name => name !== "plugins" && name !== "ignores" && name !== "rules")) {
    return false
  }
  const plugins = properties.get("plugins")
  if (!plugins || !validEslintPlugins(plugins)) return false
  const ignores = properties.get("ignores")
  if (!ignores || !ts.isArrayLiteralExpression(ignores)
    || ignores.elements.length !== requiredEslintIgnores.size) return false
  const rules = properties.get("rules")
  if (!rules || !validEslintRules(rules)) return false
  const values = ignores.elements.map(element => ts.isStringLiteralLike(element) ? element.text : null)
  return values.every(value => value !== null && requiredEslintIgnores.has(value))
    && new Set(values).size === requiredEslintIgnores.size
}

function auditEslintConfig() {
  const relativePath = "eslint.config.mjs"
  try {
    if (!validEslintConfigSource(readFileSync(resolve(root, relativePath), "utf8"))) {
      addViolation(relativePath, 1, "ESLint configuration must equal the canonical reviewed file")
    }
  } catch {
    addViolation(relativePath, 0, "ESLint configuration is missing")
  }
}

function auditSemanticReviewConfig() {
  const packagePath = "package.json"
  try {
    const manifest = JSON.parse(readFileSync(resolve(root, packagePath), "utf8"))
    const scripts = manifest?.scripts
    const valid = scripts && typeof scripts === "object" && !Array.isArray(scripts)
      && Object.entries(requiredSemanticReviewScripts)
        .every(([name, command]) => scripts[name] === command)
    if (!valid) {
      addViolation(packagePath, 0, "semantic review commands must equal the reviewed contract")
    }
  } catch {
    addViolation(packagePath, 0, "semantic review commands must equal the reviewed contract")
  }

  const ledgerPath = "quality/semantic-review-ledger.json"
  try {
    const ledger = JSON.parse(readFileSync(resolve(root, ledgerPath), "utf8"))
    const pathsAreCanonical = ledger?.version === 1
      && Array.isArray(ledger.records)
      && ledger.records.every(record => typeof record?.evidencePath === "string"
        && /^quality\/semantic-reviews\/[a-z0-9][a-z0-9._-]*\.json$/u.test(record.evidencePath)
        && !record.evidencePath.split("/").includes(".."))
    if (!pathsAreCanonical) {
      addViolation(ledgerPath, 0, "evidence paths must stay under quality/semantic-reviews")
    }
  } catch {
    addViolation(ledgerPath, 0, "evidence paths must stay under quality/semantic-reviews")
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
    const record = {
      relativePath,
      source,
      units: [],
      htmlComments: [],
      template: null,
      styles: []
    }
    parseRecord(record)
    sourceRecords.push(record)
  }
}

walk(root)
auditEslintConfig()
auditSemanticReviewConfig()
const capabilityRegistry = buildCapabilityRegistry(sourceRecords)
for (const record of sourceRecords) {
  auditComments(record)
  auditLegacyReaderEditorMetadata(record)
  auditLbApiClientCapability(record)
  auditVueTemplate(record)
  auditChronologyRangeOwnership(record)
  auditCrossEngineRangePointerSupport(record)
  auditDomOperations(record)
  auditNativeVNodeCalls(record)
  if (record.relativePath === capabilityPath) auditCapabilityUtility(record)
  else {
    auditCapabilityAssertions(record, capabilityRegistry)
    auditDirectCapabilityFlows(record, capabilityRegistry)
  }
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
