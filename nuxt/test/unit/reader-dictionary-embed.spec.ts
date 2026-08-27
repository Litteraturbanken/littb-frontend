import { describe, expect, test } from "vitest"

import {
  buildReaderDictionaryEmbedUrl,
  buildSvenskaDictionaryUrl,
  parseReaderLookupMessage,
  readerDictionaryMode,
  svenskaReaderEmbedOrigin
} from "../../app/lib/reader-dictionary-embed"

const requestId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"

describe("Reader dictionary embed configuration", () => {
  test.each([
    ["embed", "embed"],
    ["legacy", "legacy"],
    ["unexpected", "legacy"],
    [undefined, "legacy"],
    [null, "legacy"]
  ])("maps %j to the closed runtime mode %s", (value, expected) => {
    expect(readerDictionaryMode(value)).toBe(expected)
  })

  test.each([
    "https://svenska.se/path",
    "https://svenska.se/?q=hund",
    "https://svenska.se/#resultat",
    "https://user:secret@svenska.se",
    "http://svenska.se",
    "javascript:alert(1)",
    "not a URL"
  ])("rejects a non-production origin %s", (value) => {
    expect(svenskaReaderEmbedOrigin(value)).toBeNull()
  })

  test("accepts an HTTPS origin without retaining a root slash", () => {
    expect(svenskaReaderEmbedOrigin("https://svenska.se/"))
      .toBe("https://svenska.se")
  })

  test("allows HTTP only for explicit local development fixtures", () => {
    expect(svenskaReaderEmbedOrigin("http://127.0.0.1:4173", {
      allowLocalHttp: true
    })).toBe("http://127.0.0.1:4173")
    expect(svenskaReaderEmbedOrigin("http://localhost:4173", {
      allowLocalHttp: true
    })).toBe("http://localhost:4173")
    expect(svenskaReaderEmbedOrigin("http://svenska.example.test", {
      allowLocalHttp: true
    })).toBeNull()
  })

  test("builds only the fixed reader route with encoded query values", () => {
    expect(buildReaderDictionaryEmbedUrl({
      origin: "https://svenska.se",
      requestId,
      word: "förgås"
    })).toBe(
      `https://svenska.se/embed/reader?word=f%C3%B6rg%C3%A5s&requestId=${requestId}`
    )
  })

  test.each([
    ["för\u00ADgås", "f%C3%B6r%C2%ADg%C3%A5s"],
    ["ا\u200Cب", "%D8%A7%E2%80%8C%D8%A8"],
    ["ا\u200Dب", "%D8%A7%E2%80%8D%D8%A8"]
  ])("preserves Reader-safe format characters in %s", (word, encodedWord) => {
    expect(buildReaderDictionaryEmbedUrl({
      origin: "https://svenska.se",
      requestId,
      word
    })).toBe(
      `https://svenska.se/embed/reader?word=${encodedWord}&requestId=${requestId}`
    )
  })

  test.each([
    "två ord",
    "två\u00A0ord",
    "rad\nbyte",
    "null\u0000tecken",
    "c1\u0085tecken"
  ])("keeps Reader whitespace and control characters out of URLs", (word) => {
    expect(buildReaderDictionaryEmbedUrl({
      origin: "https://svenska.se",
      requestId,
      word
    })).toBeNull()
  })

  test.each([
    { origin: "https://svenska.se/search", requestId, word: "hund" },
    { origin: "https://svenska.se", requestId: "hund", word: "hund" },
    { origin: "https://svenska.se", requestId, word: "" }
  ])("refuses an invalid reader URL input", (options) => {
    expect(buildReaderDictionaryEmbedUrl(options)).toBeNull()
  })

  test("builds the fixed full-site dictionary fallback URL", () => {
    expect(buildSvenskaDictionaryUrl("https://svenska.se", "förgås"))
      .toBe("https://svenska.se/?q=f%C3%B6rg%C3%A5s&activeTab=alla&exactMatch=true")
  })
})

describe("Reader lookup message protocol", () => {
  test.each([
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "ready"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["so", "saob"],
      selectedDictionary: "so"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "empty"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "error"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "close"
    }
  ])("accepts a closed version-1 %s message", (message) => {
    expect(parseReaderLookupMessage(message)).toEqual(message)
  })

  test.each([
    null,
    [],
    { type: "other", version: 1, requestId, event: "ready" },
    { type: "svenska-reader-lookup", version: 2, requestId, event: "ready" },
    { type: "svenska-reader-lookup", version: 1, requestId: "not-a-uuid", event: "ready" },
    { type: "svenska-reader-lookup", version: 1, requestId, event: "loading" },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: { toString: () => "ready" }
    },
    { type: "svenska-reader-lookup", version: 1, requestId, event: "ready", word: "hund" },
    { type: "svenska-reader-lookup", version: 1, requestId, event: "empty", url: "https://example.test" },
    { type: "svenska-reader-lookup", version: 1, requestId, event: "error", html: "<p>error</p>" },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["so", "so"],
      selectedDictionary: "so"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["saol"],
      selectedDictionary: "saol"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["so"],
      selectedDictionary: "saob"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["so"],
      selectedDictionary: "so",
      detail: "private"
    },
    {
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "ready",
      dictionaries: ["so"]
    }
  ])("rejects a malformed or open-ended message %#", (message) => {
    expect(parseReaderLookupMessage(message)).toBeNull()
  })
})
