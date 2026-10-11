import { validCanonicalSegment } from "./legacy-author-route"

type Rule = { target: string; media: Record<string, string> }
export type RedirectTable = Map<string, Rule>

function validPath(path: unknown): path is string {
  if (typeof path !== "string") return false
  const parts = path.split("/")
  return parts[0] === "" && parts[1] === "författare"
    && (parts.length === 3 || (parts.length === 5 && parts[3] === "titlar"))
    && parts.slice(1).every(part => validCanonicalSegment(part, 200)
      && !/[?#]/u.test(part))
}

export function parseRedirectTable(value: unknown): RedirectTable {
  if (!value || typeof value !== "object" || !("rules" in value)
    || !Array.isArray(value.rules)) throw new Error("Invalid editorial redirect snapshot")
  const table: RedirectTable = new Map()
  for (const row of value.rules) {
    if (!row || typeof row !== "object" || !validPath(row.source)
      || !validPath(row.target) || !Array.isArray(row.media) || table.has(row.source)) {
      throw new Error("Invalid editorial redirect rule")
    }
    const media: Record<string, string> = Object.create(null)
    for (const entry of row.media) {
      if (!entry || typeof entry !== "object") throw new Error("Invalid media redirect")
      const { source: old, target } = entry
      if (!["etext", "faksimil", "pdf", "infopost"].includes(old)
        || typeof target !== "string"
        || !["etext", "faksimil", "pdf", "infopost"].includes(target)) {
        throw new Error("Invalid editorial media redirect")
      }
      media[old] = target
    }
    table.set(row.source, { target: row.target, media })
  }
  return table
}

export function resolveEditorialPath(pathname: string, table: RedirectTable): string | null {
  const trailingSlash = pathname.endsWith("/")
  const raw = pathname.split("/")
  if (trailingSlash) raw.pop()
  let parts: string[]
  try {
    parts = raw.slice(1).map(part => decodeURIComponent(part))
  } catch { return null }
  if (!["författare", "forfattare"].includes(parts[0] ?? "")
    || parts.some(part => !validCanonicalSegment(part, 512) || /[?#]/u.test(part))) return null
  parts[0] = "författare"
  const original = `/${parts.join("/")}`
  const isWork = parts[2] === "titlar" && parts.length >= 4
  const prefix = `/${parts.slice(0, isWork ? 4 : 2).join("/")}`
  const workRule = isWork ? table.get(prefix) : undefined
  const rule = workRule ?? table.get(`/${parts.slice(0, 2).join("/")}`)
  const prefixLength = workRule ? 4 : 2
  const suffix = parts.slice(prefixLength)
  // Media changes are scoped to a work and to supported Reader route shapes.
  if (workRule && (suffix.length === 1
    || (suffix.length === 3 && suffix[0] === "sida"))) {
    const last = suffix.length - 1
    suffix[last] = workRule.media[suffix[last]!] ?? suffix[last]!
  }
  const target = rule ? `${rule.target}${suffix.length ? `/${suffix.join("/")}` : ""}` : original
  if (target === original && raw[1] !== "forfattare") return null
  return target.split("/").map(encodeURIComponent).join("/") + (trailingSlash ? "/" : "")
}

// One table per backend URL, never shared across Stage/production environments.
// Refresh single-flight; requests keep using the last fully validated table.
export function createRedirectCache(load: () => Promise<unknown>, now = Date.now) {
  let table: RedirectTable | null = null
  let expires = 0
  let pending: Promise<RedirectTable> | null = null
  function refresh(): Promise<RedirectTable> {
    if (pending) return pending
    pending = load().then(value => {
      const candidate = parseRedirectTable(value)
      table = candidate
      expires = now() + 30_000
      return candidate
    }).catch((error: unknown) => {
      expires = now() + 5_000
      throw error
    }).finally(() => { pending = null })
    return pending
  }
  return async (): Promise<RedirectTable> => {
    if (!table) return refresh()
    if (now() >= expires) void refresh().catch(error => {
      console.error("Editorial redirect refresh failed; retaining previous table", error)
    })
    return table
  }
}
