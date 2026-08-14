import { describe, expect, test } from "vitest"

import {
  isSafePopularEpub,
  isSafePopularWork
} from "../../app/lib/statistics-items"
import {
  malformedStatisticsEpubFields,
  malformedStatisticsRouteEpubs,
  malformedStatisticsRouteWorks,
  malformedStatisticsWorkFields,
  validStatisticsPercentEpub,
  validStatisticsPercentPdf,
  validStatisticsPercentWorkTitleId,
  validStatisticsNullableEpub,
  validStatisticsNullableWork,
  validStatisticsPopulatedEpub,
  validStatisticsPopulatedWork,
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

  test.each(malformedStatisticsWorkFields)(
    "drops a work whose $field is $problem",
    ({ item }) => {
      expect(isSafePopularWork(item)).toBe(false)
    }
  )

  test.each(malformedStatisticsEpubFields)(
    "drops an EPUB whose $field is $problem",
    ({ item }) => {
      expect(isSafePopularEpub(item)).toBe(false)
    }
  )

  test("retains valid route siblings and percent-bearing encoded filenames", () => {
    expect(isSafePopularWork(validStatisticsRouteWork)).toBe(true)
    expect(isSafePopularWork(validStatisticsPercentPdf)).toBe(true)
    expect(isSafePopularWork(validStatisticsPercentWorkTitleId)).toBe(true)
    expect(isSafePopularWork(validStatisticsNullableWork)).toBe(true)
    expect(isSafePopularWork(validStatisticsPopulatedWork)).toBe(true)
    expect(isSafePopularEpub(validStatisticsPercentEpub)).toBe(true)
    expect(isSafePopularEpub(validStatisticsNullableEpub)).toBe(true)
    expect(isSafePopularEpub(validStatisticsPopulatedEpub)).toBe(true)
  })

  test("accepts exact display-text bounds and rejects the next character", () => {
    const epub = structuredClone(validStatisticsPopulatedEpub)
    epub.title = "T".repeat(20_000)
    epub.short_title = "S".repeat(20_000)
    epub.author.full_name = "F".repeat(2_000)
    epub.author.surname = "N".repeat(2_000)
    expect(isSafePopularEpub(epub)).toBe(true)

    for (const mutate of [
      (item: typeof epub) => { item.title += "T" },
      (item: typeof epub) => { item.short_title = `${item.short_title!}S` },
      (item: typeof epub) => { item.author.full_name += "F" },
      (item: typeof epub) => { item.author.surname = `${item.author.surname!}N` }
    ]) {
      const overlong = structuredClone(epub)
      mutate(overlong)
      expect(isSafePopularEpub(overlong)).toBe(false)
    }
  })

  test("accepts exact work display-text bounds and rejects the next character", () => {
    const work = structuredClone(validStatisticsPopulatedWork)
    work.title = "T".repeat(20_000)
    work.short_title = "S".repeat(20_000)
    work.author.full_name = "F".repeat(2_000)
    work.author.surname = "N".repeat(2_000)
    expect(isSafePopularWork(work)).toBe(true)

    for (const mutate of [
      (item: typeof work) => { item.title += "T" },
      (item: typeof work) => { item.short_title = `${item.short_title!}S` },
      (item: typeof work) => { item.author.full_name += "F" },
      (item: typeof work) => { item.author.surname = `${item.author.surname!}N` }
    ]) {
      const overlong = structuredClone(work)
      mutate(overlong)
      expect(isSafePopularWork(overlong)).toBe(false)
    }
  })

  test("accepts the exact work title identity bound and rejects the next character", () => {
    const work = structuredClone(validStatisticsPercentWorkTitleId)
    work.title_id = "I".repeat(200)
    expect(isSafePopularWork(work)).toBe(true)

    work.title_id += "I"
    expect(isSafePopularWork(work)).toBe(false)
  })
})
