function compareText(left, right) {
  const a = String(left)
  const b = String(right)
  return a < b ? -1 : a > b ? 1 : 0
}

function sortedEdges(edges = []) {
  return edges
    .map(edge => ({ from: edge.from, to: edge.to }))
    .sort((left, right) => compareText(left.from, right.from) || compareText(left.to, right.to))
}

function packetFinding(finding, status) {
  const packet = {
    fingerprint: finding.fingerprint,
    status,
    tool: finding.tool,
    rule: finding.rule,
    severity: finding.severity,
    line: finding.line,
    column: finding.column,
    identity: finding.identity,
    message: finding.message
  }
  if (typeof finding.measured === "number") packet.measured = finding.measured
  if (typeof finding.threshold === "number") packet.threshold = finding.threshold
  if (finding.dependencyEdges?.length) packet.dependencyEdges = sortedEdges(finding.dependencyEdges)
  return packet
}

function findingComparator(left, right) {
  return compareText(left.tool, right.tool)
    || compareText(left.rule, right.rule)
    || (left.line ?? 0) - (right.line ?? 0)
    || (left.column ?? 0) - (right.column ?? 0)
    || compareText(left.identity, right.identity)
}

function buildPacket(report) {
  const newFingerprints = new Set(report.newFindings.map(finding => finding.fingerprint))
  const knownFingerprints = new Set(report.knownFindings.map(finding => finding.fingerprint))
  const units = report.rankedUnits
    .map(item => ({
      id: item.unit.id,
      kind: item.unit.kind,
      name: item.unit.name,
      path: item.unit.path,
      startLine: item.unit.startLine,
      endLine: item.unit.endLine,
      score: item.score,
      changedLineOverlap: item.changedLineOverlap === true,
      selectionReasons: [...item.selectionReasons].sort(compareText),
      findings: [...item.findings]
        .sort(findingComparator)
        .map(finding => packetFinding(
          finding,
          newFingerprints.has(finding.fingerprint)
            ? "new"
            : knownFingerprints.has(finding.fingerprint) ? "known" : "current"
        ))
    }))
    .sort((left, right) => right.score - left.score || compareText(left.id, right.id))
  return {
    version: 1,
    summary: {
      current: report.currentFindings.length,
      new: report.newFindings.length,
      known: report.knownFindings.length,
      resolved: report.resolvedFingerprints.length
    },
    resolvedFingerprints: [...report.resolvedFingerprints].sort(compareText),
    units
  }
}

export function renderReviewJson(report) {
  return `${JSON.stringify(buildPacket(report), null, 2)}\n`
}

function markdownValue(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
}

function edgesText(finding) {
  return finding.dependencyEdges?.map(edge => `${edge.from} → ${edge.to}`).join("; ") ?? "—"
}

export function renderReviewMarkdown(report) {
  const packet = buildPacket(report)
  const lines = [
    "# Nuxt maintainability review packet",
    "",
    "This packet identifies automatically discovered review candidates. It contains evidence, not copied implementation source.",
    "",
    "| Summary | Count |",
    "| --- | ---: |",
    `| Current findings | ${packet.summary.current} |`,
    `| New findings | ${packet.summary.new} |`,
    `| Known findings | ${packet.summary.known} |`,
    `| Resolved fingerprints | ${packet.summary.resolved} |`,
    ""
  ]
  if (packet.units.length === 0) lines.push("No review candidates.", "")
  for (const [index, unit] of packet.units.entries()) {
    lines.push(
      `## ${index + 1}. \`${unit.id}\``,
      "",
      "| Unit | Value |",
      "| --- | --- |",
      `| Path | \`${unit.path}\` |`,
      `| Symbol | \`${unit.name}\` (${unit.kind}) |`,
      `| Lines | ${unit.startLine}–${unit.endLine} |`,
      `| Score | ${unit.score} |`,
      `| Changed-line overlap | ${unit.changedLineOverlap ? "yes" : "no"} |`,
      `| Selected because | ${unit.selectionReasons.length ? unit.selectionReasons.join("; ") : "single analyzer signal"} |`,
      "",
      "| Status | Analyzer/rule | Location | Evidence | Metric | Dependency edges |",
      "| --- | --- | --- | --- | --- | --- |"
    )
    for (const finding of unit.findings) {
      const metric = finding.measured === undefined
        ? "—"
        : `${finding.measured}${finding.threshold === undefined ? "" : ` / ${finding.threshold}`}`
      lines.push(`| ${finding.status} | ${finding.tool}/${finding.rule} | ${finding.line}:${finding.column} | ${markdownValue(finding.message)} | ${metric} | ${markdownValue(edgesText(finding))} |`)
    }
    lines.push("")
  }
  if (packet.resolvedFingerprints.length) {
    lines.push("## Resolved fingerprints", "")
    for (const fingerprint of packet.resolvedFingerprints) lines.push(`- \`${fingerprint}\``)
    lines.push("")
  }
  return `${lines.join("\n").trimEnd()}\n`
}
