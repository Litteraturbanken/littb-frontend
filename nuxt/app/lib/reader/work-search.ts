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
