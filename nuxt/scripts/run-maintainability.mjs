import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import {
  parseAstGrepFindings,
  parseDependencyCruiserFindings,
  parseEslintFindings,
  parseKnipFindings
} from "./maintainability/adapters.mjs"
import { compareWithBaseline, rankReviewUnits, serializeBaseline } from "./maintainability/findings.mjs"
import { renderReviewJson, renderReviewMarkdown } from "./maintainability/report.mjs"
import { attributeFindingToUnit } from "./maintainability/unit-attribution.mjs"

const root = process.cwd()
const baselinePath = resolve(root, "quality/maintainability-baseline.json")
const reportDirectory = resolve(root, ".quality")

function parseArguments(args) {
  const paths = []
  let updateBaseline = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--update-baseline") {
      updateBaseline = true
      continue
    }
    if (argument === "--path") {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error("--path requires a prefix")
      paths.push(normalizeFilter(value))
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (paths.length > 0 && process.env.CI) throw new Error("--path is not allowed in CI")
  return { updateBaseline, paths: [...new Set(paths)].sort(compareText) }
}

function normalizeFilter(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "")
  if (!/^(?:app|server|shared)(?:\/|$)/u.test(normalized)
    || normalized.split("/").includes("..")) {
    throw new Error(`Invalid authored path prefix: ${value}`)
  }
  return normalized
}

function compareText(left, right) {
  const a = String(left)
  const b = String(right)
  return a < b ? -1 : a > b ? 1 : 0
}

function defaultCommands() {
  const binary = name => resolve(root, "node_modules/.bin", name)
  return {
    eslint: [
      binary("eslint"),
      "--config", "eslint.maintainability.config.mjs",
      "--no-error-on-unmatched-pattern",
      "--format", "json",
      "app", "server", "shared"
    ],
    knip: [
      binary("knip"),
      "--config", "knip.jsonc",
      "--reporter", "json",
      "--no-exit-code",
      "--no-progress",
      "--include", "files,exports,types"
    ],
    dependencyCruiser: [
      binary("depcruise"),
      "--config", "dependency-cruiser.config.cjs",
      "--output-type", "json",
      "app", "server", "shared"
    ],
    astGrep: [
      binary("ast-grep"),
      "scan", "--config", "sgconfig.yml", "--json=compact",
      "app", "server", "shared"
    ]
  }
}

function toolCommands() {
  if (!process.env.MAINTAINABILITY_TOOL_FIXTURES) return defaultCommands()
  let parsed
  try {
    parsed = JSON.parse(process.env.MAINTAINABILITY_TOOL_FIXTURES)
  } catch {
    throw new Error("MAINTAINABILITY_TOOL_FIXTURES must be valid JSON")
  }
  for (const name of ["eslint", "knip", "dependencyCruiser", "astGrep"]) {
    if (!Array.isArray(parsed[name]) || parsed[name].length === 0
      || parsed[name].some(value => typeof value !== "string")) {
      throw new Error(`Missing executable fixture command for ${name}`)
    }
  }
  return parsed
}

function executeTool(name, command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw new Error(`${name} could not start: ${result.error.message}`)
  if (result.signal || result.status === null) {
    throw new Error(`${name} terminated by ${result.signal ?? "an unknown signal"}`)
  }
  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    throw new Error(`${name} produced invalid JSON${result.stderr ? `: ${result.stderr.trim()}` : ""}`)
  }
  return { payload, status: result.status, stderr: result.stderr }
}

function collectRawFindings() {
  const commands = toolCommands()
  const definitions = [
    ["eslint", parseEslintFindings],
    ["knip", parseKnipFindings],
    ["dependencyCruiser", parseDependencyCruiserFindings],
    ["astGrep", parseAstGrepFindings]
  ]
  return definitions.flatMap(([name, parse]) => {
    const result = executeTool(name, commands[name])
    const findings = parse(result.payload, { root })
    if (result.status !== 0 && findings.length === 0) {
      const detail = result.stderr.trim()
      throw new Error(`${name} exited ${result.status} without diagnostics${detail ? `: ${detail}` : ""}`)
    }
    return findings
  })
}

