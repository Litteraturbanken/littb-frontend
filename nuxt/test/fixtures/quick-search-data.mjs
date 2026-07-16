const author = {
  kind: "author",
  label: "Strindberg, August (1849-1912)",
  url: "/författare/StrindbergA",
  type_label: "Författare",
  media_type_label: null
}

const work = {
  kind: "work",
  label: "Strindberg – Röda rummet",
  url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
  type_label: "Verk",
  media_type_label: "etext"
}

const part = {
  kind: "part",
  label: "Lagerlöf – Landskapet",
  url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
  type_label: "Del",
  media_type_label: "faksimil"
}

const noHits = { items: [], correction: null }

const responses = new Map([
  ["strindberg", { items: [author, work, part], correction: null }],
  ["strindbrg", { items: [], correction: "strindberg" }],
  ["inga", noHits]
])

export function quickSearchResponse(query) {
  return responses.get(query) ?? noHits
}
