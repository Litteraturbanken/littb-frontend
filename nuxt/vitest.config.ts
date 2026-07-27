import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "#shared": resolve(import.meta.dirname, "shared")
          }
        },
        test: {
          name: "node-unit",
          environment: "node",
          include: ["test/unit/**/*.spec.ts"],
          exclude: [
            "test/unit/renderable-html.spec.ts",
            "test/unit/search-multi-select.spec.ts"
          ]
        }
      },
      "./vitest.component.config.ts"
    ]
  }
})
