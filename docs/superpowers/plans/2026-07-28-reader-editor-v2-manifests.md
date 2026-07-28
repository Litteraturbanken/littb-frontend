# Reader and Editor v2 Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Nuxt Reader and Editor metadata request with two strict FastAPI v2 manifest operations and generated TypeScript contracts while preserving exact routes, assets, SSR, navigation, degraded Editor behavior, interactions, and visuals.

**Architecture:** FastAPI privately normalizes OpenSearch and filesystem data into closed Reader and Editor manifest unions. A committed OpenAPI snapshot generates the sole TypeScript transport authority; Nitro converts those generated DTOs into existing page-specific view objects and continues to validate HTML, OCR, images, and stylesheets independently.

**Tech Stack:** Python 3.13, FastAPI 0.119, Pydantic 2.12, mypy 2.3.0 with `pydantic.mypy`, Ruff 0.15.22, pytest 8.4, OpenAPI, openapi-typescript 7.13, openapi-fetch 0.17, Node 22.22.0, Nuxt 4.4, Vue 3.5, TypeScript 5.9, Vitest 4.1, Playwright 1.61.

## Global Constraints

- Backend repository: `/Users/johan/dev/lb-backend`; frontend repository: `/Users/johan/.codex/worktrees/8c5c/littb`.
- FastAPI v2 is the sole Reader/Editor metadata authority. Production Nuxt must make zero requests to legacy `get_work_info` and `count_pages` routes.
- Do not add an Angular/Vue compatibility layer or any metadata fallback between the two applications.
- HTML, OCR, images, and stylesheets stay outside OpenAPI and keep their existing bounded/sanitized asset boundaries.
- Preserve exact route strings, query bytes, Nuxt router pushes, Back/Forward history, debounced page flipping, stale-request cancellation, horizontal-scroll retention, and stable sidebar lifecycle.
- Do not add a composable for data used by only one page; page-specific fetching stays in `<script setup>`.
- Generated files are never hand-edited. Export `/Users/johan/dev/lb-backend/openapi/v2.json` first, then generate `nuxt/app/lib/api/generated/lbapi.ts` from that file.
- Keep TypeScript strict, `noUncheckedIndexedAccess`, zero ESLint errors/warnings, backend strict mypy, and blocking Ruff `E4,E7,E9,F,S` green.
- No production `any`, broad unsafe assertion, handwritten copy of a v2 DTO, or compile-only `$fetch<T>` trust boundary is permitted.
- Preserve immutable visual baseline bytes at authority commit `06add2bb`; do not update baselines, masks, thresholds, or viewports.
- Backend tests own model/provider/API semantics; Nuxt unit/SSR tests own projection and server rendering; Playwright owns observable browser behavior. Do not test handler syntax or duplicate the OpenAPI snapshot field by field.
- Preserve unrelated dirty and untracked files in both repositories. Stage only task-owned paths and make a focused commit at each task boundary.

## File Structure

### Backend

- Create `lbapi/v2/work_manifest_models.py`: public closed Pydantic schemas, bounded scalar aliases, discriminated Reader/Editor unions, and cross-field validators.
- Create `lbapi/v2/work_manifest_provider.py`: private raw-provider parsing, exact representation selection, normalization, page/part/contributor rules, Editor bounds, and filesystem counting.
- Create `lbapi/v2/work_manifest.py`: request aliases, typed errors, two GET operations, and provider/error orchestration.
- Modify `lbapi/v2/app.py`: register the manifest router.
- Create `test_lbapi/v2/test_work_manifest_models.py`: meaningful validation partitions.
- Create `test_lbapi/v2/test_work_manifest_provider.py`: query projection and normalization behavior.
- Create `test_lbapi/v2/test_work_manifest_api.py`: HTTP success/error classification and redaction.
- Modify `test_lbapi/v2/test_openapi.py` and `openapi/v2.json`: generic invariants and deterministic snapshot.

### Frontend

- Create `nuxt/shared/types/work-manifest.ts`: aliases selected directly from generated `operations` and `components`.
- Create `nuxt/test/nuxt/reader-editor-manifest-contract.ts`: standalone exact compile-time contract.
- Create `nuxt/server/utils/work-manifest-client.ts`: generated-client calls and deliberate Nitro error mapping.
- Modify `nuxt/server/utils/reader-source.ts`: retain asset helpers and derive Reader metadata from generated manifests; remove raw legacy parsing and fallback.
- Modify `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`: assemble the existing page view from generated nested types.
- Modify `nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts`: resolve media shorthand through the v2 manifest.
- Modify `nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts`: consume complete/bounds-only generated arms and retain asset logic.
- Modify `nuxt/shared/types/reader.ts` and `nuxt/shared/types/editor-reader.ts`: keep only Nuxt-created view fields and generated aliases.
- Modify Reader/Editor components and pages only where generated snake-case nested fields replace duplicate camel-case transport fields.
- Modify `nuxt/test/fixtures/reader-data.mjs` and `nuxt/test/fixtures/v2-server.mjs`: deterministic v2 manifests and request ledgers; retain legacy fixture routes solely for Angular authority capture.
- Modify focused unit, SSR, E2E, and visual-request-ledger tests; do not change baseline images.
- Modify `tasks.py`, `test/test_tasks.py`, `nuxt/scripts/verify-architecture-policy.mjs`, `nuxt/test/unit/architecture-policy.spec.ts`, `nuxt/README.md`, and `docs/quality.md`: deterministic generation, focused gate, enforced ownership, and documentation.

---

### Task 1: Define the strict manifest schema graph

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest_models.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_models.py`

**Interfaces:**
- Consumes: `lbapi.v2.models.V2Model`; existing route-safe/control-safe string conventions.
- Produces: `ManifestMediaType`, `ManifestContributionRole`, `WorkManifestContributor`, `WorkManifestPage`, `WorkManifestFacsimilePage`, `WorkManifestPartAuthor`, `WorkManifestPart`, `FacsimileSize`, `AlternateManifestMedia`, `PublicReaderTarget`, `DenseEditorPageBounds`, `SparseEditorPageBounds`, `ReaderEtextManifest`, `ReaderFacsimileManifest`, `ReaderManifestResponse`, `EditorCompleteManifest`, `EditorPageBoundsOnlyManifest`, and `EditorManifestResponse`.

- [ ] **Step 1: Write RED model tests for the valid response arms**

Create helpers that build one complete e-text Reader, one faksimil Reader, one complete Editor, and one bounds-only Editor payload. Assert exact round trips and union discrimination:

```python
def test_reader_manifest_discriminates_exact_media_arms() -> None:
    etext = ReaderManifestAdapter.validate_python(reader_payload("etext"))
    facsimile = ReaderManifestAdapter.validate_python(reader_payload("faksimil"))
    assert isinstance(etext, ReaderEtextManifest)
    assert isinstance(facsimile, ReaderFacsimileManifest)
    assert facsimile.pages[0].image_number == 27


def test_editor_manifest_discriminates_complete_and_bounds_only() -> None:
    complete = EditorManifestAdapter.validate_python(editor_complete_payload())
    degraded = EditorManifestAdapter.validate_python({
        "status": "page_bounds_only",
        "work_id": "lb-editor",
        "media_type": "faksimil",
        "bounds": {"kind": "dense", "page_count": 3},
    })
    assert isinstance(complete, EditorCompleteManifest)
    assert isinstance(degraded, EditorPageBoundsOnlyManifest)
```

Define the adapters in the test from the public unions:

```python
ReaderManifestAdapter = TypeAdapter(ReaderManifestResponse)
EditorManifestAdapter = TypeAdapter(EditorManifestResponse)
```

Use this complete Reader helper so every required/null field is explicit:

```python
def reader_payload(media_type: str) -> dict[str, object]:
    common: dict[str, object] = {
        "media_type": media_type,
        "author_id": "SöderbergH",
        "title_path": "DoktorGlas",
        "work_id": "lb-reader-doktor-glas",
        "editor_work_id": None,
        "contributors": [{
            "author_id": "SöderbergH",
            "full_name": "Hjalmar Söderberg",
            "author_type": None,
            "role": None,
        }],
        "display_title": "Doktor Glas",
        "full_title": "Doktor Glas. Roman",
        "imprint_year": "1905",
        "urn": None,
        "declared_page_count": 2,
        "page_step": 1,
        "start_page_name": "-2",
        "end_page_name": "-1",
        "parts": [],
        "alternate_media": None,
        "searchable": True,
        "is_drama": False,
        "has_dramawebben": False,
        "has_nya_vagar": False,
    }
    if media_type == "etext":
        return {
            **common,
            "pages": [
                {"page_name": "-2", "page_index": 0},
                {"page_name": "-1", "page_index": 1},
            ],
        }
    return {
        **common,
        "pages": [
            {"page_name": "-2", "page_index": 0, "image_number": 27},
            {"page_name": "-1", "page_index": 1, "image_number": 31},
        ],
        "sizes": [{"size": 3, "width": 625.0}],
        "preferred_size": 3,
    }
```

Use this exact complete Editor field set in `editor_complete_payload()`:

```python
return {
    "status": "complete",
    "work_id": "lb-editor",
    "media_type": "faksimil",
    "bounds": {"kind": "sparse", "page_indexes": [2, 12, 57]},
    "display_title": "Ett verkligt jordiskt",
    "title_path": "EttVerkligtJordiskt",
    "contributors": [{
        "author_id": "BoyeK",
        "full_name": "Karin Boye",
        "author_type": None,
        "role": None,
    }],
    "pages": [
        {"page_name": "2", "page_index": 2},
        {"page_name": "12", "page_index": 12},
        {"page_name": "57", "page_index": 57},
    ],
    "parts": [],
    "start_page_name": "2",
    "end_page_name": "57",
    "searchable": True,
    "imprint_year": "1934",
    "sizes": [{"size": 3, "width": 625.0}],
    "public_reader_target": {
        "author_id": "BoyeK",
        "title_path": "EttVerkligtJordiskt",
        "start_page_name": "2",
        "media_type": "faksimil",
    },
}
```

- [ ] **Step 2: Write RED tests for meaningful invalid partitions**

Cover these independent regressions, one assertion per partition:

```python
@pytest.mark.parametrize(
    "mutation",
    [
        lambda value: {**value, "private": True},
        lambda value: {**value, "contributors": []},
        lambda value: {**value, "contributors": value["contributors"] * 101},
        lambda value: {**value, "pages": [value["pages"][0], value["pages"][0]]},
        lambda value: {**value, "page_step": 0},
        lambda value: {**value, "declared_page_count": 0},
    ],
)
def test_reader_manifest_rejects_invalid_contract_partitions(mutation) -> None:
    with pytest.raises(ValidationError):
        ReaderManifestAdapter.validate_python(mutation(reader_payload("etext")))


