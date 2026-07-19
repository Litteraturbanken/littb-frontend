export function libraryPdfRepresentation({
  id,
  authorId,
  fullName,
  surname,
  year,
  title,
  mediatype = "faksimil",
  license = "pd",
  exports,
  workAuthors,
  authors,
  lbworkid = `lb-${id}`,
  titlepath = id,
  overrides = {}
}) {
  return {
    _index: mediatype,
    lbworkid,
    titlepath,
    titleid: id,
    work_titleid: id,
    shorttitle: title,
    title: `${title}. Roman`,
    texttype: "roman",
    mediatype,
    startpagename: "1",
    license,
    sort_date_imprint: { plain: year },
    main_author: { authorid: authorId, full_name: fullName, surname },
    ...(workAuthors ? { work_authors: workAuthors } : {}),
    ...(authors ? { authors } : {}),
    ...(exports ? { export: exports } : {}),
    ...overrides
  }
}

export const exportedEtextPdfRepresentation = libraryPdfRepresentation({
  id: "GostaBerlingsSaga",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  year: "1891",
  title: "Gösta Berlings saga",
  mediatype: "etext",
  workAuthors: [{ authorid: "LagerlofS", surname: "Lagerlöf" }],
  exports: [{ type: "pdf", size: 1_482_731 }]
})

export const exportedFaksimilPdfRepresentation = libraryPdfRepresentation({
  id: "SvenskaFolkvisor",
  authorId: "GeijerEGA",
  fullName: "Erik Gustaf Geijer",
  surname: "Geijer",
  year: "1814",
  title: "Svenska folkvisor",
  workAuthors: [{ authorid: "AfzeliusAA", surname: "Afzelius" }],
  exports: [{ type: "pdf", size: 1_720_419 }]
})

export const indexedPdfRepresentation = libraryPdfRepresentation({
  id: "RodaRummet",
  authorId: "StrindbergA",
  fullName: "August Strindberg",
  surname: "Strindberg",
  year: "1879",
  title: "Röda rummet",
  mediatype: "pdf",
  license: "restricted",
  authors: [{ authorid: "ArchiveA", surname: "Arkiv" }],
  overrides: { title: "Röda rummet. Skildringar ur artist- och författarlivet" }
})

export const groupedPdfExportRepresentation = libraryPdfRepresentation({
  id: "NilsHolgersson",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  year: "1906",
  title: "Nils Holgerssons underbara resa",
  workAuthors: [{ authorid: "LagerlofS", surname: "Lagerlöf" }],
  exports: [{ type: "pdf", size: 2_210_001 }]
})

export const groupedDirectPdfRepresentation = libraryPdfRepresentation({
  id: "NilsHolgersson",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  year: "1906",
  title: "Nils Holgerssons underbara resa",
  mediatype: "pdf",
  license: "restricted",
  workAuthors: [{ authorid: "DirectPdfA", surname: "Direkt" }],
  overrides: { work_titleid: "NilsHolgerssonPdf" }
})

export const duplicatePdfExportRepresentation = libraryPdfRepresentation({
  id: "Jerusalem",
  authorId: "LagerlofS",
  fullName: "Selma Lagerlöf",
  surname: "Lagerlöf",
  year: "1901",
  title: "Jerusalem",
  mediatype: "etext",
  exports: [
    { type: "pdf", size: 1_100_001 },
    { type: "pdf", size: 1_100_002 }
  ]
})

export const restrictedPdfExportRepresentation = libraryPdfRepresentation({
  id: "RestrictedExport",
  authorId: "RestrictedA",
  fullName: "Begränsad Författare",
  surname: "Begränsad",
  year: "1921",
  title: "Begränsad export",
  license: "restricted",
  exports: [{ type: "pdf", size: 900_001 }]
})

export const pageTwoPdfRepresentation = libraryPdfRepresentation({
  id: "DoktorGlas",
  authorId: "SöderbergH",
  fullName: "Hjalmar Söderberg",
  surname: "Söderberg",
  year: "1905",
  title: "Doktor Glas",
  workAuthors: [{ authorid: "SöderbergH", surname: "Söderberg" }],
  exports: [{ type: "pdf", size: 1_930_005 }]
})

export const libraryPdfPageOneResponse = {
  data: [
    exportedEtextPdfRepresentation,
    exportedFaksimilPdfRepresentation,
    indexedPdfRepresentation,
    groupedDirectPdfRepresentation,
    groupedPdfExportRepresentation,
    duplicatePdfExportRepresentation,
    restrictedPdfExportRepresentation
  ],
  hits: 307,
  distinct_hits: 201,
  suggest: []
}

export const libraryPdfPageTwoResponse = {
  data: [pageTwoPdfRepresentation],
  hits: 307,
  distinct_hits: 201,
  suggest: []
}

export const libraryPdfFilteredResponse = {
  data: [exportedEtextPdfRepresentation],
  hits: 2,
  distinct_hits: 1,
  suggest: []
}

export const libraryPdfEmptyResponse = {
  data: [],
  hits: 0,
  distinct_hits: 0,
  suggest: []
}

