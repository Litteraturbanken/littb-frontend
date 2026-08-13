import { describe, expect, test } from "vitest"

import {
  readerAuthorHref,
  readerContentsHref,
  readerContentsIsOpen,
  readerContentsNeutralFullPath,
  readerDialogNeutralFullPath,
  readerFullPathWithFragment,
  readerFullPathWithQueryValue,
  readerHitHref,
  readerPartAuthorKey,
  readerPageFullPath,
  readerPageHref,
  readerSourceInfoHref,
  readerSourceInfoIsOpen,
  readerSourceInfoNeutralFullPath
} from "../../app/lib/reader-routes"

describe("reader route links", () => {
  test("encodes every dynamic segment without encoding route separators", () => {
    expect(readerAuthorHref("Söderberg/H? #")).toBe(
      "/f%C3%B6rfattare/S%C3%B6derberg%2FH%3F%20%23"
    )
    expect(readerAuthorHref("O'Neil!()*A")).toBe(
      "/f%C3%B6rfattare/O%27Neil%21%28%29%2AA"
    )
    expect(readerPageHref({
      author: "Söderberg/H? #",
      title: "Doktor Glas/utkast",
      page: "-2?x#y/z",
      mediaType: "e/text"
    })).toBe(
      "/f%C3%B6rfattare/S%C3%B6derberg%2FH%3F%20%23" +
      "/titlar/Doktor%20Glas%2Futkast" +
      "/sida/-2%3Fx%23y%2Fz/e%2Ftext"
    )
    expect(readerPageHref({
      author: "O'Neil!()*A",
      title: "Title'!()*A",
      page: "Page'!()*A",
      mediaType: "Media'!()*A"
    })).toBe(
      "/f%C3%B6rfattare/O%27Neil%21%28%29%2AA" +
      "/titlar/Title%27%21%28%29%2AA" +
      "/sida/Page%27%21%28%29%2AA/Media%27%21%28%29%2AA"
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
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/Doktor%20Glas/sida/-2/etext" +
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
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
      "?q=doktor+glas&hit=4&lemma=1&unknown=bevara+%26+koda"
    )
  })

  test("preserves repeated unknown values deterministically in page and hit links", () => {
    const query = {
      q: "doktor glas",
      hit: "1",
      return: ["första & värdet", "andra/värdet"],
      tom: ["", "sist"]
    }
    const serialized =
      "?q=doktor+glas&hit=1" +
      "&return=f%C3%B6rsta+%26+v%C3%A4rdet&return=andra%2Fv%C3%A4rdet" +
      "&tom=&tom=sist"

    expect(readerPageHref({
      author: "SöderbergH",
      title: "DoktorGlas",
      page: "-1",
      mediaType: "etext",
      query
    })).toBe(
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" + serialized
    )
    expect(readerHitHref({
      author: "SöderbergH",
      title: "DoktorGlas",
      page: "-3",
      mediaType: "etext",
      hit: 0,
      query
    })).toBe(
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
      serialized.replace("hit=1", "hit=0")
    )
  })
})

