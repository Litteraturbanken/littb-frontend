export function epubWork({
  id = "DoktorGlas",
  authorId = "SöderbergH",
  fullName = "Hjalmar Söderberg",
  surname = "Söderberg",
  birth = "1869",
  death = "1941",
  year = "1905",
  role,
  title = "Doktor Glas"
} = {}) {
  return {
    _index: "etext",
    lbworkid: `lb-${id}`,
    titlepath: id,
    titleid: id,
    work_titleid: id,
    shorttitle: title,
    title: `${title}. Roman`,
    texttype: "roman",
    mediatype: "etext",
    startpagename: "-2",
    has_epub: true,
    sort_date_imprint: { plain: year },
    main_author: {
      authorid: authorId,
      full_name: fullName,
      surname,
      birth: { plain: birth },
      death: { plain: death },
      ...(role ? { type: role } : {})
    },
    work_authors: [{ authorid: authorId, surname }],
    export: [{ type: "epub", size: 530557 }]
  }
}

const doktorGlas = {
  ...epubWork(),
  searchable: true,
  export: [
    { type: "epub", size: 530557 },
    { type: "txt", size: 1024 }
  ]
}
const doktorGlasFaksimil = {
  ...doktorGlas,
  _index: "faksimil",
  mediatype: "faksimil",
  has_epub: false,
  export: [{ type: "pdf", size: 730000 }]
}

const editorWork = epubWork({
  id: "SvenskaFolkvisor",
  authorId: "GeijerEGA",
  fullName: "Erik Gustaf Geijer",
  surname: "Geijer",
  birth: "1783",
  death: "1847",
  year: "1814",
  role: "editor",
  title: "Svenska folkvisor"
})
editorWork.export.push({ type: "xml", size: 2048 })
editorWork.title = editorWork.shorttitle

const illustratorWork = epubWork({
  id: "BlandTomtarOchTroll",
  authorId: "BauerJ",
  fullName: "John Bauer",
  surname: "Bauer",
  birth: "1882",
  death: "1918",
  year: "1915",
  role: "illustrator",
  title: "Bland tomtar och troll"
})
illustratorWork.export.push({ type: "workdb", size: 512 })
illustratorWork.title = "x".repeat(501)

const gostaBerlingsSaga = epubWork({
  id: "GostaBerlingsSaga",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  birth: "1858",
  death: "1940",
  year: "1891",
  title: "Gösta Berlings saga"
})

export const libraryQueryPageOneResponse = {
  data: [doktorGlas, editorWork, illustratorWork],
  hits: 201,
  distinct_hits: 201,
  suggest: []
}

export const libraryWorksResponse = {
  data: [doktorGlas, doktorGlasFaksimil, editorWork, illustratorWork],
  hits: 4,
  distinct_hits: 3,
  suggest: []
}

const safeDownloadWork = {
  ...epubWork({ id: "SafeDownload", title: "Säkert källmaterial" }),
  export: [{ type: "txt", size: 1024 }]
}
const unsafeDownloadTokenWork = {
  ...epubWork({ id: "UnsafeDownload", title: "Osäkert källmaterial" }),
  lbworkid: "lb-Unsafe,Injected-etext-txt",
  export: [{ type: "txt", size: 2048 }]
}
export const libraryUnsafeDownloadTokenResponse = {
  data: [safeDownloadWork, unsafeDownloadTokenWork],
  hits: 2,
  distinct_hits: 2,
  suggest: []
}

export const libraryQueryPageTwoResponse = {
  data: [gostaBerlingsSaga],
  hits: 201,
  distinct_hits: 201,
  suggest: []
}

const latestDoktorGlas = {
  ...doktorGlas,
  work_titleid: "LegacyDoktorWorkId",
  imported: "2026-07-18"
}
const latestDoktorGlasFaksimil = {
  ...latestDoktorGlas,
  _index: "faksimil",
  mediatype: "faksimil",
  has_epub: false,
  export: [{ type: "pdf", size: 730000 }]
}
const latestEditorWork = { ...editorWork, imported: "2026-07-18" }
const latestIllustratorWork = { ...illustratorWork, imported: "2026-07-17" }
const latestGostaBerlingsSaga = { ...gostaBerlingsSaga, imported: "2026-07-16" }

export const libraryLatestResponse = {
  data: [latestDoktorGlas, latestDoktorGlasFaksimil, latestEditorWork, latestIllustratorWork],
  hits: 4,
  distinct_hits: 4,
  suggest: [],
  imported_aggregation: [
    { imported: Date.UTC(2026, 6, 18), doc_count: 3 },
    { imported: Date.UTC(2026, 6, 17), doc_count: 1 }
  ]
}

