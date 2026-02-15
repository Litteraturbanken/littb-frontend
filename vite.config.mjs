import path from "node:path"
import { defineConfig } from "vite"

const redTarget = "https://red.litteraturbanken.se"
const mainTarget = "https://litteraturbanken.se"

function proxyTo(target) {
    return {
        target,
        changeOrigin: true,
        secure: true
    }
}

export default defineConfig({
    root: path.resolve(__dirname, "app"),
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
        proxy: {
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
    },
    build: {
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true
    }
})
