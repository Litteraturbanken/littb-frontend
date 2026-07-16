const rodaRummet = {
  work_id: "lb238704",
  author: {
    label: "Strindberg",
    url: "/författare/StrindbergA"
  },
  title: {
    label: "Röda rummet",
    url: "/författare/StrindbergA/titlar/RodaRummet/etext"
  },
  media: [
    {
      label: "etext",
      url: "/författare/StrindbergA/titlar/RodaRummet/etext"
    },
    {
      label: "faksimil",
      url: "/författare/StrindbergA/titlar/RodaRummet/faksimil"
    }
  ]
}

const gostaBerlingsSaga = {
  work_id: "lb278171",
  author: {
    label: "Lagerlöf",
    url: "/författare/LagerlofS"
  },
  title: {
    label: "Gösta Berlings saga",
    url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/etext"
  },
  media: [
    {
      label: "etext",
      url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/etext"
    }
  ]
}

const duplicateRepresentation = {
  work_id: "lb-duplicate",
  author: {
    label: "Testförfattare",
    url: "/författare/TestAuthor"
  },
  title: {
    label: "Dubblett",
    url: "/författare/TestAuthor/titlar/Duplicate/etext"
  },
  media: [
    {
      label: "etext",
      url: "/författare/TestAuthor/titlar/Duplicate/etext"
    },
    {
      label: "etext",
      url: "/författare/TestAuthor/titlar/Duplicate/etext"
    }
  ]
}

const entries = [
  {
    item: rodaRummet,
    searchTitles: ["Röda rummet", "RödaRummet", "RodaRummet"]
  },
  {
    item: gostaBerlingsSaga,
    searchTitles: ["Gösta Berlings saga", "GostaBerlingsSaga"]
  },
  {
    item: duplicateRepresentation,
    searchTitles: ["Dubblett", "Duplicate"]
  }
]

export function workLookupResponse(body) {
  if (body.work_id !== null) {
    const match = entries.find(entry => entry.item.work_id === body.work_id)
    return { items: match ? [match.item] : [] }
  }

  const queries = body.titles.map(title => title.toLowerCase())
  return {
    items: entries
      .filter(entry => queries.some(query => (
        entry.searchTitles.some(title => title.toLowerCase().includes(query))
      )))
      .map(entry => entry.item)
  }
}
