import { DEFAULT_LIBRARY_HREF, rememberedLibraryHref } from "~/lib/library-navigation"

const clientLibraryHref = import.meta.client ? ref(DEFAULT_LIBRARY_HREF) : null

export function useLibraryNavigation() {
  const libraryHref = computed(() => clientLibraryHref?.value ?? DEFAULT_LIBRARY_HREF)

  function rememberLibraryHref(value: string) {
    const href = rememberedLibraryHref(value)
    if (!href || !clientLibraryHref) return
    clientLibraryHref.value = href
  }

  return { libraryHref, rememberLibraryHref }
}
