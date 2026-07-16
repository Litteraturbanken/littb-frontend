<script setup lang="ts">
type UnknownRecord = Record<string, unknown>
type LibraryResponse = {
  data: UnknownRecord[]
  hits: number
  suggest: unknown[]
  failed: boolean
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

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function stringAt(record: UnknownRecord | null, key: string): string {
  const value = record?.[key]
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
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

function parseResponse(value: unknown): LibraryResponse {
  const record = asRecord(value)
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Array.isArray(record.suggest)) {
    throw new Error("Invalid Library relevance response")
  }
  return {
    data: record.data.map(asRecord).filter((item): item is UnknownRecord => item !== null),
    hits: record.hits,
    suggest: record.suggest,
    failed: false
  }
}

function emptyResponse(failed = false): LibraryResponse {
  return { data: [], hits: 0, suggest: [], failed }
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
    return parseResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyResponse(true)
  }
}

const initialFilter = queryValue(route.query.filter)
const initialSort = sortKey(route.query.sort)
const { data: initialData } = await useAsyncData(
  `library:${route.fullPath}`,
  () => fetchResults(config.libraryApiBase, initialFilter, initialSort),
  { default: () => emptyResponse() }
)

const filter = ref(initialFilter)
const selectedSort = ref(initialSort)
const results = ref(initialData.value ?? emptyResponse())
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0

function cancelPending() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  controller?.abort()
  controller = null
}

async function replaceQuery(nextFilter: string, nextSort: SortKey) {
  const query = { ...route.query }
  if (nextFilter) query.filter = nextFilter
  else delete query.filter
  if (nextSort === "relevans") delete query.sort
  else query.sort = nextSort
  await router.replace({ query })
}

async function runBrowserRequest(nextFilter: string, nextSort: SortKey) {
  cancelPending()
  const version = ++requestVersion
  controller = new AbortController()
  loading.value = true
  const response = await fetchResults(
    config.public.libraryApiBase,
    nextFilter,
    nextSort,
    controller.signal
  ).catch(() => null)
  if (version !== requestVersion || response === null) return
  results.value = response
  loading.value = false
  controller = null
}

function scheduleSearch() {
  cancelPending()
  requestVersion += 1
  const nextFilter = filter.value
  timer = setTimeout(async () => {
    timer = null
    await replaceQuery(nextFilter, selectedSort.value)
    await runBrowserRequest(nextFilter, selectedSort.value)
  }, 300)
}

async function resetSearch() {
  filter.value = ""
  await replaceQuery("", selectedSort.value)
  await runBrowserRequest("", selectedSort.value)
}

async function selectSort(key: SortKey) {
  selectedSort.value = key
  await replaceQuery(filter.value, key)
  await runBrowserRequest(filter.value, key)
}

function itemIndex(item: UnknownRecord): string {
  return stringAt(item, "_index")
}

function sourceLabel(item: UnknownRecord): string {
  const texttype = stringAt(item, "texttype")
  if (texttype) return texttype
  if (itemIndex(item) === "wordpress") {
    return ({
      ljudochbild: "Ljud och bild",
      diktensmuseum: "Diktens museum",
      skolan: "Skolan",
      bibliotekariesidor: "Bibliotekariesidor"
    } as Record<string, string>)[stringAt(item, "source")] ?? ""
  }
  return ({
    presentations: "Kringtexter",
    litteraturkartan: "Litteraturkartan",
    sol: "Översättarlexikon",
    author: "Författare"
  } as Record<string, string>)[itemIndex(item)] ?? ""
}

function authorName(item: UnknownRecord): string {
  return stringAt(recordAt(item, "main_author"), "full_name")
}

function authorHref(item: UnknownRecord): string {
  const id = stringAt(recordAt(item, "main_author"), "authorid")
  return id ? `/författare/${id}` : ""
}

function primaryLabel(item: UnknownRecord): string {
  const index = itemIndex(item)
  if (index === "author") return stringAt(item, "name_for_index")
  if (index === "sol") return stringAt(recordAt(item, "article"), "ArticleName")
  if (index === "litteraturkartan") return stringAt(item, "header")
  return stringAt(item, "shorttitle") || stringAt(item, "title")
}

