export const readerWorkInfoResponse = {
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
      imprintyear: "1905",
      lbworkid: "lb-reader-doktor-glas",
      mediatype: "etext",
      pages: [
        { pagename: "-3", pageindex: 1 },
        { pagename: "-2", pageindex: 2 },
        { pagename: "-1", pageindex: 3 }
      ],
      searchable: true,
      shorttitle: "Doktor Glas",
      sort_date_imprint: { plain: "1905" },
      startpagename: "-2",
      endpagename: "-1",
      parts: [
        {
          authors: [{ authorid: "SöderbergH" }],
          endpagename: "-1",
          navtitle: "Doktor Glas",
          shorttitle: "Doktor Glas",
          startpagename: "-3",
          title: "Doktor Glas",
          titleid: "DoktorGlas"
        }
      ],
      title: "Doktor Glas. Roman",
      titlepath: "DoktorGlas",
      texttype: "roman"
    }
  ]
}

export const readerFacsimileWorkInfoResponse = {
  hits: 1,
  data: [
    {
      authors: [
        {
          authorid: "LagerlöfS",
          full_name: "Selma Lagerlöf",
          surname: "Lagerlöf"
        }
      ],
      faksimil_sizes: [1, 2, 3, 4],
      imprintyear: "1891",
      lbworkid: "lb-reader-gosta-berlings-saga",
      mediatype: "faksimil",
      pages: [
        { pagename: "1", pageindex: 0, imagenumber: 7 },
        { pagename: "3", pageindex: 1, imagenumber: 9 },
        { pagename: "5", pageindex: 2, imagenumber: 12 }
      ],
      searchable: true,
      shorttitle: "Gösta Berlings saga",
      sort_date_imprint: { plain: "1891" },
      startpagename: "3",
      endpagename: "5",
      parts: [
        {
          authors: [{ authorid: "LagerlöfS" }],
          endpagename: "5",
          navtitle: "Gösta Berlings saga",
          shorttitle: "Gösta Berlings saga",
          startpagename: "1",
          title: "Gösta Berlings saga",
          titleid: "GostaBerlingsSaga"
        }
      ],
      title: "Gösta Berlings saga. Roman",
      titlepath: "GostaBerlingsSaga",
      texttype: "roman",
      width: {
        size_2: 450,
        size_3: 625,
        size_4: 900,
        size_5: 1250
      }
    }
  ]
}

const readerBoyeContributors = [
  {
    authorid: "BoyeK",
    full_name: "Karin Boye",
    surname: "Boye"
  },
  {
    authorid: "HelgesonP",
    full_name: "Paulina Helgeson",
    surname: "Helgeson",
    type: "editor"
  }
]

const readerBoyeParts = [{
  authors: [{ authorid: "BoyeK" }],
  endpagename: "3",
  navtitle: "Ett verkligt jordiskt",
  shorttitle: "Ett verkligt jordiskt",
  startpagename: "3",
  title: "Ett verkligt jordiskt",
  titleid: "EttVerkligtJordiskt"
}]

export const readerBoyeWorkInfoResponse = {
  hits: 2,
  data: [
    {
      ...structuredClone(readerFacsimileWorkInfoResponse.data[0]),
      authors: structuredClone(readerBoyeContributors),
      endpagename: "3",
      imprintyear: "1933",
      lbworkid: "lb-reader-boye-jordiskt",
      pages: [{ pagename: "3", pageindex: 1, imagenumber: 3 }],
      parts: structuredClone(readerBoyeParts),
      shorttitle: "Ett verkligt jordiskt",
      sort_date_imprint: { plain: "1933" },
      startpagename: "3",
      title: "Ett verkligt jordiskt",
      titlepath: "EttVerkligtJordiskt"
    },
    {
      ...structuredClone(readerWorkInfoResponse.data[0]),
      authors: structuredClone(readerBoyeContributors),
      endpagename: "3",
      imprintyear: "1933",
      lbworkid: "lb-reader-boye-jordiskt",
      pages: [{ pagename: "3", pageindex: 1 }],
      parts: structuredClone(readerBoyeParts),
      shorttitle: "Ett verkligt jordiskt",
      sort_date_imprint: { plain: "1933" },
      startpagename: "3",
      title: "Ett verkligt jordiskt",
      titlepath: "EttVerkligtJordiskt"
    }
  ]
}

export const readerAarnsethFacsimileWorkInfoResponse = {
  hits: 1,
  data: [
    {
      authors: [
        {
          authorid: "AarnsethF",
          full_name: "Fredrik Aarnseth",
          surname: "Aarnseth"
        }
      ],
      faksimil_sizes: [0, 1, 2, 3, 4],
      imprintyear: "1911",
      lbworkid: "lb3203777",
      mediatype: "faksimil",
      pages: [
        { pagename: "3", pageindex: 2, imagenumber: 3 },
        { pagename: "58", pageindex: 57, imagenumber: 58 },
        { pagename: "99", pageindex: 98, imagenumber: 99 }
      ],
      shorttitle: "Rallarliv",
      sort_date_imprint: { plain: "1911" },
      startpagename: "3",
      endpagename: "99",
      parts: [],
      searchable: true,
      title: "Rallarliv",
      titlepath: "Rallarliv",
      width: {
        size_1: 426,
        size_2: 511,
        size_3: 750,
        size_4: 1023,
        size_5: 2080
      }
    }
  ]
}

