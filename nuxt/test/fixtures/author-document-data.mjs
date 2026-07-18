// @ts-check

/** @typedef {import("../../app/lib/api/generated/lbapi").components["schemas"]["AuthorDocumentDescriptor"]} AuthorDocumentDescriptor */

/** @satisfies {AuthorDocumentDescriptor} */
export const soderbergPresentation = {
  author_id: "SöderbergH",
  normalized_author_id: "SoderbergH",
  full_name: "Hjalmar Söderberg",
  birth_year: "1869",
  death_year: "1941",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=S%C3%B6derbergH&avancerad",
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/soderbergh",
  document_kind: "presentation",
  source_path: "/red/forfattare/SoderbergH/presentation/index.html"
}

/** @satisfies {AuthorDocumentDescriptor} */
export const lagerlofBibliography = {
  author_id: "LagerlöfS",
  normalized_author_id: "LagerlofS",
  full_name: "Selma Lagerlöf",
  birth_year: "1858",
  death_year: "1940",
  has_introduction: true,
  has_dramawebben: true,
  search_url: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs",
  document_kind: "bibliografi",
  source_path: "/red/forfattare/LagerlofS/bibliografi/index.html"
}

/** @satisfies {AuthorDocumentDescriptor} */
export const sparseDocument = {
  author_id: "SparseDocument",
  normalized_author_id: "SparseDocument",
  full_name: "Författare utan tilläggsnavigering",
  birth_year: null,
  death_year: null,
  has_introduction: false,
  has_dramawebben: false,
  search_url: null,
  audio_url: null,
  document_kind: "presentation",
  source_path: "/red/forfattare/SparseDocument/presentation/index.html"
}

export const authorDocumentProvenance = Object.freeze([
  {
    path: soderbergPresentation.source_path,
    sourceUrl: "https://red.litteraturbanken.se/red/forfattare/SoderbergH/presentation/index.html",
    sha256: "80bb28b296759b1bc38fc400c6e27ce0ca51bb59e261203e0f901cff00528980"
  },
  {
    path: lagerlofBibliography.source_path,
    sourceUrl: "https://red.litteraturbanken.se/red/forfattare/LagerlofS/bibliografi/index.html",
    sha256: "54d289da89e61225fdfbfc68aed19762614529c06c6f2707ed50a493359d179b"
  }
])

export const forvillelserReaderWorkInfoResponse = {
  hits: 1,
  data: [
    {
      authors: [
        {
          authorid: "SöderbergH",
          full_name: "Hjalmar Söderberg",
          surname: "Söderberg"
        }
      ],
      imprintyear: "1895",
      lbworkid: "lb-reader-forvillelser",
      mediatype: "etext",
      pages: [{ pagename: "3", pageindex: 3 }],
      shorttitle: "Förvillelser",
      sort_date_imprint: { plain: "1895" },
      startpagename: "3",
      title: "Förvillelser. Roman",
      titlepath: "Förvillelser"
    }
  ]
}

export const forvillelserReaderPageHtml = `
<div class="pname forvillelser-reader" pname="3">
  <div class="center">
    <div class="_p title"><span class="w" id="forvillelser-w3-1">FÖRVILLELSER</span></div>
    <div class="_p"><span class="w" id="forvillelser-w3-2">KANONISK SIDA TRE</span></div>
  </div>
</div>
`

export const forvillelserReaderCss = `
.txt .forvillelser-reader { font-family: Georgia, serif; line-height: 1.8; }
`
