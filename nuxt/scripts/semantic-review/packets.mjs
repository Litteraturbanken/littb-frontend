import { createHash } from "node:crypto"

import { canonicalUnitSource } from "./source-inventory.mjs"

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function sorted(values = []) {
  return [...values].sort(compareText)
}

function sourceAndUnitMaps(sources) {
  const sourceByPath = new Map(sources.map(source => [source.path, source]))
  const unitById = new Map()
  for (const source of sources) {
    for (const unit of source.units) {
      if (unitById.has(unit.id)) throw new Error(`Duplicate source unit: ${unit.id}`)
      unitById.set(unit.id, { source, unit })
    }
  }
  return { sourceByPath, unitById }
}

function ownedManifest(packet, sources) {
  const { sourceByPath, unitById } = sourceAndUnitMaps(sources)
  const owned = sorted(packet.ownedUnitIds).map(id => {
    const entry = unitById.get(id)
    if (!entry) throw new Error(`Packet owns an unknown unit: ${id}`)
    return {
      id,
      exported: entry.unit.exported === true,
      source: canonicalUnitSource(entry.source.source, entry.unit)
    }
  })
  const surfaces = sorted(packet.paths).map(path => {
    const source = sourceByPath.get(path)
    if (!source) throw new Error(`Packet references an unknown source: ${path}`)
    return { path, exports: sorted(source.exports) }
  })
  return { owned, surfaces }
}

function lineRanges(unit) {
  const lines = Array.isArray(unit.ownedLines)
    ? [...new Set(unit.ownedLines)].toSorted((left, right) => left - right)
    : Array.from(
        { length: unit.endLine - unit.startLine + 1 },
        (_, index) => unit.startLine + index
      )
  const ranges = []
  for (const line of lines) {
    const current = ranges.at(-1)
    if (current && current[1] + 1 === line) current[1] = line
    else ranges.push([line, line])
  }
  return ranges
}

export function fingerprintPacket(packet, sources) {
  const manifest = ownedManifest(packet, sources)
  const canonical = {
    contractVersion: 2,
    id: packet.id,
    roots: sorted(packet.rootUnitIds),
    owned: manifest.owned,
    surfaces: manifest.surfaces,
    imports: sorted(packet.imports),
    callers: sorted(packet.callers),
    typeBoundaries: sorted(packet.typeBoundaries)
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function materializeReviewPacket(packet, sources) {
  const { unitById } = sourceAndUnitMaps(sources)
  const roots = new Set(packet.rootUnitIds)
  const units = packet.ownedUnitIds.map(id => {
    const entry = unitById.get(id)
    if (!entry) throw new Error(`Packet owns an unknown unit: ${id}`)
    const { unit } = entry
    return {
      id: unit.id,
      kind: unit.kind,
      name: unit.name,
      path: unit.path,
      startLine: unit.startLine,
      endLine: unit.endLine,
      lines: lineRanges(unit),
      root: roots.has(unit.id),
      exported: unit.exported === true
    }
  }).sort((left, right) => compareText(left.path, right.path)
    || left.startLine - right.startLine
    || compareText(left.id, right.id))
  return {
    id: packet.id,
    fingerprint: fingerprintPacket(packet, sources),
    productionLines: packet.productionLines,
    oversized: packet.oversized,
    waiver: packet.waiver,
    riskScore: packet.riskScore,
    riskFlags: sorted(packet.riskFlags),
    paths: sorted(packet.paths),
    imports: sorted(packet.imports),
    callers: sorted(packet.callers),
    typeBoundaries: sorted(packet.typeBoundaries),
    tests: [...(packet.tests ?? [])].sort((left, right) => compareText(left.path, right.path)),
    maintainabilityFindings: [...(packet.maintainabilityFindings ?? [])]
      .sort((left, right) => compareText(left.rule, right.rule)
        || compareText(left.message, right.message)),
    units
  }
}

function packetComparator(left, right) {
  return right.riskScore - left.riskScore || compareText(left.id, right.id)
}

export function renderPacketIndex(packets, sources) {
  const materialized = packets.map(packet => materializeReviewPacket(packet, sources))
    .sort(packetComparator)
  const output = {
    version: 1,
    summary: {
      packets: materialized.length,
      oversized: materialized.filter(packet => packet.oversized).length,
      productionLines: materialized.reduce((total, packet) => total + packet.productionLines, 0)
    },
    packets: materialized.map(packet => ({
      id: packet.id,
      fingerprint: packet.fingerprint,
      productionLines: packet.productionLines,
      oversized: packet.oversized,
      riskScore: packet.riskScore,
      riskFlags: packet.riskFlags
    }))
  }
  return `${JSON.stringify(output, null, 2)}\n`
}

export function renderPacketJson(packet, sources) {
  return `${JSON.stringify({
    version: 1,
    reviewContract: "quality/semantic-review-contract.md",
    packet: materializeReviewPacket(packet, sources)
  }, null, 2)}\n`
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
}

function lineRangeLabel(unit) {
  return unit.lines.map(([start, end]) => start === end ? String(start) : `${start}-${end}`).join(",")
}

export function renderPacketMarkdown(packet, sources) {
  const review = materializeReviewPacket(packet, sources)
  const lines = [
    "# Semantic review packet",
    "",
    `Review contract: \`quality/semantic-review-contract.md\``,
    "",
    `- Packet: \`${review.id}\``,
    `- Fingerprint: \`${review.fingerprint}\``,
    `- Production lines: ${review.productionLines}`,
    `- Risk: ${review.riskScore} (${review.riskFlags.join(", ") || "none"})`,
    `- Oversized: ${review.oversized ? "yes" : "no"}`,
    "",
    "## Owned units",
    "",
    "| Root | Unit | Location | Exported |",
    "| --- | --- | --- | --- |"
  ]
  for (const unit of review.units) {
    lines.push(`| ${unit.root ? "yes" : "no"} | \`${unit.id}\` | \`${unit.path}:${lineRangeLabel(unit)}\` | ${unit.exported ? "yes" : "no"} |`)
  }
  lines.push("", "## Context", "")
  for (const [label, values] of [
    ["Imports", review.imports],
    ["Callers", review.callers],
    ["Type boundaries", review.typeBoundaries],
    ["Tests", review.tests.map(test => `${test.path} (${test.evidence})`)]
  ]) {
    lines.push(`- ${label}: ${values.length ? values.map(markdownCell).join(", ") : "none"}`)
  }
  if (review.maintainabilityFindings.length > 0) {
    lines.push("", "## Maintainability evidence", "")
    for (const finding of review.maintainabilityFindings) {
      lines.push(`- ${markdownCell(finding.rule)}: ${markdownCell(finding.message)}`)
    }
  }
  return `${lines.join("\n").trimEnd()}\n`
}