const partPages = ["-4", "-3", "-2", "-1", "1", "2", "3", "4", "5"]

export const readerPartsWorkInfoResponse = {
  hits: 1,
  data: [
    {
      ...structuredClone(readerWorkInfoResponse.data[0]),
      endpagename: "5",
      lbworkid: "lb-reader-doktor-glas-parts",
      pages: partPages.map((pagename, index) => ({ pagename, pageindex: index + 1 })),
      parts: [
        {
          authors: [{ authorid: "SöderbergH" }],
          endpagename: "1",
          navtitle: "Yttre delen",
          shorttitle: "Yttre",
          startpagename: "-4",
          title: "Den yttre delen",
          titleid: "outer"
        },
        {
          authors: [{
            authorid: "MörikeE",
            full_name: "Eduard Mörike",
            surname: "Mörike"
          }],
          endpagename: "-2",
          navtitle: "Mellandelen",
          shorttitle: "Mellan",
          startpagename: "-3",
          title: "Den nästlade mellandelen",
          titleid: "nested"
        },
        {
          authors: [
            {
              authorid: "RilkeRM",
              full_name: "Rainer Maria Rilke",
              surname: "Rilke"
            },
            {
              authorid: "ShelleyPB",
              full_name: "Percy Bysshe Shelley",
              surname: "Shelley"
            }
          ],
          endpagename: "1",
          navtitle: "Överlappningen",
          shorttitle: "Överlapp",
          startpagename: "-2",
          title: "Den överlappande delen",
          titleid: "overlap"
        },
        {
          authors: [{ authorid: "SöderbergH" }],
          endpagename: "5",
          navtitle: "Senare delen",
          shorttitle: "Senare",
          startpagename: "3",
          title: "Den senare delen",
          titleid: "later"
        },
        {
          authors: [{
            authorid: "MörikeE",
            full_name: "Eduard Mörike",
            surname: "Mörike"
          }],
          endpagename: "4",
          navtitle: "Samma start",
          shorttitle: "Samma",
          startpagename: "3",
          title: "Delen med samma start",
          titleid: "same-start"
        }
      ],
      shorttitle: "Doktor Glas delar",
      startpagename: "-3",
      title: "Doktor Glas delar. Roman",
      titlepath: "DoktorGlasParts"
    }
  ]
}

export const readerPartsPageHtmlByIndex = Object.freeze(Object.fromEntries(
  partPages.map((pageName, index) => [index + 1, `
<div class="pname" pname="${pageName}">
  <div class="titelsida center">
    <div class="_p title"><span class="w">DELAD SIDA ${pageName}</span></div>
  </div>
</div>
`])
))

export const readerFacsimileJpegFile = new URL(
  "./library-content/ljudlandskap.jpg",
  import.meta.url
)

export const readerPageHtmlByIndex = Object.freeze({
  1: `
<div class="pname" pname="-3">
  <div class="titelsida center">
    <div class="_p title"><span class="w" id="w1_1">FÖREGÅENDE</span> <span class="w" id="w1_2">SIDA</span></div>
  </div>
</div>
`,
  2: `
<div class="pname" pname="-2">
  <div class="titelsida center">
    <div class="_p title"><span class="w" id="w2_1">DOKTOR</span> <span class="w" id="w2_2">GLAS</span></div>
    <div class="_p between1"><span class="w">ROMAN</span></div>
    <div class="_p author"><span class="w">HJALMAR SÖDERBERG</span></div>
    <span hidden aria-hidden="true" id="w2_90"></span>
    <span hidden aria-hidden="true" id="w2_90"></span>
    <img class="graphicimg" src="/bilder/ornament/reader-fixture.png" alt="">
    <div class="_p publisher"><span class="w">TESTFÖRLAGET</span></div>
  </div>
</div>
`,
  3: `
<div class="pname" pname="-1">
  <div class="titelsida center">
    <div class="_p title"><span class="w" id="w3_1">NÄSTA</span> <span class="w" id="w3_2">SIDA</span></div>
  </div>
</div>
`
})

export const workScopedReaderPageHtmlByIndex = Object.freeze({
  13: `
<div class="pname" pname="-2">
  <div class="titelsida center">
    <div class="_p title"><span class="w" id="lb7604979_8654">DEN</span> <span class="w" id="lb7604979_8656">GAMLA</span> <span class="w" id="lb7604979_8658">KYRKAN</span></div>
  </div>
</div>
`,
  14: `
<div class="pname" pname="-1">
  <div class="titelsida center">
    <div class="_p title"><span class="w" id="lb7604979_8700">NÄSTA</span> <span class="w" id="lb7604979_8701">TRÄFF</span></div>
  </div>
</div>
`
})

