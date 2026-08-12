import { describe, expect, test } from "vitest"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  hasAuthorWorksAboutContent,
  isAuthorWorksResponse,
  isInfopostTitle,
  orderedAuthorWorkActions
} from "../../app/lib/author-works"
import {
  authorWorksById,
  malformedAuthorWorksResponse,
  richAuthorWorks,
  sparseAuthorWorks
} from "../fixtures/author-works-data.mjs"

type AuthorWorksResponse = components["schemas"]["AuthorWorksResponse"]

describe("Author Works runtime contract", () => {
  test("accepts every generated fixture and rejects malformed or incomplete bodies", () => {
    for (const response of authorWorksById.values()) {
      expect(isAuthorWorksResponse(response), response.author.author_id).toBe(true)
    }
    expect(isAuthorWorksResponse(malformedAuthorWorksResponse)).toBe(false)
    expect(isAuthorWorksResponse(null)).toBe(false)
    expect(isAuthorWorksResponse({})).toBe(false)

    const missingSection = structuredClone(richAuthorWorks) as unknown as {
      authored_sections: unknown[]
    }
    missingSection.authored_sections.pop()
    expect(isAuthorWorksResponse(missingSection)).toBe(false)

    const impossibleAction = structuredClone(richAuthorWorks) as AuthorWorksResponse
    const firstAction = impossibleAction.authored_sections[0]!.items[0]!.actions[0]!
    Object.assign(firstAction, {
      kind: "read",
      media_type: "epub",
      download_filename: "book.epub"
    })
    expect(isAuthorWorksResponse(impossibleAction)).toBe(false)

    const wrongLabel = structuredClone(richAuthorWorks) as AuthorWorksResponse
    wrongLabel.authored_sections[0]!.label = "Provider-controlled heading"
    expect(isAuthorWorksResponse(wrongLabel)).toBe(false)

    const missingContributor = structuredClone(richAuthorWorks) as AuthorWorksResponse
    missingContributor.authored_sections[2]!.items[0]!.display_author = null
    expect(isAuthorWorksResponse(missingContributor)).toBe(false)
  })

  test.each([
    ["search URL", (body: AuthorWorksResponse) => { body.author.search_url = "https://evil.test/sok" }],
    ["audio URL", (body: AuthorWorksResponse) => { body.author.audio_url = "https://user:pass@evil.test/audio" }],
    ["map URL", (body: AuthorWorksResponse) => { body.author.map_url = "data:text/html,evil" }],
    ["portrait URL", (body: AuthorWorksResponse) => { body.author.portrait!.url = "//evil.test/portrait.jpeg" }],
    ["related URL", (body: AuthorWorksResponse) => { body.author.related_links[0]!.url = "javascript:alert(1)" }],
    ["encyclopedia URL", (body: AuthorWorksResponse) => { body.author.encyclopedia_links[0]!.url = "https://user:pass@evil.test/wiki" }],
    ["display-author URL", (body: AuthorWorksResponse) => {
      body.authored_sections[2]!.items[0]!.display_author!.url = "/författare/Annan"
    }],
    ["containing-author URL", (body: AuthorWorksResponse) => {
      body.authored_sections[1]!.items[0]!.containing_work!.author.url = "javascript:alert(1)"
    }],
    ["read action URL", (body: AuthorWorksResponse) => {
      body.authored_sections[0]!.items[0]!.actions[0]!.url = "javascript:alert(1)"
    }],
    ["infopost action URL", (body: AuthorWorksResponse) => {
      body.authored_sections[0]!.items[0]!.actions[4]!.url
        = "/dramawebben/pjäser?om-boken&authorid=StrindbergA&titlepath=RodaRummet&next=https://evil.test"
    }],
    ["EPUB action URL", (body: AuthorWorksResponse) => {
      body.authored_sections[0]!.items[0]!.actions[2]!.url
        = "/txt/epub/StrindbergA_RodaRummet.epub?next=https://evil.test"
    }],
    ["PDF action URL", (body: AuthorWorksResponse) => {
      body.authored_sections[0]!.items[0]!.actions[3]!.url = "/export/faksimil/%252e%252e/evil.pdf"
    }],
    ["title URL", (body: AuthorWorksResponse) => {
      body.authored_sections[0]!.items[0]!.title_url = "data:text/html,evil"
    }]
  ])("rejects the whole response for an unsafe %s", (_label, mutate) => {
    const body = structuredClone(richAuthorWorks) as AuthorWorksResponse
    mutate(body)
    expect(isAuthorWorksResponse(body)).toBe(false)
  })

  test.each([
    "javascript:alert(1)",
    "data:text/html,evil",
    "//evil.test/resource",
    "https://user:pass@evil.test/resource",
    "/safe\\evil",
    "/safe%250Aevil",
    "/safe/%3F/%2e%2e/private",
    "https://example.test/safe/%2523/%252e%252e/private",
    " https://litteraturbanken.se/resource",
    "https://%"
  ])("rejects hostile native-link form %s", url => {
    const related = structuredClone(richAuthorWorks) as AuthorWorksResponse
    related.author.related_links[0]!.url = url
    expect(isAuthorWorksResponse(related)).toBe(false)

    const encyclopedia = structuredClone(richAuthorWorks) as AuthorWorksResponse
    encyclopedia.author.encyclopedia_links[0]!.url = url
    expect(isAuthorWorksResponse(encyclopedia)).toBe(false)
  })

  test("preserves encoded delimiter data and literal URL suffixes in native links", () => {
    const body = structuredClone(richAuthorWorks) as AuthorWorksResponse
    body.author.related_links[0]!.url
      = "/safe/%3Fdel/%23avsnitt?view=1#section"
    body.author.encyclopedia_links[0]!.url
      = "https://example.test/safe/%3Fdel/%23avsnitt?view=1#section"

    expect(isAuthorWorksResponse(body)).toBe(true)
  })

  test("requires title destinations to correspond to a validated work action", () => {
    const unrelatedAbout = structuredClone(richAuthorWorks) as AuthorWorksResponse
    unrelatedAbout.authored_sections[0]!.items[0]!.title_url
      = "/författare/Annan/titlar/Annat/sida/1/etext?om-boken"
    expect(isAuthorWorksResponse(unrelatedAbout)).toBe(false)

    const mismatchedMedium = structuredClone(richAuthorWorks) as AuthorWorksResponse
    mismatchedMedium.authored_sections[0]!.items[0]!.actions[0]!.url
      = "/författare/StrindbergA/titlar/RodaRummet/sida/-1/faksimil"
    expect(isAuthorWorksResponse(mismatchedMedium)).toBe(false)
  })

  test("preserves encoded reserved characters inside validated route segments", () => {
    const body = structuredClone(sparseAuthorWorks) as AuthorWorksResponse
    const work = body.authored_sections[0]!.items[0]!
    const read = work.actions[0]!
    work.title_path = "Gosta?Berlings#Saga"
    read.url = "/författare/Lagerl%C3%B6fS/titlar/Gosta%3FBerlings%23Saga/sida/3/faksimil"
    work.title_url = `${read.url}?om-boken`
    expect(isAuthorWorksResponse(body)).toBe(true)
  })
})

