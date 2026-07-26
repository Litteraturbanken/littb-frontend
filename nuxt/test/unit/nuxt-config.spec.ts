import { afterEach, describe, expect, test, vi } from "vitest"

type ProxyRule = {
  target: string
  rewrite?: (path: string) => string
}

type NuxtConfig = {
  runtimeConfig: {
    libraryApiBase: string
  }
  vite: {
    server: {
      proxy: Record<string, ProxyRule>
    }
  }
}

const legacyProxyPattern = "^/api/(?!v2(?:/|$)|reader(?:/|$)|editor(?:/|$)|dev(?:/|$)|author-documents(?:/|$)|dramawebben(?:/|$))"

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