const phraseHits = [
  {
    index: 0,
    page_name: "-3",
    page_index: 1,
    highlight: { from_word_id: "w1_1", to_word_id: "w1_1" }
  },
  {
    index: 1,
    page_name: "-2",
    page_index: 2,
    highlight: { from_word_id: "w2_1", to_word_id: "w2_2" }
  },
  {
    index: 2,
    page_name: "-2",
    page_index: 2,
    highlight: { from_word_id: "w2_2", to_word_id: "w2_2" }
  },
  {
    index: 3,
    page_name: "-1",
    page_index: 3,
    highlight: { from_word_id: "w3_1", to_word_id: "w3_1" }
  },
  {
    index: 4,
    page_name: "-1",
    page_index: 3,
    highlight: { from_word_id: "w3_2", to_word_id: "w3_2" }
  }
]

function hitsForQuery(query, workId) {
  if ((query === "frihet" || query === "overflow") && workId === "lb238704") {
    return [{
      index: 0,
      page_name: "1",
      page_index: 1,
      highlight: { from_word_id: "w1_11", to_word_id: "w1_11" }
    }]
  }
  if (query === "brev" && (workId === "lb8345227" || workId === "lb-editor-boye")) {
    return [
      {
        index: 0,
        page_name: "5",
        page_index: 4,
        highlight: { from_word_id: "w5_1", to_word_id: "w5_2" }
      },
      {
        index: 1,
        page_name: "6",
        page_index: 5,
        highlight: { from_word_id: "w6_1", to_word_id: "w6_1" }
      },
      {
        index: 2,
        page_name: "7",
        page_index: 6,
        highlight: { from_word_id: "w7_1", to_word_id: "w7_1" }
      }
    ]
  }
  const workScopedRangeVariants = {
    "cross-work-id": ["lb7604980_8654", "lb7604980_8658"],
    "malformed-work-id": ["lb7604979_x", "lb7604979_8658"],
    "descending-work-range": ["lb7604979_8658", "lb7604979_8654"],
    "mixed-work-range": ["w13_1", "lb7604979_8658"]
  }
  if (workId === "lb7604979" && Object.hasOwn(workScopedRangeVariants, query)) {
    const [fromWordId, toWordId] = workScopedRangeVariants[query]
    return [{
      index: 0,
      page_name: "-2",
      page_index: 13,
      highlight: { from_word_id: fromWordId, to_word_id: toWordId }
    }]
  }
  if (query === "kyrka" && workId === "lb7604979") {
    return [
      {
        index: 0,
        page_name: "-2",
        page_index: 13,
        highlight: {
          from_word_id: "lb7604979_8654",
          to_word_id: "lb7604979_8658"
        }
      },
      {
        index: 1,
        page_name: "-1",
        page_index: 14,
        highlight: {
          from_word_id: "lb7604979_8700",
          to_word_id: "lb7604979_8701"
        }
      }
    ]
  }
  if (query === "inga") return []
  if (query === "glas") {
    return [{
      index: 0,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "w2_2", to_word_id: "w2_2" }
    }]
  }
  if (query === "page-mismatch") {
    return [{
      index: 0,
      page_name: "-1",
      page_index: 3,
      highlight: { from_word_id: "w3_1", to_word_id: "w3_1" }
    }]
  }
  if (query === "missing-reader-page") {
    return [{
      index: 0,
      page_name: "999",
      page_index: 998,
      highlight: { from_word_id: "w998_1", to_word_id: "w998_1" }
    }]
  }
  if (query === "leading-zero-page") {
    return [{
      index: 0,
      page_name: "-3",
      page_index: 1,
      highlight: { from_word_id: "w01_4", to_word_id: "w01_4" }
    }]
  }
  if (query === "missing-range") {
    return [{
      index: 0,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "missing", to_word_id: "w2_2" }
    }]
  }
  if (query === "safe-missing-range") {
    return [{
      index: 0,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "w2_98", to_word_id: "w2_99" }
    }]
  }
  if (query === "duplicate-range") {
    return [{
      index: 0,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "w2_90", to_word_id: "w2_90" }
    }]
  }
  if (query === "reversed-range") {
    return [{
      index: 0,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "w2_2", to_word_id: "w2_1" }
    }]
  }
  return phraseHits.map(hit => ({
    ...hit,
    highlight: { ...hit.highlight }
  }))
}

