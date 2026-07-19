const author = ({ authorid, surname, firstName, birth, death, gender }) => ({
  authorid,
  surname,
  full_name: `${firstName} ${surname}`,
  name_for_index: firstName ? `${surname}, ${firstName}` : surname,
  birth: { plain: birth },
  death: { plain: death },
  gender
})

export const dramawebbenCatalogAuthors = [
  author({
    authorid: "AgrellA",
    surname: "Agrell",
    firstName: "Alfhild",
    birth: "1849",
    death: "1923",
    gender: "female"
  }),
  author({
    authorid: "Anonym",
    surname: "Anonym",
    firstName: "",
    birth: "0000",
    death: "0000",
    gender: null
  }),
  author({
    authorid: "StrindbergA",
    surname: "Strindberg",
    firstName: "August",
    birth: "1849",
    death: "1912",
    gender: "male"
  }),
  author({
    authorid: "WahlenbergA",
    surname: "Wahlenberg",
    firstName: "Anna",
    birth: "1858",
    death: "1933",
    gender: "female"
  })
]

const authorsById = new Map(dramawebbenCatalogAuthors.map(value => [value.authorid, value]))

const dramaRanges = {
  female_roles: "1",
  male_roles: "2",
  other_roles: "0",
  number_of_acts: "1",
  number_of_pages: "24",
  number_of_roles: "3"
}

function medium({
  authorid,
  title,
  shorttitle = title,
  titlepath,
  lbworkid,
  titleid,
  mediatype,
  startpagename,
  sortkey,
  keyword = [],
  dramawebben = dramaRanges
}) {
  return {
    authors: [authorsById.get(authorid)],
    dramawebben,
    export: [],
    keyword,
    lbworkid,
    mediatype,
    shorttitle,
    sortkey,
    startpagename,
    title,
    titleid,
    titlepath
  }
}

export const dramawebbenCatalogResponse = {
  author_aggregation: dramawebbenCatalogAuthors.map(({ authorid }) => ({ authorid })),
  data: [
    medium({
      authorid: "AgrellA",
      title: "Dömd",
      titlepath: "Domd",
      lbworkid: "lb-dramat-001",
      titleid: "Domd",
      mediatype: "etext",
      startpagename: "1",
      sortkey: "agrell domd",
      dramawebben: {
        female_roles: "2",
        male_roles: "1",
        other_roles: "0",
        number_of_acts: "1",
        number_of_pages: "72",
        number_of_roles: "3"
      }
    }),
    medium({
      authorid: "AgrellA",
      title: "Dömd",
      titlepath: "Domd",
      lbworkid: "lb-dramat-001",
      titleid: "Domd",
      mediatype: "faksimil",
      startpagename: "I",
      sortkey: "agrell domd"
    }),
    medium({
      authorid: "AgrellA",
      title: "Dömd",
      titlepath: "Domd",
      lbworkid: "lb-dramat-001",
      titleid: "Domd",
      mediatype: "pdf",
      startpagename: "I",
      sortkey: "agrell domd"
    }),
    medium({
      authorid: "Anonym",
      title: "Barnens teater",
      titlepath: "BarnensTeater",
      lbworkid: "lb-dramat-002",
      titleid: "BarnensTeater",
      mediatype: "infopost",
      startpagename: "1",
      sortkey: "anonym barnens teater",
      keyword: ["Barnlitteratur"],
      dramawebben: {
        female_roles: "1",
        male_roles: "1",
        other_roles: "2",
        number_of_acts: "2",
        number_of_pages: "18",
        number_of_roles: "4"
      }
    }),
    medium({
      authorid: "StrindbergA",
      title: "Fröken Julie [1888]",
      titlepath: "FrokenJulie",
      lbworkid: "lb-dramat-003",
      titleid: "FrokenJulie",
      mediatype: "faksimil",
      startpagename: "3",
      sortkey: "strindberg froken julie",
      dramawebben: {
        female_roles: "2",
        male_roles: "2",
        other_roles: "1",
        number_of_acts: "1",
        number_of_pages: "96",
        number_of_roles: "5"
      }
    }),
    medium({
      authorid: "StrindbergA",
      title: "Fröken Julie [1888]",
      titlepath: "FrokenJulie",
      lbworkid: "lb-dramat-003",
      titleid: "FrokenJulie",
      mediatype: "pdf",
      startpagename: "3",
      sortkey: "strindberg froken julie"
    }),
    medium({
      authorid: "WahlenbergA",
      title: "Trollens fosterdotter",
      titlepath: "TrollensFosterdotter",
      lbworkid: "lb-dramat-004",
      titleid: "TrollensFosterdotter",
      mediatype: "faksimil",
      startpagename: "I",
      sortkey: "wahlenberg trollens fosterdotter",
      dramawebben: {
        female_roles: "3",
        male_roles: "4",
        other_roles: "0",
        number_of_acts: "4",
        number_of_pages: "120",
        number_of_roles: "7"
      }
    })
  ]
}

export const dramawebbenCatalogExpected = {
  authors: [
    "Agrell, Alfhild 1849-1923",
    "Anonym",
    "Strindberg, August 1849-1912",
    "Wahlenberg, Anna 1858-1933"
  ],
  plays: [
    "Agrell, Alfhild Dömd etext faksimil pdf",
    "Anonym Barnens teater infopost",
    "Strindberg, August Fröken Julie [1888] faksimil pdf",
    "Wahlenberg, Anna Trollens fosterdotter faksimil"
  ]
}
