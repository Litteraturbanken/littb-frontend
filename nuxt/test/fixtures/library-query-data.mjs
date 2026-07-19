export function epubWork({
  id = "DoktorGlas",
  authorId = "SöderbergH",
  fullName = "Hjalmar Söderberg",
  surname = "Söderberg",
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
      ...(role ? { type: role } : {})
    },
    work_authors: [{ authorid: authorId, surname }],
    export: [{ type: "epub", size: 530557 }]
  }
}

const doktorGlas = epubWork()

const editorWork = epubWork({
  id: "SvenskaFolkvisor",
  authorId: "GeijerEGA",
  fullName: "Erik Gustaf Geijer",
  surname: "Geijer",
  year: "1814",
  role: "editor",
  title: "Svenska folkvisor"
})

const illustratorWork = epubWork({
  id: "BlandTomtarOchTroll",
  authorId: "BauerJ",
  fullName: "John Bauer",
  surname: "Bauer",
  year: "1915",
  role: "illustrator",
  title: "Bland tomtar och troll"
})

const gostaBerlingsSaga = epubWork({
  id: "GostaBerlingsSaga",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  year: "1891",
  title: "Gösta Berlings saga"
})

export const libraryQueryPageOneResponse = {
  data: [doktorGlas, editorWork, illustratorWork],
  hits: 201,
  distinct_hits: 201,
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

export const libraryQueryMalformedEnvelopeResponse = {
  data: "invalid",
  hits: 0,
  distinct_hits: 0,
  suggest: []
}

const { suggest: _suggest, ...libraryQueryAbsentSuggest } = libraryQueryPageOneResponse
export const libraryQueryAbsentSuggestResponse = libraryQueryAbsentSuggest

export const libraryQueryNullSuggestResponse = {
  ...libraryQueryPageOneResponse,
  suggest: null
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
  let response = libraryQueryPageOneResponse

  if (normalized.includes("malformed-top") || normalized.includes("malformed top")) {
    response = libraryQueryMalformedEnvelopeResponse
  } else if (normalized.includes("strict-row") || normalized.includes("strict row")) {
    response = libraryQueryStrictRowResponse
  } else if (normalized.includes("malformed-row") || normalized.includes("malformed row")) {
    response = libraryQueryMalformedRowResponse
  } else if (normalized.includes("inga")) {
    response = libraryQueryEmptyResponse
  } else if (normalized.includes("selma")) {
    response = libraryQueryFilteredResponse
  } else if (query.from === "100" && query.to === "200") {
    response = libraryQueryPageTwoResponse
  }

  if (normalized.includes("missing-suggest") || normalized.includes("missing suggest")) {
    response = libraryQueryAbsentSuggestResponse
  } else if (normalized.includes("null-suggest") || normalized.includes("null suggest")) {
    response = libraryQueryNullSuggestResponse
  }

  return structuredClone(response)
}
