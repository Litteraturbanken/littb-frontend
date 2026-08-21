import { pathToFileURL } from "node:url"

const publicStylesheetPath = "/red/css/etext.css"
const requestTimeoutMilliseconds = 10_000
const maximumPublicResourceBytes = 1024 * 1024
const maximumPublicResourceReadBytes = maximumPublicResourceBytes + 1

function invalidPublicResourceResponse() {
  throw new Error("Public resource preflight received an invalid response")
}

async function boundedResponseBytes(response) {
  if (response.body === null) return 0

  const reader = response.body.getReader()
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return bytes
      const remaining = maximumPublicResourceReadBytes - bytes
      bytes += Math.min(value.byteLength, remaining)
      if (value.byteLength > remaining || bytes > maximumPublicResourceBytes) {
        invalidPublicResourceResponse()
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

export async function checkPublicResource(origin) {
  let response
  try {
    response = await fetch(new URL(publicStylesheetPath, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMilliseconds)
    })
  } catch {
    throw new Error("Public resource preflight request failed")
  }

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (
    response.status < 200
    || response.status > 299
    || contentType !== "text/css"
  ) {
    invalidPublicResourceResponse()
  }

  const bytes = await boundedResponseBytes(response)
  if (bytes === 0) invalidPublicResourceResponse()

  return { bytes, contentType, status: response.status }
}

async function main() {
  try {
    const result = await checkPublicResource(process.env.PUBLIC_RESOURCE_ORIGIN ?? "")
    console.log(
      `Public resource preflight passed: status=${result.status} content_type=${result.contentType} bytes=${result.bytes}`
    )
  } catch {
    console.error("Public resource preflight failed")
    process.exitCode = 1
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
