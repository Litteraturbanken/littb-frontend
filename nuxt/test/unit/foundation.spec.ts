import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const legacyRoot = resolve(nuxtRoot, "..")

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(path) : [path]
    })
  )
  return nested.flat().filter(path => [".ts", ".vue", ".js", ".mjs"].includes(extname(path)))
}

function normalizedScss(source: string): string {
  return source.replace(/[ \t]+$/gmu, "")
}

function replaceExactlyOnce(source: string, before: string, after: string): string {
  expect(source.split(before)).toHaveLength(2)
  return source.replace(before, after)
}

function mechanicallyOwnedStyles(legacy: string): string {
  const mainnavBefore = `    text-align : right;
    text-transform: uppercase;
    .sla {`
  const mainnavAfter = `    text-align : right;
    text-transform: uppercase;
    > li > a {
        box-sizing: border-box;
        display: block;
        min-height: 24px;
    }
    .sla {`
  const transformations: ReadonlyArray<readonly [string, string]> = [
    ['@use "mixins" as *;', '@use "mixins" as *;\n@use "focus";'],
    ["\n:focus {\n    outline: none;\n}\n", ""],
    ["input:focus, button.btn:focus", "input:focus:not(:focus-visible), button.btn:focus:not(:focus-visible)"],
    [
      `    .btn:active, .btn.active {
        box-shadow: none;
        /* border: 2px inset #7a1400; */`,
      `    .btn:active, .btn.active {
        /* border: 2px inset #7a1400; */`
    ],
    [
      `        border-color: #333;
    }

    .checks {`,
      `        border-color: #333;
    }
    .btn:active:not(:focus-visible), .btn.active:not(:focus-visible) {
        box-shadow: none;
    }

    .checks {`
    ],
    [
      `                &.active {
                    box-shadow: none;
                    background-color: var(--primary-color) !important;
                    color : white;
                }
                &:focus {`,
      `                &.active {
                    background-color: var(--primary-color) !important;
                    color : white;
                }
                &.active:not(:focus-visible) {
                    box-shadow: none;
                }
                &:focus:not(:focus-visible) {`
    ],
    [
      `        border: 1px solid #999;
        outline: none;
    }
    .auth_select_container {`,
      `        border: 1px solid #999;
    }
    input.filter:not(:focus-visible) {
        outline: none;
    }
    .auth_select_container {`
    ],
    [mainnavBefore, mainnavAfter],
    [
      'background-image: url("../img/dramawebben.jpg") !important;',
      "background-image: var(--dramawebben-background-image, none) !important;"
    ],
    [
      'background-image: url("../img/dramawebben_fade.jpg") !important;',
      "background-image: var(--dramawebben-subpage-background-image, none) !important;"
    ]
  ]

  return transformations.reduce(
    (source, [before, after]) => replaceExactlyOnce(source, before, after),
    legacy
  )
}

function exactReaderPartition(owned: string): string {
  const pageStart = owned.indexOf("\n.page-start {\n")
  const license = owned.indexOf("\n.license img {\n")
  const history = owned.indexOf("\n.page-history {\n")
  const sharedImports = owned.indexOf('\n@include meta.load-css("modals");')
  expect([pageStart, license, history, sharedImports].every(index => index >= 0)).toBe(true)
  return owned.slice(0, pageStart)
    + owned.slice(license, history)
    + owned.slice(sharedImports + 1)
}

