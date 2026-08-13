import { describe, expect, test } from "vitest"

import {
  canonicalNuxtHref,
  isNuxtInternalHref,
  safeNativeHref,
  validRouteSegment
} from "../../app/lib/internal-navigation"

const slaArticleIds = [
  "TextkritiskaRiktlinjer.html",
  "TextkritiskVerkstad.html",
  "OmSelmaLagerlofArkivet.html",
  "Introduktion.html",
  "Adaptioner.html",
  "ForeGostaBerling.html",
  "BrevOmGBS.html",
  "SprakandringarGBS.html",
  "AndringarGBS.html",
  "ForskningOchLitthist.html",
  "TextkritiskGBS.html",
  "ManuskriptGBS.html",
  "Oversattningar.html",
  "IllustrationerOchOmslag.html",
  "Recensioner.html",
  "OLintroduktion.html",
  "TextkritiskOL1894.html",
  "MsTillOL.html",
  "AboutTheSLagerlofArchive.html",
  "SelmaLagerlofShort.html",
  "SelmaLagerlofEnglish.html",
  "PublishedWorks.html",
  "ScholarlyEditions.html"
] as const

describe("canonical Nuxt navigation hrefs", () => {
  test.each([
    ["/författare/StrindbergA", "/f%C3%B6rfattare/StrindbergA"],
    [
      "/författare/Lagerl%C3%B6fS/titlar/Gosta?om-boken#dw",
      "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/Gosta?om-boken#dw"
    ],
    ["/f%C3%B6rfattare/StrindbergA", "/f%C3%B6rfattare/StrindbergA"],
    ["/sok?forfattare=StrindbergA&avancerad", "/s%C3%B6k?forfattare=StrindbergA&avancerad"],
    ["/sök?q=kyrka", "/s%C3%B6k?q=kyrka"],
    ["/bibliotek?sort=titlar", "/bibliotek?sort=titlar"],
    ["https://example.test/författare/Test", "https://example.test/författare/Test"],
    ["//cdn.example.test/file.pdf", "//cdn.example.test/file.pdf"]
  ])("normalizes %s without altering its query or fragment", (input, expected) => {
    expect(canonicalNuxtHref(input)).toBe(expected)
  })

  test.each([
    ["/", true],
    ["/bibliotek", true],
    ["/författare/Test", true],
    ["/f%C3%B6rfattare/Test", true],
    ["/författare/Test/titlar", true],
    ["/författare/Test/dramawebben", true],
    ["/författare/Test/biblinfo", true],
    ["/författare/Test/mer", true],
    ["/författare/Test/presentation", true],
    ["/författare/Test/bibliografi", true],
    ["/författare/Test/semer", true],
    ["/författare/LagerlöfS/omtexterna", true],
    ...slaArticleIds.map(articleId => [
      `/författare/LagerlöfS/omtexterna/${articleId}`,
      true
    ] as const),
    ["/författare/Test/titlar/Book", true],
    ["/författare/Test/titlar/Book/etext", true],
    ["/författare/Test/titlar/Book/faksimil", true],
    ["/författare/Test/titlar/Book/info", true],
    ["/författare/Test/titlar/Book/info/etext", true],
    ["/författare/Test/titlar/Book/info/faksimil", true],
    ["/författare/Test/titlar/Book/sida/-2/etext", true],
    ["/författare/Test/titlar/Book/sida/VII/faksimil", true],
    [`/författare/${"a".repeat(100)}`, true],
    [`/författare/Test/titlar/${"t".repeat(200)}`, true],
    [`/författare/Test/titlar/Book/sida/${"p".repeat(512)}/etext`, true],
    ["/editor/lb123/ix/4/e", true],
    ["/editor/lb123/ix/0/f", true],
    [`/editor/${"a".repeat(100)}/ix/9999999/f?ocr#page`, true],
    ["/id/lb123", true],
    ["/id/R%C3%B6da%20rummet?from=lookup#resultat", true],
    ["/id/L%C3%A4sning%20%26%20liv", true],
    ["/id/Title%2520Percent", true],
    ["/id/a%252Fb", true],
    ["/om/english.html", true],
    ["/presentationer/specialomraden/Strindberg.html", true],
    ["/om/statistik?period=2026#verk", true],
    ["/dramawebben/pjäser", true],
    ["/epub?visa=pdf", true],
    ["/s%C3%B6k?fras=kyrka", true],
    ["/bibliotek/", true],
    ["/om/ide/", true],
    ["/presentationer/", true],
    ["/författare/Test/titlar/", true],
    ["/editor/lb123/ix/4/etext", false],
    ["/editor/lb123/ix/-1/e", false],
    ["/editor/lb123/ix/not-a-number/f", false],
    ["/editor/%00/ix/1/e", false],
    ["/editor/bad%2Fid/ix/1/e", false],
    ["/editor/bad%5Cid/ix/1/e", false],
    [`/editor/${"a".repeat(101)}/ix/1/e`, false],
    ["/editor/lb123/ix/10000000/e", false],
    ["/forfattare", false],
    ["/forfattare/Test", false],
    ["/forfattare/Test/titlar/Book/sida/1/etext", false],
    ["/f%C3%B6rfattare", false],
    ["/författare/Test/legacy", false],
    ["/författare/Test/omtexterna", false],
    ["/författare/Test/presentation/extra", false],
    ["/författare/LagerlöfS/omtexterna/Unknown.html", false],
    ["/författare/Test/titlar/Book/pdf", false],
    ["/författare/Test/titlar/Book/epub", false],
    ["/författare/Test/titlar/Book/infopost", false],
    ["/författare/Test/titlar/Book/info/pdf", false],
    ["/författare/Test/titlar/Book/sida/1/pdf", false],
    ["/författare/Test/titlar/Book/sida/1/etext/extra", false],
    [`/författare/${"a".repeat(101)}`, false],
    [`/författare/Test/titlar/${"t".repeat(201)}`, false],
    [`/författare/Test/titlar/Book/sida/${"p".repeat(513)}/etext`, false],
    ["/författare/Test%2FExtra", false],
    ["/författare/Test%252FExtra", false],
    ["/författare/Test%00", false],
    ["/författare/Test\udfff", false],
    ["/författare/Test/titlar/Book%00", false],
    ["/författare/Test/titlar/Book/sida/1%2F2/etext", false],
    ["/hjalp", false],
    ["/kontakt", false],
    ["/statistik", false],
    ["/titlar", false],
    ["/nytt", false],
    ["/om/aktuellt", false],
    ["/p/s/Censur.html", false],
    ["/id/lb123/extra", false],
    ["/id/%00", false],
    ["/id/%5Cevil", false],
    ["/id/a%2Fb", false],
    [`/id/${"t".repeat(201)}`, false],
    ["/om/ide/extra", false],
    ["/presentationer/specialomraden/Strindberg.html/extra", false],
    [`/presentationer/specialomraden/${"x".repeat(508)}.html`, false],
    ["/presentationer/specialomraden/Dubbelkodad%252Ehtml", true],
    ["/dramawebben/pjas/legacy", false],
    ["/red/forfattare/Test/portrait.jpeg", false],
    ["/txt/epub/Test.epub", false],
    ["/export/faksimil/Test.pdf", false],
    ["/verk/legacy-only", false],
    ["/om/ide//", false],
    ["//cdn.example.test/file", false],
    ["https://example.test/path", false],
    ["mailto:test@example.test", false]
  ])("classifies %s as internal=%s", (value, expected) => {
    expect(isNuxtInternalHref(value)).toBe(expected)
  })
})

