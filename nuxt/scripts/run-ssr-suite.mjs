import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import { terminateProcessTree } from "./run-playwright-shards.mjs"

export function createSsrSuitePhases(passthrough = []) {
  return [
    {
      args: ["--config=playwright.config.ts", "--project=ssr", ...passthrough],
      env: { LITTB_SSR_EXCLUDE_STATEFUL: "1" }
    },
    {
      args: [
        "--config=playwright.config.ts",
        "--project=ssr",
        "test/ssr/reader-shorthand.spec.ts",
        ...passthrough
      ],
      env: {
        LITTB_SSR_EXCLUDE_STATEFUL: "0",
        LITTB_PLAYWRIGHT_SHARDS: "1"
      }
    },
    {
      args: [
        "--config=playwright.ssr.config.ts",
        "--project=ssr-staging",
        ...passthrough
      ],
      env: { LITTB_PLAYWRIGHT_SHARDS: "1" }
    }
  ]
}

function runPhase(runner, phase) {
  const child = spawn(process.execPath, [runner, ...phase.args], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, ...phase.env },
    stdio: "inherit"
  })
  const stop = () => terminateProcessTree(child)
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  return new Promise(resolve => {
    child.once("error", () => resolve(1))
    child.once("exit", (code, signal) => {
      process.off("SIGINT", stop)
      process.off("SIGTERM", stop)
      resolve(code ?? (signal ? 128 : 1))
    })
  })
}

async function main() {
  const passthrough = process.argv.slice(2).filter(argument => argument !== "--")
  const runner = fileURLToPath(new URL("run-playwright-shards.mjs", import.meta.url))
  for (const phase of createSsrSuitePhases(passthrough)) {
    const code = await runPhase(runner, phase)
    if (code !== 0) {
      process.exitCode = code
      return
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
