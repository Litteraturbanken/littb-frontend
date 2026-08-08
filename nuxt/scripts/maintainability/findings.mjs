import { createHash } from "node:crypto"

const severityWeights = {
  blocking: 8,
  advisory: 3,
  info: 1
}

function compareText(left, right) {
  const leftText = String(left)
  const rightText = String(right)
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0
}

export function fingerprintFinding(finding) {
  const canonical = [
    finding.tool,
    finding.rule,
    finding.path,
    finding.unit.id,
    finding.identity
  ].join("\u0000")
  return createHash("sha256").update(canonical).digest("hex")
}

function fingerprintedFindings(findings) {
  const ordered = findings
    .map(finding => ({ ...finding, fingerprint: fingerprintFinding(finding) }))
    .sort((left, right) => compareText(left.fingerprint, right.fingerprint)
      || (left.line ?? 0) - (right.line ?? 0)
      || (left.column ?? 0) - (right.column ?? 0)
      || compareText(left.message, right.message))
  const unique = new Map()
  for (const finding of ordered) {
    const previous = unique.get(finding.fingerprint)
    if (!previous) {
      unique.set(finding.fingerprint, finding)
      continue
    }
    const measured = typeof previous.measured === "number" && typeof finding.measured === "number"
      ? Math.max(previous.measured, finding.measured)
      : previous.measured ?? finding.measured
    unique.set(finding.fingerprint, {
      ...previous,
      measured,
      changedLineOverlap: previous.changedLineOverlap === true || finding.changedLineOverlap === true
    })
  }
  return [...unique.values()]
}

export function compareWithBaseline(findings, baseline = { version: 1, findings: [] }) {
  if (baseline.version !== 1 || !Array.isArray(baseline.findings)) {
    throw new Error("Maintainability baseline must use schema version 1")
  }
  const current = fingerprintedFindings(findings)
  const baselineFingerprints = new Set(baseline.findings.map(item => item.fingerprint))
  const currentFingerprints = new Set(current.map(item => item.fingerprint))
  return {
    current,
    newFindings: current.filter(item => !baselineFingerprints.has(item.fingerprint)),
    knownFindings: current.filter(item => baselineFingerprints.has(item.fingerprint)),
    resolvedFingerprints: [...baselineFingerprints]
      .filter(fingerprint => !currentFingerprints.has(fingerprint))
      .sort(compareText)
  }
}

function measuredExcess(finding) {
  return typeof finding.measured === "number" && typeof finding.threshold === "number"
    ? Math.max(0, finding.measured - finding.threshold)
    : 0
}

function selectionReasons({ tools, rules, changedLineOverlap, totalMeasuredExcess }) {
  const reasons = []
  if (tools.length > 1) reasons.push(`${tools.length} analyzers agree`)
  if (rules.length > 1) reasons.push(`${rules.length} independent rules`)
  if (totalMeasuredExcess > 0) reasons.push(`${totalMeasuredExcess} total threshold excess`)
  if (changedLineOverlap) reasons.push("overlaps changed lines")
  return reasons
}

export function rankReviewUnits(findings) {
  const groups = new Map()
  for (const finding of fingerprintedFindings(findings)) {
    const group = groups.get(finding.unit.id) ?? { unit: finding.unit, findings: [] }
    group.findings.push(finding)
    groups.set(finding.unit.id, group)
  }
  return [...groups.values()]
    .map(group => {
      const tools = [...new Set(group.findings.map(item => item.tool))].sort(compareText)
      const rules = [...new Set(group.findings.map(item => `${item.tool}/${item.rule}`))]
        .sort(compareText)
      const changedLineOverlap = group.findings.some(item => item.changedLineOverlap === true)
      const totalMeasuredExcess = group.findings.reduce(
        (total, item) => total + measuredExcess(item),
        0
      )
      const severityWeightSum = group.findings.reduce((total, item) => {
        const weight = severityWeights[item.severity]
        if (weight === undefined) throw new Error(`Unknown finding severity: ${String(item.severity)}`)
        return total + weight
      }, 0)
      const score = severityWeightSum
        + rules.length * 2
        + Math.max(0, tools.length - 1) * 5
        + Math.min(20, totalMeasuredExcess)
        + (changedLineOverlap ? 3 : 0)
      return {
        unit: group.unit,
        findings: group.findings,
        score,
        changedLineOverlap,
        tools,
        rules,
        selectionReasons: selectionReasons({
          tools,
          rules,
          changedLineOverlap,
          totalMeasuredExcess
        })
      }
    })
    .sort((left, right) => right.score - left.score || compareText(left.unit.id, right.unit.id))
}

function baselineRecord(finding) {
  return {
    fingerprint: fingerprintFinding(finding),
    tool: finding.tool,
    rule: finding.rule,
    path: finding.path,
    unitId: finding.unit.id,
    identity: finding.identity
  }
}

export function serializeBaseline(findings) {
  const records = [...new Map(
    findings.map(finding => {
      const record = baselineRecord(finding)
      return [record.fingerprint, record]
    })
  ).values()].sort((left, right) => compareText(left.tool, right.tool)
    || compareText(left.rule, right.rule)
    || compareText(left.path, right.path)
    || compareText(left.unitId, right.unitId)
    || compareText(left.identity, right.identity))
  return `${JSON.stringify({ version: 1, findings: records }, null, 2)}\n`
}
