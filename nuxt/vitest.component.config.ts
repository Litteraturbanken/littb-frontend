import vue from "@vitejs/plugin-vue"
import { defineProject } from "vitest/config"

export default defineProject({
  plugins: [vue()],
  test: {
    name: "component",
    environment: "./test/helpers/linkedom-vitest-environment.ts",
    include: [
      "test/unit/renderable-html.spec.ts",
      "test/unit/search-multi-select.spec.ts"
    ]
  }
})
