const maxPresentationFilenameLength = 512
const maxDecodePasses = 16

export function validatePresentationSegments(value: unknown): boolean {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return true
  if (!Array.isArray(value) || value.length !== 2) return false

  const [folder, filename] = value
  if (folder !== "specialomraden" && folder !== "vandringar") return false
  if (typeof filename !== "string" || filename.length > maxPresentationFilenameLength) {
    return false
  }

  let decoded = filename
  let stabilized = false
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next.length > maxPresentationFilenameLength) return false
      if (next === decoded) {
        stabilized = true
        break
      }
      decoded = next
    }
  } catch {
    return false
  }

  return stabilized && /^[\p{L}\p{N}_-]+\.html$/u.test(decoded)
}
