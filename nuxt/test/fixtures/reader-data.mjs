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
      shorttitle: "Doktor Glas",
      sort_date_imprint: { plain: "1905" },
      startpagename: "-2",
      title: "Doktor Glas. Roman",
      titlepath: "DoktorGlas"
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
      shorttitle: "Gösta Berlings saga",
      sort_date_imprint: { plain: "1891" },
      startpagename: "3",
      title: "Gösta Berlings saga. Roman",
      titlepath: "GostaBerlingsSaga",
      width: {
        size_2: 450,
        size_3: 625,
        size_4: 900,
        size_5: 1250
      }
    }
  ]
}

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

export function readerSearchHitResponse(workId, query, offset = 0, limit = 3) {
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
      media_type: "etext",
      offset,
      limit,
      total_hits: 1_000_003,
      items: items.filter(item => item.index >= offset && item.index < offset + limit)
    }
  }

  const items = hitsForQuery(query, workId)
  return {
    query,
    media_type: "etext",
    offset,
    limit,
    total_hits: items.length,
    items: items.slice(offset, offset + limit)
  }
}

export const sharedReaderCss = `
.txt .center { text-align: center; }
.txt .title { font-size: 2rem; letter-spacing: .08em; }
`

export const workReaderCss = `
.txt .titelsida { font-family: Georgia, serif; line-height: 1.9; min-width: 28rem; }
.txt .author { letter-spacing: .04em; }
`