def test_editor_bounds_rejects_contradictory_and_unsorted_shapes() -> None:
    with pytest.raises(ValidationError):
        DenseEditorPageBounds.model_validate({
            "kind": "dense", "page_count": 3, "page_indexes": [0, 1, 2],
        })
    with pytest.raises(ValidationError):
        SparseEditorPageBounds.model_validate({
            "kind": "sparse", "page_indexes": [2, 12, 2],
        })
```

Also prove unique contributor IDs, unique page names/indexes, part range ordering, part-page membership, nullable part-author names, size `1..5`, positive finite widths, preferred-size membership, and the 100,000-page/10,000-part/100-contributor/100-part-author limits.

- [ ] **Step 3: Run the model tests and observe RED**

Run:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_work_manifest_models.py
```

Expected: collection fails because `lbapi.v2.work_manifest_models` and its public types do not exist.

- [ ] **Step 4: Implement the bounded scalars and shared models**

Use annotated Pydantic types and validators, not free dictionaries:

```python
ManifestMediaType = Literal["etext", "faksimil"]


class ManifestContributionRole(StrEnum):
    EDITOR = "editor"
    TRANSLATOR = "translator"
    ILLUSTRATOR = "illustrator"
    PHOTOGRAPHER = "photographer"
ManifestIdentifier = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_manifest_segment),
]
ManifestPageName = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_manifest_text),
]
ManifestTitle = Annotated[
    str,
    StringConstraints(min_length=1, max_length=2_000),
    AfterValidator(validate_manifest_text),
]


class WorkManifestContributor(V2Model):
    author_id: ManifestIdentifier
    full_name: ManifestTitle
    author_type: ManifestContributionRole | None
    role: ManifestContributionRole | None


class WorkManifestPage(V2Model):
    page_name: ManifestPageName
    page_index: int = Field(ge=0, lt=100_000)


class WorkManifestFacsimilePage(WorkManifestPage):
    image_number: int = Field(ge=0, lt=100_000)


class WorkManifestPartAuthor(V2Model):
    author_id: ManifestIdentifier
    full_name: ManifestTitle | None
    surname: ManifestTitle | None


class WorkManifestPart(V2Model):
    source_index: int = Field(ge=0, lt=10_000)
    start_page_name: ManifestPageName
    start_page_index: int = Field(ge=0, lt=100_000)
    end_page_name: ManifestPageName
    end_page_index: int = Field(ge=0, lt=100_000)
    title: ManifestTitle
    nav_title: ManifestTitle | None
    short_title: ManifestTitle | None
    title_id: ManifestIdentifier | None
    authors: list[WorkManifestPartAuthor] = Field(max_length=100)

    @model_validator(mode="after")
    def require_ascending_range(self) -> Self:
        if self.start_page_index > self.end_page_index:
            raise ValueError("part page range must be ascending")
        return self


class FacsimileSize(V2Model):
    size: Literal[1, 2, 3, 4, 5]
    width: float = Field(gt=0, le=10_000, allow_inf_nan=False)


class AlternateManifestMedia(V2Model):
    media_type: ManifestMediaType
    pages: list[WorkManifestPage] = Field(min_length=1, max_length=100_000)


class PublicReaderTarget(V2Model):
    author_id: ManifestIdentifier
    title_path: ManifestIdentifier
    start_page_name: ManifestPageName
    media_type: ManifestMediaType


class DenseEditorPageBounds(V2Model):
    kind: Literal["dense"]
    page_count: int = Field(ge=1, le=100_000)


class SparseEditorPageBounds(V2Model):
    kind: Literal["sparse"]
    page_indexes: list[int] = Field(min_length=1, max_length=100_000)

    @field_validator("page_indexes")
    @classmethod
    def require_ordered_unique_indexes(cls, value: list[int]) -> list[int]:
        if value != sorted(set(value)) or value[-1] >= 100_000:
            raise ValueError("page indexes must be ordered, unique, and bounded")
        return value


EditorPageBounds = Annotated[
    DenseEditorPageBounds | SparseEditorPageBounds,
    Field(discriminator="kind"),
]
```

`validate_manifest_segment` rejects surrounding whitespace, C0/C1/surrogate controls, `/`, `\\`, `?`, and `#`. `validate_manifest_text` rejects surrounding whitespace and Unicode categories `Cc` and `Cs`.

- [ ] **Step 5: Implement the manifest unions and cross-field validators**

Create a common Reader base and concrete arms. Use one `model_validator(mode="after")` to require unique ordered pages, first contributor identity, valid start/end names, valid part ranges, and preferred-size membership:

```python
class ReaderManifestBase(V2Model):
    author_id: ManifestIdentifier
    title_path: ManifestIdentifier
    work_id: ManifestIdentifier
    editor_work_id: ManifestIdentifier | None
    contributors: list[WorkManifestContributor] = Field(min_length=1, max_length=100)
    display_title: ManifestTitle
    full_title: ManifestTitle
    imprint_year: ManifestPageName | None
    urn: Annotated[str, Field(min_length=1, max_length=100)] | None
    declared_page_count: int | None = Field(default=None, ge=1, le=100_000)
    page_step: int = Field(ge=1, le=100_000)
    start_page_name: ManifestPageName | None
    end_page_name: ManifestPageName | None
    parts: list[WorkManifestPart] = Field(max_length=10_000)
    alternate_media: AlternateManifestMedia | None
    searchable: bool
    is_drama: bool
    has_dramawebben: bool
    has_nya_vagar: bool


class ReaderEtextManifest(ReaderManifestBase):
    media_type: Literal["etext"]
    pages: list[WorkManifestPage] = Field(min_length=1, max_length=100_000)


class ReaderFacsimileManifest(ReaderManifestBase):
    media_type: Literal["faksimil"]
    pages: list[WorkManifestFacsimilePage] = Field(min_length=1, max_length=100_000)
    sizes: list[FacsimileSize] = Field(min_length=1, max_length=5)
    preferred_size: int = Field(ge=1, le=5)


class EditorCompleteManifest(V2Model):
    status: Literal["complete"]
    work_id: ManifestIdentifier
    media_type: ManifestMediaType
    bounds: EditorPageBounds
    display_title: ManifestTitle
    title_path: ManifestIdentifier
    contributors: list[WorkManifestContributor] = Field(min_length=1, max_length=100)
    pages: list[WorkManifestPage] = Field(max_length=100_000)
    parts: list[WorkManifestPart] = Field(max_length=10_000)
    start_page_name: ManifestPageName | None
    end_page_name: ManifestPageName | None
    searchable: bool
    imprint_year: ManifestPageName | None
    sizes: list[FacsimileSize] = Field(max_length=5)
    public_reader_target: PublicReaderTarget | None


class EditorPageBoundsOnlyManifest(V2Model):
    status: Literal["page_bounds_only"]
    work_id: ManifestIdentifier
    media_type: ManifestMediaType
    bounds: EditorPageBounds


ReaderManifestResponse = Annotated[
    ReaderEtextManifest | ReaderFacsimileManifest,
    Field(discriminator="media_type"),
]
EditorManifestResponse = Annotated[
    EditorCompleteManifest | EditorPageBoundsOnlyManifest,
    Field(discriminator="status"),
]
```

`EditorCompleteManifest` requires complete title/title-path/contributor fields, an Editor bounds arm, optional validated page identities, parts, searchability, imprint, normalized facsimile sizes, and a nullable structured public close target. `EditorPageBoundsOnlyManifest` contains exactly status/work/media/bounds.

The exact complete fields are `status`, `work_id`, `media_type`, `bounds`,
`display_title`, `title_path`, `contributors`, `pages`, `parts`,
`start_page_name`, `end_page_name`, `searchable`, `imprint_year`, `sizes`, and
`public_reader_target`. `PublicReaderTarget` contains exact author/title/start
page/media route identity. Nullable fields are required keys rather than
silently omitted.

- [ ] **Step 6: Run the focused and static checks GREEN**

Run:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_work_manifest_models.py
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2/work_manifest_models.py
virtual_env/bin/python -m ruff check lbapi/v2/work_manifest_models.py test_lbapi/v2/test_work_manifest_models.py --select E4,E7,E9,F,S
```

Expected: every command exits 0.

- [ ] **Step 7: Commit the schema graph**

```bash
cd /Users/johan/dev/lb-backend
git add lbapi/v2/work_manifest_models.py test_lbapi/v2/test_work_manifest_models.py
git commit -m "feat: define Reader Editor manifest contracts"
```

### Task 2: Normalize and publish the public Reader manifest

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest_provider.py`
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/app.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_provider.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_api.py`

**Interfaces:**
- Consumes: Task 1 models; `lbapi.elasticapi.get_work_by_titlepath`; `ApiError`, `ApiErrorResponse`, and `FastApiResponses`.
- Produces: `WORK_MANIFEST_FIELDS`, `ReaderManifestNotFound`, `query_reader_manifest_documents(title_path: str, author_id: str) -> object`, `transform_reader_manifest(raw: object, author_id: str, title_path: str, media_type: ManifestMediaType) -> ReaderManifestResponse`, `load_reader_manifest(author_id: str, title_path: str, media_type: ManifestMediaType) -> ReaderManifestResponse`, and GET `/works/{author_id}/{title_path}/manifest` with operation ID `v2_get_reader_work_manifest`.

- [ ] **Step 1: Write RED provider tests for query ownership and exact selection**

Use small raw representation builders. Assert one provider call with the exact identity and explicit projection:

```python
def test_reader_query_uses_exact_identity_and_safe_projection(monkeypatch) -> None:
    calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    monkeypatch.setattr(provider, "_legacy_api", lambda: SimpleNamespace(
        get_work_by_titlepath=lambda *args, **kwargs: calls.append((args, kwargs))
        or {"hits": 0, "data": []},
    ))
    provider.query_reader_manifest_documents("DoktorGlas", "SöderbergH")
    assert calls == [(('DoktorGlas', 'SöderbergH', None), {
        "show_only": True,
        "includes": provider.WORK_MANIFEST_FIELDS,
        "excludes": (),
    })]
    assert "content_vector" not in provider.WORK_MANIFEST_FIELDS
