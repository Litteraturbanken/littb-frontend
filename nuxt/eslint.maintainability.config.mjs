import sonarjs from "eslint-plugin-sonarjs"
import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  files: [
    "app/**/*.{js,mjs,ts,vue}",
    "server/**/*.{js,mjs,ts}",
    "shared/**/*.{js,mjs,ts}"
  ],
  ignores: [
    ".nuxt/**",
    ".output/**",
    "node_modules/**",
    "app/lib/api/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results*/**",
    "test/**"
  ],
  plugins: { sonarjs },
  rules: {
    "sonarjs/cognitive-complexity": ["warn", 12],
    "sonarjs/cyclomatic-complexity": ["warn", { threshold: 12 }],
    "sonarjs/max-lines-per-function": ["warn", { maximum: 80 }]
  }
})
