import { parseRedirectTable, resolveEditorialPath, type RedirectTable } from "./editorial-redirects"

// Refresh from the dedicated index. Never put the backend round trip on a warm
// page request; replace the table only after the entire snapshot validates.
export function createRedirectCache(load: () => Promise<unknown>, now = Date.now) {
  let table: RedirectTable | null = null
  let loadedAt = 0
  let retryAt = 0
  let pending: Promise<RedirectTable> | null = null
  function refresh(): Promise<RedirectTable> {
    if (pending) return pending
    pending = load().then(value => {
      const candidate = parseRedirectTable(value)
      table = candidate
      loadedAt = now()
      retryAt = loadedAt + 30_000
      return candidate
    }).catch((error: unknown) => {
      retryAt = now() + 5_000
      throw error
    }).finally(() => { pending = null })
    return pending
  }
  return async (): Promise<RedirectTable> => {
    if (!table || now() - loadedAt >= 300_000) {
      if (!pending && now() < retryAt) throw new Error("Editorial redirect refresh unavailable")
      return refresh()
    }
    if (now() >= retryAt) void refresh().catch(error => {
      console.error("Editorial redirect refresh failed; retaining previous table", error)
    })
    return table
  }
}

const caches = new Map<string, ReturnType<typeof createRedirectCache>>()
export function editorialRedirectTable(apiBase: string): Promise<RedirectTable> {
  const base = apiBase.replace(/\/$/u, "")
  let cached = caches.get(base)
  if (!cached) {
    cached = createRedirectCache(() => $fetch<unknown>(`${base}/editorial-redirects`, {
      timeout: 10_000, retry: 0, redirect: "error"
    }))
    caches.set(base, cached)
  }
  return cached()
}

export async function lookupEditorialRedirect(apiBase: string, path: string): Promise<string | null> {
  return resolveEditorialPath(path, await editorialRedirectTable(apiBase))
}
