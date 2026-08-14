import { parseHTML } from "linkedom"
import { describe, expect, test } from "vitest"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  authorProfilePath,
  createAuthorProfileView,
  encodeRfc3986Segment,
  formatAuthorYears,
  safeAuthorCanonicalPath,
  safeAuthorSearchHref,
  sanitizeAuthorHtml,
  validateAuthorRouteParam
} from "../../app/lib/author-profile"
import {
  dramaOnlyAuthorProfile,
  strindbergAuthorProfile
} from "../fixtures/author-profile-data.mjs"

type AuthorProfile = components["schemas"]["AuthorProfile"]

describe("author route validation", () => {
  test.each(["StrindbergA", "SöderbergH", "LagerlöfS", "Émilie_du-Châtelet2"])(
    "accepts the historical scalar identifier %s",
    value => {
      expect(validateAuthorRouteParam(value)).toBe(true)
    }
  )

  test.each([
    undefined,
    null,
    [],
    ["StrindbergA"],
    "",
    "A".repeat(101),
    " StrindbergA",
    "StrindbergA ",
    "Strindberg\u0000A",
    "Strindberg\u0085A",
    "Strindberg/A",
    "Strindberg\\A",
    "Strindberg\ud800A",
    "Strindberg\udfffA",
    "%",
    "%ZZ",
    "%25",
    "%2525252525252525252525252525252525",
    ".",
    "..",
    "%2e%2e",
    "%252e%252e"
  ])("rejects an unsafe or non-scalar identifier %#", value => {
    expect(validateAuthorRouteParam(value)).toBe(false)
  })
})

describe("author profile paths", () => {
  test.each([".", ".."]) (
    "rejects the URL dot segment %s instead of constructing an alternate endpoint",
    value => {
      expect(() => encodeRfc3986Segment(value)).toThrow(TypeError)
      expect(() => new URL(
        `/nuxt-api/reader/resolve/Test/${encodeRfc3986Segment(value)}`,
        "https://example.test"
      )).toThrow(TypeError)
    }
  )

  test.each(["version.1", "%2E", "part/name", "query?value"])(
    "preserves the non-dot segment identity %s",
    value => {
      const encoded = encodeRfc3986Segment(value)
      expect(new URL(
        `/nuxt-api/reader/resolve/Test/${encoded}`,
        "https://example.test"
      ).pathname).toBe(`/nuxt-api/reader/resolve/Test/${encoded}`)
    }
  )

  test("uses uppercase RFC3986 escapes for every encodeURIComponent exception", () => {
    expect(authorProfilePath("O'Neil!()*A"))
      .toBe("/f%C3%B6rfattare/O%27Neil%21%28%29%2AA")
  })

  test("encodes author and child segments into one canonical client path", () => {
    expect(authorProfilePath("O'Neil(A", "titlar", "Del!Ett"))
      .toBe("/f%C3%B6rfattare/O%27Neil%28A/titlar/Del%21Ett")
  })

  test("replaces lone surrogate code units in author and child route segments", () => {
    expect(encodeRfc3986Segment("A\ud800B")).toBe("A%EF%BF%BDB")
    expect(authorProfilePath("\udfff", "titlar", "\ud800"))
      .toBe("/f%C3%B6rfattare/%EF%BF%BD/titlar/%EF%BF%BD")
  })

  test.each([
    ["/författare/StrindbergA", "StrindbergA", true, "/f%C3%B6rfattare/StrindbergA"],
    ["/f%C3%B6rfattare/StrindbergA", "StrindbergA", true, "/f%C3%B6rfattare/StrindbergA"],
    ["/författare/StrindbergA/titlar", "StrindbergA", true, "/f%C3%B6rfattare/StrindbergA/titlar"],
    ["/författare/StrindbergA/dramawebben", "StrindbergA", true, "/f%C3%B6rfattare/StrindbergA/dramawebben"],
    ["/författare/O%27Neil%28A", "O'Neil(A", true, "/f%C3%B6rfattare/O%27Neil%28A"]
  ])("accepts the authorized backend canonical path %s", (
    value,
    authorId,
    hasDramawebben,
    expected
  ) => {
    expect(safeAuthorCanonicalPath(value, authorId, hasDramawebben)).toBe(expected)
  })

  test.each([
    "https://evil.invalid/författare/StrindbergA",
    "//evil.invalid/författare/StrindbergA",
    "/bibliotek",
    "/författare/Lagerl%C3%B6fS",
    "/författare/StrindbergA/mer",
    "/författare/StrindbergA/dramawebben?visning=kort",
    "/författare/StrindbergA#profil",
    "/författare/StrindbergA/",
    "/författare/StrindbergA/%2e%2e/bibliotek",
    "/författare/StrindbergA%2Fdramawebben",
    "/f%25C3%25B6rfattare/StrindbergA",
    "/författare/%ZZ"
  ])("rejects an unauthorized backend canonical path %#", value => {
    expect(safeAuthorCanonicalPath(value, "StrindbergA", true)).toBeNull()
  })

  test("rejects the Dramawebben canonical target without an accepted Drama block", () => {
    expect(safeAuthorCanonicalPath(
      "/författare/Lagerl%C3%B6fS/dramawebben",
      "LagerlöfS",
      false
    )).toBeNull()
  })
})

