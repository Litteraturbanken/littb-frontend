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

export const readerPageHtml = `
<div class="pname" pname="-2">
  <div class="titelsida center">
    <div class="_p title"><span class="w">DOKTOR GLAS</span></div>
    <div class="_p between1"><span class="w">ROMAN</span></div>
    <div class="_p author"><span class="w">HJALMAR SÖDERBERG</span></div>
    <img class="graphicimg" src="/bilder/ornament/reader-fixture.png" alt="">
    <div class="_p publisher"><span class="w">TESTFÖRLAGET</span></div>
  </div>
</div>
`

export const sharedReaderCss = `
.txt .center { text-align: center; }
.txt .title { font-size: 2rem; letter-spacing: .08em; }
`

export const workReaderCss = `
.txt .titelsida { font-family: Georgia, serif; line-height: 1.9; min-width: 28rem; }
.txt .author { letter-spacing: .04em; }
`
