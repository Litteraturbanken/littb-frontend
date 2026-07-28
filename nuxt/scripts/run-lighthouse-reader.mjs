import { spawn } from "node:child_process"
import { mkdir, readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"

import { evaluateLighthouseRuns } from "./lighthouse-budget.mjs"

const DEFAULT_READER_PATH = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/1/etext"

function parseArguments(argv) {
  const values = new Map()
  const flags = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith("--")) continue

    const [name, inlineValue] = argument.split("=", 2)
    if (inlineValue !== undefined) {
      values.set(name, inlineValue)
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      values.set(name, argv[index + 1])
      index += 1
    } else {
      flags.add(name)
    }
  }

  const integer = (name, fallback) => {
    const value = Number.parseInt(values.get(name) ?? String(fallback), 10)
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer`)
    }
    return value
  }

  return {
    runs: integer("--runs", 3),
    port: integer("--port", 3031),
    performance: integer("--performance", 100),
    accessibility: integer("--accessibility", 100),
    bestPractices: integer("--best-practices", 100),
    seo: integer("--seo", 100),
    maxConsoleErrors: integer("--max-console-errors", 0),
    url: values.get("--url"),
    clean: flags.has("--clean"),
    skipBuild: flags.has("--skip-build")
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.stdio ?? "inherit"
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise()
      } else {
        reject(new Error(
          `${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}`
        ))
      }
    })
  })
}

async function waitForPage(url, timeoutMilliseconds = 60_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastStatus = "no response"

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      lastStatus = `HTTP ${response.status}`
      if (response.status === 200) return
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500))
  }

  throw new Error(`Nitro did not serve ${url} within 60 seconds (${lastStatus})`)
}

async function stopServer(server) {
  if (server.exitCode !== null || server.signalCode !== null) return
  server.kill("SIGTERM")

  await Promise.race([
    new Promise(resolvePromise => server.once("exit", resolvePromise)),
    new Promise(resolvePromise => setTimeout(resolvePromise, 5_000))
  ])

  if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL")
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const outputDirectory = resolve("output/lighthouse")
  if (options.clean) await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(outputDirectory, { recursive: true })

  if (!options.skipBuild) await runCommand("yarn", ["build"])

  const readerUrl = options.url
    ?? `http://127.0.0.1:${options.port}${DEFAULT_READER_PATH}`
  const server = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
      PORT: String(options.port),
      NITRO_PORT: String(options.port)
    },
    stdio: "inherit"
  })

  const reports = []
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")

  try {
    await waitForPage(readerUrl)

    for (let index = 0; index < options.runs; index += 1) {
      const reportBase = resolve(outputDirectory, `${stamp}-reader-run-${index + 1}`)
      console.log(`\nLighthouse reader run ${index + 1}/${options.runs}`)
      await runCommand(
        resolve("node_modules/.bin/lighthouse"),
        [
          readerUrl,
          "--preset=desktop",
          "--only-categories=performance,accessibility,best-practices,seo",
          "--output=json",
          "--output=html",
          `--output-path=${reportBase}`,
          "--chrome-flags=--headless=new --disable-dev-shm-usage",
          "--disable-full-page-screenshot",
          "--max-wait-for-load=45000",
          "--quiet"
        ]
      )
      reports.push(JSON.parse(await readFile(`${reportBase}.report.json`, "utf8")))
    }
  } finally {
    await stopServer(server)
  }

  const budget = {
    performance: options.performance,
    accessibility: options.accessibility,
    bestPractices: options.bestPractices,
    seo: options.seo,
    maxConsoleErrors: options.maxConsoleErrors,
    forbiddenAssetSubstrings: ["dramawebben", "vue-multiselect"]
  }
  const evaluation = evaluateLighthouseRuns(reports, budget, options.runs)

  console.log("\nLighthouse summaries:")
  console.table(evaluation.summaries.map((summary, index) => ({
    run: index + 1,
    ...summary.categories,
    consoleErrors: summary.consoleErrors,
    forbiddenAssets: summary.forbiddenAssets.length
  })))

  if (evaluation.failures.length > 0) {
    console.error("\nLighthouse budget failures:")
    for (const failure of evaluation.failures) console.error(`- ${failure}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
