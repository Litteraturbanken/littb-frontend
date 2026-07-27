import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false
type Expect<Value extends true> = Value

type OptionsByPath = paths["/library/options"]["get"]
type SearchByPath = paths["/library/search"]["post"]
type CountsByPath = paths["/library/counts"]["post"]
type OptionsById = operations["v2_get_library_options"]
type SearchById = operations["v2_post_library_search"]
type CountsById = operations["v2_post_library_counts"]

type _OptionsOperationMatches = Expect<Equal<OptionsByPath, OptionsById>>
type _SearchOperationMatches = Expect<Equal<SearchByPath, SearchById>>
type _CountsOperationMatches = Expect<Equal<CountsByPath, CountsById>>

type OptionsResponse = OptionsById["responses"][200]["content"]["application/json"]
type SearchRequest = SearchById["requestBody"]["content"]["application/json"]
type SearchResponse = SearchById["responses"][200]["content"]["application/json"]
type CountRequest = CountsById["requestBody"]["content"]["application/json"]
type CountResponse = CountsById["responses"][200]["content"]["application/json"]
type ApiErrorResponse = components["schemas"]["ApiErrorResponse"]

const filters = {
  query: "Selma",
  gender: null,
  categories: [],
  narrowing_categories: [],
  about_author_ids: [],
  media: [],
  languages: [],
  year_from: null,
  year_to: null
} satisfies components["schemas"]["LibraryFilters"]

const searchRequests = [
  { mode: "all", filters, sort: "relevance", reverse: false },
  { mode: "authors", filters, sort: "name", reverse: false, limit: 150 },
  {
    mode: "works",
    filters,
    sort: "author",
    reverse: false,
    page: 1,
    source_only: false
  },
  { mode: "parts", filters, sort: "title", reverse: false, page: 1 },
  { mode: "latest", filters, reverse: false, page: 1, hide_1800: false },
  { mode: "epub", filters, sort: "popularity", reverse: false, page: 1 },
  { mode: "pdf", filters, sort: "chronology", reverse: false, page: 1 }
] satisfies SearchRequest[]

const searchResponses = [
  { mode: "all", items: [], total_hits: 0 },
  {
    mode: "authors",
    items: [],
    total_authors: 0,
    total_works: 0,
    total_parts: 0
  },
  { mode: "works", items: [], total_hits: 0, total_works: 0 },
  { mode: "parts", items: [], total_parts: 0 },
  { mode: "latest", groups: [], total_hits: 0, total_works: 0 },
  { mode: "epub", items: [], total_hits: 0, total_works: 0 },
  { mode: "pdf", items: [], total_hits: 0, total_works: 0 }
] satisfies SearchResponse[]

const countRequests = [
  { mode: "epub", filters },
  { mode: "pdf", filters },
  { mode: "works", filters },
  { mode: "parts", filters }
] satisfies CountRequest[]

const countResponses = [
  { mode: "epub", total: null },
  { mode: "pdf", total: 0 },
  { mode: "works", total: null, author_ids: null },
  { mode: "parts", total: 0, author_ids: [] }
] satisfies CountResponse[]

const partialOptions = {
  chronology: null,
  about_authors: [{ author_id: "LagerlofS", label: "Selma Lagerlöf" }]
} satisfies OptionsResponse

const nullableAuthor = {
  author_id: "LagerlofS",
  full_name: null,
  surname: "Lagerlöf",
  role: null,
  birth_year: null,
  death_year: null
} satisfies components["schemas"]["LibraryAuthor"]

type _Options422 = Expect<Equal<
  OptionsById["responses"][422]["content"]["application/json"],
  ApiErrorResponse
>>
type _Options500 = Expect<Equal<
  OptionsById["responses"][500]["content"]["application/json"],
  ApiErrorResponse
>>
type _Options503 = Expect<Equal<
  OptionsById["responses"][503]["content"]["application/json"],
  ApiErrorResponse
>>
type _Search422 = Expect<Equal<
  SearchById["responses"][422]["content"]["application/json"],
  ApiErrorResponse
>>
type _Search500 = Expect<Equal<
  SearchById["responses"][500]["content"]["application/json"],
  ApiErrorResponse
>>
type _Search503 = Expect<Equal<
  SearchById["responses"][503]["content"]["application/json"],
  ApiErrorResponse
>>
type _Counts422 = Expect<Equal<
  CountsById["responses"][422]["content"]["application/json"],
  ApiErrorResponse
>>
type _Counts500 = Expect<Equal<
  CountsById["responses"][500]["content"]["application/json"],
  ApiErrorResponse
>>
type _Counts503 = Expect<Equal<
  CountsById["responses"][503]["content"]["application/json"],
  ApiErrorResponse
>>

void searchRequests
void searchResponses
void countRequests
void countResponses
void partialOptions
void nullableAuthor
