import { describe, expect, test } from "vitest"

import {
  isSafePopularEpub,
  isSafePopularWork
} from "../../app/lib/statistics-items"
import {
  malformedStatisticsRouteEpubs,
  malformedStatisticsRouteWorks,
  validStatisticsPercentEpub,
  validStatisticsPercentPdf,
  validStatisticsRouteWork
} from "../fixtures/statistics-data.mjs"

describe("Statistics ranking identities", () => {
  test.each(malformedStatisticsRouteWorks)(
    "drops a work whose $field contains a $character",
    ({ item }) => {
      expect(isSafePopularWork(item)).toBe(false)
    }
  )

  test.each(malformedStatisticsRouteEpubs)(
    "drops an EPUB whose profile author contains a $character",
    ({ item }) => {
      expect(isSafePopularEpub(item)).toBe(false)
    }
  )

  test("retains valid route siblings and percent-bearing encoded filenames", () => {
    expect(isSafePopularWork(validStatisticsRouteWork)).toBe(true)
    expect(isSafePopularWork(validStatisticsPercentPdf)).toBe(true)
    expect(isSafePopularEpub(validStatisticsPercentEpub)).toBe(true)
  })
})
