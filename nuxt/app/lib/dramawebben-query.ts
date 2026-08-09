import type { LocationQueryRaw } from "vue-router"

export function queryWithoutKey(query: LocationQueryRaw, key: string): LocationQueryRaw {
  return Object.fromEntries(Object.entries(query).filter(([candidate]) => candidate !== key))
}

export function queryWithoutKeys(
  query: LocationQueryRaw,
  keys: ReadonlySet<string>
): LocationQueryRaw {
  return Object.fromEntries(Object.entries(query).filter(([candidate]) => !keys.has(candidate)))
}
