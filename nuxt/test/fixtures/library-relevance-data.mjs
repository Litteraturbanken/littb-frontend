const rodaRummet = {
  _index: "etext",
  lbworkid: "lb238704",
  work_titleid: "RodaRummet",
  title: "Röda rummet",
  shorttitle: "Röda rummet",
  texttype: "roman",
  mediatype: "etext",
  startpagename: "1",
  sort_date_imprint: { plain: 1879 },
  main_author: {
    authorid: "StrindbergA",
    full_name: "August Strindberg",
    type: "author"
  },
  work_authors: [{ authorid: "StrindbergA" }],
  highlight: {}
}

const strindberg = {
  _index: "author",
  authorid: "StrindbergA",
  name_for_index: "Strindberg, August",
  birth: { plain: 1849 },
  death: { plain: 1912 },
  highlight: {}
}

const presentation = {
  _index: "presentations",
  title: "August Strindberg",
  url: "/presentationer/forfattare/StrindbergA.html",
  article_author: "Litteraturbanken",
  highlight: {}
}

const presentationWithoutArticleAuthor = {
  _index: "presentations",
  title: "sent på jorden (1932–1962): en samling",
  url: "https://litteraturbanken.se/presentationer/specialomraden/Spj_utg.html",
  article_author: null,
  highlight: {}
}

const faksimil = {
  _index: "faksimil",
  title: "Gösta Berlings saga",
  texttype: "roman",
  mediatype: "faksimil",
  startpagename: "3",
  work_titleid: "GostaBerlingsSaga",
  sort_date_imprint: { plain: 1891 },
  main_author: { authorid: "LagerlofS", full_name: "Selma Lagerlöf", type: "author" },
  work_authors: [{ authorid: "LagerlofS" }]
}

const pdf = {
  _index: "pdf",
  title: "En PDF-bok",
  texttype: "roman",
  lbworkid: "lb-pdf",
  sort_date_imprint: { plain: 1902 },
  main_author: { authorid: "PdfA", full_name: "Pia Författare", type: "author" }
}

const longShortTitle = {
  _index: "etext",
  lbworkid: "lb-long-shorttitle",
  work_titleid: "LongShorttitle",
  title: "Den fullständiga titeln som ska visas som verktygstips när den korta titeln kapas",
  shorttitle: "En avsiktligt mycket lång korttitel som måste förkortas visuellt utan att flytta årtal eller författare i resultatraden",
  texttype: "roman",
  mediatype: "etext",
  startpagename: "1",
  sort_date_imprint: { plain: 1905 },
  main_author: { authorid: "LongA", full_name: "Lång Titel", type: "author" },
  work_authors: [{ authorid: "LongA" }]
}

const editorResult = {
  _index: "pdf",
  title: "Redaktörens bok",
  shorttitle: "Redaktörens bok",
  texttype: "roman",
  lbworkid: "lb-editor",
  sort_date_imprint: { plain: 1906 },
  main_author: { authorid: "EditorA", full_name: "Erik Redaktör", type: "editor" }
}

const illustratorResult = {
  _index: "faksimil",
  title: "Illustratörens bok",
  shorttitle: "Illustratörens bok",
  texttype: "roman",
  mediatype: "faksimil",
  startpagename: "1",
  work_titleid: "IllustratorBook",
  sort_date_imprint: { plain: 1907 },
  main_author: { authorid: "IllustratorA", full_name: "Ida Illustratör", type: "illustrator" },
  work_authors: [{ authorid: "IllustratorA" }]
}

const etextPart = {
  _index: "etext-part",
  title: "En novell",
  texttype: "novell",
  mediatype: "etext",
  startpagename: "7",
  work_titleid: "Novellsamling",
  sort_date_imprint: { plain: 1903 },
  main_author: { authorid: "NovellA", full_name: "Nils Novellist", type: "author" },
  work_authors: [{ authorid: "NovellA" }]
}

const faksimilPart = {
  _index: "faksimil-part",
  title: "En dikt",
  texttype: "dikt",
  mediatype: "faksimil",
  startpagename: "9",
  work_titleid: "Diktsamling",
  sort_date_imprint: { plain: 1904 },
  main_author: { authorid: "DiktA", full_name: "Disa Diktare", type: "author" },
  work_authors: [{ authorid: "DiktA" }]
}

const sol = {
  _index: "sol",
  article: { ArticleName: "Ada Nilsson", URLName: "Ada_Nilsson" },
  contributors: { FirstName: "Sven", LastName: "Skribent" }
}

const literatureMap = {
  _index: "litteraturkartan",
  header: "Göteborg i litteraturen",
  placeid: "Göteborg",
  id: "artikel/1",
  article_author: "Karin Kartograf"
}

const wordpress = {
  _index: "wordpress",
  title: "Litteratur i skolan",
  link: "https://litteraturbanken.se/skolan/litteratur/",
  source: "skolan"
}

