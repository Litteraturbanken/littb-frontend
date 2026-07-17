<script setup lang="ts">
type LibraryIndex =
  | "etext"
  | "faksimil"
  | "pdf"
  | "etext-part"
  | "faksimil-part"
  | "author"
  | "presentations"
  | "sol"
  | "litteraturkartan"
  | "wordpress"

type LibraryResult = {
  index: LibraryIndex
  sourceLabel: string
  primaryLabel: string
  primaryHref: string
  download: boolean
  yearLabel: string
  secondaryAuthor: string
  authorHref: string
  authorSurname: string
  authorGivenNames: string
  mobileYearLabel: string
}

type LibraryResponse = {
  data: LibraryResult[]
  hits: number
  suggest: unknown[]
  failed: boolean
}

type UnknownRecord = Record<string, unknown>

const textIndexes = new Set<LibraryIndex>([
  "etext", "faksimil", "etext-part", "faksimil-part"
])

const wordpressLabels: Record<string, string> = {
  ljudochbild: "Ljud och bild",
  diktensmuseum: "Diktens museum",
  skolan: "Skolan",
  bibliotekariesidor: "Bibliotekariesidor"
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function stringAt(record: UnknownRecord | null, key: string): string {
  const value = record?.[key]
  if (typeof value === "string") return value.trim()
  return typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

function recordAt(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return asRecord(record?.[key])
}

function recordsAt(record: UnknownRecord | null, key: string): UnknownRecord[] {
  const value = record?.[key]
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is UnknownRecord => item !== null)
    : []
}

function baseResult(index: LibraryIndex): LibraryResult {
  return {
    index,
    sourceLabel: "",
    primaryLabel: "",
    primaryHref: "",
    download: false,
    yearLabel: "",
    secondaryAuthor: "",
    authorHref: "",
    authorSurname: "",
    authorGivenNames: "",
    mobileYearLabel: ""
  }
}

function safeProvidedDestination(value: string): string {
  if (!value || /[\u0000-\u001F\u007F]/.test(value)) return ""
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    const url = new URL(value, "https://litteraturbanken.se")
    return url.origin === "https://litteraturbanken.se"
      ? `${url.pathname}${url.search}${url.hash}`
      : ""
  }
  try {
    const url = new URL(value)
    const expectedHost = url.hostname === "litteraturbanken.se"
      || url.hostname.endsWith(".litteraturbanken.se")
    return expectedHost && (url.protocol === "https:" || url.protocol === "http:")
      ? url.href
      : ""
  } catch {
    return ""
  }
}

function optionalYear(record: UnknownRecord, key: string): string {
  return stringAt(recordAt(record, key), "plain")
}

function imprintYear(record: UnknownRecord): string {
  return optionalYear(record, "sort_date_imprint")
}

function parseMainAuthor(record: UnknownRecord): {
  id: string
  name: string
} | null {
  const mainAuthor = recordAt(record, "main_author")
  const id = stringAt(mainAuthor, "authorid")
  const name = stringAt(mainAuthor, "full_name")
  return id && name ? { id, name } : null
}

function parseTextResult(record: UnknownRecord, index: LibraryIndex): LibraryResult | null {
  const label = stringAt(record, "shorttitle") || stringAt(record, "title")
  const texttype = stringAt(record, "texttype")
  const media = stringAt(record, "mediatype")
  const page = stringAt(record, "startpagename")
  const title = stringAt(record, "work_titleid") || stringAt(record, "titleid")
  const mainAuthor = parseMainAuthor(record)
  const workAuthor = stringAt(recordsAt(record, "work_authors")[0] ?? null, "authorid")
  const author = index.endsWith("-part") ? workAuthor : workAuthor || mainAuthor?.id || ""
  if (!label || !texttype || !media || !page || !title || !author || !mainAuthor) return null

  return {
    ...baseResult(index),
    sourceLabel: texttype,
    primaryLabel: label,
    primaryHref: `/författare/${encodeURIComponent(author)}/titlar/${encodeURIComponent(title)}/sida/${encodeURIComponent(page)}/${encodeURIComponent(media)}`,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/författare/${encodeURIComponent(mainAuthor.id)}`
  }
}

function parsePdfResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "shorttitle") || stringAt(record, "title")
  const texttype = stringAt(record, "texttype")
  const id = stringAt(record, "lbworkid")
  const mainAuthor = parseMainAuthor(record)
  if (!label || !texttype || !id || !mainAuthor) return null
  const encodedId = encodeURIComponent(id)
  return {
    ...baseResult("pdf"),
    sourceLabel: texttype,
    primaryLabel: label,
    primaryHref: `/txt/${encodedId}/${encodedId}.pdf`,
    download: true,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/författare/${encodeURIComponent(mainAuthor.id)}`
  }
}

