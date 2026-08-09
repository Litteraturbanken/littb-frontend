import { afterEach, describe, expect, test, vi } from "vitest"

type ProxyRule = {
  target: string
  rewrite?: (path: string) => string
}

type NuxtConfig = {
  nitro: {
    imports: {
      dirsScanOptions: {
        fileFilter: (path: string) => boolean
      }
    }
  }
  routeRules: Record<string, {
    proxy?: {
      to: string
      headers?: Record<string, string>
    }
  }>
  runtimeConfig: {
    libraryApiBase: string
  }
  vite: {
    server: {
      proxy: Record<string, ProxyRule>
    }
  }
}

const legacyProxyPattern = "^/api/(?!v2(?:/|$)|reader(?:/|$)|editor(?:/|$)|dev(?:/|$)|author-documents(?:/|$)|dramawebben(?:/|$)|observability(?:/|$))"

async function loadConfig(): Promise<NuxtConfig> {
  vi.stubGlobal("defineNuxtConfig", (config: NuxtConfig) => config)
  const module = await import("../../nuxt.config")
  return module.default as unknown as NuxtConfig
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("local legacy library API defaults", () => {
  test("routes SSR and browser library requests to the local FastAPI service", async () => {
    vi.stubEnv("LBAPI_LEGACY_PROXY_TARGET", undefined)

    const config = await loadConfig()
    const proxy = config.vite.server.proxy[legacyProxyPattern]

    expect(config.runtimeConfig.libraryApiBase).toBe("http://127.0.0.1:8000")
    expect(proxy?.target).toBe("http://127.0.0.1:8000")
    expect(proxy?.rewrite?.("/api/relevance/etext?from=0&to=1"))
      .toBe("/relevance/etext?from=0&to=1")
  })

  test("honors an explicit legacy proxy target without changing its path contract", async () => {
    vi.stubEnv("LBAPI_LEGACY_PROXY_TARGET", "https://legacy.example.test")

    const config = await loadConfig()
    const proxy = config.vite.server.proxy[legacyProxyPattern]

    expect(proxy?.target).toBe("https://legacy.example.test")
    expect(proxy?.rewrite).toBeUndefined()
  })
})

describe("external reader source proxy", () => {
  test("replaces inbound forwarded hosts with each external upstream host", async () => {
    vi.stubEnv("READER_SOURCE_PROXY_TARGET", "https://reader.example.test")
    vi.stubEnv("LITTERATURKARTAN_PROXY_TARGET", "https://map.example.test")

    const config = await loadConfig()

    for (const path of ["/txt/**", "/bilder/**", "/export/faksimil/**"]) {
      expect(config.routeRules[path]?.proxy).toMatchObject({
        headers: { "x-forwarded-host": "reader.example.test" }
      })
    }
    expect(config.routeRules["/litteraturkartan/**"]?.proxy).toMatchObject({
      headers: { "x-forwarded-host": "map.example.test" }
    })
  })
})

describe("red content proxy boundary", () => {
  test("leaves red requests to the hardened Nitro route in development", async () => {
    vi.stubEnv("LITTB_CONTENT_PROXY_TARGET", "https://content.example.test")

    const config = await loadConfig()

    expect(Object.keys(config.vite.server.proxy)).not.toContain("^/red(?:/|$)")
  })
})

describe("Reader source-information auto-import boundary", () => {
  test("scans the public facade without registering its direct-import modules twice", async () => {
    const config = await loadConfig()
    const include = config.nitro.imports.dirsScanOptions.fileFilter

    expect(include("/repo/server/utils/reader-source-info.ts")).toBe(true)
    for (const module of ["definitions", "projection", "sanitizer", "validation"]) {
      expect(include(`/repo/server/utils/reader-source-info-${module}.ts`)).toBe(false)
    }
    expect(include("/repo/server/utils/other-helper.ts")).toBe(true)
  })
})