function primaryHref(item: UnknownRecord): string {
  const index = itemIndex(item)
  if (index === "author") {
    const id = stringAt(item, "authorid")
    return id ? `/författare/${id}/` : ""
  }
  if (index === "presentations") return stringAt(item, "url")
  if (index === "wordpress") return stringAt(item, "link")
  if (index === "sol") {
    const name = stringAt(recordAt(item, "article"), "URLName")
    return name ? `https://litteraturbanken.se/översättarlexikon/artiklar/${name}` : ""
  }
  if (index === "litteraturkartan") {
    const place = stringAt(item, "placeid")
    const id = stringAt(item, "id")
    return place && id
      ? `https://litteraturbanken.se/litteraturkartan/?id=${encodeURIComponent(place)}&article=${encodeURIComponent(id)}`
      : ""
  }
  if (index === "pdf") {
    const id = stringAt(item, "lbworkid")
    return id ? `/txt/${id}/${id}.pdf` : ""
  }
  if (["etext", "faksimil", "etext-part", "faksimil-part"].includes(index)) {
    const workAuthors = recordsAt(item, "work_authors")
    const author = stringAt(workAuthors[0] ?? recordAt(item, "main_author"), "authorid")
    const title = stringAt(item, "work_titleid") || stringAt(item, "titleid")
    const page = stringAt(item, "startpagename")
    const media = stringAt(item, "mediatype")
    return author && title && page && media
      ? `/författare/${author}/titlar/${title}/sida/${page}/${media}`
      : ""
  }
  return ""
}

function yearLabel(item: UnknownRecord): string {
  if (itemIndex(item) === "author") {
    const birth = stringAt(recordAt(item, "birth"), "plain")
    const death = stringAt(recordAt(item, "death"), "plain")
    return birth || death ? `${birth}–${death}` : ""
  }
  return stringAt(recordAt(item, "sort_date_imprint"), "plain")
}

function secondaryAuthor(item: UnknownRecord): string {
  if (itemIndex(item) === "presentations" || itemIndex(item) === "litteraturkartan") {
    return stringAt(item, "article_author")
  }
  if (itemIndex(item) === "sol") {
    const contributor = recordAt(item, "contributors")
    return `${stringAt(contributor, "FirstName")} ${stringAt(contributor, "LastName")}`.trim()
  }
  return authorName(item)
}

useSeoMeta({
  title: "Biblioteket – Titlar och författare | Litteraturbanken",
  description
})
useHead({
  htmlAttrs: { style: `background: url('${backgroundPath}') no-repeat;` },
  bodyAttrs: { class: "focus page-library ready" }
})

onUnmounted(cancelPending)
</script>

<template>
  <div>
    <h1 class="text-6xl lg:ml-12">Botanisera i biblioteket</h1>
    <div class="lg:ml-12" :class="{ searching: loading }">
      <div id="controls">
        <form
          class="lg:p-5 p-2 lg:border border-gray-900 w-full lg:max-w-5xl"
          @submit.prevent="runBrowserRequest(filter, selectedSort)"
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
            <button type="button" aria-disabled="true" class="bg-white border border-gray-500 self-stretch px-4 focus:ring-1 focus:ring-inset focus:ring-primary">
              <span class="uppercase text-xs">Visa utökad sökning</span>
            </button>
          </div>
          <div class="chronology primarycolor ml-px pl-px">
            <i class="fa fa-clock-o mr-1 ml-px" />
            <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
          </div>
          <div class="btn-group p-0 mt-4 lg:mt-6">
            <button data-library-tab type="button" class="sc btn btn-small text-base active">Alla träffar</button>
            <button v-for="tab in ['Nytt', 'Författare', 'Verk', 'Dikt, novell, etc.', 'Epub', 'PDF']" :key="tab" data-library-tab type="button" aria-disabled="true" class="sc btn btn-small text-base">{{ tab }}</button>
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
                    :key="`${itemIndex(item)}:${primaryHref(item)}:${index}`"
                    data-library-result
                    class="lg:table-row flex flex-col justify-between pb-2 lg:pb-0 -ml-2 hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                  >
                    <td class="lg:text-right lg:table-cell w-44">
                      <span class="sc primarycolor whitespace-nowrap text-base">{{ sourceLabel(item) }}</span>
                    </td>
                    <td class="order-2">
                      <a v-if="primaryHref(item)" :href="primaryHref(item)" :download="itemIndex(item) === 'pdf' || undefined">{{ primaryLabel(item) }}</a>
                    </td>
                    <td class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap">{{ yearLabel(item) }}</td>
                    <td class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40">
                      <a v-if="authorHref(item)" :href="authorHref(item)">{{ secondaryAuthor(item) }}</a>
                      <span v-else class="text-gray-800">{{ secondaryAuthor(item) }}</span>
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
