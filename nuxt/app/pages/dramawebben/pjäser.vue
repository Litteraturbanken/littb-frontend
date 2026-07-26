<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel
} from "@headlessui/vue"

import DramawebbenShell from "~/components/dramawebben/DramawebbenShell.vue"
import ReaderSourceInfoDialog from "~/components/reader/ReaderSourceInfoDialog.vue"
import { createLbApiClient } from "~/lib/api/client"
import type { components } from "~/lib/api/generated/lbapi"
import { authorProfilePath } from "~/lib/author-profile"
import { canonicalNuxtHref } from "~/lib/internal-navigation"
import { readerSourceInfoIsOpen } from "~/lib/reader-routes"
import type { ReaderSourceInfo } from "#shared/types/reader-source-info"

type Catalog = components["schemas"]["DramawebbenCatalogResponse"]
type CatalogAuthor = components["schemas"]["DramawebbenCatalogAuthor"]
type CatalogMedia = components["schemas"]["DramawebbenCatalogMedia"]
type CatalogWork = components["schemas"]["DramawebbenCatalogWork"]
type RangeKey = "female_roles" | "male_roles" | "other_roles" | "number_of_acts"
  | "number_of_pages" | "number_of_roles"
type CatalogResult = { status: 200 | 502 | 503, catalog: Catalog | null }

const rangeFields: readonly { key: RangeKey, label: string }[] = [
  { key: "number_of_acts", label: "Antal akter" },
  { key: "number_of_roles", label: "Antal roller" },
  { key: "number_of_pages", label: "Antal sidor" },
  { key: "female_roles", label: "Antal kvinnliga roller" },
  { key: "male_roles", label: "Antal manliga roller" },
  { key: "other_roles", label: "Antal övriga roller" }
]