export function readerSearchHitResponse(
  workId,
  query,
  offset = 0,
  limit = 3,
  mediaType = "etext",
  options = {}
) {
  if (query === "editor-max-direct") {
    const totalHits = 1_000_002
    const items = Array.from({
      length: Math.max(0, Math.min(limit, totalHits - offset))
    }, (_, position) => ({
      index: offset + position,
      page_name: "5",
      page_index: 4,
      highlight: { from_word_id: "w5_1", to_word_id: "w5_1" }
    }))
    return { query, media_type: mediaType, offset, limit, total_hits: totalHits, items }
  }
  if (query === "editor-etext-page-mismatch") {
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1,
      items: [{
        index: 0,
        page_name: "-3",
        page_index: 1,
        highlight: { from_word_id: "w2_1", to_word_id: "w2_1" }
      }]
    }
  }
  if (query === "editor-sparse-gap") {
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1,
      items: [{
        index: 0,
        page_name: "14",
        page_index: 13,
        highlight: { from_word_id: "w14_1", to_word_id: "w14_1" }
      }]
    }
  }
  if (query === "editor-leading-zero-page") {
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1,
      items: [{
        index: 0,
        page_name: "5",
        page_index: 4,
        highlight: { from_word_id: "w05_1", to_word_id: "w05_1" }
      }]
    }
  }
  if (query === "max-direct") {
    const totalHits = 1_000_002
    const items = Array.from({
      length: Math.max(0, Math.min(limit, totalHits - offset))
    }, (_, position) => ({
      index: offset + position,
      page_name: "-2",
      page_index: 2,
      highlight: { from_word_id: "w2_2", to_word_id: "w2_2" }
    }))
    return { query, media_type: mediaType, offset, limit, total_hits: totalHits, items }
  }
  if (query === "brev" && (workId === "lb8345227" || workId === "lb-editor-boye")) {
    const totalHits = options.prefix ? 357 : 237
    const hitTemplates = [
      {
        page_name: "5",
        page_index: 4,
        highlight: { from_word_id: "w5_1", to_word_id: "w5_2" }
      },
      {
        page_name: "6",
        page_index: 5,
        highlight: { from_word_id: "w6_1", to_word_id: "w6_1" }
      },
      {
        page_name: "7",
        page_index: 6,
        highlight: { from_word_id: "w7_1", to_word_id: "w7_1" }
      }
    ]
    const items = Array.from({
      length: Math.max(0, Math.min(limit, totalHits - offset))
    }, (_, position) => {
      const index = offset + position
      const template = hitTemplates[index % hitTemplates.length]
      return { ...template, index, highlight: { ...template.highlight } }
    })
    return { query, media_type: mediaType, offset, limit, total_hits: totalHits, items }
  }
  if (query === "faksimil-index-word") {
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1,
      items: [{
        index: 0,
        page_name: "58",
        page_index: 57,
        highlight: { from_word_id: "w57_123", to_word_id: "w57_123" }
      }]
    }
  }
  if (query === "etext-name-word") {
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1,
      items: [{
        index: 0,
        page_name: "58",
        page_index: 57,
        highlight: { from_word_id: "w58_123", to_word_id: "w58_123" }
      }]
    }
  }
  if (workId === "lb3203777" && mediaType === "faksimil" && query === "kyrka") {
    const items = [
      {
        index: 0,
        page_name: "58",
        page_index: 57,
        highlight: { from_word_id: "w58_123", to_word_id: "w58_123" }
      },
      {
        index: 1,
        page_name: "99",
        page_index: 98,
        highlight: { from_word_id: "w99_20", to_word_id: "w99_21" }
      },
      {
        index: 2,
        page_name: "3",
        page_index: 2,
        highlight: { from_word_id: "w3_10", to_word_id: "w3_10" }
      }
    ]
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: items.length,
      items: items.slice(offset, offset + limit)
    }
  }
  if (query === "max-edge") {
    const items = [
      {
        index: 1_000_000,
        page_name: "-2",
        page_index: 2,
        highlight: { from_word_id: "w2_1", to_word_id: "w2_1" }
      },
      {
        index: 1_000_001,
        page_name: "-2",
        page_index: 2,
        highlight: { from_word_id: "w2_2", to_word_id: "w2_2" }
      },
      {
        index: 1_000_002,
        page_name: "-2",
        page_index: 2,
        highlight: { from_word_id: "w2_1", to_word_id: "w2_2" }
      }
    ]
    return {
      query,
      media_type: mediaType,
      offset,
      limit,
      total_hits: 1_000_003,
      items: items.filter(item => item.index >= offset && item.index < offset + limit)
    }
  }

  const items = hitsForQuery(query, workId)
  return {
    query,
    media_type: mediaType,
    offset,
    limit,
    total_hits: items.length,
    items: items.slice(offset, offset + limit)
  }
}

export const sharedReaderCss = `
.txt .center { text-align: center; }
.txt .title { font-size: 2rem; letter-spacing: .08em; }
.reader-rebase-fixture { background-image: url("../bilder/reader-rebase-fixture.png"); }
`

