import type { components } from "../../app/lib/api/generated/lbapi"

export type SlaArticleId = components["schemas"]["SlaArticleDescriptor"]["article_id"]

export const SLA_ARTICLE_REGISTRY = [
  { articleId: "TextkritiskaRiktlinjer.html", sourcePath: "/red/sla/TextkritiskaRiktlinjer.html" },
  { articleId: "TextkritiskVerkstad.html", sourcePath: "/red/sla/TextkritiskVerkstad.html" },
  { articleId: "OmSelmaLagerlofArkivet.html", sourcePath: "/red/sla/OmSelmaLagerlofArkivet.html" },
  { articleId: "Introduktion.html", sourcePath: "/red/sla/Introduktion.html" },
  { articleId: "Adaptioner.html", sourcePath: "/red/sla/Adaptioner.html" },
  { articleId: "ForeGostaBerling.html", sourcePath: "/red/sla/ForeGostaBerling.html" },
  { articleId: "BrevOmGBS.html", sourcePath: "/red/sla/BrevOmGBS.html" },
  { articleId: "SprakandringarGBS.html", sourcePath: "/red/sla/SprakandringarGBS.html" },
  { articleId: "AndringarGBS.html", sourcePath: "/red/sla/AndringarGBS.html" },
  { articleId: "ForskningOchLitthist.html", sourcePath: "/red/sla/ForskningOchLitthist.html" },
  { articleId: "TextkritiskGBS.html", sourcePath: "/red/sla/TextkritiskGBS.html" },
  { articleId: "ManuskriptGBS.html", sourcePath: "/red/sla/ManuskriptGBS.html" },
  { articleId: "Oversattningar.html", sourcePath: "/red/sla/Oversattningar.html" },
  { articleId: "IllustrationerOchOmslag.html", sourcePath: "/red/sla/IllustrationerOchOmslag.html" },
  { articleId: "Recensioner.html", sourcePath: "/red/sla/Recensioner.html" },
  { articleId: "OLintroduktion.html", sourcePath: "/red/sla/OLintroduktion.html" },
  { articleId: "TextkritiskOL1894.html", sourcePath: "/red/sla/TextkritiskOL1894.html" },
  { articleId: "MsTillOL.html", sourcePath: "/red/sla/MsTillOL.html" },
  { articleId: "AboutTheSLagerlofArchive.html", sourcePath: "/red/sla/AboutTheSLagerlofArchive.html" },
  { articleId: "SelmaLagerlofShort.html", sourcePath: "/red/sla/SelmaLagerlofShort.html" },
  { articleId: "SelmaLagerlofEnglish.html", sourcePath: "/red/sla/SelmaLagerlofEnglish.html" },
  { articleId: "PublishedWorks.html", sourcePath: "/red/sla/PublishedWorks.html" },
  { articleId: "ScholarlyEditions.html", sourcePath: "/red/sla/ScholarlyEditions.html" }
] as const satisfies ReadonlyArray<{
  articleId: SlaArticleId
  sourcePath: string
}>

export type SlaArticleSourcePath = typeof SLA_ARTICLE_REGISTRY[number]["sourcePath"]
