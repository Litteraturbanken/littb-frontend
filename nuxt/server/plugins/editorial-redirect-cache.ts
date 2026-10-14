import { editorialRedirectTable } from "../utils/editorial-redirect-lookup"

export default defineNitroPlugin(async () => {
  try {
    await editorialRedirectTable(useRuntimeConfig().apiBase)
  } catch (error) {
    // A redirect backend outage must not stop the website from starting.
    console.error("Editorial redirect cache warmup failed", error)
  }
})