```

Add independent tests for exact author/title/media identity, missing media, duplicate exact representations, malformed present pages, e-text sibling inheritance only for the same work ID, no facsimile inheritance, sparse ordering, image-number preservation, alternate-media validation, contribution normalization, flags, parts, size normalization, and preferred size.

- [ ] **Step 2: Write RED API tests for typed success and failures**

```python
def test_reader_manifest_route_returns_the_exact_typed_arm(client, monkeypatch) -> None:
    monkeypatch.setattr(
        work_manifest,
        "load_reader_manifest",
        lambda author_id, title_path, media_type: ReaderEtextManifest.model_validate(
            reader_payload("etext")
        ),
    )
    response = client.get(
        "/works/S%C3%B6derbergH/DoktorGlas/manifest",
        params={"media_type": "etext"},
    )
    assert response.status_code == 200
    assert response.json()["media_type"] == "etext"
    assert "content_vector" not in response.text


def test_reader_manifest_absence_is_non_leaking_404(client, monkeypatch) -> None:
    monkeypatch.setattr(
        work_manifest,
        "load_reader_manifest",
        Mock(side_effect=ReaderManifestNotFound),
    )
    response = client.get("/works/Author/Absent/manifest?media_type=etext")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "reader_manifest_not_found"
```

Also assert 422 unsafe/unknown input, redacted 503 provider failure, standard redacted 500 malformed-provider failure, and the exact operation path/method through `v2_app.openapi()` without restating every schema property.

- [ ] **Step 3: Run the focused tests RED**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py
```

Expected: failures report missing provider/router functions and an unregistered path.

- [ ] **Step 4: Implement private parsing and Reader normalization**

The provider owns a typed protocol and exact projection:

```python
WORK_MANIFEST_FIELDS = (
    "lbworkid",
    "editor_lbworkid",
    "titlepath",
    "titleid",
    "work_titleid",
    "title",
    "shorttitle",
    "mediatype",
    "startpagename",
    "endpagename",
    "page_count",
    "pagestep",
    "pages.pagename",
    "pages.pageindex",
    "pages.imagenumber",
    "authors.authorid",
    "authors.full_name",
    "authors.surname",
    "authors.role",
    "authors.type",
    "work_authors.authorid",
    "work_authors.full_name",
    "work_authors.surname",
    "work_authors.role",
    "work_authors.type",
    "main_author.authorid",
    "main_author.full_name",
    "main_author.surname",
    "main_author.role",
    "main_author.type",
    "parts.startpagename",
    "parts.endpagename",
    "parts.title",
    "parts.navtitle",
    "parts.shorttitle",
    "parts.titleid",
    "parts.authors.authorid",
    "parts.authors.full_name",
    "parts.authors.surname",
    "faksimil_sizes",
    "width.size_1",
    "width.size_2",
    "width.size_3",
    "width.size_4",
    "width.size_5",
    "sort_date_imprint.plain",
    "imprintyear",
    "urn",
    "texttype",
    "dramawebben",
    "keyword",
    "searchable",
    "mediatypes.url",
)


class _WorkManifestLegacyApi(Protocol):
    def get_work_by_titlepath(self, *args: object, **kwargs: object) -> object: ...
    def get_work_by_lbworkid(self, *args: object, **kwargs: object) -> object: ...


def query_reader_manifest_documents(title_path: str, author_id: str) -> object:
    return _legacy_api().get_work_by_titlepath(
        title_path,
        author_id,
        None,
        show_only=True,
        includes=WORK_MANIFEST_FIELDS,
        excludes=(),
    )
```

Parse raw values as `object` through `legacy_object`, `legacy_objects`, and focused bounded helpers. Select all records whose `titlepath` and `mediatype` equal the request; require exactly one selected record and require its first normalized contributor to equal `author_id`. Construct Pydantic models only after every field validates.

For e-text pages use this exact rule:

```python
pages_value = selected.get("pages")
if pages_value is not None:
    pages = normalize_pages(pages_value)
else:
    pages = next(
        (
            normalize_pages(candidate["pages"])
            for candidate in records
            if candidate is not selected
            and candidate.get("lbworkid") == work_id
            and candidate.get("pages") is not None
        ),
        None,
    )
if pages is None:
    raise ValueError(MALFORMED_MANIFEST)
```

Facsimile always calls `normalize_facsimile_pages(selected["pages"])` and never enters sibling inheritance. Preserve part source indexes, normalize contribution synonyms to the four canonical literals, and derive only the approved booleans.

- [ ] **Step 5: Implement the Reader endpoint and typed error mapping**

```python
MANIFEST_RESPONSES: FastApiResponses = {
    404: {"model": ApiErrorResponse, "description": "Work manifest not found"},
    422: {"model": ApiErrorResponse, "description": "Invalid request"},
    500: {"model": ApiErrorResponse, "description": "Unexpected server error"},
    503: {"model": ApiErrorResponse, "description": "Search backend unavailable"},
}

ManifestRequestAuthorId = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_manifest_segment),
]
ManifestRequestTitlePath = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_manifest_segment),
]


@router.get(
    "/works/{author_id}/{title_path}/manifest",
    operation_id="v2_get_reader_work_manifest",
    response_model=ReaderManifestResponse,
    responses=MANIFEST_RESPONSES,
)
def get_reader_work_manifest(
    author_id: ManifestRequestAuthorId,
    title_path: ManifestRequestTitlePath,
    media_type: ManifestMediaType,
) -> ReaderManifestResponse:
    try:
        return load_reader_manifest(author_id, title_path, media_type)
    except ReaderManifestNotFound as error:
        raise HTTPException(
            status_code=404,
            detail=ApiError(
                code="reader_manifest_not_found",
                message="Reader manifest not found",
            ).model_dump(mode="json"),
        ) from error
    except OpenSearchException as error:
        raise HTTPException(
            status_code=503,
            detail=ApiError(
                code="reader_manifest_unavailable",
                message="Unable to load Reader manifest",
            ).model_dump(mode="json"),
        ) from error
```

Allow malformed provider `ValueError` to reach the standard redacted 500 handler. Register only this new router once in `app.py`.

- [ ] **Step 6: Run Reader tests and static analysis GREEN**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_work_manifest_models.py \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/work_manifest_models.py \
  lbapi/v2/work_manifest_provider.py \
  lbapi/v2/work_manifest.py
virtual_env/bin/python -m ruff check \
  lbapi/v2/work_manifest_models.py \
  lbapi/v2/work_manifest_provider.py \
  lbapi/v2/work_manifest.py \
  test_lbapi/v2/test_work_manifest_models.py \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py \
  --select E4,E7,E9,F,S
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the public Reader operation**

```bash
cd /Users/johan/dev/lb-backend
git add lbapi/v2/app.py lbapi/v2/work_manifest.py \
  lbapi/v2/work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py
git commit -m "feat: publish typed Reader manifest"
```

### Task 3: Add exact Editor manifests and typed degradation

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest_provider.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_provider.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_api.py`

**Interfaces:**
- Consumes: Task 1 Editor unions; Task 2 query/parser helpers; `lbapi.elasticapi.get_work_by_lbworkid`.
- Produces: `EditorManifestNotFound`, `EditorManifestUnavailable`, `query_editor_manifest_documents(work_id: str) -> object`, `count_editor_pages(work_id: str, media_type: ManifestMediaType) -> int`, `load_editor_manifest(work_id: str, media_type: ManifestMediaType) -> EditorManifestResponse`, and GET `/works/{work_id}/editor-manifest` with operation ID `v2_get_editor_work_manifest`.

- [ ] **Step 1: Add RED provider tests for complete, degraded, and unavailable states**

Use monkeypatches for both metadata query and filesystem count. Cover this exact decision table:

| Metadata result | Bounds result | Expected |
| --- | --- | --- |
| exact valid representation | valid dense/sparse | `complete` |
| missing/malformed optional metadata | positive bounds | `page_bounds_only` |
| requested media absent | positive filesystem count | `page_bounds_only` |
| metadata query succeeds with no requested media | zero files | not found |
| metadata provider unavailable | positive filesystem count | `page_bounds_only` |
| metadata provider unavailable | zero files | unavailable |
| filesystem probe fails and metadata has no safe bounds | any | unavailable |
| duplicate/contradictory exact representations | no safe bounds | malformed-provider failure |

Assert no wrong-media fallback:

```python
def test_editor_never_selects_the_first_wrong_media_representation(monkeypatch) -> None:
    monkeypatch.setattr(provider, "query_editor_manifest_documents", lambda work_id: raw(
        representation(media_type="etext"),
    ))
    monkeypatch.setattr(provider, "count_editor_pages", lambda work_id, media_type: 3)
    result = provider.load_editor_manifest("lb-editor", "faksimil")
    assert result.status == "page_bounds_only"
    assert result.media_type == "faksimil"