export const workReaderCss = `
.etext { width: 540px; }
.txt .titelsida { font-family: Georgia, serif; line-height: 1.9; min-width: 28rem; }
.txt .author { letter-spacing: .04em; }
`

const manifestContributionRoles = new Map([
  ["editor", "editor"],
  ["redaktör", "editor"],
  ["translator", "translator"],
  ["översättare", "translator"],
  ["illustrator", "illustrator"],
  ["illustratör", "illustrator"],
  ["photographer", "photographer"],
  ["fotograf", "photographer"]
])

function isManifestText(value, maximum) {
  return typeof value === "string"
    && [...value].length >= 1
    && [...value].length <= maximum
    && value === value.trim()
    && !/[\p{Cc}\p{Cs}]/u.test(value)
}

function isManifestSegment(value) {
  return isManifestText(value, 100) && !/[\\/?#]/u.test(value)
}

function manifestRole(value) {
  return typeof value === "string"
    ? manifestContributionRoles.get(value.toLowerCase()) ?? null
    : null
}

function manifestContributors(raw) {
  const source = raw.authors ?? raw.work_authors
    ?? (raw.main_author ? [raw.main_author] : null)
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("malformed manifest contributors")
  }
  const contributors = source.map(author => {
    if (!isManifestSegment(author?.authorid) || !isManifestText(author.full_name, 2_000)) {
      throw new Error("malformed manifest contributor")
    }
    return {
      author_id: author.authorid,
      full_name: author.full_name,
      author_type: manifestRole(author.type),
      role: manifestRole(author.role)
    }
  })
  if (new Set(contributors.map(contributor => contributor.author_id)).size !== contributors.length) {
    throw new Error("duplicate manifest contributor")
  }
  return contributors
}

function manifestPages(value, withImages = false) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("malformed manifest pages")
  }
  const pages = value.map(page => {
    if (
      !isManifestText(page?.pagename, 100)
      || !Number.isInteger(page.pageindex)
      || page.pageindex < 0
      || page.pageindex >= 100_000
      || (withImages && (
        !Number.isInteger(page.imagenumber)
        || page.imagenumber < 0
        || page.imagenumber >= 100_000
      ))
    ) {
      throw new Error("malformed manifest page")
    }
    return {
      page_name: page.pagename,
      page_index: page.pageindex,
      ...(withImages ? { image_number: page.imagenumber } : {})
    }
  }).sort((left, right) => left.page_index - right.page_index)
  if (
    new Set(pages.map(page => page.page_name)).size !== pages.length
    || new Set(pages.map(page => page.page_index)).size !== pages.length
  ) {
    throw new Error("duplicate manifest page")
  }
  return pages
}

function manifestParts(value, pages, rawContributors) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error("malformed manifest parts")
  const pageIndexes = new Map(pages.map(page => [page.page_name, page.page_index]))
  const contributorNames = new Map(rawContributors.map(author => [
    author.authorid,
    { full_name: author.full_name ?? null, surname: author.surname ?? null }
  ]))
  return value.map((part, sourceIndex) => {
    const startPageIndex = pageIndexes.get(part?.startpagename)
    const endPageIndex = pageIndexes.get(part?.endpagename)
    if (
      startPageIndex === undefined
      || endPageIndex === undefined
      || startPageIndex > endPageIndex
      || typeof part.title !== "string"
      || !Array.isArray(part.authors)
    ) {
      throw new Error("malformed manifest part")
    }
    return {
      source_index: sourceIndex,
      start_page_name: part.startpagename,
      start_page_index: startPageIndex,
      end_page_name: part.endpagename,
      end_page_index: endPageIndex,
      title: part.title,
      nav_title: typeof part.navtitle === "string" ? part.navtitle : null,
      short_title: typeof part.shorttitle === "string" ? part.shorttitle : null,
      title_id: typeof part.titleid === "string" ? part.titleid : null,
      authors: part.authors.map(author => {
        if (typeof author?.authorid !== "string") {
          throw new Error("malformed manifest part author")
        }
        const known = contributorNames.get(author.authorid)
        return {
          author_id: author.authorid,
          full_name: typeof author.full_name === "string"
            ? author.full_name
            : known?.full_name ?? null,
          surname: typeof author.surname === "string"
            ? author.surname
            : known?.surname ?? null
        }
      })
    }
  })
}

function manifestSizes(raw) {
  if (!Array.isArray(raw.faksimil_sizes) || raw.faksimil_sizes.length === 0) {
    throw new Error("malformed manifest sizes")
  }
  const sizes = raw.faksimil_sizes.map(rawSize => {
    const size = rawSize + 1
    const width = raw.width?.[`size_${size}`]
    if (!Number.isInteger(rawSize) || rawSize < 0 || rawSize > 4
      || typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
      throw new Error("malformed manifest size")
    }
    return { size, width }
  }).sort((left, right) => left.size - right.size)
  if (new Set(sizes.map(size => size.size)).size !== sizes.length) {
    throw new Error("duplicate manifest size")
  }
  return sizes
}

