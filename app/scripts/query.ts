const LUCENE_SPECIAL_CHARS = /([+\-!(){}\[\]^"'~*?:\\\/])/g
const LUCENE_NEEDS_QUOTES = /[\s+\-!(){}\[\]^"'~*?:\\\/]/

interface FilterObj {
    gender?: string
    "authorkeyword>authorid"?: string[]
    "authors>authorid"?: string[]
    keywords?: string[]
    languages?: string[]
    mediatypes?: string[]
    "sort_date_imprint.date:range"?: number[]
}

interface FilterList {
    [key: string]: string[] | undefined
}

export const buildFilterMap = (list: string[] = []): FilterList => {
    const output: FilterList = {}
    for (const kw of list || []) {
        const [key, val] = kw.split(":")
        if (!key || val === undefined) continue
        const values = val
            .split(";")
            .map(item => item && item.trim())
            .filter((item): item is string => Boolean(item))
        if (!values.length) continue
        if (output[key]) {
            output[key] = output[key]!.concat(values)
        } else {
            output[key] = values
        }
    }
    return output
}

const normalizeField = (field: string): string => field.replace(/>/g, ".")

export const escapeQueryValue = (input: unknown): string => {
    if (input === null || input === undefined) {
        return '""'
    }
    const str = String(input)
    if (!str.length) return '""'
    const escaped = str.replace(LUCENE_SPECIAL_CHARS, "\\$1")
    if (LUCENE_NEEDS_QUOTES.test(str)) {
        return `"${escaped}"`
    }
    return escaped
}

const buildFieldClause = (field: string, values: string[]): string | undefined => {
    const sanitized = values
        .map(value => (typeof value === "string" ? value.trim() : value))
        .filter((value): value is string => Boolean(value) || value === "0")
    if (!sanitized.length) return undefined

    const normalizedField = normalizeField(field)
    if (sanitized.length === 1) {
        return `${normalizedField}:${escapeQueryValue(sanitized[0])}`
    }
    const joined = sanitized.map(escapeQueryValue).join(" OR ")
    return `${normalizedField}:(${joined})`
}

const groupOr = (clauses: (string | undefined)[]): string | undefined => {
    const filtered = clauses.filter((clause): clause is string => Boolean(clause))
    if (!filtered.length) return undefined
    if (filtered.length === 1) return filtered[0]
    return `(${filtered.join(" OR ")})`
}

const groupAnd = (clauses: (string | undefined)[]): string | undefined => {
    const filtered = clauses.filter((clause): clause is string => Boolean(clause))
    if (!filtered.length) return undefined
    if (filtered.length === 1) return filtered[0]
    return `(${filtered.join(" AND ")})`
}

const buildNestedTermsClause = (
    path: string,
    field: string,
    values?: string[]
): string | undefined => {
    if (!values || !values.length) return undefined
    const unique = Array.from(new Set(values.filter(Boolean)))
    if (!unique.length) return undefined
    if (unique.length === 1) {
        return `${path}>(${field}:${escapeQueryValue(unique[0])})`
    }
    const inner = unique.map(escapeQueryValue).join(" OR ")
    return `${path}>(${field}:(${inner}))`
}

const genderClause = (gender?: string): string | undefined => {
    if (!gender || gender === "all") return undefined
    const genderVal = escapeQueryValue(gender)
    const nested = `authors>(gender:${genderVal})`
    return `(gender:${genderVal} OR ${nested})`
}

const dateRangeClause = (range?: number[]): string | undefined => {
    if (!Array.isArray(range) || range.length !== 2) return undefined
    const [from, to] = range
    if (from === undefined || to === undefined) return undefined
    const rangeString = `[${escapeQueryValue(from)} TO ${escapeQueryValue(to)}]`
    return groupOr([
        `sort_date_imprint.date:${rangeString}`,
        `birth.date:${rangeString}`,
        `death.date:${rangeString}`
    ])
}

const translationGroup = groupOr([
    "keyword:language-source",
    "keyword:translated",
    "(authors>(type:translator))"
])

const languagesClause = (values?: string[]): string | undefined => {
    if (!values || !values.length) return undefined
    const filterMap = buildFilterMap(values)
    const clauses: string[] = []
    let includeTranslation = false
    let includeOriginal = false
    let includeForeign = false

    for (const [key, value] of Object.entries(filterMap)) {
        if (!Array.isArray(value) || !value.length) continue
        if (key === "translation") {
            includeTranslation = true
            continue
        }
        if (key === "original") {
            includeOriginal = true
            continue
        }
        if (key === "foreign") {
            includeForeign = true
            continue
        }
        const clause = buildFieldClause(key, value)
        if (clause) clauses.push(clause)
    }

    if (includeTranslation && translationGroup) {
        clauses.push(translationGroup)
    }
    if (includeOriginal && translationGroup) {
        const result = groupAnd([`(NOT ${translationGroup})`, "NOT language_source:unknown"])
        if (result) clauses.push(result)
    }
    if (includeForeign) {
        const foreignClause = groupAnd(["_exists_:language", "NOT language:swe"])
        if (foreignClause) clauses.push(foreignClause)
        clauses.push("language_source:unknown")
    }

    return groupOr(clauses)
}

const keywordsClause = (values?: string[]): string | undefined => {
    if (!values || !values.length) return undefined
    const filterMap = buildFilterMap(values)
    const clauses = Object.entries(filterMap)
        .map(([key, value]) => (value ? buildFieldClause(key, value) : undefined))
        .filter((clause): clause is string => Boolean(clause))
    return groupOr(clauses)
}

const mediatypesClause = (values?: string[]): string | undefined => {
    if (!values || !values.length) return undefined
    const filterMap = buildFilterMap(values)
    const clauses: string[] = []

    if (Array.isArray(filterMap.mediatype) && filterMap.mediatype.length) {
        const clause = buildFieldClause("mediatype", filterMap.mediatype)
        if (clause) clauses.push(clause)
    }
    if (filterMap.has_epub) {
        clauses.push("has_epub:true")
    }

    return groupOr(clauses)
}

const authorKeywordClause = (values?: string[]): string | undefined => {
    return buildNestedTermsClause("authorkeyword", "authorid", values)
}

const authorsClause = (values?: string[]): string | undefined => {
    return buildNestedTermsClause("authors", "authorid", values)
}

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value])

const buildRangeClause = (field: string, value: unknown): string | undefined => {
    if (value === null || value === undefined || value === "") {
        return undefined
    }
    const [from, to] = String(value)
        .split(",")
        .map(part => part && part.trim())
    const fromVal = from || "*"
    const toVal = to || "*"
    return `${normalizeField(field)}:[${fromVal} TO ${toVal}]`
}

const buildFilterClauses = (filters?: Record<string, unknown>): string[] => {
    if (!filters) return []
    const clauses: string[] = []
    for (const [rawKey, rawVal] of Object.entries(filters)) {
        if (rawVal === null || rawVal === undefined || rawVal === "") {
            continue
        }
        const values = toArray(rawVal).filter(
            (val): val is unknown => val !== null && val !== undefined && val !== ""
        )
        if (!values.length) continue

        if (rawKey === "_exists") {
            for (const val of values) {
                clauses.push(`_exists_:${normalizeField(String(val))}`)
            }
            continue
        }
        if (rawKey === "_not_exists") {
            for (const val of values) {
                clauses.push(`NOT _exists_:${normalizeField(String(val))}`)
            }
            continue
        }
        if (rawKey.endsWith(":range")) {
            const field = rawKey.replace(/:range$/, "")
            for (const val of values) {
                const clause = buildRangeClause(field, val)
                if (clause) clauses.push(clause)
            }
            continue
        }

        const field = normalizeField(rawKey)
        if (values.length === 1) {
            clauses.push(`${field}:${escapeQueryValue(values[0])}`)
        } else {
            const inner = values.map(val => `${field}:${escapeQueryValue(val)}`).join(" OR ")
            clauses.push(`(${inner})`)
        }
    }
    return clauses
}

const SPECIAL_FILTER_KEYS: Array<keyof FilterObj> = [
    "gender",
    "authorkeyword>authorid",
    "authors>authorid",
    "keywords",
    "languages",
    "mediatypes",
    "sort_date_imprint.date:range"
]

export const buildFilterQuery = (filters: Record<string, unknown> = {}): string => {
    const specialFilters: FilterObj = {}
    for (const key of SPECIAL_FILTER_KEYS) {
        const value = filters[key]
        if (value !== undefined) {
            ;(specialFilters as Record<string, unknown>)[key] = value
        }
    }

    const baseClause = fromFilters(specialFilters)

    const remainingFilters: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(filters)) {
        if (SPECIAL_FILTER_KEYS.includes(key as keyof FilterObj)) continue
        remainingFilters[key] = value
    }

    const genericClauses = buildFilterClauses(remainingFilters)
    const clauses: string[] = []
    if (baseClause) {
        clauses.push(wrapForAnd(baseClause))
    }
    clauses.push(...genericClauses.map(wrapForAnd))

    const filtered = clauses.filter(Boolean)
    if (!filtered.length) return ""
    if (filtered.length === 1) return filtered[0]
    return filtered.join(" AND ")
}

