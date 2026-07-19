// @ts-check

/** @typedef {import("../../app/lib/api/generated/lbapi").components["schemas"]["WorkSourceInfoResponse"]} WorkSourceInfoResponse */

/** @satisfies {WorkSourceInfoResponse} */
export const doktorGlasSourceInfo = {
  work_id: "lb1728740",
  author_id: "SöderbergH",
  title_path: "DoktorGlas",
  media_type: "etext",
  start_page: "-2",
  title: "Doktor Glas. Roman",
  short_title: "Doktor Glas",
  text_type: "roman",
  authors: [{
    author_id: "SöderbergH",
    full_name: "Hjalmar Söderberg",
    surname: "Söderberg",
    role: null,
    author_type: null,
    url: "/författare/S%C3%B6derbergH"
  }],
  source_description_html: "Albert Bonniers förlag, Stockholm 1905. ",
  source_description_author_id: null,
  work_introduction_html: null,
  work_introduction_author_id: null,
  imprint: "1905",
  urn: "urn:nbn:se:lb-lb1728740-etext",
  libris_id: "1728740",
  license_key: "cc-0",
  is_printed: true,
  provenance: [{
    library: "GUB",
    signum: "Litt. Sv.",
    use_alternate_text: false
  }],
  cover: {
    small_url: "/txt/lb1728740/lb1728740_small.jpeg",
    large_url: "/txt/lb1728740/lb1728740_large.jpeg"
  },
  read_actions: [
    {
      media_type: "etext",
      label: "etext",
      url: "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
    },
    {
      media_type: "faksimil",
      label: "faksimil",
      url: "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/faksimil"
    }
  ],
  download_actions: [{
    media_type: "epub",
    label: "epub",
    url: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub",
    filename: "SöderbergH_DoktorGlas.epub",
    size_bytes: 530557
  }],
  errata: [
    { cells_html: ["sid. 12", "<i>hvar</i> ändrat till <em>var</em>"] },
    { cells_html: ["sid. 27", "rad <sup>2</sup>"] }
  ],
  dramawebben: null
}

/** @satisfies {WorkSourceInfoResponse} */
export const dramaSourceInfo = {
  ...doktorGlasSourceInfo,
  work_id: "lb31230",
  author_id: "AlmlöfN",
  title_path: "Affarer",
  media_type: "faksimil",
  title: "Affärer",
  short_title: "Affärer",
  text_type: "drama",
  authors: [{
    author_id: "AlmlöfN",
    full_name: "Nils Almlöf",
    surname: "Almlöf",
    role: "författare",
    author_type: null,
    url: "/författare/Alml%C3%B6fN"
  }],
  source_description_html: "Stockholm, 1871.",
  source_description_author_id: "DramaRedaktionen",
  work_introduction_html: "<p>En komedi i fem akter.</p><p><strong>Affärer</strong> uruppfördes 1871.</p>",
  work_introduction_author_id: "LindgrenU",
  imprint: "1871",
  urn: "urn:nbn:se:lb-lb31230-faksimil",
  libris_id: null,
  license_key: "pd",
  is_printed: true,
  provenance: [
    { library: "KB", signum: "Sv. teater 204", use_alternate_text: false },
    { library: "Dramawebben", signum: null, use_alternate_text: true }
  ],
  cover: {
    small_url: "/txt/lb31230/lb31230_small.jpeg",
    large_url: "/txt/lb31230/lb31230_large.jpeg"
  },
  read_actions: [
    {
      media_type: "etext",
      label: "etext",
      url: "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/etext"
    },
    {
      media_type: "faksimil",
      label: "faksimil",
      url: "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil"
    }
  ],
  download_actions: [
    {
      media_type: "epub",
      label: "epub",
      url: "/txt/epub/Alml%C3%B6fN_Affarer.epub",
      filename: "AlmlöfN_Affarer.epub",
      size_bytes: 68719476736
    },
    {
      media_type: "pdf",
      label: "pdf",
      url: "/export/faksimil/lb31230.pdf",
      filename: "AlmlöfN_Affarer.pdf",
      size_bytes: 4294967297
    }
  ],
  errata: [],
  dramawebben: {
    has_introduction: false,
    facts: [
      { key: "number_of_pages", value: "204" },
      { key: "number_of_acts", value: "5" },
      { key: "number_of_roles", value: "15" },
      { key: "male_roles", value: "11" },
      { key: "female_roles", value: "5" }
    ],
    roles: [
      "<i>Direktören</i>, grosshandlare",
      "<span class=\"role\">Anna</span>, hans dotter"
    ],
    history_html: "<p>Uruppförd på <a href=\"https://example.test/teater\">Kungliga teatern</a>.</p>"
  }
}

