const CATEGORY_IDS = {
  performance: "performance",
  accessibility: "accessibility",
  bestPractices: "best-practices",
  seo: "seo"
}

function auditItems(result, auditId) {
  const audit = result?.audits?.[auditId]
  if (!audit) return undefined
  return Array.isArray(audit.details?.items) ? audit.details.items : []
}

function categoryScore(result, categoryId) {
  const score = result?.categories?.[categoryId]?.score
  return typeof score === "number" ? Math.round(score * 100) : undefined
}

export function evaluateLighthouseResult(result, budget) {
  const failures = []
  const categories = {}

  for (const [budgetKey, categoryId] of Object.entries(CATEGORY_IDS)) {
    const score = categoryScore(result, categoryId)
    categories[budgetKey] = score

    if (score === undefined) {
      failures.push(`Missing Lighthouse category: ${categoryId}`)
      continue
    }

    const minimum = budget[budgetKey]
    if (typeof minimum === "number" && score < minimum) {
      const label = budgetKey === "bestPractices"
        ? "Best Practices"
        : budgetKey[0].toUpperCase() + budgetKey.slice(1)
      failures.push(`${label} score ${score} is below budget ${minimum}`)
    }
  }

  const consoleItems = auditItems(result, "errors-in-console")
  const consoleErrors = consoleItems?.length
  if (consoleItems === undefined) {
    failures.push("Missing Lighthouse audit: errors-in-console")
  } else if (
    typeof budget.maxConsoleErrors === "number"
    && consoleErrors > budget.maxConsoleErrors
  ) {
    failures.push(
      `Console errors ${consoleErrors} exceed allowed maximum ${budget.maxConsoleErrors}`
    )
  }

  const networkItems = auditItems(result, "network-requests")
  const forbiddenAssetSubstrings = budget.forbiddenAssetSubstrings ?? []
  const forbiddenAssets = networkItems === undefined
    ? []
    : networkItems
        .map(item => item?.url)
        .filter(url => typeof url === "string")
        .filter(url => forbiddenAssetSubstrings.some(part => url.includes(part)))

  if (networkItems === undefined) {
    failures.push("Missing Lighthouse audit: network-requests")
  } else if (forbiddenAssets.length > 0) {
    failures.push(`Forbidden reader assets requested: ${forbiddenAssets.join(", ")}`)
  }

  return {
    failures,
    summary: {
      categories,
      consoleErrors,
      forbiddenAssets
    }
  }
}

export function evaluateLighthouseRuns(results, budget, expectedRuns) {
  const failures = []
  const summaries = []

  if (results.length !== expectedRuns) {
    failures.push(
      `Expected ${expectedRuns} Lighthouse runs but received ${results.length}`
    )
  }

  results.forEach((result, index) => {
    const evaluation = evaluateLighthouseResult(result, budget)
    summaries.push(evaluation.summary)
    failures.push(...evaluation.failures.map(failure => `Run ${index + 1}: ${failure}`))
  })

  return { failures, summaries }
}
