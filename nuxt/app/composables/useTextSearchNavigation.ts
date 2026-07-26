import {
  DEFAULT_TEXT_SEARCH_HREF,
  rememberedTextSearchHref
} from "~/lib/text-search-navigation"

const clientTextSearchHref = import.meta.client ? ref(DEFAULT_TEXT_SEARCH_HREF) : null

export function useTextSearchNavigation() {
  const route = useRoute()
  const requestUrl = useRequestURL()
  const ssrTextSearchHref = useState<string>(
    "text-search-navigation-href",
    () => DEFAULT_TEXT_SEARCH_HREF
  )
  const activeTextSearchHref = computed(() => {
    void route.fullPath
    const activeHref = import.meta.client
      ? `${window.location.pathname}${window.location.search}`
      : `${requestUrl.pathname}${requestUrl.search}`
    return rememberedTextSearchHref(activeHref)
  })
  const textSearchHref = computed(() => activeTextSearchHref.value
    ?? clientTextSearchHref?.value
    ?? ssrTextSearchHref.value)

  function rememberTextSearchHref(value: string): void {
    const accepted = rememberedTextSearchHref(value)
    if (accepted === null) return
    ssrTextSearchHref.value = accepted
    if (clientTextSearchHref !== null) clientTextSearchHref.value = accepted
  }

  return {
    textSearchHref,
    rememberTextSearchHref
  }
}
