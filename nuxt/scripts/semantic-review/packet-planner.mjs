const defaultTargetLines = 400
const defaultMaximumLines = 450

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function fallbackUnit(source) {
  return source.units.find(unit => unit.kind === "component" || unit.kind === "module") ?? null
}

function topLevelUnits(source) {
  const candidates = source.units.filter(unit => unit.kind !== "component" && unit.kind !== "module")
  return candidates.filter(unit => !candidates.some(parent => parent.id !== unit.id
    && parent.startLine <= unit.startLine
    && unit.endLine <= parent.endLine
    && (parent.startLine < unit.startLine || unit.endLine < parent.endLine)))
}

function descendants(source, root) {
  return source.units.filter(unit => unit.id !== root.id
    && unit.name.startsWith(`${root.name}.`)
    && root.startLine <= unit.startLine
    && unit.endLine <= root.endLine)
}

function countOwnedLines(source, units) {
  const lines = source.source.replaceAll("\r\n", "\n").split("\n")
  const owned = new Set()
  for (const unit of units) {
    for (let line = unit.startLine; line <= unit.endLine; line += 1) {
      if (lines[line - 1]?.trim()) owned.add(line)
    }
  }
  return owned.size
}

function packet({ source, rootUnits, ownedUnits, options, rootName }) {
  const productionLines = countOwnedLines(source, ownedUnits)
  const id = `${source.path}::packet::${rootName}`
  return {
    id,
    rootUnitIds: rootUnits.map(unit => unit.id).sort(compareText),
    ownedUnitIds: ownedUnits.map(unit => unit.id).sort((left, right) => {
      const leftUnit = source.units.find(unit => unit.id === left)
      const rightUnit = source.units.find(unit => unit.id === right)
      return (leftUnit?.startLine ?? 0) - (rightUnit?.startLine ?? 0) || compareText(left, right)
    }),
    paths: [source.path],
    productionLines,
    oversized: productionLines > options.maximumLines,
    waiver: options.waivers[id] ?? null
  }
}

function componentPackets(source, options) {
  const component = fallbackUnit(source)
  if (!component) throw new Error(`Vue component fallback is missing: ${source.path}`)
  return [packet({
    source,
    rootUnits: [component],
    ownedUnits: source.units,
    options,
    rootName: "component"
  })]
}

function serverPackets(source, options) {
  const fallback = fallbackUnit(source)
  const handler = topLevelUnits(source)[0] ?? fallback
  if (!handler) throw new Error(`Server handler is missing: ${source.path}`)
  return [packet({
    source,
    rootUnits: [handler],
    ownedUnits: source.units,
    options,
    rootName: handler.kind === "module" ? "module" : handler.name
  })]
}

function scriptPackets(source, options) {
  const roots = topLevelUnits(source)
  const exportedRoots = roots.filter(unit => unit.exported)
  const claimed = new Set()
  const packets = exportedRoots.map(root => {
    const ownedUnits = [root, ...descendants(source, root)]
    for (const unit of ownedUnits) claimed.add(unit.id)
    return packet({ source, rootUnits: [root], ownedUnits, options, rootName: root.name })
  })
  const privateRoots = roots.filter(unit => !claimed.has(unit.id))
  let group = []
  let groupOwned = []
  const appendGroup = () => {
    if (group.length === 0) return
    packets.push(packet({
      source,
      rootUnits: group,
      ownedUnits: groupOwned,
      options,
      rootName: `module-${group[0].name}`
    }))
    group = []
    groupOwned = []
  }
  for (const root of privateRoots) {
    const ownedUnits = [root, ...descendants(source, root).filter(unit => !claimed.has(unit.id))]
    if (group.length > 0
      && countOwnedLines(source, [...groupOwned, ...ownedUnits]) > options.targetLines) {
      appendGroup()
    }
    group.push(root)
    groupOwned.push(...ownedUnits)
    for (const unit of ownedUnits) claimed.add(unit.id)
  }
  appendGroup()
  const remaining = source.units.filter(unit => !claimed.has(unit.id))
  if (remaining.length > 0) {
    const fallback = fallbackUnit(source)
    packets.push(packet({
      source,
      rootUnits: fallback ? [fallback] : [remaining[0]],
      ownedUnits: remaining,
      options,
      rootName: "module"
    }))
  }
  return packets
}

export function validatePacketCoverage(sources, packets) {
  const known = new Set(sources.flatMap(source => source.units.map(unit => unit.id)))
  const owners = new Map()
  for (const packet of packets) {
    if (!Array.isArray(packet.ownedUnitIds) || packet.ownedUnitIds.length === 0) {
      throw new Error(`Empty review packet: ${packet.id}`)
    }
    for (const unitId of packet.ownedUnitIds) {
      if (!known.has(unitId)) throw new Error(`Unknown packet unit: ${unitId}`)
      const owner = owners.get(unitId)
      if (owner) throw new Error(`Duplicate packet owner for ${unitId}: ${owner}, ${packet.id}`)
      owners.set(unitId, packet.id)
    }
    for (const rootId of packet.rootUnitIds) {
      if (!packet.ownedUnitIds.includes(rootId)) {
        throw new Error(`Packet root is not owned by its packet: ${rootId}`)
      }
    }
  }
  for (const unitId of known) {
    if (!owners.has(unitId)) throw new Error(`Missing packet owner: ${unitId}`)
  }
}

export function planReviewPackets(sources, options = {}) {
  const settings = {
    targetLines: options.targetLines ?? defaultTargetLines,
    maximumLines: options.maximumLines ?? defaultMaximumLines,
    waivers: options.waivers ?? {}
  }
  if (!Number.isInteger(settings.targetLines) || settings.targetLines < 1
    || !Number.isInteger(settings.maximumLines) || settings.maximumLines < settings.targetLines) {
    throw new RangeError("Packet line limits must be positive and maximum must cover target")
  }
  const packets = [...sources]
    .sort((left, right) => compareText(left.path, right.path))
    .flatMap(source => source.path.endsWith(".vue")
      ? componentPackets(source, settings)
      : source.path.startsWith("server/")
        ? serverPackets(source, settings)
        : scriptPackets(source, settings))
  validatePacketCoverage(sources, packets)
  return packets
}
