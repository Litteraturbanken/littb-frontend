// Names already present in navigation results are enough to title the loading
// page. Keep them separate from profile data so navigation never waits for I/O.
export function useAuthorTitleNames() {
  const names = useState<Record<string, string>>("author-title-names", () => ({}))
  function remember(authorId: string, name: string) {
    if (authorId && name.trim()) names.value[authorId] = name.trim()
  }
  function rememberPath(path: string, name: string) {
    const match = /^\/f(?:örfattare|%C3%B6rfattare)\/([^/?#]+)/iu.exec(path)
    if (!match) return
    try { remember(decodeURIComponent(match[1]!), name) } catch { /* Invalid URL. */ }
  }
  return { names, remember, rememberPath }
}