export const libraryPdfMalformedEnvelopeResponse = {
  data: "invalid",
  hits: 0,
  distinct_hits: 0,
  suggest: []
}

export const libraryPdfPrimitiveEnvelopeResponse = null

export const libraryPdfInvalidHitsResponse = {
  data: [],
  hits: "307",
  distinct_hits: 0,
  suggest: []
}

export const libraryPdfInvalidDistinctHitsResponse = {
  data: [],
  hits: 0,
  distinct_hits: null,
  suggest: []
}

export const libraryPdfInvalidSuggestResponse = {
  data: [],
  hits: 0,
  distinct_hits: 0,
  suggest: {}
}

const tupleCollisionOne = libraryPdfRepresentation({
  id: "TupleCollisionOne",
  authorId: "TupleA",
  fullName: "Första Kollision",
  surname: "Kollision",
  year: "1903",
  title: "Första tuple-kollisionen",
  lbworkid: "c",
  titlepath: "ab",
  exports: [{ type: "pdf", size: 610_001 }]
})

const tupleCollisionTwo = libraryPdfRepresentation({
  id: "TupleCollisionTwo",
  authorId: "TupleB",
  fullName: "Andra Kollision",
  surname: "Kollision",
  year: "1904",
  title: "Andra tuple-kollisionen",
  lbworkid: "bc",
  titlepath: "a",
  exports: [{ type: "pdf", size: 610_002 }]
})

const samePathOne = libraryPdfRepresentation({
  id: "SamePathOne",
  authorId: "SamePathA",
  fullName: "Första delade sökvägen",
  surname: "Sökväg",
  year: "1905",
  title: "Första delade sökvägen",
  lbworkid: "lb-same-path-one",
  titlepath: "shared-path",
  exports: [{ type: "pdf", size: 620_001 }]
})

const samePathTwo = libraryPdfRepresentation({
  id: "SamePathTwo",
  authorId: "SamePathB",
  fullName: "Andra delade sökvägen",
  surname: "Sökväg",
  year: "1906",
  title: "Andra delade sökvägen",
  lbworkid: "lb-same-path-two",
  titlepath: "shared-path",
  exports: [{ type: "pdf", size: 620_002 }]
})

const sameWorkOne = libraryPdfRepresentation({
  id: "SameWorkOne",
  authorId: "SameWorkA",
  fullName: "Första delade verket",
  surname: "Verk",
  year: "1907",
  title: "Första delade verket",
  lbworkid: "lb-shared-work",
  titlepath: "same-work-one",
  exports: [{ type: "pdf", size: 630_001 }]
})

const sameWorkTwo = libraryPdfRepresentation({
  id: "SameWorkTwo",
  authorId: "SameWorkB",
  fullName: "Andra delade verket",
  surname: "Verk",
  year: "1908",
  title: "Andra delade verket",
  lbworkid: "lb-shared-work",
  titlepath: "same-work-two",
  exports: [{ type: "pdf", size: 630_002 }]
})

const exactTupleFirst = libraryPdfRepresentation({
  id: "ExactTupleFirst",
  authorId: "FirstTupleA",
  fullName: "Första exakta gruppen",
  surname: "Första",
  year: "1909",
  title: "Första exakta gruppen",
  mediatype: "etext",
  lbworkid: "lb-exact-tuple",
  titlepath: "exact-tuple",
  exports: [{ type: "pdf", size: 710_001 }]
})

const exactTupleSecond = libraryPdfRepresentation({
  id: "ExactTupleSecond",
  authorId: "SecondTupleA",
  fullName: "Andra exakta gruppen",
  surname: "Andra",
  year: "1910",
  title: "Andra exakta gruppen",
  lbworkid: "lb-exact-tuple",
  titlepath: "exact-tuple",
  exports: [{ type: "pdf", size: 710_002 }]
})

const laterExportGroupMain = libraryPdfRepresentation({
  id: "LaterExportGroupMain",
  authorId: "GroupMainA",
  fullName: "Grupphuvud Författare",
  surname: "Grupphuvud",
  year: "1911",
  title: "Grupphuvud utan export",
  mediatype: "etext",
  lbworkid: "lb-later-export-group",
  titlepath: "later-export-group"
})

const laterExportRepresentation = libraryPdfRepresentation({
  id: "LaterExportRepresentation",
  authorId: "LaterExportA",
  fullName: "Senare Exportkälla",
  surname: "Exportkälla",
  year: "1912",
  title: "Senare PDF-exportkälla",
  lbworkid: "lb-later-export-group",
  titlepath: "later-export-group",
  exports: [{ type: "pdf", size: 720_002 }]
})

export const libraryPdfTupleCollisionResponse = {
  data: [
    tupleCollisionOne,
    tupleCollisionTwo,
    samePathOne,
    samePathTwo,
    sameWorkOne,
    sameWorkTwo,
    exactTupleFirst,
    exactTupleSecond,
    laterExportGroupMain,
    laterExportRepresentation
  ],
  hits: 10,
  distinct_hits: 8,
  suggest: []
}

