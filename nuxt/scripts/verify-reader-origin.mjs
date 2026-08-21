import { pathToFileURL } from "node:url"

const readerStylesheetPath = "/txt/css/lb1728740-etext.css"
const requestTimeoutMilliseconds = 10_000
const maximumReaderStylesheetBytes = 1024 * 1024
const maximumReaderStylesheetReadBytes = maximumReaderStylesheetBytes + 1
const cssContentType = /^text\/css(?:;|$)/iu

function invalidReaderOriginResponse() {
  throw new Error("Reader origin preflight received an invalid response")
}

async function boundedResponseBytes(response) {
  if (response.body === null) return 0

  const reader = response.body.getReader()
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return bytes
      const remaining = maximumReaderStylesheetReadBytes - bytes
      bytes += Math.min(value.byteLength, remaining)
      if (value.byteLength > remaining || bytes > maximumReaderStylesheetBytes) {
        invalidReaderOriginResponse()
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

export async function checkReaderOrigin(origin) {
  let response
  try {
    response = await fetch(new URL(readerStylesheetPath, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMilliseconds)
    })
  } catch {
    throw new Error("Reader origin preflight request failed")
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (
    response.status < 200
    || response.status > 299
    || !cssContentType.test(contentType)
  ) {
    invalidReaderOriginResponse()
  }

  const bytes = await boundedResponseBytes(response)
  if (bytes === 0) invalidReaderOriginResponse()

  return { bytes, contentType, status: response.status }
}

async function main() {
  try {
    const result = await checkReaderOrigin(process.env.NUXT_READER_SOURCE_BASE ?? "")
    console.log(
      `Reader origin preflight passed: status=${result.status} content_type=${result.contentType} bytes=${result.bytes}`
    )
  } catch {
    console.error("Reader origin preflight failed")
    process.exitCode = 1
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
