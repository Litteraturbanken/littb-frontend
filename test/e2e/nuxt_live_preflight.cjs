const { isDeepStrictEqual } = require("node:util")

const nuxtOrigin = (process.env.LITTB_NUXT_LIVE_ORIGIN || "http://127.0.0.1:3020")
    .replace(/\/$/, "")
const configuredBackendOrigin = process.env.LITTB_BACKEND_ORIGIN?.replace(/\/$/, "")
const expectedGitSha = process.env.LITTB_EXPECTED_GIT_SHA
const expectedImageDigest = process.env.LITTB_EXPECTED_IMAGE_DIGEST

if (Boolean(expectedGitSha) !== Boolean(expectedImageDigest)) {
    throw new Error(
        "LITTB_EXPECTED_GIT_SHA and LITTB_EXPECTED_IMAGE_DIGEST must be set together"
    )
}

async function getResponse(label, url) {
    let response
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    } catch (error) {
        throw new Error(`${label} preflight failed: ${url} (${error.message})`)
    }
    if (!response.ok) {
        throw new Error(`${label} preflight failed: ${url} (HTTP ${response.status})`)
    }
    return response
}

async function requireBackend() {
    const url = configuredBackendOrigin
        ? `${configuredBackendOrigin}/v2/openapi.json`
        : `${nuxtOrigin}/api/v2/openapi.json`
    const response = await getResponse("Backend", url)
    let schema
    try {
        schema = await response.json()
    } catch (error) {
        throw new Error(`Backend preflight failed: ${url} (${error.message})`)
    }
    if (
        !schema || typeof schema !== "object" || typeof schema.openapi !== "string" ||
        !schema.paths || typeof schema.paths !== "object" ||
        !("/dictionary/articles" in schema.paths)
    ) {
        throw new Error(`Backend preflight failed: ${url} (required v2 contract missing)`)
    }
}

async function requireDeploymentIdentity() {
    if (!expectedGitSha || !expectedImageDigest) return

    const url = `${nuxtOrigin}/_deployment`
    const response = await getResponse("Nuxt deployment identity", url)
    let identity
    try {
        identity = await response.json()
    } catch (error) {
        throw new Error(
            `Nuxt deployment identity preflight failed: ${url} (${error.message})`
        )
    }
    const expectedIdentity = {
        schema_version: "lb.frontend.deployment.v1",
        environment: "stage",
        git_sha: expectedGitSha,
        image_digest: expectedImageDigest
    }
    if (!isDeepStrictEqual(identity, expectedIdentity)) {
        throw new Error(`Nuxt deployment identity mismatch: ${url}`)
    }
}

async function requireNuxt() {
    const url = `${nuxtOrigin}/`
    const response = await getResponse("Nuxt", url)
    const contentType = response.headers.get("content-type") || ""
    const html = await response.text()
    if (!contentType.includes("text/html") || !html.includes('id="__nuxt"')) {
        throw new Error(`Nuxt preflight failed: ${url} (hydration shell missing)`)
    }
}

module.exports = async function nuxtLivePreflight() {
    await requireDeploymentIdentity()
    await requireBackend()
    await requireNuxt()
}
