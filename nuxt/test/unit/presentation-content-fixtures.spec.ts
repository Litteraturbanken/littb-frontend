import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  baseParse,
  NodeTypes,
  type ElementNode,
  type RootNode,
  type TemplateChildNode
} from "@vue/compiler-dom"
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
      "/forfattare/StrindbergA/titlar/Giftas/sida/31/etext"
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
    filename: "FigurdiktenSomBarockBlandkonst.html",
    sha256: "65bf6c11778417fd126fddbfffb882c21ed7111c23adf31ab311c1c5baa47b34",
    bytes: 26_192,
    markers: [
      "Figurdikten som barock blandkonst",
      "Lars Burman",
      "Hieroglyphicum Poëticum"
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

function descendantElements(root: RootNode | ElementNode, tag: string): ElementNode[] {
  const matches: ElementNode[] = []
  const visit = (node: RootNode | TemplateChildNode) => {
    if (node.type === NodeTypes.COMMENT) return
    if (node.type === NodeTypes.ELEMENT && node.tag === tag) matches.push(node)
    if ("children" in node) for (const child of node.children) visit(child)
  }
  visit(root)
  return matches
}

function attribute(element: ElementNode, name: string): string | null {
  const match = element.props.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
  return match?.type === NodeTypes.ATTRIBUTE ? match.value?.content ?? "" : null
}

function renderedText(element: ElementNode): string {
  let text = ""
  const visit = (node: TemplateChildNode) => {
    if (node.type === NodeTypes.TEXT) text += node.content
    if ("children" in node) for (const child of node.children) visit(child)
  }
  for (const child of element.children) visit(child)
  return text
}

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

  test("the inline-style/image authority exposes active head and body semantics", async () => {
    const xhtml = await readFile(
      resolve(root, "FigurdiktenSomBarockBlandkonst.html"),
      "utf8"
    )
    const document = baseParse(xhtml)
    const [head] = descendantElements(document, "head")
    const [body] = descendantElements(document, "body")

    expect(head).toBeDefined()
    expect(body).toBeDefined()
    expect(descendantElements(head!, "link").map(link => attribute(link, "href"))).toEqual([
      "app/style/litteraturbanken.css",
      "app/style/date.css"
    ])
    expect(descendantElements(head!, "style").map(style => renderedText(style).trim())).toEqual([
      "p.image {text-align:center}"
    ])

    const activeDownload = descendantElements(body!, "a").find(anchor =>
      attribute(anchor, "href") ===
        "red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf"
    )
    expect(activeDownload).toBeDefined()
    expect(attribute(activeDownload!, "download")).toBe("")
    expect(attribute(activeDownload!, "target")).toBe("_self")
    expect(descendantElements(body!, "img").map(image => attribute(image, "src"))).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`
      )
    )
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
    ["Figurdiktensombarockblandkonst.pdf", "4b91c8cd2f47480027a65231cb62a22260fdc2324046f2da694f6f88735f00b1"],
    ["burman-1.jpg", "38c80e82ef5df8a22199ef24345279bc33b4b52033eb1ce694ea193943513578"],
    ["burman-2.jpg", "931ff1e71f0ab3a9463ebed63f564e4edf325feb9ff38d0eabf6308f231d2107"],
    ["burman-3.jpg", "70ac76365bea48ef335b3ec80588ca5a3b7883ec812f9300594309ee6c65d5ee"],
    ["burman-4.jpg", "c83ccf8fbd98099f3f7a563f04f3269472ebb426ea09a5e39d368c5e404c8183"],
    ["burman-5.jpg", "f8874d22e035d3a5f27448148c392b166454b0c0e64d7534c71b946deabb33d2"],
    ["burman-6.jpg", "1f482ba68f27a91d7260f866f7fff45f3106bf536b436cab6d9cd7de764390a8"],
    ["burman-7.jpg", "ca684556cdeb08b7572db17f80958ff4f7e4dfb9c5b97fe463d05869790d7ba8"],
    ["burman-8.jpg", "dfdc38b811fe0fe08ecc903682cfeb99059b0609e32056daa0acb26ec4d8c806"],
    ["burman-9.jpg", "a2b44acc45dc177d12953d08352f3089ef4345fbbf8cb7267ba69eae4521e4a9"],
    ["burman-10.jpg", "bf260fff7d529dccaebfed49a1bd1d980dcd63da7d2e85f9f24c096cba682874"],
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