```

Assert dense bounds from a valid positive declared count, sparse bounds from ordered page indexes when no declared count exists, and filesystem count only when metadata cannot establish bounds.

- [ ] **Step 2: Add RED API tests for both success arms and all statuses**

```python
@pytest.mark.parametrize("status", ["complete", "page_bounds_only"])
def test_editor_manifest_route_serializes_each_generated_arm(
    client, monkeypatch, status: str,
) -> None:
    manifest = editor_complete_model() if status == "complete" else editor_bounds_model()
    monkeypatch.setattr(work_manifest, "load_editor_manifest", lambda work_id, media: manifest)
    response = client.get("/works/lb-editor/editor-manifest?media_type=faksimil")
    assert response.status_code == 200
    assert response.json()["status"] == status
```

Add explicit 404, 422, redacted 503, and standard redacted 500 cases. Assert that a bounds-only body contains exactly `status`, `work_id`, `media_type`, and `bounds`.

- [ ] **Step 3: Run the Editor-focused tests RED**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py -k editor
```

Expected: failures report missing Editor provider orchestration and endpoint.

- [ ] **Step 4: Implement Editor query and filesystem bounds**

```python
def query_editor_manifest_documents(work_id: str) -> object:
    return _legacy_api().get_work_by_lbworkid(
        work_id,
        types="etext,faksimil",
        includes=WORK_MANIFEST_FIELDS,
        excludes=(),
    )


def count_editor_pages(work_id: str, media_type: ManifestMediaType) -> int:
    subpath = Path(".") if media_type == "etext" else Path(f"{work_id}_1")
    pattern = "res_*.html" if media_type == "etext" else "*.jpeg"
    for root in EDITOR_ASSET_ROOTS:
        work_root = root / work_id
        count = sum(1 for path in (work_root / subpath).glob(pattern) if path.is_file())
        if count > 0:
            return count
    return 0
```

Keep `EDITOR_ASSET_ROOTS` as `(Path("/mnt/littbox/red/txt"), Path("/mnt/littbox/red_live/txt"))` so tests can monkeypatch it. Reject unsafe work IDs before filesystem access.
Map an `OSError` from either root to `EditorManifestUnavailable`; do not turn a
permission or mount failure into a zero-page 404.

- [ ] **Step 5: Implement atomic Editor normalization and degradation**

Separate bounds parsing from optional metadata parsing. The orchestration must preserve provider availability:

```python
def load_editor_manifest(
    work_id: str,
    media_type: ManifestMediaType,
) -> EditorManifestResponse:
    provider_available = True
    try:
        raw = query_editor_manifest_documents(work_id)
        records = normalize_provider_envelope(raw)
    except OpenSearchException:
        provider_available = False
        records = []

    exact = [record for record in records if record.get("mediatype") == media_type]
    metadata_bounds = normalize_editor_bounds(exact)
    filesystem_count = 0 if metadata_bounds is not None else count_editor_pages(
        work_id, media_type
    )
    bounds = metadata_bounds or (
        DenseEditorPageBounds(kind="dense", page_count=filesystem_count)
        if filesystem_count > 0 else None
    )
    if bounds is None:
        if not provider_available:
            raise EditorManifestUnavailable
        raise EditorManifestNotFound

    try:
        return normalize_editor_complete(exact, work_id, media_type, bounds, records)
    except (LookupError, TypeError, ValueError, ValidationError):
        return EditorPageBoundsOnlyManifest(
            status="page_bounds_only",
            work_id=work_id,
            media_type=media_type,
            bounds=bounds,
        )
```

Before degradation, treat duplicate exact records as contradictory. If their bounds cannot be independently established, propagate malformed data rather than inventing a response. `normalize_editor_complete` requires title/title path/contributors, validates pages and parts atomically, produces a structured nullable close target, and returns normalized faksimil widths. It never copies a field from a wrong-media representation except the independently validated close target.

- [ ] **Step 6: Add the Editor route and typed errors**

Register the second GET on the existing manifest router with `response_model=EditorManifestResponse`, `operation_id="v2_get_editor_work_manifest"`, and the same declared 404/422/500/503 envelope map. Use endpoint-specific codes `editor_manifest_not_found` and `editor_manifest_unavailable`; redact provider and filesystem details.

- [ ] **Step 7: Run the complete backend manifest tranche GREEN**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_work_manifest_models.py \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
```

Expected: all commands exit 0 and no legacy HTTP route is called by the new provider.

- [ ] **Step 8: Commit Editor manifests**

```bash
cd /Users/johan/dev/lb-backend
git add lbapi/v2/work_manifest.py lbapi/v2/work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_provider.py \
  test_lbapi/v2/test_work_manifest_api.py
git commit -m "feat: publish typed Editor manifests"
```

### Task 4: Publish and freeze the backend OpenAPI contract

**Files:**
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/dev/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: Tasks 1–3 registered operations and response models.
- Produces: deterministic OpenAPI paths `/works/{author_id}/{title_path}/manifest` and `/works/{work_id}/editor-manifest`, stable operation IDs, closed schema graph, declared `ApiErrorResponse` errors, and the canonical snapshot for frontend generation.

- [ ] **Step 1: Add focused OpenAPI assertions that complement the snapshot**

Do not restate every model property. Add one test proving path/operation/discriminator/error invariants:

```python
def test_manifest_operations_publish_closed_discriminated_contracts() -> None:
    schema = v2_app.openapi()
    reader = schema["paths"]["/works/{author_id}/{title_path}/manifest"]["get"]
    editor = schema["paths"]["/works/{work_id}/editor-manifest"]["get"]
    assert reader["operationId"] == "v2_get_reader_work_manifest"
    assert editor["operationId"] == "v2_get_editor_work_manifest"
    assert set(reader["responses"]) >= {"200", "404", "422", "500", "503"}
    assert set(editor["responses"]) >= {"200", "404", "422", "500", "503"}
    assert schema["components"]["schemas"]["ReaderEtextManifest"]["additionalProperties"] is False
    assert schema["components"]["schemas"]["EditorPageBoundsOnlyManifest"]["additionalProperties"] is False
```

The existing generic OpenAPI test continues to own closure for every nested object and `ApiErrorResponse` wiring for every JSON error.

- [ ] **Step 2: Run OpenAPI tests and snapshot check RED**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
```

Expected: the semantic OpenAPI test passes; the check fails because `openapi/v2.json` does not yet contain the two operations.

- [ ] **Step 3: Export the canonical snapshot and inspect its graph**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python scripts/export_v2_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
rg -n 'v2_get_(reader_work_manifest|editor_work_manifest)|ReaderEtextManifest|EditorPageBoundsOnlyManifest' openapi/v2.json
```

Expected: export and check exit 0; `rg` finds both operation IDs and all public schema names. Inspect that neither operation exposes `content_vector`, `get_work_info`, `count_pages`, raw provider records, or undeclared dictionaries.

- [ ] **Step 4: Run the complete v2 backend gate**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
virtual_env/bin/python -m pytest -q test_lbapi/v2
```

Expected: strict mypy and blocking Ruff report zero findings and every v2 test passes.

- [ ] **Step 5: Commit the canonical backend contract**

```bash
cd /Users/johan/dev/lb-backend
git add test_lbapi/v2/test_openapi.py openapi/v2.json
git commit -m "chore: snapshot Reader Editor manifests"
```

### Task 5: Generate exact TypeScript contracts deterministically

**Files:**
- Modify: `tasks.py`
- Modify: `test/test_tasks.py`
- Modify: `nuxt/app/lib/api/generated/lbapi.ts` through codegen only
- Create: `nuxt/shared/types/work-manifest.ts`
- Create: `nuxt/test/nuxt/reader-editor-manifest-contract.ts`
- Modify: `nuxt/test/unit/api-client.spec.ts`

**Interfaces:**
- Consumes: Task 4 `/Users/johan/dev/lb-backend/openapi/v2.json`; existing `createLbApiClient`.
- Produces: generated operation and component types, exact shared type aliases, deterministic root `invoke codegen.generate`, and compile-time serialization/error evidence.

- [ ] **Step 1: Write RED root-task tests for snapshot-first generation**

Extend `test/test_tasks.py` so `codegen.generate` must call these commands in this order:

```python
expected = [
    (
        backend_dir,
        [backend_python, "scripts/export_v2_openapi.py"],
        None,
    ),
    (
        nuxt_dir,
        ["yarn", "api:generate"],
        {"LBAPI_OPENAPI_SCHEMA": str(backend_dir / "openapi" / "v2.json")},
    ),
]
assert normalized_calls(recorded_calls) == expected
```

Keep the existing configured Node-runtime assertion and prove a configured live `LBAPI_OPENAPI_SCHEMA` cannot bypass snapshot-first root generation.

- [ ] **Step 2: Run the task test RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
python -m unittest -q test.test_tasks.InvokeTaskTests.test_codegen_generate_exports_snapshot_before_types
```

Expected: FAIL because `codegen_generate` currently reads the live-schema setting and does not export the backend snapshot.

- [ ] **Step 3: Make root generation deterministic**

Add one helper and replace the generation body:

```python
def _export_backend_openapi(context: Context, settings: Settings) -> None:
    _run(
        context,
        [_backend_python(settings), "scripts/export_v2_openapi.py"],
        settings.backend_dir,
    )


@task(name="generate", default=True)
def codegen_generate(context: Context) -> None:
    """Export the backend snapshot, then regenerate TypeScript from it."""
    settings = Settings.from_environment()
    _export_backend_openapi(context, settings)
    _run(
        context,
        ["yarn", "api:generate"],
        settings.nuxt_dir,
        env={
            "LBAPI_OPENAPI_SCHEMA": str(_openapi_snapshot(settings)),
            **_nuxt_node_environment(settings),
        },
    )
```

`codegen.check` remains non-mutating: backend `--check`, then frontend `api:check` against the snapshot.

- [ ] **Step 4: Run generation and write the exact shared aliases**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke codegen.generate
```

Then create `nuxt/shared/types/work-manifest.ts` with no field re-declarations:

