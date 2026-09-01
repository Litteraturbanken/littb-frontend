import { expect, test } from "@playwright/test"

const readerPath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const work = "lb-reader-gosta-berlings-saga"

function scanPath(size: 3 | 5, imageNumber: 12): string {
  return `/txt/${work}/${work}_${size}/${work}_${size}_${String(imageNumber).padStart(4, "0")}.jpeg`
}

test("Safari fetches only the selected 2x scan after client-side page navigation", async ({
  browserName,
  page
}) => {
  test.skip(browserName !== "webkit", "Safari-specific responsive image regression")
  await page.goto(readerPath, { waitUntil: "networkidle" })
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2)

  const scanRequests: string[] = []
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("_0012.jpeg")) scanRequests.push(pathname)
  })

  await page.getByRole("link", { name: "Nästa sida" }).evaluate(link => {
    ;(link as HTMLAnchorElement).click()
  })
  await expect(page).toHaveURL(/\/sida\/5\/faksimil$/)
  await expect.poll(() => scanRequests).toContain(scanPath(5, 12))

  expect(scanRequests).toEqual([scanPath(5, 12)])
})
