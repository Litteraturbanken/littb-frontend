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

type StartTag = SourceRange & {
  name: string
  source: string
  attributes: Set<string>
}

const maxCanonicalPathLength = 4096
const maxDecodePasses = 16
const rawTextElements = new Set([
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp"
])

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

function isHtmlSpace(character: string | undefined): boolean {
  return character !== undefined && /[\t\n\f\r ]/.test(character)
}

function tagEnd(source: string, start: number): number | null {
  let quote: "\"" | "'" | null = null
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor]
    if (quote) {
      if (character === quote) quote = null
    } else if (character === "\"" || character === "'") {
      quote = character
    } else if (character === ">") {
      return cursor + 1
    }
  }
  return null
}

function startTagAt(source: string, start: number): StartTag | null {
  let cursor = start + 1
  if (!/[a-z]/i.test(source[cursor] ?? "")) return null

  const nameStart = cursor
  while (/[a-z\d:-]/i.test(source[cursor] ?? "")) cursor += 1
  const name = source.slice(nameStart, cursor).toLowerCase()
  const end = tagEnd(source, start)
  if (end === null) return null

  const attributes = new Set<string>()
  while (cursor < end - 1) {
    while (isHtmlSpace(source[cursor])) cursor += 1
    if (source[cursor] === "/") {
      cursor += 1
      continue
    }
    if (cursor >= end - 1) break

    const attributeStart = cursor
    while (
      cursor < end - 1
      && !isHtmlSpace(source[cursor])
      && !["/", ">", "="].includes(source[cursor] ?? "")
    ) cursor += 1
    if (cursor === attributeStart) {
      cursor += 1
      continue
    }
    attributes.add(source.slice(attributeStart, cursor).toLowerCase())

    while (isHtmlSpace(source[cursor])) cursor += 1
    if (source[cursor] !== "=") continue
    cursor += 1
    while (isHtmlSpace(source[cursor])) cursor += 1
    const quote = source[cursor]
    if (quote === "\"" || quote === "'") {
      cursor += 1
      while (cursor < end - 1 && source[cursor] !== quote) cursor += 1
      if (source[cursor] === quote) cursor += 1
    } else {
      while (
        cursor < end - 1
        && !isHtmlSpace(source[cursor])
        && !["/", ">"].includes(source[cursor] ?? "")
      ) cursor += 1
    }
  }

  return { start, end, name, source: source.slice(start, end), attributes }
}

function rawTextEnd(source: string, lowerSource: string, tag: StartTag): number {
  if (tag.name === "plaintext") return source.length
  const closing = `</${tag.name}`
  let cursor = tag.end
  while ((cursor = lowerSource.indexOf(closing, cursor)) !== -1) {
    const delimiter = source[cursor + closing.length]
    if (delimiter === ">" || isHtmlSpace(delimiter)) {
      return tagEnd(source, cursor) ?? source.length
    }
    cursor += closing.length
  }
  return source.length
}

function imageElementEnd(source: string, lowerSource: string, tag: StartTag): number {
  let cursor = tag.end
  while (isHtmlSpace(source[cursor])) cursor += 1
  if (!lowerSource.startsWith("</img", cursor)) return tag.end
  const delimiter = source[cursor + "</img".length]
  if (delimiter !== ">" && !isHtmlSpace(delimiter)) return tag.end
  return tagEnd(source, cursor) ?? tag.end
}

function controlTags(source: string): StartTag[] {
  const tags: StartTag[] = []
  const lowerSource = source.toLowerCase()
  let cursor = 0

  while (cursor < source.length) {
    const opening = source.indexOf("<", cursor)
    if (opening === -1) break
    if (source.startsWith("<!--", opening)) {
      const commentEnd = source.indexOf("-->", opening + 4)
      cursor = commentEnd === -1 ? source.length : commentEnd + 3
      continue
    }
    if (["!", "?", "/"].includes(source[opening + 1] ?? "")) {
      cursor = tagEnd(source, opening) ?? source.length
      continue
    }

    const tag = startTagAt(source, opening)
    if (!tag) {
      cursor = opening + 1
      continue
    }
    if (tag.name === "link" && tag.attributes.has("data-ng-href")) tags.push(tag)
    if (tag.name === "img" && tag.attributes.has("bkg-img")) {
      tags.push({ ...tag, end: imageElementEnd(source, lowerSource, tag) })
    }
    cursor = rawTextElements.has(tag.name)
      ? rawTextEnd(source, lowerSource, tag)
      : tag.end
  }
  return tags
}

function canonicalRedPath(value: string | null): string | null {
  if (
    !value
    || value.length > maxCanonicalPathLength
    || !value.startsWith("/red/")
    || value.includes("\\")
  ) return null

  try {
    let decoded = value
    let stabilized = false
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next.length > maxCanonicalPathLength) return null
      if (next === decoded) {
        stabilized = true
        break
      }
      decoded = next
    }
    if (!stabilized) return null
    if (decoded.includes("\\") || !decoded.startsWith("/red/")) return null
    if (decoded.split("/").some(segment => segment === "." || segment === "..")) return null

    const base = new URL("https://home-content.invalid")
    const parsed = new URL(value, base)
    if (parsed.origin !== base.origin || parsed.pathname !== value) return null
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

  for (const tag of controlTags(source)) {
    ranges.push({ start: tag.start, end: tag.end })
    if (tag.name === "link") output.stylesheetPath ??= stylesheetPath(tag.source)
    if (tag.name === "img" && !output.backgroundImagePath && !output.backgroundColor) {
      const background = backgroundDeclaration(tag.source)
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
const navigateManagedHtml = useManagedHtmlNavigation()

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
    <div class="home-editorial" v-html="homeContent.bodyHtml" @click="navigateManagedHtml" />
  </div>
</template>