export const libraryLatestFilteredResponse = {
  data: [latestGostaBerlingsSaga],
  hits: 1,
  distinct_hits: 1,
  suggest: [],
  imported_aggregation: [{ imported: Date.UTC(2026, 6, 16), doc_count: 1 }]
}

const latestMixedEtext = {
  ...epubWork({ id: "LatestMixed", title: "Blandade representationer" }),
  imported: "2026-07-18"
}
const latestMixedFacsimile = {
  ...latestMixedEtext,
  _index: "faksimil",
  mediatype: "faksimil",
  imported: "2026-07-19"
}
const latestPdfOnly = {
  ...epubWork({ id: "LatestPdfOnly", title: "Senaste PDF-verket" }),
  _index: "pdf",
  mediatype: "pdf",
  imported: "2026-07-17"
}

export const libraryLatestRegressionResponse = {
  data: [latestMixedFacsimile, latestMixedEtext, latestPdfOnly],
  hits: 3,
  distinct_hits: 2,
  suggest: [],
  imported_aggregation: [
    { imported: Date.UTC(2026, 6, 19), doc_count: 1 },
    { imported: Date.UTC(2026, 6, 18), doc_count: 1 },
    { imported: Date.UTC(2026, 6, 17), doc_count: 1 }
  ]
}

export const libraryQueryFilteredResponse = {
  data: [gostaBerlingsSaga],
  hits: 1,
  distinct_hits: 1,
  suggest: []
}

export const libraryQueryMalformedRowResponse = {
  data: [
    doktorGlas,
    null,
    { _index: "etext", title: "Ofullständig" },
    epubWork({
      id: "UnsafeWork",
      authorId: "../unsafe",
      fullName: "Osäker Författare",
      surname: "Osäker",
      year: "1906",
      title: "Osäker sökväg"
    })
  ],
  hits: 201,
  distinct_hits: 201,
  suggest: []
}

const numericIdentifierWork = epubWork({ id: "NumericIdentifier" })
numericIdentifierWork.main_author.authorid = 123

export const libraryQueryStrictRowResponse = {
  data: [
    doktorGlas,
    numericIdentifierWork,
    epubWork({ id: "UnencodableIdentifier", authorId: "\uD800" })
  ],
  hits: 3,
  distinct_hits: 3,
  suggest: []
}

export const libraryQueryEmptyResponse = {
  data: [],
  hits: 0,
  distinct_hits: 0,
  suggest: []
}

export const libraryPartsResponse = {
  data: [{
    _index: "etext-part",
    lbworkid: "lb-Novellsamling",
    titlepath: "Novellsamling/EnNovell",
    titleid: "EnNovell",
    work_titleid: "Novellsamling",
    shorttitle: "En novell",
    title: "En novell i samlingen",
    texttype: "novell",
    mediatype: "etext",
    startpagename: "7",
    sort_date_imprint: { plain: "1903" },
    main_author: {
      authorid: "NovellA",
      full_name: "Nils Novellist",
      surname: "Novellist"
    },
    authors: [{ authorid: "PoetP", full_name: "Pia Poet", surname: "Poet", type: "editor" }],
    work_authors: [{ authorid: "NovellA", surname: "Novellist" }]
  }, {
    _index: "faksimil-part",
    lbworkid: "lb-Novellsamling",
    titlepath: "Novellsamling/EnNovell",
    titleid: "EnNovell",
    work_titleid: "Novellsamling",
    shorttitle: "En novell",
    title: "En novell i samlingen",
    texttype: "novell",
    mediatype: "faksimil",
    startpagename: "7",
    sort_date_imprint: { plain: "1903" },
    main_author: { authorid: "NovellA", full_name: "Nils Novellist", surname: "Novellist" },
    authors: [{ authorid: "PoetP", full_name: "Pia Poet", surname: "Poet", type: "editor" }],
    work_authors: [{ authorid: "NovellA", surname: "Novellist" }]
  }],
  hits: 201,
  distinct_hits: 1,
  suggest: [],
  author_aggregation: [{ authorid: "PoetP" }]
}

const realPdfEtext = {
  ...epubWork({ id: "RealPdf", title: "Verk med riktig PDF" }),
  searchable: true,
  export: [{ type: "epub", size: 530557 }, { type: "pdf", size: 730000 }]
}
const realPdfFile = {
  ...realPdfEtext,
  _index: "pdf",
  mediatype: "pdf",
  startpagename: undefined,
  export: []
}
export const libraryWorksRealPdfResponse = {
  data: [realPdfEtext, realPdfFile],
  hits: 2,
  distinct_hits: 1,
  suggest: []
}

