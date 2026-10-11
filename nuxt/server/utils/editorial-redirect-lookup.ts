import { parseRedirectTable, resolveEditorialPath } from "./editorial-redirects"

// Every request queries the environment's dedicated OpenSearch redirect index
// through the API. No retained table, TTL, background refresh, or negative cache.
export async function lookupEditorialRedirect(apiBase: string, path: string): Promise<string | null> {
  const rules = await $fetch<unknown>(`${apiBase.replace(/\/$/u, "")}/editorial-redirects`, {
    query: { path }, timeout: 5000, retry: 0, redirect: "error"
  })
  return resolveEditorialPath(path, parseRedirectTable(rules))
}
