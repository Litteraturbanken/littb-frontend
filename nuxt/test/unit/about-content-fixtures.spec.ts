import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test, vi } from "vitest"

import { extractAboutBody } from "../../server/utils/about-content"
import { aboutContentPaths } from "../../shared/about-pages"
import {
  fetchManagedText,
  managedAboutTextRules
} from "../../shared/utils/managed-text"

const root = fileURLToPath(new URL("../fixtures/about-content", import.meta.url))

const htmlFixtures = {
  "ide.html": {
    sha256: "b64aa7dee0f33bed59986d145348161461b7e055d63466c57ef84036e71b5019",
    bytes: 25_963,
    bodyBytes: 25_360,
    bodySha256: "56733d87f8dbccfaa67d5602f6c108f288407b70b3732dfc2dccf076ccf4fe56",
    markers: ["Introduktion", "Om urvalet av texter", "Mål"]
  },
  "organisation.html": {
    sha256: "fe92a811175ff45ec9bb9cfa4ec5289eb8112d02a50ded4fdd509b72dd5e2467",
    bytes: 5_798,
    bodyBytes: 5_202,
    bodySha256: "abe9de7e96e1089f8bea47f4e413a7e219cc5621c99ea4f8e02fdc5df227f9a0",
    markers: ["Organisation", "Teknisk utveckling", "Tidigare medarbetare"]
  },
  "rattigheter.html": {
    sha256: "aaa38e151914fce00c734902ab088cb4da51915d8f7de23a1b5958800c5be3bc",
    bytes: 6_662,
    bodyBytes: 6_190,
    bodySha256: "ed1dce78a1fc321ba9c5e7015843417925060b0f566d78996e11e5e0af3a0c61",
    markers: ["Rättigheter och material", "Creative Commons", "Licenser på metadata"]
  },
  "tack.html": {
    sha256: "916a89214e8fb09c4ef5572608ca0550e2cbfffac35b6edf46004a52b700d317",
    bytes: 12_193,
    bodyBytes: 12_193,
    bodySha256: "916a89214e8fb09c4ef5572608ca0550e2cbfffac35b6edf46004a52b700d317",
    markers: ["Litteraturbanken tackar", "Kungl. biblioteket", "Uppsala universitetsbibliotek"]
  },
  "hjalp.html": {
    sha256: "4a22a93f3df4eb9d484e40737d8c53a18d71026d0c5de19475f31e09cdf9ff54",
    bytes: 25_654,
    bodyBytes: 25_161,
    bodySha256: "9f15a0607b127bbe2fe13b47fdb7abc37c78747a327e36b9069cdc332305ec8a",
    markers: ["Söka efter en text eller en författare", "Ljud &amp; bild", "Frågor och synpunkter"]
  },
  "mal.html": {
    sha256: "a6435d16dd1873085153de303c8f91f7d4da81ec5a6e34c745bb5fe151f650c2",
    bytes: 8_007,
    bodyBytes: 7_604,
    bodySha256: "939fb0b11fc314eca2ffcc7530e286448e56741018fb3cb6cac9ad6dbbb8e052",
    markers: ["Mål", "Digitaliseringen är också en fråga om demokrati", "Litteraturbanken, 2023"]
  },
  "english.html": {
    sha256: "83da377e4b1d28c4bd0a84c732762f30cbb8021ce650de7f09f0cc71f46f6755",
    bytes: 5_166,
    bodyBytes: 4_509,
    bodySha256: "a808ab4d4c1fbca47103f33503444e44f3b6c07328a5932b1ecdff6be6befb07",
    markers: ["The Swedish Literature Bank", "Board", "Technical developers"]
  },
  "deutsch.html": {
    sha256: "d1ad91210b1d95000908e2b68648e30004c226fe1d6ae6406e2292df02a2c182",
    bytes: 5_636,
    bodyBytes: 4_981,
    bodySha256: "d08541bc0d22a991d1efef3b0475f4f2592f54129290bfd5c5a381283209b164",
    markers: ["Die Schwedische Literaturbank", "Vorstand", "Technische Entwickler"]
  },
  "francais.html": {
    sha256: "ce8f869ab7b0a22bf38863c29db98456637014a8b9a6f62af2d8df733e08c962",
    bytes: 6_065,
    bodyBytes: 5_404,
    bodySha256: "cc0a5d295bd223ef6931cde98d8ade11e614afc21927f8928f4b861eb3f4a1bd",
    markers: ["La Banque de littérature suédoise", "Comité directeur", "Développement technique"]
  }
} as const