function preferredManifestSize(sizes) {
  if (sizes.some(size => size.size === 3)) return 3
  const lower = sizes.filter(size => size.size < 3)
  return lower.length > 0 ? lower.at(-1).size : sizes[0].size
}

function manifestPageStep(value) {
  const parsed = typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : 1
}

function manifestNavigationName(raw, field, pages) {
  const value = raw[field]
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || !pages.some(page => page.page_name === value)) {
    throw new Error("malformed manifest navigation")
  }
  return value
}

function buildReaderManifestFixture(records, titlePath, mediaType) {
  if (!Array.isArray(records)) throw new Error("malformed Reader fixture envelope")
  const exact = records.filter(record => (
    record?.titlepath === titlePath && record.mediatype === mediaType
  ))
  if (exact.length === 0) return null
  if (exact.length !== 1) throw new Error("ambiguous Reader fixture")
  const selected = exact[0]
  const rawContributors = selected.authors ?? selected.work_authors
    ?? (selected.main_author ? [selected.main_author] : null)
  const contributors = manifestContributors(selected)
  if (!Array.isArray(rawContributors)) throw new Error("malformed contributors")

  let pages
  if (mediaType === "faksimil") {
    pages = manifestPages(selected.pages, true)
  } else if (selected.pages !== undefined && selected.pages !== null) {
    pages = manifestPages(selected.pages)
  } else {
    const sibling = records.find(record => (
      record !== selected
      && record?.lbworkid === selected.lbworkid
      && record.pages !== undefined
      && record.pages !== null
    ))
    pages = manifestPages(sibling?.pages)
  }

  const alternateType = mediaType === "etext" ? "faksimil" : "etext"
  const alternate = records.filter(record => (
    record !== selected
    && record?.titlepath === titlePath
    && record.mediatype === alternateType
  ))
  if (alternate.length > 1) throw new Error("ambiguous alternate Reader fixture")
  const fullTitle = selected.title
  if (typeof selected.lbworkid !== "string" || typeof fullTitle !== "string") {
    throw new Error("malformed Reader fixture identity")
  }
  const imprintYear = typeof selected.sort_date_imprint?.plain === "string"
    ? selected.sort_date_imprint.plain
    : typeof selected.imprintyear === "string" ? selected.imprintyear : null
  const common = {
    alternate_media: alternate.length === 1
      ? { media_type: alternateType, pages: manifestPages(alternate[0].pages) }
      : null,
    author_id: contributors[0].author_id,
    contributors,
    declared_page_count: Number.isInteger(selected.page_count)
      && selected.page_count > 0
      && selected.page_count <= 100_000
      ? selected.page_count
      : null,
    display_title: typeof selected.shorttitle === "string" ? selected.shorttitle : fullTitle,
    editor_work_id: typeof selected.editor_lbworkid === "string"
      ? selected.editor_lbworkid
      : null,
    end_page_name: manifestNavigationName(selected, "endpagename", pages),
    full_title: fullTitle,
    has_dramawebben: selected.dramawebben !== null
      && typeof selected.dramawebben === "object"
      && !Array.isArray(selected.dramawebben),
    has_nya_vagar: Array.isArray(selected.keyword) && selected.keyword.includes("1800"),
    imprint_year: imprintYear,
    is_drama: selected.texttype === "drama",
    media_type: mediaType,
    page_step: manifestPageStep(selected.pagestep),
    pages,
    parts: manifestParts(selected.parts, pages, rawContributors),
    searchable: selected.searchable === true,
    start_page_name: manifestNavigationName(selected, "startpagename", pages),
    title_path: titlePath,
    urn: typeof selected.urn === "string" ? selected.urn : null,
    work_id: selected.lbworkid
  }
  if (mediaType === "etext") return common
  const sizes = manifestSizes(selected)
  return {
    ...common,
    sizes,
    preferred_size: preferredManifestSize(sizes)
  }
}

export function readerManifestResponse(titlePath, mediaType, rawResponse) {
  const raw = structuredClone(rawResponse)
  return buildReaderManifestFixture(raw?.data, titlePath, mediaType)
}

function editorBoyeRepresentation(workId = "lb-editor-boye") {
  return {
    authors: structuredClone(readerBoyeContributors),
    endpagename: "9",
    faksimil_sizes: [2],
    imprintyear: "2022",
    lbworkid: workId,
    mediatype: "faksimil",
    page_count: 9,
    pages: Array.from({ length: 9 }, (_, pageindex) => ({
      pagename: String(pageindex + 1),
      pageindex
    })),
    parts: [
      {
        authors: [{ authorid: "HelgesonP" }],
        endpagename: "7",
        navtitle: null,
        shorttitle: null,
        startpagename: "5",
        title: "Förord",
        titleid: "Förord"
      },
      {
        authors: [],
        endpagename: "9",
        navtitle: null,
        shorttitle: null,
        startpagename: "9",
        title: "Kronologi",
        titleid: "Kronologi"
      }
    ],
    searchable: true,
    shorttitle: "Ett verkligt jordiskt liv. Brev",
    startpagename: "3",
    title: "Ett verkligt jordiskt liv. Brev",
    titlepath: "EttVerkligtJordiskt",
    width: { size_3: 625 }
  }
}

