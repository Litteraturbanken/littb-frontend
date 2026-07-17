// @ts-check

/** @typedef {import("../../app/lib/api/generated/lbapi").components["schemas"]["AuthorWorksResponse"]} AuthorWorksResponse */

/** @satisfies {AuthorWorksResponse} */
export const richAuthorWorks = {
  author: {
    author_id: "StrindbergA",
    full_name: "August Strindberg",
    birth_year: "1849",
    death_year: "1912",
    has_introduction: true,
    has_dramawebben: true,
    search_url: "/sok?forfattare=StrindbergA&avancerad",
    audio_url: "https://litteraturbanken.se/ljudochbild/författare/strindberga",
    map_url: "https://litteraturbanken.se/litteraturkartan?s=lb_author.authorid:StrindbergA",
    portrait: {
      url: "/red/forfattare/StrindbergA/StrindbergA_large.jpeg",
      caption_html: "August Strindberg, fotograferad 1902."
    },
    related_links: [
      {
        label: "Presentation",
        url: "/författare/StrindbergA/presentation"
      },
      {
        label: "Bibliografi",
        url: "/författare/StrindbergA/bibliografi"
      },
      {
        label: "Strindbergsmuseet",
        url: "/presentationer/specialomraden/Strindberg.html"
      }
    ],
    encyclopedia_links: [
      {
        label: "Svenskt biografiskt lexikon",
        url: "https://sok.riksarkivet.se/sbl/Presentation.aspx?id=34558"
      },
      {
        label: "Wikipedia",
        url: "https://sv.wikipedia.org/wiki/August_Strindberg"
      }
    ]
  },
  authored_sections: [
    {
      kind: "main",
      label: "Tillgängliga verk",
      show_author: false,
      items: [
        {
          work_id: "lb238704",
          title_id: "RodaRummet",
          title_path: "RodaRummet",
          title: "Röda rummet",
          short_title: null,
          title_tooltip: "Röda rummet",
          title_url: "/författare/StrindbergA/titlar/RodaRummet/sida/-1/etext?om-boken",
          imprint_year: "1879",
          display_author: null,
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/StrindbergA/titlar/RodaRummet/sida/-1/etext",
              download_filename: null
            },
            {
              kind: "read",
              media_type: "faksimil",
              url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/faksimil",
              download_filename: null
            },
            {
              kind: "download",
              media_type: "epub",
              url: "/txt/epub/StrindbergA_RodaRummet.epub",
              download_filename: "StrindbergA_RodaRummet.epub"
            },
            {
              kind: "download",
              media_type: "pdf",
              url: "/export/faksimil/lb238704.pdf",
              download_filename: "StrindbergA_RodaRummet.pdf"
            },
            {
              kind: "read",
              media_type: "infopost",
              url: "/dramawebben/pjäser?om-boken&authorid=StrindbergA&titlepath=RodaRummet",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "part",
      label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
      show_author: false,
      items: [
        {
          work_id: "lb-part-ett-dromspel",
          title_id: "EttDromspelForord",
          title_path: "EttDromspelForord",
          title: "Förord till Ett drömspel",
          short_title: "Förord",
          title_tooltip: "Förord till Ett drömspel",
          title_url: "/författare/StrindbergA/titlar/EttDromspelForord/sida/5/etext?om-boken",
          imprint_year: null,
          display_author: null,
          containing_work: {
            title: "Ett drömspel",
            author: {
              author_id: "StrindbergA",
              name_for_index: "Strindberg, August",
              surname: "Strindberg",
              url: "/författare/StrindbergA"
            }
          },
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/StrindbergA/titlar/EttDromspelForord/sida/5/etext",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "photographer",
      label: "Som fotograf",
      show_author: true,
      items: [
        {
          work_id: "lb-photo-1",
          title_id: "BlandFranskaBonder",
          title_path: "BlandFranskaBonder",
          title: "Bland franska bönder",
          short_title: "Bland franska bönder",
          title_tooltip: null,
          title_url: "/författare/LundinC/titlar/BlandFranskaBonder/sida/1/faksimil?om-boken",
          imprint_year: "1889",
          display_author: {
            author_id: "LundinC",
            name_for_index: "Lundin, Claës (författare)",
            surname: "Lundin",
            url: "/författare/LundinC"
          },
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "faksimil",
              url: "/författare/LundinC/titlar/BlandFranskaBonder/sida/1/faksimil",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "illustrator",
      label: "Som illustratör",
      show_author: true,
      items: [
        {
          work_id: "lb-illustration-1",
          title_id: "SagorOchSkisser",
          title_path: "SagorOchSkisser",
          title: "Sagor och skisser",
          short_title: "Sagor och skisser",
          title_tooltip: null,
          title_url: "/författare/LevertinO/titlar/SagorOchSkisser/sida/1/etext?om-boken",
          imprint_year: "1895",
          display_author: {
            author_id: "LevertinO",
            name_for_index: "Levertin, Oscar (författare)",
            surname: "Levertin",
            url: "/författare/LevertinO"
          },
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/LevertinO/titlar/SagorOchSkisser/sida/1/etext",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "editor",
      label: "Som utgivare",
      show_author: true,
      items: [
        {
          work_id: "lb-editor-1",
          title_id: "SvenskaOden",
          title_path: "SvenskaOden",
          title: "Svenska öden och äventyr",
          short_title: "Svenska öden",
          title_tooltip: "Svenska öden och äventyr",
          title_url: "/författare/Flera/titlar/SvenskaOden/sida/1/faksimil?om-boken",
          imprint_year: "1882",
          display_author: {
            author_id: "Flera",
            name_for_index: "Flera författare",
            surname: null,
            url: "/författare/Flera"
          },
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "faksimil",
              url: "/författare/Flera/titlar/SvenskaOden/sida/1/faksimil",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "translator",
      label: "Som översättare",
      show_author: true,
      items: [
        {
          work_id: "lb-translator-1",
          title_id: "HemsobornaFranska",
          title_path: "HemsobornaFranska",
          title: "Les gens de Hemsö",
          short_title: "Les gens de Hemsö",
          title_tooltip: null,
          title_url: "/txt/epub/BoreliusJ_HemsobornaFranska.epub",
          imprint_year: "1890",
          display_author: {
            author_id: "BoreliusJ",
            name_for_index: "Borelius, Jacques (översättare)",
            surname: "Borelius",
            url: "/författare/BoreliusJ"
          },
          containing_work: null,
          actions: [
            {
              kind: "download",
              media_type: "epub",
              url: "/txt/epub/BoreliusJ_HemsobornaFranska.epub",
              download_filename: "BoreliusJ_HemsobornaFranska.epub"
            }
          ]
        }
      ]
    }
  ],
  about_sections: [
    {
      kind: "about",
      label: "Verk om August Strindberg",
      show_author: true,
      items: [
        {
          work_id: "lb-about-1",
          title_id: "AugustStrindberg",
          title_path: "AugustStrindberg",
          title: "August Strindberg: en levnadsteckning",
          short_title: "August Strindberg",
          title_tooltip: "August Strindberg: en levnadsteckning",
          title_url: "/författare/LammM/titlar/AugustStrindberg/sida/1/etext?om-boken",
          imprint_year: "1940",
          display_author: {
            author_id: "LammM",
            name_for_index: "Lamm, Martin (levnadstecknare)",
            surname: "Lamm",
            url: "/författare/LammM"
          },
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/LammM/titlar/AugustStrindberg/sida/1/etext",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "about_part",
      label: "Kortare texter om August Strindberg",
      show_author: true,
      items: [
        {
          work_id: "lb-about-part-1",
          title_id: "StrindbergOchTeatern",
          title_path: "StrindbergOchTeatern",
          title: "Strindberg och teatern",
          short_title: "Strindberg och teatern",
          title_tooltip: null,
          title_url: "/författare/BergmanG/titlar/StrindbergOchTeatern/sida/17/etext?om-boken",
          imprint_year: null,
          display_author: {
            author_id: "BergmanG",
            name_for_index: "Bergman, Gösta M. (essäist)",
            surname: "Bergman",
            url: "/författare/BergmanG"
          },
          containing_work: {
            title: "Studier i svensk dramatik",
            author: {
              author_id: "BergmanG",
              name_for_index: "Bergman, Gösta M.",
              surname: "Bergman",
              url: "/författare/BergmanG"
            }
          },
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/BergmanG/titlar/StrindbergOchTeatern/sida/17/etext",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "about_editor",
      label: "Som utgivare",
      show_author: true,
      items: [
        {
          work_id: "lb-about-editor-1",
          title_id: "BrevTillStrindberg",
          title_path: "BrevTillStrindberg",
          title: "Brev till August Strindberg",
          short_title: "Brev till Strindberg",
          title_tooltip: "Brev till August Strindberg",
          title_url: "/författare/MeijerB/titlar/BrevTillStrindberg/sida/1/faksimil?om-boken",
          imprint_year: "1952",
          display_author: {
            author_id: "MeijerB",
            name_for_index: "Meijer, Bernhard (utgivare)",
            surname: "Meijer",
            url: "/författare/MeijerB"
          },
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "faksimil",
              url: "/författare/MeijerB/titlar/BrevTillStrindberg/sida/1/faksimil",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "about_translator",
      label: "Som översättare",
      show_author: true,
      items: [
        {
          work_id: "lb-about-translator-1",
          title_id: "StrindbergInEnglish",
          title_path: "StrindbergInEnglish",
          title: "Strindberg in English",
          short_title: "Strindberg in English",
          title_tooltip: null,
          title_url: "/txt/lb-about-translator-1/lb-about-translator-1.pdf",
          imprint_year: "1962",
          display_author: {
            author_id: "JohnsonW",
            name_for_index: "Johnson, Walter (översättare)",
            surname: "Johnson",
            url: "/författare/JohnsonW"
          },
          containing_work: null,
          actions: [
            {
              kind: "download",
              media_type: "pdf",
              url: "/txt/lb-about-translator-1/lb-about-translator-1.pdf",
              download_filename: "JohnsonW_StrindbergInEnglish.pdf"
            }
          ]
        }
      ]
    }
  ]
}

/** @satisfies {AuthorWorksResponse} */
export const sparseAuthorWorks = {
  author: {
    author_id: "LagerlöfS",
    full_name: "Selma Lagerlöf",
    birth_year: "1858",
    death_year: "1940",
    has_introduction: false,
    has_dramawebben: false,
    search_url: null,
    audio_url: null,
    map_url: null,
    portrait: null,
    related_links: [],
    encyclopedia_links: []
  },
  authored_sections: [
    {
      kind: "main",
      label: "Tillgängliga verk",
      show_author: false,
      items: [
        {
          work_id: "lb-sparse-1",
          title_id: "GostaBerlingsSaga",
          title_path: "GostaBerlingsSaga",
          title: "Gösta Berlings saga",
          short_title: "Gösta Berlings saga",
          title_tooltip: null,
          title_url: "/författare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil?om-boken",
          imprint_year: "1891",
          display_author: null,
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "faksimil",
              url: "/författare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "part",
      label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
      show_author: false,
      items: []
    },
    { kind: "photographer", label: "Som fotograf", show_author: true, items: [] },
    { kind: "illustrator", label: "Som illustratör", show_author: true, items: [] },
    { kind: "editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "translator", label: "Som översättare", show_author: true, items: [] }
  ],
  about_sections: [
    { kind: "about", label: "Verk om Selma Lagerlöf", show_author: true, items: [] },
    {
      kind: "about_part",
      label: "Kortare texter om Selma Lagerlöf",
      show_author: true,
      items: []
    },
    { kind: "about_editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "about_translator", label: "Som översättare", show_author: true, items: [] }
  ]
}

/** @satisfies {AuthorWorksResponse} */
export const emptyAuthorWorks = {
  author: {
    author_id: "NoWorks",
    full_name: "Författare utan tillgängliga verk",
    birth_year: null,
    death_year: null,
    has_introduction: false,
    has_dramawebben: false,
    search_url: null,
    audio_url: null,
    map_url: null,
    portrait: null,
    related_links: [],
    encyclopedia_links: []
  },
  authored_sections: [
    { kind: "main", label: "Tillgängliga verk", show_author: false, items: [] },
    {
      kind: "part",
      label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
      show_author: false,
      items: []
    },
    { kind: "photographer", label: "Som fotograf", show_author: true, items: [] },
    { kind: "illustrator", label: "Som illustratör", show_author: true, items: [] },
    { kind: "editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "translator", label: "Som översättare", show_author: true, items: [] }
  ],
  about_sections: [
    {
      kind: "about",
      label: "Verk om Författare utan tillgängliga verk",
      show_author: true,
      items: []
    },
    {
      kind: "about_part",
      label: "Kortare texter om Författare utan tillgängliga verk",
      show_author: true,
      items: []
    },
    { kind: "about_editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "about_translator", label: "Som översättare", show_author: true, items: [] }
  ]
}

/** @satisfies {AuthorWorksResponse} */
export const rfc3986AuthorWorks = {
  author: {
    author_id: "O'Neil(A",
    full_name: "Pat O'Neil (A)",
    birth_year: null,
    death_year: null,
    has_introduction: true,
    has_dramawebben: true,
    search_url: "/sok?forfattare=O%27Neil%28A&avancerad",
    audio_url: null,
    map_url: null,
    portrait: null,
    related_links: [],
    encyclopedia_links: []
  },
  authored_sections: [
    {
      kind: "main",
      label: "Tillgängliga verk",
      show_author: false,
      items: [
        {
          work_id: "lb-rfc3986-1",
          title_id: "TestTitle",
          title_path: "TestTitle",
          title: "Ett RFC 3986-test",
          short_title: "Ett RFC 3986-test",
          title_tooltip: null,
          title_url: "/författare/O%27Neil%28A/titlar/TestTitle/sida/1/etext?om-boken",
          imprint_year: null,
          display_author: null,
          containing_work: null,
          actions: [
            {
              kind: "read",
              media_type: "etext",
              url: "/författare/O%27Neil%28A/titlar/TestTitle/sida/1/etext",
              download_filename: null
            }
          ]
        }
      ]
    },
    {
      kind: "part",
      label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
      show_author: false,
      items: []
    },
    { kind: "photographer", label: "Som fotograf", show_author: true, items: [] },
    { kind: "illustrator", label: "Som illustratör", show_author: true, items: [] },
    { kind: "editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "translator", label: "Som översättare", show_author: true, items: [] }
  ],
  about_sections: [
    { kind: "about", label: "Verk om Pat O'Neil (A)", show_author: true, items: [] },
    {
      kind: "about_part",
      label: "Kortare texter om Pat O'Neil (A)",
      show_author: true,
      items: []
    },
    { kind: "about_editor", label: "Som utgivare", show_author: true, items: [] },
    { kind: "about_translator", label: "Som översättare", show_author: true, items: [] }
  ]
}

export const malformedAuthorWorksResponse = {
  ...emptyAuthorWorks,
  author: {
    ...emptyAuthorWorks.author,
    full_name: 42
  }
}

/** @type {ReadonlyMap<string, AuthorWorksResponse>} */
export const authorWorksById = new Map(
  /** @type {Array<[string, AuthorWorksResponse]>} */ ([
    [richAuthorWorks.author.author_id, richAuthorWorks],
    [sparseAuthorWorks.author.author_id, sparseAuthorWorks],
    [emptyAuthorWorks.author.author_id, emptyAuthorWorks],
    [rfc3986AuthorWorks.author.author_id, rfc3986AuthorWorks]
  ])
)
