import { createHash } from "node:crypto"
import { basename, extname } from "node:path"

import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

const canonicalPrinter = ts.createPrinter({ removeComments: true })

function scriptKind(path, lang = "") {
  const suffix = lang || extname(path).slice(1)
  if (suffix === "tsx") return ts.ScriptKind.TSX
  if (suffix === "jsx") return ts.ScriptKind.JSX
  if (suffix === "js" || suffix === "mjs" || suffix === "cjs") return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function staticName(node, sourceFile) {
  if (!node) return null
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node)) {
    return node.text
  }
  if (ts.isNumericLiteral(node)) return node.text
  return node.getText(sourceFile)
}

function transparentExpression(node) {
  return ts.isParenthesizedExpression(node)
    || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node)
    || ts.isSatisfiesExpression(node)
    || ts.isNonNullExpression(node)
}

function assignedOwner(node, sourceFile) {
  let current = node
  while (current.parent) {
    const parent = current.parent
    if (transparentExpression(parent) && parent.expression === current) {
      current = parent
      continue
    }
    if (ts.isCallExpression(parent)
      && parent.arguments.length === 1
      && parent.arguments[0] === current) {
      current = parent
      continue
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === current) {
      return staticName(parent.name, sourceFile)
    }
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent))
      && parent.initializer === current) {
      return staticName(parent.name, sourceFile)
    }
    break
  }
  return null
}

function functionIdentity(node, sourceFile) {
  if (ts.isFunctionDeclaration(node)) {
    return node.name ? { kind: "function", name: node.name.text } : null
  }
  if (ts.isMethodDeclaration(node)) {
    const name = staticName(node.name, sourceFile)
    return name ? { kind: "method", name } : null
  }
  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    const name = staticName(node.name, sourceFile)
    return name ? { kind: "accessor", name } : null
  }
  if (ts.isConstructorDeclaration(node)) return { kind: "constructor", name: "constructor" }
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return null
  if (node.name) return { kind: "function", name: node.name.text }
  const name = assignedOwner(node, sourceFile)
  return name ? { kind: "function", name } : null
}

function className(node, sourceFile) {
  if (!ts.isClassDeclaration(node) && !ts.isClassExpression(node)) return null
  if (node.name) return node.name.text
  if (ts.isVariableDeclaration(node.parent)) return staticName(node.parent.name, sourceFile)
  return null
}

function callbackIdentity(node, sourceFile) {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return null
  let current = node
  while (current.parent && transparentExpression(current.parent)) current = current.parent
  const call = current.parent
  if (!ts.isCallExpression(call)) return null
  const argument = call.arguments.indexOf(current)
  if (argument === -1) return null
  const callee = call.expression.getText(sourceFile).replaceAll(/\s+/gu, "")
  if (!callee) return null
  const canonicalCall = canonicalPrinter.printNode(ts.EmitHint.Unspecified, call, sourceFile)
  const structuralHash = createHash("sha256").update(canonicalCall).digest("hex").slice(0, 12)
  return {
    kind: "callback",
    name: `${callee}.callback[${argument + 1}]@${structuralHash}`
  }
}

function qualifiedIdentity(node, sourceFile, callbackCounts) {
  const directIdentity = functionIdentity(node, sourceFile)
  const identity = directIdentity ?? callbackIdentity(node, sourceFile)
  if (!identity) return null
  const qualifiers = []
  for (let parent = node.parent; parent; parent = parent.parent) {
    const enclosingFunction = functionIdentity(parent, sourceFile)
    if (enclosingFunction) qualifiers.push(enclosingFunction.name)
    const enclosingClass = className(parent, sourceFile)
    if (enclosingClass) qualifiers.push(enclosingClass)
  }
  const qualifiedName = [...qualifiers.reverse(), identity.name].join(".")
  if (directIdentity) return { kind: identity.kind, name: qualifiedName }
  const occurrence = (callbackCounts.get(qualifiedName) ?? 0) + 1
  callbackCounts.set(qualifiedName, occurrence)
  const name = `${qualifiedName}#${occurrence}`
  return { kind: identity.kind, name }
}

