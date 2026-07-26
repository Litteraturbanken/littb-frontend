// @ts-check

/** @typedef {import("../../app/lib/api/generated/lbapi").components["schemas"]["AuthorProfile"]} AuthorProfile */

/** @satisfies {AuthorProfile} */
export const strindbergAuthorProfile = {
  author_id: "StrindbergA",
  full_name: "August Strindberg",
  surname: "Strindberg",
  birth_year: "1849",
  death_year: "1912",
  canonical_path: "/författare/StrindbergA",
  introduction_html: [
    "<p>August Strindberg var författare och dramatiker.</p>",
    '<p>Han debuterade med <a href="/forfattare/StrindbergA/titlar/Fritankaren/etext"><i>Fritänkaren</i></a>.</p>'
  ].join(""),
  introduction_by: {
    author_id: "BergmanG",
    full_name: "Gösta M. Bergman",
    surname: "Bergman"
  },
  source_html: [
    "<i>Svenskt biografiskt lexikon</i>",
    '<a href="https://litteraturbanken.se/">Litteraturbanken</a>'
  ],
  pseudonyms: [
    {
      author_id: "HarvedUlf",
      full_name: "Härved Ulf",
      surname: "Ulf"
    },
    {
      author_id: "FraterSylvester",
      full_name: "Frater Sylvester",
      surname: "Sylvester"
    }
  ],
  other_names: ["Johan August Strindberg", "August Strindberg d.y."],
  portrait: {
    url: "/red/forfattare/StrindbergA/StrindbergA_large.jpeg",
    caption_html: "August Strindberg, fotograferad 1902."
  },
  search_url: "/sok?forfattare=StrindbergA&avancerad",
  audio_url: null,
  map_url: "https://litteraturbanken.se/litteraturkartan?s=lb_author.authorid:StrindbergA",
  has_more: true,
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
  ],
  dramawebben: {
    introduction_html: "<p>Strindberg förnyade det svenska dramat.</p>",
    introduction_by: {
      author_id: "DramaRedaktionen",
      full_name: "Dramawebbens redaktion",
      surname: null
    },
    source_html: ["<i>Dramawebben</i>"],
    portrait: {
      url: "/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg",
      caption_html: "Porträtt ur Dramawebbens samling."
    }
  }
}

/** @satisfies {AuthorProfile} */
export const lagerlofAuthorProfile = {
  author_id: "LagerlöfS",
  full_name: "Selma Lagerlöf",
  surname: "Lagerlöf",
  birth_year: "1858",
  death_year: "1940",
  canonical_path: "/författare/Lagerl%C3%B6fS",
  introduction_html: "<p>Selma Lagerlöf var författare och Nobelpristagare.</p>",
  introduction_by: null,
  source_html: [],
  pseudonyms: [],
  other_names: [],
  portrait: null,
  search_url: null,
  audio_url: null,
  map_url: null,
  has_more: false,
  related_links: [],
  encyclopedia_links: [],
  dramawebben: null
}

/** @satisfies {AuthorProfile} */
export const dramaOnlyAuthorProfile = {
  author_id: "DramaOnly",
  full_name: "Dramatikern",
  surname: null,
  birth_year: null,
  death_year: null,
  canonical_path: "/författare/DramaOnly/dramawebben",
  introduction_html: null,
  introduction_by: null,
  source_html: [],
  pseudonyms: [],
  other_names: [],
  portrait: null,
  search_url: null,
  audio_url: null,
  map_url: null,
  has_more: false,
  related_links: [],
  encyclopedia_links: [],
  dramawebben: {
    introduction_html: "<p>Den här introduktionen finns bara på Dramawebben.</p>",
    introduction_by: null,
    source_html: [],
    portrait: {
      url: "/red/forfattare/DramaOnly/DramaOnly_dw_large.jpeg",
      caption_html: null
    }
  }
}

