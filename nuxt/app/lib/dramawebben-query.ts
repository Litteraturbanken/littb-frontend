import type { LocationQueryRaw } from "vue-router"

export function queryWithoutKey(query: LocationQueryRaw, key: string): LocationQueryRaw {
  return Object.fromEntries(Object.entries(query).filter(([candidate]) => candidate !== key))
}