const genderOptions = [
  { value: "all", label: "Alla författare" },
  { value: "female", label: "Kvinnliga författare" },
  { value: "male", label: "Manliga författare" }
] as const
const mediaOptions = [
  { value: "all", label: "Visa alla" },
  { value: "etext", label: "Etext" },
  { value: "faksimil", label: "Faksimil" },
  { value: "pdf", label: "PDF" },
  { value: "infopost", label: "Verk som saknar text" }
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isCatalogAuthor(value: unknown): value is CatalogAuthor {
  return isRecord(value)
    && typeof value.author_id === "string"
    && typeof value.full_name === "string"
    && typeof value.name_for_index === "string"
    && isStringOrNull(value.surname)
    && isStringOrNull(value.gender)
    && isStringOrNull(value.birth_year)
    && isStringOrNull(value.death_year)
    && Object.keys(value).every(key => [
      "author_id", "full_name", "name_for_index", "surname", "gender",
      "birth_year", "death_year"
    ].includes(key))
}

function isSafeCatalogMediaUrl(mediaType: string, url: string, downloadable: boolean): boolean {
  if (!url.startsWith("/") || url.startsWith("//") || /[\u0000-\u001f\u007f\s]/u.test(url)) return false
  if (mediaType === "pdf") {
    return downloadable && /^\/txt\/[^/?#]+\/[^/?#]+\.pdf$/u.test(url)
  }
  if (downloadable) return false
  if (mediaType === "etext" || mediaType === "faksimil") {
    return new RegExp(
      `^/författare/[^/?#]+/titlar/[^/?#]+/sida/[^/?#]+/${mediaType}$`,
      "u"
    ).test(url)
  }
  if (mediaType !== "infopost") return false
  try {
    const parsed = new URL(url, "http://catalog.local")
    return parsed.origin === "http://catalog.local"
      && parsed.pathname === "/dramawebben/pj%C3%A4ser"
      && [...parsed.searchParams.keys()].join(",") === "om-boken,authorid,titlepath"
      && parsed.searchParams.get("om-boken") === ""
      && Boolean(parsed.searchParams.get("authorid"))
      && Boolean(parsed.searchParams.get("titlepath"))
  } catch {
    return false
  }
}

function isCatalogMedia(value: unknown): value is CatalogMedia {
  return isRecord(value)
    && ["etext", "faksimil", "pdf", "infopost"].includes(String(value.media_type))
    && typeof value.url === "string"
    && typeof value.downloadable === "boolean"
    && isSafeCatalogMediaUrl(String(value.media_type), value.url, value.downloadable)
    && Object.keys(value).every(key => ["media_type", "url", "downloadable"].includes(key))
}

function isMetric(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0)
}

function isCatalogWork(value: unknown): value is CatalogWork {
  if (!isRecord(value)) return false
  const keys = [
    "work_id", "title_path", "title", "short_title", "authors", "media",
    "is_childrens_play", ...rangeFields.map(field => field.key)
  ]
  return typeof value.work_id === "string"
    && typeof value.title_path === "string"
    && typeof value.title === "string"
    && isStringOrNull(value.short_title)
    && Array.isArray(value.authors) && value.authors.length > 0
    && value.authors.every(isCatalogAuthor)
    && Array.isArray(value.media) && value.media.length > 0
    && value.media.every(isCatalogMedia)
    && typeof value.is_childrens_play === "boolean"
    && rangeFields.every(field => isMetric(value[field.key]))
    && Object.keys(value).every(key => keys.includes(key))
}

function isCatalog(value: unknown): value is Catalog {
  return isRecord(value)
    && Object.keys(value).length === 2
    && Array.isArray(value.works) && value.works.every(isCatalogWork)
    && Array.isArray(value.authors) && value.authors.every(isCatalogAuthor)
}

function oneQuery(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function validSourceInfoSegment(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length >= 1 && value.length <= maximum
    && value === value.trim()
    && value !== "." && value !== ".."
    && !/[\\/%\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)
}

function normalizedTokens(value: string): string[] {
  return value.toLocaleLowerCase("sv-SE").split(/\s+/u).filter(Boolean)
}

function visibleYear(value: string | null): string | null {
  return value && value !== "0000" ? value : null
}

function authorYear(author: CatalogAuthor): string {
  const birth = visibleYear(author.birth_year)
  const death = visibleYear(author.death_year)
  if (birth && death) return `${birth}-${death}`
  if (birth) return `f. ${birth}`
  if (death) return `d. ${death}`
  return ""
}

function authorName(author: CatalogAuthor) {
  const [surname, ...given] = author.name_for_index.split(",")
  return { surname: surname || author.surname || author.full_name, given: given.join(",").trim() }
}

function selectedAuthorLabel(value: unknown): string {
  return isCatalogAuthor(value) ? value.surname || value.full_name : "Välj författare"
}

function mediaHref(media: CatalogMedia): string {
  return media.downloadable ? media.url : canonicalNuxtHref(`${media.url}#dw`)
}

function titleHref(media: CatalogMedia): string {
  return canonicalNuxtHref(`${media.url}#dw`)
}

function sourceInfoIdentityFromMedia(media: CatalogMedia) {
  if (
    media.media_type !== "infopost"
    || !isSafeCatalogMediaUrl(media.media_type, media.url, media.downloadable)
  ) return null
  const parsed = new URL(media.url, "http://catalog.local")
  const authorId = parsed.searchParams.get("authorid")
  const titlePath = parsed.searchParams.get("titlepath")
  return validSourceInfoSegment(authorId, 100) && validSourceInfoSegment(titlePath, 200)
    ? { authorId, titlePath }
    : null
}

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const config = useRuntimeConfig()
const requestFetch = useRequestFetch()
const client = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)

const sourceInfoIdentity = computed(() => {
  const marker = route.query["om-boken"]
  if (
    !Object.prototype.hasOwnProperty.call(route.query, "om-boken")
    || !readerSourceInfoIsOpen(marker)
  ) return null
  const authorId = route.query.authorid
  const titlePath = route.query.titlepath
  return validSourceInfoSegment(authorId, 100) && validSourceInfoSegment(titlePath, 200)
    ? { authorId, titlePath }
    : null
})
const sourceInfoRequestIdentity = computed(() => sourceInfoIdentity.value
  ? `${sourceInfoIdentity.value.authorId}|${sourceInfoIdentity.value.titlePath}`
  : "")
const initialSourceInfoRequested = sourceInfoIdentity.value !== null
type CatalogSourceInfoResult =
  | { status: "success", identity: string, sourceInfo: ReaderSourceInfo }
  | { status: "error", identity: string }

const sourceInfoFetch = await useAsyncData<CatalogSourceInfoResult>(
  "dramawebben-source-info",
  async () => {
    const identity = sourceInfoIdentity.value
    const requestIdentity = sourceInfoRequestIdentity.value
    if (!identity) return { status: "error" as const, identity: requestIdentity }
    try {
      const sourceInfo = await requestFetch<ReaderSourceInfo>(
        "/api/reader/source-info/"
        + [identity.authorId, identity.titlePath].map(encodeURIComponent).join("/"),
        { retry: 0 }
      )
      return { status: "success" as const, identity: requestIdentity, sourceInfo }
    } catch {
      return { status: "error" as const, identity: requestIdentity }
    }
  },
  { immediate: initialSourceInfoRequested }
)

const sourceInfo = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "success"
    && current.identity === sourceInfoRequestIdentity.value
    ? current.sourceInfo
    : null
})
const sourceInfoFailed = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "error" && current.identity === sourceInfoRequestIdentity.value
})
const sourceInfoLoading = computed(() => sourceInfoIdentity.value !== null
  && !sourceInfo.value
  && !sourceInfoFailed.value
  && (sourceInfoFetch.status.value === "idle" || sourceInfoFetch.status.value === "pending"))
