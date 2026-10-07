/** Legacy Matomo contract. GA-only events deliberately do not belong here. */
export type MatomoCommand = [string, ...unknown[]]
export interface MatomoQueue { push: (command: MatomoCommand) => unknown }
export interface MatomoRoute { fullPath: string; path: string; hash: string }

export const MATOMO_BASE = "https://lb.se/matomo/"

export function matomoEnabled(hostname: string, userAgent: string): boolean {
  return hostname === "litteraturbanken.se" && userAgent !== "littb-snapshot"
}

function decodedPath(path: string): string {
  try { return decodeURI(path) } catch { return path }
}

function readerParts(path: string): RegExpMatchArray | null {
  return path.match(/^\/författare\/([^/]+)\/titlar\/([^/]+)\/sida\/([^/]+)\/(etext|faksimil)\/?$/u)
}

function editorIdentity(path: string): string | null {
  const match = path.match(/^\/editor\/([^/]+)\/ix\/[^/]+\/([^/]+)\/?$/u)
  return match ? `${match[1]}/${match[2]}` : null
}

function ignoresQuery(path: string): boolean {
  return /^\/(?:bibliotek|epub|sök)\/?$/u.test(path)
    || path.startsWith("/om/")
    || /^\/dramawebben(?:\/(?:pjäser|författare|om|kringtexter))?\/?$/u.test(path)
    || /^\/författare\/LagerlöfS\/omtexterna(?:\/|$)/u.test(path)
}

export function legacyMatomoTitle(path: string, documentTitle: string): string {
  if (path === "/") return "Svenska klassiker som e-bok och epub"
  if (/^\/bibliotek\/?$/u.test(path)) return "Biblioteket – Titlar och författare"
  if (/^\/epub\/?$/u.test(path)) return "E-böcker för nedladdning"
  if (/^\/presentationer\/?$/u.test(path)) return "Presentationer"
  if (path.startsWith("/om/")) return "Om LB"
  if (/^\/historik\/?$/u.test(path)) return "History"
  const reader = readerParts(path)
  if (reader) return `${reader[1]} – ${reader[2]} s. ${reader[3]}`
  // Angular passed undefined for these routes: Matomo fell back to document.title.
  // Use the rendered destination title, never a previous page's stale title.
  return documentTitle
}

/** One owner for all views; no server, component or reader-specific tracker. */
export class MatomoPageViews {
  #previous: MatomoRoute | null = null
  constructor(private readonly queue: MatomoQueue) {}

  visit(route: MatomoRoute, documentTitle: string): void {
    const previous = this.#previous
    if (previous?.fullPath === route.fullPath) return
    this.#previous = { ...route }
    if (route.hash === "#external") return
    const path = decodedPath(route.path)
    const previousPath = previous && decodedPath(previous.path)
    if (previous) {
      // The old editor returned before its reader $routeUpdate tracking code.
      const editor = editorIdentity(path)
      if (editor && editor === editorIdentity(previousPath!)) return
      if (path === previousPath && !readerParts(path)) {
        const withoutHash = (value: string) => value.split("#", 1)[0]
        if (ignoresQuery(path)
          || withoutHash(route.fullPath) === withoutHash(previous.fullPath)) return
      }
    }
    this.queue.push(["setCustomUrl", path])
    this.queue.push(["setDocumentTitle", legacyMatomoTitle(path, documentTitle)])
    this.queue.push(["trackPageView"])
  }
}

interface MatomoWindow {
  location: { hostname: string }
  navigator: { userAgent: string }
  _paq?: MatomoQueue
  __lbMatomoPageViews?: MatomoPageViews
}

export function installMatomo(browser: MatomoWindow, document: Document): MatomoPageViews | null {
  if (!matomoEnabled(browser.location.hostname, browser.navigator.userAgent)) return null
  if (browser.__lbMatomoPageViews) return browser.__lbMatomoPageViews
  const queue: MatomoQueue = browser._paq ?? [] as MatomoCommand[]
  browser._paq = queue
  // matomo.js replaces the bootstrap array with its live queue object.
  const views = new MatomoPageViews({ push: command => browser._paq?.push(command) })
  browser.__lbMatomoPageViews = views
  queue.push(["setTrackerUrl", `${MATOMO_BASE}matomo.php`])
  queue.push(["setSiteId", "1"])
  // The installed tracker delegates clicks to body, including dynamically added links.
  queue.push(["enableLinkTracking"])
  const script = document.createElement("script")
  script.async = true
  script.src = `${MATOMO_BASE}matomo.js`
  document.head.appendChild(script)
  return views
}