const malformedBase = {
  authorId: "SafeA",
  fullName: "Säker Författare",
  surname: "Säker",
  year: "1902",
  mediatype: "pdf",
  license: "restricted"
}

const missingYearRepresentation = libraryPdfRepresentation({
  ...malformedBase,
  id: "MissingYear",
  title: "Saknat år"
})
delete missingYearRepresentation.sort_date_imprint

export const libraryPdfMalformedRowResponse = {
  data: [
    exportedEtextPdfRepresentation,
    null,
    { _index: "pdf", title: "Ofullständig" },
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeAuthor",
      authorId: "../unsafe",
      fullName: "Osäker Författare",
      surname: "Osäker",
      title: "Osäker författare"
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeTitle",
      title: "Osäker titel",
      overrides: { titleid: "Unsafe/Title", work_titleid: "Unsafe/Title" }
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsupportedAudio",
      title: "Ljudupptagning",
      mediatype: "audio",
      license: "pd",
      exports: [{ type: "pdf", size: 501_001 }]
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeDotWork",
      title: "Osäkert punkt-id",
      lbworkid: ".."
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeSlashWork",
      title: "Osäkert snedstreck",
      lbworkid: "lb/unsafe"
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeControlWork",
      title: "Osäkert kontrolltecken",
      lbworkid: "lb-\u0000unsafe"
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "NumericWork",
      title: "Numeriskt id",
      lbworkid: 123
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnencodableWork",
      title: "Okodbart id",
      lbworkid: "\uD800"
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "UnsafeWorkAuthor",
      title: "Osäker verkförfattare",
      workAuthors: [{ authorid: "../unsafe", surname: "Osäker" }]
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "MalformedAuthors",
      title: "Felaktig författarlista",
      authors: [null]
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "EmptyWorkAuthors",
      title: "Tom verkförfattarlista",
      workAuthors: []
    }),
    missingYearRepresentation,
    libraryPdfRepresentation({
      ...malformedBase,
      id: "MissingDisplayTitle",
      title: "Saknad titel",
      overrides: { shorttitle: "", title: "" }
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "MissingAuthorName",
      title: "Saknat författarnamn",
      overrides: {
        main_author: { authorid: "SafeA", surname: "Säker" }
      }
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "MalformedGroupedFallback",
      title: "Giltig gruppexport",
      mediatype: "faksimil",
      license: "pd",
      exports: [{ type: "pdf", size: 620_001 }]
    }),
    libraryPdfRepresentation({
      ...malformedBase,
      id: "MalformedGroupedFallback",
      title: "Felaktig direkt-PDF",
      workAuthors: [{ authorid: "../unsafe", surname: "Osäker" }]
    })
  ],
  hits: 307,
  distinct_hits: 201,
  suggest: []
}

export function libraryPdfResponse(query = {}) {
  const normalized = (query.q || "").toLocaleLowerCase("sv-SE")
  let response = libraryPdfPageOneResponse

  if (normalized.includes("primitive-envelope") || normalized.includes("primitive envelope")) {
    response = libraryPdfPrimitiveEnvelopeResponse
  } else if (normalized.includes("invalid-hits") || normalized.includes("invalid hits")) {
    response = libraryPdfInvalidHitsResponse
  } else if (normalized.includes("invalid-distinct") || normalized.includes("invalid distinct")) {
    response = libraryPdfInvalidDistinctHitsResponse
  } else if (normalized.includes("invalid-suggest") || normalized.includes("invalid suggest")) {
    response = libraryPdfInvalidSuggestResponse
  } else if (normalized.includes("tuple-collision") || normalized.includes("tuple collision")) {
    response = libraryPdfTupleCollisionResponse
  } else if (normalized.includes("malformed-top") || normalized.includes("malformed top")) {
    response = libraryPdfMalformedEnvelopeResponse
  } else if (normalized.includes("malformed-row") || normalized.includes("malformed row")) {
    response = libraryPdfMalformedRowResponse
  } else if (normalized.includes("inga")) {
    response = libraryPdfEmptyResponse
  } else if (normalized.includes("selma")) {
    response = libraryPdfFilteredResponse
  } else if (query.from === "100" && query.to === "200") {
    response = libraryPdfPageTwoResponse
  }

  const cloned = structuredClone(response)
  if (normalized.includes("missing-suggest") || normalized.includes("missing suggest")) {
    delete cloned.suggest
  } else if (normalized.includes("null-suggest") || normalized.includes("null suggest")) {
    cloned.suggest = null
  }

  if (typeof query.include === "string" && Array.isArray(cloned?.data)) {
    const included = new Set(query.include.split(","))
    for (const row of cloned.data) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) continue
      if (!included.has("license")) delete row.license
      if (!included.has("authors.authorid") && !included.has("authors.surname")) {
        delete row.authors
      } else if (Array.isArray(row.authors)) {
        row.authors = row.authors.map((author) => {
          if (author === null || typeof author !== "object" || Array.isArray(author)) return author
          return {
            ...(included.has("authors.authorid") ? { authorid: author.authorid } : {}),
            ...(included.has("authors.surname") ? { surname: author.surname } : {})
          }
        })
      }
    }
  }
  return cloned
}