const sourceInfoOpen = computed(() => sourceInfoIdentity.value !== null)

watch(sourceInfoRequestIdentity, identity => {
  if (!identity || (import.meta.client && nuxtApp.isHydrating)) return
  const current = sourceInfoFetch.data.value
  if (!current || current.identity !== identity || current.status === "error") {
    void sourceInfoFetch.execute()
  }
})

onMounted(() => {
  const identity = sourceInfoRequestIdentity.value
  const current = sourceInfoFetch.data.value
  if (identity && (!current || current.identity !== identity)) {
    void sourceInfoFetch.execute()
  }
})

let sourceInfoTrigger: HTMLElement | null = null

function sourceInfoQuery(authorId?: string, titlePath?: string) {
  const query = { ...route.query }
  delete query["om-boken"]
  delete query.authorid
  delete query.titlepath
  if (authorId && titlePath) {
    query["om-boken"] = null
    query.authorid = authorId
    query.titlepath = titlePath
  }
  return query
}

async function pushSourceInfoQuery(
  query: ReturnType<typeof sourceInfoQuery>,
  hash: string
): Promise<void> {
  await router.push({ path: route.path, query })
  if (import.meta.client && hash) {
    const target = router.resolve({ path: route.path, query, hash }).fullPath
    window.history.replaceState(window.history.state, "", target)
  }
}

function openCatalogSourceInfo(event: MouseEvent, media: CatalogMedia): void {
  const identity = sourceInfoIdentityFromMedia(media)
  if (
    !identity || event.button !== 0 || event.altKey || event.ctrlKey
    || event.metaKey || event.shiftKey
  ) return
  event.preventDefault()
  sourceInfoTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const href = sourceInfoTrigger?.getAttribute("href") ?? ""
  const hash = href.includes("#") ? `#${href.split("#", 2)[1]}` : route.hash
  void pushSourceInfoQuery(sourceInfoQuery(identity.authorId, identity.titlePath), hash)
}

async function closeCatalogSourceInfo(): Promise<void> {
  if (!sourceInfoOpen.value) return
  const hash = import.meta.client ? window.location.hash : route.hash
  await pushSourceInfoQuery(sourceInfoQuery(), hash)
  await nextTick()
  sourceInfoTrigger?.focus()
  sourceInfoTrigger = null
}

const { data } = await useAsyncData<CatalogResult>(
  "dramawebben-catalog",
  async () => {
    try {
      const { data: response, error, response: rawResponse } = await client.GET(
        "/dramawebben/catalog"
      )
      if (!error && isCatalog(response)) return { status: 200, catalog: response }
      return { status: rawResponse.status >= 500 && error ? 503 : 502, catalog: null }
    } catch {
      return { status: 503, catalog: null }
    }
  },
  { getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as CatalogResult | undefined }
)

const result = computed<CatalogResult>(() => data.value ?? { status: 503, catalog: null })
if (import.meta.server && result.value.status !== 200) setResponseStatus(result.value.status)