```typescript
import type {
  components,
  operations,
  paths
} from "../../app/lib/api/generated/lbapi"

export type ReaderManifestOperation = operations["v2_get_reader_work_manifest"]
export type EditorManifestOperation = operations["v2_get_editor_work_manifest"]
export type ReaderManifestResponse =
  ReaderManifestOperation["responses"][200]["content"]["application/json"]
export type EditorManifestResponse =
  EditorManifestOperation["responses"][200]["content"]["application/json"]
export type WorkManifestContributor = components["schemas"]["WorkManifestContributor"]
export type ManifestContributionRole = components["schemas"]["ManifestContributionRole"]
export type WorkManifestPage = components["schemas"]["WorkManifestPage"]
export type WorkManifestFacsimilePage =
  components["schemas"]["WorkManifestFacsimilePage"]
export type WorkManifestPartAuthor = components["schemas"]["WorkManifestPartAuthor"]
export type WorkManifestPart = components["schemas"]["WorkManifestPart"]
export type FacsimileSize = components["schemas"]["FacsimileSize"]
export type EditorPageBounds =
  | components["schemas"]["DenseEditorPageBounds"]
  | components["schemas"]["SparseEditorPageBounds"]
export type ReaderManifestPath = paths["/works/{author_id}/{title_path}/manifest"]["get"]
export type EditorManifestPath = paths["/works/{work_id}/editor-manifest"]["get"]
```

- [ ] **Step 5: Add the standalone exact contract file**

In `nuxt/test/nuxt/reader-editor-manifest-contract.ts`, use the existing `Equal`/`Expect` pattern:

```typescript
type _ReaderPathMatchesOperation = Expect<Equal<
  ReaderManifestPath,
  ReaderManifestOperation
>>
type _EditorPathMatchesOperation = Expect<Equal<
  EditorManifestPath,
  EditorManifestOperation
>>
type _ReaderUnionExact = Expect<Equal<
  ReaderManifestResponse,
  | components["schemas"]["ReaderEtextManifest"]
  | components["schemas"]["ReaderFacsimileManifest"]
>>
type _EditorUnionExact = Expect<Equal<
  EditorManifestResponse,
  | components["schemas"]["EditorCompleteManifest"]
  | components["schemas"]["EditorPageBoundsOnlyManifest"]
>>
type _EditorStatusExact = Expect<Equal<
  EditorManifestResponse["status"],
  "complete" | "page_bounds_only"
>>
```

Also assert that every 404/422/500/503 response equals generated `ApiErrorResponse`, and construct one `satisfies` value for each response arm. Do not add `@ts-expect-error` to this contract.

- [ ] **Step 6: Prove generated-client request serialization and typed errors**

Add two focused cases to `api-client.spec.ts`:

```typescript
const readerManifestFixture = {
  media_type: "etext",
  author_id: "SöderbergH",
  title_path: "DoktorGlas",
  work_id: "lb-reader-doktor-glas",
  editor_work_id: null,
  contributors: [{
    author_id: "SöderbergH",
    full_name: "Hjalmar Söderberg",
    author_type: null,
    role: null
  }],
  display_title: "Doktor Glas",
  full_title: "Doktor Glas. Roman",
  imprint_year: "1905",
  urn: null,
  pages: [{ page_name: "-2", page_index: 0 }],
  declared_page_count: 1,
  page_step: 1,
  start_page_name: "-2",
  end_page_name: "-2",
  parts: [],
  alternate_media: null,
  searchable: true,
  is_drama: false,
  has_dramawebben: false,
  has_nya_vagar: false
} satisfies ReaderManifestResponse

test("encodes the exact typed Reader manifest identity", async () => {
  const fetchMock = vi.fn(async () => json(readerManifestFixture))
  const client = createLbApiClient("http://example.test/v2", fetchMock)
  await client.GET("/works/{author_id}/{title_path}/manifest", {
    params: {
      path: { author_id: "SöderbergH", title_path: "DoktorGlas" },
      query: { media_type: "etext" }
    }
  })
  expect(fetchMock.mock.calls[0][0].url).toBe(
    "http://example.test/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  )
})
```

The Editor case returns a typed `page_bounds_only` body and separately proves a 503 body exposes `error.error.code` without assertions.

- [ ] **Step 7: Run generated and compile-time checks GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke codegen.check
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt tsc --noEmit --skipLibCheck \
  --moduleResolution bundler --module esnext --target es2022 --strict \
  test/nuxt/reader-editor-manifest-contract.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt vitest run test/unit/api-client.spec.ts
python -m unittest -q test.test_tasks
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit generated contract ownership**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add tasks.py test/test_tasks.py \
  nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/shared/types/work-manifest.ts \
  nuxt/test/nuxt/reader-editor-manifest-contract.ts \
  nuxt/test/unit/api-client.spec.ts
git commit -m "feat: generate Reader Editor manifest types"
```

### Task 6: Move deterministic fixtures to the v2 manifest boundary

**Files:**
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Task 5 serialized manifest shapes; existing raw Reader/Editor fixtures and asset routes.
- Produces: deterministic v2 Reader/Editor manifest responses; `/_reader_manifest_requests` and `/_editor_manifest_requests` ledgers; legacy routes retained only for Angular capture.

- [ ] **Step 1: Write RED fixture-server tests for both v2 operations**

Add tests that request exact encoded paths and inspect discriminants:

```typescript
test("serves generated-shape Reader and Editor manifests", async () => {
  const reader = await fetch(
    `${origin}/v2/works/${encodeURIComponent("SöderbergH")}/DoktorGlas/manifest?media_type=etext`
  )
  expect(reader.status).toBe(200)
  expect(await reader.json()).toMatchObject({
    author_id: "SöderbergH",
    media_type: "etext",
    work_id: "lb-reader-doktor-glas"
  })

  const editor = await fetch(
    `${origin}/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil`
  )
  expect(await editor.json()).toEqual({
    status: "page_bounds_only",
    work_id: "lb-editor-fallback",
    media_type: "faksimil",
    bounds: { kind: "dense", page_count: 3 }
  })
})
```

Add a ledger test that resets both new ledgers, performs the calls, and receives only v2 paths. Assert existing legacy metadata ledgers remain empty during these v2 calls.

- [ ] **Step 2: Run the fixture tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/v2-server.spec.ts -t "Reader and Editor manifests"
```

Expected: the v2 manifest paths return 404 and ledger reset paths are absent.

- [ ] **Step 3: Add pure raw-to-fixture manifest builders**

In `reader-data.mjs`, add fixture-only builders with serialized snake-case fields. Reuse existing deterministic raw data but do not export it as the v2 response:

```javascript
export function readerManifestResponse(titlePath, mediaType) {
  const raw = structuredClone(readerMetadataResponse(titlePath))
  return buildReaderManifestFixture(raw.data, titlePath, mediaType)
}

export function editorManifestResponse(workId, mediaType) {
  if (workId === "lb-editor-fallback") {
    return {
      status: "page_bounds_only",
      work_id: workId,
      media_type: mediaType,
      bounds: { kind: "dense", page_count: 3 }
    }
  }
  return buildEditorCompleteFixture(editorRawRepresentationFor(workId, mediaType))
}
```

Add `editorRawRepresentationFor(workId, mediaType)` beside the existing raw
Editor fixture switch; it returns only the exact requested representation or
`null`. `buildReaderManifestFixture` must preserve current page
names/indexes/image numbers, contributors and roles, parts, sizes/widths,
flags, alternate media, declared count, and page step.
`buildEditorCompleteFixture` must preserve exact requested media, dense/sparse
bounds, public close target, contributors, parts, and widths.
Malformed/unavailable fixture IDs return the typed statuses used by backend
API tests.

- [ ] **Step 4: Register v2 routes and independent ledgers**

Before generic v2 fallthrough in `v2-server.mjs`, match:

```javascript
const readerManifestMatch = request.method === "GET"
  ? /^\/v2\/works\/([^/]+)\/([^/]+)\/manifest$/.exec(url.pathname)
  : null
const editorManifestMatch = request.method === "GET"
  ? /^\/v2\/works\/([^/]+)\/editor-manifest$/.exec(url.pathname)
  : null
```

Decode path segments, require exactly one `media_type` query with `etext` or `faksimil`, append `${url.pathname}${url.search}` to the correct ledger, and return the fixture body/status. Add reset/read routes through the existing ledger table. Keep `/api/get_work_info`, `/legacy-api/get_work_info`, and `/count_pages` intact for immutable Angular capture and legacy fixture regression tests; later Nuxt tests must prove they receive no requests.

- [ ] **Step 5: Run the fixture suite GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/v2-server.spec.ts
```

Expected: all fixture-server tests pass, including old authority-only routes.

- [ ] **Step 6: Commit deterministic v2 fixtures**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/test/fixtures/reader-data.mjs \
  nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/unit/v2-server.spec.ts
git commit -m "test: serve typed Reader Editor manifests"
```

### Task 7: Replace the Reader legacy parser with a generated manifest client

**Files:**
- Create: `nuxt/server/utils/work-manifest-client.ts`
- Modify: `nuxt/server/utils/reader-source.ts`
- Modify: `nuxt/test/unit/reader-source.spec.ts`
- Modify: `nuxt/test/unit/reader-final-parity.spec.ts`

**Interfaces:**
- Consumes: Task 5 `ReaderManifestResponse` and generated client; Task 6 fixture bodies; existing asset functions in `reader-source.ts`.
- Produces: `fetchReaderManifest(event: H3Event, authorId: string, titlePath: string, mediaType: ReaderMediaType) -> Promise<ReaderManifestResponse>`, `readerCommonMetadata(manifest: ReaderManifestResponse, base: string) -> ReaderWorkMetadataBase`, and `loadReaderMetadata(event: H3Event, authorId: string, titlePath: string, mediaType: string) -> Promise<ReaderWorkMetadata>` derived only from generated fields. Asset helpers keep their existing public signatures.

- [ ] **Step 1: Rewrite Reader source tests to the generated boundary and observe RED**

Replace raw-envelope normalization tests with typed manifest projections. Keep tests for asset URL encoding, bounded HTML, OCR, preferred image size, and part navigation because Nuxt still owns those concerns.

