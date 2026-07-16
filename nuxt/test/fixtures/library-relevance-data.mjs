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

const selma = {
  _index: "author",
  authorid: "LagerlofS",
  name_for_index: "Lagerlöf, Selma",
  birth: { plain: 1858 },
  death: { plain: 1940 },
  highlight: {}
}

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

export function libraryRelevanceResponse(query = "") {
  const normalized = query.toLocaleLowerCase("sv-SE")
  let data = libraryDefaultResults
  if (normalized.includes("selma")) data = [selma]
  else if (normalized.includes("senaste")) data = [latest]
  else if (normalized.includes("röda")) data = [rodaRummet]
  else if (normalized.includes("inga")) data = []

  return {
    data: structuredClone(data),
    hits: data.length,
    suggest: []
  }
}
