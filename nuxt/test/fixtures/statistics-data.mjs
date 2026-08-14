export const stats = {
  works: 16237,
  authors: 5521,
  pages: { etext: 342753, faksimil: 2737882 },
  words: { etext: 71987189, faksimil: 669221541 },
  epubs: 1513
}

const author = (authorId, fullName, surname) => ({
  author_id: authorId,
  full_name: fullName,
  surname
})

function workAt(rank) {
  if (rank === 1) {
    return {
      title_id: "DoktorGlas",
      title_path: "DoktorGlas",
      title: "Doktor Glas",
      short_title: null,
      author: author("SöderbergH", "Hjalmar Söderberg", "Söderberg"),
      representation: {
        work_id: "lb-doktor-glas",
        media_type: "etext",
        start_page_name: "-2"
      }
    }
  }
  if (rank === 2) {
    return {
      title_id: "FrokenJulie1888",
      title_path: "FrokenJulie1888",
      title: "Fröken Julie",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg"),
      representation: {
        work_id: "lb-froken-julie",
        media_type: "faksimil",
        start_page_name: "i"
      }
    }
  }
  if (rank === 3) {
    return {
      title_id: "SamladeVerk27",
      title_path: "SamladeVerk27",
      title: "Samlade Verk 27. Fadren. Fröken Julie. Fordringsägare",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg"),
      representation: {
        work_id: "lb-samlade-verk-27",
        media_type: "etext",
        start_page_name: "1"
      }
    }
  }

  return {
    title_id: `PopularWork${rank}`,
    title_path: rank === 4 ? "PopularRoute4" : `PopularWork${rank}`,
    title: `Popular Work ${rank}`,
    short_title: rank === 5 ? "Work Five" : null,
    author: author(
      `Author${rank}`,
      `Full Author ${rank}`,
      rank % 2 === 0 ? `Surname ${rank}` : null
    ),
    representation: {
      work_id: `lb-popular-${rank}`,
      media_type: rank % 3 === 0 ? "pdf" : rank % 2 === 0 ? "faksimil" : "etext",
      start_page_name: rank === 4 ? null : String(rank)
    }
  }
}

function epubAt(rank) {
  if (rank === 1) {
    return {
      title_id: "DoktorGlas",
      title: "Doktor Glas",
      short_title: null,
      author: author("SoderbergH", "Hjalmar Söderberg", "Söderberg")
    }
  }
  if (rank === 2) {
    return {
      title_id: "FrokenJulie1888",
      title: "Fröken Julie",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg")
    }
  }
  return {
    title_id: rank === 30 ? "Epub/Work?30" : `EpubWork${rank}`,
    title: `EPUB Work ${rank}`,
    short_title: rank === 5 ? "EPUB Five" : null,
    author: author(
      rank === 30 ? "EpubAuthor#30" : `EpubAuthor${rank}`,
      `Full EPUB Author ${rank}`,
      rank % 2 === 0 ? `EPUB Surname ${rank}` : null
    )
  }
}

export const popularWorks = Array.from({ length: 30 }, (_, index) => workAt(index + 1))
export const popularEpubs = Array.from({ length: 30 }, (_, index) => epubAt(index + 1))

const malformedRouteCharacters = [
  { name: "slash", value: "/" },
  { name: "backslash", value: "\\" },
  { name: "percent", value: "%" }
]

function statisticsMatrixWork(field, character) {
  const suffix = `${field}-${character.name}`
  const item = {
    title_id: `Malformed-${suffix}`,
    title_path: `Malformed-${suffix}`,
    title: `Malformed ${character.name} ${field} statistics work`,
    short_title: null,
    author: author(`Malformed-${suffix}`, "Malformed Statistics Author", "Malformed"),
    representation: {
      work_id: `malformed-${suffix}`,
      media_type: "etext",
      start_page_name: "1"
    }
  }
  if (field === "author") item.author.author_id = `Unsafe${character.value}Author`
  if (field === "title") item.title_path = `Unsafe${character.value}Title`
  if (field === "page") item.representation.start_page_name = `Unsafe${character.value}Page`
  return { field, character: character.name, item }
}

export const malformedStatisticsRouteWorks = malformedRouteCharacters.flatMap(character => [
  statisticsMatrixWork("author", character),
  statisticsMatrixWork("title", character),
  statisticsMatrixWork("page", character)
])

