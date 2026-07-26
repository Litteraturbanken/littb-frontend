const backendOrigin = process.env.LITTB_BACKEND_ORIGIN || "http://127.0.0.1:8000"
const nuxtOrigin = process.env.LITTB_NUXT_LIVE_ORIGIN || "http://127.0.0.1:3020"

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
    const url = `${backendOrigin.replace(/\/$/, "")}/v2/openapi.json`
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
    const url = `${nuxtOrigin.replace(/\/$/, "")}/_nuxt/@vite/client`
    const response = await getResponse("Nuxt", url)
    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("javascript")) {
        throw new Error(`Nuxt preflight failed: ${url} (unexpected content type)`)
    }
}

module.exports = async function nuxtLivePreflight() {
    await requireBackend()
    await requireNuxt()
}
