export const strindbergAuthorSummary = {
  author_id: "StrindbergA",
  full_name: "August Strindberg",
  surname: "Strindberg"
}

export const lagerlofAuthorSummary = {
  author_id: "LagerlofS",
  full_name: "Selma Lagerlöf",
  surname: "Lagerlöf"
}

export const longNameAuthorSummary = {
  author_id: "LongNameAuthor",
  full_name: "Anna Maria Lovisa Charlotta von Långnamn",
  surname: null
}

export const historyAuthorSummaries = [
  lagerlofAuthorSummary,
  longNameAuthorSummary,
  strindbergAuthorSummary
]

export const historyVisualRecords = [
  {
    author: "StrindbergA",
    label: "Röda rummet (etext)",
    url: "/författare/StrindbergA/titlar/RodaRummet/etext?om-boken"
  },
  {
    author: "StrindbergA",
    label: "Röda rummet (faksimil)",
    url: "/författare/StrindbergA/titlar/RodaRummet/faksimil?om-boken"
  },
  {
    author: "LongNameAuthor",
    label: "Den ovanligt långa titeln om en vandring genom tid och rum, minne och glömska",
    url: "/författare/LongNameAuthor/titlar/DenOvanligtLangaTiteln/etext?om-boken"
  }
]

export const historyVisualStorage = JSON.stringify(historyVisualRecords)
