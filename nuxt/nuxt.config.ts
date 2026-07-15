const apiProxyTarget = process.env.LBAPI_PROXY_TARGET || "http://127.0.0.1:8000"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: true,
  devtools: { enabled: false },
  css: [
    "~/assets/styles/bootstrap.scss",
    "~/assets/styles/tailwind.css",
    "~/assets/styles/styles.scss",
    "~/assets/styles/nuxt.scss"
  ],
  routeRules: {
    "/om/statistik": { ssr: true }
  },
  runtimeConfig: {
    apiBase: "http://127.0.0.1:8000/v2",
    public: {
      apiBase: "/api/v2"
    }
  },
  typescript: {
    strict: true
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },
  vite: {
    server: {
      proxy: {
        "^/api/v2(?:/|$)": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/v2(?=\/|$)/, "/v2")
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
      meta: [{ name: "theme-color", content: "#ffffff" }]
    }
  }
})
