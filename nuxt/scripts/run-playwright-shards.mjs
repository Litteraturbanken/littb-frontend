import { spawn } from "node:child_process"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

import {
  configuredShardCount,
  shardPorts
} from "./test-runner-policy.mjs"

export function createSharedNuxtTypePreparation({
  cwd = process.cwd(),
  environment = process.env,
  nuxtCli = fileURLToPath(new URL("../node_modules/nuxt/bin/nuxt.mjs", import.meta.url))
} = {}) {
  const env = { ...environment }
  delete env.NUXT_BUILD_DIR
  return {
    command: process.execPath,
    args: [nuxtCli, "prepare"],
    cwd,
    env
  }
}

function runPreparation(preparation) {
  const child = spawn(preparation.command, preparation.args, {
    cwd: preparation.cwd,
    env: preparation.env,
    stdio: "inherit"
  })
  return new Promise(resolve => {
    child.once("error", () => resolve(1))
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)))
  })
}

export function createShardPlan({
  projects,
  passthrough = [],
  shardCount,
  fixtureBase = 4100,
  nuxtBase = 3000,
  runRoot,
  artifactRoot,
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
    const { fixturePort, nuxtPort, viteServerHmrPort } = shardPorts(
      index,
      fixtureBase,
      nuxtBase
    )
    const shardRoot = join(runRoot, `shard-${index + 1}`)
    return {
      index,
      command: process.execPath,
      args: [
        playwrightCli,
        "test",
        ...projects.map(project => `--project=${project}`),
        "--workers=1",
        ...(shardCount > 1 ? ["--fail-on-flaky-tests"] : []),
        ...(shardCount > 1 ? ["--pass-with-no-tests"] : []),
        `--shard=${index + 1}/${shardCount}`,
        ...passthrough
      ],
      env: {
        LBAPI_FIXTURE_PORT: String(fixturePort),
        LITTB_NUXT_TEST_PORT: String(nuxtPort),
        LITTB_DISABLE_VITE_HMR: shardCount > 1 ? "1" : "0",
        LITTB_PLAYWRIGHT_RETRIES: shardCount > 1 ? "1" : "0",
        LITTB_VITE_CACHE_DIR: join(shardRoot, "vite"),
        LITTB_VITE_SERVER_HMR_PORT: shardCount > 1
          ? String(viteServerHmrPort)
          : "0",
        LITTB_FIXTURE_PID_FILE: join(shardRoot, "fixture.pid"),
        LITTB_NUXT_PID_FILE: join(shardRoot, "nuxt.pid"),
        NUXT_IGNORE_LOCK: "1",
        NUXT_BUILD_DIR: join(shardRoot, "nuxt"),
        PLAYWRIGHT_OUTPUT_DIR: artifactRoot
          ? join(artifactRoot, `shard-${index + 1}`)
          : join(shardRoot, "playwright")
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
    if (firstFailure === 0) firstFailure = 1
    children.forEach((child, index) => {
      if (!settled.has(index)) child.terminate()
    })
    throw error
  } finally {
    await cleanup(firstFailure)
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
  kill = process.kill,
  signal = "SIGTERM"
) {
  if (child.killed) return
  if (platform === "win32" || !Number.isInteger(child.pid)) {
    child.kill(signal)
    return
  }
  try {
    kill(-child.pid, signal)
  } catch (error) {
    if (error instanceof Error && Reflect.has(error, "code") && error.code === "EPERM") {
      child.kill(signal)
      return
    }
    if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ESRCH") {
      throw error
    }
  }
}

export async function terminateOwnedWebServers(
  plans,
  readPid = path => readFile(path, "utf8"),
  kill = process.kill,
  platform = process.platform,
  waitForExit = async pid => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        process.kill(pid, 0)
      } catch (error) {
        if (error instanceof Error
          && Reflect.has(error, "code")
          && ["EPERM", "ESRCH"].includes(String(error.code))) {
          return
        }
        throw error
      }
      await delay(50)
    }
    try {
      process.kill(platform === "win32" ? pid : -pid, "SIGKILL")
    } catch (error) {
      if (!(error instanceof Error)
        || !Reflect.has(error, "code")
        || !["EPERM", "ESRCH"].includes(String(error.code))) {
        throw error
      }
    }
  }
) {
  const pidFiles = new Set(plans.flatMap(plan => [
    plan.env.LITTB_FIXTURE_PID_FILE,
    plan.env.LITTB_NUXT_PID_FILE
  ]))
  const ownedPids = []
  await Promise.all([...pidFiles].map(async pidFile => {
    let rawPid
    try {
      rawPid = await readPid(pidFile)
    } catch (error) {
      if (error instanceof Error && Reflect.has(error, "code") && error.code === "ENOENT") {
        return
      }
      throw error
    }
    const pid = Number(String(rawPid).trim())
    if (!Number.isInteger(pid) || pid < 1) {
      throw new TypeError(`invalid owned web-server pid in ${pidFile}`)
    }
    try {
      kill(platform === "win32" ? pid : -pid, "SIGTERM")
    } catch (error) {
      if (!(error instanceof Error)
        || !Reflect.has(error, "code")
        || !["EPERM", "ESRCH"].includes(String(error.code))) {
        throw error
      }
      return
    }
    ownedPids.push(pid)
  }))
  await Promise.all(ownedPids.map(pid => waitForExit(pid)))
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

  const preparationCode = await runPreparation(createSharedNuxtTypePreparation())
  if (preparationCode !== 0) {
    process.exitCode = preparationCode
    return
  }

  const shardCount = configuredShardCount(process.env.LITTB_PLAYWRIGHT_SHARDS)
  const fixtureBase = environmentPort(process.env.LBAPI_FIXTURE_PORT, 4100, "LBAPI_FIXTURE_PORT")
  const nuxtBase = environmentPort(process.env.LITTB_NUXT_TEST_PORT, 3000, "LITTB_NUXT_TEST_PORT")
  const runId = `${Date.now()}-${process.pid}`
  const runRoot = resolve("node_modules/.cache/littb-playwright", runId)
  const artifactRoot = resolve("test-results/playwright-shards", runId)
  const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"))
  await Promise.all([
    mkdir(runRoot, { recursive: true }),
    mkdir(artifactRoot, { recursive: true })
  ])
  const plans = createShardPlan({
    projects,
    passthrough,
    shardCount,
    fixtureBase,
    nuxtBase,
    runRoot,
    artifactRoot,
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
      async failureCode => {
        await terminateOwnedWebServers(plans)
        await rm(runRoot, { recursive: true, force: true })
        if (failureCode === 0) {
          await rm(artifactRoot, { recursive: true, force: true })
        } else {
          console.error(`Playwright failure diagnostics: ${artifactRoot}`)
        }
      }
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
