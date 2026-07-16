import { describe, expect, test } from "vitest"

import { parseLibraryResponse } from "../../app/lib/library-result"

const author = {
  authorid: "AuthorA",
  full_name: "Anna Author",
  type: "author"
}

const dated = { sort_date_imprint: { plain: 1901 } }

describe("Library relevance result boundary", () => {
  test("converts every supported result family to exact safe destinations", () => {
    const response = parseLibraryResponse({
      hits: 10,
      suggest: [],
      data: [
        { _index: "etext", title: "Etext", texttype: "roman", mediatype: "etext", startpagename: "1", work_titleid: "Etext", main_author: author, work_authors: [author], ...dated },
        { _index: "faksimil", shorttitle: "Faksimil", texttype: "roman", mediatype: "faksimil", startpagename: "2", titleid: "Faksimil", main_author: author, ...dated },
        { _index: "etext-part", title: "Etextdel", texttype: "novell", mediatype: "etext", startpagename: "3", work_titleid: "EtextPart", main_author: author, work_authors: [author], ...dated },
        { _index: "faksimil-part", title: "Faksimildel", texttype: "dikt", mediatype: "faksimil", startpagename: "4", work_titleid: "FaksimilPart", main_author: author, work_authors: [author], ...dated },
        { _index: "pdf", title: "PDF", texttype: "roman", lbworkid: "lb-pdf", main_author: author, ...dated },
        { _index: "author", authorid: "AuthorA", name_for_index: "Author, Anna", birth: { plain: 1900 }, death: { plain: 1980 } },
        { _index: "presentations", title: "Presentation", url: "/presentationer/Anna.html", article_author: "Litteraturbanken" },
        { _index: "sol", article: { ArticleName: "Översättare", URLName: "Oversattare" }, contributors: { FirstName: "Eva", LastName: "Expert" } },
        { _index: "litteraturkartan", header: "Plats", placeid: "Göteborg & omnejd", id: "artikel/1", article_author: "Kartografen" },
        { _index: "wordpress", title: "Artikel", link: "https://litteraturbanken.se/skolan/artikel/", source: "skolan" }
      ]
    })

    expect(response.data.map(item => ({
      index: item.index,
      label: item.primaryLabel,
      href: item.primaryHref,
      download: item.download
    }))).toEqual([
      { index: "etext", label: "Etext", href: "/författare/AuthorA/titlar/Etext/sida/1/etext", download: false },
      { index: "faksimil", label: "Faksimil", href: "/författare/AuthorA/titlar/Faksimil/sida/2/faksimil", download: false },
      { index: "etext-part", label: "Etextdel", href: "/författare/AuthorA/titlar/EtextPart/sida/3/etext", download: false },
      { index: "faksimil-part", label: "Faksimildel", href: "/författare/AuthorA/titlar/FaksimilPart/sida/4/faksimil", download: false },
      { index: "pdf", label: "PDF", href: "/txt/lb-pdf/lb-pdf.pdf", download: true },
      { index: "author", label: "Author, Anna", href: "/författare/AuthorA/", download: false },
      { index: "presentations", label: "Presentation", href: "/presentationer/Anna.html", download: false },
      { index: "sol", label: "Översättare", href: "https://litteraturbanken.se/översättarlexikon/artiklar/Oversattare", download: false },
      { index: "litteraturkartan", label: "Plats", href: "https://litteraturbanken.se/litteraturkartan/?id=G%C3%B6teborg%20%26%20omnejd&article=artikel%2F1", download: false },
      { index: "wordpress", label: "Artikel", href: "https://litteraturbanken.se/skolan/artikel/", download: false }
    ])
    expect(response.data[5]).toMatchObject({
      authorSurname: "Author",
      authorGivenNames: "Anna",
      yearLabel: "1900–1980",
      mobileYearLabel: "(1900–1980)"
    })
  })

  test("drops incomplete, unsupported, and unsafe-destination rows", () => {
    const response = parseLibraryResponse({
      hits: 9,
      suggest: [],
      data: [
        null,
        { _index: "unknown", title: "Unknown" },
        { _index: "author", authorid: "", name_for_index: "Namnlös" },
        { _index: "etext", title: "No page", mediatype: "etext", main_author: author },
        { _index: "presentations", title: "Unsafe", url: "javascript:alert(1)" },
        { _index: "presentations", title: "Protocol relative", url: "//evil.example/p" },
        { _index: "wordpress", title: "Unsafe", link: "data:text/html,boom" },
        { _index: "wordpress", title: "Unexpected host", link: "https://evil.example/boom", source: "skolan" },
        { _index: "wordpress", title: "Safe", link: "/skolan/safe/", source: "skolan" }
      ]
    })

    expect(response.data).toHaveLength(1)
    expect(response.data[0]?.primaryHref).toBe("/skolan/safe/")
    expect(response.hits).toBe(9)
  })

  test.each([
    null,
    {},
    { data: {}, hits: 0, suggest: [] },
    { data: [], hits: "0", suggest: [] },
    { data: [], hits: 0, suggest: {} }
  ])("rejects malformed top-level response %#", payload => {
    expect(() => parseLibraryResponse(payload)).toThrow("Invalid Library relevance response")
  })
})
