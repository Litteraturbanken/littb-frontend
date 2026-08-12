export function rawUrlParts(value: string): {
  rawPath: string
  rawQuery: string
  hasQuery: boolean
  rawFragment: string
  hasFragment: boolean
} {
  const fragmentIndex = value.indexOf("#")
  const withoutFragment = fragmentIndex === -1 ? value : value.slice(0, fragmentIndex)
  const queryIndex = withoutFragment.indexOf("?")
  return {
    rawPath: queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex),
    rawQuery: queryIndex === -1 ? "" : withoutFragment.slice(queryIndex + 1),
    hasQuery: queryIndex !== -1,
    rawFragment: fragmentIndex === -1 ? "" : value.slice(fragmentIndex + 1),
    hasFragment: fragmentIndex !== -1
  }
}
