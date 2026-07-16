<script lang="ts">
export type HomeContent = {
  bodyHtml: string
  stylesheetPath: string | null
  backgroundImagePath: string | null
  backgroundColor: string | null
}

type SourceRange = {
  start: number
  end: number
}

function emptyHomeContent(bodyHtml = ""): HomeContent {
  return {
    bodyHtml,
    stylesheetPath: null,
    backgroundImagePath: null,
    backgroundColor: null
  }
}

function attributeValue(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = tag.match(new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i"
  ))
  return match?.[1] ?? match?.[2] ?? null
}

function canonicalRedPath(value: string | null): string | null {
  if (!value || !value.startsWith("/red/") || value.includes("\\")) return null

  try {
    const base = new URL("https://home-content.invalid")
    const parsed = new URL(value, base)
    if (parsed.origin !== base.origin || parsed.pathname !== value) return null

    let decoded = value
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
    if (decoded.includes("\\") || !decoded.startsWith("/red/")) return null
    if (decoded.split("/").some(segment => segment === "." || segment === "..")) return null
    return value
  } catch {
    return null
  }
}

function stylesheetPath(tag: string): string | null {
  const expression = attributeValue(tag, "data-ng-href")
  const match = expression?.match(
    /^\s*\{\{\s*(['"])(.*?)\?\1\s*\+\s*cacheKiller\(\)\s*\}\}\s*$/
  )
  return canonicalRedPath(match?.[2] ?? null)
}

function backgroundDeclaration(tag: string): {
  imagePath: string | null
  color: string | null
} {
  const imagePath = canonicalRedPath(attributeValue(tag, "src"))
  const colorValue = attributeValue(tag, "color")
  const color = colorValue && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(colorValue)
    ? colorValue
    : null
  return imagePath && color
    ? { imagePath, color }
    : { imagePath: null, color: null }
}

export function parseHomeContent(source: string): HomeContent {
  const output = emptyHomeContent(source)
  const ranges: SourceRange[] = []

  for (const match of source.matchAll(/<link\b(?=[^>]*\bdata-ng-href\b)[^>]*>/gi)) {
    if (match.index === undefined) continue
    ranges.push({ start: match.index, end: match.index + match[0].length })
    output.stylesheetPath ??= stylesheetPath(match[0])
  }

  for (const match of source.matchAll(
    /<img\b(?=[^>]*\bbkg-img\b)[^>]*>(?:\s*<\/img\s*>)?/gi
  )) {
    if (match.index === undefined) continue
    ranges.push({ start: match.index, end: match.index + match[0].length })
    if (!output.backgroundImagePath && !output.backgroundColor) {
      const background = backgroundDeclaration(match[0])
      output.backgroundImagePath = background.imagePath
      output.backgroundColor = background.color
    }
  }

  output.bodyHtml = ranges
    .sort((left, right) => right.start - left.start)
    .reduce(
      (body, range) => `${body.slice(0, range.start)}${body.slice(range.end)}`,
      source
    )
  return output
}
</script>

<script setup lang="ts">
const contentPath = "/red/om/start/startsida-ny.html"

useSeoMeta({
  title: "Litteraturbanken | Svenska klassiker som e-bok och epub",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})

const cacheBuster = useState<string>("home-cache-buster", () => {
  if (import.meta.dev) return Math.random().toString(36).slice(2)
  const now = new Date()
  return String((now.getFullYear() % 100) * 100 + now.getMonth() + 1)
})
const config = useRuntimeConfig()

const { data: content } = await useAsyncData<HomeContent>("home-content", async () => {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  const url = `${base.replace(/\/$/, "")}${contentPath}?${cacheBuster.value}`
  try {
    const source = await $fetch<string>(url, { responseType: "text", retry: 0 })
    return parseHomeContent(source)
  } catch {
    return emptyHomeContent()
  }
}, {
  default: () => emptyHomeContent()
})

const homeContent = computed(() => content.value ?? emptyHomeContent())

useHead(() => {
  const parsed = homeContent.value
  const background = parsed.backgroundImagePath && parsed.backgroundColor
    ? `background: ${parsed.backgroundColor} url('${parsed.backgroundImagePath}') no-repeat;`
    : ""
  return {
    htmlAttrs: { style: background },
    bodyAttrs: { class: "focus page-start ready" },
    link: parsed.stylesheetPath
      ? [{
          key: "home-runtime-stylesheet",
          rel: "stylesheet",
          href: `${parsed.stylesheetPath}?${cacheBuster.value}`
        }]
      : []
  }
})
</script>

<template>
  <div class="center_col">
    <h1>Litteraturbanken</h1>
    <h2 class="caps">Nytt <i class="no-caps">&amp;</i> anmärkningsvärt</h2>
    <div class="home-editorial" v-html="homeContent.bodyHtml" />
  </div>
</template>
