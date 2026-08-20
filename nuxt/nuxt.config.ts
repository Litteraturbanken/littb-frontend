import { resolve } from "node:path"

const apiProxyTarget = process.env.LBAPI_PROXY_TARGET || "http://127.0.0.1:8000"
const litteraturkartanProxyTarget = process.env.LITTERATURKARTAN_PROXY_TARGET || "https://litteraturbanken.se"
const forwardedHostHeaders = (target: string): Record<string, string> => ({
  "x-forwarded-host": new URL(target).host
})
const legacyApiProxyOverride = process.env.LBAPI_LEGACY_PROXY_TARGET
const legacyApiProxyTarget = legacyApiProxyOverride || "http://127.0.0.1:8000"
const readerSourceInfoInternalModule = /[/\\]reader-source-info-(?:definitions|projection|sanitizer|validation)\.[cm]?[jt]s$/u
const disableViteHmr = process.env.LITTB_DISABLE_VITE_HMR === "1"
const viteServerHmrPort = Number(process.env.LITTB_VITE_SERVER_HMR_PORT || 0)

export default defineNuxtConfig({
  buildDir: process.env.NUXT_BUILD_DIR || ".nuxt",
  compatibilityDate: "2025-07-15",
  ssr: true,
  modules: ["@nuxt/eslint"],
  eslint: {
    config: {
      autoInit: false
    }
  },
  devtools: { enabled: false },
  features: {
    inlineStyles: true
  },
  nitro: {
    apiBaseURL: "/nuxt-api",
    compressPublicAssets: true,
    imports: {
      dirsScanOptions: {
        fileFilter: path => !readerSourceInfoInternalModule.test(path)
      }
    },
    publicAssets: [
      {
        dir: resolve("app/assets/styles/fonts/601526"),
        baseURL: "/assets/styles/fonts/601526",
        maxAge: 31_536_000
      },
      {
        dir: resolve("app/assets/styles/fonts/font-awesome"),
        baseURL: "/assets/fonts/font-awesome",
        maxAge: 31_536_000
      }
    ]
  },
  css: [
    "~/assets/styles/bootstrap.scss",
    "~/assets/styles/tailwind.css",
    "~/assets/styles/font-awesome.scss",
    "~/assets/styles/nuxt.scss"
  ],
  routeRules: {
    "/litteraturkartan/**": {
      proxy: {
        to: `${litteraturkartanProxyTarget}/litteraturkartan/**`,
        headers: forwardedHostHeaders(litteraturkartanProxyTarget)
      }
    },
    "/om/statistik": { ssr: true },
    "/om/**": { ssr: true },
    "/statistik": {
      redirect: { to: "/om/statistik", statusCode: 308 }
    },
    "/hjalp": {
      redirect: { to: "/om/hjalp", statusCode: 308 }
    },
    "/kontakt": {
      redirect: { to: "/om/kontakt", statusCode: 308 }
    },
    "/sok": {
      redirect: { to: "/s%C3%B6k", statusCode: 308 }
    },
    "/titlar": {
      redirect: { to: "/bibliotek", statusCode: 308 }
    },
    "/forfattare": {
      redirect: { to: "/bibliotek", statusCode: 308 }
    }
  },
  runtimeConfig: {
    apiBase: "http://127.0.0.1:8000/v2",
    deploymentEnvironment: "production",
    deploymentGitSha: process.env.GIT_SHA || "0000000000000000000000000000000000000000",
    deploymentImageDigest: process.env.IMAGE_DIGEST || "",
    observabilityHmacSecret: "",
    observabilityHmacSecretFile: "",
    observabilityAllowedOrigins: "",
    libraryApiBase: "http://127.0.0.1:8000",
    contentBase: "https://red.litteraturbanken.se",
    readerSourceBase: "",
    public: {
      apiBase: "/api/v2",
      libraryApiBase: "/api",
      contentBase: "",
      observabilityEnvironment: process.env.DEPLOYMENT_ENV || "production",
      observabilityGitSha: process.env.GIT_SHA || "0000000000000000000000000000000000000000"
    }
  },
  typescript: {
    strict: true
  },
  hooks: {
    "vite:extendConfig": (config, { isClient }) => {
      if (isClient || viteServerHmrPort < 1 || !config.server) return
      config.server.hmr = { port: viteServerHmrPort }
    }
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },
  vite: {
    server: {
      ...(disableViteHmr ? { hmr: false } : {}),
      ...(process.env.LITTB_VITE_FS_ALLOW
        ? { fs: { allow: [process.cwd(), process.env.LITTB_VITE_FS_ALLOW] } }
        : {}),
      proxy: {
        "^/api/v2(?:/|$)": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/v2(?=\/|$)/, "/v2")
        },
        "^/api/(?!v2(?:/|$))": {
          target: legacyApiProxyTarget,
          changeOrigin: true,
          ...(legacyApiProxyOverride
            ? {}
            : { rewrite: path => path.replace(/^\/api(?=\/|$)/, "") })
        },
        "^/litteraturkartan(?:[/?]|$)": {
          target: litteraturkartanProxyTarget,
          changeOrigin: true
        }
      }
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: "sv" },
      link: [
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/assets/img/favicons/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/assets/img/favicons/favicon-16x16.png" }
      ],
      noscript: [{
        innerHTML: '<link rel="stylesheet" href="/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css">'
      }],
      meta: [{ name: "theme-color", content: "#ffffff" }]
    }
  }
})