Add this ownership test:

```typescript
test("loads one typed v2 manifest and never calls legacy metadata", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(readerManifest), {
    headers: { "content-type": "application/json" }
  }))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase: "http://backend.test/v2" }))
  const metadata = await loadReaderMetadata(
    {} as H3Event,
    "SöderbergH",
    "DoktorGlas",
    "etext"
  )
  expect(metadata.workId).toBe("lb-reader-doktor-glas")
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(fetchMock.mock.calls[0][0].url).toBe(
    "http://backend.test/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  )
})
```

Define `readerManifest` immediately above the test as a
`ReaderManifestResponse` `satisfies` value using the complete e-text fixture
from Task 5, so the unit test itself also fails if generated required fields
change.

Add 404/422-to-public-404 mapping, 500 invalid-source mapping, 503 unavailable-source mapping, exact faksimil image number, sparse pages, declared-count slider input, alternate media, flags, contributors, parts, and no `/authors/resolve` follow-up.

- [ ] **Step 2: Run Reader source tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/reader-source.spec.ts test/unit/reader-final-parity.spec.ts
```

Expected: old tests still expect raw normalization/fallback and the new typed fetch function is absent.

- [ ] **Step 3: Implement the generated manifest client and exhaustive errors**

```typescript
export async function fetchReaderManifest(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaType
): Promise<ReaderManifestResponse> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  const result = await client.GET("/works/{author_id}/{title_path}/manifest", {
    params: {
      path: { author_id: authorId, title_path: titlePath },
      query: { media_type: mediaType }
    }
  })
  if (result.data !== undefined) return result.data
  if (result.response.status === 404 || result.response.status === 422) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  if (result.response.status === 503) {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}
```

Catch transport rejection and map it to `Reader source unavailable`; do not catch abort errors as an application failure if the existing request path exposes them.

- [ ] **Step 4: Reduce `reader-source.ts` to generated projection plus assets**

Delete `UnknownRecord`, raw record validators, `fetchReaderMetadata`, `normalizeReaderMetadata`, fallback to `libraryApiBase`, and all legacy field-name parsing. Retain `facsimileImageUrl`, `buildFacsimileSources`, `facsimileSourcePair`, `preferredFacsimileSize`, `resolveReaderPartNavigation`, and `fetchReaderPageHtml`.

Derive metadata without assertions:

```typescript
export async function loadReaderMetadata(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata> {
  if (!isReaderMediaType(mediaType)) readerPageNotFound()
  const manifest = await fetchReaderManifest(event, authorId, titlePath, mediaType)
  const base = useRuntimeConfig(event).readerSourceBase.replace(/\/$/u, "")
  if (manifest.media_type === "faksimil") {
    return {
      ...readerCommonMetadata(manifest, base),
      mediaType: "faksimil",
      pages: manifest.pages,
      sizes: manifest.sizes,
      preferredSize: manifest.preferred_size
    }
  }
  return {
    ...readerCommonMetadata(manifest, base),
    mediaType: "etext",
    pages: manifest.pages
  }
}
```

`readerCommonMetadata` performs only this explicit transport-to-view rename;
it carries nested arrays directly:

```typescript
function readerCommonMetadata(
  manifest: ReaderManifestResponse,
  base: string
): ReaderWorkMetadataBase {
  return {
    alternateMedia: manifest.alternate_media,
    author: manifest.contributors[0]!,
    base,
    contributors: manifest.contributors,
    displayTitle: manifest.display_title,
    editorWorkId: manifest.editor_work_id,
    endPageName: manifest.end_page_name,
    fullTitle: manifest.full_title,
    declaredPageCount: manifest.declared_page_count,
    hasDramawebben: manifest.has_dramawebben,
    hasNyaVagar: manifest.has_nya_vagar,
    imprintYear: manifest.imprint_year,
    isDrama: manifest.is_drama,
    pageStep: manifest.page_step,
    parts: manifest.parts,
    searchable: manifest.searchable,
    startPageName: manifest.start_page_name,
    titlePath: manifest.title_path,
    urn: manifest.urn,
    workId: manifest.work_id
  }
}
```

- [ ] **Step 5: Run Reader unit, type, and lint checks GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/reader-source.spec.ts test/unit/reader-final-parity.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn lint
```

Expected: all commands exit 0; `rg -n 'get_work_info|libraryApiBase' server/utils/reader-source.ts server/utils/work-manifest-client.ts` returns no matches.

- [ ] **Step 6: Commit the typed Reader source boundary**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/server/utils/work-manifest-client.ts \
  nuxt/server/utils/reader-source.ts \
  nuxt/test/unit/reader-source.spec.ts \
  nuxt/test/unit/reader-final-parity.spec.ts
git commit -m "refactor: consume typed Reader manifest"
```

### Task 8: Propagate generated nested types through the canonical Reader

**Files:**
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/shared/utils/reader-author.ts`
- Modify: `nuxt/app/components/reader/ReaderContributors.vue`
- Modify: `nuxt/app/components/reader/ReaderContentsDialog.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Modify: `nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`

**Interfaces:**
- Consumes: Task 7 typed `ReaderWorkMetadata`; Task 5 generated nested aliases.
- Produces: unchanged serialized `ReaderPage` view shape except that contributor, part, and page-map nested values are generated types; canonical and shorthand endpoints make one v2 manifest request and no author-resolution or legacy metadata request.

- [ ] **Step 1: Add RED type assertions for generated nested ownership**

Extend `reader-editor-manifest-contract.ts` so the local view types use generated nested types exactly:

```typescript
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
```

Add an SSR ownership assertion that canonical Reader produces one `/v2/works/.../manifest` ledger entry and no `get_work_info`, `count_pages`, or `/authors/resolve` entry.

- [ ] **Step 2: Run the contract and SSR cases RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt tsc --noEmit --skipLibCheck \
  --moduleResolution bundler --module esnext --target es2022 --strict \
  test/nuxt/reader-editor-manifest-contract.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt playwright test \
  test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts --project=ssr
```

Expected: type equality fails on handwritten nested types and SSR ledgers still observe legacy metadata.

- [ ] **Step 3: Replace handwritten nested Reader models with generated aliases**

In `shared/types/reader.ts`:

```typescript
import type {
  WorkManifestContributor,
  WorkManifestPage,
  WorkManifestPart
} from "./work-manifest"

export type ReaderWorkContributor = WorkManifestContributor
export type ReaderPart = WorkManifestPart
export type ReaderPageIdentity = WorkManifestPage
```

Remove the old interface bodies. Keep `ReaderPartAuthor` only if a local projection still adds a non-null display fallback; otherwise alias the generated part-author schema as well. Change `ReaderAuthorContribution` to a direct generated `ManifestContributionRole` alias and simplify `readerAuthorContributionSuffix` to the four canonical values.

Update field access mechanically and exhaustively:

| Old local field | Generated field |
| --- | --- |
| `id` | `author_id` |
| `name` | `full_name` |
| `authorType` | `author_type` |
| `sourceIndex` | `source_index` |
| `startPageName` / `startPageIndex` | `start_page_name` / `start_page_index` |
| `endPageName` / `endPageIndex` | `end_page_name` / `end_page_index` |
| `navTitle` / `shortTitle` / `titleId` | `nav_title` / `short_title` / `title_id` |
| page-map `pageName` / `pageIndex` | `page_name` / `page_index` |

Templates retain the same text, hrefs, classes, and DOM structure.

- [ ] **Step 4: Remove Nuxt part-author metadata completion**

Delete `validateResolvedAuthors`, `completePartAuthors`, its limits, and the `/authors/resolve` request from the canonical Reader endpoint. Use generated nullable names with the exact fallback at display/projection time:

```typescript
function partAuthorLabel(author: WorkManifestPart["authors"][number]): string {
  return author.surname ?? author.full_name ?? author.author_id
}
```

Part navigation continues to sort by `start_page_index` then `source_index`, and all route hrefs use `start_page_name`.

- [ ] **Step 5: Assemble the unchanged page view from typed metadata**

Keep the final `ReaderPage` camel-case top-level UI projection, but carry generated nested arrays directly:

```typescript
const commonPage = {
  author: metadata.contributors[0]!,
  contributors: metadata.contributors,
  pageMap: metadata.pages.map(page => ({
    page_name: page.page_name,
    page_index: page.page_index
  })),
  parts: metadata.parts,
  pageIndex: currentPage.page_index,
  pageName,
  pageNames: metadata.pages.map(page => page.page_name),
  pageCount: metadata.pages.length,
  sliderMaximum: readerSliderMaximum(metadata.pages, metadata.declaredPageCount)
} satisfies Pick<ReaderPage, "author" | "contributors" | "pageMap" | "parts" |
  "pageIndex" | "pageName" | "pageNames" | "pageCount" | "sliderMaximum">
```

Preserve canonical faksimil `image_number`, e-text HTML indexing by `page_index`, asset paths, SEO copy, `no-store`, and every navigation/slider rule.

- [ ] **Step 6: Update media shorthand and SSR ledgers**

The media shorthand keeps calling `loadReaderMetadata`, which now reaches v2. Preserve `replace: true` for shorthand-to-canonical normalization while canonical page-to-page navigation continues to push. Update SSR expected request URLs to:

```text
/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext
```

For Rallarliv, expect exactly one v2 manifest request and remove the former two-source fallback expectation. Keep the final canonical URL, hit marquee, and asset expectations unchanged.

- [ ] **Step 7: Run Reader contract, unit, SSR, type, and lint checks GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt tsc --noEmit --skipLibCheck \
  --moduleResolution bundler --module esnext --target es2022 --strict \
  test/nuxt/reader-editor-manifest-contract.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt vitest run \
  test/unit/reader-source.spec.ts \
  test/unit/reader-final-parity.spec.ts \
  test/unit/reader-dramawebben-navigation.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt playwright test \
  test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts \
  test/ssr/reader-final-parity.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn --cwd nuxt typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn --cwd nuxt lint
```

Expected: all commands exit 0 and the Reader renders the same visible output.

- [ ] **Step 8: Commit generated Reader propagation**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/shared/types/reader.ts nuxt/shared/utils/reader-author.ts \
  nuxt/app/components/reader/ReaderContributors.vue \
  nuxt/app/components/reader/ReaderContentsDialog.vue \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue' \
  'nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts' \
  'nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts' \
  nuxt/test/nuxt/reader-editor-manifest-contract.ts \
  nuxt/test/ssr/reader.spec.ts nuxt/test/ssr/reader-shorthand.spec.ts \
  nuxt/test/ssr/reader-final-parity.spec.ts \
  nuxt/test/unit/reader-dramawebben-navigation.spec.ts
git commit -m "refactor: propagate generated Reader manifest types"
```

### Task 9: Migrate the Editor to complete and bounds-only manifests

**Files:**
- Modify: `nuxt/server/utils/work-manifest-client.ts`
- Modify: `nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts`
- Modify: `nuxt/shared/types/editor-reader.ts`
- Modify: `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue`
- Create: `nuxt/test/unit/work-manifest-client.spec.ts`
- Modify: `nuxt/test/ssr/editor-reader.spec.ts`
- Modify: `nuxt/test/e2e/editor-reader.behavior.spec.ts`
- Modify: `nuxt/test/e2e/editor-reader.mobile.behavior.spec.ts`

**Interfaces:**
- Consumes: Task 5 `EditorManifestResponse`; Task 8 generated contributor/part types; existing Editor HTML/OCR/image utilities.
- Produces: `fetchEditorManifest(event: H3Event, workId: string, mediaType: ReaderMediaType) -> Promise<EditorManifestResponse>` and the unchanged `EditorReaderPage` UI DTO assembled without raw metadata parsing or `count_pages`.

- [ ] **Step 1: Add RED client tests for both Editor arms and typed failures**

```typescript
test("returns the exact bounds-only Editor arm", async () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" }
  })
  const fetchMock = vi.fn(async () => json({
    status: "page_bounds_only",
    work_id: "lb-editor-fallback",
    media_type: "faksimil",
    bounds: { kind: "dense", page_count: 3 }
  }))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase: "http://backend.test/v2" }))
  const manifest = await fetchEditorManifest(
    {} as H3Event, "lb-editor-fallback", "faksimil"
  )
  expect(manifest.status).toBe("page_bounds_only")
  expect(fetchMock.mock.calls[0][0].url).toBe(
    "http://backend.test/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  )
})
```

Add complete-arm narrowing, 404/422-to-Editor-404 mapping, 503 transport/unavailable mapping to existing Editor 502, and standard 500 invalid source mapping.

- [ ] **Step 2: Add RED SSR ownership and degradation assertions**

Update `editor-reader.spec.ts` to require one typed Editor manifest request, zero legacy metadata/count requests, and `Cache-Control: no-store` on `/api/editor/...`. Preserve every existing complete, fallback, sparse, OCR, e-text, close-target, part, suffix, search-hit, and missing-asset assertion.

For the bounds-only case, assert the exact UI behavior:

```typescript
expect(body.metadataAvailable).toBe(false)
expect(body.pageCount).toBe(3)
expect(body.pageIndexes).toBeNull()
expect(document.querySelector(".editor-metadata-controls")).toBeNull()
expect(document.querySelector('a[rel="next"]')).not.toBeNull()
```

- [ ] **Step 3: Run Editor unit/SSR tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/work-manifest-client.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test test/ssr/editor-reader.spec.ts --project=ssr
```

Expected: the client function is missing and SSR still calls raw metadata/count routes.

- [ ] **Step 4: Implement the generated Editor client**

```typescript
export async function fetchEditorManifest(
  event: H3Event,
  workId: string,
  mediaType: ReaderMediaType
): Promise<EditorManifestResponse> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  const result = await client.GET("/works/{work_id}/editor-manifest", {
    params: {
      path: { work_id: workId },
      query: { media_type: mediaType }
    }
  })
  if (result.data !== undefined) return result.data
  if (result.response.status === 404 || result.response.status === 422) {
    throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  }
  throw createError({ statusCode: 502, statusMessage: "Editor source unavailable" })
}
```

Catch transport rejection as 502 and never inspect an unchecked response body.

- [ ] **Step 5: Replace Editor raw parsing with exhaustive manifest projection**

Delete `record`, raw contributor/page/part parsers, metadata-size JSON fetch, `safePageCount`, wrong-media fallback, and legacy `count_pages` request. Set `Cache-Control: no-store` first.

Derive bounds exactly:

```typescript
const manifest = await fetchEditorManifest(event, workId, mediaType)
const indexes = manifest.bounds.kind === "sparse"
  ? manifest.bounds.page_indexes
  : null
