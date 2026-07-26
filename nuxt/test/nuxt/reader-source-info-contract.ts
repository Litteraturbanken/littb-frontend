import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"

type SourceInfoOperation = paths["/works/{author_id}/{title_path}/source-info"]["get"]
type SourceInfoParameters = operations["v2_get_work_source_info"]["parameters"]
type SourceInfoResponse = components["schemas"]["WorkSourceInfoResponse"]
type ApiErrorResponse = components["schemas"]["ApiErrorResponse"]
type SimilarWorksOperation = paths["/works/{work_id}/similar"]["get"]
type SimilarWorksParameters = operations["v2_get_similar_works"]["parameters"]
type SimilarWorksResponse = components["schemas"]["SimilarWorksResponse"]

const operation: SourceInfoOperation = null as unknown as
  operations["v2_get_work_source_info"]
const similarOperation: SimilarWorksOperation = null as unknown as
  operations["v2_get_similar_works"]

const withoutMedia: SourceInfoParameters = {
  path: { author_id: "SoderbergH", title_path: "DoktorGlas" }
}
const withMedia: SourceInfoParameters = {
  path: { author_id: "SoderbergH", title_path: "DoktorGlas" },
  query: { media_type: "etext" }
}

const withInvalidMedia: SourceInfoParameters = {
  path: { author_id: "SoderbergH", title_path: "DoktorGlas" },
  // @ts-expect-error The source-info filter only accepts Reader media.
  query: { media_type: "pdf" }
}

const similarParameters: SimilarWorksParameters = {
  path: { work_id: "lb1728740" },
  query: { media_type: "etext" }
}
const similarWithInvalidMedia: SimilarWorksParameters = {
  path: { work_id: "lb1728740" },
  // @ts-expect-error Similar works only accepts Reader media.
  query: { media_type: "pdf" }
}
// @ts-expect-error media_type is a required similar-works query parameter.
const similarWithoutMedia: SimilarWorksParameters = {
  path: { work_id: "lb1728740" }
}
const similarSuccess: SimilarWorksResponse = {
  items: [{
    author_id: "BoyeK",
    author_surname: "Boye",
    title_id: "Bebådelse",
    start_page: "3",
    media_type: "etext",
    label: "Bebådelse [1941]"
  }]
}
const similarWithContentVector: SimilarWorksResponse = {
  items: [{
    ...similarSuccess.items[0]!,
    // @ts-expect-error Similar-work projections never expose the search vector.
    content_vector: []
  }]
}

const success: SourceInfoResponse = {
  author_id: "SoderbergH",
  authors: [],
  cover: { large_url: "/cover/large", small_url: "/cover/small" },
  download_actions: [],
  dramawebben: null,
  errata: [],
  imprint: null,
  is_printed: null,
  libris_id: null,
  license_key: null,
  media_type: "etext",
  provenance: [],
  read_actions: [],
  short_title: null,
  source_description_author_id: null,
  source_description_html: null,
  start_page: "-2",
  text_type: null,
  title: "Doktor Glas",
  title_path: "DoktorGlas",
  urn: null,
  work_id: "lb1728740",
  work_introduction_author_id: null,
  work_introduction_html: null
}

const successFromOperation: SourceInfoResponse = null as unknown as
  operations["v2_get_work_source_info"]["responses"][200]["content"]["application/json"]

const { work_id: _workId, ...missingWorkIdValue } = success
// @ts-expect-error Every declared success field is required by the strict DTO.
const missingWorkId: SourceInfoResponse = missingWorkIdValue

const successWithContentVector: SourceInfoResponse = {
  ...success,
  // @ts-expect-error Undeclared backend fields must not cross the transport boundary.
  content_vector: []
}

const notFound: ApiErrorResponse = null as unknown as
  operations["v2_get_work_source_info"]["responses"][404]["content"]["application/json"]
const invalidRequest: ApiErrorResponse = null as unknown as
  operations["v2_get_work_source_info"]["responses"][422]["content"]["application/json"]
const unexpectedError: ApiErrorResponse = null as unknown as
  operations["v2_get_work_source_info"]["responses"][500]["content"]["application/json"]
const unavailable: ApiErrorResponse = null as unknown as
  operations["v2_get_work_source_info"]["responses"][503]["content"]["application/json"]

void operation
void similarOperation
void withoutMedia
void withMedia
void withInvalidMedia
void similarParameters
void similarWithInvalidMedia
void similarWithoutMedia
void similarSuccess
void similarWithContentVector
void success
void successFromOperation
void missingWorkId
void successWithContentVector
void notFound
void invalidRequest
void unexpectedError
void unavailable
