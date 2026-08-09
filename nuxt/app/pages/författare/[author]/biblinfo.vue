<script setup lang="ts">
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"
import { createLbApiClient } from "~/lib/api/client"
import {
  authorProfilePath,
  createAuthorProfileView,
  type AuthorProfileView,
  validateAuthorRouteParam
} from "~/lib/author-profile"
import type { components, operations } from "~/lib/api/generated/lbapi"
import { canonicalNuxtHref, isNuxtInternalHref } from "~/lib/internal-navigation"

type BibliographyEntry = components["schemas"]["BibliographyEntry"]
type BibliographyResource = NonNullable<
  NonNullable<
    operations["v2_get_bibliography_entries"]["parameters"]["query"]
  >["resource"]
>[number]
type LoadStatus = "success" | "author-not-found" | "author-unavailable" | "bibliography-unavailable"
type InitialResult = {
  identity: string
  status: LoadStatus
  profile: AuthorProfileView | null
  items: BibliographyEntry[]
}

const resourceOptions = [
  ["manus", "manuscriptChk", "Visa information om alla manuskript"],
  ["tryckt_material", "printedChk", "Visa information om alla tryckta upplagor"],
  ["annat_tryckt", "publicationChk", "Visa information om andra publikationsformer"],
  ["forskning", "researchChk", "Visa information om forskning"]
] as const satisfies ReadonlyArray<readonly [BibliographyResource, string, string]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNullableBoundedString(value: unknown): value is string | null {
  return value === null || typeof value === "string" && value.length <= 20_000
}

function isBibliographyEntry(value: unknown): value is BibliographyEntry {
  return isRecord(value)
    && Object.keys(value).length === 4
    && isNullableBoundedString(value.title)
    && isNullableBoundedString(value.isbn)
    && isNullableBoundedString(value.issn)
    && isNullableBoundedString(value.archive)
}

function bibliographyItems(value: unknown): BibliographyEntry[] | null {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.items)) {
    return null
  }
  return value.items.length <= 10_000 && value.items.every(isBibliographyEntry)
    ? value.items
    : null
}

definePageMeta({
  validate: route => {
    const author = Array.isArray(route.params.author)
      ? route.params.author[0]
      : route.params.author
    return validateAuthorRouteParam(author)
  }
})

const route = useRoute()
const config = useRuntimeConfig()
const authorId = computed(() => {
  const value = Array.isArray(route.params.author) ? route.params.author[0] : route.params.author
  return typeof value === "string" ? value : ""
})
const currentIdentity = computed(() => `biblinfo:${authorId.value}`)
const asyncKey = computed(() => `author-biblinfo:${currentIdentity.value}`)
const initialClient = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)

async function loadInitial(author: string, identity: string): Promise<InitialResult> {
  let profileResult
  try {
    profileResult = await initialClient.GET("/authors/{author_id}", {
      params: { path: { author_id: author } }
    })
  } catch {
    return { identity, status: "author-unavailable", profile: null, items: [] }
  }
  if (!profileResult.data) {
    return {
      identity,
      status: profileResult.response.status === 404 ? "author-not-found" : "author-unavailable",
      profile: null,
      items: []
    }
  }
  const profile = createAuthorProfileView(profileResult.data, "ordinary")
  try {
    const bibliographyResult = await initialClient.GET("/bibliography/entries")
    const items = bibliographyItems(bibliographyResult.data)
    if (!items) {
      return { identity, status: "bibliography-unavailable", profile, items: [] }
    }
    return { identity, status: "success", profile, items }
  } catch {
    return { identity, status: "bibliography-unavailable", profile, items: [] }
  }
}

const { data } = await useAsyncData<InitialResult>(
  asyncKey,
  async () => {
    const identity = currentIdentity.value
    return await loadInitial(authorId.value, identity)
  }
)

const accepted = computed(() => data.value?.identity === currentIdentity.value ? data.value : null)

if (import.meta.server && accepted.value?.status !== "success") {
  setResponseStatus(accepted.value?.status === "author-not-found" ? 404 : 503)
}

