import { describe, expect, test } from "vitest"

import {
  canonicalNuxtHref,
  isNuxtInternalHref
} from "../../app/lib/internal-navigation"

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
    ["/editor/lb123/ix/4/e", true],
    ["/editor/lb123/ix/0/f", true],
    ["/id/lb123", true],
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
    ["/forfattare", false],
    ["/f%C3%B6rfattare", false],
    ["/hjalp", false],
    ["/kontakt", false],
    ["/statistik", false],
    ["/titlar", false],
    ["/nytt", false],
    ["/om/aktuellt", false],
    ["/p/s/Censur.html", false],
    ["/id/lb123/extra", false],
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
