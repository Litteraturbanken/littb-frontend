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
          setupFiles: ["test/helpers/setup-dom-parser.ts"],
          include: ["test/unit/**/*.spec.ts"],
          exclude: [
            "test/unit/renderable-html.spec.ts",
            "test/unit/search-multi-select.spec.ts",
            "test/unit/library-component-boundaries.spec.ts",
            "test/unit/reader-contents-dialog.spec.ts",
            "test/unit/reader-focus-controls.spec.ts",
            "test/unit/reader-source-info-dialog.spec.ts"
          ]
        }
      },
      "./vitest.component.config.ts"
    ]
  }
})
