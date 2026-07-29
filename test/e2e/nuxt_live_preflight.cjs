const nuxtOrigin = (process.env.LITTB_NUXT_LIVE_ORIGIN || "http://127.0.0.1:3020")
    .replace(/\/$/, "")
const configuredBackendOrigin = process.env.LITTB_BACKEND_ORIGIN?.replace(/\/$/, "")

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
    await requireBackend()
    await requireNuxt()
}