const selma = {
  _index: "author",
  authorid: "LagerlofS",
  name_for_index: "Lagerlöf, Selma",
  birth: { plain: 1858 },
  death: { plain: 1940 },
  highlight: {}
}

function authorResult(authorid, name_for_index, birth, death, popularity) {
  return {
    _index: "author",
    authorid,
    name_for_index,
    birth: { plain: birth },
    death: { plain: death },
    popularity: String(popularity),
    highlight: {}
  }
}

const browseAuthors = [
  authorResult("SöderbergH", "Söderberg, Hjalmar", 1869, 1941, 90),
  authorResult("GeijerEGA", "Geijer, Erik Gustaf", 1783, 1847, 70),
  authorResult("BauerJ", "Bauer, John", 1882, 1918, 60),
  authorResult("PoetP", "Poet, Pia", 1878, 1948, 40),
  { ...selma, popularity: "100" }
]

const manyAuthors = Array.from({ length: 151 }, (_, index) => authorResult(
  `Author${String(index + 1).padStart(3, "0")}`,
  `Författare, Nummer ${String(index + 1).padStart(3, "0")}`,
  1800 + index,
  1860 + index,
  151 - index
))

const allBrowseAuthors = [...browseAuthors, ...manyAuthors]

const latest = {
  _index: "etext",
  lbworkid: "lb-latest",
  work_titleid: "LatestResult",
  title: "Senaste träffen",
  shorttitle: "Senaste träffen",
  texttype: "roman",
  mediatype: "etext",
  startpagename: "1",
  sort_date_imprint: { plain: 1901 },
  main_author: {
    authorid: "LatestA",
    full_name: "Senaste Författaren",
    type: "author"
  },
  work_authors: [{ authorid: "LatestA" }],
  highlight: {}
}

export const libraryDefaultResults = [rodaRummet, strindberg, presentation]

export const libraryProductionShapeResults = [
  ...Array.from({ length: 99 }, (_, index) => ({
    ...rodaRummet,
    lbworkid: `lb-production-${index + 1}`,
    work_titleid: `ProductionResult${index + 1}`,
    title: `Produktionsresultat ${index + 1}`,
    shorttitle: `Produktionsresultat ${index + 1}`
  })),
  presentationWithoutArticleAuthor
]

export const libraryMixedResults = [
  rodaRummet,
  faksimil,
  pdf,
  etextPart,
  faksimilPart,
  strindberg,
  presentation,
  sol,
  literatureMap,
  wordpress,
  null,
  { _index: "unsupported", title: "Okänd" },
  { _index: "etext", title: "Ofullständig" },
  { _index: "presentations", title: "Osäker presentation", url: "javascript:alert(1)", article_author: "Angripare" },
  { _index: "presentations", title: "Protokollrelativ", url: "//evil.example/p", article_author: "Angripare" },
  { _index: "wordpress", title: "Osäker artikel", link: "data:text/html,boom", source: "skolan" },
  { _index: "wordpress", title: "Oväntad värd", link: "https://evil.example/p", source: "skolan" }
]

export function libraryRelevanceResponse(query = "", resultTypes = "", from = "0", to = "100") {
  const normalized = query.toLocaleLowerCase("sv-SE")
  if (normalized.includes("malformed-top") || normalized.includes("malformed top")) {
    return { data: "invalid", hits: 0, suggest: [] }
  }
  let data = libraryDefaultResults
  if (normalized.includes("produktionsform")) data = libraryProductionShapeResults
  else if (normalized.includes("titelmetadata")) {
    data = [longShortTitle, editorResult, illustratorResult, rodaRummet]
  }
  else if (normalized.includes("blandat")) data = libraryMixedResults
  else if (normalized.includes("många författare")) data = manyAuthors
  else if (normalized.includes("selma")) data = [selma]
  else if (normalized.includes("senaste")) data = [latest]
  else if (normalized.includes("röda")) data = [rodaRummet]
  else if (normalized.includes("inga")) data = []

  if (resultTypes === "author") {
    data = normalized
      ? data.filter(item => item?._index === "author")
      : allBrowseAuthors
  }

  const hits = data.length
  const start = Math.max(0, Number.parseInt(from, 10) || 0)
  const end = Math.max(start, Number.parseInt(to, 10) || 0)
  const response = {
    data: structuredClone(data.slice(start, end)),
    hits,
    suggest: []
  }
  if (normalized.includes("null-suggest") || normalized.includes("null suggest")) {
    response.suggest = null
  } else if (normalized.includes("malformed-suggest") || normalized.includes("malformed suggest")) {
    response.suggest = "invalid"
  } else if (normalized.includes("missing-suggest") || normalized.includes("missing suggest")) {
    delete response.suggest
  }
  return response
}
