import { editorialRedirectTable } from "../utils/editorial-redirect-cache"

export default defineNitroPlugin(() => {
  // Warm once at startup; background refreshes then avoid delaying page requests.
  void editorialRedirectTable(useRuntimeConfig().apiBase).catch(error => {
    console.error("Editorial redirect warmup failed", error)
  })
})