describe("standalone Nuxt foundation", () => {
  test("pins the parity stack without Angular", async () => {
    const manifest = JSON.parse(await readFile(resolve(nuxtRoot, "package.json"), "utf8"))
    expect(manifest.dependencies.nuxt).toBe("4.4.8")
    expect(manifest.dependencies["openapi-fetch"]).toBe("0.17.0")
    expect(manifest.devDependencies.tailwindcss).toBe("3.4.18")
    expect(manifest.dependencies.angular).toBeUndefined()
    expect(manifest.dependencies["@headlessui/vue"]).toBe("1.7.23")
  })

  test("keeps the exact mechanically transformed legacy and Reader CSS partitions", async () => {
    const legacy = normalizedScss(
      await readFile(resolve(legacyRoot, "app/styles/styles.scss"), "utf8")
    )
    const owned = normalizedScss(
      await readFile(resolve(nuxtRoot, "app/assets/styles/styles.scss"), "utf8")
    )
    const reader = normalizedScss(
      await readFile(resolve(nuxtRoot, "app/assets/styles/reader-base.scss"), "utf8")
    )

    expect(owned).toBe(mechanicallyOwnedStyles(legacy))
    expect(reader).toBe(exactReaderPartition(owned))
  })

  test("owns the about background and the five required Requiem faces", async () => {
    const background = await readFile(
      resolve(nuxtRoot, "public/assets/img/backgrounds/about_bkg.jpg")
    )
    expect(createHash("sha256").update(background).digest("hex")).toBe(
      "4cee371c1563f34be963587ec894c0ead65cc46e83d662785ece3b575eb49e92"
    )

    for (const filename of [
      "RequiemText-HTF-Roman.otf",
      "RequiemText-HTF-Italic.otf",
      "RequiemText-HTF-SmallCaps.otf",
      "RequiemDisplay-HTF-Roman.otf",
      "RequiemDisplay-HTF-Italic.otf"
    ]) {
      expect(
        await readFile(resolve(nuxtRoot, "public/assets/fonts/requiem", filename))
      ).not.toHaveLength(0)
    }
  })

  test("runtime source has no Angular source or package imports", async () => {
    const files = await sourceFiles(resolve(nuxtRoot, "app"))
    const contents = await Promise.all(files.map(path => readFile(path, "utf8")))
    for (const source of contents) {
      expect(source).not.toMatch(/from\s+["'][^"']*\.\.\/app(?:\/|["'])/)
      expect(source).not.toMatch(/from\s+["']angular(?:[\u002f"'])/)
      expect(source).not.toContain("window.angular")
    }
  })

  test("statistics consumes the shared About shell", async () => {
    const shell = await readFile(
      resolve(nuxtRoot, "app/components/about/AboutPageShell.vue"),
      "utf8"
    )
    const statistics = await readFile(
      resolve(nuxtRoot, "app/pages/om/statistik.vue"),
      "utf8"
    )

    for (const href of [
      "/om/ide",
      "/om/organisation",
      "/om/hjalp",
      "/om/rattigheter",
      "/om/tack",
      "/om/statistik",
      "/om/kontakt"
    ]) expect(shell).toContain(`to="${href}"`)

    expect(statistics).toContain('import AboutPageShell from "../../components/about/AboutPageShell.vue"')
    expect(statistics).toContain('<AboutPageShell active-page="statistik">')
    expect(statistics).not.toContain('<ul class="links">')
  })

  test("Dramawebben shell uses Nuxt navigation for every internal destination", async () => {
    const shell = await readFile(
      resolve(nuxtRoot, "app/components/dramawebben/DramawebbenShell.vue"),
      "utf8"
    )

    expect(shell.match(/<NuxtLink\b/gu)).toHaveLength(6)
    expect(shell).not.toMatch(/<a\b[^>]*\bhref=["']\//u)
    expect(shell).toContain('to="/s%C3%B6k?avancerad&amp;keywords=keyword:Dramawebben"')
  })

  test("authored low-level navigation stays inside the Nuxt router", async () => {
    const [quickSearch, plays] = await Promise.all([
      readFile(resolve(nuxtRoot, "app/components/global/QuickSearch.vue"), "utf8"),
      readFile(resolve(nuxtRoot, "app/pages/dramawebben/pjäser.vue"), "utf8")
    ])

    expect(quickSearch).toMatch(/<NuxtLink class="sc" to="\/bibliotek"[^>]*\bno-prefetch[^>]*@click="close">/u)
    expect(quickSearch).not.toContain("goToLibrary")
    expect(plays).toContain('<NuxtLink to="/bibliotek?keywords=texttype:drama;dramasamling&amp;visa=works&amp;sort=titlar">Biblioteket</NuxtLink>')
  })

  test("author components reserve native anchors for downloads and external handoffs", async () => {
    const [profile, works] = await Promise.all([
      readFile(resolve(nuxtRoot, "app/components/author/AuthorProfileContent.vue"), "utf8"),
      readFile(resolve(nuxtRoot, "app/components/author/AuthorWorksContent.vue"), "utf8")
    ])

    for (const source of [profile, works]) {
      expect(source).toContain("canonicalNuxtHref")
      expect(source).toContain("isNuxtInternalHref")
    }
    expect(profile).not.toMatch(/<a\b[^>]*:href="(?:rootHref|titlesHref|dramawebbenHref|profile\.searchUrl)"/u)
    expect(works).not.toMatch(/<a\b[^>]*:href="(?:rootHref|titlesHref|dramawebbenHref|author\.search_url|moreHref)"/u)
    expect(works).toContain("v-if=\"action.kind === 'download'\"")
    expect(works).toContain("v-else :to=\"canonicalNuxtHref(action.url)\"")
  })
})
