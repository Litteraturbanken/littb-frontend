const qValuePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/u

export function acceptsGzipEncoding(header: string | undefined): boolean {
  if (!header) return false
  const codings = header.split(",").map(item => item.split(";").map(part => part.trim()))
  const selected = codings.find(([coding]) => coding?.toLowerCase() === "gzip")
    ?? codings.find(([coding]) => coding === "*")
  if (!selected) return false
  const quality = codingQuality(selected.slice(1))
  return quality !== null && quality > 0
}

function codingQuality(parameters: readonly string[]): number | null {
  if (parameters.length === 0) return 1
  if (parameters.length !== 1) return null

  const match = /^q\s*=\s*(.+)$/iu.exec(parameters[0]!)
  if (!match || !qValuePattern.test(match[1]!)) return null
  return Number(match[1])
}

export function acceptsBrotliEncoding(header: string | undefined): boolean {
  if (!header) return false

  return header.split(",").some((item) => {
    const [coding = "", ...parameters] = item.split(";").map(part => part.trim())
    if (coding.toLowerCase() !== "br") return false
    const quality = codingQuality(parameters)
    return quality !== null && quality > 0
  })
}
