import { expect, test } from "@playwright/test"

const gitSha = "a".repeat(40)
const imageDigest = `sha256:${"b".repeat(64)}`

test("deployment identity exposes immutable values without image references", async ({ request }) => {
  const response = await request.get("/_deployment")

  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  expect(await response.json()).toEqual({
    schema_version: "lb.frontend.deployment.v1",
    environment: "stage",
    git_sha: gitSha,
    image_digest: imageDigest
  })
  expect(await response.text()).not.toContain("registry.example")
  expect(await response.text()).not.toContain("lb-frontend:")
})