test("rejects a backend profile whose author identity is a URL dot segment", () => {
  const profile = structuredClone(strindbergAuthorProfile) as AuthorProfile
  profile.author_id = ".."
  expect(() => createAuthorProfileView(profile, "ordinary")).toThrow(TypeError)
})

describe("author lifespan formatting", () => {
  test.each([
    ["1849", null, "f. 1849"],
    [null, "1940", "d. 1940"],
    ["1849", "1912", "1849-1912"],
    [null, null, ""],
    ["0000", "0000", ""],
    ["0000", "1940", "d. 1940"],
    ["1849", "0000", "f. 1849"]
  ])("formats birth %s and death %s", (birth, death, expected) => {
    expect(formatAuthorYears(birth, death)).toBe(expected)
  })
})

describe("managed author HTML sanitization", () => {
  const maliciousHtml = [
    '<div class="profile intro" id="bio" lang="sv" title="Levnad" data-secret="drop">',
    "<h2>Rubrik</h2>",
    '<p onclick="steal()" style="color:red" ng-click="steal()" data-ng-bind="bad" v-html="bad" :title="bad" @click="bad" srcdoc="bad">',
    "Trygg <em>betoning</em> och <strong>styrka</strong>.</p>",
    "<blockquote><p>Citat</p></blockquote>",
    "<ol><li>Första</li></ol><ul><li>Andra</li></ul>",
    '<mark>Okänd formatering <i>bevaras</i></mark>',
    '<a href="#fragment">Fragment</a>',
    '<a href="https://example.test/path?q=1#part" target="_blank" rel="external">HTTPS</a>',
    '<a href="https://reader:secret@example.test/path">Credentials</a>',
    '<a href="https://example.test/named" target="author_profile" rel="editorial">Named</a>',
    '<a href="https://example.test/self" target="_self" rel="author">Self</a>',
    '<a href="https://example.test/parent" target="_parent" rel="author">Parent</a>',
    '<a href="https://example.test/top" target="_top" rel="author">Top</a>',
    '<a href="http://example.test/path">HTTP</a>',
    '<a href="mailto:editor@example.test">E-post</a>',
    '<a href="tel:+461234567">Telefon</a>',
    '<a href="titlar/Ett-verk?x=1#del">Relativ</a>',
    '<a href="/forfattare/StrindbergA/titlar">Legacy</a>',
    '<a href="javascript:alert(1)">JS</a>',
    '<a href="java&#x0A;script:alert(1)">Kontroll</a>',
    '<a href="data:text/html,evil">Data</a>',
    '<a href="file:///etc/passwd">Fil</a>',
    '<a href="custom:evil">Anpassad</a>',
    '<a href="//evil.example/path">Protokollrelativ</a>',
    '<a href="\\\\evil.example\\path">Bakstreck</a>',
    '<a href="/safe/../admin">Traversal</a>',
    '<a href="/%252e%252e/admin">Kodad traversal</a>',
    '<a href="/safe/%3F/%2e%2e/admin">Frågeteckens-traversal</a>',
    '<a href="/safe/%2523/%252e%252e/admin">Dubbelkodad fragment-traversal</a>',
    '<a href="/%ZZ/admin">Felaktig kodning</a>',
    '<a href="/safe/%3Fdel/%23avsnitt?view=1#part">Kodade avgränsare</a>',
    '<script>script-probe</script>',
    '<style>.style-probe { display: block }</style>',
    '<form><p>form-probe</p><input value="x"></form>',
    '<iframe srcdoc="iframe-probe">frame-probe</iframe>',
    '<frame src="https://evil.example">frame-element-probe</frame>',
    '<object data="https://evil.example">object-probe</object>',
    '<embed src="https://evil.example">embed-probe</embed>',
    '<svg><script>svg-script-probe</script><text>svg-probe</text></svg>',
    '<math><mi>math-probe</mi></math>',
    '<button>button-probe</button>',
    '<img src="https://evil.example/probe.png" alt="image-probe">',
    "</div>"
  ].join("")

  test("preserves the explicit editorial allowlist and unwraps benign formatting", () => {
    const output = sanitizeAuthorHtml(maliciousHtml)
    const { document } = parseHTML(`<body>${output}</body>`)
    const root = document.querySelector("div")

    expect(root?.getAttribute("class")).toBe("profile intro")
    expect(root?.getAttribute("id")).toBe("bio")
    expect(root?.getAttribute("lang")).toBe("sv")
    expect(root?.getAttribute("title")).toBe("Levnad")
    expect(root?.hasAttribute("data-secret")).toBe(false)
    expect(output).toContain("<h2>Rubrik</h2>")
    expect(output).toContain("<em>betoning</em>")
    expect(output).toContain("<strong>styrka</strong>")
    expect(output).toContain("<blockquote><p>Citat</p></blockquote>")
    expect(output).toContain("<ol><li>Första</li></ol>")
    expect(output).toContain("<ul><li>Andra</li></ul>")
    expect(output).not.toContain("<mark")
    expect(output).toContain("Okänd formatering <i>bevaras</i>")
  })

  test("keeps only safe links and hardens new browsing contexts", () => {
    const output = sanitizeAuthorHtml(maliciousHtml)
    const { document } = parseHTML(`<body>${output}</body>`)
    const links = new Map(
      [...document.querySelectorAll("a")].map(anchor => [
        anchor.textContent,
        {
          href: anchor.getAttribute("href"),
          rel: anchor.getAttribute("rel"),
          target: anchor.getAttribute("target")
        }
      ])
    )

    expect(links.get("Fragment")?.href).toBe("#fragment")
    expect(links.get("HTTPS")).toEqual({
      href: "https://example.test/path?q=1#part",
      rel: "external noopener noreferrer",
      target: "_blank"
    })
    expect(links.get("Named")).toEqual({
      href: "https://example.test/named",
      rel: "editorial noopener noreferrer",
      target: "author_profile"
    })
    expect(links.get("Self")).toEqual({
      href: "https://example.test/self",
      rel: "author",
      target: "_self"
    })
    expect(links.get("Parent")).toEqual({
      href: "https://example.test/parent",
      rel: "author",
      target: "_parent"
    })
    expect(links.get("Top")).toEqual({
      href: "https://example.test/top",
      rel: "author",
      target: "_top"
    })
    expect(links.get("HTTP")?.href).toBe("http://example.test/path")
    expect(links.get("E-post")?.href).toBe("mailto:editor@example.test")
    expect(links.get("Telefon")?.href).toBe("tel:+461234567")
    expect(links.get("Relativ")?.href).toBe("titlar/Ett-verk?x=1#del")
    expect(links.get("Legacy")?.href).toBe("/författare/StrindbergA/titlar")
    expect(links.get("Kodade avgränsare")?.href)
      .toBe("/safe/%3Fdel/%23avsnitt?view=1#part")

    for (const label of [
      "JS",
      "Kontroll",
      "Data",
      "Fil",
      "Anpassad",
      "Credentials",
      "Protokollrelativ",
      "Bakstreck",
      "Traversal",
      "Kodad traversal",
      "Frågeteckens-traversal",
      "Dubbelkodad fragment-traversal",
      "Felaktig kodning"
    ]) {
      expect(links.get(label)?.href, label).toBeNull()
    }
  })

  test("removes executable subtrees and dangerous attributes", () => {
    const output = sanitizeAuthorHtml(maliciousHtml)

    for (const probe of [
      "script-probe",
      "style-probe",
      "form-probe",
      "frame-probe",
      "object-probe",
      "svg-probe",
      "math-probe",
      "button-probe"
    ]) {
      expect(output, probe).not.toContain(probe)
    }
    expect(output).not.toMatch(/<(?:script|style|form|input|iframe|frame|object|embed|svg|math|button|img)\b/i)
    expect(output).not.toMatch(/\s(?:style|on\w+|srcdoc|ng-[\w-]+|data-ng-[\w-]+|v-[\w-]+|:[\w-]+|@[\w-]+)=/i)
  })

  test("returns identical output when sanitized repeatedly", () => {
    const once = sanitizeAuthorHtml(maliciousHtml)
    expect(sanitizeAuthorHtml(once)).toBe(once)
  })
})

