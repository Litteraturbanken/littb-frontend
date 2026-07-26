import { parseHTML } from "linkedom"
import { describe, expect, test } from "vitest"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  authorProfilePath,
  createAuthorProfileView,
  formatAuthorYears,
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
  test("uses uppercase RFC3986 escapes for every encodeURIComponent exception", () => {
    expect(authorProfilePath("O'Neil!()*A"))
      .toBe("/f%C3%B6rfattare/O%27Neil%21%28%29%2AA")
  })

  test("encodes author and child segments into one canonical client path", () => {
    expect(authorProfilePath("O'Neil(A", "titlar", "Del!Ett"))
      .toBe("/f%C3%B6rfattare/O%27Neil%28A/titlar/Del%21Ett")
  })
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
    '<a href="/%ZZ/admin">Felaktig kodning</a>',
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
    expect(links.get("HTTP")?.href).toBe("http://example.test/path")
    expect(links.get("E-post")?.href).toBe("mailto:editor@example.test")
    expect(links.get("Telefon")?.href).toBe("tel:+461234567")
    expect(links.get("Relativ")?.href).toBe("titlar/Ett-verk?x=1#del")
    expect(links.get("Legacy")?.href).toBe("/författare/StrindbergA/titlar")

    for (const label of [
      "JS",
      "Kontroll",
      "Data",
      "Fil",
      "Anpassad",
      "Protokollrelativ",
      "Bakstreck",
      "Traversal",
      "Kodad traversal",
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
      searchUrl: "/sok?forfattare=StrindbergA&avancerad",
      audioUrl: "",
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

  test("falls back to the ordinary introduction and matching byline as one pair", () => {
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

  test("copies validated profile links without rewriting their destinations", () => {
    const profile = maliciousProfile()
    const view = createAuthorProfileView(profile, "ordinary")

    expect(view.relatedLinks).toEqual(profile.related_links)
    expect(view.encyclopediaLinks).toEqual(profile.encyclopedia_links)
    expect(view.relatedLinks).not.toBe(profile.related_links)
    expect(view.encyclopediaLinks).not.toBe(profile.encyclopedia_links)
  })
})
