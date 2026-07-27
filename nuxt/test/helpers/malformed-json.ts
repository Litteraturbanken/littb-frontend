export type JsonRecord = Record<string, unknown>

export function cloneRecord(value: unknown): JsonRecord {
  const clone: unknown = structuredClone(value)
  if (typeof clone !== "object" || clone === null || Array.isArray(clone)) {
    throw new TypeError("fixture must be an object")
  }
  return clone as JsonRecord
}

export function requiredRecord(parent: JsonRecord, key: string): JsonRecord {
  const value = parent[key]
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${key} must be an object`)
  }
  return value as JsonRecord
}

export function requiredArray(parent: JsonRecord, key: string): unknown[] {
  const value = parent[key]
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`)
  return value
}
