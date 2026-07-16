import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const root = fileURLToPath(new URL("../fixtures/about-content", import.meta.url))

const htmlFixtures = {
  "ide.html": {
    sha256: "b64aa7dee0f33bed59986d145348161461b7e055d63466c57ef84036e71b5019",
    markers: ["Introduktion", "Om urvalet av texter", "Mål"]
  },
  "organisation.html": {
    sha256: "fe92a811175ff45ec9bb9cfa4ec5289eb8112d02a50ded4fdd509b72dd5e2467",
    markers: ["Organisation", "Teknisk utveckling", "Tidigare medarbetare"]
  },
  "rattigheter.html": {
    sha256: "aaa38e151914fce00c734902ab088cb4da51915d8f7de23a1b5958800c5be3bc",
    markers: ["Rättigheter och material", "Creative Commons", "Licenser på metadata"]
  },
  "tack.html": {
    sha256: "916a89214e8fb09c4ef5572608ca0550e2cbfffac35b6edf46004a52b700d317",
    markers: ["Litteraturbanken tackar", "Kungl. biblioteket", "Uppsala universitetsbibliotek"]
  }
} as const

describe("About content authority fixtures", () => {
  for (const [filename, expected] of Object.entries(htmlFixtures)) {
    test(`${filename} is the reviewed authority response`, async () => {
      const content = await readFile(resolve(root, filename), "utf8")
      expect(createHash("sha256").update(content).digest("hex")).toBe(expected.sha256)
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
})
