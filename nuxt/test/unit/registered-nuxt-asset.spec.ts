import { describe, expect, test } from "vitest"

import {
  isRegisteredNuxtAsset,
  isSameOriginRegisteredNuxtAsset
} from "../helpers/registered-nuxt-asset"

const origin = "http://127.0.0.1:3300"
const viteEntry = "/_nuxt/@fs/Users/johan/project/nuxt/node_modules/nuxt/dist/app/entry.js"

describe("registered Nuxt visual-test assets", () => {
  test("accepts the current bounded Vite entry timestamp and version query", () => {
    const url = new URL(`${viteEntry}?t=1785071874909&v=40bb0872`, origin)

    expect(isRegisteredNuxtAsset(url)).toBe(true)
    expect(isSameOriginRegisteredNuxtAsset(url, origin)).toBe(true)
  })

  test.each([
    `?t=178507187490&v=40bb0872`,
    `?t=17850718749090&v=40bb0872`,
    `?t=17850718749ab&v=40bb0872`,
    `?t=1785071874909&v=40bb087`,
    `?t=1785071874909&v=40bb087z`,
    `?t=1785071874909&v=40bb0872&unexpected=1`,
    `?v=40bb0872&t=1785071874909&t=1785071874910`
  ])("rejects an unregistered Vite entry query: %s", query => {
    expect(isRegisteredNuxtAsset(new URL(`${viteEntry}${query}`, origin))).toBe(false)
  })

  test("rejects the registered shape from an external origin", () => {
    const url = new URL(`${viteEntry}?t=1785071874909&v=40bb0872`, "https://example.com")

    expect(isRegisteredNuxtAsset(url)).toBe(true)
    expect(isSameOriginRegisteredNuxtAsset(url, origin)).toBe(false)
  })

  test.each([
    "/_nuxt/../private?" + "t=1785071874909&v=40bb0872",
    "/_nuxt/%2e%2e/private?" + "t=1785071874909&v=40bb0872",
    "/_nuxt/%2e%2e%2fprivate.js?" + "t=1785071874909&v=40bb0872",
    "/_nuxt/%2e%2e%2fprivate.js"
  ])("rejects traversal outside the registered Nuxt asset path: %s", path => {
    expect(isSameOriginRegisteredNuxtAsset(new URL(path, origin), origin)).toBe(false)
  })
})
