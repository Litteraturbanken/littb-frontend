import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"

type AuthorWorksOperation = paths["/authors/{author_id}/works"]["get"]
type AuthorWorksResponse = components["schemas"]["AuthorWorksResponse"]
type ReadAction = components["schemas"]["AuthorWorkReadAction"]
type DownloadAction = components["schemas"]["AuthorWorkDownloadAction"]

const operation: AuthorWorksOperation = null as unknown as
  operations["v2_get_author_works"]
const response: AuthorWorksResponse = null as unknown as
  operations["v2_get_author_works"]["responses"][200]["content"]["application/json"]

const read: ReadAction = {
  media_type: "etext",
  kind: "read",
  url: "/reader",
  download_filename: null
}
const download: DownloadAction = {
  media_type: "epub",
  kind: "download",
  url: "/book.epub",
  download_filename: "book.epub"
}

// @ts-expect-error EPUB cannot be a read action.
const epubRead: ReadAction = { ...read, media_type: "epub" }
// @ts-expect-error E-text cannot be a download action.
const etextDownload: DownloadAction = { ...download, media_type: "etext" }
// @ts-expect-error Read actions never carry download filenames.
const namedRead: ReadAction = { ...read, download_filename: "book.txt" }
// @ts-expect-error Download actions require a filename.
const unnamedDownload: DownloadAction = { ...download, download_filename: null }

void operation
void response
void epubRead
void etextDownload
void namedRead
void unnamedDownload
