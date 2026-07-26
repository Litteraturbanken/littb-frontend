import {
  isRedFtpQuery,
  parseRedFtpResponse,
  type RedFtpEntry
} from "../../app/lib/quick-search-developer"

const redFtpLookupEndpoint = "https://red.litteraturbanken.se/hitta"

export async function lookupRedFtp(
  query: unknown,
  fetchText: (url: string) => Promise<string>
): Promise<RedFtpEntry[] | null> {
  if (!isRedFtpQuery(query)) return null
  const source = await fetchText(
    `${redFtpLookupEndpoint}?q=${encodeURIComponent(query)}`
  )
  return parseRedFtpResponse(source)
}