const pageCount = manifest.bounds.kind === "dense"
  ? manifest.bounds.page_count
  : manifest.bounds.page_indexes.at(-1)! + 1
const sparsePosition = indexes?.indexOf(pageIndex) ?? -1
if (pageIndex >= pageCount || (indexes !== null && sparsePosition < 0)) {
  throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
}
const metadataAvailable = manifest.status === "complete"
```

For sparse bounds, previous/next come from adjacent indexes; for dense bounds, they remain `pageIndex ± 1` within bounds. For complete metadata carry generated contributors and parts directly, derive part context with snake-case fields, and build the close href only from the structured nullable target. For bounds-only return empty contributors/parts and null metadata fields.

Keep Editor asset identity unchanged: e-text `res_{pageIndex padded 5}.html`, facsimile `{pageIndex + 1 padded 4}.jpeg`. Always include size 3; add generated positive-width sizes without duplicates. Keep OCR optional and sanitized.

- [ ] **Step 6: Update Editor view typing and template field access**

`EditorReaderPage.contributors` and `.parts` use the generated aliases already adopted by Reader. Update Editor page references to contributor/part snake-case fields without changing markup. The top-level view fields remain camel-case because they are Nuxt-created page state.

- [ ] **Step 7: Run Editor unit, SSR, browser, type, and lint checks GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn vitest run test/unit/work-manifest-client.spec.ts \
  test/unit/editor-reader-html.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test test/ssr/editor-reader.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test \
  test/e2e/editor-reader.behavior.spec.ts \
  test/e2e/editor-reader.mobile.behavior.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn lint
```

Expected: all commands exit 0; complete and bounds-only Editor pages retain exact visible behavior.

- [ ] **Step 8: Commit the Editor migration**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/server/utils/work-manifest-client.ts \
  'nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts' \
  nuxt/shared/types/editor-reader.ts \
  'nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue' \
  nuxt/test/unit/work-manifest-client.spec.ts \
  nuxt/test/ssr/editor-reader.spec.ts \
  nuxt/test/e2e/editor-reader.behavior.spec.ts \
  nuxt/test/e2e/editor-reader.mobile.behavior.spec.ts
git commit -m "refactor: consume typed Editor manifests"
```

### Task 10: Enforce zero legacy metadata traffic across Reader parity tests

**Files:**
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`
- Modify: `nuxt/test/ssr/reader-final-parity.spec.ts`
- Modify: `nuxt/test/ssr/editor-reader.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/test/e2e/reader-production.behavior.spec.ts`
- Modify: `nuxt/test/e2e/reader-final-parity.behavior.spec.ts`
- Modify: `nuxt/test/e2e/reader-faksimil.visual.spec.ts`
- Modify: `nuxt/test/e2e/reader-hit.visual.spec.ts`
- Modify: `nuxt/test/e2e/reader-contents.visual.spec.ts`

**Interfaces:**
- Consumes: Tasks 6–9 new request ledgers and unchanged browser behavior.
- Produces: executable proof that every Nuxt Reader/Editor path uses v2 manifests and every existing navigation/search/OCR/visual scenario remains intact.

- [ ] **Step 1: Inventory only Nuxt tests that still expect legacy metadata**

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
rg -n 'get_work_info|count_pages|reader_metadata_requests|legacy-api/get_work_info' \
  nuxt/test/ssr nuxt/test/e2e nuxt/test/unit
```

Classify every match. Keep matches in `nuxt/test/visual/capture-*-angular.spec.ts` and fixture legacy-route tests because they own the old visual authority. Every Nuxt runtime expectation must migrate.

- [ ] **Step 2: Replace Nuxt request expectations with v2 ledger assertions**

Reset and read both manifest ledgers in shared test helpers. For a canonical Reader navigation sequence, require one manifest request per distinct route page model and preserve asset counts:

```typescript
expect(await readerManifestRequests(request)).toEqual([
  "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
])
expect(await legacyReaderMetadataRequests(request)).toEqual([])
expect(await editorManifestRequests(request)).toEqual([])
```

For Editor cases require only the Editor ledger. For query-only focus/dialog changes, preserve the existing no-refetch expectation. For page navigation, preserve debounce/stale-response counts and Back/Forward history.

- [ ] **Step 3: Preserve all interaction and visual assertions while changing only metadata ownership**

Do not alter expected DOM, coordinates, screenshots, threshold, or request firewall. Keep explicit cases for:

- reader page push and Back/Forward restoration;
- horizontal scroll after next/previous;
- sidebar remaining mounted without a loading blink;
- debounced page-slider flipping;
- slider nearest-handle line click;
- faksimil OCR and double-click dictionary affordance;
- work-search hit marquee;
- parts, alternate media, contents and source-info dialogs;
- Editor complete, sparse, bounds-only, and raw-index assets; and
- Rallarliv and Boye production identities.

- [ ] **Step 4: Run the complete focused Reader/Editor SSR and browser matrix**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test \
  test/ssr/reader.spec.ts \
  test/ssr/reader-shorthand.spec.ts \
  test/ssr/reader-final-parity.spec.ts \
  test/ssr/editor-reader.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test \
  test/e2e/reader.behavior.spec.ts \
  test/e2e/reader-production.behavior.spec.ts \
  test/e2e/reader-final-parity.behavior.spec.ts \
  test/e2e/editor-reader.behavior.spec.ts \
  test/e2e/editor-reader.mobile.behavior.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn playwright test \
  test/e2e/reader-faksimil.visual.spec.ts \
  test/e2e/reader-hit.visual.spec.ts \
  test/e2e/reader-contents.visual.spec.ts \
  test/e2e/editor-reader.visual.spec.ts
```