function sourceLocation(sourceFile, position, offset) {
  const location = sourceFile.getLineAndCharacterOfPosition(position)
  return { line: location.line + 1 + offset, column: location.character + 1 }
}

function unitWithColumns(unit, startColumn, endColumn, canonicalSource = "") {
  Object.defineProperties(unit, {
    startColumn: { value: startColumn },
    endColumn: { value: endColumn },
    canonicalSource: { value: canonicalSource }
  })
  return unit
}

function parseScriptUnits({ source, relativePath, offset, lang }) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(relativePath, lang)
  )
  const units = []
  const callbackCounts = new Map()
  function visit(node) {
    const identity = qualifiedIdentity(node, sourceFile, callbackCounts)
    if (identity) {
      const start = sourceLocation(sourceFile, node.getStart(sourceFile), offset)
      const end = sourceLocation(
        sourceFile,
        Math.max(node.getStart(sourceFile), node.getEnd() - 1),
        offset
      )
      units.push(unitWithColumns({
        id: `${relativePath}::${identity.kind}::${identity.name}`,
        kind: identity.kind,
        name: identity.name,
        path: relativePath,
        startLine: start.line,
        endLine: end.line
      }, start.column, end.column, canonicalPrinter.printNode(
        ts.EmitHint.Unspecified,
        node,
        sourceFile
      ).replaceAll("\r\n", "\n")))
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return units
}

function vueScriptBlocks(source, relativePath) {
  const parsed = parseVueSfc(source, { filename: relativePath })
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot parse ${relativePath}: ${String(parsed.errors[0])}`)
  }
  return [parsed.descriptor.script, parsed.descriptor.scriptSetup]
    .filter(block => block !== null)
    .map(block => ({
      source: block.content,
      relativePath,
      offset: block.loc.start.line - 1,
      lang: block.lang ?? "js"
    }))
}

export function listSourceUnits({ source, relativePath, includeFallback = false }) {
  const blocks = relativePath.endsWith(".vue")
    ? vueScriptBlocks(source, relativePath)
    : [{ source, relativePath, offset: 0, lang: "" }]
  const units = blocks.flatMap(parseScriptUnits)
  if (includeFallback) units.push(fallbackUnit(source, relativePath))
  return units
    .sort((left, right) => left.startLine - right.startLine
      || left.endLine - right.endLine
      || left.kind.localeCompare(right.kind, "en")
      || left.name.localeCompare(right.name, "en"))
}

function fallbackUnit(source, relativePath) {
  const lines = source.split("\n").length
  if (relativePath.endsWith(".vue")) {
    const name = basename(relativePath, ".vue")
    return unitWithColumns({
      id: `${relativePath}::component::${name}`,
      kind: "component",
      name,
      path: relativePath,
      startLine: 1,
      endLine: lines
    }, 1, Math.max(1, source.split("\n").at(-1)?.length ?? 1), source.replaceAll("\r\n", "\n"))
  }
  return unitWithColumns({
    id: `${relativePath}::module::${relativePath}`,
    kind: "module",
    name: relativePath,
    path: relativePath,
    startLine: 1,
    endLine: lines
  }, 1, Math.max(1, source.split("\n").at(-1)?.length ?? 1), source.replaceAll("\r\n", "\n"))
}

export function attributeFindingToUnit({ source, relativePath, line, column = 1 }) {
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    throw new RangeError("Finding line and column must be positive integers")
  }
  const containing = listSourceUnits({ source, relativePath })
    .filter(unit => unit.startLine <= line && line <= unit.endLine
      && (line !== unit.startLine || column >= unit.startColumn)
      && (line !== unit.endLine || column <= unit.endColumn))
    .sort((left, right) => (left.endLine - left.startLine) - (right.endLine - right.startLine)
      || (left.endColumn - left.startColumn) - (right.endColumn - right.startColumn)
      || right.startLine - left.startLine
      || left.id.localeCompare(right.id, "en"))
  return containing[0] ?? fallbackUnit(source, relativePath)
}
