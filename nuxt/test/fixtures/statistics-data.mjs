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
      author: author("SoderbergH", "Hjalmar Söderberg", "Söderberg"),
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
    title_path: `PopularWork${rank}`,
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
    title_id: `EpubWork${rank}`,
    title: `EPUB Work ${rank}`,
    short_title: rank === 5 ? "EPUB Five" : null,
    author: author(
      `EpubAuthor${rank}`,
      `Full EPUB Author ${rank}`,
      rank % 2 === 0 ? `EPUB Surname ${rank}` : null
    )
  }
}

export const popularWorks = Array.from({ length: 30 }, (_, index) => workAt(index + 1))
export const popularEpubs = Array.from({ length: 30 }, (_, index) => epubAt(index + 1))

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