Expected: every test passes and visual diffs remain within the existing immutable thresholds.

- [ ] **Step 5: Prove no Nuxt runtime legacy expectation remains**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
rg -n 'get_work_info|count_pages|legacy-api/get_work_info' \
  nuxt/app nuxt/server nuxt/shared
```

Expected: no production match. Test matches are restricted to fixture compatibility and Angular authority capture.

- [ ] **Step 6: Commit parity-ledger migration**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/test/ssr nuxt/test/e2e
git commit -m "test: enforce v2 Reader Editor metadata ownership"
```

Before committing, inspect `git diff --cached --name-only` and unstage any unrelated SSR/E2E file accidentally included by the broad pathspec.

### Task 11: Add the focused quality gate, policy, and architecture documentation

**Files:**
- Modify: `tasks.py`
- Modify: `test/test_tasks.py`
- Modify: `nuxt/scripts/verify-architecture-policy.mjs`
- Modify: `nuxt/test/unit/architecture-policy.spec.ts`
- Modify: `nuxt/README.md`
- Modify: `docs/quality.md`

**Interfaces:**
- Consumes: every earlier task and existing quality collections.
- Produces: `invoke quality.reader-editor`, manifest contract inclusion in `quality.contract`, enforced production ban on legacy metadata endpoints, and documented schema-change workflow.

- [ ] **Step 1: Write RED task-orchestration tests**

Require `quality.reader-editor` in the public task list and assert its dry-run order includes:

```text
pytest -q test_lbapi/v2/test_work_manifest_models.py test_lbapi/v2/test_work_manifest_provider.py test_lbapi/v2/test_work_manifest_api.py
scripts/export_v2_openapi.py --check
yarn api:check
test/nuxt/reader-editor-manifest-contract.ts
yarn typecheck
yarn lint
yarn vitest run test/unit/work-manifest-client.spec.ts test/unit/reader-source.spec.ts test/unit/editor-reader-html.spec.ts
yarn playwright test test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts test/ssr/editor-reader.spec.ts --project=ssr
```

Also require `quality.contract` to compile `reader-editor-manifest-contract.ts`.
Require its focused backend pytest invocation to include
`test_work_manifest_provider.py` and `test_work_manifest_api.py` beside the
existing Library contract tests.

- [ ] **Step 2: Write RED architecture-policy cases**

Add fixtures proving production code containing either forbidden path fails:

```typescript
test.each([
  ["server/utils/unsafe.ts", 'fetch("/api/get_work_info")'],
  ["server/utils/unsafe.ts", 'fetch("/count_pages/lb1/etext")']
])("rejects legacy Reader metadata ownership in %s", (path, source) => {
  const root = createTree()
  writeSource(root, path, source)
  const result = runVerifier(root)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("legacy Reader/Editor metadata endpoints are forbidden")
})
```

Generated files, fixture server, tests, and immutable Angular capture are outside the production scan; no broad source-directory exclusion is added.

- [ ] **Step 3: Run task and policy tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
python -m unittest -q test.test_tasks
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt vitest run test/unit/architecture-policy.spec.ts
```

Expected: failures report the absent quality task, absent contract entry, and absent policy rule.

- [ ] **Step 4: Implement `quality.reader-editor`**

```python
@task(name="reader-editor")
def quality_reader_editor(context: Context) -> None:
    """Run the focused typed Reader and Editor contract and parity gates."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    environment = _nuxt_node_environment(settings)
    _run(context, [
        python, "-m", "pytest", "-q",
        "test_lbapi/v2/test_work_manifest_models.py",
        "test_lbapi/v2/test_work_manifest_provider.py",
        "test_lbapi/v2/test_work_manifest_api.py",
    ], settings.backend_dir)
    codegen_check.body(context)
    _check_nuxt_contract(
        context, settings, "test/nuxt/reader-editor-manifest-contract.ts"
    )
    for command in (
        ["yarn", "typecheck"],
        ["yarn", "lint"],
        ["yarn", "vitest", "run",
         "test/unit/work-manifest-client.spec.ts",
         "test/unit/reader-source.spec.ts",
         "test/unit/editor-reader-html.spec.ts"],
        ["yarn", "playwright", "test",
         "test/ssr/reader.spec.ts",
         "test/ssr/reader-shorthand.spec.ts",
         "test/ssr/editor-reader.spec.ts", "--project=ssr"],
    ):
        _run(context, command, settings.nuxt_dir, env=environment)
```

Add the task to the `quality` collection and add the compile contract to `quality_contract`.
Extend the existing `quality_contract` backend pytest path list with
`test_lbapi/v2/test_work_manifest_provider.py` and
`test_lbapi/v2/test_work_manifest_api.py` so contract drift cannot bypass the
normal cross-repository contract gate.

- [ ] **Step 5: Implement the production ownership policy**

In the architecture verifier's production AST/string visitor, report the exact diagnostic when a string literal contains `/api/get_work_info`, `/get_work_info`, or `/count_pages/`. Scan `app`, `server`, and `shared`; do not scan generated output. Use the existing sorted violation collector so diagnostics remain deterministic.

- [ ] **Step 6: Document the schema-change workflow and test ownership**

Add this concise workflow to `docs/quality.md` and link it from `nuxt/README.md`:

```text
Reader/Editor metadata changes start in lbapi/v2/work_manifest_models.py and
work_manifest_provider.py. Run backend focused tests, export openapi/v2.json,
run invoke codegen.generate, then consume only generated aliases in Nuxt.
invoke quality.reader-editor is the focused gate; invoke quality.release is
the completion gate. HTML/OCR/images remain separately validated assets.
```

Document the layer matrix: Pydantic owns bounds/discrimination; provider tests own normalization; API tests own statuses; compile contract owns generated equality; Nuxt unit/SSR owns projections; Playwright owns observable parity; visual authority remains `06add2bb`.

- [ ] **Step 7: Run the focused public gate GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
python -m unittest -q test.test_tasks
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  yarn --cwd nuxt vitest run test/unit/architecture-policy.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.reader-editor
```

Expected: every command exits 0.

- [ ] **Step 8: Commit policy, gate, and documentation**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add tasks.py test/test_tasks.py \
  nuxt/scripts/verify-architecture-policy.mjs \
  nuxt/test/unit/architecture-policy.spec.ts \
  nuxt/README.md docs/quality.md
git commit -m "chore: gate Reader Editor contract quality"
```

### Task 12: Complete independent review and full release verification

**Files:**
- Modify only files required by evidenced review or verification failures.

**Interfaces:**
- Consumes: all previous tasks; immutable visual authority `06add2bb`.
- Produces: requirement-by-requirement evidence for the complete active quality goal, clean whole-branch reviews, and green full release gates in both repositories.

- [ ] **Step 1: Run the focused gate from a clean task boundary**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.reader-editor
git diff --check
cd /Users/johan/dev/lb-backend
git diff --check
```

Expected: focused gate exits 0 and both diff checks are silent.

- [ ] **Step 2: Request two-stage reviews**

Use `superpowers:requesting-code-review` after implementation. First request a specification-compliance review against:

```text
docs/superpowers/specs/2026-07-28-reader-editor-v2-manifest-contract-design.md
docs/superpowers/plans/2026-07-28-reader-editor-v2-manifests.md
```

Then request a code-quality review focused on type ownership, runtime trust boundaries, provider failure semantics, sparse page behavior, request ledgers, and accidental visual changes. Fix every Critical or Important finding in its owning task-sized commit and rerun affected gates.

- [ ] **Step 3: Run complete backend release evidence**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
virtual_env/bin/python -m pytest -q
virtual_env/bin/python scripts/export_v2_openapi.py --check
```

Expected: all backend tests pass, both static checks are clean, and snapshot drift is absent.

- [ ] **Step 4: Run the complete frontend release gate**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.release
```

Expected: policy, lint, typecheck, all unit/SSR/E2E tests, production build, contract checks, and visual comparisons pass.

- [ ] **Step 5: Audit immutable visuals and metadata ownership directly**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git diff --quiet 06add2bb..HEAD -- nuxt/test/visual/baselines
git diff --quiet -- nuxt/test/visual/baselines
rg -n 'get_work_info|count_pages|legacy-api/get_work_info' \
  nuxt/app nuxt/server nuxt/shared
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke codegen.check
```

Expected: both visual commands exit 0, production legacy search has no match, and both snapshot/client checks pass.

- [ ] **Step 6: Perform the active-goal completion audit**

Create a requirement table in the final handoff with direct evidence for:

| Requirement | Required evidence |
| --- | --- |
| Explicit complete FastAPI/Pydantic Reader and Editor contracts | model/provider/API tests and OpenAPI snapshot |
| Reproducible generated TypeScript | snapshot-first `codegen.generate`, `codegen.check`, generated compile contract |
| Generated types across frontend paths | exact type equalities, no duplicate nested transport interfaces, strict typecheck |
| No broad unsafe transport trust | policy/lint searches and generated-client calls |
| Zero Nuxt lint baseline | `yarn lint --max-warnings 0` within release gate |
| Contract drift gates | backend snapshot and frontend generated checks |
| Useful focused tests | layer-owned model/provider/API/unit/SSR/E2E evidence |
| Exact feature and visual parity | full Playwright and immutable visual gate |
| Documented architecture | committed design, plan, `docs/quality.md`, and `nuxt/README.md` |
| Zero legacy Reader/Editor metadata dependency | production policy plus runtime request ledgers |

If any evidence is missing or indirect, keep the goal active and repair the gap. Only after every row is proven should the active goal be marked complete.