describe("safe author profile view model", () => {
  const maliciousProfile = (): AuthorProfile => {
    const profile = structuredClone(strindbergAuthorProfile) as AuthorProfile
    profile.introduction_html = '<p onclick="ordinary-probe()">Ordinary intro</p><script>ordinary-raw</script>'
    profile.source_html = ['<i style="color:red">Ordinary source</i><svg>source-raw</svg>']
    if (!profile.portrait) throw new Error("Rich fixture must have an ordinary portrait")
    profile.portrait.caption_html = '<span onmouseover="bad()">Ordinary caption</span><style>caption-raw</style>'
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_html = '<p v-html="bad">Drama intro</p><form>drama-raw</form>'
    profile.dramawebben.source_html = ['<cite onclick="bad()">Drama source</cite><object>drama-source-raw</object>']
    if (!profile.dramawebben.portrait) throw new Error("Rich fixture must have a Dramawebben portrait")
    profile.dramawebben.portrait.caption_html = '<small style="bad">Drama caption</small><math>drama-caption-raw</math>'
    return profile
  }

  test("selects and sanitizes every ordinary display field", () => {
    const profile = maliciousProfile()
    const view = createAuthorProfileView(profile, "ordinary")

    expect(view).toEqual({
      authorId: "StrindbergA",
      fullName: "August Strindberg",
      lifespan: "1849-1912",
      introductionHtml: "<p>Ordinary intro</p>",
      introductionBy: "Gösta M. Bergman",
      sourceHtml: ["<i>Ordinary source</i>"],
      pseudonymNames: ["Härved Ulf", "Frater Sylvester"],
      otherNames: ["Johan August Strindberg", "August Strindberg d.y."],
      portrait: {
        url: "/red/forfattare/StrindbergA/StrindbergA_large.jpeg",
        captionHtml: "<span>Ordinary caption</span>"
      },
      searchUrl: "/s%C3%B6k?forfattare=StrindbergA&avancerad",
      audioUrl: "",
      mapUrl: profile.map_url,
      hasMore: true,
      relatedLinks: profile.related_links,
      encyclopediaLinks: profile.encyclopedia_links,
      hasOrdinaryIntroduction: true,
      hasDramawebben: true
    })
    expect(JSON.stringify(view)).not.toMatch(/ordinary-(?:probe|raw)|source-raw|caption-raw|onclick|onmouseover|style=/)
  })

  test("selects only Dramawebben portrait, sources, and a coherent introduction pair", () => {
    const profile = maliciousProfile()
    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe("<p>Drama intro</p>")
    expect(view.introductionBy).toBe("Dramawebbens redaktion")
    expect(view.sourceHtml).toEqual(["<cite>Drama source</cite>"])
    expect(view.portrait).toEqual({
      url: "/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg",
      captionHtml: "<small>Drama caption</small>"
    })
    expect(JSON.stringify(view)).not.toMatch(/drama-(?:raw|source-raw|caption-raw)|v-html|onclick|style=/)
  })

  test("falls back to ordinary introduction, byline, and sources as one branch when Dramawebben has none", () => {
    const profile = maliciousProfile()
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_html = null
    profile.dramawebben.introduction_by = {
      author_id: "WrongByline",
      full_name: "Must not survive fallback",
      surname: null
    }

    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe("<p>Ordinary intro</p>")
    expect(view.introductionBy).toBe("Gösta M. Bergman")
    expect(view.sourceHtml).toEqual(["<i>Ordinary source</i>"])
  })

  test("falls back to ordinary sources when the Dramawebben introduction is empty", () => {
    const profile = maliciousProfile()
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_html = ""

    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe("<p>Ordinary intro</p>")
    expect(view.sourceHtml).toEqual(["<i>Ordinary source</i>"])
  })

  test.each([
    ["removed script", "<script>Drama script</script>"],
    ["removed iframe", "<iframe>Drama frame</iframe>"],
    ["comment", "<!-- Drama comment -->"],
    ["empty wrapper", "<div><span></span><br></div>"],
    ["ASCII whitespace", "<p> \t\n\r </p>"],
    ["removed image", '<img src="/red/forfattare/StrindbergA/portrait.jpeg" alt="Drama">']
  ])("falls back from a sanitized-empty Dramawebben %s as one prose bundle", (
    _label,
    introductionHtml
  ) => {
    const profile = maliciousProfile()
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_html = introductionHtml
    const before = structuredClone(profile)

    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe("<p>Ordinary intro</p>")
    expect(view.introductionBy).toBe("Gösta M. Bergman")
    expect(view.sourceHtml).toEqual(["<i>Ordinary source</i>"])
    expect(view.portrait?.url).toBe(
      "/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg"
    )
    expect(profile).toEqual(before)
  })

  test.each([
    ["safe text", "<p>Drama text</p>", "<p>Drama text</p>"],
    ["escaped entity text", "<p>&amp;</p>", "<p>&amp;</p>"],
    ["non-breaking-space text", "<p>&nbsp;</p>", "<p>&#160;</p>"]
  ])("keeps the coherent Dramawebben bundle for %s", (
    _label,
    introductionHtml,
    expectedHtml
  ) => {
    const profile = maliciousProfile()
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_html = introductionHtml

    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe(expectedHtml)
    expect(view.introductionBy).toBe("Dramawebbens redaktion")
    expect(view.sourceHtml).toEqual(["<cite>Drama source</cite>"])
  })

  test.each([
    ["removed script", "<script>Ordinary script</script>", false],
    ["removed iframe", "<iframe>Ordinary frame</iframe>", false],
    ["comment", "<!-- Ordinary comment -->", false],
    ["empty wrapper", "<div><span></span><br></div>", false],
    ["ASCII whitespace", "<p> \t\n\r </p>", false],
    ["removed image", '<img src="/red/forfattare/StrindbergA/portrait.jpeg">', false],
    ["safe text", "<p>Ordinary text</p>", true],
    ["escaped entity text", "<p>&amp;</p>", true],
    ["non-breaking-space text", "<p>&nbsp;</p>", true]
  ])("derives ordinary navigation from sanitized meaningful %s", (
    _label,
    introductionHtml,
    expected
  ) => {
    const profile = maliciousProfile()
    profile.introduction_html = introductionHtml

    expect(createAuthorProfileView(profile, "ordinary").hasOrdinaryIntroduction).toBe(expected)
  })

  test("omits sanitized-empty sources while preserving meaningful order", () => {
    const profile = maliciousProfile()
    profile.source_html = [
      "<script>Removed source</script>",
      "<i>First source</i>",
      "<div><br></div>",
      "<p>&nbsp;</p>",
      "<cite>Last source</cite>"
    ]

    expect(createAuthorProfileView(profile, "ordinary").sourceHtml).toEqual([
      "<i>First source</i>",
      "<p>&#160;</p>",
      "<cite>Last source</cite>"
    ])
  })

  test("does not borrow the ordinary byline when a Dramawebben introduction has none", () => {
    const profile = maliciousProfile()
    if (!profile.dramawebben) throw new Error("Rich fixture must have a Dramawebben profile")
    profile.dramawebben.introduction_by = null

    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.introductionHtml).toBe("<p>Drama intro</p>")
    expect(view.introductionBy).toBe("")
  })

  test("uses the Dramawebben-only portrait and stable sparse defaults", () => {
    const profile = structuredClone(dramaOnlyAuthorProfile) as AuthorProfile
    const view = createAuthorProfileView(profile, "dramawebben")

    expect(view.lifespan).toBe("")
    expect(view.portrait).toEqual({
      url: "/red/forfattare/DramaOnly/DramaOnly_dw_large.jpeg",
      captionHtml: ""
    })
    expect(view.hasOrdinaryIntroduction).toBe(false)
    expect(view.hasDramawebben).toBe(true)
    expect(view.searchUrl).toBe("")
    expect(view.relatedLinks).toEqual([])
    expect(view.encyclopediaLinks).toEqual([])
  })

  test.each([
    ["/red/forfattare/StrindbergA/StrindbergA_large.jpeg", true],
    ["/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg", true],
    ["/red/forfattare/StrindbergA/StrindbergA_small.jpeg", true],
    ["/red/forfattare/StrindbergA/StrindbergA_large.jpg", true],
    ["https://evil.invalid/portrait.jpeg", false],
    ["data:image/jpeg;base64,evil", false],
    ["blob:https://litteraturbanken.se/portrait", false],
    ["//evil.invalid/portrait.jpeg", false],
    ["/red/forfattare/StrindbergA/portrait.jpeg\\evil", false],
    ["/red/forfattare/StrindbergA/portrait.jpeg\u0000", false],
    ["/red/forfattare/StrindbergA/portrait%255c.jpeg", false],
    ["/red/forfattare/StrindbergA/portrait%2500.jpeg", false],
    ["/red/forfattare/StrindbergA/portrait%ZZ.jpeg", false],
    ["/red/forfattare/StrindbergA/portrait.jpeg?download=1", false],
    ["/red/forfattare/StrindbergA/portrait.jpeg#caption", false],
    ["/red/forfattare/../portrait.jpeg", false],
    ["/red/forfattare/StrindbergA/portrait.svg", false],
    ["/red/other/StrindbergA/portrait.jpeg", false]
  ])("keeps only a same-origin author portrait asset: %s", (url, expectedPortrait) => {
    const profile = maliciousProfile()
    if (!profile.portrait) throw new Error("Rich fixture must have an ordinary portrait")
    profile.portrait.url = url
    profile.portrait.caption_html = "Caption belongs to the accepted image."

    expect(createAuthorProfileView(profile, "ordinary").portrait).toEqual(expectedPortrait
      ? {
          url,
          captionHtml: "Caption belongs to the accepted image."
        }
      : null)
  })

  test.each([
    ["/sok?forfattare=StrindbergA&avancerad", "StrindbergA", "/s%C3%B6k?forfattare=StrindbergA&avancerad"],
    ["/sök?avancerad&forfattare=O%27Neil%28A", "O'Neil(A", "/s%C3%B6k?avancerad&forfattare=O%27Neil%28A"],
    ["/sok?forfattare=Annan&avancerad", "StrindbergA", ""],
    ["/sok?avancerad", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA&forfattare=Annan&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA&avancerad&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA&avancerad=true", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA&avancerad&genre=drama", "StrindbergA", ""],
    ["/sok?forfattare=StrindbergA&avancerad#resultat", "StrindbergA", ""],
    ["https://evil.invalid/sok?forfattare=StrindbergA&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=%E0%A4%A&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=Strindberg%25ZZ&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=Strindberg\ud800A&avancerad", "StrindbergA", ""],
    ["/sok?forfattare=Bad%250AId&avancerad", "Bad%0AId", ""],
    ["/sok?forfattare=Bad%255cId&avancerad", "Bad%5cId", ""],
    ["/sok?forfattare=Bad%2525Id&avancerad", "Bad%25Id", ""],
    [`/sok?forfattare=StrindbergA&avancerad${"x".repeat(2_001)}`, "StrindbergA", ""],
    ["/bibliotek?forfattare=StrindbergA&avancerad", "StrindbergA", ""]
  ])("keeps only a relational internal search URL: %s", (
    searchUrl,
    authorId,
    expected
  ) => {
    const profile = maliciousProfile()
    profile.author_id = authorId
    profile.search_url = searchUrl

    if (validateAuthorRouteParam(authorId)) {
      expect(createAuthorProfileView(profile, "ordinary").searchUrl).toBe(expected)
    } else {
      expect(() => createAuthorProfileView(profile, "ordinary")).toThrow(TypeError)
    }
    expect(safeAuthorSearchHref(searchUrl, authorId)).toBe(expected)
  })

  test("copies validated profile links without rewriting their destinations", () => {
    const profile = maliciousProfile()
    const view = createAuthorProfileView(profile, "ordinary")

    expect(view.relatedLinks).toEqual(profile.related_links)
    expect(view.encyclopediaLinks).toEqual(profile.encyclopedia_links)
    expect(view.relatedLinks).not.toBe(profile.related_links)
    expect(view.encyclopediaLinks).not.toBe(profile.encyclopedia_links)
  })

  test("keeps only safe native destinations in both profile link groups", () => {
    const profile = maliciousProfile()
    const safeLinks = [
      { label: "Relativ", url: "/verk/legacy-only?tab=1#utgava" },
      { label: "Relativ suffix", url: "/verk/safe?next=../chapter#part/../note" },
      { label: "Kodade avgränsare", url: "/verk/%3Fdel/%23avsnitt?tab=1#utgava" },
      { label: "Intern", url: "/författare/StrindbergA/presentation" },
      { label: "HTTP", url: "http://example.test/author" },
      { label: "HTTPS", url: "https://example.test/author?tab=1#part" }
    ]
    const unsafeLinks = [
      { label: "JavaScript", url: "javascript:alert(1)" },
      { label: "Data", url: "data:text/html,unsafe" },
      { label: "Protokollrelativ", url: "//evil.example/author" },
      { label: "Kontrolltecken", url: "https://example.test/\u0000author" },
      { label: "Kodat kontrolltecken", url: "https://example.test/%00author" },
      { label: "Kodat query-kontrolltecken", url: "/safe?next=%250Aevil" },
      { label: "Kodat fragment-bakstreck", url: "/safe#part%255cevil" },
      { label: "Kodad traversal", url: "/safe/%2e%2e/author" },
      { label: "Dubbelkodad traversal", url: "/safe/%252e%252e/author" },
      { label: "Kodad protokollrelativ", url: "/%2f%2fevil.example/author" },
      { label: "Dubbelkodad protokollrelativ", url: "/%252f%252fevil.example/author" },
      { label: "Traversal efter frågetecken", url: "/safe/%3F/%2e%2e/author" },
      {
        label: "Dubbelkodad traversal efter fragment",
        url: "https://example.test/safe/%2523/%252e%252e/author"
      },
      { label: "Felaktig URL", url: "https://[::1" }
    ]
    profile.related_links = [...safeLinks, ...unsafeLinks]
    profile.encyclopedia_links = [...safeLinks, ...unsafeLinks]

    const view = createAuthorProfileView(profile, "ordinary")

    expect(view.relatedLinks).toEqual(safeLinks)
    expect(view.encyclopediaLinks).toEqual(safeLinks)
  })

  test("maps the strict more-content flag without coercing malformed provider values", () => {
    const withContent = structuredClone(strindbergAuthorProfile) as AuthorProfile
    const withoutContent = structuredClone(strindbergAuthorProfile) as AuthorProfile
    withoutContent.has_more = false
    const malformed = structuredClone(strindbergAuthorProfile) as unknown as {
      has_more: unknown
    }
    malformed.has_more = "true"

    expect(createAuthorProfileView(withContent, "ordinary").hasMore).toBe(true)
    expect(createAuthorProfileView(withoutContent, "ordinary").hasMore).toBe(false)
    expect(createAuthorProfileView(
      malformed as unknown as AuthorProfile,
      "ordinary"
    ).hasMore).toBe(false)
  })

  test.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "//evil.example/audio",
    "https://reader:secret@evil.example/audio"
  ])("drops an unsafe audio URL: %s", audioUrl => {
    const profile = maliciousProfile()
    profile.audio_url = audioUrl

    expect(createAuthorProfileView(profile, "ordinary").audioUrl).toBe("")
  })

  test("drops a credential-bearing author map URL", () => {
    const profile = maliciousProfile()
    profile.map_url = "https://reader:secret@evil.example/map"

    expect(createAuthorProfileView(profile, "ordinary").mapUrl).toBe("")
  })

  test("keeps a safe HTTP audio handoff", () => {
    const profile = maliciousProfile()
    profile.audio_url = "http://litteraturbanken.se/ljudochbild/author"

    expect(createAuthorProfileView(profile, "ordinary").audioUrl).toBe(profile.audio_url)
  })
})
