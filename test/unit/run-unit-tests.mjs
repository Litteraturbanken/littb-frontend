import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

class CommandFailure extends Error {
    constructor(status) {
        super("Unit test command failed")
        this.status = status
    }
}

function run(command, args) {
    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: false
    })
    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        throw new CommandFailure(result.status || 1)
    }
}

let outDir

try {
    run(process.execPath, ["test/unit/stats-popular-works.spec.mjs"])

    outDir = mkdtempSync(join(tmpdir(), "littb-unit-"))
    run(process.execPath, [
        join("node_modules", "typescript", "bin", "tsc"),
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
} catch (error) {
    if (error instanceof CommandFailure) {
        process.exitCode = error.status
    } else {
        console.error(error)
        process.exitCode = 1
    }
} finally {
    if (outDir) {
        rmSync(outDir, { recursive: true, force: true })
    }
}