const catalog = computed(() => result.value.catalog)
const listType = computed<"pjäser" | "författare">(() => (
  oneQuery(route.query.visa) === "författare" ? "författare" : "pjäser"
))
const gender = computed(() => {
  const value = oneQuery(route.query.gender)
  return genderOptions.some(option => option.value === value) ? value! : "all"
})
const authorId = computed(() => {
  const value = oneQuery(route.query.author)
  return value && catalog.value?.authors.some(author => author.author_id === value) ? value : "all"
})
const mediaType = computed(() => {
  const value = oneQuery(route.query.mediatype)
  return mediaOptions.some(option => option.value === value) ? value! : "all"
})
const genderLabel = computed(() => {
  const selected = oneQuery(route.query.gender)
  return selected
    ? genderOptions.find(option => option.value === selected)?.label || "Välj kön"
    : "Välj kön"
})
const mediaLabel = computed(() => {
  const selected = oneQuery(route.query.mediatype)
  return selected
    ? mediaOptions.find(option => option.value === selected)?.label || "Utgivningsformat"
    : "Utgivningsformat"
})
const filterText = computed(() => oneQuery(route.query.filterTxt) || "")
const childrenOnly = computed(() => Object.prototype.hasOwnProperty.call(route.query, "barnlitteratur"))
const authorSearch = ref("")

const ranges = computed(() => Object.fromEntries(rangeFields.map(({ key }) => {
  const values = (catalog.value?.works ?? [])
    .map(work => work[key])
    .filter((value): value is number => typeof value === "number")
  return [key, {
    floor: values.length ? Math.min(...values) : 0,
    ceil: values.length ? Math.max(...values) : 0
  }]
})) as Record<RangeKey, { floor: number, ceil: number }>)

function selectedRange(key: RangeKey): { from: number, to: number, active: boolean } {
  const fallback = ranges.value[key]
  const raw = oneQuery(route.query[key])
  if (!raw) return { from: fallback.floor, to: fallback.ceil, active: false }
  const parts = raw.split(",")
  if (parts.length !== 2 || !parts.every(part => /^\d+$/u.test(part))) {
    return { from: fallback.floor, to: fallback.ceil, active: false }
  }
  const from = Number(parts[0])
  const to = Number(parts[1])
  if (
    !Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from > to || from < fallback.floor || to > fallback.ceil
  ) {
    return { from: fallback.floor, to: fallback.ceil, active: false }
  }
  return {
    from,
    to,
    active: true
  }
}

const filteredAuthors = computed(() => {
  const tokens = normalizedTokens(filterText.value)
  return (catalog.value?.authors ?? []).filter(author => {
    if (gender.value !== "all") return author.gender === gender.value
    if (!tokens.length) return true
    const haystack = [author.full_name, author.birth_year, author.death_year]
      .filter(Boolean).join(" ").toLocaleLowerCase("sv-SE")
    return tokens.every(token => haystack.includes(token))
  })
})

const authorOptions = computed(() => {
  const query = authorSearch.value.trim().toLocaleLowerCase("sv-SE")
  if (!query) return catalog.value?.authors ?? []
  const terms = normalizedTokens(query)
  return (catalog.value?.authors ?? []).filter(author => terms.every(term => (
    author.full_name.toLocaleLowerCase("sv-SE").includes(term)
  )))
})

const selectedAuthor = computed(() => (
  catalog.value?.authors.find(author => author.author_id === authorId.value) ?? null
))

const filteredWorks = computed(() => {
  const tokens = normalizedTokens(filterText.value)
  return (catalog.value?.works ?? []).filter(work => {
    if (gender.value !== "all" && work.authors[0]?.gender !== gender.value) return false
    if (authorId.value !== "all" && !work.authors.some(author => author.author_id === authorId.value)) {
      return false
    }
    if (mediaType.value !== "all" && !work.media.some(media => media.media_type === mediaType.value)) {
      return false
    }
    if (childrenOnly.value && !work.is_childrens_play) return false
    if (tokens.length) {
      const authorText = work.authors.flatMap(author => [
        author.full_name, author.birth_year ?? "", author.death_year ?? ""
      ]).join(" ")
      const haystack = `${authorText} ${work.title}`.toLocaleLowerCase("sv-SE")
      if (!tokens.every(token => haystack.includes(token))) return false
    }
    return rangeFields.every(({ key }) => {
      const range = selectedRange(key)
      if (!range.active) return true
      const value = work[key]
      return typeof value === "number" && range.from <= value && value <= range.to
    })
  })
})

async function setQuery(key: string, value: string | null, push = false) {
  const query = { ...route.query }
  if (value === null || value === "" || value === "all") delete query[key]
  else query[key] = value
  await (push ? router.push({ path: route.path, query }) : router.replace({ path: route.path, query }))
}

function chooseAuthor(author: CatalogAuthor | null) {
  authorSearch.value = ""
  void setQuery("author", author?.author_id ?? null)
}