describe("Reader contents raw-query ownership", () => {
  test("merges only the client fragment into an SSR-captured raw full path", () => {
    const raw = "/reader?bare&space=a%20b&repeat=%2f&repeat=%2F#old"
    const normalizedClient = "/reader?bare=&space=a+b&repeat=%2F&repeat=%2F#next%20part"

    expect(readerFullPathWithFragment(raw, normalizedClient)).toBe(
      "/reader?bare&space=a%20b&repeat=%2f&repeat=%2F#next%20part"
    )
    expect(readerFullPathWithFragment(raw, normalizedClient.split("#")[0]!)).toBe(
      "/reader?bare&space=a%20b&repeat=%2f&repeat=%2F"
    )
  })

  test("replaces one query owner without normalizing unrelated bytes or its fragment", () => {
    const raw = "/reader?bare&plus=a+b&space=a%20b&storlek=3" +
      "&repeat=%2f&%73torlek=2&repeat=%2F#scan%20nine"

    expect(readerFullPathWithQueryValue(raw, "storlek", "4")).toBe(
      "/reader?bare&plus=a+b&space=a%20b&storlek=4" +
      "&repeat=%2f&repeat=%2F#scan%20nine"
    )
    expect(readerFullPathWithQueryValue("/reader#scan", "storlek", "4"))
      .toBe("/reader?storlek=4#scan")
  })

  test("gives repeated part authors occurrence-stable unique keys", () => {
    expect([
      readerPartAuthorKey("SöderbergH", 0),
      readerPartAuthorKey("SöderbergH", 1)
    ]).toEqual(["SöderbergH:0", "SöderbergH:1"])
  })

  test.each([
    [null, true],
    ["", true],
    ["1", false],
    [[null, null], false],
    [[null], false],
    [undefined, false]
  ])("parses the fail-closed contents value %j", (value, expected) => {
    expect(readerContentsIsOpen(value)).toBe(expected)
  })

  test("removes only decoded exact contents keys and preserves every other query byte", () => {
    const fullPath =
      "/f%C3%B6rfattare/A/titlar/T/sida/-2/etext" +
      "?bare&innehall&empty=&plus=a+b&percent=a%20b" +
      "&repeat=%2f&%69nnehall=1&repeat=%2F&innehall=&innehall=1" +
      "&Innehall&innehallx&%E0%A4%A=1#del?innehall"

    expect(readerContentsNeutralFullPath(fullPath)).toBe(
      "/f%C3%B6rfattare/A/titlar/T/sida/-2/etext" +
      "?bare&empty=&plus=a+b&percent=a%20b" +
      "&repeat=%2f&repeat=%2F&Innehall&innehallx&%E0%A4%A=1#del?innehall"
    )
  })

  test("appends one bare contents key after removing invalid and repeated prior values", () => {
    expect(readerContentsHref(
      "/författare/A/titlar/T/sida/-2/etext" +
      "?q=glas&hit=1&innehall=1&storlek=3&repeat=one&innehall&repeat=two#frag"
    )).toBe(
      "/författare/A/titlar/T/sida/-2/etext" +
      "?q=glas&hit=1&storlek=3&repeat=one&repeat=two&innehall#frag"
    )
  })

  test.each([
    ["/reader", "/reader?innehall"],
    ["/reader#frag", "/reader?innehall#frag"],
    ["/reader?innehall", "/reader?innehall"],
    ["/reader?innehall=&innehall=1#frag", "/reader?innehall#frag"]
  ])("builds a single bare contents href from %s", (fullPath, expected) => {
    expect(readerContentsHref(fullPath)).toBe(expected)
  })

  test("replaces only the canonical page segment and drops only contents state", () => {
    const corpus = "bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
    expect(readerPageFullPath(
      `/f%C3%B6rfattare/A/titlar/T/sida/-2/etext?${corpus}&innehall#del`,
      "ny sida/1"
    )).toBe(
      `/f%C3%B6rfattare/A/titlar/T/sida/ny%20sida%2F1/etext?${corpus}#del`
    )
  })

  test("keeps reordered search keys byte-for-byte in contents-neutral identity", () => {
    expect(readerContentsNeutralFullPath(
      "/reader?hit=2&x=1&q=glas&x=2&innehall&storlek=4"
    )).toBe("/reader?hit=2&x=1&q=glas&x=2&storlek=4")
  })
})

describe("Reader source-information raw-query ownership", () => {
  test.each([
    [null, true],
    ["", false],
    ["false", true],
    ["1", true],
    [[null], true],
    [[""], true],
    [[null, null], true],
    [[], true],
    [undefined, false],
    [false, false]
  ])("parses Angular-compatible source-information value %j", (value, expected) => {
    expect(readerSourceInfoIsOpen(value)).toBe(expected)
  })

  test("removes only decoded exact source-information keys byte-for-byte", () => {
    const fullPath =
      "/f%C3%B6rfattare/A/titlar/T/sida/-2/etext" +
      "?bare&om-boken&empty=&plus=a+b&percent=a%20b&repeat=%2f" +
      "&%6Fm-boken=1&repeat=%2F&om-boken=&om-boken=1" +
      "&innehall&Om-boken&om-bokenx&%E0%A4%A=1#del?om-boken"

    expect(readerSourceInfoNeutralFullPath(fullPath)).toBe(
      "/f%C3%B6rfattare/A/titlar/T/sida/-2/etext" +
      "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f" +
      "&repeat=%2F&innehall&Om-boken&om-bokenx&%E0%A4%A=1#del?om-boken"
    )
  })

  test("closing contents retains source-information state", () => {
    expect(readerContentsNeutralFullPath(
      "/reader?bare&innehall&om-boken=false&repeat=%2f#frag"
    )).toBe("/reader?bare&om-boken=false&repeat=%2f#frag")
  })

  test("adds one bare source-information key and switches away from contents", () => {
    expect(readerSourceInfoHref(
      "/reader?bare&innehall&om-boken=&plus=a+b&repeat=%2f" +
      "&%69nnehall=1&om-boken=false&repeat=%2F#frag%20part"
    )).toBe(
      "/reader?bare&plus=a+b&repeat=%2f&repeat=%2F&om-boken#frag%20part"
    )
  })

  test("adds one bare contents key and switches away from source information", () => {
    expect(readerContentsHref(
      "/reader?bare&om-boken&innehall=1&repeat=%2f" +
      "&%6Fm-boken=false&repeat=%2F#frag"
    )).toBe(
      "/reader?bare&repeat=%2f&repeat=%2F&innehall#frag"
    )
  })

  test("removes both transient Reader keys from neutral identity", () => {
    expect(readerDialogNeutralFullPath(
      "/reader?hit=2&om-boken&x=1&q=glas&innehall=&x=2&%6Fm-boken=1#frag"
    )).toBe("/reader?hit=2&x=1&q=glas&x=2#frag")
  })

  test.each([
    ["/reader", "/reader?om-boken"],
    ["/reader#frag", "/reader?om-boken#frag"],
    ["/reader?om-boken", "/reader?om-boken"],
    ["/reader?om-boken=&om-boken=1#frag", "/reader?om-boken#frag"]
  ])("builds a single bare source-information href from %s", (fullPath, expected) => {
    expect(readerSourceInfoHref(fullPath)).toBe(expected)
  })
})