/** @satisfies {AuthorProfile} */
export const noIntroAuthorProfile = {
  author_id: "NoIntro",
  full_name: "Författare utan introduktion",
  surname: "Introduktion",
  birth_year: "1900",
  death_year: null,
  canonical_path: "/författare/NoIntro/titlar",
  introduction_html: null,
  introduction_by: null,
  source_html: [],
  pseudonyms: [],
  other_names: [],
  portrait: null,
  search_url: null,
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/nointro",
  map_url: null,
  has_more: false,
  related_links: [],
  encyclopedia_links: [],
  dramawebben: null
}

/** @satisfies {AuthorProfile} */
export const rfc3986AuthorProfile = {
  author_id: "O'Neil(A",
  full_name: "Pat O'Neil (A)",
  surname: "O'Neil",
  birth_year: null,
  death_year: null,
  canonical_path: "/författare/O%27Neil%28A",
  introduction_html: "<p>En profil med RFC3986-kodad författaridentitet.</p>",
  introduction_by: null,
  source_html: [],
  pseudonyms: [],
  other_names: [],
  portrait: null,
  search_url: null,
  audio_url: null,
  map_url: null,
  has_more: false,
  related_links: [],
  encyclopedia_links: [],
  dramawebben: {
    introduction_html: "<p>Dramawebbens RFC3986-profil.</p>",
    introduction_by: null,
    source_html: [],
    portrait: null
  }
}

export const managedHtmlRawProbes = [
  "ordinary-intro-attribute",
  "ordinary-intro-raw-marker",
  "ordinary-source-attribute",
  "ordinary-source-raw-marker",
  "ordinary-caption-attribute",
  "ordinary-caption-raw-marker",
  "drama-intro-attribute",
  "drama-intro-raw-marker",
  "drama-source-attribute",
  "drama-source-raw-marker",
  "drama-caption-attribute",
  "drama-caption-raw-marker"
]

/** @satisfies {AuthorProfile} */
export const managedHtmlProbeAuthorProfile = {
  author_id: "ManagedHtmlProbe",
  full_name: "Säker Profil",
  surname: "Profil",
  birth_year: null,
  death_year: null,
  canonical_path: "/författare/ManagedHtmlProbe",
  introduction_html: '<p onclick="ordinary-intro-attribute()">Ordinary intended intro</p><script>ordinary-intro-raw-marker</script>',
  introduction_by: null,
  source_html: ['<i style="ordinary-source-attribute">Ordinary intended source</i><svg>ordinary-source-raw-marker</svg>'],
  pseudonyms: [],
  other_names: [],
  portrait: {
    url: "/red/forfattare/ManagedHtmlProbe/ManagedHtmlProbe_large.jpeg",
    caption_html: '<span onmouseover="ordinary-caption-attribute()">Ordinary intended caption</span><style>ordinary-caption-raw-marker</style>'
  },
  search_url: null,
  audio_url: null,
  map_url: null,
  has_more: false,
  related_links: [],
  encyclopedia_links: [],
  dramawebben: {
    introduction_html: '<p v-html="drama-intro-attribute">Drama intended intro</p><form>drama-intro-raw-marker</form>',
    introduction_by: null,
    source_html: ['<cite onclick="drama-source-attribute()">Drama intended source</cite><object>drama-source-raw-marker</object>'],
    portrait: {
      url: "/red/forfattare/ManagedHtmlProbe/ManagedHtmlProbe_dw_large.jpeg",
      caption_html: '<small style="drama-caption-attribute">Drama intended caption</small><math>drama-caption-raw-marker</math>'
    }
  }
}

/** @type {ReadonlyMap<string, AuthorProfile>} */
export const authorProfiles = new Map([
  [strindbergAuthorProfile.author_id, strindbergAuthorProfile],
  [lagerlofAuthorProfile.author_id, lagerlofAuthorProfile],
  [dramaOnlyAuthorProfile.author_id, dramaOnlyAuthorProfile],
  [noIntroAuthorProfile.author_id, noIntroAuthorProfile],
  [rfc3986AuthorProfile.author_id, rfc3986AuthorProfile],
  [managedHtmlProbeAuthorProfile.author_id, managedHtmlProbeAuthorProfile]
])