describe("Author Works display helpers", () => {
  test("orders current Angular read links before download links", () => {
    const work = richAuthorWorks.authored_sections[0]!.items[0]!
    expect(orderedAuthorWorkActions(work.actions).map(action => action.media_type))
      .toEqual(["etext", "faksimil", "infopost", "epub", "pdf"])
  })

  test("does not mutate the generated API action order", () => {
    const work = richAuthorWorks.authored_sections[0]!.items[0]!
    const original = work.actions.map(action => action.media_type)
    orderedAuthorWorkActions(work.actions)
    expect(work.actions.map(action => action.media_type)).toEqual(original)
  })

  test("derives Texter om only from nonempty about sections", () => {
    expect(hasAuthorWorksAboutContent(richAuthorWorks)).toBe(true)
    expect(hasAuthorWorksAboutContent(sparseAuthorWorks)).toBe(false)
  })

  test("recognizes the infopost primary destination without hiding mixed-work years", () => {
    const infopost = structuredClone(
      richAuthorWorks.authored_sections[0]!.items[0]!
    ) as AuthorWorksResponse["authored_sections"][number]["items"][number]
    const infopostAction = infopost.actions.find(action => action.media_type === "infopost")!
    infopost.title_url = infopostAction.url
    expect(isInfopostTitle(infopost)).toBe(true)

    infopost.title_url = `${infopost.actions[0]!.url}?om-boken`
    expect(isInfopostTitle(infopost)).toBe(false)
  })
})
