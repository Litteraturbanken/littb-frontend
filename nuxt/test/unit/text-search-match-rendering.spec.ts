import { readFileSync } from "node:fs"
import { compile } from "@vue/compiler-dom"
import { parseHTML } from "linkedom"
import * as Vue from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, test } from "vitest"

// Compile the actual match cell so whitespace removal by Vue is covered too.
const source = readFileSync(new URL("../../app/pages/sök.vue", import.meta.url), "utf8")
const cell = source.match(/<td class="match\b[\s\S]*?<\/td>/)?.[0]
if (!cell) throw new Error("Search match cell not found")
const { code } = compile(cell, { mode: "function", prefixIdentifiers: true })
const render = new Function("Vue", code)(Vue)

describe("search match text", () => {
  for (const href of ["/reader", null]) {
    test.each([
      [["ge", "sig", "på"], "ge sig på"],
      [["frihet"], "frihet"]
    ])(`preserves word boundaries with href=${href}: %j`, async (words, expected) => {
      const app = Vue.createSSRApp({
        render,
        setup: () => ({
          row: { hit: { href, match: words.map(text => ({ text, punct: false })) } },
          readerHrefWithReturn: (value: string) => value,
          readerTargetUnavailableMessage: "Reader unavailable"
        })
      })
      app.component("NuxtLink", {
        props: ["to"],
        setup: (props, { slots }) => () => Vue.h("a", { href: props.to }, slots.default?.())
      })
      const { document } = parseHTML(await renderToString(app))
      document.querySelector(".sr-only")?.remove()
      expect(document.querySelector("td")?.textContent?.trim()).toBe(expected)
      expect(Boolean(document.querySelector("a"))).toBe(Boolean(href))
    })
  }
})