function parseAuthorResult(record: UnknownRecord): LibraryResult | null {
  const id = stringAt(record, "authorid")
  const label = stringAt(record, "name_for_index")
  if (!id || !label) return null
  const [surname, ...givenParts] = label.split(",")
  const authorSurname = surname?.trim() ?? ""
  const authorGivenNames = givenParts.join(",").trim()
  if (!authorSurname) return null
  const birth = optionalYear(record, "birth")
  const death = optionalYear(record, "death")
  const years = birth || death ? `${birth}–${death}` : ""
  return {
    ...baseResult("author"),
    sourceLabel: "Författare",
    primaryLabel: label,
    primaryHref: `/författare/${encodeURIComponent(id)}/`,
    yearLabel: years,
    authorSurname,
    authorGivenNames,
    mobileYearLabel: years ? `(${years})` : ""
  }
}

function parsePresentationResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "title")
  const href = safeProvidedDestination(stringAt(record, "url"))
  const author = stringAt(record, "article_author")
  if (!label || !href || !author) return null
  return {
    ...baseResult("presentations"),
    sourceLabel: "Kringtexter",
    primaryLabel: label,
    primaryHref: href,
    secondaryAuthor: author
  }
}

function parseSolResult(record: UnknownRecord): LibraryResult | null {
  const article = recordAt(record, "article")
  const contributor = recordAt(record, "contributors")
  const label = stringAt(article, "ArticleName")
  const name = stringAt(article, "URLName")
  const firstName = stringAt(contributor, "FirstName")
  const lastName = stringAt(contributor, "LastName")
  if (!label || !name || !firstName || !lastName) return null
  return {
    ...baseResult("sol"),
    sourceLabel: "Översättarlexikon",
    primaryLabel: label,
    primaryHref: `https://litteraturbanken.se/översättarlexikon/artiklar/${encodeURIComponent(name)}`,
    secondaryAuthor: `${firstName} ${lastName}`
  }
}

function parseMapResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "header")
  const place = stringAt(record, "placeid")
  const id = stringAt(record, "id")
  const author = stringAt(record, "article_author")
  if (!label || !place || !id || !author) return null
  return {
    ...baseResult("litteraturkartan"),
    sourceLabel: "Litteraturkartan",
    primaryLabel: label,
    primaryHref: `https://litteraturbanken.se/litteraturkartan/?id=${encodeURIComponent(place)}&article=${encodeURIComponent(id)}`,
    secondaryAuthor: author
  }
}

function parseWordpressResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "title")
  const href = safeProvidedDestination(stringAt(record, "link"))
  const sourceLabel = wordpressLabels[stringAt(record, "source")] ?? ""
  if (!label || !href || !sourceLabel) return null
  return {
    ...baseResult("wordpress"),
    sourceLabel,
    primaryLabel: label,
    primaryHref: href
  }
}

function parseResult(value: unknown): LibraryResult | null {
  const record = asRecord(value)
  if (!record) return null
  const index = stringAt(record, "_index") as LibraryIndex
  if (textIndexes.has(index)) return parseTextResult(record, index)
  if (index === "pdf") return parsePdfResult(record)
  if (index === "author") return parseAuthorResult(record)
  if (index === "presentations") return parsePresentationResult(record)
  if (index === "sol") return parseSolResult(record)
  if (index === "litteraturkartan") return parseMapResult(record)
  if (index === "wordpress") return parseWordpressResult(record)
  return null
}

function parseLibraryResponse(value: unknown): LibraryResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error("Invalid Library relevance response")
  }
  return {
    data: record.data.map(parseResult).filter((item): item is LibraryResult => item !== null),
    hits: record.hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false
  }
}

function emptyLibraryResponse(failed = false): LibraryResponse {
  return { data: [], hits: 0, suggest: [], failed }
}

type SortKey = "relevans" | "forfattare" | "titlar" | "kronologi"

const resultTypes = "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
const excludedFields = "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector"
const backgroundPath = "/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg"
const description = "Blädda bland Litteraturbankens författare och titlar."

const sorts: Array<{ key: SortKey, label: string, expression: string }> = [
  { key: "relevans", label: "Relevans", expression: "_score|desc" },
  { key: "forfattare", label: "Författare", expression: "main_author.name_for_index|asc,sortkey|asc" },
  { key: "titlar", label: "Titel", expression: "sortkey|asc" },
  { key: "kronologi", label: "Tryckår", expression: "sort_date_imprint.date|desc" }
]

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

function queryValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function sortKey(value: unknown): SortKey {
  return sorts.some(item => item.key === value) ? value as SortKey : "relevans"
}

