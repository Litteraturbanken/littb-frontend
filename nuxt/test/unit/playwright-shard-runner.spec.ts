import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import {
  createShardPlan,
  superviseShardPlans,
  terminateOwnedWebServers,
  terminateProcessTree
} from "../../scripts/run-playwright-shards.mjs"

function deferredChild() {
  let settle!: (code: number) => void
  const completion = new Promise<number>(resolve => {
    settle = resolve
  })
  const terminate = vi.fn(() => settle(143))
  return { completion, settle, terminate }
}

describe("isolated Playwright shard runner", () => {
  test("plans one-worker shards with unique ports and directories", () => {
    const runRoot = "/tmp/littb-playwright/run-1"
    const plans = createShardPlan({
      projects: ["ssr"],
      passthrough: ["--grep", "robots"],
      shardCount: 2,
      fixtureBase: 4200,
      nuxtBase: 3100,
      runRoot,
      playwrightCli: "/repo/node_modules/@playwright/test/cli.js"
    })

    expect(plans).toHaveLength(2)
    expect(plans[0]).toMatchObject({
      command: process.execPath,
      args: expect.arrayContaining([
        "/repo/node_modules/@playwright/test/cli.js",
        "test",
        "--project=ssr",
        "--workers=1",
        "--shard=1/2",
        "--grep",
        "robots"
      ]),
      env: expect.objectContaining({
        LBAPI_FIXTURE_PORT: "4200",
        LITTB_NUXT_TEST_PORT: "3100",
        LITTB_DISABLE_VITE_HMR: "1",
        LITTB_VITE_SERVER_HMR_PORT: "24678",
        NUXT_IGNORE_LOCK: "1",
        LITTB_FIXTURE_PID_FILE: join(runRoot, "shard-1", "fixture.pid"),
        LITTB_NUXT_PID_FILE: join(runRoot, "shard-1", "nuxt.pid"),
        NUXT_BUILD_DIR: join(runRoot, "shard-1", "nuxt"),
        PLAYWRIGHT_OUTPUT_DIR: join(runRoot, "shard-1", "playwright")
      })
    })
    expect(plans[1]?.args).toContain("--shard=2/2")
    expect(plans[1]?.env).toMatchObject({
      LBAPI_FIXTURE_PORT: "4202",
      LITTB_NUXT_TEST_PORT: "3101",
      LITTB_DISABLE_VITE_HMR: "1",
      LITTB_VITE_SERVER_HMR_PORT: "24679",
      LITTB_FIXTURE_PID_FILE: join(runRoot, "shard-2", "fixture.pid"),
      LITTB_NUXT_PID_FILE: join(runRoot, "shard-2", "nuxt.pid"),
      NUXT_BUILD_DIR: join(runRoot, "shard-2", "nuxt"),
      PLAYWRIGHT_OUTPUT_DIR: join(runRoot, "shard-2", "playwright")
    })
  })

  test("keeps normal dev HMR for a single serial lane", () => {
    const [plan] = createShardPlan({
      projects: ["ssr"],
      passthrough: [],
      shardCount: 1,
      fixtureBase: 4200,
      nuxtBase: 3100,
      runRoot: "/tmp/littb-playwright/run-serial",
      playwrightCli: "/repo/node_modules/@playwright/test/cli.js"
    })

    expect(plan?.env).toMatchObject({
      LITTB_DISABLE_VITE_HMR: "0",
      LITTB_VITE_SERVER_HMR_PORT: "0"
    })
  })

  test("terminates the whole POSIX shard process group", () => {
    const kill = vi.fn()
    const child = { pid: 1234, killed: false, kill: vi.fn() }

    terminateProcessTree(child, "darwin", kill)

    expect(kill).toHaveBeenCalledWith(-1234, "SIGTERM")
    expect(child.kill).not.toHaveBeenCalled()
  })

  test("falls back to the direct child on Windows", () => {
    const kill = vi.fn()
    const child = { pid: 1234, killed: false, kill: vi.fn() }

    terminateProcessTree(child, "win32", kill)

    expect(child.kill).toHaveBeenCalledWith("SIGTERM")
    expect(kill).not.toHaveBeenCalled()
  })

  test("terminates owned web-server process groups recorded by each shard", async () => {
    const kill = vi.fn()
    const readPid = vi.fn(async path => path.endsWith("fixture.pid") ? "1234\n" : "5678\n")
    const plans = [{
      env: {
        LITTB_FIXTURE_PID_FILE: "/tmp/run/shard-1/fixture.pid",
        LITTB_NUXT_PID_FILE: "/tmp/run/shard-1/nuxt.pid"
      }
    }]

    const waitForExit = vi.fn(async () => undefined)
    await terminateOwnedWebServers(plans, readPid, kill, "darwin", waitForExit)

    expect(kill).toHaveBeenCalledWith(-1234, "SIGTERM")
    expect(kill).toHaveBeenCalledWith(-5678, "SIGTERM")
    expect(waitForExit).toHaveBeenCalledTimes(2)
  })

  test("waits for every successful shard and cleans the run root", async () => {
    const first = deferredChild()
    const second = deferredChild()
    const cleanup = vi.fn(async () => undefined)
    const result = superviseShardPlans(
      [{ index: 0 }, { index: 1 }],
      plan => plan.index === 0 ? first : second,
      cleanup
    )

    first.settle(0)
    second.settle(0)

    await expect(result).resolves.toBe(0)
    expect(first.terminate).not.toHaveBeenCalled()
    expect(second.terminate).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test("preserves the first failure, terminates siblings, and cleans", async () => {
    const first = deferredChild()
    const second = deferredChild()
    const cleanup = vi.fn(async () => undefined)
    const result = superviseShardPlans(
      [{ index: 0 }, { index: 1 }],
      plan => plan.index === 0 ? first : second,
      cleanup
    )

    second.settle(7)

    await expect(result).resolves.toBe(7)
    expect(first.terminate).toHaveBeenCalledTimes(1)
    expect(second.terminate).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
