import { expect, test } from "vitest"

import { runSequentialCleanup } from "../helpers/sequential-cleanup"

test("runs reset only after close settles and still resets when close fails", async () => {
  const events: string[] = []

  await expect(runSequentialCleanup(
    async () => {
      events.push("close:start")
      await Promise.resolve()
      events.push("close:end")
      throw new Error("close failed")
    },
    async () => {
      events.push("reset")
    },
    "cleanup failed"
  )).rejects.toThrow("close failed")

  expect(events).toEqual(["close:start", "close:end", "reset"])
})

test("reports both sequential cleanup failures", async () => {
  await expect(runSequentialCleanup(
    async () => { throw new Error("close failed") },
    async () => { throw new Error("reset failed") },
    "cleanup failed"
  )).rejects.toMatchObject({
    message: "cleanup failed",
    errors: [expect.objectContaining({ message: "close failed" }),
      expect.objectContaining({ message: "reset failed" })]
  })
})
