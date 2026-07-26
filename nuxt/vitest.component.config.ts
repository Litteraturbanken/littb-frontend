import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "./test/helpers/linkedom-vitest-environment.ts",
    include: ["test/unit/search-multi-select.spec.ts"]
  }
})
