import sonarjs from "eslint-plugin-sonarjs"
import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  plugins: { sonarjs },
  ignores: [
    ".nuxt/**",
    ".output/**",
    "node_modules/**",
    "app/lib/api/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results*/**"
  ],
  rules: {
    "sonarjs/no-all-duplicated-branches": "error",
    "sonarjs/no-collection-size-mischeck": "error",
    "sonarjs/no-duplicated-branches": "error",
    "sonarjs/no-identical-expressions": "error",
    "sonarjs/no-identical-functions": "error",
    "sonarjs/no-redundant-boolean": "error"
  }
})
