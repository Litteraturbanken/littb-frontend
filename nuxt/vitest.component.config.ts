import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineProject } from "vitest/config"

export default defineProject({
  plugins: [vue()],
  resolve: {
    alias: {
      "#shared": resolve(import.meta.dirname, "shared"),
      "~": resolve(import.meta.dirname, "app")
    }
  },
  test: {
    name: "component",
    environment: "./test/helpers/linkedom-vitest-environment.ts",
    include: [
      "test/unit/renderable-html.spec.ts",
      "test/unit/search-multi-select.spec.ts",
      "test/unit/library-component-boundaries.spec.ts",
      "test/unit/reader-contents-dialog.spec.ts",
      "test/unit/reader-focus-controls.spec.ts"
    ]
  }
})
