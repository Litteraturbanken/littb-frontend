import { describe, expect, test } from "vitest"

import {
  readerAuthorHref,
  readerHitHref,
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

  test("serializes query values safely while preserving insertion order", () => {
    expect(readerPageHref({
      author: "SöderbergH",
      title: "Doktor Glas",
      page: "-2",
      mediaType: "etext",
      query: {
        q: "glas & öga",
        hit: "1",
        return: "/sök?fras=doktor glas",
        tom: ""
      }
    })).toBe(
      "/författare/S%C3%B6derbergH/titlar/Doktor%20Glas/sida/-2/etext" +
      "?q=glas+%26+%C3%B6ga&hit=1&return=%2Fs%C3%B6k%3Ffras%3Ddoktor+glas&tom="
    )
  })

  test("builds hit links by replacing the page and absolute hit only", () => {
    expect(readerHitHref({
      author: "SöderbergH",
      title: "DoktorGlas",
      page: "-1",
      mediaType: "etext",
      hit: 4,
      query: {
        q: "doktor glas",
        hit: "3",
        lemma: "1",
        unknown: "bevara & koda"
      }
    })).toBe(
      "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
      "?q=doktor+glas&hit=4&lemma=1&unknown=bevara+%26+koda"
    )
  })
})
