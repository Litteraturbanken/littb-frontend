import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const root = fileURLToPath(new URL("../fixtures/presentation-content", import.meta.url))

const xhtmlFixtures = [
  {
    filename: "presentationerForfattare.html",
    sha256: "2b4d871bff256a40ed2a60fd96b79f27e738d94a0a4e322c035c6e0934cc0883",
    bytes: 30_375,
    markers: [
      "Presentationer och introduktioner",
      "/presentationer/specialomraden/Censur.html",
      "/presentationer/vandringar/VandringElam.html"
    ]
  },
  {
    filename: "Censur.html",
    sha256: "651238523002f2320e59df174cb52996f29538614c22568f20fac7da4dd44381",
    bytes: 45_990,
    markers: [
      "Censur och liknande ingrepp mot tryckta skrifter",
      "red/presentationer/specialomraden/AttLasaEnHandskrivenTillfallesdikt.pdf"
    ]
  },
  {
    filename: "Rostratt.html",
    sha256: "5d416e813d5e985a844e21d31815e61135c94f13000d6b7966790f572c05abc2",
    bytes: 3_317,
    markers: [
      "Rösträtt 1919",
      "/red/presentationer/specialomraden/Rostratt.css"
    ]
  },
  {
    filename: "Phosphoros.html",
    sha256: "2e8ae49839bc323382d3e29848559a19d97e01bba1f6cd9e09b6f2d41fd7b168",
    bytes: 6_230,
    markers: [
      "Den litterära tidskriften Phosphoros",
      "<style type=\"text/css\">",
      "/red/presentationer/specialomraden/Phosphorosbilder/1.jpeg",
      "/red/presentationer/specialomraden/Phosphorosbilder/2.jpeg"
    ]
  },
  {
    filename: "VandringElam.html",
    sha256: "2ba54bd6b3d6ebf58edb0c164311371c41a82008b06cfab619cf309f2bf8a85b",
    bytes: 16_893,
    markers: [
      "Såsom i en spegel",
      "app/style/litteraturbanken.css",
      "app/style/date.css"
    ]
  }
] as const

describe("Presentation content authority fixtures", () => {
  test.each(xhtmlFixtures)("$filename is the complete reviewed XHTML authority", async fixture => {
    const content = await readFile(resolve(root, fixture.filename))

    expect(createHash("sha256").update(content).digest("hex")).toBe(fixture.sha256)
    expect(content.byteLength).toBe(fixture.bytes)
    const text = content.toString("utf8")
    expect(text).toContain("<!DOCTYPE")
    expect(text).toContain("<body")
    for (const marker of fixture.markers) expect(text).toContain(marker)
  })

  test("the ordered background fixture locks wildcard, duplicate, and multi-class cases", async () => {
    const xml = await readFile(resolve(root, "backgrounds.xml"), "utf8")

    const firstExact = xml.indexOf('target="/presentationer/specialomraden/Rostratt.html"')
    const folderWildcard = xml.indexOf('target="/presentationer/specialomraden/*"')
    const lastExact = xml.lastIndexOf('target="/presentationer/specialomraden/Rostratt.html"')
    const globalWildcard = xml.indexOf('target="/presentationer/*"')
    expect(firstExact).toBeGreaterThan(-1)
    expect(firstExact).toBeLessThan(folderWildcard)
    expect(folderWildcard).toBeLessThan(lastExact)
    expect(lastExact).toBeLessThan(globalWildcard)
    expect(xml).toContain('class="add-border paper"')
    expect(xml).toContain('<style>html { background-color: #382a32; }</style>')
    expect(xml.match(/target="\/presentationer\/specialomraden\/Rostratt\.html"/g))
      .toHaveLength(2)
  })

  test.each([
    ["Rostratt.css", "97ac0c64c4059068524419c3c4987d6a39960b49588238a5cebc996faa393381"],
    ["phosphoros-1.jpeg", "362d7cf50e028d00fa7d709e6626435b68517476295fb3694d622a7932e88c14"],
    ["phosphoros-2.jpeg", "f9ad1d004903d4ec6847dac8a4bb30430c594ecf7cee37e37045502aa15d9827"],
    ["AttLasaEnHandskrivenTillfallesdikt.pdf", "3b0c6425c22e0e400aeb548961e3c7c606f640578816967766aa2852314fba19"],
    ["rostratt-a.jpg", "c51e43338cc56154eeec4199f979bcf6e23f48f01ff0d3f05eb7b73699165b04"],
    ["rostratt-b.jpg", "548c972f3e229c8a72e5b39f5ef582e1d22f6a2c0fd2345cefb67fd41ff42706"]
  ])("%s is the reviewed rendered asset", async (filename, sha256) => {
    const content = await readFile(resolve(root, filename))
    expect(createHash("sha256").update(content).digest("hex")).toBe(sha256)
    expect(content.byteLength).toBeGreaterThan(0)
  })

  test.each([
    ["app-style-litteraturbanken.css", ".content .author"],
    ["app-style-date.css", ".content > h1 + .author"],
  ])("%s is a deterministic runtime stylesheet", async (filename, marker) => {
    const content = await readFile(resolve(root, filename), "utf8")
    expect(content).toContain(marker)
    expect(content).toContain("PRESENTATION-FIXTURE")
  })
})
