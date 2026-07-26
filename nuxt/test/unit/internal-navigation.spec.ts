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
    ["/bibliotek", true],
    ["/författare/Test", true],
    ["//cdn.example.test/file", false],
    ["https://example.test/path", false],
    ["mailto:test@example.test", false]
  ])("classifies %s as internal=%s", (value, expected) => {
    expect(isNuxtInternalHref(value)).toBe(expected)
  })
})
