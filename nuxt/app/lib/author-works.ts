import type { components } from "~/lib/api/generated/lbapi"

export type AuthorWorksResponse = components["schemas"]["AuthorWorksResponse"]
export type AuthorWork = components["schemas"]["AuthorWork"]
export type AuthorWorkAction = AuthorWork["actions"][number]

const authoredSections = [
  { kind: "main", label: "Tillgängliga verk", showAuthor: false },
  {
    kind: "part",
    label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
    showAuthor: false
  },
  { kind: "photographer", label: "Som fotograf", showAuthor: true },
  { kind: "illustrator", label: "Som illustratör", showAuthor: true },
  { kind: "editor", label: "Som utgivare", showAuthor: true },
  { kind: "translator", label: "Som översättare", showAuthor: true }
] as const
const aboutSections = [
  { kind: "about", label: (name: string) => `Verk om ${name}` },
  { kind: "about_part", label: (name: string) => `Kortare texter om ${name}` },
  { kind: "about_editor", label: () => "Som utgivare" },
  { kind: "about_translator", label: () => "Som översättare" }
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isLink(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["label", "url"])
    && isString(value.label)
    && isString(value.url)
}

function isPortrait(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && hasExactKeys(value, ["url", "caption_html"])
    && isString(value.url)
    && isNullableString(value.caption_html)
  )
}

function isPerson(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["author_id", "name_for_index", "surname", "url"])
    && isString(value.author_id)
    && isString(value.name_for_index)
    && isNullableString(value.surname)
    && isString(value.url)
}

function isContainingWork(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && hasExactKeys(value, ["title", "author"])
    && isString(value.title)
    && isPerson(value.author)
  )
}

function isAction(value: unknown): boolean {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["media_type", "kind", "url", "download_filename"])
    || !isString(value.url)
  ) return false

  if (value.kind === "read") {
    return isString(value.media_type)
      && ["etext", "faksimil", "infopost"].includes(value.media_type)
      && value.download_filename === null
  }
  if (value.kind === "download") {
    return isString(value.media_type)
      && ["epub", "pdf"].includes(value.media_type)
      && isString(value.download_filename)
      && value.download_filename.trim().length > 0
  }
  return false
}

function isWork(value: unknown, requireDisplayAuthor: boolean): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "work_id",
    "title_id",
    "title_path",
    "title",
    "short_title",
    "title_tooltip",
    "title_url",
    "imprint_year",
    "display_author",
    "containing_work",
    "actions"
  ])) return false
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 5) {
    return false
  }
  return isString(value.work_id)
    && isString(value.title_id)
    && isString(value.title_path)
    && isString(value.title)
    && isNullableString(value.short_title)
    && isNullableString(value.title_tooltip)
    && isString(value.title_url)
    && isNullableString(value.imprint_year)
    && (requireDisplayAuthor
      ? isPerson(value.display_author)
      : value.display_author === null || isPerson(value.display_author))
    && isContainingWork(value.containing_work)
    && value.actions.every(isAction)
}

function isSection(
  value: unknown,
  expectedKind: string,
  expectedLabel: string,
  expectedShowAuthor: boolean
): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["kind", "label", "show_author", "items"])
    && value.kind === expectedKind
    && value.label === expectedLabel
    && value.show_author === expectedShowAuthor
    && Array.isArray(value.items)
    && value.items.every(item => isWork(item, expectedShowAuthor))
}

function isShell(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, [
      "author_id",
      "full_name",
      "birth_year",
      "death_year",
      "has_introduction",
      "has_dramawebben",
      "search_url",
      "audio_url",
      "map_url",
      "portrait",
      "related_links",
      "encyclopedia_links"
    ])
    && isString(value.author_id)
    && isString(value.full_name)
    && isNullableString(value.birth_year)
    && isNullableString(value.death_year)
    && typeof value.has_introduction === "boolean"
    && typeof value.has_dramawebben === "boolean"
    && isNullableString(value.search_url)
    && isNullableString(value.audio_url)
    && isNullableString(value.map_url)
    && isPortrait(value.portrait)
    && Array.isArray(value.related_links)
    && value.related_links.every(isLink)
    && Array.isArray(value.encyclopedia_links)
    && value.encyclopedia_links.every(isLink)
}

export function isAuthorWorksResponse(value: unknown): value is AuthorWorksResponse {
  if (!isRecord(value) || !hasExactKeys(value, [
    "author",
    "authored_sections",
    "about_sections"
  ])) return false
  if (!isShell(value.author)) return false
  const authorName = (value.author as { full_name: string }).full_name
  return Array.isArray(value.authored_sections)
    && value.authored_sections.length === authoredSections.length
    && value.authored_sections.every((section, index) => (
      isSection(
        section,
        authoredSections[index]!.kind,
        authoredSections[index]!.label,
        authoredSections[index]!.showAuthor
      )
    ))
    && Array.isArray(value.about_sections)
    && value.about_sections.length === aboutSections.length
    && value.about_sections.every((section, index) => (
      isSection(
        section,
        aboutSections[index]!.kind,
        aboutSections[index]!.label(authorName),
        true
      )
    ))
}

const actionOrder: Record<AuthorWorkAction["media_type"], number> = {
  etext: 0,
  faksimil: 1,
  infopost: 2,
  epub: 3,
  pdf: 4
}

export function orderedAuthorWorkActions(
  actions: readonly AuthorWorkAction[]
): AuthorWorkAction[] {
  return [...actions].sort((left, right) => (
    actionOrder[left.media_type] - actionOrder[right.media_type]
  ))
}

export function hasAuthorWorksAboutContent(response: AuthorWorksResponse): boolean {
  return response.about_sections.some(section => section.items.length > 0)
}

export function isInfopostTitle(work: AuthorWork): boolean {
  return work.actions.some(action => (
    action.kind === "read"
    && action.media_type === "infopost"
    && action.url === work.title_url
  ))
}
