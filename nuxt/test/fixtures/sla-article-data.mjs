const authorityInventory = Object.freeze({
  "TextkritiskaRiktlinjer.html": ["Textkritiska riktlinjer för Selma Lagerlöf-arkivet", 2, "56c81ea154677332d90ff42137ffbf022da4a5cfe5f5be4800ceab8db7d44fa1"],
  "TextkritiskVerkstad.html": ["Textkritisk verkstad", 15, "d7b80072a31c6f869d6ae12335269cd4a2c195c992707c12a141fcb20cbcf10f"],
  "OmSelmaLagerlofArkivet.html": ["Selma Lagerlöf-arkivet", 4, "bded66538032db0f72394b1a0652bb221e18eec88d726897797f3768c00688fa"],
  "Introduktion.html": ["Introduktion", 42, "62eee37b09f0918f9fe314a87e293f9ccf6e818619256c17bcbe18751a0f6446"],
  "Adaptioner.html": ["Gösta Berlings saga i andra medier", 63, "e408b21aca117e190664cf46b0b200af3dff3ef7415f9e0e54c012e5e5847d7c"],
  "ForeGostaBerling.html": ["Tiden före Gösta Berlings saga", 174, "ea55c46a874068f8ac5c5634dabae8653f3b640114f0726205d65955573dfd4e"],
  "BrevOmGBS.html": ["Brev om Gösta Berlings saga", 31, "80798b607e39ad424f3edd7d24b2beca105b4c22d6e5cc82358404d635865cf2"],
  "SprakandringarGBS.html": ["Språkliga förändringar i Gösta Berlings saga", 23, "6d5b13640654479c5aced7526ff1de10a0432edef429b58dd9cf0f48f79bd074"],
  "AndringarGBS.html": ["Skillnader mellan första upplagan av Gösta Berlings saga 1891 och andra upplagan 1895", 17, "f2e9b13d641427f304570960f8e77a37601a73ee2919a6f8508e47cdf18acd5c"],
  "ForskningOchLitthist.html": ["Forskning om Gösta Berlings saga", 91, "d27fa3d690ed48fd83a45f482bea62f560641bd9f8f2d6d0421980cf2f5c4597"],
  "TextkritiskGBS.html": ["Textkritisk kommentar till Gösta Berlings saga 1891", 8, "ed7733f77754dfbdc9a040c63b81e644c2f5308569e6e8ce1b8e4488c57ad97d"],
  "ManuskriptGBS.html": ["Manuskripten till Gösta Berlings saga", 135, "f296f9629884f0474f3986200ed064a3a8608ca089eeb767b580b71112e4d46b"],
  "Oversattningar.html": ["Översättningar", 6, "b5117102e11a4bf9411adfa9b41b0d1fb347a7284c2ca7e075d9db50fd2ddc17"],
  "IllustrationerOchOmslag.html": ["Illustrationer och omslag till Gösta Berlings saga", 80, "9eb4dbe3768def851623d01b2e74f09a3f085086bc382fb3fef1e979586028f3"],
  "Recensioner.html": ["Recensioner av Idun-kapitlen och Gösta Berlings saga", 42, "afb10932dddf1d6c46f35e7d294716fd9c6518653b5bff7efe1196dd8cb6954a"],
  "OLintroduktion.html": ["Introduktion till Osynliga länkar", 6, "2ee31f37ddb0937d1ebb2c716c5adba18fe4959e0c2c6ec4093c1e58b93e17b2"],
  "TextkritiskOL1894.html": ["Textkritisk kommentar till Osynliga länkar 1894", 4, "5cc15fd04d55da7eb5e60fe6391f9b98c793e83de37bead4d0cd42bf953413c9"],
  "MsTillOL.html": ["Manuskriptläget för Osynliga länkar. Berättelser", 23, "1e813b8d02c63cc2696ff55536f489890e7a180be34bc443fe14a5b463167afb"],
  "AboutTheSLagerlofArchive.html": ["About The Selma Lagerlöf Archive", 8, "2ca348d1899da4cc6e4c831a79f64d851248819ce04b79ba0b6b867a6656dc2e"],
  "SelmaLagerlofShort.html": ["Selma Lagerlöf – presentation", 1, "70463eff660edafbba79d6b6125b1e20ffd7bbd1c68f5e815f963e7b581a9d31"],
  "SelmaLagerlofEnglish.html": ["Selma Lagerlöf (1858–1940)", 6, "eeb24bbe80d0cc488c90972f36f74bf43e70dead1e5a8e108799b4d64d5cadc4"],
  "PublishedWorks.html": ["Published works", 2, "12b64514b82e0de64b115104d4a07932a82e2715a5d9bf8b926890ac6b50d2d5"],
  "ScholarlyEditions.html": ["Scholarly editions", 13, "fb48e336a0e04ae091a7ab8cde478d4dd9898232af364164fef1b45b42a97a19"]
})