function sanitizeFilter(value: string): string {
  return value
    .replace(/([A-Öa-ö])[-–—]([A-Öa-ö])/g, "$1 $2")
    .replace(/[.,!"“'”]/g, "")
    .trim()
}

function requestUrl(base: string, filter: string, selectedSort: SortKey): string {
  const params = new URLSearchParams({
    exclude: excludedFields,
    show_all: "false",
    sort_field: sorts.find(item => item.key === selectedSort)?.expression ?? "_score|desc",
    from: "0",
    to: "100",
    vectorize: "true",
    sid: "true"
  })
  const sanitized = sanitizeFilter(filter)
  if (sanitized) params.set("q", `(${sanitized})`)
  return `${base.replace(/\/$/, "")}/relevance/${resultTypes}?${params}`
}

async function fetchResults(
  base: string,
  filter: string,
  selectedSort: SortKey,
  signal?: AbortSignal
): Promise<LibraryResponse> {
  try {
    const response = await $fetch<unknown>(requestUrl(base, filter, selectedSort), {
      signal,
      retry: 0
    })
    return parseLibraryResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyLibraryResponse(true)
  }
}

const initialFilter = queryValue(route.query.filter)
const initialSort = sortKey(route.query.sort)
const { data: initialData } = await useAsyncData(
  `library:${route.fullPath}`,
  () => fetchResults(config.libraryApiBase, initialFilter, initialSort),
  { default: () => emptyLibraryResponse() }
)

const filter = ref(initialFilter)
const selectedSort = ref(initialSort)
const results = ref(initialData.value ?? emptyLibraryResponse())
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0
let ownedNavigation: { key: string, version: number } | null = null

type QueryState = { filter: string, sort: SortKey }

function stateKey(state: QueryState): string {
  return JSON.stringify([state.filter, state.sort])
}

function cancelPending() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  controller?.abort()
  controller = null
}

function invalidateIntent(): number {
  cancelPending()
  loading.value = false
  return ++requestVersion
}

function queryFor(state: QueryState) {
  const query = { ...route.query }
  if (state.filter) query.filter = state.filter
  else delete query.filter
  if (state.sort === "relevans") delete query.sort
  else query.sort = state.sort
  return query
}

async function runBrowserRequest(state: QueryState, version: number) {
  if (version !== requestVersion) return
  controller = new AbortController()
  loading.value = true
  const response = await fetchResults(
    config.public.libraryApiBase,
    state.filter,
    state.sort,
    controller.signal
  ).catch(() => null)
  if (version !== requestVersion || response === null) return
  results.value = response
  loading.value = false
  controller = null
}

async function persistAndRequest(state: QueryState, version: number) {
  if (version !== requestVersion) return
  const navigation = { key: stateKey(state), version }
  ownedNavigation = navigation
  try {
    await router.replace({ query: queryFor(state) })
  } finally {
    if (ownedNavigation === navigation) ownedNavigation = null
  }
  if (version === requestVersion) await runBrowserRequest(state, version)
}

function beginIntent(state: QueryState, delay = 0) {
  const captured = Object.freeze({ ...state })
  const version = invalidateIntent()
  filter.value = captured.filter
  selectedSort.value = captured.sort
  if (delay > 0) {
    timer = setTimeout(() => {
      timer = null
      void persistAndRequest(captured, version)
    }, delay)
    return
  }
  void persistAndRequest(captured, version)
}

function scheduleSearch() {
  beginIntent({ filter: filter.value, sort: selectedSort.value }, 300)
}

function submitSearch() {
  beginIntent({ filter: filter.value, sort: selectedSort.value })
}

function resetSearch() {
  beginIntent({ filter: "", sort: selectedSort.value })
}

function selectSort(key: SortKey) {
  beginIntent({ filter: filter.value, sort: key })
}

watch(
  () => [queryValue(route.query.filter), sortKey(route.query.sort)] as const,
  ([nextFilter, nextSort]) => {
    const state = { filter: nextFilter, sort: nextSort }
    filter.value = state.filter
    selectedSort.value = state.sort
    if (ownedNavigation?.key === stateKey(state)) return
    const version = invalidateIntent()
    void runBrowserRequest(state, version)
  },
  { flush: "sync" }
)

function disposeLibraryRequest() {
  requestVersion += 1
  cancelPending()
}

useSeoMeta({
  title: "Biblioteket – Titlar och författare | Litteraturbanken",
  description
})
useHead({
  htmlAttrs: { style: `background: url('${backgroundPath}') no-repeat;` },
  bodyAttrs: { class: "focus page-library ready" }
})

onUnmounted(disposeLibraryRequest)
</script>

<template>
  <div>
    <h1 class="text-6xl lg:ml-12">Botanisera i biblioteket</h1>
    <div class="lg:ml-12" :class="{ searching: loading }">
      <div id="controls">
        <form
          class="lg:p-5 p-2 lg:border border-gray-900 w-full lg:max-w-5xl"
          @submit.prevent="submitSearch"
        >
          <div class="main_input flex flex-wrap -ml-6 relative mb-8 items-center">
            <svg class="w-6 h-6 relative left-10 top-0 -mt-px" viewBox="0 0 24 24" fill="none" stroke="#7A1400" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              v-model="filter"
              data-library-filter
              class="filter_input border border-gray-500 mr-4 flex-grow py-3 pl-12 pr-4 text-base"
              autofocus
              placeholder="Skriv författarnamn eller titel"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              @input="scheduleSearch"
            >
            <button type="submit" class="sr-only" tabindex="-1">Sök</button>
            <button
              v-show="filter"
              type="button"
              data-library-reset
              class="reset text-gray-700 transition duration-200 w-6 h-6 relative -left-14 top-0 -mr-8 cursor-pointer bg-transparent border-0 p-0"
              aria-label="Rensa sökning"
              @click="resetSearch"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              data-library-advanced
              disabled
              title="Utökad sökning är inte tillgänglig ännu"
              class="bg-white border border-gray-500 self-stretch px-4 focus:ring-1 focus:ring-inset focus:ring-primary"
            >
              <span class="uppercase text-xs">Visa utökad sökning</span>
              <svg
                data-library-filter-icon
                class="filter w-6 h-6 relative top-1 inline-block text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
              </svg>
            </button>
          </div>
          <div class="chronology primarycolor ml-px pl-px">
            <i class="fa fa-clock-o mr-1 ml-px" />
            <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
          </div>
          <div class="btn-group p-0 mt-4 lg:mt-6">
            <button data-library-tab type="button" class="sc btn btn-small text-base active">Alla träffar</button>
            <button
              v-for="tab in ['Nytt', 'Författare', 'Verk', 'Dikt, novell, etc.', 'Epub', 'PDF']"
              :key="tab"
              data-library-tab
              data-deferred
              type="button"
              disabled
              title="Inte tillgänglig i denna version"
              class="sc btn btn-small text-base disabled"
            >{{ tab }}</button>
          </div>
        </form>
      </div>
      <div class="flex items-stretch w-full lg:max-w-5xl text-lg leading-tight">
        <div class="bg-white/65 lg:p-6 p-2 lg:border border-gray-900 flex-grow">
          <div class="result relevance pl-0 lg:ml-3 lg:ml-0 w-full lg:w-auto">
            <div class="text-base">
              <div class="inline-block sc mr-2">Sortera: </div>
              <ul class="part_header top_header mb-4 inline-block">
                <li v-for="item in sorts" :key="item.key" class="inline-block sc">
                  <a
                    href=""
                    class="sort_item"
                    :class="{ active: selectedSort === item.key }"
                    :data-library-sort="item.key"
                    @click.prevent="selectSort(item.key)"
                  >{{ item.label }}</a>
                  <i v-if="selectedSort === item.key" class="fa fa-caret-down" />
                </li>
              </ul>
            </div>
            <div v-if="loading" class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0">
              <i class="spinner fa fa-spinner fa-pulse" />
            </div>
            <div v-else>
              <div v-if="results.failed" data-library-error>Ett fel uppstod.</div>
              <div v-else-if="!results.data.length" data-library-empty class="pb-4">Inga träffar.</div>
              <table v-else class="w-full -ml-4">
                <tbody>
                  <tr
                    v-for="(item, index) in results.data"
                    :key="`${item.index}:${item.primaryHref}:${index}`"
                    data-library-result
                    class="lg:table-row flex flex-col justify-between pb-2 lg:pb-0 -ml-2 hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                  >
                    <td class="lg:text-right lg:table-cell w-44">
                      <span class="sc primarycolor whitespace-nowrap text-base">{{ item.sourceLabel }}</span>
                    </td>
                    <td class="order-2">
                      <a
                        :href="item.primaryHref"
                        :download="item.download || undefined"
                        :data-library-author-name="item.index === 'author' || undefined"
                      >
                        <template v-if="item.index === 'author'">
                          <span class="surname">{{ item.authorSurname }}</span><span v-if="item.authorGivenNames">,</span>
                          {{ item.authorGivenNames }}
                          <span
                            v-if="item.mobileYearLabel"
                            data-library-author-mobile-years
                            class="lg:hidden"
                          >{{ item.mobileYearLabel }}</span>
                        </template>
                        <template v-else>{{ item.primaryLabel }}</template>
                      </a>
                    </td>
                    <td class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap">{{ item.yearLabel }}</td>
                    <td class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40">
                      <a v-if="item.authorHref" :href="item.authorHref">{{ item.secondaryAuthor }}</a>
                      <span v-else class="text-gray-800">{{ item.secondaryAuthor }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
