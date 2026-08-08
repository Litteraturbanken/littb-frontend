import { basename, extname } from "node:path"

import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

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
  if (ts.isVariableDeclaration(node.parent)) {
    const name = staticName(node.parent.name, sourceFile)
    return name ? { kind: "function", name } : null
  }
  if (ts.isPropertyAssignment(node.parent)) {
    const name = staticName(node.parent.name, sourceFile)
    return name ? { kind: "function", name } : null
  }
  return null
}

function className(node, sourceFile) {
  if (!ts.isClassDeclaration(node) && !ts.isClassExpression(node)) return null
  if (node.name) return node.name.text
  if (ts.isVariableDeclaration(node.parent)) return staticName(node.parent.name, sourceFile)
  return null
}

function qualifiedIdentity(node, sourceFile) {
  const identity = functionIdentity(node, sourceFile)
  if (!identity) return null
  const qualifiers = []
  for (let parent = node.parent; parent; parent = parent.parent) {
    const enclosingFunction = functionIdentity(parent, sourceFile)
    if (enclosingFunction) qualifiers.push(enclosingFunction.name)
    const enclosingClass = className(parent, sourceFile)
    if (enclosingClass) qualifiers.push(enclosingClass)
  }
  const name = [...qualifiers.reverse(), identity.name].join(".")
  return { kind: identity.kind, name }
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
  function visit(node) {
    const identity = qualifiedIdentity(node, sourceFile)
    if (identity) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 + offset
      const end = sourceFile.getLineAndCharacterOfPosition(Math.max(node.getStart(sourceFile), node.getEnd() - 1)).line + 1 + offset
      units.push({
        id: `${relativePath}::${identity.kind}::${identity.name}`,
        kind: identity.kind,
        name: identity.name,
        path: relativePath,
        startLine: start,
        endLine: end
      })
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

export function listSourceUnits({ source, relativePath }) {
  const blocks = relativePath.endsWith(".vue")
    ? vueScriptBlocks(source, relativePath)
    : [{ source, relativePath, offset: 0, lang: "" }]
  return blocks
    .flatMap(parseScriptUnits)
    .sort((left, right) => left.startLine - right.startLine
      || left.endLine - right.endLine
      || left.kind.localeCompare(right.kind, "en")
      || left.name.localeCompare(right.name, "en"))
}

function fallbackUnit(source, relativePath) {
  const lines = source.split("\n").length
  if (relativePath.endsWith(".vue")) {
    const name = basename(relativePath, ".vue")
    return {
      id: `${relativePath}::component::${name}`,
      kind: "component",
      name,
      path: relativePath,
      startLine: 1,
      endLine: lines
    }
  }
  return {
    id: `${relativePath}::module::${relativePath}`,
    kind: "module",
    name: relativePath,
    path: relativePath,
    startLine: 1,
    endLine: lines
  }
}

export function attributeFindingToUnit({ source, relativePath, line, column = 1 }) {
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    throw new RangeError("Finding line and column must be positive integers")
  }
  const containing = listSourceUnits({ source, relativePath })
    .filter(unit => unit.startLine <= line && line <= unit.endLine)
    .sort((left, right) => (left.endLine - left.startLine) - (right.endLine - right.startLine)
      || right.startLine - left.startLine
      || left.id.localeCompare(right.id, "en"))
  return containing[0] ?? fallbackUnit(source, relativePath)
}
