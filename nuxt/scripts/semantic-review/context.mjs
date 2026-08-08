import { readFileSync, readdirSync } from "node:fs"
import { basename, dirname, extname, relative, resolve, sep } from "node:path"
import { normalize as normalizePosix } from "node:path/posix"

import { parse as parseVueSfc } from "@vue/compiler-sfc"
import ts from "typescript"

export const riskWeights = Object.freeze({
  "api-boundary": 8,
  route: 8,
  "raw-html": 8,
  sanitization: 8,
  concurrency: 6,
  "ssr-state": 6,
  storage: 5,
  accessibility: 4,
  untested: 4,
  "maintainability-finding": 4,
  oversized: 10
})

const sourceExtensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"]
const interactiveElements = new Set(["a", "button", "input", "select", "summary", "textarea"])

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function normalizedPath(path) {
  return path.split(sep).join("/")
}

function walk(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return walk(path)
      return entry.isFile() ? [path] : []
    })
  } catch (error) {
    if (error?.code === "ENOENT") return []
    throw error
  }
}

function unresolvedPath(fromPath, specifier) {
  if (specifier.startsWith("~/") || specifier.startsWith("@/")) {
    return `app/${specifier.slice(2)}`
  }
  if (specifier.startsWith("~~/") || specifier.startsWith("@@/")) return specifier.slice(3)
  if (specifier.startsWith(".")) {
    return normalizePosix(`${dirname(fromPath)}/${specifier}`)
  }
  return null
}

function candidatePaths(base) {
  const extension = extname(base)
  const direct = extension ? [base] : sourceExtensions.map(suffix => `${base}${suffix}`)
  const indexes = extension ? [] : sourceExtensions.slice(1).map(suffix => `${base}/index${suffix}`)
  return [...direct, ...indexes]
}

function resolveImport(fromPath, specifier, knownPaths) {
  const base = unresolvedPath(fromPath, specifier)
  if (!base) return null
  return candidatePaths(base).find(path => knownPaths.has(path)) ?? null
}

function generatedBoundaryPath(fromPath, specifier) {
  const base = unresolvedPath(fromPath, specifier)
  if (!base || !base.startsWith("app/lib/api/generated/")) return null
  return extname(base) ? base : `${base}.ts`
}

