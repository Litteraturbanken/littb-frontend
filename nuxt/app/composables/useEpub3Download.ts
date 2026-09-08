import { ref } from "vue"
import type { useLbApiClient } from "./useLbApiClient"
import type { DownloadResult } from "../lib/library/view-model"

export function useEpub3Download(libraryClient: ReturnType<typeof useLbApiClient>) {
  const epub3Error = ref("")
  const epub3Loading = ref(false)

  async function downloadEpub3(item: DownloadResult): Promise<void> {
      if (epub3Loading.value) return
      epub3Error.value = ""
      epub3Loading.value = true
      try {
          if (!item.epub3Lookup) throw new Error("Missing EPUB work identity")
          const { data, error } = await libraryClient.GET("/works/{author_id}/{title_path}/manifest", {
              params: {
                  path: {
                      author_id: item.epub3Lookup.authorId,
                      title_path: item.epub3Lookup.titlePath
                  },
                  query: { media_type: "etext" }
              }
          })
          if (error || !data || !/^lb\d+$/.test(data.work_id)) {
              throw new Error("Missing EPUB work identity")
          }
          window.location.assign(`https://red.litteraturbanken.se/export/etext/epub3-${data.work_id}.epub`)
      } catch {
          epub3Error.value = "EPUB3 kunde inte hämtas. Försök igen."
      } finally {
          epub3Loading.value = false
      }
  }
  return { epub3Error, epub3Loading, downloadEpub3 }
}
