import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { resolve } from "node:path"

const sourceRoot = resolve(process.env.CASE_STUDY_ROOT || resolve(homedir(), "dev/lb-rewrite-case-study"))
const sourceUrl = process.env.CASE_STUDY_URL || "http://127.0.0.1:4174/"
const sourceClient = resolve(sourceRoot, "dist/client")
const targetRoot = resolve("public/fallstudie")
const publicBase = "/fallstudie"

const requiredPaths = [
  "assets",
  "evidence",
  "favicon.svg",
  "og.png"
]

for (const relativePath of requiredPaths) {
  await stat(resolve(sourceClient, relativePath))
}

const response = await fetch(sourceUrl)
if (!response.ok) {
  throw new Error(`Could not fetch ${sourceUrl}: ${response.status} ${response.statusText}`)
}

const rewritePublicPaths = source => source
  .replaceAll("/assets/", `${publicBase}/assets/`)
  .replaceAll("/evidence/", `${publicBase}/evidence/`)
  .replaceAll("/favicon.svg", `${publicBase}/favicon.svg`)
  .replaceAll("/og.png", `${publicBase}/og.png`)
  // Vinext's Vite preload manifest stores asset paths without a leading slash,
  // then resolves them from the origin root at runtime.
  .replace(/(["'`])assets\//g, `$1${publicBase.slice(1)}/assets/`)

await rm(targetRoot, { recursive: true, force: true })
await mkdir(targetRoot, { recursive: true })

for (const relativePath of requiredPaths) {
  await cp(resolve(sourceClient, relativePath), resolve(targetRoot, relativePath), {
    recursive: true
  })
}

const assetDirectory = resolve(targetRoot, "assets")
const textAssets = (await readdir(assetDirectory))
  .filter(filename => filename.endsWith(".css") || filename.endsWith(".js"))
  .map(filename => resolve(assetDirectory, filename))

for (const assetPath of textAssets) {
  const source = await readFile(assetPath, "utf8")
  await writeFile(assetPath, rewritePublicPaths(source))
}

const html = rewritePublicPaths(await response.text())
const withProvenance = html.replace(
  "</head>",
  `<!-- Embedded from lb-rewrite-case-study for the Nuxt staging build. -->\n</head>`
)
await writeFile(resolve(targetRoot, "index.html"), withProvenance)

console.log(`Embedded case study at ${targetRoot}/index.html`)
