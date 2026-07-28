import { describe, expect, test } from "vitest"

import {
  evaluateLighthouseResult,
  evaluateLighthouseRuns
} from "../../scripts/lighthouse-budget.mjs"

const passingResult = {
  categories: {
    performance: { score: 1 },
    accessibility: { score: 1 },
    "best-practices": { score: 1 },
    seo: { score: 1 }
  },
  audits: {
    "errors-in-console": {
      score: 1,
      details: { items: [] }
    },
    "network-requests": {
      score: 1,
      details: {
        items: [{ url: "http://127.0.0.1:3021/_nuxt/reader.js" }]
      }
    }
  }
}

const perfectBudget = {
  performance: 100,
  accessibility: 100,
  bestPractices: 100,
  seo: 100,
  maxConsoleErrors: 0,
  forbiddenAssetSubstrings: ["dramawebben", "vue-multiselect"]
}

describe("Lighthouse production budget", () => {
  test("normalizes Lighthouse category fractions to integer percentages", () => {
    const result = structuredClone(passingResult)
    result.categories.performance.score = 0.97

    const evaluation = evaluateLighthouseResult(result, {
      ...perfectBudget,
      performance: 97
    })

    expect(evaluation.failures).toEqual([])
    expect(evaluation.summary.categories).toEqual({
      performance: 97,
      accessibility: 100,
      bestPractices: 100,
      seo: 100
    })
  })

  test("reports missing categories and required diagnostic audits", () => {
    const result = structuredClone(passingResult)
    delete (result.categories as Record<string, unknown>).accessibility
    delete (result.audits as Record<string, unknown>)["errors-in-console"]

    const evaluation = evaluateLighthouseResult(result, perfectBudget)

    expect(evaluation.failures).toContain(
      "Missing Lighthouse category: accessibility"
    )
    expect(evaluation.failures).toContain(
      "Missing Lighthouse audit: errors-in-console"
    )
  })

  test("fails when the browser console contains errors", () => {
    const result = structuredClone(passingResult)
    result.audits["errors-in-console"].details.items = [
      { description: "Failed to load /red/css/etext.css" },
      { description: "Failed to load /txt/css/lb.css" }
    ]

    const evaluation = evaluateLighthouseResult(result, perfectBudget)

    expect(evaluation.failures).toContain(
      "Console errors 2 exceed allowed maximum 0"
    )
    expect(evaluation.summary.consoleErrors).toBe(2)
  })

  test("reports reader-unrelated assets from the request graph", () => {
    const result = structuredClone(passingResult)
    result.audits["network-requests"].details.items.push({
      url: "http://127.0.0.1:3021/_nuxt/dramawebben-background.jpg"
    })

    const evaluation = evaluateLighthouseResult(result, perfectBudget)

    expect(evaluation.failures).toContain(
      "Forbidden reader assets requested: http://127.0.0.1:3021/_nuxt/dramawebben-background.jpg"
    )
    expect(evaluation.summary.forbiddenAssets).toEqual([
      "http://127.0.0.1:3021/_nuxt/dramawebben-background.jpg"
    ])
  })

  test("requires every requested run to pass independently", () => {
    const oneRun = evaluateLighthouseRuns([passingResult], perfectBudget, 3)
    expect(oneRun.failures).toContain(
      "Expected 3 Lighthouse runs but received 1"
    )

    const failingResult = structuredClone(passingResult)
    failingResult.categories.performance.score = 0.99
    const threeRuns = evaluateLighthouseRuns(
      [passingResult, failingResult, passingResult],
      perfectBudget,
      3
    )

    expect(threeRuns.failures).toContain(
      "Run 2: Performance score 99 is below budget 100"
    )
  })
})
