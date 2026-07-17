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
  related_links: [],
  encyclopedia_links: [],
  dramawebben: {
    introduction_html: "<p>Dramawebbens RFC3986-profil.</p>",
    introduction_by: null,
    source_html: [],
    portrait: null
  }
}

/** @type {ReadonlyMap<string, AuthorProfile>} */
export const authorProfiles = new Map([
  [strindbergAuthorProfile.author_id, strindbergAuthorProfile],
  [lagerlofAuthorProfile.author_id, lagerlofAuthorProfile],
  [dramaOnlyAuthorProfile.author_id, dramaOnlyAuthorProfile],
  [noIntroAuthorProfile.author_id, noIntroAuthorProfile],
  [rfc3986AuthorProfile.author_id, rfc3986AuthorProfile]
])
