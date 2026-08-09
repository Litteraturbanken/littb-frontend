import { getRequestURL, sendProxy } from "h3"

import { correlationHeaders } from "../../../utils/observability"

export default defineEventHandler(event => {
  const apiBase = useRuntimeConfig(event).apiBase.replace(/\/$/u, "")
  const target = `${apiBase}/dictionary/articles${getRequestURL(event).search}`
  return sendProxy(event, target, {
    fetchOptions: {
      method: "GET",
      headers: correlationHeaders(event)
    }
  })
})
