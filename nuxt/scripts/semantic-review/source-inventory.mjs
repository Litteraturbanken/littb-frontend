import { readFileSync, readdirSync } from "node:fs"
import { extname, relative, resolve, sep } from "node:path"

import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

import { listSourceUnits } from "../maintainability/unit-attribution.mjs"

const authoredExtensions = new Set([".vue", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function normalizedPath(path) {
  return path.split(sep).join("/")
}

function isAuthoredPath(path) {
  return /^(?:app|server|shared)\//u.test(path)
    && !path.split("/").includes("..")
    && !path.startsWith("app/lib/api/generated/")
    && !/(?:^|\/)(?:test|tests|fixtures?)(?:\/|$)/u.test(path)
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return walk(path)
    return entry.isFile() ? [path] : []
  })
}

export function discoverAuthoredSources(root) {
  return ["app", "server", "shared"]
    .flatMap(directory => {
      const path = resolve(root, directory)
      try {
        return walk(path)
      } catch (error) {
        if (error?.code === "ENOENT") return []
        throw error
      }
    })
    .map(path => ({
      path: normalizedPath(relative(root, path)),
      source: readFileSync(path, "utf8")
    }))
    .filter(record => isAuthoredPath(record.path) && authoredExtensions.has(extname(record.path)))
    .sort((left, right) => compareText(left.path, right.path))
}

function scriptKind(path, lang = "") {
  const suffix = lang || extname(path).slice(1)
  if (suffix === "tsx") return ts.ScriptKind.TSX
  if (suffix === "jsx") return ts.ScriptKind.JSX
  if (["js", "mjs", "cjs"].includes(suffix)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function scriptBlocks(record) {
  if (!record.path.endsWith(".vue")) return [{ source: record.source, lang: "" }]
  const parsed = parseVueSfc(record.source, { filename: record.path })
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot parse ${record.path}: ${String(parsed.errors[0])}`)
  }
  return [parsed.descriptor.script, parsed.descriptor.scriptSetup]
    .filter(block => block !== null)
    .map(block => ({ source: block.content, lang: block.lang ?? "js" }))
}

function importNames(node) {
  const clause = node.importClause
  if (!clause) return []
  const names = []
  if (clause.name) names.push(clause.name.text)
  const bindings = clause.namedBindings
  if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text)
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) names.push(element.name.text)
  }
  return names.sort(compareText)
}

function declarationNames(node) {
  if (node.name && ts.isIdentifier(node.name)) return [node.name.text]
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map(declaration => declaration.name)
      .filter(ts.isIdentifier)
      .map(identifier => identifier.text)
  }
  return []
}

function moduleSurface(record) {
  const imports = []
  const exports = new Set()
  for (const block of scriptBlocks(record)) {
    const sourceFile = ts.createSourceFile(
      record.path,
      block.source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(record.path, block.lang)
    )
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        imports.push({ source: statement.moduleSpecifier.text, names: importNames(statement) })
      }
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : []
      if (modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const name of declarationNames(statement)) exports.add(name)
        if (modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
          exports.add("default")
        }
      }
      if (ts.isExportDeclaration(statement)) {
        if (!statement.exportClause) exports.add("*")
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) exports.add(element.name.text)
        }
      }
      if (ts.isExportAssignment(statement)) exports.add("default")
    }
  }
  return {
    imports: imports.sort((left, right) => compareText(left.source, right.source)),
    exports: [...exports].sort(compareText)
  }
}

function topLevelName(unit) {
  return unit.name.split(".")[0]
}

export function inventorySource(record) {
  if (!record || typeof record.path !== "string" || typeof record.source !== "string") {
    throw new TypeError("Source record must contain path and source strings")
  }
  if (!isAuthoredPath(record.path) || !authoredExtensions.has(extname(record.path))) {
    throw new Error(`Not an authored production source: ${record.path}`)
  }
  const surface = moduleSurface(record)
  const exported = new Set(surface.exports)
  const units = listSourceUnits({
    source: record.source,
    relativePath: record.path,
    includeFallback: true
  }).map(unit => {
    Object.defineProperty(unit, "exported", {
      value: exported.has(topLevelName(unit)),
      enumerable: true
    })
    return unit
  })
  return {
    path: record.path,
    kind: record.path.endsWith(".vue") ? "vue" : "script",
    source: record.source,
    lineCount: record.source.split(/\r?\n/u).length,
    units,
    imports: surface.imports,
    exports: surface.exports
  }
}

export function canonicalUnitSource(source, unit) {
  if (typeof source !== "string" || !unit || typeof unit !== "object") {
    throw new TypeError("Canonical source requires source text and a unit")
  }
  if (unit.kind === "component" || unit.kind === "module") return source.replaceAll("\r\n", "\n")
  if (typeof unit.canonicalSource === "string" && unit.canonicalSource.length > 0) {
    return unit.canonicalSource.replaceAll("\r\n", "\n")
  }
  return source.split(/\r?\n/u).slice(unit.startLine - 1, unit.endLine).join("\n").trim()
}
