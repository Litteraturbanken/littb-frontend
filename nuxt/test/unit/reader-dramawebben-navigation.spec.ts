import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const source = readFileSync(
  new URL(
    "../../app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue",
    import.meta.url
  ),
  "utf8"
)

test("hydrates the Reader Dramawebben logo as Nuxt navigation", () => {
  expect(source).toMatch(
    /<li v-if="reader\.hasDramawebben">\s*<NuxtLink(?=[^>]*\bto="\/dramawebben")[^>]*><img[\s\S]*?class="dw_logo"[\s\S]*?<\/NuxtLink>\s*<\/li>/u
  )
})

test("documents and retains the native ClientOnly SSR progressive-enhancement fallback", () => {
  expect(source).toContain("Progressive-enhancement fallback: native before hydration")
  expect(source).toMatch(
    /<template #fallback>[\s\S]*?<a v-if="reader\.hasDramawebben" href="\/dramawebben"><img[\s\S]*?class="dw_logo"/u
  )
})
