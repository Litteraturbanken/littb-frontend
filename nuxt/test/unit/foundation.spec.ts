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

describe("standalone Nuxt foundation", () => {
  test("pins the parity stack without Angular", async () => {
    const manifest = JSON.parse(await readFile(resolve(nuxtRoot, "package.json"), "utf8"))
    expect(manifest.dependencies.nuxt).toBe("4.4.8")
    expect(manifest.dependencies["openapi-fetch"]).toBe("0.17.0")
    expect(manifest.devDependencies.tailwindcss).toBe("3.4.18")
    expect(manifest.dependencies.angular).toBeUndefined()
    expect(manifest.dependencies["@headlessui/vue"]).toBe("1.7.23")
  })

  test("copies legacy parity CSS into Nuxt ownership", async () => {
    const legacy = await readFile(resolve(legacyRoot, "app/styles/styles.scss"), "utf8")
    const owned = await readFile(resolve(nuxtRoot, "app/assets/styles/styles.scss"), "utf8")
    expect(owned).toBe(legacy)
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
      expect(source).not.toMatch(/from\s+["']angular(?:[\/"'])/)
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
    ]) expect(shell).toContain(`href="${href}"`)

    expect(statistics).toContain('import AboutPageShell from "../../components/about/AboutPageShell.vue"')
    expect(statistics).toContain('<AboutPageShell active-page="statistik">')
    expect(statistics).not.toContain('<ul class="links">')
  })
})