export interface ComposeQueryOptions {
    filterQuery?: string
    filterString?: string
    keywordAux?: string[]
}

export const composeQuery = ({
    filterQuery,
    filterString,
    keywordAux = []
}: ComposeQueryOptions): string => {
    const clauses: string[] = []
    if (typeof filterQuery === "string") {
        const trimmedFilterQuery = filterQuery.trim()
        if (trimmedFilterQuery) {
            clauses.push(trimmedFilterQuery)
        }
    }
    const sanitizedFilter = sanitizeFilterStringValue(filterString)
    if (sanitizedFilter) {
        clauses.push(`(${sanitizedFilter})`)
    }
    const base = clauses.length ? clauses.join(" AND ") : ""
    if (!keywordAux.length) {
        return base
    }
    return expandQuery(base, keywordAux)
}

export interface SearchFilterPayload {
    textFilter: Record<string, unknown>
    keywordAux: string[]
}

export const buildSearchFilterPayload = (
    filters: Record<string, unknown> = {}
): SearchFilterPayload => {
    const textFilter: Record<string, unknown> = {}
    const keywordAux: string[] = []

    const genderValue = (function (): string | undefined {
        if (typeof filters["gender"] === "string") return filters["gender"] as string
        if (typeof filters["main_author.gender"] === "string")
            return filters["main_author.gender"] as string
        if (typeof filters["authors.gender"] === "string")
            return filters["authors.gender"] as string
        return undefined
    })()
    if (genderValue && genderValue !== "all") {
        textFilter["main_author.gender"] = genderValue
    }

    const rangeValue = filters["sort_date_imprint.date:range"]
    if (Array.isArray(rangeValue) && rangeValue.length === 2) {
        const [from, to] = rangeValue as [unknown, unknown]
        if (from !== undefined && to !== undefined) {
            textFilter["sort_date_imprint.date:range"] = `${from},${to}`
        }
    }

    const translationClause =
        '(keyword:"language-source" OR keyword:"translated" OR authors>type:translator)'
    const languageMap = buildFilterMap(filters["languages"] as string[] | undefined)
    const hasTranslation =
        Array.isArray(languageMap.translation) && languageMap.translation.includes("true")
    const hasOriginal = Array.isArray(languageMap.original) && languageMap.original.includes("true")
    const hasForeign = Array.isArray(languageMap.foreign) && languageMap.foreign.includes("true")

    delete languageMap.translation
    delete languageMap.original
    delete languageMap.foreign

    if (hasTranslation) {
        keywordAux.push(`RAW:${translationClause}`)
    }
    if (hasOriginal) {
        keywordAux.push(`RAW:NOT ${translationClause}`)
    }
    if (hasForeign) {
        keywordAux.push("RAW:-language:swe")
        const existing = new Set<string>(
            Array.isArray(textFilter._exists) ? (textFilter._exists as string[]) : []
        )
        existing.add("language")
        textFilter._exists = Array.from(existing)
    }

    Object.assign(textFilter, languageMap)
    Object.assign(textFilter, buildFilterMap(filters["mediatypes"] as string[] | undefined))
    Object.assign(textFilter, buildFilterMap(filters["keywords"] as string[] | undefined))

    const directArrayKeys = ["authorkeyword>authorid", "authors>authorid"]
    for (const key of directArrayKeys) {
        const value = filters[key]
        if (Array.isArray(value) && value.length) {
            textFilter[key] = value
        }
    }

    if (filters["has_epub"]) {
        textFilter.has_epub = filters["has_epub"]
    }

    if (filters["_exists"]) {
        const existing = new Set<string>(
            Array.isArray(textFilter._exists) ? (textFilter._exists as string[]) : []
        )
        const additional = Array.isArray(filters["_exists"])
            ? (filters["_exists"] as unknown[])
            : [filters["_exists"]]
        for (const entry of additional) {
            if (entry) {
                existing.add(String(entry))
            }
        }
        textFilter._exists = Array.from(existing)
    }

    if (filters["authorkeyword"] && Array.isArray(filters["authorkeyword"])) {
        textFilter.authorkeyword = filters["authorkeyword"]
    }

    return { textFilter, keywordAux }
}

