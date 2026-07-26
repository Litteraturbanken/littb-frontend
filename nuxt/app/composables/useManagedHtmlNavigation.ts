import { managedHtmlNavigationTarget } from "~/lib/managed-html-navigation"

export function useManagedHtmlNavigation() {
  return function navigateManagedHtml(event: MouseEvent): void {
    const element = event.target instanceof Element ? event.target : null
    const anchor = element?.closest<HTMLAnchorElement>("a[href]")
    if (!anchor) return

    const target = managedHtmlNavigationTarget({
      href: anchor.getAttribute("href"),
      currentUrl: window.location.href,
      button: event.button,
      defaultPrevented: event.defaultPrevented,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      download: anchor.hasAttribute("download"),
      target: anchor.getAttribute("target")
    })
    if (target === null) return

    event.preventDefault()
    void navigateTo(target)
  }
}