describe("safe native navigation hrefs", () => {
  test.each([
    ["/verk/legacy-only", "/verk/legacy-only"],
    ["/export/faksimil/Test.pdf?download=1#page=2", "/export/faksimil/Test.pdf?download=1#page=2"],
    ["https://example.test/book", "https://example.test/book"],
    ["http://example.test/book", "http://example.test/book"],
    ["javascript:alert(1)", null],
    ["data:text/html,unsafe", null],
    ["//evil.example/unsafe", null],
    ["/\\evil.example/unsafe", null],
    ["/%5Cevil.example/unsafe", null],
    [" https://example.test/book", null],
    ["https://user:secret@example.test/book", null],
    ["mailto:test@example.test", null],
    ["", null]
  ])("bounds %s to %s", (value, expected) => {
    expect(safeNativeHref(value)).toBe(expected)
  })
})

describe("internal route segments", () => {
  test.each([
    ["Book", 200, true],
    [".", 200, false],
    ["..", 200, false],
    ["Book%2FPart", 200, false],
    ["Book/Part", 200, false],
    ["Book\\Part", 200, false],
    [" Book", 200, false],
    ["x".repeat(201), 200, false]
  ])("classifies %s within maximum %i as safe=%s", (value, maximum, expected) => {
    expect(validRouteSegment(value, maximum)).toBe(expected)
  })
})
