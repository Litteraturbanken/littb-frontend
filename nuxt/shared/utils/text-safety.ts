export function hasC0OrDelete(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true
  }
  return false
}

export function hasC0OrC1Control(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit <= 0x1f || (codeUnit >= 0x7f && codeUnit <= 0x9f)) return true
  }
  return false
}

export function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return true
      const nextCodeUnit = value.charCodeAt(index + 1)
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return true
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true
    }
  }
  return false
}

export function hasHtmlUnsafeCodeUnit(value: string): boolean {
  if (hasLoneSurrogate(value)) return true
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (
      (codeUnit <= 0x1f && codeUnit !== 0x09 && codeUnit !== 0x0a && codeUnit !== 0x0d)
      || (codeUnit >= 0x7f && codeUnit <= 0x9f)
    ) return true
  }
  return false
}

export function hasEcmaWhitespace(value: string): boolean {
  for (const character of value) {
    if (character.trim() === "") return true
  }
  return false
}

export function removeC0AndSpace(value: string): string {
  let output = ""
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x20) output += value[index]
  }
  return output
}
