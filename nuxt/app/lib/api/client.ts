import createClient, { type ClientOptions } from "openapi-fetch"

import type { paths } from "./generated/lbapi"

export function createLbApiClient(
  baseUrl: string,
  customFetch?: ClientOptions["fetch"]
) {
  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    ...(customFetch ? { fetch: customFetch } : {})
  })
}
