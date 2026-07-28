import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

import { parseHomeContent } from "../../app/lib/home-content"

async function loadParser(): Promise<typeof parseHomeContent> {
  return parseHomeContent
}

describe("Home editorial content parser", () => {
  test("returns only the final post-control-removal bytes", async () => {
    const parser = await loadParser()
    const link = '<link data-ng-href="{{\'/red/css/startsida.css?\' + cacheKiller()}}">'
    const image = '<img bkg-img color="#333" src="/red/background.jpg"></img>'
    const source = `<main>Före</main>${link}<p>Mitten</p>${image}<footer>Efter</footer>`
    const finalBody = "<main>Före</main><p>Mitten</p><footer>Efter</footer>"

    expect(parser(source).bodyHtml).toBe(finalBody)
  })

  test("removes only the two control-element source ranges from the frozen raw fragment", async () => {
    const parseHomeContent = await loadParser()
    const source = await readFile(
      fileURLToPath(new URL("../fixtures/home-content/startsida-ny.html", import.meta.url)),
      "utf8"
    )
    const expectedBody = source
      .replace('<link rel="stylesheet" data-ng-href="{{\'/red/css/startsida.css?\' + cacheKiller()}}">', "")
      .replace('<img bkg-img color="#333" src="/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"></img>', "")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: expectedBody,
      stylesheetPath: "/red/css/startsida.css",
      backgroundImagePath: "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg",
      backgroundColor: "#333"
    })
  })

  test("leaves arbitrary editorial bytes unchanged when controls are missing", async () => {
    const parseHomeContent = await loadParser()
    const source = "\n<div><li>Oregelbundet &amp; betrott</div></li>\n"

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: source,
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("byte-preserves control-like markup in comments, raw text, and editorial text", async () => {
    const parseHomeContent = await loadParser()
    const source = [
      '<!-- <link data-ng-href="{{\'/red/css/comment.css?\' + cacheKiller()}}"> -->',
      '<script>const example = `<img bkg-img color="#111" src="/red/comment.jpg"></img>`</script>',
      '<textarea><link data-ng-href="{{\'/red/css/textarea.css?\' + cacheKiller()}}"></textarea>',
      '<p>&lt;img bkg-img color="#222" src="/red/editorial.jpg"&gt;</p>'
    ].join("\n")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: source,
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("does not treat similarly named attributes as control attributes", async () => {
    const parseHomeContent = await loadParser()
    const source = [
      '<link editorial-data-ng-href="{{\'/red/css/editorial.css?\' + cacheKiller()}}">',
      '<img editorial-bkg-img color="#333" src="/red/editorial.jpg"></img>'
    ].join("\n")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: source,
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("removes only real control elements while preserving every surrounding byte", async () => {
    const parseHomeContent = await loadParser()
    const link = '<link editorial-data-ng-href="ignored" data-ng-href="{{\'/red/css/real.css?\' + cacheKiller()}}">'
    const image = '<img editorial-bkg-img bkg-img color="#123456" src="/red/real.jpg"></img>'
    const source = `before\n${link}\nmiddle\n${image}\nafter`

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "before\n\nmiddle\n\nafter",
      stylesheetPath: "/red/css/real.css",
      backgroundImagePath: "/red/real.jpg",
      backgroundColor: "#123456"
    })
  })

  test("removes recognized but malformed controls without applying their effects", async () => {
    const parseHomeContent = await loadParser()
    const source = [
      '<link rel="stylesheet" data-ng-href="not-an-angular-cache-expression">',
      '<img bkg-img color="red; background:url(https://example.test/x)" src="relative.jpg"></img>',
      "<p>Behåll exakt</p>"
    ].join("\n")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "\n\n<p>Behåll exakt</p>",
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test.each([
    "https://example.test/red/asset.css",
    "//example.test/red/asset.css",
    "/red/../asset.css",
    "/red/./asset.css",
    "/red/%2e%2e/asset.css",
    "/red/%2E%2E%2Fasset.css",
    "/red\\asset.css",
    "/red/css\\asset.css"
  ])("rejects unsafe control path %s", async unsafePath => {
    const parseHomeContent = await loadParser()
    const source = [
      `<link data-ng-href="{{'${unsafePath}?' + cacheKiller()}}">`,
      `<img bkg-img color="#333" src="${unsafePath}"></img>`,
      "<p>Innehåll</p>"
    ].join("\n")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "\n\n<p>Innehåll</p>",
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test.each([5, 8])("rejects traversal hidden behind %i encoding layers", async layers => {
    const parseHomeContent = await loadParser()
    let traversal = "%2e%2e"
    for (let layer = 1; layer < layers; layer += 1) traversal = encodeURIComponent(traversal)
    const unsafePath = `/red/${traversal}/asset.css`
    const source = `<link data-ng-href="{{'${unsafePath}?' + cacheKiller()}}">`

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "",
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("rejects paths whose decoding does not reach a fixed point within the bound", async () => {
    const parseHomeContent = await loadParser()
    let encodedPercent = "%25"
    for (let layer = 0; layer < 24; layer += 1) encodedPercent = encodeURIComponent(encodedPercent)
    const source = `<img bkg-img color="#333" src="/red/css/${encodedPercent}asset.jpg"></img>`

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "",
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("rejects control paths outside the bounded input length", async () => {
    const parseHomeContent = await loadParser()
    const source = `<link data-ng-href="{{'/red/css/${"a".repeat(5000)}.css?' + cacheKiller()}}">`

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "",
      stylesheetPath: null,
      backgroundImagePath: null,
      backgroundColor: null
    })
  })

  test("accepts canonical absolute paths rooted below /red/", async () => {
    const parseHomeContent = await loadParser()
    const source = [
      '<link data-ng-href="{{\'/red/css/startsida-ny.css?\' + cacheKiller()}}">',
      '<img src="/red/bilder/start%20bakgrund.jpg" color="#aabbcc" bkg-img></img>',
      "<p>Innehåll</p>"
    ].join("\n")

    expect(parseHomeContent(source)).toEqual({
      bodyHtml: "\n\n<p>Innehåll</p>",
      stylesheetPath: "/red/css/startsida-ny.css",
      backgroundImagePath: "/red/bilder/start%20bakgrund.jpg",
      backgroundColor: "#aabbcc"
    })
  })
})
