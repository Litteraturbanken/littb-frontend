export const quickSearchVisualQuery = "strindberg"

export const angularQuickSearchResponse = {
  data: [
    {
      doc_type: "author",
      authorid: "StrindbergA",
      name_for_index: "Strindberg, August",
      birth: { plain: "1849" },
      death: { plain: "1912" }
    },
    {
      doc_type: "etext",
      startpagename: "1",
      shorttitle: "Röda rummet",
      title: "Röda rummet",
      titleid: "RodaRummet",
      work_titleid: "RodaRummet",
      authors: [{ surname: "Strindberg", authorid: "StrindbergA" }],
      work_authors: [{ surname: "Strindberg", authorid: "StrindbergA" }]
    },
    {
      doc_type: "faksimil-part",
      mediatype: "faksimil",
      startpagename: "3",
      shorttitle: "Landskapet",
      title: "Landskapet",
      work_titleid: "GostaBerlingsSaga",
      authors: [{ surname: "Lagerlöf", authorid: "LagerlofS" }],
      work_authors: [{ surname: "Lagerlöf", authorid: "LagerlofS" }]
    }
  ],
  suggest: []
}

export const quickSearchTypedResponse = {
  items: [
    {
      kind: "author",
      label: "Strindberg, August (1849-1912)",
      url: "/författare/StrindbergA",
      type_label: "Författare",
      media_type_label: null
    },
    {
      kind: "work",
      label: "Strindberg – Röda rummet",
      url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
      type_label: "Verk",
      media_type_label: "etext"
    },
    {
      kind: "part",
      label: "Lagerlöf – Landskapet",
      url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
      type_label: "Del",
      media_type_label: "faksimil"
    }
  ],
  correction: null
}