function editorDoktorPages() {
  return structuredClone(readerWorkInfoResponse.data[0].pages).map((page, pageindex) => ({
    ...page,
    pageindex
  }))
}

function editorRawRepresentations(workId) {
  if (workId === "lb-editor-doktor-glas") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      editor_lbworkid: "lb-editor-doktor-glas",
      lbworkid: workId,
      page_count: 3,
      pages: editorDoktorPages(),
      urn: "urn:nbn:se:lb-lb-reader-doktor-glas"
    }]
  }
  if (workId === "lb-editor-no-ocr") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      lbworkid: workId,
      mediatype: "faksimil",
      page_count: 3,
      pages: editorDoktorPages(),
      parts: [],
      mediatypes: [],
      width: { size_2: 450, size_3: 625, size_4: 900 }
    }]
  }
  if (workId === "lb-editor-mixed") {
    const common = {
      ...structuredClone(readerWorkInfoResponse.data[0]),
      authors: [{ authorid: "SöderbergH", full_name: "Hjalmar Söderberg" }],
      lbworkid: workId,
      shorttitle: "Blandad editor",
      startpagename: "-2",
      titlepath: "DoktorGlas"
    }
    return [
      { ...structuredClone(common), mediatype: "etext", page_count: 2 },
      {
        ...structuredClone(common),
        faksimil_sizes: [3],
        mediatype: "faksimil",
        page_count: 5,
        width: { size_2: 450, size_3: 625, size_4: 900 }
      }
    ]
  }
  if (workId === "lb-editor-long") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      faksimil_sizes: [3],
      lbworkid: workId,
      mediatype: "faksimil",
      page_count: 25,
      width: { size_2: 450, size_3: 625, size_4: 900 }
    }]
  }
  if (workId === "lb-editor-sparse") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      faksimil_sizes: [2],
      lbworkid: workId,
      mediatype: "faksimil",
      pages: [
        { pagename: "2", pageindex: 2 },
        { pagename: "12", pageindex: 12 },
        { pagename: "57", pageindex: 57 }
      ],
      endpagename: "57",
      page_count: null,
      parts: [],
      searchable: true,
      startpagename: "2",
      width: { size_3: 625 }
    }]
  }
  if (workId === "lb-editor-missing-image") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      faksimil_sizes: [3],
      lbworkid: workId,
      mediatype: "faksimil",
      page_count: 3,
      pages: editorDoktorPages(),
      width: { size_2: 450, size_3: 625, size_4: 900 }
    }]
  }
  if (workId === "lb-editor-size-four") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      faksimil_sizes: [3],
      lbworkid: workId,
      mediatype: "faksimil",
      page_count: 3,
      pages: editorDoktorPages(),
      parts: [],
      width: { size_4: 900 }
    }]
  }
  if (workId === "lb-editor-doktor") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      lbworkid: workId,
      faksimil_sizes: [1, 2, 3, 4],
      mediatype: "faksimil",
      page_count: 3,
      pages: editorDoktorPages(),
      parts: [],
      width: { size_2: 450, size_3: 625, size_4: 900, size_5: 1250 },
      mediatypes: [{
        url: "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
      }]
    }]
  }
  if (workId === "lb-editor-malformed-bounds") {
    return [{
      ...structuredClone(readerWorkInfoResponse.data[0]),
      faksimil_sizes: [3],
      lbworkid: workId,
      mediatype: "faksimil",
      page_count: null,
      pages: null,
      width: { size_2: 450, size_3: 625, size_4: 900 }
    }]
  }
  if ([
    "lb-editor-boye",
    "lb8345227",
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ].includes(workId)) {
    const representation = editorBoyeRepresentation(workId)
    if (workId === "lb-editor-malformed-contributor") {
      representation.authors.splice(1, 0, { authorid: "BrokenWithoutName" })
    }
    if (workId === "lb-editor-malformed-part") {
      representation.parts.splice(1, 0, { title: "Broken without page bounds" })
    }
    return [representation]
  }
  return []
}

export function editorMetadataResponse(workId) {
  const data = editorRawRepresentations(workId)
  return { hits: data.length, data }
}

export function editorRawRepresentationFor(workId, mediaType) {
  const exact = editorRawRepresentations(workId)
    .filter(representation => representation.mediatype === mediaType)
  return exact.length === 1 ? structuredClone(exact[0]) : null
}

function editorBounds(raw) {
  if (Number.isInteger(raw.page_count) && raw.page_count > 0) {
    return { kind: "dense", page_count: raw.page_count }
  }
  const pages = manifestPages(raw.pages)
  return { kind: "sparse", page_indexes: pages.map(page => page.page_index) }
}

