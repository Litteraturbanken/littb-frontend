import { describe, expect, test } from "vitest"

import {
  readerAuthorHref,
  readerPageHref
} from "../../app/lib/reader-routes"

describe("reader route links", () => {
  test("encodes every dynamic segment without encoding route separators", () => {
    expect(readerAuthorHref("Söderberg/H? #")).toBe(
      "/författare/S%C3%B6derberg%2FH%3F%20%23"
    )
    expect(readerPageHref({
      author: "Söderberg/H? #",
      title: "Doktor Glas/utkast",
      page: "-2?x#y/z",
      mediaType: "e/text"
    })).toBe(
      "/författare/S%C3%B6derberg%2FH%3F%20%23" +
      "/titlar/Doktor%20Glas%2Futkast" +
      "/sida/-2%3Fx%23y%2Fz/e%2Ftext"
    )
  })
})
