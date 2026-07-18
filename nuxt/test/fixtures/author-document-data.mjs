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
export const semerAuthorDocumentDescriptor = {
  author_id: "AlmqvistCJL",
  normalized_author_id: "AlmqvistCJL",
  full_name: "Carl Jonas Love Almqvist",
  birth_year: "1793",
  death_year: "1866",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=AlmqvistCJL&avancerad",
  audio_url: null,
  document_kind: "semer",
  source_path: "/red/forfattare/AlmqvistCJL/semer/index.html"
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
  },
  {
    path: semerAuthorDocumentDescriptor.source_path,
    sourceUrl: "https://litteraturbanken.se/red/forfattare/AlmqvistCJL/semer/index.html",
    retrievedFrom: "https://red.litteraturbanken.se/red/forfattare/AlmqvistCJL/semer/index.html",
    sha256: "49c0eed3a775926c301ae011b79be8c6c557d9d9c7f868f390869bcdc510c824"
  }
])

export const semerAuthorDocumentAssets = Object.freeze([
  ["0000.jpeg_liten_blanche.jpg", "b9b50dea3f24639fba99a7c0ebe6fcb916a2668a8c18690f9879bdf438923b7c"],
  ["0000_liten_lenstrom_15.jpg", "a140029e05f04e35639c554c3dc194f1018d11c075c3344aed5ba8865fa9e98b"],
  ["0000_liten_lenstrom_18.jpg", "28d82d2443538b6d5eba654a242928dbba5ef40a344e7396753cbf9f3bfbdac1"],
  ["0000_liten_lenstrom_19.jpg", "ea4f5157dd1da4c92feeab2c8343ac629ace1a8ac2a2bc63de870d4ce328415e"],
  ["0001.jpeg_liten_silfverstolpe.jpg", "016821c6d936f1dfbde31a73dce66ec781adf8af2ca2b56193787c73409796a1"],
  ["0001_atterbom_91.jpg", "34b6ef39130e67e304c60c66563ae193234c208a30550b7a85d10961b8675320"],
  ["0001_atterbom_92.jpg", "804c72faa5d8b118830188ad49a0764dd21b185bce43d9de4958cf66cb63da5a"],
  ["0001_atterbom_93.jpg", "74fcae8c2b19d3fbc1288b6ff22316343329a585e7f6aa78e7ca6fa4902ec222"],
  ["0001_liten_eos.jpg", "4bd29cb026d8a9536e04f4cf59f38b622eec174df36a7a232bae9829713e5b6b"],
  ["0001_palmblad.jpg", "9a8c9cf197b25687ec45d6a07ab0452fcebd0ae5ccda74e8a37380b50e38089f"],
  ["0002.jpeg__liten_snellman.jpg", "10ea6f53fd7b6fb63162276b076aaf8d42c5df88fee83edb658c49e0a7c88cfc"],
  ["0002_slangkyss.jpg", "021246f3f0a0b0a68373b4ae2b77251259f660d3e2497ca15cebbd7cc3d002df"],
  ["200_almqvist_cjl_fa1.jpeg", "c6e2c67a91089b42532f9e95e4fe3c15a8a03accf56fc3db7c48047d417dd303"]
].map(([file, sha256]) => ({
  path: `${semerAuthorDocumentDescriptor.source_path.slice(0, -"index.html".length)}pictures/${file}`,
  sourceUrl: `https://red.litteraturbanken.se${semerAuthorDocumentDescriptor.source_path.slice(0, -"index.html".length)}pictures/${file}`,
  file: `AlmqvistCJL-semer/pictures/${file}`,
  sha256
})))

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