function editorPublicReaderTarget(records) {
  const ordered = [...records].sort((left, right) => {
    const order = value => value === "etext" ? 0 : value === "faksimil" ? 1 : 2
    return order(left.mediatype) - order(right.mediatype)
  })
  for (const raw of ordered) {
    for (const media of Array.isArray(raw.mediatypes) ? raw.mediatypes : []) {
      if (typeof media?.url !== "string") continue
      const match = /^\/författare\/([^/]+)\/titlar\/([^/]+)\/sida\/([^/]+)\/(etext|faksimil)$/.exec(
        decodeURI(media.url)
      )
      if (match) {
        return {
          author_id: decodeURIComponent(match[1]),
          title_path: decodeURIComponent(match[2]),
          start_page_name: decodeURIComponent(match[3]),
          media_type: match[4]
        }
      }
    }
  }
  for (const raw of ordered) {
    const contributors = manifestContributors(raw)
    if (
      typeof raw.titlepath !== "string"
      || typeof raw.startpagename !== "string"
      || !["etext", "faksimil"].includes(raw.mediatype)
    ) continue
    return {
      author_id: contributors[0].author_id,
      title_path: raw.titlepath,
      start_page_name: raw.startpagename,
      media_type: raw.mediatype
    }
  }
  return null
}

function buildEditorCompleteFixture(raw, workId, mediaType, bounds, publicReaderTarget) {
  const contributors = manifestContributors(raw)
  const rawContributors = raw.authors ?? raw.work_authors
    ?? (raw.main_author ? [raw.main_author] : null)
  if (!Array.isArray(rawContributors) || typeof raw.title !== "string"
    || typeof raw.titlepath !== "string") {
    throw new Error("malformed Editor fixture")
  }
  const pages = raw.pages === undefined || raw.pages === null || raw.pages.length === 0
    ? []
    : manifestPages(raw.pages)
  if (bounds.kind === "sparse"
    && pages.map(page => page.page_index).join(",") !== bounds.page_indexes.join(",")) {
    throw new Error("mismatched Editor sparse pages")
  }
  const sizes = mediaType === "faksimil" ? manifestSizes(raw) : []
  return {
    status: "complete",
    work_id: workId,
    media_type: mediaType,
    bounds,
    display_title: typeof raw.shorttitle === "string" ? raw.shorttitle : raw.title,
    title_path: raw.titlepath,
    contributors,
    pages,
    parts: manifestParts(raw.parts, pages, rawContributors),
    start_page_name: manifestNavigationName(raw, "startpagename", pages),
    end_page_name: manifestNavigationName(raw, "endpagename", pages),
    searchable: raw.searchable === true,
    imprint_year: typeof raw.sort_date_imprint?.plain === "string"
      ? raw.sort_date_imprint.plain
      : typeof raw.imprintyear === "string" ? raw.imprintyear : null,
    sizes,
    public_reader_target: publicReaderTarget
  }
}

export function editorManifestResponse(workId, mediaType) {
  if (workId === "lb-editor-fallback") {
    return {
      status: "page_bounds_only",
      work_id: workId,
      media_type: mediaType,
      bounds: { kind: "dense", page_count: 3 }
    }
  }
  if (workId === "lb-editor-no-contributors") {
    const complete = editorManifestResponse("lb-editor-doktor", mediaType)
    if (complete?.status !== "complete") return complete
    return {
      ...complete,
      contributors: [],
      public_reader_target: null,
      work_id: workId
    }
  }
  if (workId === "lb-editor-dot-page") {
    const complete = editorManifestResponse("lb-editor-boye", mediaType)
    if (complete?.status !== "complete") return complete
    return {
      ...complete,
      bounds: { kind: "dense", page_count: 1 },
      pages: [{ page_index: 0, page_name: "." }],
      start_page_name: ".",
      end_page_name: ".",
      parts: [{
        ...complete.parts[0],
        end_page_index: 0,
        end_page_name: ".",
        start_page_index: 0,
        start_page_name: "."
      }],
      public_reader_target: complete.public_reader_target && {
        ...complete.public_reader_target,
        start_page_name: "."
      },
      work_id: workId
    }
  }
  const records = editorRawRepresentations(workId)
  const exact = records.filter(representation => representation.mediatype === mediaType)
  const raw = exact.length === 1 ? structuredClone(exact[0]) : null
  if (raw === null) return null
  let bounds = null
  try {
    bounds = editorBounds(raw)
    return buildEditorCompleteFixture(
      raw,
      workId,
      mediaType,
      bounds,
      editorPublicReaderTarget(records)
    )
  } catch (error) {
    if (bounds === null) throw error
    return {
      status: "page_bounds_only",
      work_id: workId,
      media_type: mediaType,
      bounds
    }
  }
}
