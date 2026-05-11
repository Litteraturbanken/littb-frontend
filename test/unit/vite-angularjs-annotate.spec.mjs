import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import viteConfig, { angularjsAnnotatePlugin, legacyStaticImgPlugin } from "../../vite.config.mjs"

const plugin = angularjsAnnotatePlugin()
const result = await plugin.transform(
    "littb.config(function ($routeProvider) { return $routeProvider })",
    "/tmp/littb/app/scripts/app.js"
)

assert.match(result.code, /"\$routeProvider"/)
assert.match(result.code, /\["\$routeProvider", function/)

assert.equal(viteConfig.preview.proxy["/red"].target, "https://red.litteraturbanken.se")
assert.equal(viteConfig.preview.proxy["/txt"].target, "https://red.litteraturbanken.se")

const tmpRoot = mkdtempSync(join(tmpdir(), "littb-vite-config-"))
try {
    const sourceDir = join(tmpRoot, "img")
    const outDir = join(tmpRoot, "dist", "img")
    await mkdir(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, "dramawebben_svart.svg"), "<svg></svg>")

    await legacyStaticImgPlugin({ sourceDir, outDir }).closeBundle()

    assert.equal(readFileSync(join(outDir, "dramawebben_svart.svg"), "utf8"), "<svg></svg>")
} finally {
    rmSync(tmpRoot, { recursive: true, force: true })
}

console.log("vite angularjs annotate tests: ok")