function setRange(key: RangeKey, side: "from" | "to", value: string) {
  const current = selectedRange(key)
  const number = Number(value)
  if (!Number.isFinite(number)) return
  let from = side === "from" ? number : current.from
  let to = side === "to" ? number : current.to
  if (from > to) [from, to] = [to, from]
  void setQuery(key, `${from},${to}`)
}

function setChildren() {
  void setQuery("barnlitteratur", childrenOnly.value ? null : "true")
}

useSeoMeta({
  title: "Litteraturbanken",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})
useHead(() => ({
  bodyAttrs: {
    class: sourceInfoOpen.value
      ? "focus page-dramaweb drama-dramasubpage ready modal-open"
      : "focus page-dramaweb drama-dramasubpage ready"
  }
}))
</script>

<template>
  <span id="dw" class="drama_hash_target" aria-hidden="true" />
  <DramawebbenShell page="pjäser">
    <div v-if="catalog" class="catalog_page" :class="{ catalog_plays: listType === 'pjäser' }">
      <p class="max-w-prose mb-8">
        I Dramawebben hittar du pjäser som har mer metadata, till exempel information om
        hur många roller det är. Det finns många fler pjäser i Litteraturbanken som du
        kan hitta i
        <NuxtLink to="/bibliotek?keywords=texttype:drama;dramasamling&amp;visa=works&amp;sort=titlar">Biblioteket</NuxtLink>.
      </p>

      <div class="controls">
        <div class="btn-group">
          <button
            type="button"
            class="sc btn btn-primary"
            :class="{ active: listType === 'pjäser' }"
            :aria-pressed="listType === 'pjäser'"
            @click="setQuery('visa', null, true)"
          >Pjäser</button>
          <button
            type="button"
            class="sc btn btn-primary"
            :class="{ active: listType === 'författare' }"
            :aria-pressed="listType === 'författare'"
            @click="setQuery('visa', 'författare', true)"
          >Författare</button>
        </div>

        <div v-show="listType === 'pjäser'" class="auth_select_container">
          <Combobox :model-value="selectedAuthor" nullable @update:model-value="chooseAuthor">
            <div class="catalog_select select2 select2-container select2-container--default">
              <div class="select2-selection select2-selection--single">
                <ComboboxInput
                  class="select2-selection__rendered"
                  aria-label="Författare"
                  placeholder="Välj författare"
                  :display-value="selectedAuthorLabel"
                  @change="authorSearch = ($event.target as HTMLInputElement).value"
                />
                <ComboboxButton class="select2-selection__arrow" aria-label="Visa författare"><b /></ComboboxButton>
              </div>
              <ComboboxOptions class="catalog_options select2-results__options">
                <ComboboxOption :value="null" v-slot="{ active }" as="template">
                  <li class="select2-results__option" :class="{ 'select2-results__option--highlighted': active }">Alla författare</li>
                </ComboboxOption>
                <ComboboxOption
                  v-for="author in authorOptions"
                  :key="author.author_id"
                  v-slot="{ active, selected }"
                  :value="author"
                  as="template"
                >
                  <li class="select2-results__option" :class="{ 'select2-results__option--highlighted': active, 'select2-results__option--selected': selected }">
                    {{ author.name_for_index }} {{ authorYear(author) }}
                  </li>
                </ComboboxOption>
              </ComboboxOptions>
            </div>
          </Combobox>
        </div>

        <Listbox :model-value="gender" @update:model-value="setQuery('gender', $event as string)">
          <div class="catalog_select gender_select select2 select2-container select2-container--default">
            <ListboxButton class="select2-selection select2-selection--single" aria-label="Kön">
              <span class="select2-selection__rendered">{{ genderLabel }}</span>
              <span class="select2-selection__arrow"><b /></span>
            </ListboxButton>
            <ListboxOptions class="catalog_options select2-results__options">
              <ListboxOption v-for="option in genderOptions" :key="option.value" v-slot="{ active, selected }" :value="option.value" as="template">
                <li class="select2-results__option" :class="{ 'select2-results__option--highlighted': active, 'select2-results__option--selected': selected }">{{ option.label }}</li>
              </ListboxOption>
            </ListboxOptions>
          </div>
        </Listbox>

        <Listbox :model-value="mediaType" @update:model-value="setQuery('mediatype', $event as string)">
          <div class="catalog_select filter_select keyword_select select2 select2-container select2-container--default">
            <ListboxButton class="select2-selection select2-selection--single" aria-label="Utgivningsformat">
              <span class="select2-selection__rendered">{{ mediaLabel }}</span>
              <span class="select2-selection__arrow"><b /></span>
            </ListboxButton>
            <ListboxOptions class="catalog_options select2-results__options">
              <ListboxOption v-for="option in mediaOptions" :key="option.value" v-slot="{ active, selected }" :value="option.value" as="template">
                <li class="select2-results__option" :class="{ 'select2-results__option--highlighted': active, 'select2-results__option--selected': selected }">{{ option.label }}</li>
              </ListboxOption>
            </ListboxOptions>
          </div>
        </Listbox>

        <div class="auth_select_container">
          <Popover v-if="listType === 'pjäser'" v-slot="{ open: isOpen }">
            <div class="btn-group" :class="{ open: isOpen }">
              <PopoverButton type="button" class="btn btn-primary filter_btn">
                Akter och roller <span class="caret" />
              </PopoverButton>
              <PopoverPanel as="ul" class="dropdown-menu" role="group">
              <li v-for="field in rangeFields" :key="field.key" :class="{ dirty: selectedRange(field.key).active }">
                <span class="label">{{ field.label }}</span>
                <div class="number_input catalog_range">
                  <span class="range_values"><span>{{ selectedRange(field.key).from }}</span><span>{{ selectedRange(field.key).to }}</span></span>
                  <input
                    type="range"
                    :aria-label="`${field.label} från`"
                    :min="ranges[field.key].floor"
                    :max="ranges[field.key].ceil"
                    :value="selectedRange(field.key).from"
                    @change="setRange(field.key, 'from', ($event.target as HTMLInputElement).value)"
                  >
                  <input
                    type="range"
                    :aria-label="`${field.label} till`"
                    :min="ranges[field.key].floor"
                    :max="ranges[field.key].ceil"
                    :value="selectedRange(field.key).to"
                    @change="setRange(field.key, 'to', ($event.target as HTMLInputElement).value)"
                  >
                </div>
              </li>
              <li>
                <span class="label">Barnpjäs</span>
                <button type="button" class="fa check" :class="{ 'fa-check': childrenOnly }" aria-label="Barnpjäs" :aria-pressed="childrenOnly" @click="setChildren" />
              </li>
              </PopoverPanel>
            </div>
          </Popover>
        </div>

        <input
          class="filter"
          :value="filterText"
          autofocus
          placeholder="Sök"
          aria-label="Sök"
          @input="setQuery('filterTxt', ($event.target as HTMLInputElement).value)"
        >
        <button v-if="Object.keys(route.query).length" type="button" class="btn btn-small clear_filter" @click="router.replace({ path: route.path, query: {} })">
          Rensa filter
        </button>
      </div>

      <table v-if="listType === 'pjäser'" class="contenttable">
        <tbody>
          <tr v-for="work in filteredWorks" :key="work.work_id">
            <td class="author">
              <NuxtLink :to="authorProfilePath(work.authors[0]!.author_id, 'dramawebben')">
                <span class="sc">{{ authorName(work.authors[0]!).surname }}</span><template v-if="authorName(work.authors[0]!).given">,<span class="firstname">{{ " " }}{{ authorName(work.authors[0]!).given }}</span></template>
              </NuxtLink>
            </td>{{ " " }}
            <td class="title"><a
              v-if="work.media[0]!.downloadable"
              :href="titleHref(work.media[0]!)"
            >{{ work.short_title || work.title }}</a><NuxtLink
              v-else
              :to="titleHref(work.media[0]!)"
              @click="work.media[0]!.media_type === 'infopost' && openCatalogSourceInfo($event, work.media[0]!)"
            >{{ work.short_title || work.title }}</NuxtLink></td>{{ " " }}
            <td>
              <ul class="mediatypes">
                <li v-for="(media, index) in work.media" :key="`${media.media_type}-${index}`">
                  <a v-if="media.downloadable" class="sc" target="_self" download :href="media.url">{{ media.media_type }}</a>
                  <NuxtLink
                    v-else
                    class="sc"
                    :to="mediaHref(media)"
                    @click="media.media_type === 'infopost' && openCatalogSourceInfo($event, media)"
                  >{{ media.media_type }}</NuxtLink>
                  {{ " " }}
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-else class="contenttable authors">
        <tbody>
          <tr v-for="author in filteredAuthors" :key="author.author_id">
            <td class="author">
              <NuxtLink :to="authorProfilePath(author.author_id, 'dramawebben')">
                <span class="sc">{{ authorName(author).surname }}</span><template v-if="authorName(author).given">,<span class="firstname">{{ " " }}{{ authorName(author).given }}</span></template>
              </NuxtLink>
            </td>{{ " " }}
            <td>{{ authorYear(author) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="error">Innehållet kan inte visas just nu.</p>
  </DramawebbenShell>
  <ReaderSourceInfoDialog
    :open="sourceInfoOpen"
    :loading="sourceInfoLoading"
    :failed="sourceInfoFailed"
    :source-info="sourceInfo"
    @close="closeCatalogSourceInfo"
  />
</template>

<style scoped>
.drama_hash_target {
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
.catalog_select {
  display: inline-block;
  position: relative;
  vertical-align: middle;
  width: 200px !important;
  margin-bottom: 0;
}
.catalog_select .select2-selection--single {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 1px 20px 0 8px;
  border: 1px solid #999 !important;
  background: white !important;
  text-align: left;
}
.catalog_select input.select2-selection__rendered {
  display: block !important;
  max-width: none !important;
  width: 100%;
  height: 24px;
  padding: 0;
  border: 0 !important;
  outline: 0;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
}
.catalog_select .select2-selection__arrow {
  position: absolute;
  top: 0;
  right: 1px;
  width: 20px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
}
.catalog_select .select2-selection__arrow b {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  margin-top: -2px;
  margin-left: -4px;
  border-color: #888 transparent transparent;
  border-style: solid;
  border-width: 5px 4px 0;
}
.catalog_options {
  position: absolute;
  z-index: 30;
  width: 200px;
  max-height: 350px;
  overflow-y: auto;
  padding: 0;
  border: 1px solid #aaa;
  background: white;
  color: #333;
  list-style: none;
}
.catalog_options .select2-results__option { padding: 6px; }
.controls > .btn-group:first-child {
  display: block;
  margin-bottom: 0;
}
.controls > .btn-group:first-child .btn { height: 34.421875px; }
.controls > .btn-group:first-child .btn.active {
  color: black;
  background-color: #fff;
  background-image: linear-gradient(to top, #eee 0%, #fff 50%);
  box-shadow: none;
}
.controls > .btn-group:first-child .btn:first-child { width: 75px; }
.controls > .btn-group:first-child .btn:last-child {
  width: 115px;
  margin-left: 6px;
}
.controls > .auth_select_container,
.controls > .catalog_select { margin-right: 4.53125px; }
.controls > input.filter { margin-right: 4.53125px; }
.controls .auth_select_container .btn-group {
  position: relative;
  display: inline-block;
  vertical-align: middle;
}
.catalog_select .select2-selection__rendered,
.catalog_select .select2-selection__rendered::placeholder {
  color: #999;
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  font-variant: normal;
  text-transform: lowercase !important;
  opacity: 1;
}
.controls .dropdown-menu > li:not(:last-child) { min-height: 54px; }
.controls .dropdown-menu > li:last-child { min-height: 18px; }
.controls .dropdown-menu { margin-top: 1px; }
.catalog_range {
  position: relative;
  min-height: 48px;
  padding-top: 14px;
}
.catalog_range .range_values {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  width: 100%;
  justify-content: space-between;
  font-size: 12px;
}
.catalog_range input[type="range"] {
  appearance: none;
  position: absolute;
  left: 0;
  top: 18px;
  display: block;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  pointer-events: none;
}
.catalog_range input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background: #7a1400;
}
.catalog_range input[type="range"]:last-of-type::-webkit-slider-runnable-track {
  background: transparent;
}
.catalog_range input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 15px;
  height: 15px;
  margin-top: -6px;
  border: 1px solid darkgrey;
  border-radius: 50%;
  background: white;
  box-shadow: 1px 1px 3px grey;
  pointer-events: auto;
}
.controls .filter_btn .caret {
  background-image: none !important;
  background-size: auto !important;
}
.controls .filter_btn:focus {
  outline: 0 !important;
  box-shadow: none !important;
}
@media (max-width: 639px) {
  .catalog_page.catalog_plays::after {
    display: block;
    height: 62px;
    content: "";
  }
}
</style>
