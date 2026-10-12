import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import { terminateProcessTree } from "./run-playwright-shards.mjs"

const behaviorProjects = [
  "desktop-chromium",
  "mobile-chromium",
  "chromium-typography",
  "firefox-typography",
  "webkit-typography"
]

const visualProjects = ["desktop-chromium", "mobile-chromium"]

function splitProjectSelections(arguments_) {
  const projects = []
  const passthrough = []
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument.startsWith("--project=")) {
      projects.push(argument.slice("--project=".length))
    } else if (argument === "--project" && arguments_[index + 1]) {
      projects.push(arguments_[index + 1])
      index += 1
    } else {
      passthrough.push(argument)
    }
  }
  return { projects, passthrough }
}

function configuredLaneShards(environment, laneName, fallback) {
  return environment[`LITTB_E2E_${laneName}_SHARDS`]
    ?? environment.LITTB_PLAYWRIGHT_SHARDS
    ?? fallback
}

export function createE2eSuitePhases(passthrough = [], environment = process.env) {
  const selection = splitProjectSelections(passthrough)
  const selectedProjects = new Set(selection.projects)
  const phases = [
    {
      projects: behaviorProjects,
      env: {
        LITTB_E2E_LANE: "behavior",
        LITTB_PLAYWRIGHT_SHARDS: configuredLaneShards(environment, "BEHAVIOR", "3")
      }
    },
    {
      projects: visualProjects,
      env: {
        LITTB_E2E_LANE: "visual",
        LITTB_PLAYWRIGHT_SHARDS: configuredLaneShards(environment, "VISUAL", "2")
      }
    }
  ]
  return phases.flatMap(phase => {
    const projects = selection.projects.length === 0
      ? phase.projects
      : phase.projects.filter(project => selectedProjects.has(project))
    if (projects.length === 0) return []
    return [{
      args: [
        ...projects.map(project => `--project=${project}`),
        ...selection.passthrough
      ],
      env: phase.env
    }]
  })
}

export function collectedTestCount(output) {
  const match = output.match(/Total:\s+([\d,]+)\s+tests?\s+in/u)
  if (!match) throw new Error("Playwright collection total is missing")
  return Number(match[1].replaceAll(",", ""))
}

function collectionArguments(arguments_) {
  const collected = []
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument.startsWith("--reporter=")) continue
    if (argument === "--reporter") {
      index += 1
      continue
    }
    collected.push(argument)
  }
  return [...collected, "--list", "--pass-with-no-tests", "--reporter=list"]
}

function collectPhase(playwrightCli, phase) {
  const child = spawn(process.execPath, [
    playwrightCli,
    "test",
    ...collectionArguments(phase.args)
  ], {
    cwd: process.cwd(),
    env: { ...process.env, ...phase.env },
    stdio: ["ignore", "pipe", "inherit"]
  })
  let output = ""
  child.stdout.setEncoding("utf8")
  child.stdout.on("data", chunk => { output += chunk })
  return new Promise(resolve => {
    child.once("error", () => resolve({ code: 1, count: 0 }))
    child.once("exit", (code, signal) => resolve({
      code: code ?? (signal ? 128 : 1),
      count: code === 0 ? collectedTestCount(output) : 0
    }))
  })
}

function runPhase(runner, phase) {
  const child = spawn(process.execPath, [runner, ...phase.args], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, ...phase.env },
    stdio: "inherit"
  })
  let receivedSignal
  const stop = signal => {
    receivedSignal = signal
    terminateProcessTree(child, process.platform, process.kill, signal)
  }
  const onInterrupt = () => stop("SIGINT")
  const onTerminate = () => stop("SIGTERM")
  process.once("SIGINT", onInterrupt)
  process.once("SIGTERM", onTerminate)
  return new Promise(resolve => {
    let settled = false
    const finish = code => {
      if (settled) return
      settled = true
      process.off("SIGINT", onInterrupt)
      process.off("SIGTERM", onTerminate)
      resolve(code)
    }
    child.once("error", () => finish(1))
    child.once("exit", (code, signal) => {
      const exitSignal = receivedSignal ?? signal
      const signalCode = exitSignal === "SIGINT" ? 130 : 143
      finish(code ?? (exitSignal ? signalCode : 1))
    })
  })
}

async function main() {
  const passthrough = process.argv.slice(2).filter(argument => argument !== "--")
  const runner = fileURLToPath(new URL("run-playwright-shards.mjs", import.meta.url))
  const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"))
  let totalTests = 0
  for (const phase of createE2eSuitePhases(passthrough)) {
    const collection = await collectPhase(playwrightCli, phase)
    if (collection.code !== 0) {
      process.exitCode = collection.code
      return
    }
    totalTests += collection.count
    if (collection.count === 0) continue
    const code = await runPhase(runner, phase)
    if (code !== 0) {
      process.exitCode = code
      return
    }
  }
  if (totalTests === 0) {
    console.error("No E2E tests matched the requested filters and projects")
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
