import type { ComputedRef, Ref } from "vue"

import {
  publishQuickSearchContext,
  toBoundedDeveloperValue,
  type DeveloperJsonValue,
  type QuickSearchContext
} from "~/lib/quick-search-developer"

type PublishedQuickSearchContext =
  | Readonly<{
      kind: "reader"
      workId: string
      editorWorkId: string | null
      pageIndex: number
      mediaType: "etext" | "faksimil"
      info: DeveloperJsonValue
    }>
  | Readonly<{
      kind: "author"
      info: DeveloperJsonValue
    }>

let nextPublisherId = 0

export function useQuickSearchContext(): Ref<QuickSearchContext | null> {
  return useState<QuickSearchContext | null>("quick-search-developer-context", () => null)
}

export function useQuickSearchContextPublisher(
  source: ComputedRef<PublishedQuickSearchContext | null>
): void {
  const state = useQuickSearchContext()
  const owner = `quick-search-publisher-${++nextPublisherId}`
  let stop: (() => void) | null = null
  let clearOwned: (() => void) | null = null

  onMounted(() => {
    stop = watch(source, context => {
      if (!context) {
        clearOwned?.()
        clearOwned = null
        return
      }
      clearOwned = publishQuickSearchContext(state, { ...context, owner })
    }, { immediate: true, flush: "sync" })
  })

  onBeforeUnmount(() => {
    stop?.()
    clearOwned?.()
  })
}

export function useAuthorQuickSearchContextPublisher(source: ComputedRef<unknown | null>): void {
  useQuickSearchContextPublisher(computed(() => source.value === null
    ? null
    : {
        kind: "author" as const,
        info: toBoundedDeveloperValue(source.value)
      }))
}
