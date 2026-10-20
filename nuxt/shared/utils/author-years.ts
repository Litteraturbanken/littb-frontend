export function formatAuthorYears(
  birthYear: string | null | undefined,
  deathYear: string | null | undefined
): string {
  const birth = birthYear && birthYear !== "0000" ? birthYear : ""
  const death = deathYear && deathYear !== "0000" ? deathYear : ""
  if (birth && death) return `${birth}-${death}`
  if (birth) return `f. ${birth}`
  if (death) return `d. ${death}`
  return ""
}