export const malformedStatisticsRouteEpubs = malformedRouteCharacters.map(character => ({
  field: "author",
  character: character.name,
  item: {
    title_id: `Malformed-${character.name}-epub-author`,
    title: `Malformed ${character.name} EPUB author`,
    short_title: null,
    author: author(
      `Unsafe${character.value}EpubAuthor`,
      "Malformed EPUB Author",
      "Malformed"
    )
  }
}))

export const validStatisticsRouteWork = {
  title_id: "ValidStatisticsWork",
  title_path: "ValidStatisticsWork",
  title: "Valid statistics work sibling",
  short_title: null,
  author: author("ValidStatisticsAuthor", "Valid Statistics Author", "Valid"),
  representation: {
    work_id: "valid-statistics-work",
    media_type: "etext",
    start_page_name: "1"
  }
}

export const validStatisticsPercentPdf = {
  title_id: "ValidStatisticsPercentPdf",
  title_path: "ValidStatisticsPercentPdf",
  title: "Valid percent PDF filename",
  short_title: null,
  author: author("ValidPdfAuthor", "Valid PDF Author", "Valid"),
  representation: {
    work_id: "valid%statistics-pdf",
    media_type: "pdf",
    start_page_name: null
  }
}

export const validStatisticsPercentEpub = {
  title_id: "Valid%StatisticsEpub",
  title: "Valid percent EPUB filename",
  short_title: null,
  author: author("ValidEpubAuthor", "Valid EPUB Author", "Valid")
}

export const validStatisticsNullableEpub = {
  title_id: "ValidStatisticsNullableEpub",
  title: "Valid nullable EPUB fields",
  short_title: null,
  author: author("ValidNullableEpubAuthor", "Valid Nullable EPUB Author", null)
}

export const validStatisticsPopulatedEpub = {
  title_id: "ValidStatisticsPopulatedEpub",
  title: "Valid populated EPUB title",
  short_title: "Valid populated EPUB fields",
  author: author("ValidPopulatedEpubAuthor", "Valid Populated EPUB Author", "Populated")
}

function statisticsEpubField(field, problem, value, omit = false) {
  const suffix = `${field.replace("author.", "author-")}-${problem}`
  const item = {
    title_id: `Malformed-${suffix}`,
    title: `Malformed ${field} ${problem} EPUB field`,
    short_title: null,
    author: author(`Malformed-${suffix}-author`, `Malformed ${suffix} Author`, "Malformed")
  }
  const target = field.startsWith("author.") ? item.author : item
  const key = field.replace("author.", "")
  if (omit) delete target[key]
  else target[key] = value
  return { field, problem, item }
}

export const malformedStatisticsEpubFields = [
  statisticsEpubField("title", "missing", undefined, true),
  statisticsEpubField("title", "null", null),
  statisticsEpubField("title", "wrong-type", 17),
  statisticsEpubField("title", "blank", " "),
  statisticsEpubField("title", "overlong", "T".repeat(20_001)),
  statisticsEpubField("short_title", "missing", undefined, true),
  statisticsEpubField("short_title", "wrong-type", 17),
  statisticsEpubField("short_title", "blank", " "),
  statisticsEpubField("short_title", "overlong", "S".repeat(20_001)),
  statisticsEpubField("author.full_name", "missing", undefined, true),
  statisticsEpubField("author.full_name", "null", null),
  statisticsEpubField("author.full_name", "wrong-type", 17),
  statisticsEpubField("author.full_name", "blank", " "),
  statisticsEpubField("author.full_name", "overlong", "F".repeat(2_001)),
  statisticsEpubField("author.surname", "missing", undefined, true),
  statisticsEpubField("author.surname", "wrong-type", 17),
  statisticsEpubField("author.surname", "blank", " "),
  statisticsEpubField("author.surname", "overlong", "N".repeat(2_001))
]

const legacyAuthor = item => ({
  authorid: item.author.author_id,
  full_name: item.author.full_name,
  surname: item.author.surname
})

export const legacyWorks = popularWorks.map(item => {
  const mappedAuthor = legacyAuthor(item)
  return {
    lbworkid: item.representation.work_id,
    titlepath: item.title_path,
    title: item.title,
    shorttitle: item.short_title,
    titleid: item.title_id,
    work_titleid: item.title_id,
    mediatype: item.representation.media_type,
    startpagename: item.representation.start_page_name,
    authors: [mappedAuthor],
    main_author: mappedAuthor,
    work_authors: [mappedAuthor],
    export: []
  }
})

export const legacyEpubs = popularEpubs.map(item => ({
  title: item.title,
  shorttitle: item.short_title,
  titleid: item.title_id,
  work_titleid: item.title_id,
  authors: [legacyAuthor(item)]
}))