function scriptBlocks(source) {
  if (!source.path.endsWith(".vue")) return [source.source]
  const parsed = parseVueSfc(source.source, { filename: source.path })
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot parse ${source.path}: ${String(parsed.errors[0])}`)
  }
  return [parsed.descriptor.script, parsed.descriptor.scriptSetup]
    .filter(block => block !== null)
    .map(block => block.content)
}

function expressionName(node, sourceFile) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) {
    return `${expressionName(node.expression, sourceFile)}.${node.name.text}`
  }
  return node.getText(sourceFile)
}

function scriptRisk(source) {
  const flags = new Set()
  for (const block of scriptBlocks(source)) {
    const sourceFile = ts.createSourceFile(source.path, block, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const name = expressionName(node.expression, sourceFile)
        if (["$fetch", "useFetch", "useLazyFetch"].includes(name)) flags.add("api-boundary")
        if (["useAsyncData", "useLazyAsyncData", "useState", "onServerPrefetch"].includes(name)) {
          flags.add("ssr-state")
        }
        if (["Promise.all", "Promise.allSettled", "Promise.any", "Promise.race", "queueMicrotask", "setInterval", "setTimeout"].includes(name)) {
          flags.add("concurrency")
        }
        if (/^(?:DOMPurify\.)?sanitize(?:Html)?$/u.test(name)) flags.add("sanitization")
      }
      if (ts.isNewExpression(node) && expressionName(node.expression, sourceFile) === "AbortController") {
        flags.add("concurrency")
      }
      if (ts.isPropertyAccessExpression(node)) {
        if (node.name.text === "innerHTML") flags.add("raw-html")
        const owner = expressionName(node.expression, sourceFile)
        if (["localStorage", "sessionStorage"].includes(owner)) flags.add("storage")
      }
      if (ts.isIdentifier(node) && ["localStorage", "sessionStorage"].includes(node.text)) {
        flags.add("storage")
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return flags
}

function templateRisk(source) {
  const flags = new Set()
  if (!source.path.endsWith(".vue")) return flags
  const parsed = parseVueSfc(source.source, { filename: source.path })
  const root = parsed.descriptor.template?.ast
  if (!root) return flags
  function visit(node) {
    if (node.type === 1) {
      for (const property of node.props) {
        if (property.type !== 7) continue
        if (property.name === "html") flags.add("raw-html")
        if (property.name === "on" && !interactiveElements.has(node.tag)) flags.add("accessibility")
      }
    }
    for (const child of node.children ?? []) visit(child)
    if (node.type === 9) for (const branch of node.branches) visit(branch)
  }
  visit(root)
  return flags
}

function sourceRisk(source) {
  return new Set([...scriptRisk(source), ...templateRisk(source)])
}

function importSpecifiers(source, relativePath) {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map(node => node.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map(node => node.text)
}

function testRecords(root, knownPaths) {
  return walk(resolve(root, "test"))
    .filter(path => [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(path)))
    .map(path => {
      const relativePath = normalizedPath(relative(root, path))
      const source = readFileSync(path, "utf8")
      const imported = importSpecifiers(source, relativePath)
        .map(specifier => resolveImport(relativePath, specifier, knownPaths))
        .filter(path => path !== null)
      return { path: relativePath, imported: new Set(imported) }
    })
    .sort((left, right) => compareText(left.path, right.path))
}

function packetTests(packet, tests) {
  const paths = new Set(packet.paths)
  const basenames = new Set(packet.paths.map(path => basename(path, extname(path))))
  const candidates = []
  for (const test of tests) {
    if ([...test.imported].some(path => paths.has(path))) {
      candidates.push({ path: test.path, evidence: "import" })
      continue
    }
    const testName = basename(test.path, extname(test.path))
    if (test.path.startsWith("test/ssr/")
      && [...basenames].some(name => testName === name || testName.startsWith(`${name}.`) || testName.startsWith(`${name}-`))) {
      candidates.push({ path: test.path, evidence: "basename" })
    }
  }
  return candidates.sort((left, right) => compareText(left.path, right.path))
}

function packetFindings(packet, maintainability) {
  const owned = new Set(packet.ownedUnitIds)
  return (maintainability?.units ?? [])
    .filter(unit => owned.has(unit.id))
    .flatMap(unit => unit.findings ?? [])
    .toSorted((left, right) => compareText(left.rule, right.rule)
      || compareText(left.message, right.message))
}

export function enrichReviewPackets({ root, sources, packets, maintainability = { units: [] } }) {
  const sourceByPath = new Map(sources.map(source => [source.path, source]))
  const knownPaths = new Set(sourceByPath.keys())
  const importsByPath = new Map()
  const callersByPath = new Map(sources.map(source => [source.path, new Set()]))
  const boundariesByPath = new Map()
  const riskByPath = new Map()
  for (const source of sources) {
    const imports = new Set()
    const boundaries = new Set()
    for (const declaration of source.imports) {
      const target = resolveImport(source.path, declaration.source, knownPaths)
      if (target) imports.add(target)
      if (target) callersByPath.get(target)?.add(source.path)
      const generated = generatedBoundaryPath(source.path, declaration.source)
      if (generated) {
        for (const name of declaration.names) boundaries.add(`${generated}#${name}`)
      }
    }
    importsByPath.set(source.path, imports)
    boundariesByPath.set(source.path, boundaries)
    riskByPath.set(source.path, sourceRisk(source))
  }
  const tests = testRecords(root, knownPaths)
  return packets.map(packet => {
    const imports = new Set()
    const callers = new Set()
    const typeBoundaries = new Set()
    const flags = new Set()
    for (const path of packet.paths) {
      for (const dependency of importsByPath.get(path) ?? []) imports.add(dependency)
      for (const caller of callersByPath.get(path) ?? []) callers.add(caller)
      for (const boundary of boundariesByPath.get(path) ?? []) typeBoundaries.add(boundary)
      for (const flag of riskByPath.get(path) ?? []) flags.add(flag)
      if (path.startsWith("app/pages/") || path.startsWith("server/api/")) flags.add("route")
    }
    if (typeBoundaries.size > 0) flags.add("api-boundary")
    const relatedTests = packetTests(packet, tests)
    if (relatedTests.length === 0) flags.add("untested")
    const maintainabilityFindings = packetFindings(packet, maintainability)
    if (maintainabilityFindings.length > 0) flags.add("maintainability-finding")
    if (packet.oversized) flags.add("oversized")
    const riskFlags = [...flags].sort(compareText)
    return {
      ...packet,
      imports: [...imports].sort(compareText),
      callers: [...callers].sort(compareText),
      typeBoundaries: [...typeBoundaries].sort(compareText),
      tests: relatedTests,
      riskFlags,
      riskScore: riskFlags.reduce((total, flag) => total + riskWeights[flag], 0),
      maintainabilityFindings
    }
  }).sort((left, right) => right.riskScore - left.riskScore || compareText(left.id, right.id))
}
