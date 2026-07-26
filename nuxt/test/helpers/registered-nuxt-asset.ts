const javascriptAsset = /\.m?js$/u
const viteTimestamp = /^\d{13}$/u
const viteVersion = /^[a-f0-9]{8}$/u
const maximumPathDecodes = 4

function hasSafeNuxtAssetPath(pathname: string): boolean {
  if (!pathname.startsWith("/_nuxt/")) return false
  let decoded = pathname
  for (let depth = 0; depth < maximumPathDecodes; depth += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded).replaceAll("\\", "/")
    } catch {
      return false
    }
    if (!next.startsWith("/_nuxt/")) return false
    if (next.split("/").some(segment => segment === "." || segment === "..")) return false
    if (next === decoded) return true
    decoded = next
  }

  // A residual escape after the bounded decode pass may conceal another
  // separator or dot segment, so the strict visual allowlist rejects it.
  return !decoded.includes("%")
}

export function isRegisteredNuxtAsset(url: URL): boolean {
  if (!hasSafeNuxtAssetPath(url.pathname)) return false
  if (url.search === "") return true

  if (url.searchParams.size === 1) {
    const version = url.searchParams.get("v") ?? ""
    if (viteVersion.test(version) && javascriptAsset.test(url.pathname)) return true
    if (
      version === "4.4.0"
      && /\/font-awesome\/fonts\/fontawesome-webfont\.(?:ttf|woff2?)$/u.test(url.pathname)
    ) return true
  }

  if (
    url.searchParams.size === 2
    && viteTimestamp.test(url.searchParams.get("t") ?? "")
    && viteVersion.test(url.searchParams.get("v") ?? "")
    && javascriptAsset.test(url.pathname)
  ) return true

  if (
    url.searchParams.size === 1
    && url.searchParams.get("macro") === "true"
    && /\.(?:js|ts|vue)$/u.test(url.pathname)
  ) return true
  if (
    url.searchParams.size === 1
    && url.searchParams.has("import")
    && url.searchParams.get("import") === ""
    && /\.(?:gif|jpe?g|png|svg|webp)$/u.test(url.pathname)
  ) return true

  const componentName = /\/([A-Z][A-Za-z0-9]*)\.vue$/u.exec(url.pathname)?.[1]
  if (
    componentName
    && url.searchParams.size === 3
    && url.searchParams.get("nuxt_component") === "async"
    && url.searchParams.get("nuxt_component_name") === componentName
    && url.searchParams.get("nuxt_component_export") === "default"
  ) return true

  const styleQueryKeys = ["vue", "type", "index", "scoped", "lang.css"]
  return url.pathname.endsWith(".vue")
    && url.searchParams.size === styleQueryKeys.length
    && styleQueryKeys.every(key => url.searchParams.has(key))
    && url.searchParams.get("vue") === ""
    && url.searchParams.get("type") === "style"
    && /^\d+$/u.test(url.searchParams.get("index") ?? "")
    && viteVersion.test(url.searchParams.get("scoped") ?? "")
    && url.searchParams.get("lang.css") === ""
}

export function isSameOriginRegisteredNuxtAsset(url: URL, origin: string): boolean {
  return url.origin === origin && isRegisteredNuxtAsset(url)
}