export const sanitizeFilterStringValue = (str?: string): string => {
    if (!str) return ""
    return str
        .replace(/([A-Öa-ö])[-–—]([A-Öa-ö])/g, "$1 $2")
        .replace(/[.,!"“'”]/g, "")
        .trim()
}

export const expandQuery = (query: string, keywordAux: string[] = []): string => {
    if (!keywordAux.length) return query
    const auxClauses: string[] = []
    for (const item of keywordAux) {
        const colonIndex = item.indexOf(":")
        if (colonIndex === -1) continue
        const key = item.slice(0, colonIndex)
        const val = item.slice(colonIndex + 1)
        if (!val && key !== "RAW") continue

        if (key === "RAW") {
            if (val) auxClauses.push(val)
            continue
        }
        const vals = val.split(";").filter(Boolean)
        if (!vals.length) continue
        auxClauses.push(`${key}:(${vals.join(" OR ")})`)
    }
    if (!auxClauses.length) return query
    return `(${auxClauses.join(" AND ")}) ${query}`
}

const wrapForAnd = (clause: string): string => {
    const trimmed = clause.trim()
    if (!trimmed.length) return ""
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
        return trimmed
    }
    return `(${trimmed})`
}

export function fromFilters(filters: FilterObj = {}): string {
    const clauses: (string | undefined)[] = []

    clauses.push(genderClause(filters.gender))
    clauses.push(dateRangeClause(filters["sort_date_imprint.date:range"]))
    clauses.push(authorKeywordClause(filters["authorkeyword>authorid"]))
    clauses.push(authorsClause(filters["authors>authorid"]))
    clauses.push(languagesClause(filters.languages))
    clauses.push(keywordsClause(filters.keywords))
    clauses.push(mediatypesClause(filters.mediatypes))

    const filtered = clauses.filter((clause): clause is string => Boolean(clause))
    if (!filtered.length) return ""
    if (filtered.length === 1) return filtered[0]
    return filtered.map(wrapForAnd).join(" AND ")
}
