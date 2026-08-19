import { resolve } from "node:path"

import { ESLint } from "eslint"
import { describe, expect, test } from "vitest"

const projectRoot = resolve(import.meta.dirname, "../..")
const eslint = new ESLint({ cwd: projectRoot })

async function lintVue(source: string): Promise<readonly { ruleId: string | null }[]> {
  const [result] = await eslint.lintText(source, {
    filePath: resolve(projectRoot, "app/pages/eslint-quality-fixture.vue")
  })
  return result?.messages ?? []
}

describe("ESLint quality policy", () => {
  test("rejects contradictory Tailwind display classes in Vue templates", async () => {
    const messages = await lintVue('<template><div class="table block">Content</div></template>')

    expect(messages).toContainEqual(expect.objectContaining({
      ruleId: "tailwindcss/no-contradicting-classname",
      severity: 2
    }))
  }, 15_000)

  test.each([
    [
      "script setup",
      '<script setup lang="ts">const value = true ? (false ? (true ? "a" : "b") : "c") : "d"</script>',
      "no-restricted-syntax"
    ],
    [
      "template interpolation",
      '<template><div>{{ true ? (false ? (true ? "a" : "b") : "c") : "d" }}</div></template>',
      "vue/no-restricted-syntax"
    ]
  ])("rejects three-deep conditional expressions in %s", async (_context, source, ruleId) => {
    expect(await lintVue(source)).toContainEqual(expect.objectContaining({ ruleId, severity: 2 }))
  })

  test.each([
    '<script setup lang="ts">const value = true ? (false ? "a" : "b") : "c"</script>',
    '<template><div>{{ true ? (false ? "a" : "b") : "c" }}</div></template>'
  ])("allows a two-deep conditional expression at the readability boundary", async source => {
    expect(await lintVue(source)).not.toContainEqual(expect.objectContaining({
      ruleId: expect.stringMatching(/no-restricted-syntax$/u)
    }))
  })
})
