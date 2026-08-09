import type { LibraryFilters } from "."

export type LibraryCategory = NonNullable<LibraryFilters["categories"]>[number]
export type LibraryLanguage = NonNullable<LibraryFilters["languages"]>[number]
export type LibraryMedia = NonNullable<LibraryFilters["media"]>[number]

const collectionOptionGroups = [
  {
    label: "Kategorier",
    options: [
      ["texttype:brev;brevsamling", "Brev"],
      ["texttype:drama;dramasamling", "Dramatik"],
      ["texttype:essä;essäsamling", "Essäer"],
      ["texttype:novellsamling;novell", "Noveller"],
      ["texttype:diktsamling;dikt", "Poesi"],
      ["texttype:roman", "Romaner"],
      ["texttype:sakprosa;kringtexter;avhandling;referensverk", "Sakprosa"],
      ["keyword:Barnlitteratur", "Barn- och ungdomslitteratur"],
      ["keyword:Biografika|texttype:brev;brevsamling", "Biografisk litteratur"],
      ["keyword:Finlandssvenskt", "Finlandssvensk litteratur"],
      ["keyword:Flickböcker", "Flickböcker"],
      ["texttype:herdaminne", "Herdaminnen"],
      ["keyword:Humor", "Humoristiska verk"],
      ["texttype:kistebrev", "Kistebrev"],
      ["texttype:kringtext", "Kringtexter"],
      ["texttype:kåseri;kåserisamling", "Kåserier"],
      ["texttype:reseskildring", "Reseskildringar"],
      ["keyword:Rösträtt", "Rösträtt"],
      ["keyword:Sapmi", "Sápmi"],
      ["keyword:Folktryck", "Skillingtryck och folktryck"]
    ]
  },
  {
    label: "Projekt",
    options: [
      ["keyword:sentpajorden", "Gunnar Ekelöf. Sent på jorden"],
      ["keyword:OrdenPrövas", "Harry Martinson. Orden prövas"],
      ["keyword:LB-antologi", "Litteraturbankens antologier"],
      ["keyword:1800", "Nya vägar till det förflutna"]
    ]
  },
  {
    label: "Avdelningar",
    options: [
      ["source:bibliotekariesidor", "Bibliotekariesidorna"],
      ["source:diktensmuseum", "Diktens museum"],
      ["keyword:Dramawebben", "Dramawebben"],
      ["source:skolan", "Litteraturbankens skola"],
      ["source:litteraturkartan", "Litteraturkartan"],
      ["source:ljudochbild", "Ljud & Bild"],
      ["source:sol", "Översättarlexikon"]
    ]
  },
  {
    label: "Utgivare",
    options: [
      ["keyword:SLS-FI", "SLS Finland"],
      ["provenance.library:SVELITT", "SLS Sverige"],
      ["provenance.library:SA", "Svenska Akademien"],
      ["provenance.library:SFS", "Svenska fornskriftssällskapet"],
      ["provenance.library:SVA", "Svenskt visarkiv"],
      ["author_ids:KunglSamfundet", "Kungl. Samfundet för utgivande av handskrifter"],
      ["provenance.library:SVS", "Svenska Vitterhetssamfundet"]
    ]
  }
] as const

const mediaOptions: ReadonlyArray<{
  value: LibraryMedia
  label: string
  title: string
}> = [
  {
    value: "mediatype:etext",
    label: "Etext",
    title: "Etext är korrekturläst text som du kan läsa direkt på skärmen; den är sökbar."
  },
  {
    value: "mediatype:faksimil",
    label: "Faksimil",
    title: "Faksimil är fotografier av bokens sidor; den är ibland sökbar."
  },
  {
    value: "has_epub:true",
    label: "Epub",
    title: "Epub kan du med fördel ladda ner till din mobila läsare; den är sökbar."
  },
  {
    value: "mediatype:pdf",
    label: "PDF",
    title: "PDF är en fil som du kan ladda ner; den är sökbar."
  }
]

const languageOptions: ReadonlyArray<{
  value: LibraryLanguage
  label: string
}> = [
  { value: "modernized:true", label: "Moderniserat språk" },
  { value: "modernized:false", label: "Ej moderniserat språk" },
  { value: "translation:true", label: "Översättning" },
  { value: "original:true", label: "På originalspråk" },
  { value: "language:swe", label: "Svenska" },
  { value: "foreign:true", label: "Främmande språk" },
  { value: "language:eng", label: "Engelska" },
  { value: "language:deu", label: "Tyska" },
  { value: "language:fra", label: "Franska" },
  { value: "language:lat", label: "Latin" },
  { value: "language:smi", label: "Samiska språk" },
  { value: "proofread:true", label: "Korrekturläst" },
  { value: "proofread:false", label: "Ej korrekturläst" }
]

export function createLibraryFilterOptions() {
  const collectionSelectGroups = collectionOptionGroups.map(group => ({
    label: group.label,
    options: group.options.map(([value, label]) => ({ value, label }))
  }))
  const mediaSelectOptions = mediaOptions.map(({ value, label }) => ({ value, label }))
  const languageSelectOptions = languageOptions.map(({ value, label }) => ({ value, label }))

  return {
    collectionSelectGroups,
    collectionSelectOptions: collectionSelectGroups.flatMap(group => group.options),
    collectionValues: new Set<LibraryCategory>(
      collectionOptionGroups.flatMap(group => group.options.map(option => option[0]))
    ),
    mediaSelectOptions,
    mediaValues: new Set<LibraryMedia>(mediaOptions.map(option => option.value)),
    languageSelectOptions,
    languageValues: new Set<LibraryLanguage>(languageOptions.map(option => option.value))
  }
}
