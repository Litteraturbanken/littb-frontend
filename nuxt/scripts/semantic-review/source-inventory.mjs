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

function hiddenReviewMaterial(unit, { canonicalSource, ownedLines }) {
  Object.defineProperties(unit, {
    canonicalSource: { value: canonicalSource },
    ownedLines: { value: Object.freeze([...ownedLines]) }
  })
  return unit
}

function blockLineRecords(source, block) {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const records = []
  for (let lineNumber = block.loc.start.line; lineNumber <= block.loc.end.line; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? ""
    const start = lineNumber === block.loc.start.line ? block.loc.start.column - 1 : 0
    const end = lineNumber === block.loc.end.line ? block.loc.end.column - 1 : line.length
    const content = line.slice(start, end)
    if (content.trim()) records.push({ line: lineNumber, source: content })
  }
  return records
}

function chunkedBlockUnits(record, descriptor, maximumLines = 400) {
  const blocks = [descriptor.template, ...descriptor.styles].filter(block => block !== null)
  const counters = new Map()
  const units = []
  for (const block of blocks) {
    const kind = block.type === "template" ? "template" : "style"
    const records = blockLineRecords(record.source, block)
    for (let offset = 0; offset < records.length; offset += maximumLines) {
      const chunk = records.slice(offset, offset + maximumLines)
      const index = (counters.get(kind) ?? 0) + 1
      counters.set(kind, index)
      units.push(hiddenReviewMaterial({
        id: `${record.path}::${kind}::${kind}[${index}]`,
        kind,
        name: `${kind}[${index}]`,
        path: record.path,
        startLine: chunk[0].line,
        endLine: chunk.at(-1).line
      }, {
        canonicalSource: chunk.map(item => item.source).join("\n"),
        ownedLines: chunk.map(item => item.line)
      }))
    }
  }
  return units
}

function lineStartOffsets(source) {
  const offsets = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") offsets.push(index + 1)
  }
  return offsets
}

function unitSpan(unit, offsets, sourceLength) {
  const start = (offsets[unit.startLine - 1] ?? sourceLength) + (unit.startColumn ?? 1) - 1
  const end = (offsets[unit.endLine - 1] ?? sourceLength) + (unit.endColumn ?? 1)
  return [Math.min(start, sourceLength), Math.min(end, sourceLength)]
}

function lineRange(units) {
  return new Set(units.flatMap(unit => {
    const lines = []
    for (let line = unit.startLine; line <= unit.endLine; line += 1) lines.push(line)
    return lines
  }))
}

function mergeSpans(spans) {
  const merged = []
  for (const [start, end] of spans.toSorted((left, right) => left[0] - right[0] || left[1] - right[1])) {
    const previous = merged.at(-1)
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end)
    else merged.push([start, end])
  }
  return merged
}

function residualReviewMaterial(record, fallback, spans, claimedLines) {
  const source = record.source.replaceAll("\r\n", "\n")
  const excludedSpans = mergeSpans(spans)
  let spanIndex = 0
  const masked = [...source].map((character, index) => {
    while (excludedSpans[spanIndex]?.[1] <= index) spanIndex += 1
    const span = excludedSpans[spanIndex]
    const excluded = Boolean(span && span[0] <= index && index < span[1])
    return excluded && character !== "\n" ? "" : character
  }).join("")
  const ownedLines = source.split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(item => item.line.trim() && !claimedLines.has(item.number))
    .map(item => item.number)
  return hiddenReviewMaterial({ ...fallback }, {
    canonicalSource: masked.split("\n").filter(line => line.trim()).join("\n"),
    ownedLines
  })
}

function shellReviewMaterial(record, component, descriptor, namedUnits, blockUnits) {
  const source = record.source.replaceAll("\r\n", "\n")
  const offsets = lineStartOffsets(source)
  const blockSpans = [descriptor.template, ...descriptor.styles]
    .filter(block => block !== null)
    .map(block => [block.loc.start.offset, block.loc.end.offset])
  const namedSpans = namedUnits.map(unit => unitSpan(unit, offsets, source.length))
  const claimedLines = new Set([
    ...blockUnits.flatMap(unit => unit.ownedLines),
    ...lineRange(namedUnits)
  ])
  return residualReviewMaterial(record, component, [...blockSpans, ...namedSpans], claimedLines)
}

function scriptResidualMaterial(record, fallback, namedUnits) {
  const source = record.source.replaceAll("\r\n", "\n")
  const offsets = lineStartOffsets(source)
  return residualReviewMaterial(
    record,
    fallback,
    namedUnits.map(unit => unitSpan(unit, offsets, source.length)),
    lineRange(namedUnits)
  )
}

function vueUnits(record, namedUnits) {
  const parsed = parseVueSfc(record.source.replaceAll("\r\n", "\n"), { filename: record.path })
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot parse ${record.path}: ${String(parsed.errors[0])}`)
  }
  const component = listSourceUnits({
    source: record.source,
    relativePath: record.path,
    includeFallback: true
  }).find(unit => unit.kind === "component")
  if (!component) throw new Error(`Vue component fallback is missing: ${record.path}`)
  const blockUnits = chunkedBlockUnits(record, parsed.descriptor)
  return [
    shellReviewMaterial(record, component, parsed.descriptor, namedUnits, blockUnits),
    ...blockUnits,
    ...namedUnits
  ]
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
  const namedUnits = listSourceUnits({
    source: record.source,
    relativePath: record.path
  })
  const includeFallback = record.path.startsWith("server/") || namedUnits.length === 0
  let rawUnits
  if (record.path.endsWith(".vue")) {
    rawUnits = vueUnits(record, namedUnits)
  } else {
    rawUnits = listSourceUnits({
        source: record.source,
        relativePath: record.path,
        includeFallback
      })
    const fallback = rawUnits.find(unit => unit.kind === "module")
    if (fallback && namedUnits.length > 0) {
      const residual = scriptResidualMaterial(record, fallback, namedUnits)
      rawUnits = rawUnits.map(unit => unit === fallback ? residual : unit)
    }
  }
  const units = rawUnits.map(unit => {
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
  if (typeof unit.canonicalSource === "string") {
    return unit.canonicalSource.replaceAll("\r\n", "\n")
  }
  if (unit.kind === "component" || unit.kind === "module") return source.replaceAll("\r\n", "\n")
  return source.split(/\r?\n/u).slice(unit.startLine - 1, unit.endLine).join("\n").trim()
}
