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
