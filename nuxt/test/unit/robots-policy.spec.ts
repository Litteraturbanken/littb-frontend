import { describe, expect, test } from "vitest"

import { deploymentRobotsPolicy } from "../../server/utils/robots-policy"

describe("deployment robots policy", () => {
  test("blocks only the explicit staging environment", () => {
    expect(deploymentRobotsPolicy("staging")).toEqual({
      responseHeader: "noindex, nofollow",
      body: "User-agent: *\nDisallow: /\n"
    })
  })

  test.each(["production", "development", undefined])(
    "keeps %s indexable for a future production deployment",
    (environment) => {
      expect(deploymentRobotsPolicy(environment)).toEqual({
        responseHeader: null,
        body: "User-agent: *\nAllow: /\n"
      })
    }
  )
})
