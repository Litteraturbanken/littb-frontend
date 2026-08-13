import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test, vi } from "vitest"

import {
  fetchManagedText,
  managedHomeTextRules
} from "../../shared/utils/managed-text"

const root = fileURLToPath(new URL("../fixtures/home-content", import.meta.url))

function managedResponse(
  body: BodyInit | null,
  options: ResponseInit & { redirected?: boolean; url?: string } = {}
): Response {
  const {
    redirected = false,
    url = "https://assets.test/red/om/start/startsida-ny.html",
    ...init
  } = options
  const response = new Response(body, init)
  Object.defineProperties(response, {
    redirected: { value: redirected },
    url: { value: url }
  })
  return response
}

describe("Home content authority fixtures", () => {
  test("the complete raw fragment is the reviewed editorial authority", async () => {
    const content = await readFile(resolve(root, "startsida-ny.html"), "utf8")

    expect(createHash("sha256").update(content).digest("hex")).toBe(
      "d6b6c2c33c1043d6df34ee2d8dae9d5f612754546f51a7f78b5f9b7ef39d6688"
    )
    expect(Buffer.byteLength(content)).toBe(7_042)
    expect(content.startsWith(
      '<link rel="stylesheet" data-ng-href="{{\'/red/css/startsida.css?\' + cacheKiller()}}">\n' +
      '<img bkg-img color="#333" src="/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"></img>'
    )).toBe(true)
    for (const marker of [
      "Månadens tema",
      "Lärdomsstaden Uppsala",
      "Nytt i Biblioteket",
      "LITTERATURBANKEN stöds av",
      "Jan Gossaert"
    ]) expect(content).toContain(marker)
    expect(content).toContain('<div class="start_top_author"><li>Månadens tema</div><br>')
    expect(content).toContain('<ul class="news font-display">')
    expect(content).toContain('<ul class="start_footerinfo">')

    const bodyHtml = content
      .replace('<link rel="stylesheet" data-ng-href="{{\'/red/css/startsida.css?\' + cacheKiller()}}">', "")
      .replace('<img bkg-img color="#333" src="/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"></img>', "")
    expect(Buffer.byteLength(bodyHtml)).toBe(6_869)
    expect(createHash("sha256").update(bodyHtml).digest("hex")).toBe(
      "dcea5d084fb1dd3f6ca3d9ae7084a410b367a9e0c5d263bd21bc7c1ba49d0ea6"
    )
  })

  test.each([
    [
      "startsida.css",
      "80e9c19f1fcfa3c2364edcdad9755192e358000bab3449e78867fa9daccdb2ea"
    ],
    [
      "start_bkg_172_2026.jpg",
      "e3a36d33654320df4bbb81fb7c70b3cc716c8d9ed425d06547a4f52951e52922"
    ]
  ])("%s is the reviewed rendered asset", async (filename, sha256) => {
    const content = await readFile(resolve(root, filename))
    expect(createHash("sha256").update(content).digest("hex")).toBe(sha256)
    expect(content.length).toBeGreaterThan(0)
  })

  test("the named Home rule accepts the frozen HTML once through a same-authority redirect", async () => {
    const content = await readFile(resolve(root, "startsida-ny.html"))
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(managedResponse(null, {
        headers: { location: "/red/om/start/startsida-ny.html?fixture=redirected" },
        status: 302
      }))
      .mockResolvedValueOnce(managedResponse(content, {
        headers: {
          "content-length": String(content.byteLength),
          "content-type": "text/html; charset=utf-8"
        },
        url: "https://assets.test/red/om/start/startsida-ny.html?fixture=redirected"
      }))

    await expect(fetchManagedText(
      "https://assets.test/red/om/start/startsida-ny.html?fixture",
      managedHomeTextRules("https://assets.test"),
      fetcher
    )).resolves.toBe(content.toString("utf8"))
    expect(fetcher.mock.calls).toEqual([
      [
        "https://assets.test/red/om/start/startsida-ny.html?fixture",
        { redirect: "manual" }
      ],
      [
        "https://assets.test/red/om/start/startsida-ny.html?fixture=redirected",
        { redirect: "manual" }
      ]
    ])
  })

  test.each([
    [
      "wrong authority",
      "https://other.test/red/om/start/startsida-ny.html",
      "text/html",
      "Managed text final authority is not allowed"
    ],
    [
      "wrong protocol",
      "http://assets.test/red/om/start/startsida-ny.html",
      "text/html",
      "Managed text final protocol is not allowed"
    ],
    [
      "wrong path",
      "https://assets.test/red/om/start/startsida-ny-copy.html",
      "text/html",
      "Managed text final path is not allowed"
    ],
    [
      "wrong MIME",
      "https://assets.test/red/om/start/startsida-ny.html",
      "application/xhtml+xml",
      "Managed text content type is not allowed"
    ]
  ])("the named Home rule rejects a %s response", async (
    _label,
    url,
    contentType,
    expected
  ) => {
    const fetcher = vi.fn<typeof fetch>(async () => managedResponse("authority probe", {
      headers: { "content-type": contentType },
      redirected: true,
      url
    }))

    await expect(fetchManagedText(
      "https://assets.test/red/om/start/startsida-ny.html",
      managedHomeTextRules("https://assets.test"),
      fetcher
    )).rejects.toThrow(expected)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("the named Home rule rejects configured non-HTTP authority before requesting", async () => {
    const fetcher = vi.fn<typeof fetch>()

    await expect(fetchManagedText(
      "https://assets.test/red/om/start/startsida-ny.html",
      managedHomeTextRules("file:///tmp/editorial"),
      fetcher
    )).rejects.toThrow("Managed text configured authority is not allowed")
    expect(fetcher).not.toHaveBeenCalled()
  })

  test.each([
    ["declared", 8_193, new TextEncoder().encode("short")],
    ["actual", null, new TextEncoder().encode("x".repeat(8_193))]
  ])("the named Home rule rejects %s oversize", async (_label, length, body) => {
    const headers = new Headers({ "content-type": "text/html" })
    if (length !== null) headers.set("content-length", String(length))
    const fetcher = vi.fn<typeof fetch>(async () => managedResponse(body, { headers }))

    await expect(fetchManagedText(
      "https://assets.test/red/om/start/startsida-ny.html",
      managedHomeTextRules("https://assets.test"),
      fetcher
    )).rejects.toThrow("Managed text exceeds byte limit")
  })

  test("the named Home rule rejects malformed UTF-8", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => managedResponse(
      new Uint8Array([0xc3, 0x28]),
      { headers: { "content-type": "text/html" } }
    ))

    await expect(fetchManagedText(
      "https://assets.test/red/om/start/startsida-ny.html",
      managedHomeTextRules("https://assets.test"),
      fetcher
    )).rejects.toThrow(TypeError)
  })
})
