import { spawn } from "node:child_process"
import { mkdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  configuredShardCount,
  shardPorts
} from "./test-runner-policy.mjs"

export function createShardPlan({
  projects,
  passthrough = [],
  shardCount,
  fixtureBase = 4100,
  nuxtBase = 3000,
  runRoot,
  playwrightCli
}) {
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new TypeError("at least one Playwright project is required")
  }
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new TypeError("shard count must be a positive integer")
  }
  if (!runRoot || !playwrightCli) {
    throw new TypeError("run root and Playwright CLI are required")
  }

  return Array.from({ length: shardCount }, (_, index) => {
    const { fixturePort, nuxtPort } = shardPorts(index, fixtureBase, nuxtBase)
    const shardRoot = join(runRoot, `shard-${index + 1}`)
    return {
      index,
      command: process.execPath,
      args: [
        playwrightCli,
        "test",
        ...projects.map(project => `--project=${project}`),
        "--workers=1",
        `--shard=${index + 1}/${shardCount}`,
        ...passthrough
      ],
      env: {
        LBAPI_FIXTURE_PORT: String(fixturePort),
        LITTB_NUXT_TEST_PORT: String(nuxtPort),
        NUXT_IGNORE_LOCK: "1",
        NUXT_BUILD_DIR: join(shardRoot, "nuxt"),
        PLAYWRIGHT_OUTPUT_DIR: join(shardRoot, "playwright")
      }
    }
  })
}

export async function superviseShardPlans(plans, spawnShard, cleanup = async () => {}) {
  const children = []
  const settled = new Set()
  let firstFailure = 0

  try {
    for (const plan of plans) children.push(spawnShard(plan))
    await Promise.all(children.map(async (child, index) => {
      let code
      try {
        code = await child.completion
      } catch {
        code = 1
      }
      settled.add(index)
      if (code !== 0 && firstFailure === 0) {
        firstFailure = code
        children.forEach((sibling, siblingIndex) => {
          if (!settled.has(siblingIndex)) sibling.terminate()
        })
      }
    }))
    return firstFailure
  } catch (error) {
    children.forEach((child, index) => {
      if (!settled.has(index)) child.terminate()
    })
    throw error
  } finally {
    await cleanup()
  }
}

function parseArguments(arguments_) {
  const projects = []
  const passthrough = []
  for (const argument of arguments_) {
    if (argument.startsWith("--project=")) projects.push(argument.slice("--project=".length))
    else if (argument !== "--") passthrough.push(argument)
  }
  return { projects, passthrough }
}

function environmentPort(value, fallback, label) {
  if (value === undefined) return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError(`${label} must be an integer port`)
  }
  return port
}

export function terminateProcessTree(
  child,
  platform = process.platform,
  kill = process.kill
) {
  if (child.killed) return
  if (platform === "win32" || !Number.isInteger(child.pid)) {
    child.kill("SIGTERM")
    return
  }
  try {
    kill(-child.pid, "SIGTERM")
  } catch (error) {
    if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ESRCH") {
      throw error
    }
  }
}

function spawnPlan(plan, activeChildren) {
  const child = spawn(plan.command, plan.args, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, ...plan.env },
    stdio: "inherit"
  })
  let settled = false
  let terminationRequested = false
  const completion = new Promise(resolve => {
    child.once("error", () => {
      settled = true
      resolve(1)
    })
    child.once("exit", (code, signal) => {
      settled = true
      resolve(code ?? (signal ? 128 : 1))
    })
  })
  const adapter = {
    completion,
    terminate() {
      if (!settled && !terminationRequested) {
        terminationRequested = true
        terminateProcessTree(child)
      }
    }
  }
  activeChildren.push(adapter)
  return adapter
}

async function main() {
  const { projects, passthrough } = parseArguments(process.argv.slice(2))
  if (projects.length === 0) throw new TypeError("at least one --project=<name> is required")

  const shardCount = configuredShardCount(process.env.LITTB_PLAYWRIGHT_SHARDS)
  const fixtureBase = environmentPort(process.env.LBAPI_FIXTURE_PORT, 4100, "LBAPI_FIXTURE_PORT")
  const nuxtBase = environmentPort(process.env.LITTB_NUXT_TEST_PORT, 3000, "LITTB_NUXT_TEST_PORT")
  const runRoot = resolve(
    "node_modules/.cache/littb-playwright",
    `${Date.now()}-${process.pid}`
  )
  const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"))
  await mkdir(runRoot, { recursive: true })
  const plans = createShardPlan({
    projects,
    passthrough,
    shardCount,
    fixtureBase,
    nuxtBase,
    runRoot,
    playwrightCli
  })
  const activeChildren = []
  let signalExitCode = 0
  const stop = signal => {
    signalExitCode = signal === "SIGINT" ? 130 : 143
    activeChildren.forEach(child => child.terminate())
  }
  const onInterrupt = () => stop("SIGINT")
  const onTerminate = () => stop("SIGTERM")
  process.once("SIGINT", onInterrupt)
  process.once("SIGTERM", onTerminate)
  try {
    const code = await superviseShardPlans(
      plans,
      plan => spawnPlan(plan, activeChildren),
      () => rm(runRoot, { recursive: true, force: true })
    )
    process.exitCode = signalExitCode || code
  } finally {
    process.off("SIGINT", onInterrupt)
    process.off("SIGTERM", onTerminate)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
