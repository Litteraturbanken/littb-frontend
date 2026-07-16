import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const root = fileURLToPath(new URL("../fixtures/home-content", import.meta.url))

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
})
