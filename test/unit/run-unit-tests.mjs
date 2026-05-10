import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

function run(command, args) {
    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: false
    })
    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        process.exit(result.status || 1)
    }
}

run(process.execPath, ["test/unit/stats-popular-works.spec.mjs"])

const outDir = mkdtempSync(join(tmpdir(), "littb-unit-"))

try {
    run("node_modules/.bin/tsc", [
        "test/unit/query.spec.ts",
        "app/scripts/query.ts",
        "--outDir",
        outDir,
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--esModuleInterop",
        "--skipLibCheck",
        "--strict",
        "--noImplicitAny",
        "false"
    ])
    run(process.execPath, [join(outDir, "test/unit/query.spec.js")])
} finally {
    rmSync(outDir, { recursive: true, force: true })
}