export const libraryWorksInfopostResponse = {
  data: [{
    ...epubWork({ id: "InfopostWork", title: "Drama utan läsläge" }),
    _index: "infopost",
    mediatype: "infopost",
    startpagename: undefined,
    export: [],
    authors: [{ authorid: "SöderbergH", full_name: "Hjalmar Söderberg", surname: "Söderberg" }]
  }],
  hits: 1,
  distinct_hits: 1,
  suggest: []
}

export const libraryQueryMalformedEnvelopeResponse = {
  data: "invalid",
  hits: 0,
  distinct_hits: 0,
  suggest: []
}

const { suggest: omittedSuggest, ...libraryQueryAbsentSuggest } = libraryQueryPageOneResponse
void omittedSuggest
export const libraryQueryAbsentSuggestResponse = libraryQueryAbsentSuggest

export const libraryQueryNullSuggestResponse = {
  ...libraryQueryPageOneResponse,
  suggest: null
}

function authorAggregationFor(response, mode = "works") {
  if (!Array.isArray(response?.data)) return []
  const ids = response.data.flatMap(row => {
    if (!row || typeof row !== "object") return []
    if (mode === "parts") {
      return Array.isArray(row.authors)
        ? row.authors.map(author => author?.authorid).filter(Boolean)
        : []
    }
    return row.main_author?.authorid ? [row.main_author.authorid] : []
  })
  return [...new Set(ids)].map(authorid => ({ authorid }))
}

function manyAuthorAggregation() {
  return Array.from({ length: 151 }, (_, index) => ({
    authorid: `Author${String(index + 1).padStart(3, "0")}`
  }))
}

export function libraryPartsResponseForQuery(query = {}) {
  const normalized = (query.q || "").toLocaleLowerCase("sv-SE")
  const filtered = normalized.includes("selma") || normalized.includes("inga")
    || normalized.includes("många författare")
  const result = structuredClone(filtered
    ? { data: [], hits: 0, distinct_hits: 0, suggest: [], author_aggregation: [] }
    : libraryPartsResponse)
  if (query.to === "0") result.data = []
  return result
}

export function libraryQueryStringResponse(query = {}) {
  const normalized = (query.q || "").toLocaleLowerCase("sv-SE")
  if (query.imported_aggregation === "true") {
    return structuredClone(
      normalized.includes("latest regression")
        ? libraryLatestRegressionResponse
        : normalized.includes("selma") ? libraryLatestFilteredResponse : libraryLatestResponse
    )
  }
  let response = query.author_aggregation === "true"
    ? libraryWorksResponse
    : libraryQueryPageOneResponse

  if (normalized.includes("malformed-top") || normalized.includes("malformed top")) {
    response = libraryQueryMalformedEnvelopeResponse
  } else if (normalized.includes("strict-row") || normalized.includes("strict row")) {
    response = libraryQueryStrictRowResponse
  } else if (normalized.includes("malformed-row") || normalized.includes("malformed row")) {
    response = libraryQueryMalformedRowResponse
  } else if (normalized.includes("sort race")) {
    response = query.sort_field === "sortkey|desc"
      ? libraryQueryPageTwoResponse
      : libraryQueryPageOneResponse
  } else if (normalized.includes("pagination window")) {
    response = {
      ...libraryQueryPageOneResponse,
      hits: 1700,
      distinct_hits: 1700
    }
  } else if (normalized.includes("inga")) {
    response = libraryQueryEmptyResponse
  } else if (normalized.includes("selma")) {
    response = libraryQueryFilteredResponse
  } else if (normalized.includes("real pdf")) {
    response = libraryWorksRealPdfResponse
  } else if (normalized.includes("infopost test")) {
    response = libraryWorksInfopostResponse
  } else if (normalized.includes("unsafe download token")) {
    response = libraryUnsafeDownloadTokenResponse
  } else if (query.from === "100" && query.to === "200") {
    response = libraryQueryPageTwoResponse
  }

  if (normalized.includes("missing-suggest") || normalized.includes("missing suggest")) {
    response = libraryQueryAbsentSuggestResponse
  } else if (normalized.includes("null-suggest") || normalized.includes("null suggest")) {
    response = libraryQueryNullSuggestResponse
  }

  const result = structuredClone(response)
  if (query.author_aggregation === "true") {
    result.author_aggregation = normalized.includes("många författare")
      ? manyAuthorAggregation()
      : authorAggregationFor(response)
  }
  if (query.to === "0" && Array.isArray(result.data)) result.data = []
  return result
}
