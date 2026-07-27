const apiProxyTarget = process.env.LBAPI_PROXY_TARGET || "http://127.0.0.1:8000"
const contentProxyTarget = process.env.LITTB_CONTENT_PROXY_TARGET || "https://red.litteraturbanken.se"
const litteraturkartanProxyTarget = process.env.LITTERATURKARTAN_PROXY_TARGET || "https://litteraturbanken.se"
const readerSourceProxyTarget = process.env.READER_SOURCE_PROXY_TARGET || "https://litteraturbanken.se"
const legacyApiProxyOverride = process.env.LBAPI_LEGACY_PROXY_TARGET
const legacyApiProxyTarget = legacyApiProxyOverride || "http://127.0.0.1:8000"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: true,
  modules: ["@nuxt/eslint"],
  eslint: {
    config: {
      autoInit: false
    }
  },
  devtools: { enabled: false },
  css: [
    "~/assets/styles/bootstrap.scss",
    "~/assets/styles/tailwind.css",
    "font-awesome/css/font-awesome.css",
    "vue-multiselect/dist/vue-multiselect.css",
    "~/assets/styles/styles.scss",
    "~/assets/styles/nuxt.scss",
    "~/assets/styles/reader.scss"
  ],
  routeRules: {
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
    libraryApiBase: "http://127.0.0.1:8000",
    contentBase: "https://red.litteraturbanken.se",
    readerSourceBase: "https://litteraturbanken.se",
    public: {
      apiBase: "/api/v2",
      libraryApiBase: "/api",
      contentBase: ""
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
      ...(process.env.LITTB_VITE_FS_ALLOW
        ? { fs: { allow: [process.cwd(), process.env.LITTB_VITE_FS_ALLOW] } }
        : {}),
      proxy: {
        "^/api/v2(?:/|$)": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/v2(?=\/|$)/, "/v2")
        },
        "^/api/(?!v2(?:/|$)|reader(?:/|$)|editor(?:/|$)|dev(?:/|$)|author-documents(?:/|$)|dramawebben(?:/|$))": {
          target: legacyApiProxyTarget,
          changeOrigin: true,
          ...(legacyApiProxyOverride
            ? {}
            : { rewrite: path => path.replace(/^\/api(?=\/|$)/, "") })
        },
        "^/red(?:/|$)": {
          target: contentProxyTarget,
          changeOrigin: true
        },
        "^/(?:txt|bilder)(?:/|$)": {
          target: readerSourceProxyTarget,
          changeOrigin: true
        },
        "^/export/faksimil(?:/|$)": {
          target: readerSourceProxyTarget,
          changeOrigin: true
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
      meta: [{ name: "theme-color", content: "#ffffff" }]
    }
  }
})
