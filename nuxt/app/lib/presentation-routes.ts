const maxPresentationFilenameLength = 512
const maxDecodePasses = 16

function fullyDecodedFilename(filename: string): string | null {
  let decoded = filename
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next.length > maxPresentationFilenameLength) return null
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

export function validatePresentationSegments(value: unknown): boolean {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return true
  if (!Array.isArray(value) || value.length !== 2) return false

  const [folder, filename] = value
  if (folder !== "specialomraden" && folder !== "vandringar") return false
  if (typeof filename !== "string" || filename.length > maxPresentationFilenameLength) {
    return false
  }

  const decoded = fullyDecodedFilename(filename)
  return decoded !== null && /^[\p{L}\p{N}_-]+\.html$/u.test(decoded)
}
