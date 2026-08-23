import { afterEach, describe, expect, test, vi } from "vitest"

type ProxyRule = {
  changeOrigin?: boolean
  target: string
  rewrite?: (path: string) => string
}

type NuxtConfig = {
  buildDir: string
  nitro: {
    apiBaseURL: string
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
    contentBase: string
    libraryApiBase: string
  }
  vite: {
    cacheDir?: string
    server: {
      proxy: Record<string, ProxyRule>
    }
  }
}

const legacyProxyPattern = "^/api/(?!v2(?:/|$))"

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
  test("honors an isolated Nuxt build directory", async () => {
    vi.stubEnv("NUXT_BUILD_DIR", "/tmp/littb-playwright/shard-1/nuxt")

    const config = await loadConfig()

    expect(config.buildDir).toBe("/tmp/littb-playwright/shard-1/nuxt")
  })

  test("honors an isolated Vite dependency cache", async () => {
    vi.stubEnv("LITTB_VITE_CACHE_DIR", "/tmp/littb-playwright/shard-1/vite")

    const config = await loadConfig()

    expect(config.vite.cacheDir).toBe("/tmp/littb-playwright/shard-1/vite")
  })

  test("keeps frontend-owned handlers outside the backend API namespace", async () => {
    const config = await loadConfig()

    expect(config.nitro.apiBaseURL).toBe("/nuxt-api")
  })

  test("routes SSR and browser library requests to the local FastAPI service", async () => {
    vi.stubEnv("LBAPI_LEGACY_PROXY_TARGET", undefined)

    const config = await loadConfig()
    const proxy = config.vite.server.proxy[legacyProxyPattern]

    expect(config.runtimeConfig.libraryApiBase).toBe("http://127.0.0.1:8000")
    expect(proxy?.target).toBe("http://127.0.0.1:8000")
    expect(proxy?.rewrite?.("/api/relevance/etext?from=0&to=1"))
      .toBe("/relevance/etext?from=0&to=1")
    expect(proxy?.rewrite?.("/api/reader/not-a-frontend-route"))
      .toBe("/reader/not-a-frontend-route")
  })

  test("honors an explicit legacy proxy target without changing its path contract", async () => {
    vi.stubEnv("LBAPI_LEGACY_PROXY_TARGET", "https://legacy.example.test")

    const config = await loadConfig()
    const proxy = config.vite.server.proxy[legacyProxyPattern]

    expect(proxy?.target).toBe("https://legacy.example.test")
    expect(proxy?.rewrite).toBeUndefined()
  })
})

describe("legacy content resource ownership", () => {
  test("leaves production resources to the edge and proxies all four namespaces in development", async () => {
    vi.stubEnv("CONTENT_PROXY_TARGET", "https://content.example.test")
    vi.stubEnv("READER_SOURCE_PROXY_TARGET", "https://obsolete-reader.example.test")
    vi.stubEnv("LITTERATURKARTAN_PROXY_TARGET", "https://map.example.test")

    const config = await loadConfig()
    const contentProxy = config.vite.server.proxy[
      "^/(?:red|txt|bilder|export/faksimil)(?:/|$)"
    ]

    for (const path of ["/red/**", "/txt/**", "/bilder/**", "/export/faksimil/**"]) {
      expect(config.routeRules[path]).toBeUndefined()
    }
    expect(config.runtimeConfig).not.toHaveProperty("readerSourceBase")
    expect(config.runtimeConfig.contentBase).toBe("https://red.litteraturbanken.se")
    expect(contentProxy).toMatchObject({
      changeOrigin: true,
      target: "https://content.example.test"
    })
    expect(config.routeRules["/litteraturkartan/**"]?.proxy).toMatchObject({
      headers: { "x-forwarded-host": "map.example.test" }
    })
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