/** @satisfies {WorkSourceInfoResponse} */
export const sparseSourceInfo = {
  work_id: "lbSparse1",
  author_id: "SparseA",
  title_path: "SparseTitle",
  media_type: "infopost",
  start_page: null,
  title: "Glest verk",
  short_title: null,
  text_type: null,
  authors: [],
  source_description_html: null,
  source_description_author_id: null,
  work_introduction_html: null,
  work_introduction_author_id: null,
  imprint: null,
  urn: null,
  libris_id: null,
  license_key: "unknown-license",
  is_printed: null,
  provenance: [
    { library: "UnknownLibrary", signum: null, use_alternate_text: false },
    { library: "GUB", signum: null, use_alternate_text: false }
  ],
  cover: {
    small_url: "/txt/lbSparse1/lbSparse1_small.jpeg",
    large_url: "/txt/lbSparse1/lbSparse1_large.jpeg"
  },
  read_actions: [],
  download_actions: [],
  errata: [{ cells_html: [""] }],
  dramawebben: {
    has_introduction: false,
    facts: [],
    roles: [],
    history_html: null
  }
}

export const malformedSourceInfo = {
  ...doktorGlasSourceInfo,
  work_id: 1728740,
  unexpected: true
}

export const oversizedSourceInfo = {
  ...doktorGlasSourceInfo,
  source_description_html: "x".repeat(200_001)
}

export const sourceInfoByIdentity = new Map([
  ["SöderbergH|DoktorGlas", doktorGlasSourceInfo],
  ["AlmlöfN|Affarer", dramaSourceInfo],
  ["SparseA|SparseTitle", sparseSourceInfo],
  ["MalformedA|MalformedTitle", malformedSourceInfo],
  ["OversizedA|OversizedTitle", oversizedSourceInfo]
])

export const sourceInfoProvenance = {
  privat: {
    fullname: "",
    image: null,
    link: null,
    text: {
      etext: "Det exemplar som ligger till grund för Litteraturbankens utgåva finns i privat ägo."
    }
  },
  GUB: {
    fullname: "Göteborgs universitetsbibliotek",
    image: "gublogga.png",
    link: "http://www.ub.gu.se/",
    text: {
      etext: "Det exemplar som ligger till grund för Litteraturbankens utgåva tillhör Göteborgs universitetsbibliotek{{signum}}.",
      faksimilprint: "Det avbildade exemplaret tillhör Göteborgs universitetsbibliotek{{signum}}.",
      faksimilnoprint: "Det avbildade manuskriptet tillhör Göteborgs universitetsbibliotek{{signum}}.",
      pdf: "Filen har tillhandahållits av Göteborgs universitetsbibliotek."
    }
  },
  KB: {
    fullname: "Kungl. biblioteket",
    image: "kblogga.png",
    link: "http://www.kb.se/",
    text: {
      etext: "Det exemplar som ligger till grund för Litteraturbankens utgåva tillhör Kungl. biblioteket{{signum}}.",
      faksimilprint: "Det avbildade exemplaret tillhör Kungl. biblioteket{{signum}}.",
      faksimilnoprint: "Det avbildade manuskriptet tillhör Kungl. biblioteket{{signum}}.",
      pdf: "Filen har tillhandahållits av Kungl. biblioteket."
    }
  },
  Dramawebben: {
    fullname: "Dramawebben",
    image: "dramawebben_svart.svg",
    link: "http://www.dramawebben.se/",
    text: {
      etext: "Litteraturbankens utgåva är baserad på material som tillhandahållits av Dramawebben.",
      faksimilprint: "Tillgängliggjord i samarbete med Dramawebben. ",
      faksimilnoprint: "Tillgängliggjord i samarbete med Dramawebben.",
      pdf: "Filen har tillhandahållits av Dramawebben."
    },
    text2: {
      etext: "Litteraturbanken och Dramawebben.",
      faksimilprint: "Tillgängliggjord i samarbete med Dramawebben.",
      faksimilnoprint: "Tillgängliggjord i samarbete med Dramawebben.",
      pdf: "Dramawebben tillhandahöll filen."
    }
  }
}

export const sourceInfoLicenses = {
  "cc-0": [
    "<text>\n\t",
    '<div xmlns="https://www.w3.org/1999/xhtml"><p>',
    '<a rel="license" href="https://creativecommons.org/publicdomain/zero/1.0/deed.sv">',
    '<img src="cc-128x128.png" style="border-style: none;" alt="Creative Commons"/>',
    '<img src="cc0-128x128.png" style="border-style: none;" alt="CC0"/>',
    "</a>För e-boken gäller licensen CC0.</p></div>",
    "\n</text>\n"
  ].join(""),
  pd: [
    "<text>\n\t",
    '<div xmlns="https://www.w3.org/1999/xhtml"><p>',
    '<a rel="license" href="https://creativecommons.org/publicdomain/mark/1.0/deed.sv">',
    '<img src="cc-pd-128x128.png" style="border-style: none;" alt="Public domain"/>',
    "</a>Hänvisa till {{provenance}} och Litteraturbanken.</p></div>",
    "\n</text>\n"
  ].join("")
}
