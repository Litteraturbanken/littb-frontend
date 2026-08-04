import { describe, expect, expectTypeOf, test } from "vitest"

import * as definitions from "../../server/utils/reader-source-info-definitions"
import * as facade from "../../server/utils/reader-source-info"
import * as projection from "../../server/utils/reader-source-info-projection"
import * as sanitizer from "../../server/utils/reader-source-info-sanitizer"
import type { ReaderSourceInfoStaticDefinitions } from "../../server/utils/reader-source-info"
import * as validation from "../../server/utils/reader-source-info-validation"

describe("Reader source-information facade", () => {
  test("preserves every public helper export after internal decomposition", () => {
    expect(Object.keys(facade).sort()).toEqual([
      "buildReaderSourceInfo",
      "clearReaderSourceInfoStaticCache",
      "fetchReaderSourceInfoStaticDefinitions",
      "fetchWorkSourceInfo",
      "loadCachedReaderSourceInfoStaticDefinitions",
      "loadReaderSourceInfo",
      "parseReaderSourceInfoRequest",
      "projectReaderSourceInfoLicense",
      "projectReaderSourceInfoProvenance",
      "resolveReaderSourceInfoAttributions",
      "sanitizeReaderSourceInfoHtml",
      "validateReaderSourceInfoResponse"
    ])
    expect(facade).toMatchObject({
      validateReaderSourceInfoResponse: validation.validateReaderSourceInfoResponse,
      parseReaderSourceInfoRequest: validation.parseReaderSourceInfoRequest,
      sanitizeReaderSourceInfoHtml: sanitizer.sanitizeReaderSourceInfoHtml,
      fetchReaderSourceInfoStaticDefinitions: definitions.fetchReaderSourceInfoStaticDefinitions,
      clearReaderSourceInfoStaticCache: definitions.clearReaderSourceInfoStaticCache,
      loadCachedReaderSourceInfoStaticDefinitions: definitions.loadCachedReaderSourceInfoStaticDefinitions,
      projectReaderSourceInfoProvenance: projection.projectReaderSourceInfoProvenance,
      projectReaderSourceInfoLicense: projection.projectReaderSourceInfoLicense,
      resolveReaderSourceInfoAttributions: projection.resolveReaderSourceInfoAttributions,
      buildReaderSourceInfo: projection.buildReaderSourceInfo
    })
  })

  test("preserves the public static-definitions type export", () => {
    expectTypeOf<ReaderSourceInfoStaticDefinitions>().toEqualTypeOf<{
      provenance: Record<string, definitions.ProvenanceDefinition>
      licenses: Record<string, string>
    }>()
  })
})
