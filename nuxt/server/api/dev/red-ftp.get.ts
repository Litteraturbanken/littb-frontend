import { isRedFtpQuery } from "../../../app/lib/quick-search-developer"
import { lookupRedFtp } from "../../utils/red-ftp"

export default defineEventHandler(async event => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not found" })
  }

  const query = getQuery(event)
  if (Object.keys(query).length !== 1 || !isRedFtpQuery(query.q)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Red FTP query" })
  }

  try {
    const entries = await lookupRedFtp(query.q, url => $fetch<string>(url, {
      responseType: "text",
      retry: 0
    }))
    if (!entries) {
      throw createError({ statusCode: 502, statusMessage: "Invalid Red FTP response" })
    }
    return { entries }
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Red FTP lookup unavailable" })
  }
})