describe("About content authority fixtures", () => {
  test("body extraction ignores body-shaped text in the document head", () => {
    const source = [
      "<!doctype html><html><head>",
      '<script>const decoy = "<body>Wrong script body</body>"</script>',
      "<!-- <body>Wrong comment body</body> -->",
      '<meta data-decoy="<body>Wrong attribute body</body>">',
      '</head><body data-label="x > y"><main>Right editorial body</main></body></html>'
    ].join("")

    expect(extractAboutBody(source)).toBe("<main>Right editorial body</main>")
  })

  test("body extraction preserves a body-less editorial fragment byte for byte", () => {
    const source = "\n<section data-label=\"a > b\">Editorial &amp; exact</section>\n"

    expect(extractAboutBody(source)).toBe(source)
  })

  test("body extraction accepts the parser's implied close for an unclosed body", () => {
    expect(extractAboutBody("<html><head><title>Wrong</title></head><body>Editorial"))
      .toBe("Editorial")
  })

  for (const [filename, expected] of Object.entries(htmlFixtures)) {
    test(`${filename} is the reviewed authority response`, async () => {
      const content = await readFile(resolve(root, filename), "utf8")
      expect(createHash("sha256").update(content).digest("hex")).toBe(expected.sha256)
      expect(Buffer.byteLength(content)).toBe(expected.bytes)
      const bodyHtml = extractAboutBody(content)
      expect(Buffer.byteLength(bodyHtml)).toBe(expected.bodyBytes)
      expect(createHash("sha256").update(bodyHtml).digest("hex")).toBe(expected.bodySha256)
      for (const marker of expected.markers) expect(content).toContain(marker)
      expect(content).not.toMatch(/<script\b/i)
      expect(content).not.toMatch(/\son[a-z]+\s*=/i)
      expect(content).not.toMatch(/\bng-[a-z-]+\s*=/i)
    })
  }

  test.each([
    ["cc_by.png", "2d8a628333a76cfe484a2b9c01bca786fccf08d0010d4bffca2b38b29dd4ed0b"],
    ["cc_publicdomain.png", "ecd5dc29a28b8f01a064ba2dfede96e154e6d4f02848f5be1d51a080af62abcf"]
  ])("%s is the reviewed rendered asset", async (filename, sha256) => {
    const content = await readFile(resolve(root, filename))
    expect(createHash("sha256").update(content).digest("hex")).toBe(sha256)
  })

  test.each(aboutContentPaths)(
    "the named About rule accepts the canonical HTML path %s",
    async path => {
    const response = new Response("<body>Editorial</body>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    })
    Object.defineProperty(response, "url", { value: `https://assets.test${path}` })
    const fetcher = vi.fn<typeof fetch>(async () => response)

    await expect(fetchManagedText(
      `https://assets.test${path}`,
      managedAboutTextRules("https://assets.test"),
      fetcher
    )).resolves.toBe("<body>Editorial</body>")
    }
  )

  test("the About managed-text allowlist copies the immutable canonical page registry", () => {
    const first = managedAboutTextRules("https://assets.test")
    const second = managedAboutTextRules("https://assets.test")

    expect(first.allowedPaths).toEqual(aboutContentPaths)
    expect(first.allowedPaths).not.toBe(aboutContentPaths)
    expect(first.allowedPaths).not.toBe(second.allowedPaths)
    expect(Object.isFrozen(aboutContentPaths)).toBe(true)
    expect(() => (aboutContentPaths as string[]).push("/red/om/unsafe.html"))
      .toThrow(TypeError)

    ;(first.allowedPaths as string[]).push("/red/om/local-only.html")
    expect(second.allowedPaths).toEqual(aboutContentPaths)
    expect(aboutContentPaths).not.toContain("/red/om/local-only.html")
  })

  test("the named About rule rejects an undeclared sibling path", async () => {
    const response = new Response("<body>Undeclared</body>", {
      headers: { "content-type": "text/html" }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/red/om/ide/undeclared.html"
    })

    await expect(fetchManagedText(
      "https://assets.test/red/om/ide/undeclared.html",
      managedAboutTextRules("https://assets.test"),
      vi.fn<typeof fetch>(async () => response)
    )).rejects.toThrow("Managed text final path is not allowed")
  })
})
