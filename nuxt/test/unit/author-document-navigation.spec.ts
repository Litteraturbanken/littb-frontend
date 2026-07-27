import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const documentPage = readFileSync(
  new URL("../../app/pages/författare/[author]/[document]/index.vue", import.meta.url),
  "utf8"
)
const articlePage = readFileSync(
  new URL("../../app/pages/författare/[author]/[document]/[article].vue", import.meta.url),
  "utf8"
)

describe.each([
  ["author document", documentPage],
  ["SLA article", articlePage]
])("%s authored navigation", (_label, source) => {
  test("uses canonical Nuxt navigation for internal author and search links", () => {
    expect(source).toContain(
      'import { canonicalNuxtHref } from "~/lib/internal-navigation"'
    )
    expect(source).toContain(
      '<NuxtLink :to="canonicalNuxtHref(rootHref)">Introduktion</NuxtLink>'
    )
    expect(source).toContain(
      '<NuxtLink :to="canonicalNuxtHref(titlesHref)">Verk</NuxtLink>'
    )
    expect(source).toContain(
      '<NuxtLink :to="canonicalNuxtHref(dramawebbenHref)">Dramawebben</NuxtLink>'
    )
    expect(source).toMatch(
      /<NuxtLink :to="canonicalNuxtHref\(page\.author\.searchUrl!?\)">Sök i texterna<\/NuxtLink>/u
    )
  })

  test("keeps external audio native and enhances managed source-document links", () => {
    expect(source).toMatch(
      /<a\s+:href="page\.author\.audioUrl!?"\s+target="_blank"\s+rel="noopener noreferrer"\s*>Ljud<\/a>/u
    )
    expect(source).toContain("const navigateManagedHtml = useManagedHtmlNavigation()")
    expect(source).toMatch(
      /<div\s+class="content unbox"(?=[^>]*v-html="page\.bodyHtml")(?=[^>]*@click="navigateManagedHtml")[^>]*\/>/u
    )
  })
})
