import type { components, operations, paths } from "../../app/lib/api/generated/lbapi"

export type ReaderManifestOperation = operations["v2_get_reader_work_manifest"]
export type EditorManifestOperation = operations["v2_get_editor_work_manifest"]
export type ReaderManifestResponse = ReaderManifestOperation["responses"][200]["content"]["application/json"]
export type EditorManifestResponse = EditorManifestOperation["responses"][200]["content"]["application/json"]
export type WorkManifestContributor = components["schemas"]["WorkManifestContributor"]
export type ManifestContributionRole = components["schemas"]["ManifestContributionRole"]
export type WorkManifestPage = components["schemas"]["WorkManifestPage"]
export type WorkManifestFacsimilePage = components["schemas"]["WorkManifestFacsimilePage"]
export type WorkManifestPartAuthor = components["schemas"]["WorkManifestPartAuthor"]
export type WorkManifestPart = components["schemas"]["WorkManifestPart"]
export type FacsimileSize = components["schemas"]["FacsimileSize"]
export type EditorPageBounds =
  | components["schemas"]["DenseEditorPageBounds"]
  | components["schemas"]["SparseEditorPageBounds"]
export type ReaderManifestPath = paths["/works/{author_id}/{title_path}/manifest"]["get"]
export type EditorManifestPath = paths["/works/{work_id}/editor-manifest"]["get"]
