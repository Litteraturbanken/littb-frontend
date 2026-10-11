import { createRedirectCache } from "./editorial-redirects"

const caches = new Map<string, ReturnType<typeof createRedirectCache>>()

export function editorialRedirectTable(apiBase: string) {
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