function isAuthoredPath(path) {
  return /^(?:app|server|shared)\//u.test(path)
    && !path.startsWith("app/lib/api/generated/")
    && !/(?:^|\/)(?:test|tests|fixtures?)(?:\/|$)/u.test(path)
}

function changedLines() {
  const result = spawnSync("git", [
    "diff", "--unified=0", "--no-ext-diff", "HEAD", "--", "app", "server", "shared"
  ], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) return null
  const changed = new Map()
  let path = null
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("+++ b/")) {
      path = line.slice("+++ b/".length)
      continue
    }
    if (!path || !line.startsWith("@@")) continue
    const match = line.match(/\+(\d+)(?:,(\d+))?/u)
    if (!match) continue
    const start = Number(match[1])
    const count = match[2] === undefined ? 1 : Number(match[2])
    const lines = changed.get(path) ?? new Set()
    for (let current = start; current < start + count; current += 1) lines.add(current)
    changed.set(path, lines)
  }
  return changed
}

function attributeFindings(rawFindings) {
  const changed = changedLines()
  return rawFindings.filter(finding => isAuthoredPath(finding.path)).map(finding => {
    const sourcePath = resolve(root, finding.path)
    if (!existsSync(sourcePath)) throw new Error(`Diagnostic path does not exist: ${finding.path}`)
    const source = readFileSync(sourcePath, "utf8")
    const unit = attributeFindingToUnit({
      source,
      relativePath: finding.path,
      line: finding.line,
      column: finding.column
    })
    const fileChanges = changed?.get(finding.path)
    return {
      ...finding,
      unit,
      changedLineOverlap: fileChanges
        ? [...fileChanges].some(line => unit.startLine <= line && line <= unit.endLine)
        : false
    }
  })
}

function readBaseline() {
  if (!existsSync(baselinePath)) return { version: 1, findings: [] }
  let baseline
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
  } catch {
    throw new Error("Maintainability baseline is not valid JSON")
  }
  if (baseline?.version !== 1 || !Array.isArray(baseline.findings)) {
    throw new Error("Maintainability baseline must use schema version 1")
  }
  return baseline
}

function matchesPrefixes(path, prefixes) {
  return prefixes.length === 0
    || prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function filteredReport(comparison, rankedUnits, baseline, paths) {
  const includeFinding = finding => matchesPrefixes(finding.path, paths)
  const resolvedPaths = new Map(baseline.findings.map(item => [item.fingerprint, item.path]))
  return {
    currentFindings: comparison.current.filter(includeFinding),
    newFindings: comparison.newFindings.filter(includeFinding),
    knownFindings: comparison.knownFindings.filter(includeFinding),
    resolvedFingerprints: comparison.resolvedFingerprints.filter(fingerprint => {
      const path = resolvedPaths.get(fingerprint)
      return typeof path === "string" && matchesPrefixes(path, paths)
    }),
    rankedUnits: rankedUnits.filter(item => matchesPrefixes(item.unit.path, paths))
  }
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}

function writeReports(report) {
  mkdirSync(reportDirectory, { recursive: true })
  atomicWrite(resolve(reportDirectory, "maintainability-review.json"), renderReviewJson(report))
  atomicWrite(resolve(reportDirectory, "maintainability-review.md"), renderReviewMarkdown(report))
}

function printSummary(comparison, rankedUnits) {
  console.log(`Maintainability: new=${comparison.newFindings.length} known=${comparison.knownFindings.length} resolved=${comparison.resolvedFingerprints.length}`)
  for (const item of rankedUnits.slice(0, 10)) {
    console.log(`- score=${item.score} ${item.unit.id}`)
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const findings = attributeFindings(collectRawFindings())
  const baseline = readBaseline()
  const comparison = compareWithBaseline(findings, baseline)
  const rankedUnits = rankReviewUnits(comparison.current)
  const report = filteredReport(comparison, rankedUnits, baseline, options.paths)
  writeReports(report)
  printSummary(comparison, rankedUnits)
  if (options.updateBaseline) {
    atomicWrite(baselinePath, serializeBaseline(comparison.current))
    console.log(`Updated ${baselinePath}`)
    return 0
  }
  return comparison.newFindings.length > 0 ? 1 : 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 2
}
