/** Retain settled counts while a replacement summary is pending. Zero is settled. */
export function displayedSummary<T extends Record<string, string | number | null>>(
  summary: T,
  previous?: T
): T {
  return Object.fromEntries(Object.entries(summary).map(([key, value]) =>
    [key, value ?? previous?.[key] ?? null]
  )) as T
}
