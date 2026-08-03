export type WorkSearchOption =
  | "default"
  | "lemma"
  | "modernize"
  | "prefix"
  | "suffix"
  | "infix"

export type WorkSearchOptionsState = Readonly<{
  lemma: boolean
  olderSpellings: boolean
  prefix: boolean
  suffix: boolean
}>

const clearedOptions: WorkSearchOptionsState = {
  lemma: false,
  olderSpellings: false,
  prefix: false,
  suffix: false
}

export function nextWorkSearchOptions(
  current: WorkSearchOptionsState,
  option: WorkSearchOption
): WorkSearchOptionsState {
  if (option === "default") return clearedOptions
  if (option === "lemma") return { ...clearedOptions, lemma: true }
  if (option === "modernize") {
    return current.olderSpellings
      ? clearedOptions
      : { ...clearedOptions, olderSpellings: true }
  }
  if (option === "infix") {
    return { ...clearedOptions, prefix: true, suffix: true }
  }
  return {
    ...clearedOptions,
    prefix: option === "prefix" ? !current.prefix : false,
    suffix: option === "suffix" ? !current.suffix : false
  }
}

export function isWorkSearchActivationKey(key: string): boolean {
  return key === "Enter" || key === " "
}

export function decodedWorkSearchQueryKey(segment: string): string | null {
  const separator = segment.indexOf("=")
  const rawKey = separator < 0 ? segment : segment.slice(0, separator)
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, " "))
  } catch {
    return null
  }
}

export function replaceWorkSearchQuerySegments(
  segments: readonly string[],
  keysToRemove: ReadonlySet<string>,
  replacements: ReadonlyMap<string, string | null>
): string[] {
  const replaced = new Set<string>()
  const next = segments.flatMap(segment => {
    const key = decodedWorkSearchQueryKey(segment)
    if (key === null) return [segment]

    if (replacements.has(key)) {
      const value = replacements.get(key) ?? null
      replaced.add(key)
      return [value === null ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`]
    }
    return keysToRemove.has(key) ? [] : [segment]
  })

  for (const [key, value] of replacements) {
    if (!replaced.has(key)) {
      next.push(value === null ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  return next
}

export function workSearchHitAt<THit extends { index: number }>(
  hits: readonly THit[],
  index: number
): THit | null {
  return hits.find(hit => hit.index === index) ?? null
}