const profile = computed(() => accepted.value?.profile ?? null)
useAuthorQuickSearchContextPublisher(profile)
const entries = shallowRef<BibliographyEntry[]>([])
const entriesStatus = ref<"success" | "unavailable">("success")
const searching = ref(false)
const showHit = ref(0)
const showAll = ref(false)
const wholeText = ref("")
const searchValidationError = ref("")
const selectedResources = reactive<Record<BibliographyResource, boolean>>({
  manus: false,
  tryckt_material: false,
  annat_tryckt: false,
  forskning: false
})
let searchGeneration = 0

watch([accepted, currentIdentity], ([result, identity]) => {
  searchGeneration += 1
  searching.value = false
  showHit.value = 0
  showAll.value = false
  if (result?.identity !== identity) {
    entries.value = []
    entriesStatus.value = "unavailable"
    return
  }
  entries.value = result.items
  entriesStatus.value = result.status === "success" ? "success" : "unavailable"
}, { immediate: true, flush: "sync" })

const visibleEntries = computed(() => {
  if (showAll.value) return entries.value
  const entry = entries.value[showHit.value]
  return entry ? [entry] : []
})
const hitText = computed(() => entries.value.length
  ? `${entries.value.length} träffar`
  : "Inga träffar")
const rootHref = computed(() => authorProfilePath(authorId.value))
const titlesHref = computed(() => authorProfilePath(authorId.value, "titlar"))
const dramawebbenHref = computed(() => authorProfilePath(authorId.value, "dramawebben"))

