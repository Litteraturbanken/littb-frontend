import type { components } from "../../app/lib/api/generated/lbapi"
import type {
  ReaderFacsimilePage,
  ReaderPart,
  ReaderPartAuthor,
  ReaderWorkContributor,
  ReaderPage
} from "../../shared/types/reader"
import type { ReaderAuthorContribution } from "../../shared/utils/reader-author"
import type {
  EditorManifestOperation,
  EditorManifestPath,
  EditorManifestResponse,
  ManifestContributionRole,
  ReaderManifestOperation,
  ReaderManifestPath,
  ReaderManifestResponse,
  WorkManifestContributor,
  WorkManifestPage,
  WorkManifestPart,
  WorkManifestPartAuthor
} from "../../shared/types/work-manifest"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false
type Expect<Value extends true> = Value

type ApiErrorResponse = components["schemas"]["ApiErrorResponse"]
type ExpectedReaderResponse =
  | components["schemas"]["ReaderEtextManifest"]
  | components["schemas"]["ReaderFacsimileManifest"]
type ExpectedEditorResponse =
  | components["schemas"]["EditorCompleteManifest"]
  | components["schemas"]["EditorPageBoundsOnlyManifest"]

type _ReaderPathMatchesOperation = Expect<
  Equal<ReaderManifestPath, ReaderManifestOperation>
>
type _EditorPathMatchesOperation = Expect<
  Equal<EditorManifestPath, EditorManifestOperation>
>
type _ReaderResponseUnionExact = Expect<
  Equal<ReaderManifestResponse, ExpectedReaderResponse>
>
type _EditorResponseUnionExact = Expect<
  Equal<EditorManifestResponse, ExpectedEditorResponse>
>
type _EditorStatusExact = Expect<
  Equal<EditorManifestResponse["status"], "complete" | "page_bounds_only">
>
type _ReaderContributorsAreGenerated = Expect<Equal<
  ReaderPage["contributors"],
  WorkManifestContributor[]
>>
type _ReaderPartsAreGenerated = Expect<Equal<
  ReaderPage["parts"],
  WorkManifestPart[]
>>
type _ReaderPageMapIsGenerated = Expect<Equal<
  ReaderPage["pageMap"],
  WorkManifestPage[]
>>
type _ReaderAuthorContributionIsGenerated = Expect<Equal<
  ReaderAuthorContribution,
  ManifestContributionRole
>>
type _ReaderFacsimileAuthorIsGenerated = Expect<Equal<
  ReaderFacsimilePage["author"],
  WorkManifestContributor
>>
type _LegacyNamedReaderContributorIsGenerated = Expect<Equal<
  ReaderWorkContributor,
  WorkManifestContributor
>>
type _LegacyNamedReaderPartIsGenerated = Expect<Equal<
  ReaderPart,
  WorkManifestPart
>>
type _LegacyNamedReaderPartAuthorIsGenerated = Expect<Equal<
  ReaderPartAuthor,
  WorkManifestPartAuthor
>>

type _Reader404 = Expect<Equal<
  ReaderManifestOperation["responses"][404]["content"]["application/json"],
  ApiErrorResponse
>>
type _Reader422 = Expect<Equal<
  ReaderManifestOperation["responses"][422]["content"]["application/json"],
  ApiErrorResponse
>>
type _Reader500 = Expect<Equal<
  ReaderManifestOperation["responses"][500]["content"]["application/json"],
  ApiErrorResponse
>>
type _Reader503 = Expect<Equal<
  ReaderManifestOperation["responses"][503]["content"]["application/json"],
  ApiErrorResponse
>>
type _Editor404 = Expect<Equal<
  EditorManifestOperation["responses"][404]["content"]["application/json"],
  ApiErrorResponse
>>
type _Editor422 = Expect<Equal<
  EditorManifestOperation["responses"][422]["content"]["application/json"],
  ApiErrorResponse
>>
type _Editor500 = Expect<Equal<
  EditorManifestOperation["responses"][500]["content"]["application/json"],
  ApiErrorResponse
>>
type _Editor503 = Expect<Equal<
  EditorManifestOperation["responses"][503]["content"]["application/json"],
  ApiErrorResponse
>>

const readerEtext = {
  alternate_media: null,
  author_id: "SoderbergH",
  contributors: [],
  display_title: "Doktor Glas",
  editor_work_id: "lb1728740",
  end_page_name: "159",
  full_title: "Doktor Glas",
  has_dramawebben: false,
  has_nya_vagar: false,
  imprint_year: "1905",
  is_drama: false,
  media_type: "etext",
  page_step: 1,
  pages: [{ page_index: 0, page_name: "1" }],
  parts: [],
  searchable: true,
  start_page_name: "1",
  title_path: "DoktorGlas",
  urn: null,
  work_id: "lb1728740"
} satisfies Extract<ReaderManifestResponse, { media_type: "etext" }>

const readerFacsimile = {
  alternate_media: null,
  author_id: "SoderbergH",
  contributors: [],
  display_title: "Doktor Glas",
  editor_work_id: "lb1728740",
  end_page_name: "159",
  full_title: "Doktor Glas",
  has_dramawebben: false,
  has_nya_vagar: false,
  imprint_year: "1905",
  is_drama: false,
  media_type: "faksimil",
  page_step: 1,
  pages: [{ image_number: 1, page_index: 0, page_name: "1" }],
  parts: [],
  preferred_size: 3,
  searchable: true,
  sizes: [{ size: 3, width: 1024 }],
  start_page_name: "1",
  title_path: "DoktorGlas",
  urn: null,
  work_id: "lb1728740"
} satisfies Extract<ReaderManifestResponse, { media_type: "faksimil" }>

const editorComplete = {
  bounds: { kind: "dense", page_count: 1 },
  contributors: [],
  display_title: "Doktor Glas",
  end_page_name: "159",
  imprint_year: "1905",
  media_type: "etext",
  pages: [{ page_index: 0, page_name: "1" }],
  parts: [],
  public_reader_target: null,
  searchable: true,
  sizes: [],
  start_page_name: "1",
  status: "complete",
  title_path: "DoktorGlas",
  work_id: "lb1728740"
} satisfies Extract<EditorManifestResponse, { status: "complete" }>

const editorPageBoundsOnly = {
  bounds: { kind: "sparse", page_indexes: [0, 2, 4] },
  media_type: "faksimil",
  status: "page_bounds_only",
  work_id: "lb1728740"
} satisfies Extract<EditorManifestResponse, { status: "page_bounds_only" }>

void readerEtext
void readerFacsimile
void editorComplete
void editorPageBoundsOnly
