import type { components } from "./api/generated/lbapi"

type Request = components["schemas"]["TextSearchResultsRequest"]
type SearchLanguage = NonNullable<Request["languages"]>[number]
type SearchCategory = NonNullable<Request["categories"]>[number]

const languageLabels = {
  "modernized:true": "Moderniserat språk",
  "modernized:false": "Ej moderniserat språk",
  "translation:true": "Översättning",
  "original:true": "På originalspråk",
  "language:swe": "Svenska",
  "foreign:true": "Främmande språk",
  "language:eng": "Engelska",
  "language:deu": "Tyska",
  "language:fra": "Franska",
  "language:lat": "Latin",
  "language:smi": "Samiska språk",
  "proofread:true": "Korrekturläst",
  "proofread:false": "Ej korrekturläst"
} satisfies Record<SearchLanguage, string>
export const textSearchLanguageOptions = Object.entries(languageLabels) as readonly (
  readonly [SearchLanguage, string]
)[]
const categoryLabels = {
  "texttype:brev;brevsamling": "Brev",
  "texttype:drama;dramasamling": "Dramatik",
  "texttype:essä;essäsamling": "Essäer",
  "texttype:novellsamling;novell": "Noveller",
  "texttype:diktsamling;dikt": "Poesi",
  "texttype:roman": "Romaner",
  "texttype:sakprosa;kringtexter;avhandling;referensverk": "Sakprosa",
  "texttype:tal": "Tal",
  "keyword:Barnlitteratur": "Barn- och ungdomslitteratur",
  "keyword:Biografika|texttype:brev;brevsamling": "Biografisk litteratur",
  "keyword:Finlandssvenskt": "Finlandssvensk litteratur",
  "keyword:Flickböcker": "Flickböcker",
  "texttype:herdaminne": "Herdaminnen",
  "keyword:Humor": "Humoristiska verk",
  "texttype:kistebrev": "Kistebrev",
  "texttype:kringtext": "Kringtexter",
  "texttype:kåseri;kåserisamling": "Kåserier",
  "texttype:reseskildring": "Reseskildringar",
  "keyword:Rösträtt": "Rösträtt",
  "keyword:Sapmi": "Sápmi",
  "keyword:Folktryck": "Skillingtryck och folktryck",
  "keyword:sentpajorden": "Gunnar Ekelöf. Sent på jorden",
  "keyword:OrdenPrövas": "Harry Martinson. Orden prövas",
  "keyword:LB-antologi": "Litteraturbankens antologier",
  "keyword:1800": "Nya vägar till det förflutna",
  "source:bibliotekariesidor": "Bibliotekariesidorna",
  "source:diktensmuseum": "Diktens museum",
  "keyword:Dramawebben": "Dramawebben",
  "source:skolan": "Litteraturbankens skola",
  "source:litteraturkartan": "Litteraturkartan",
  "source:ljudochbild": "Ljud & Bild",
  "source:sol": "Översättarlexikon",
  "keyword:SLS-FI": "SLS Finland",
  "provenance.library:SVELITT": "SLS Sverige",
  "provenance.library:SA": "Svenska Akademien",
  "provenance.library:SFS": "Svenska fornskriftssällskapet",
  "provenance.library:SVA": "Svenskt visarkiv",
  "author_ids:KunglSamfundet": "Kungl. Samfundet för utgivande av handskrifter",
  "provenance.library:SVS": "Svenska Vitterhetssamfundet"
} satisfies Record<SearchCategory, string>
export const textSearchCategoryOptions = Object.entries(categoryLabels) as readonly (
  readonly [SearchCategory, string]
)[]
