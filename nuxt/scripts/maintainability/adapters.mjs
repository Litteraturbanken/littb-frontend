import { isAbsolute, relative } from "node:path"

function invalid(tool, index) {
  throw new TypeError(`Invalid ${tool} diagnostic at index ${index}`)
}

function normalizedPath(path, root) {
  if (typeof path !== "string" || path.length === 0) return null
  const candidate = isAbsolute(path) ? relative(root, path) : path
  return candidate.replaceAll("\\", "/").replace(/^\.\//u, "")
}

function severity(value) {
  if (value === 2 || value === "error") return "blocking"
  if (value === 1 || value === "warning" || value === "warn") return "advisory"
  if (value === "info" || value === "hint") return "info"
  return null
}

function sonarThreshold(message) {
  let diagnostic = message
  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message)
      if (typeof parsed.message === "string") diagnostic = parsed.message
    } catch {
      return {}
    }
  }
  const cognitive = diagnostic.match(/from\s+(\d+)\s+to\s+the\s+(\d+)\s+allowed/iu)
  if (cognitive) return { measured: Number(cognitive[1]), threshold: Number(cognitive[2]) }
  const maximum = diagnostic.match(/has\s+(\d+)\s+lines.*?(\d+)\s+lines\s+authorized/iu)
  if (maximum) return { measured: Number(maximum[1]), threshold: Number(maximum[2]) }
  const threshold = diagnostic.match(/complexity\s+of\s+(\d+).*?greater\s+than\s+(\d+)\s+authorized/iu)
  return threshold ? { measured: Number(threshold[1]), threshold: Number(threshold[2]) } : {}
}

const sonarMetricRules = new Set([
  "cognitive-complexity",
  "cyclomatic-complexity",
  "max-lines-per-function"
])

export function parseEslintFindings(payload, { root }) {
  if (!Array.isArray(payload)) throw new TypeError("Invalid ESLint diagnostic at index 0")
  const findings = []
  let index = 0
  for (const file of payload) {
    if (!file || typeof file !== "object" || !Array.isArray(file.messages)) invalid("ESLint", index)
    const path = normalizedPath(file.filePath, root)
    for (const message of file.messages) {
      const ruleId = message?.ruleId
      const findingSeverity = severity(message?.severity)
      if (!path || typeof ruleId !== "string" || !findingSeverity
        || typeof message.message !== "string"
        || !Number.isInteger(message.line) || !Number.isInteger(message.column)) {
        invalid("ESLint", index)
      }
      const [namespace, ...ruleParts] = ruleId.split("/")
      const tool = namespace === "sonarjs" ? "sonarjs" : "eslint"
      const rule = tool === "sonarjs" ? ruleParts.join("/") : ruleId
      const limits = tool === "sonarjs" ? sonarThreshold(message.message) : {}
      if (tool === "sonarjs" && sonarMetricRules.has(rule)
        && (typeof limits.measured !== "number" || typeof limits.threshold !== "number")) {
        invalid("ESLint", index)
      }
      findings.push({
        tool,
        rule,
        severity: findingSeverity,
        path,
        line: message.line,
        column: message.column,
        endLine: message.endLine,
        endColumn: message.endColumn,
        identity: limits.threshold === undefined ? rule : `${rule}>${limits.threshold}`,
        message: message.message,
        ...limits
      })
      index += 1
    }
  }
  return findings
}

const knipCategories = [
  "dependencies",
  "devDependencies",
  "exports",
  "files",
  "optionalPeerDependencies",
  "types",
  "unlisted"
]

export function parseKnipFindings(payload, { root }) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.issues)) {
    throw new TypeError("Invalid Knip diagnostic at index 0")
  }
  const findings = []
  let index = 0
  for (const issue of payload.issues) {
    const path = normalizedPath(issue?.file, root)
    if (!path) invalid("Knip", index)
    for (const category of knipCategories) {
      const records = issue[category] ?? []
      if (!Array.isArray(records)) invalid("Knip", index)
      for (const record of records) {
        if (!record || typeof record.name !== "string") invalid("Knip", index)
        const line = record.line ?? 1
        const column = record.col ?? 1
        if (!Number.isInteger(line) || !Number.isInteger(column)) invalid("Knip", index)
        findings.push({
          tool: "knip",
          rule: category,
          severity: "info",
          path,
          line,
          column,
          identity: `${category}:${record.name}`,
          message: `Unused ${category}: ${record.name}`
        })
        index += 1
      }
    }
  }
  return findings
}

export function parseDependencyCruiserFindings(payload, { root }) {
  const violations = payload?.summary?.violations
  if (!Array.isArray(violations)) throw new TypeError("Invalid dependency-cruiser diagnostic at index 0")
  return violations.map((violation, index) => {
    const from = normalizedPath(violation?.from, root)
    const to = normalizedPath(violation?.to, root)
    const rule = violation?.rule?.name
    const findingSeverity = severity(violation?.rule?.severity)
    if (!from || !to || typeof rule !== "string" || !findingSeverity) {
      invalid("dependency-cruiser", index)
    }
    return {
      tool: "dependency-cruiser",
      rule,
      severity: findingSeverity,
      path: from,
      line: 1,
      column: 1,
      identity: `${rule}:${from}->${to}`,
      message: violation.rule.comment ?? `${from} depends on ${to}`,
      dependencyEdges: [{ from, to }]
    }
  })
}

function syntaxKind(text) {
  const trimmed = text.trimStart()
  if (trimmed.startsWith("switch")) return "SwitchStatement"
  if (trimmed.startsWith("case") || trimmed.startsWith("default")) return "SwitchCase"
  if (trimmed.startsWith("if")) return "IfStatement"
  if (/^(?:async\s+)?function\b/u.test(trimmed)) return "FunctionDeclaration"
  return "SyntaxNode"
}

export function parseAstGrepFindings(payload, { root }) {
  if (!Array.isArray(payload)) throw new TypeError("Invalid ast-grep diagnostic at index 0")
  return payload.map((match, index) => {
    const path = normalizedPath(match?.file, root)
    const rule = match?.ruleId
    const findingSeverity = severity(match?.severity)
    const start = match?.range?.start
    if (!path || typeof rule !== "string" || !findingSeverity
      || typeof match.text !== "string"
      || typeof match.message !== "string"
      || typeof match.language !== "string"
      || !Number.isInteger(start?.line) || !Number.isInteger(start?.column)) {
      invalid("ast-grep", index)
    }
    const kind = syntaxKind(match.text)
    return {
      tool: "ast-grep",
      rule,
      severity: findingSeverity,
      path,
      line: start.line + 1,
      column: start.column + 1,
      identity: `${rule}:${match.language}:${kind}`,
      message: match.message
    }
  })
}