// Source paths stay explicit: no request value is ever used to construct a
// provider path. The frontend type registry verifies these ids against the
// generated backend OpenAPI enum.
export const slaArticleFixtures = Object.freeze([
  ["TextkritiskaRiktlinjer.html", "/red/sla/TextkritiskaRiktlinjer.html", 15419, "e2a2a03514542131cdf0b876eae0fb24f0d524c2f706d9502cad9f9653e2766c"],
  ["TextkritiskVerkstad.html", "/red/sla/TextkritiskVerkstad.html", 4319, "7d775d8c274b9ae0feb42706b39051cd1aff5ea90a944db2b81c02527613014b"],
  ["OmSelmaLagerlofArkivet.html", "/red/sla/OmSelmaLagerlofArkivet.html", 5923, "67f087573ea46d0c11f23c021c56ae738829630d7b10c3da17cc2f4b43eb9f6f"],
  ["Introduktion.html", "/red/sla/Introduktion.html", 24142, "f266c92607d1f04ca4938211fb743052c0568e317ab34adefd289158bfd0d644"],
  ["Adaptioner.html", "/red/sla/Adaptioner.html", 26211, "6f0bb98960a195a8d8850c544aa2ebbf4f4442eaf63d3f63c6cf6cb15fa8fed0"],
  ["ForeGostaBerling.html", "/red/sla/ForeGostaBerling.html", 100567, "2a62b9702723bfab63ba0f5c4bf7fed2824d48e4cc40eaa437ebccfb79823dd6"],
  ["BrevOmGBS.html", "/red/sla/BrevOmGBS.html", 17546, "483ac365ce5037f8a0f6eda14f3b7f3c2b870c1b4889e86c7d96437421e933fb"],
  ["SprakandringarGBS.html", "/red/sla/SprakandringarGBS.html", 71731, "19a5e3529cab244db76d2cf5c0a0c1b26ff875baf9e3f7185b474fa2977a3712"],
  ["AndringarGBS.html", "/red/sla/AndringarGBS.html", 73194, "9394d8882c81c9062ff470aedfbddc8734618f6ea65c2176ada07b1226dd2087"],
  ["ForskningOchLitthist.html", "/red/sla/ForskningOchLitthist.html", 65889, "52b533e0230ec8d8cfc3eaa54952270db1c40930ebadb363dbeeec31d3d74e82"],
  ["TextkritiskGBS.html", "/red/sla/TextkritiskGBS.html", 7584, "351e786b36845ff14d6b6b3418ee2161120d5f21981e1865a52d9d4c420e17cc"],
  ["ManuskriptGBS.html", "/red/sla/ManuskriptGBS.html", 54459, "740f4c929b4b25a041b60c37c6d9face570b9bcc91a98ebe823a266606383a02"],
  ["Oversattningar.html", "/red/sla/Oversattningar.html", 12160, "43dc7daa12860e78bbdd32a2de362f32ef88bf26f34626814e86d593669f0f92"],
  ["IllustrationerOchOmslag.html", "/red/sla/IllustrationerOchOmslag.html", 51747, "719c8121364a21e2ca9f60e671c2d86cd2bcc0d63a160cab470abaf4ef7360fc"],
  ["Recensioner.html", "/red/sla/Recensioner.html", 43427, "d6af909d38e8106c41d9bd44a9a1b2923f3c9ef941de6c4380f6a5137359a55e"],
  ["OLintroduktion.html", "/red/sla/OLintroduktion.html", 7787, "460f7b37d957728d6c6221bd2d0a56b0c144811618914ecb95f7fa5e624f254c"],
  ["TextkritiskOL1894.html", "/red/sla/TextkritiskOL1894.html", 7543, "e8c596e622b1957bfe3fb437c485fe562c38858297a421529577da192706ed9b"],
  ["MsTillOL.html", "/red/sla/MsTillOL.html", 18926, "9b165b331f36c71fd53e10573bfb022fea0fbc19a772187ae60154f2a925ff68"],
  ["AboutTheSLagerlofArchive.html", "/red/sla/AboutTheSLagerlofArchive.html", 2395, "40d05fd53a9e10a7b23ba6b07cb80c042f2e2ba801878103524b8ed87e192010"],
  ["SelmaLagerlofShort.html", "/red/sla/SelmaLagerlofShort.html", 1963, "78d6b04ea82ba2873add8afc3eade0364b662056dbb8add7d20b723b14787340"],
  ["SelmaLagerlofEnglish.html", "/red/sla/SelmaLagerlofEnglish.html", 47375, "b931035987bd7fc770eec4924268bb554821df07f0ed05bf24e22821563b90ca"],
  ["PublishedWorks.html", "/red/sla/PublishedWorks.html", 1555, "711093356856f97f3f469880c4c8011a70c58bc5e15c4e929ba3b485808a3623"],
  ["ScholarlyEditions.html", "/red/sla/ScholarlyEditions.html", 4236, "5dbd239cbbcfadd4d5ea0c6041be20e0206bc64bd51a48f2eed1bbe2c3bf02fb"]
].map(([articleId, sourcePath, bytes, sha256]) => {
  const [title, linkCount, linkSha256] = authorityInventory[articleId]
  return Object.freeze({
    articleId,
    sourcePath,
    sourceUrl: `https://red.litteraturbanken.se${sourcePath}`,
    file: articleId,
    bytes,
    sha256,
    mediaType: "text/html; charset=utf-8",
    title,
    linkCount,
    linkSha256
  })
}))

const author = Object.freeze({
  author_id: "LagerlöfS",
  normalized_author_id: "LagerlofS",
  full_name: "Selma Lagerlöf",
  birth_year: "1858",
  death_year: "1940",
  has_introduction: true,
  has_dramawebben: true,
  search_url: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
})

export const slaArticleDescriptors = Object.freeze(Object.fromEntries(
  slaArticleFixtures.map(article => [article.articleId, Object.freeze({
    ...author,
    document_kind: "omtexterna",
    article_id: article.articleId,
    source_path: article.sourcePath
  })])
))
