import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const readerSource = readFileSync(
  new URL(
    "../../app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue",
    import.meta.url
  ),
  "utf8"
)
const linkSource = readFileSync(
  new URL("../../app/components/reader/ReaderDramawebbenLink.vue", import.meta.url),
  "utf8"
)

test("hydrates the Reader Dramawebben logo as Nuxt navigation", () => {
  expect(readerSource).toMatch(
    /<li v-if="reader\.hasDramawebben">\s*<LazyReaderDramawebbenLink\s*\/>\s*<\/li>/u
  )
  expect(linkSource).toMatch(/<NuxtLink[^>]*\bto="\/dramawebben"[^>]*\bno-prefetch/u)
  expect(linkSource).toContain('class="dw_logo"')
})

test("documents and retains the native ClientOnly SSR progressive-enhancement fallback", () => {
  expect(readerSource).toContain("Progressive-enhancement fallback: native before hydration")
  expect(readerSource).toMatch(
    /<template #fallback>[\s\S]*?<LazyReaderDramawebbenLink\s+v-if="reader\.hasDramawebben"\s+:client-navigation="false"/u
  )
  expect(linkSource).toMatch(/<a v-else href="\/dramawebben">[\s\S]*?class="dw_logo"/u)
})
