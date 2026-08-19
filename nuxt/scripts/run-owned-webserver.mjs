import { spawn } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const [pidFile, command, ...args] = process.argv.slice(2)

if (!pidFile || !command) {
  throw new TypeError("usage: run-owned-webserver.mjs <pid-file> <command> [...args]")
}

await mkdir(dirname(pidFile), { recursive: true })
await writeFile(pidFile, `${process.pid}\n`, "utf8")

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit"
})

let stopping = false
const stop = signal => {
  if (stopping) return
  stopping = true
  child.kill(signal)
}

process.once("SIGINT", () => stop("SIGINT"))
process.once("SIGTERM", () => stop("SIGTERM"))

const exitCode = await new Promise(resolve => {
  child.once("error", () => resolve(1))
  child.once("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)))
})

await rm(pidFile, { force: true })
process.exitCode = exitCode
