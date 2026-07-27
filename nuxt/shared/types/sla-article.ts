import type { components } from "../../app/lib/api/generated/lbapi"

import type { AuthorSupplementalAuthor } from "./author-document"
import type { SanitizedHtml } from "./renderable-html"

export type SlaArticleId = components["schemas"]["SlaArticleDescriptor"]["article_id"]

export const SLA_ARTICLE_REGISTRY_BY_ID = {
  "TextkritiskaRiktlinjer.html": { sourcePath: "/red/sla/TextkritiskaRiktlinjer.html" },
  "TextkritiskVerkstad.html": { sourcePath: "/red/sla/TextkritiskVerkstad.html" },
  "OmSelmaLagerlofArkivet.html": { sourcePath: "/red/sla/OmSelmaLagerlofArkivet.html" },
  "Introduktion.html": { sourcePath: "/red/sla/Introduktion.html" },
  "Adaptioner.html": { sourcePath: "/red/sla/Adaptioner.html" },
  "ForeGostaBerling.html": { sourcePath: "/red/sla/ForeGostaBerling.html" },
  "BrevOmGBS.html": { sourcePath: "/red/sla/BrevOmGBS.html" },
  "SprakandringarGBS.html": { sourcePath: "/red/sla/SprakandringarGBS.html" },
  "AndringarGBS.html": { sourcePath: "/red/sla/AndringarGBS.html" },
  "ForskningOchLitthist.html": { sourcePath: "/red/sla/ForskningOchLitthist.html" },
  "TextkritiskGBS.html": { sourcePath: "/red/sla/TextkritiskGBS.html" },
  "ManuskriptGBS.html": { sourcePath: "/red/sla/ManuskriptGBS.html" },
  "Oversattningar.html": { sourcePath: "/red/sla/Oversattningar.html" },
  "IllustrationerOchOmslag.html": { sourcePath: "/red/sla/IllustrationerOchOmslag.html" },
  "Recensioner.html": { sourcePath: "/red/sla/Recensioner.html" },
  "OLintroduktion.html": { sourcePath: "/red/sla/OLintroduktion.html" },
  "TextkritiskOL1894.html": { sourcePath: "/red/sla/TextkritiskOL1894.html" },
  "MsTillOL.html": { sourcePath: "/red/sla/MsTillOL.html" },
  "AboutTheSLagerlofArchive.html": { sourcePath: "/red/sla/AboutTheSLagerlofArchive.html" },
  "SelmaLagerlofShort.html": { sourcePath: "/red/sla/SelmaLagerlofShort.html" },
  "SelmaLagerlofEnglish.html": { sourcePath: "/red/sla/SelmaLagerlofEnglish.html" },
  "PublishedWorks.html": { sourcePath: "/red/sla/PublishedWorks.html" },
  "ScholarlyEditions.html": { sourcePath: "/red/sla/ScholarlyEditions.html" }
} as const satisfies Record<SlaArticleId, { sourcePath: string }>

export const SLA_ARTICLE_REGISTRY = (
  Object.entries(SLA_ARTICLE_REGISTRY_BY_ID) as Array<[
    SlaArticleId,
    typeof SLA_ARTICLE_REGISTRY_BY_ID[SlaArticleId]
  ]>
).map(([articleId, article]) => ({
  articleId,
  sourcePath: article.sourcePath
}))

export type SlaArticleSourcePath =
  typeof SLA_ARTICLE_REGISTRY_BY_ID[SlaArticleId]["sourcePath"]

export type SlaArticleErrorCode =
  | "sla_article_not_found"
  | "sla_article_unavailable"

export function isSlaArticleId(value: unknown): value is SlaArticleId {
  return typeof value === "string"
    && Object.hasOwn(SLA_ARTICLE_REGISTRY_BY_ID, value)
}

export interface SlaArticlePage {
  author: AuthorSupplementalAuthor
  articleId: SlaArticleId
  sourcePath: SlaArticleSourcePath
  bodyHtml: SanitizedHtml<"sla-article">
}