function internalSearchHref(value: string): string {
  const href = canonicalNuxtHref(value)
  const pathname = href.split(/[?#]/u, 1)[0]
  return pathname === "/s%C3%B6k" && isNuxtInternalHref(href) ? href : ""
}

const searchHref = computed(() => profile.value ? internalSearchHref(profile.value.searchUrl) : "")

function entryPairs(entry: BibliographyEntry): Array<readonly [string, string | null]> {
  return [
    ["title", entry.title],
    ["isbn", entry.isbn],
    ["issn", entry.issn],
    ["archive", entry.archive]
  ]
}

function firstColumn(entry: BibliographyEntry): Array<readonly [string, string | null]> {
  const pairs = entryPairs(entry)
  return pairs.slice(0, Math.floor(pairs.length / 2) + 1)
}

function secondColumn(entry: BibliographyEntry): Array<readonly [string, string | null]> {
  const pairs = entryPairs(entry)
  return pairs.slice(Math.floor(pairs.length / 2) + 1)
}

function increment(): void {
  showAll.value = false
  if (entries.value[showHit.value + 1]) showHit.value += 1
}

function decrement(): void {
  showAll.value = false
  if (showHit.value > 0) showHit.value -= 1
}

function showEveryEntry(): void {
  showAll.value = true
}

async function submitSearch(): Promise<void> {
  const generation = ++searchGeneration
  const identity = currentIdentity.value
  const resources = resourceOptions
    .map(([resource]) => resource)
    .filter(resource => selectedResources[resource])
  const trimmedWholeText = wholeText.value.trim()
  searchValidationError.value = ""
  if (trimmedWholeText.length > 200) {
    searching.value = false
    searchValidationError.value = "Fritextsökningen får innehålla högst 200 tecken."
    return
  }
  searching.value = true
  try {
    const client = createLbApiClient(config.public.apiBase)
    const result = await client.GET("/bibliography/entries", {
      params: {
        query: {
          ...(resources.length ? { resource: resources } : {}),
          ...(trimmedWholeText ? { whole_text: trimmedWholeText } : {})
        }
      }
    })
    if (generation !== searchGeneration || identity !== currentIdentity.value) return
    const items = bibliographyItems(result.data)
    if (!items) {
      entries.value = []
      entriesStatus.value = "unavailable"
      return
    }
    entries.value = items
    entriesStatus.value = "success"
    showHit.value = 0
    showAll.value = false
  } catch {
    if (generation !== searchGeneration || identity !== currentIdentity.value) return
    entries.value = []
    entriesStatus.value = "unavailable"
  } finally {
    if (generation === searchGeneration && identity === currentIdentity.value) {
      searching.value = false
    }
  }
}

useSeoMeta({
  title: () => profile.value
    ? `${profile.value.fullName}, Bibliografisk databas | Litteraturbanken`
    : "Bibliografisk databas | Litteraturbanken",
  description: () => profile.value
    ? `${profile.value.fullName}, Bibliografisk databas`
    : "Bibliografisk databas"
})
useHead({
  htmlAttrs: { style: `background: url('${ordinaryBackground}') no-repeat;` },
  bodyAttrs: { class: "focus page-authorInfo ready" }
})
</script>

<template>
  <div>
    <div v-if="!accepted" class="searching" aria-live="polite">
      <div class="preloader">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar bibliografisk databas</span>
      </div>
    </div>
    <div v-else-if="accepted.status === 'author-not-found'" class="error">
      Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
    </div>
    <div v-else-if="accepted.status === 'author-unavailable' || !profile" class="error">
      Ett fel har inträffat. Författarprofilen kan inte visas just nu.
    </div>
    <template v-else>
      <h1 class="text-balance max-w-5xl">
        {{ profile.fullName }}{{ " " }}<span v-if="profile.lifespan" class="author_year">({{ profile.lifespan }})</span>
      </h1>

      <nav aria-label="Författarsidor">
        <ul class="links">
          <li v-if="profile.hasOrdinaryIntroduction">
            <NuxtLink :to="rootHref">Introduktion</NuxtLink>
          </li>{{ " " }}
          <li><NuxtLink :to="titlesHref">Verk</NuxtLink></li>{{ " " }}
          <li v-if="profile.audioUrl">
            <a :href="profile.audioUrl" target="_blank" rel="noopener noreferrer">Ljud</a>
          </li>{{ " " }}
          <li v-if="profile.hasDramawebben">
            <NuxtLink :to="dramawebbenHref">Dramawebben</NuxtLink>
          </li>{{ " " }}
          <li v-if="searchHref"><NuxtLink :to="searchHref">Sök i texterna</NuxtLink></li>
        </ul>
      </nav>

      <div class="page_content">
        <div :class="{ searching }">
          <h1>Bibliografisk databas</h1>
          <div class="preloader">Söker <span class="dots_blink" /></div>
          <form class="search" @submit.prevent="submitSearch">
            <input
              v-model="wholeText"
              maxlength="200"
              placeholder="Fritextsökning i hela databasen"
            ><button type="submit">Sök</button>{{ " " }}
            <select aria-label="Verk">
              <option value="">Alla verk</option>
            </select>
          </form>

          <ul>
            <li v-for="([resource, id, label]) in resourceOptions" :key="resource">
              <input
                :id="id"
                v-model="selectedResources[resource]"
                type="checkbox"
                :value="resource"
              > <label :for="id">{{ label }}</label>
            </li>
          </ul>

          <div v-if="searchValidationError" class="error" role="alert">
            {{ searchValidationError }}
          </div>
          <div v-if="entriesStatus === 'unavailable'" class="error">
            Den bibliografiska databasen kan inte visas just nu.
          </div>
          <div v-else class="results">
            <div
              v-for="(entry, index) in visibleEntries"
              :key="showAll ? index : showHit"
              :class="{ even: index % 2 === 1 }"
            >
              <div class="col">
                <div v-for="([key, value]) in firstColumn(entry)" :key="key">
                  <h4>{{ key }}</h4>
                  <span v-if="value">{{ value }}</span><span v-else>[tom]</span>
                </div>
              </div>
              <div class="col">
                <div v-for="([key, value]) in secondColumn(entry)" :key="key">
                  <h4>{{ key }}</h4>
                  <span v-if="value">{{ value }}</span><span v-else>[tom]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClientOnly>
        <Teleport to="#toolkit">
          <div id="toolkit-biblinfo">
            <hr>
            <div class="num_hits">{{ hitText }}</div>
            <ul>
              <li><button type="button" class="biblinfo_action" @click="increment">Visa nästa sökträff</button></li>
              <li><button type="button" class="biblinfo_action" @click="decrement">Visa föregående sökträff</button></li>
              <li><button type="button" class="biblinfo_action" @click="showEveryEntry">Visa alla sökträffar</button></li>
            </ul>
          </div>
        </Teleport>
      </ClientOnly>
    </template>
  </div>
</template>
