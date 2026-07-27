import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  ignores: [
    ".nuxt/**",
    ".output/**",
    "node_modules/**",
    "app/lib/api/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results*/**"
  ]
})
