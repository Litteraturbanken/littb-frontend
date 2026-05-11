import { cpSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import babel from "@babel/core"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const redTarget = "https://red.litteraturbanken.se"
const mainTarget = "https://litteraturbanken.se"

function proxyTo(target) {
    return {
        target,
        changeOrigin: true,
        secure: true
    }
}

const proxy = {
    "/api": proxyTo(redTarget),
    "/red": proxyTo(redTarget),
    "/txt": proxyTo(redTarget),
    "/export": proxyTo(redTarget),
    "/query": proxyTo(redTarget),
    "/bilder": proxyTo(redTarget),
    "/css": proxyTo(redTarget),
    "/sla-bibliografi": proxyTo(redTarget),
    "/authordb": proxyTo(redTarget),
    "/xhr": proxyTo(redTarget),
    "/ws": proxyTo(redTarget),
    "/so": proxyTo(redTarget),

    "/litteraturkartan/": proxyTo(mainTarget),
    "/skolan": proxyTo(mainTarget),
    "/cdn-cgi/image/": proxyTo(mainTarget)
}

export function angularjsAnnotatePlugin() {
    return {
        name: "littb-angularjs-annotate",
        apply: "build",
        enforce: "pre",
        async transform(code, id) {
            const filename = id.split("?")[0]
            const normalized = filename.split(path.sep).join("/")
            const isAppScript =
                filename.endsWith(".js") &&
                (normalized.includes("/app/scripts/") || normalized.endsWith("/app/main.js"))

            if (!isAppScript || !/\b(?:angular|littb)\b/.test(code)) {
                return null
            }

            const result = await babel.transformAsync(code, {
                filename,
                plugins: ["angularjs-annotate"],
                babelrc: false,
                configFile: false,
                sourceMaps: false
            })

            return result?.code ? { code: result.code, map: null } : null
        }
    }
}

export function legacyStaticImgPlugin({
    sourceDir = path.resolve(__dirname, "app/img"),
    outDir = path.resolve(__dirname, "dist/img")
} = {}) {
    return {
        name: "littb-legacy-static-img",
        apply: "build",
        closeBundle() {
            if (existsSync(sourceDir)) {
                cpSync(sourceDir, outDir, { recursive: true, force: true })
            }
        }
    }
}

export default defineConfig({
    root: path.resolve(__dirname, "app"),
    plugins: [angularjsAnnotatePlugin(), legacyStaticImgPlugin()],
    // We rely on fixed-path static assets like /assets/img/favicons/* and /assets/views/sla/*.
    // Put them under app/public so Vite serves them in dev and copies them into dist on build.
    publicDir: "public",
    appType: "spa",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "app")
        }
    },
    // Angular template URLs are runtime-loaded (ngRoute templateUrl/ng-include).
    // Treat them as assets, but do NOT include app/index.html as an asset.
    assetsInclude: ["**/views/**/*.html", "**/*.xml"],
    server: {
        host: process.env.LITTB_HOST || "0.0.0.0",
        port: Number(process.env.LITTB_PORT || 9000),
        strictPort: true,
        proxy
    },
    preview: {
        proxy
    },
    build: {
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true
    }
})
