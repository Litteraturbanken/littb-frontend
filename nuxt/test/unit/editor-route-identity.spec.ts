import { describe, expect, test } from "vitest"

import { isEditorRouteIdentity } from "#shared/utils/editor-route-identity"

describe("Editor route identities", () => {
  test.each([
    ["lb-editor-123", "0", "f", true],
    ["lb_editor-123", "1", "e", true],
    ["a".repeat(100), "9999999", "f", true],
    ["", "1", "f", false],
    [" ", "1", "f", false],
    ["bad/id", "1", "f", false],
    [null, "1", "f", false],
    ["a".repeat(101), "1", "f", false],
    ["lb-editor-123", "00000000", "f", false],
    ["lb-editor-123", "01", "f", false],
    ["lb-editor-123", "-1", "f", false],
    ["lb-editor-123", null, "f", false],
    ["lb-editor-123", "1", "etext", false]
  ])("accepts %j / %j / %j = %j", (workId, index, mediaType, expected) => {
    expect(isEditorRouteIdentity(workId, index, mediaType)).toBe(expected)
  })
})
