# Nuxt v2 Statistics Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an independent Nuxt 4 hybrid/SSR application that reproduces `/om/statistik` exactly, backed by three typed FastAPI v2 resources and a reproducible generated TypeScript client.

**Architecture:** Mount an isolated FastAPI sub-application at `/v2`, adapt the existing OpenSearch/count functions into strict v2 DTOs, commit a deterministic OpenAPI snapshot, and generate `openapi-typescript` paths for a standalone `nuxt/` application. The Nuxt page owns its one-page data loading in `<script setup>`, uses a tiny shared generated-client factory, and copies the current shell/styles/assets into Nuxt ownership without importing AngularJS.

**Tech Stack:** Python 3.13, FastAPI 0.119, Pydantic 2.12, pytest 8; Nuxt 4.4, Vue 3, TypeScript 5.9, Tailwind CSS 3.4, Sass, `openapi-typescript` 7, `openapi-fetch`, Vitest, and Playwright.

## Global Constraints

- The approved design is [`docs/superpowers/specs/2026-07-15-nuxt-v2-statistics-foundation-design.md`](/Users/johan/.codex/worktrees/8c5c/littb/docs/superpowers/specs/2026-07-15-nuxt-v2-statistics-foundation-design.md). If this plan and the design appear to differ, stop and resolve the discrepancy before coding.
- `/Users/johan/.codex/worktrees/8c5c/littb/app/` is a frozen behavioral and visual reference. Do not modify AngularJS source, templates, tests, styles, assets, dependencies, or build configuration in this slice.
- `/Users/johan/dev/lb-backend` contains unrelated tracked and untracked user work on `master`; leave that checkout untouched. Backend implementation happens in the isolated `/Users/johan/.codex/worktrees/8c5c/lb-backend` worktree on `codex/nuxt-v2-statistics`. Every backend commit command below names every file explicitly.
- The Nuxt application is standalone under `nuxt/`, with its own `package.json` and `yarn.lock`. It must not import from `../app`, depend on Angular packages, or run Angular at build/runtime.
- Keep page-only data/model logic in `nuxt/app/pages/om/statistik.vue`. Do not add a statistics composable, store, repository, adapter, or one-use presentational component.
- Do not add `@headlessui/vue` yet: this page has no dropdown, disclosure, popover, listbox, or modal. Add it at the first real interactive consumer in a later slice and style it to the existing UI.
- Tailwind UI is a future markup/pattern source, not a license to restyle. Pin Tailwind 3.4.18 for parity and do not upgrade to Tailwind 4 in this slice.
- Production Caddy/Nomad/routing, a local Angular/Nuxt gateway, authentication, and all non-statistics Nuxt routes are out of scope.
- Follow red-green-refactor inside every task. Observe the stated failure before adding implementation. Run the focused test again after the minimal implementation, then run the task regression command.
- Generated files (`openapi/v2.json`, `nuxt/app/lib/api/generated/lbapi.ts`, and screenshot PNGs) are changed only by their documented generators/capture commands and are committed for review.
- Do not weaken a test, update a screenshot, or broaden an error envelope merely to make a check pass. Diagnose the mismatch against the approved contract or Angular baseline.

---

## Task 1: Define the strict FastAPI v2 contract models

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/__init__.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/__init__.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`

**Interfaces:** `MediaCounts`, `StatsResponse`, `AuthorSummary`, `WorkRepresentation`, `PopularWork`, `PopularWorksResponse`, `PopularEpub`, `PopularEpubsResponse`, `ErrorDetail`, `ApiError`, and `ApiErrorResponse` are the public schema names. Nullable fields remain required and serialize as `null`; arbitrary OpenSearch fields are forbidden.

- [ ] **Step 1: Write the failing model-contract tests.**

Create empty package markers and add this complete test file:

```python
# test_lbapi/v2/test_models.py
import pytest
from pydantic import ValidationError

from lbapi.v2.models import (
    ApiError,
    ApiErrorResponse,
    AuthorSummary,
    ErrorDetail,
    MediaCounts,
    PopularEpub,
    PopularEpubsResponse,
    PopularWork,
    PopularWorksResponse,
    StatsResponse,
    WorkRepresentation,
)


def test_all_contracts_serialize_with_required_nullable_fields() -> None:
    author = AuthorSummary(author_id="LagerlofS", full_name="Selma Lagerlöf", surname=None)
    representation = WorkRepresentation(
        work_id="lb123",
        media_type="etext",
        start_page_name=None,
    )
    work = PopularWork(
        title_id="GostaBerlingsSaga",
        title_path="GostaBerlingsSaga",
        title="Gösta Berlings saga",
        short_title=None,
        author=author,
        representation=representation,
    )
    epub = PopularEpub(
        title_id="GostaBerlingsSaga",
        title="Gösta Berlings saga",
        short_title=None,
        author=author,
    )

    assert StatsResponse(
        works=1,
        authors=2,
        pages=MediaCounts(etext=3, faksimil=4),
        words=MediaCounts(etext=5, faksimil=6),
        epubs=7,
    ).model_dump() == {
        "works": 1,
        "authors": 2,
        "pages": {"etext": 3, "faksimil": 4},
        "words": {"etext": 5, "faksimil": 6},
        "epubs": 7,
    }
    assert PopularWorksResponse(items=[work]).model_dump()["items"][0]["short_title"] is None
    assert PopularEpubsResponse(items=[epub]).model_dump()["items"][0]["author"]["surname"] is None
    assert ApiErrorResponse(
        error=ApiError(
            code="validation_error",
            message="Request validation failed",
            details=[ErrorDetail(field=None, message="Invalid request")],
        )
    ).model_dump() == {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "details": [{"field": None, "message": "Invalid request"}],
        }
    }


@pytest.mark.parametrize("field", ["works", "authors", "epubs"])
def test_top_level_counts_reject_negative_values(field: str) -> None:
    values = {
        "works": 1,
        "authors": 2,
        "pages": {"etext": 3, "faksimil": 4},
        "words": {"etext": 5, "faksimil": 6},
        "epubs": 7,
    }
    values[field] = -1
    with pytest.raises(ValidationError):
        StatsResponse.model_validate(values)


def test_nested_counts_reject_negative_values() -> None:
    with pytest.raises(ValidationError):
        MediaCounts(etext=-1, faksimil=0)


def test_representation_rejects_unknown_media_type() -> None:
    with pytest.raises(ValidationError):
        WorkRepresentation.model_validate(
            {"work_id": "lb123", "media_type": "audio", "start_page_name": None}
        )


def test_required_nullable_fields_cannot_be_omitted() -> None:
    with pytest.raises(ValidationError):
        AuthorSummary(author_id="LagerlofS", full_name="Selma Lagerlöf")
    with pytest.raises(ValidationError):
        WorkRepresentation(work_id="lb123", media_type="etext")


def test_contracts_forbid_raw_backend_fields() -> None:
    with pytest.raises(ValidationError):
        AuthorSummary.model_validate(
            {
                "author_id": "LagerlofS",
                "full_name": "Selma Lagerlöf",
                "surname": "Lagerlöf",
                "popularity": 999,
            }
        )
```

- [ ] **Step 2: Run the focused test and confirm the expected red state.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_models.py
```

Expected: collection fails with `ModuleNotFoundError: No module named 'lbapi.v2.models'`.

- [ ] **Step 3: Add the minimal strict Pydantic models.**

```python
# lbapi/v2/models.py
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class V2Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MediaCounts(V2Model):
    etext: int = Field(ge=0)
    faksimil: int = Field(ge=0)


class StatsResponse(V2Model):
    works: int = Field(ge=0)
    authors: int = Field(ge=0)
    pages: MediaCounts
    words: MediaCounts
    epubs: int = Field(ge=0)


class AuthorSummary(V2Model):
    author_id: str
    full_name: str
    surname: str | None


class WorkRepresentation(V2Model):
    work_id: str
    media_type: Literal["etext", "faksimil", "pdf"]
    start_page_name: str | None


class PopularWork(V2Model):
    title_id: str
    title_path: str
    title: str
    short_title: str | None
    author: AuthorSummary
    representation: WorkRepresentation


class PopularWorksResponse(V2Model):
    items: list[PopularWork]


class PopularEpub(V2Model):
    title_id: str
    title: str
    short_title: str | None
    author: AuthorSummary


class PopularEpubsResponse(V2Model):
    items: list[PopularEpub]


class ErrorDetail(V2Model):
    field: str | None
    message: str


class ApiError(V2Model):
    code: str
    message: str
    details: list[ErrorDetail] | None


class ApiErrorResponse(V2Model):
    error: ApiError
```

- [ ] **Step 4: Run the model tests green and inspect the diff.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_models.py
git diff --check -- lbapi/v2 test_lbapi/v2
```

Expected: `8 passed`; `git diff --check` is silent.

- [ ] **Step 5: Commit only the Task 1 backend files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
git add lbapi/v2/__init__.py lbapi/v2/models.py test_lbapi/v2/__init__.py test_lbapi/v2/test_models.py
git commit -m "feat(api): define v2 statistics contracts"
```

## Task 2: Adapt the existing count and popularity queries into v2 DTOs

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/stats.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_stats.py`

**Interfaces:** `load_stats() -> StatsResponse`, `query_popular_work_documents() -> list[dict]`, `transform_popular_works(documents, limit) -> PopularWorksResponse`, `query_popular_epub_documents(limit) -> list[dict]`, and `transform_popular_epubs(documents) -> PopularEpubsResponse`.

- [ ] **Step 1: Write failing adapter tests with an injected legacy API seam.**

Create `test_lbapi/v2/test_stats.py` with fakes that expose `count_distincts_works`, `count_authors`, `get_page_count`, `get_word_count`, `count_epub`, and `query`. Cover these exact cases:

```python
# test_lbapi/v2/test_stats.py
from types import SimpleNamespace

import pytest

from lbapi.v2 import stats


class FakeHit:
    def __init__(self, document: dict) -> None:
        self.document = document

    def to_dict(self) -> dict:
        return dict(self.document)


class FakeApi:
    def __init__(self, documents: list[dict] | None = None) -> None:
        self.documents = documents or []
        self.calls: list[tuple] = []
        self.query_kwargs: dict | None = None

    def count_distincts_works(self) -> int:
        self.calls.append(("count_distincts_works",))
        return 11

    def count_authors(self) -> int:
        self.calls.append(("count_authors",))
        return 12

    def get_page_count(self, media_type: str) -> int:
        self.calls.append(("get_page_count", media_type))
        return {"etext": 13, "faksimil": 14}[media_type]

    def get_word_count(self, media_type: str) -> int:
        self.calls.append(("get_word_count", media_type))
        return {"etext": 15, "faksimil": 16}[media_type]

    def count_epub(self) -> int:
        self.calls.append(("count_epub",))
        return 17

    def query(self, **kwargs):
        self.query_kwargs = kwargs
        return SimpleNamespace(hits=[FakeHit(document) for document in self.documents])


def author(author_id: str, surname: str | None = None) -> dict:
    return {
        "authorid": author_id,
        "full_name": f"Full {author_id}",
        "surname": surname,
    }


def work(media_type: str, **overrides) -> dict:
    document = {
        "lbworkid": "lb1",
        "titlepath": "WorkOne",
        "title": "Work One",
        "shorttitle": None,
        "titleid": "fallback-id",
        "work_titleid": "preferred-id",
        "mediatype": media_type,
        "startpagename": "1",
        "main_author": author("Main", "Main"),
        "authors": [author("Nested", "Nested")],
        "work_authors": [author("Work", "Work")],
        "raw_field": "must not escape",
    }
    document.update(overrides)
    return document


def test_load_stats_wraps_the_existing_count_functions(monkeypatch) -> None:
    api = FakeApi()
    monkeypatch.setattr(stats, "_legacy_api", lambda: api)

    result = stats.load_stats()

    assert result.model_dump() == {
        "works": 11,
        "authors": 12,
        "pages": {"etext": 13, "faksimil": 14},
        "words": {"etext": 15, "faksimil": 16},
        "epubs": 17,
    }
    assert api.calls == [
        ("count_distincts_works",),
        ("count_authors",),
        ("get_page_count", "etext"),
        ("get_page_count", "faksimil"),
        ("get_word_count", "etext"),
        ("get_word_count", "faksimil"),
        ("count_epub",),
    ]


def test_popular_work_query_fetches_100_visible_documents(monkeypatch) -> None:
    api = FakeApi([work("etext")])
    monkeypatch.setattr(stats, "_legacy_api", lambda: api)

    assert stats.query_popular_work_documents() == [work("etext")]
    assert api.query_kwargs == {
        "search_dict": {"query": {"query_string": {"query": "show:true AND *"}}},
        "doc_type": "etext,faksimil,pdf",
        "from_hit": 0,
        "to_hit": 100,
        "includes": stats.POPULAR_WORK_FIELDS,
        "excludes": (),
        "sort_field": [{"popularity": {"order": "desc"}}],
    }


def test_popular_works_group_before_slicing_and_prefer_etext() -> None:
    first_faksimil = work("faksimil", startpagename="f1")
    second_group = work(
        "pdf",
        lbworkid="lb2",
        titlepath="WorkTwo",
        title="Work Two",
        work_titleid=None,
        titleid="fallback-two",
        main_author=None,
        authors=[author("NestedTwo", None)],
    )
    first_etext = work("etext", startpagename="e1")

    result = stats.transform_popular_works(
        [first_faksimil, second_group, first_etext],
        limit=2,
    )

    assert result.model_dump() == {
        "items": [
            {
                "title_id": "preferred-id",
                "title_path": "WorkOne",
                "title": "Work One",
                "short_title": None,
                "author": {
                    "author_id": "Main",
                    "full_name": "Full Main",
                    "surname": "Main",
                },
                "representation": {
                    "work_id": "lb1",
                    "media_type": "etext",
                    "start_page_name": "e1",
                },
            },
            {
                "title_id": "fallback-two",
                "title_path": "WorkTwo",
                "title": "Work Two",
                "short_title": None,
                "author": {
                    "author_id": "NestedTwo",
                    "full_name": "Full NestedTwo",
                    "surname": None,
                },
                "representation": {
                    "work_id": "lb2",
                    "media_type": "pdf",
                    "start_page_name": "1",
                },
            },
        ]
    }


def test_popular_epub_query_and_mapping_preserve_backend_order(monkeypatch) -> None:
    documents = [
        {
            "title": "First",
            "shorttitle": "First short",
            "work_titleid": "first",
            "titleid": "ignored",
            "authors": [author("AuthorOne", "One")],
            "raw_field": True,
        },
        {
            "title": "Second",
            "shorttitle": None,
            "work_titleid": None,
            "titleid": "second-fallback",
            "authors": [author("AuthorTwo", None)],
        },
    ]
    api = FakeApi(documents)
    monkeypatch.setattr(stats, "_legacy_api", lambda: api)

    raw = stats.query_popular_epub_documents(limit=2)
    result = stats.transform_popular_epubs(raw)

    assert api.query_kwargs == {
        "search_dict": {
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"has_epub": True}},
                        {"term": {"show": True}},
                    ]
                }
            }
        },
        "doc_type": "etext",
        "from_hit": 0,
        "to_hit": 2,
        "includes": stats.POPULAR_EPUB_FIELDS,
        "excludes": (),
        "sort_field": [{"epub_popularity": {"order": "desc"}}],
    }
    assert [item.title_id for item in result.items] == ["first", "second-fallback"]
    assert result.model_dump()["items"][0].keys() == {
        "title_id",
        "title",
        "short_title",
        "author",
    }
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the adapter module is absent.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_stats.py
```

Expected: import/attribute failures for `lbapi.v2.stats`.

- [ ] **Step 3: Implement the lazy legacy seam, exact queries, grouping, and DTO mapping.**

```python
# lbapi/v2/stats.py
from typing import Any

from lbapi.v2.models import (
    AuthorSummary,
    MediaCounts,
    PopularEpub,
    PopularEpubsResponse,
    PopularWork,
    PopularWorksResponse,
    StatsResponse,
    WorkRepresentation,
)

POPULAR_WORK_FETCH_SIZE = 100
REPRESENTATION_RANK = {"etext": 0, "faksimil": 1, "pdf": 2}

POPULAR_WORK_FIELDS = (
    "lbworkid",
    "titlepath",
    "title",
    "titleid",
    "work_titleid",
    "shorttitle",
    "mediatype",
    "startpagename",
    "main_author.authorid",
    "main_author.full_name",
    "main_author.surname",
    "authors.authorid",
    "authors.full_name",
    "authors.surname",
    "work_authors.authorid",
    "work_authors.full_name",
    "work_authors.surname",
)

POPULAR_EPUB_FIELDS = (
    "title",
    "titleid",
    "work_titleid",
    "shorttitle",
    "authors.authorid",
    "authors.full_name",
    "authors.surname",
)


def _legacy_api():
    from lbapi import elasticapi

    return elasticapi


def _documents(response: Any) -> list[dict]:
    return [hit.to_dict() for hit in response.hits]


def _title_id(document: dict) -> str:
    return document.get("work_titleid") or document["titleid"]


def _author(document: dict, fields: tuple[str, ...]) -> AuthorSummary:
    for field in fields:
        value = document.get(field)
        candidate = value[0] if isinstance(value, list) and value else value
        if isinstance(candidate, dict) and candidate.get("authorid") and candidate.get("full_name"):
            return AuthorSummary(
                author_id=candidate["authorid"],
                full_name=candidate["full_name"],
                surname=candidate.get("surname"),
            )
    raise ValueError("Popular item has no usable author")


def load_stats() -> StatsResponse:
    api = _legacy_api()
    return StatsResponse(
        works=api.count_distincts_works(),
        authors=api.count_authors(),
        pages=MediaCounts(
            etext=api.get_page_count("etext"),
            faksimil=api.get_page_count("faksimil"),
        ),
        words=MediaCounts(
            etext=api.get_word_count("etext"),
            faksimil=api.get_word_count("faksimil"),
        ),
        epubs=api.count_epub(),
    )


def query_popular_work_documents() -> list[dict]:
    response = _legacy_api().query(
        search_dict={"query": {"query_string": {"query": "show:true AND *"}}},
        doc_type="etext,faksimil,pdf",
        from_hit=0,
        to_hit=POPULAR_WORK_FETCH_SIZE,
        includes=POPULAR_WORK_FIELDS,
        excludes=(),
        sort_field=[{"popularity": {"order": "desc"}}],
    )
    return _documents(response)


def _popular_work_from_document(document: dict) -> PopularWork:
    return PopularWork(
        title_id=_title_id(document),
        title_path=document["titlepath"],
        title=document["title"],
        short_title=document.get("shorttitle"),
        author=_author(document, ("main_author", "authors", "work_authors")),
        representation=WorkRepresentation(
            work_id=document["lbworkid"],
            media_type=document["mediatype"],
            start_page_name=document.get("startpagename"),
        ),
    )


def transform_popular_works(documents: list[dict], limit: int) -> PopularWorksResponse:
    groups: dict[tuple[str, str], list[dict]] = {}
    for document in documents:
        key = (document["titlepath"], document["lbworkid"])
        groups.setdefault(key, []).append(document)

    items = []
    for group in list(groups.values())[:limit]:
        selected = min(group, key=lambda item: REPRESENTATION_RANK[item["mediatype"]])
        items.append(_popular_work_from_document(selected))
    return PopularWorksResponse(items=items)


def query_popular_epub_documents(limit: int) -> list[dict]:
    response = _legacy_api().query(
        search_dict={
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"has_epub": True}},
                        {"term": {"show": True}},
                    ]
                }
            }
        },
        doc_type="etext",
        from_hit=0,
        to_hit=limit,
        includes=POPULAR_EPUB_FIELDS,
        excludes=(),
        sort_field=[{"epub_popularity": {"order": "desc"}}],
    )
    return _documents(response)


def transform_popular_epubs(documents: list[dict]) -> PopularEpubsResponse:
    return PopularEpubsResponse(
        items=[
            PopularEpub(
                title_id=_title_id(document),
                title=document["title"],
                short_title=document.get("shorttitle"),
                author=_author(document, ("authors",)),
            )
            for document in documents
        ]
    )
```

Do not call `elasticapi.get_toplist()` or `get_toplist_epub()`: those query traffic-log indices, use stale index aliases, and do not reproduce the current Angular statistics-page semantics.

- [ ] **Step 4: Run adapter tests green and the model regression.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_stats.py test_lbapi/v2/test_models.py
git diff --check -- lbapi/v2/stats.py test_lbapi/v2/test_stats.py
```

Expected: `12 passed`; diff check is silent.

- [ ] **Step 5: Commit only the Task 2 backend files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
git add lbapi/v2/stats.py test_lbapi/v2/test_stats.py
git commit -m "feat(api): adapt statistics data for v2"
```

## Task 3: Expose the three v2 routes with one documented error envelope

**Files:**

- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/stats.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/app.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`

**Interfaces:** A standalone `v2_app` exposes schema-relative `GET /stats`, `GET /works/popular`, and `GET /epubs/popular`. Once mounted, their external URLs are `/v2/stats`, `/v2/works/popular`, and `/v2/epubs/popular`. Stable operation IDs are `v2_get_stats`, `v2_get_popular_works`, and `v2_get_popular_epubs`.

- [ ] **Step 1: Write failing HTTP success, limit, and error-contract tests.**

```python
# test_lbapi/v2/test_api.py
import pytest
from fastapi.testclient import TestClient
from opensearchpy.exceptions import OpenSearchException

from lbapi.v2 import stats
from lbapi.v2.app import v2_app
from lbapi.v2.models import MediaCounts, StatsResponse


@pytest.fixture
def client() -> TestClient:
    return TestClient(v2_app, raise_server_exceptions=False)


def sample_work() -> dict:
    return {
        "lbworkid": "lb1",
        "titlepath": "WorkOne",
        "title": "Work One",
        "shorttitle": "Short One",
        "titleid": "one",
        "work_titleid": "one",
        "mediatype": "etext",
        "startpagename": "1",
        "main_author": {
            "authorid": "AuthorOne",
            "full_name": "Author One",
            "surname": "One",
        },
    }


def sample_epub() -> dict:
    return {
        "title": "EPUB One",
        "shorttitle": None,
        "titleid": "epub-one",
        "work_titleid": None,
        "authors": [
            {
                "authorid": "AuthorOne",
                "full_name": "Author One",
                "surname": "One",
            }
        ],
    }


def test_success_responses_use_the_approved_envelopes(client, monkeypatch) -> None:
    monkeypatch.setattr(
        stats,
        "load_stats",
        lambda: StatsResponse(
            works=1,
            authors=2,
            pages=MediaCounts(etext=3, faksimil=4),
            words=MediaCounts(etext=5, faksimil=6),
            epubs=7,
        ),
    )
    monkeypatch.setattr(stats, "query_popular_work_documents", lambda: [sample_work()])
    monkeypatch.setattr(stats, "query_popular_epub_documents", lambda limit: [sample_epub()])

    assert client.get("/stats").json() == {
        "works": 1,
        "authors": 2,
        "pages": {"etext": 3, "faksimil": 4},
        "words": {"etext": 5, "faksimil": 6},
        "epubs": 7,
    }
    assert client.get("/works/popular").json()["items"][0]["title_id"] == "one"
    assert client.get("/epubs/popular").json()["items"][0]["title_id"] == "epub-one"


def test_popular_endpoints_default_to_30_and_accept_1_through_100(
    client, monkeypatch
) -> None:
    epub_limits: list[int] = []
    work_limits: list[int] = []
    monkeypatch.setattr(stats, "query_popular_work_documents", lambda: [])
    monkeypatch.setattr(
        stats,
        "transform_popular_works",
        lambda documents, limit: work_limits.append(limit) or {"items": []},
    )
    monkeypatch.setattr(
        stats,
        "query_popular_epub_documents",
        lambda limit: epub_limits.append(limit) or [],
    )

    assert client.get("/works/popular").status_code == 200
    assert client.get("/works/popular?limit=100").status_code == 200
    assert client.get("/epubs/popular").status_code == 200
    assert client.get("/epubs/popular?limit=1").status_code == 200
    assert work_limits == [30, 100]
    assert epub_limits == [30, 1]


@pytest.mark.parametrize(
    "path",
    [
        "/works/popular?limit=0",
        "/works/popular?limit=101",
        "/epubs/popular?limit=0",
        "/epubs/popular?limit=101",
    ],
)
def test_limit_validation_uses_the_v2_error_envelope(client, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Request validation failed"
    assert body["error"]["details"][0]["field"] == "limit"


@pytest.mark.parametrize(
    ("path", "attribute", "code", "message"),
    [
        ("/stats", "load_stats", "stats_unavailable", "Unable to load statistics"),
        (
            "/works/popular",
            "query_popular_work_documents",
            "popular_works_unavailable",
            "Unable to load popular works",
        ),
        (
            "/epubs/popular",
            "query_popular_epub_documents",
            "popular_epubs_unavailable",
            "Unable to load popular EPUBs",
        ),
    ],
)
def test_opensearch_failures_are_endpoint_specific(
    client, monkeypatch, path: str, attribute: str, code: str, message: str
) -> None:
    def fail(*args, **kwargs):
        raise OpenSearchException("private upstream detail")

    monkeypatch.setattr(stats, attribute, fail)
    response = client.get(path)
    assert response.status_code == 503
    assert response.json() == {
        "error": {"code": code, "message": message, "details": None}
    }


def test_unexpected_errors_do_not_leak_details(client, monkeypatch) -> None:
    def fail():
        raise RuntimeError("private internal detail")

    monkeypatch.setattr(stats, "load_stats", fail)
    response = client.get("/stats")
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Internal server error",
            "details": None,
        }
    }
    assert "private internal detail" not in response.text


def test_missing_v2_route_uses_the_same_envelope(client) -> None:
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": "Resource not found",
            "details": None,
        }
    }
```

- [ ] **Step 2: Run the HTTP tests and confirm the expected red state.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_api.py
```

Expected: collection fails because `lbapi.v2.app` does not exist and the router has not been added.

- [ ] **Step 3: Add the router and endpoint-specific OpenSearch translation to `stats.py`.**

Add these imports, response declarations, helper, and handlers around the Task 2 functions:

```python
from collections.abc import Callable
from typing import Annotated, TypeVar

from fastapi import APIRouter, HTTPException, Query
from opensearchpy.exceptions import OpenSearchException

from lbapi.v2.models import ApiError, ApiErrorResponse

T = TypeVar("T")

SERVER_ERROR_RESPONSES = {
    500: {"model": ApiErrorResponse, "description": "Unexpected server error"},
    503: {"model": ApiErrorResponse, "description": "Search backend unavailable"},
}
LIMITED_ERROR_RESPONSES = {
    **SERVER_ERROR_RESPONSES,
    422: {"model": ApiErrorResponse, "description": "Invalid request"},
}

router = APIRouter(tags=["statistics"])


def _translate_opensearch_failure(
    code: str,
    message: str,
    operation: Callable[[], T],
) -> T:
    try:
        return operation()
    except OpenSearchException as exc:
        error = ApiError(code=code, message=message, details=None)
        raise HTTPException(
            status_code=503,
            detail=error.model_dump(mode="json"),
        ) from exc


@router.get(
    "/stats",
    operation_id="v2_get_stats",
    response_model=StatsResponse,
    responses=SERVER_ERROR_RESPONSES,
)
def get_stats() -> StatsResponse:
    return _translate_opensearch_failure(
        "stats_unavailable",
        "Unable to load statistics",
        load_stats,
    )


@router.get(
    "/works/popular",
    operation_id="v2_get_popular_works",
    response_model=PopularWorksResponse,
    responses=LIMITED_ERROR_RESPONSES,
)
def get_popular_works(
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> PopularWorksResponse:
    return _translate_opensearch_failure(
        "popular_works_unavailable",
        "Unable to load popular works",
        lambda: transform_popular_works(query_popular_work_documents(), limit),
    )


@router.get(
    "/epubs/popular",
    operation_id="v2_get_popular_epubs",
    response_model=PopularEpubsResponse,
    responses=LIMITED_ERROR_RESPONSES,
)
def get_popular_epubs(
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> PopularEpubsResponse:
    return _translate_opensearch_failure(
        "popular_epubs_unavailable",
        "Unable to load popular EPUBs",
        lambda: transform_popular_epubs(query_popular_epub_documents(limit)),
    )
```

Keep these additions in `stats.py`; do not create a one-domain service/repository layer.

- [ ] **Step 4: Create the isolated v2 application and its error handlers.**

```python
# lbapi/v2/app.py
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opensearchpy.exceptions import OpenSearchException
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from lbapi.v2.models import ApiError, ApiErrorResponse, ErrorDetail
from lbapi.v2.stats import router

logger = logging.getLogger(__name__)

v2_app = FastAPI(
    title="Litteraturbanken API v2",
    version="2.0.0",
    servers=[{"url": "/v2"}],
    root_path_in_servers=False,
    separate_input_output_schemas=False,
)
v2_app.include_router(router)


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    body = ApiErrorResponse(
        error=ApiError(code=code, message=message, details=details)
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
    )


@v2_app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = []
    for error in exc.errors():
        location = error.get("loc", ())
        field_parts = location[1:] if location and location[0] in {"path", "query", "body"} else location
        details.append(
            ErrorDetail(
                field=".".join(str(part) for part in field_parts) or None,
                message=error["msg"],
            )
        )
    return error_response(
        422,
        "validation_error",
        "Request validation failed",
        details,
    )


@v2_app.exception_handler(StarletteHTTPException)
async def http_error_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    if isinstance(exc.detail, dict):
        try:
            error = ApiError.model_validate(exc.detail)
        except ValidationError:
            error = None
        if error is not None:
            return error_response(
                exc.status_code,
                error.code,
                error.message,
                error.details,
            )
    if exc.status_code == 404:
        return error_response(404, "not_found", "Resource not found")
    return error_response(exc.status_code, "http_error", str(exc.detail))


@v2_app.exception_handler(OpenSearchException)
async def opensearch_error_handler(
    request: Request, exc: OpenSearchException
) -> JSONResponse:
    logger.exception("Unhandled OpenSearch failure in API v2", exc_info=exc)
    return error_response(503, "backend_unavailable", "Search backend unavailable")


@v2_app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API v2 failure", exc_info=exc)
    return error_response(500, "internal_error", "Internal server error")
```

- [ ] **Step 5: Run the HTTP suite green, then all v2 tests.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_api.py
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2
git diff --check -- lbapi/v2 test_lbapi/v2
```

Expected: all tests pass; validation responses contain `field: "limit"`; unexpected details are absent.

- [ ] **Step 6: Commit only the Task 3 backend files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
git add lbapi/v2/app.py lbapi/v2/stats.py test_lbapi/v2/test_api.py
git commit -m "feat(api): expose typed v2 statistics routes"
```

## Task 4: Mount v2 and commit a deterministic OpenAPI contract

**Files:**

- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/web.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/setup.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/scripts/export_v2_openapi.py`
- Create (generated): `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`

**Interfaces:** The main app mounts `v2_app` at `/v2`; `/v2/openapi.json` contains only the three v2 schema-relative paths. The exporter defaults to `openapi/v2.json` and supports a non-mutating `--check` mode.

- [ ] **Step 1: Write the failing OpenAPI, snapshot, and mount tests.**

```python
# test_lbapi/v2/test_openapi.py
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from lbapi.v2.app import v2_app

ROOT = Path(__file__).resolve().parents[2]
OPENAPI_PATH = ROOT / "openapi" / "v2.json"


def response_ref(schema: dict, path: str, status: str) -> str:
    return schema["paths"][path]["get"]["responses"][status]["content"][
        "application/json"
    ]["schema"]["$ref"]


def test_v2_schema_has_only_stable_final_form_operations() -> None:
    schema = v2_app.openapi()
    assert set(schema["paths"]) == {
        "/stats",
        "/works/popular",
        "/epubs/popular",
    }
    assert schema["servers"] == [{"url": "/v2"}]
    assert schema["paths"]["/stats"]["get"]["operationId"] == "v2_get_stats"
    assert (
        schema["paths"]["/works/popular"]["get"]["operationId"]
        == "v2_get_popular_works"
    )
    assert (
        schema["paths"]["/epubs/popular"]["get"]["operationId"]
        == "v2_get_popular_epubs"
    )
    assert "PopularWork" in schema["components"]["schemas"]
    assert "PopularWork-Input" not in schema["components"]["schemas"]
    assert "PopularWork-Output" not in schema["components"]["schemas"]


def test_limits_and_error_models_are_explicit() -> None:
    schema = v2_app.openapi()
    for path in ("/works/popular", "/epubs/popular"):
        limit = next(
            parameter
            for parameter in schema["paths"][path]["get"]["parameters"]
            if parameter["name"] == "limit"
        )
        assert limit["schema"]["default"] == 30
        assert limit["schema"]["minimum"] == 1
        assert limit["schema"]["maximum"] == 100
        assert response_ref(schema, path, "422") == "#/components/schemas/ApiErrorResponse"
        assert response_ref(schema, path, "503") == "#/components/schemas/ApiErrorResponse"
        assert response_ref(schema, path, "500") == "#/components/schemas/ApiErrorResponse"

    assert response_ref(schema, "/stats", "200") == "#/components/schemas/StatsResponse"
    assert (
        response_ref(schema, "/works/popular", "200")
        == "#/components/schemas/PopularWorksResponse"
    )
    assert (
        response_ref(schema, "/epubs/popular", "200")
        == "#/components/schemas/PopularEpubsResponse"
    )


def test_committed_snapshot_matches_offline_and_mounted_schema() -> None:
    expected = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    assert v2_app.openapi() == expected

    host = FastAPI()
    host.mount("/v2", v2_app)
    response = TestClient(host).get("/v2/openapi.json")
    assert response.status_code == 200
    assert response.json() == expected


def test_main_application_mounts_v2_without_polluting_legacy_openapi() -> None:
    from lbapi.web import app as main_app

    response = TestClient(main_app).get("/v2/openapi.json")
    assert response.status_code == 200
    assert set(response.json()["paths"]) == {
        "/stats",
        "/works/popular",
        "/epubs/popular",
    }
    assert "/stats" not in main_app.openapi()["paths"]
```

- [ ] **Step 2: Run the test and confirm the snapshot/mount failures.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_openapi.py
```

Expected: the snapshot test fails because `openapi/v2.json` is absent and the main app mount test returns 404.

- [ ] **Step 3: Mount the v2 app and include the subpackage in packaging.**

In `lbapi/web.py`, add the import alongside the other `lbapi` imports and mount immediately after the existing `app = FastAPI(...)` line:

```python
from lbapi.v2.app import v2_app

app = FastAPI(servers=[{"url": "https://red.litteraturbanken.se/api"}])
app.mount("/v2", v2_app, name="v2")
```

Do not change any existing legacy route or response model. In `setup.py`, change only the package list:

```python
packages=["lbapi", "lbapi.v2"],
```

- [ ] **Step 4: Add the deterministic exporter with a non-writing check mode.**

```python
#!/usr/bin/env python3
# scripts/export_v2_openapi.py
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lbapi.v2.app import v2_app

DEFAULT_OUTPUT = ROOT / "openapi" / "v2.json"


def serialize_schema() -> str:
    return json.dumps(
        v2_app.openapi(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        allow_nan=False,
    ) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    expected = serialize_schema()

    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != expected:
            print(f"OpenAPI snapshot is stale: {output}", file=sys.stderr)
            return 1
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(expected, encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

The sorted keys make the reviewed JSON snapshot canonical. Task 6 passes `alphabetize: true` to `openapi-typescript`, which makes live-schema and canonical-file generation byte-identical rather than coupling generated TypeScript to JSON object order.

- [ ] **Step 5: Generate the contract, then prove offline/live/snapshot equality.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/python scripts/export_v2_openapi.py
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2/test_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2
```

Expected: exporter prints `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`; all v2 tests pass; `--check` exits 0 without changing the file.

- [ ] **Step 6: Run focused legacy regressions.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider \
  test_lbapi/test_smoke.py \
  test_lbapi/test_deployment_info.py \
  test_lbapi/test_filter_query.py \
  test_lbapi/test_query_string.py \
  test_lbapi/test_search_highlight_window.py
git diff --check -- lbapi/v2 lbapi/web.py setup.py scripts/export_v2_openapi.py openapi/v2.json test_lbapi/v2
```

Expected: focused regressions pass. Do not run or “fix” the unrelated untracked doctest whose relevance count is already stale.

- [ ] **Step 7: Commit only the Task 4 backend files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
git add \
  lbapi/web.py \
  setup.py \
  scripts/export_v2_openapi.py \
  openapi/v2.json \
  test_lbapi/v2/test_openapi.py
git commit -m "feat(api): mount v2 and snapshot OpenAPI"
```

## Task 5: Scaffold the independent Nuxt 4 application and parity shell

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/package.json`
- Create (generated): `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/yarn.lock`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/.nvmrc`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/.gitignore`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/tsconfig.json`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/vitest.config.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/tailwind.config.cjs`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/nuxt.config.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/app.vue`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/layouts/default.vue`
- Copy mechanically: `/Users/johan/.codex/worktrees/8c5c/littb/app/styles/` to `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/assets/styles/`
- Copy mechanically: `/Users/johan/.codex/worktrees/8c5c/littb/app/img/` to `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/assets/img/`
- Copy mechanically: `/Users/johan/.codex/worktrees/8c5c/littb/app/public/assets/img/` to `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/public/assets/img/`
- Copy mechanically: the five used Requiem OTF files from `/Users/johan/.codex/worktrees/8c5c/littb/app/styles/requiem/` to `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/public/assets/fonts/requiem/`
- Create (one-time fetched reference asset): `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/public/assets/img/backgrounds/about_bkg.jpg`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/assets/styles/nuxt.scss`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/foundation.spec.ts`

**Interfaces:** `yarn dev`, `yarn build`, `yarn typecheck`, `yarn test:unit`, `yarn test:e2e`, `yarn api:generate`, and `yarn api:check` are the Nuxt package entry points. Browser `/api/v2/*` calls are rewritten only by Nuxt’s development Vite proxy; SSR calls use the private runtime base directly.

- [ ] **Step 1: Create the standalone package/tooling manifest.**

```json
{
  "name": "litteraturbanken-nuxt",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "yarn@1.22.17",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "postinstall": "nuxt prepare",
    "dev": "nuxt dev --host 127.0.0.1 --port 3000",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:ssr": "playwright test --project=ssr",
    "test:e2e": "playwright test --project=desktop-chromium --project=mobile-chromium",
    "test:visual:capture": "playwright test --config=playwright.angular.config.ts",
    "api:generate": "openapi-typescript \"${LBAPI_OPENAPI_SCHEMA:-http://127.0.0.1:8000/v2/openapi.json}\" --alphabetize --output app/lib/api/generated/lbapi.ts",
    "api:check": "openapi-typescript \"${LBAPI_OPENAPI_SCHEMA:-http://127.0.0.1:8000/v2/openapi.json}\" --alphabetize --check --output app/lib/api/generated/lbapi.ts"
  },
  "dependencies": {
    "nuxt": "4.4.8",
    "openapi-fetch": "0.17.0",
    "vue": "3.5.39",
    "vue-router": "5.2.0"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@types/node": "22.20.1",
    "autoprefixer": "10.4.21",
    "bootstrap-sass": "3.4.3",
    "openapi-typescript": "7.13.0",
    "postcss": "8.5.6",
    "sass": "1.93.2",
    "tailwindcss": "3.4.18",
    "typescript": "5.9.3",
    "vitest": "4.1.10",
    "vue-tsc": "3.3.7"
  }
}
```

Use these exact supporting files:

```text
# nuxt/.nvmrc
22.22.0
```

```gitignore
# nuxt/.gitignore
.nuxt/
.output/
node_modules/
playwright-report/
test-results/
```

```json
// nuxt/tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

```ts
// nuxt/vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.spec.ts"]
  }
})
```

Run the first install from the standalone directory so the lockfile is owned by Nuxt:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn install
```

Expected: `yarn.lock` and `.nuxt/` are generated; install exits 0 on Node 22.12 or newer.

- [ ] **Step 2: Write a failing independence/foundation test.**

```ts
// nuxt/test/unit/foundation.spec.ts
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const legacyRoot = resolve(nuxtRoot, "..")

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(path) : [path]
    })
  )
  return nested.flat().filter(path => [".ts", ".vue", ".js", ".mjs"].includes(extname(path)))
}

describe("standalone Nuxt foundation", () => {
  test("pins the parity stack without Angular or unused Headless UI", async () => {
    const manifest = JSON.parse(await readFile(resolve(nuxtRoot, "package.json"), "utf8"))
    expect(manifest.dependencies.nuxt).toBe("4.4.8")
    expect(manifest.dependencies["openapi-fetch"]).toBe("0.17.0")
    expect(manifest.devDependencies.tailwindcss).toBe("3.4.18")
    expect(manifest.dependencies.angular).toBeUndefined()
    expect(manifest.dependencies["@headlessui/vue"]).toBeUndefined()
  })

  test("copies legacy parity CSS into Nuxt ownership", async () => {
    const legacy = await readFile(resolve(legacyRoot, "app/styles/styles.scss"), "utf8")
    const owned = await readFile(resolve(nuxtRoot, "app/assets/styles/styles.scss"), "utf8")
    expect(owned).toBe(legacy)
  })

  test("owns the about background and the five required Requiem faces", async () => {
    const background = await readFile(
      resolve(nuxtRoot, "public/assets/img/backgrounds/about_bkg.jpg")
    )
    expect(createHash("sha256").update(background).digest("hex")).toBe(
      "4cee371c1563f34be963587ec894c0ead65cc46e83d662785ece3b575eb49e92"
    )

    for (const filename of [
      "RequiemText-HTF-Roman.otf",
      "RequiemText-HTF-Italic.otf",
      "RequiemText-HTF-SmallCaps.otf",
      "RequiemDisplay-HTF-Roman.otf",
      "RequiemDisplay-HTF-Italic.otf"
    ]) {
      expect(
        await readFile(resolve(nuxtRoot, "public/assets/fonts/requiem", filename))
      ).not.toHaveLength(0)
    }
  })

  test("runtime source has no Angular source or package imports", async () => {
    const files = await sourceFiles(resolve(nuxtRoot, "app"))
    const contents = await Promise.all(files.map(path => readFile(path, "utf8")))
    for (const source of contents) {
      expect(source).not.toMatch(/from\s+["'][^"']*\.\.\/app(?:\/|["'])/)
      expect(source).not.toMatch(/from\s+["']angular(?:[\/"'])/)
      expect(source).not.toContain("window.angular")
    }
  })
})
```

- [ ] **Step 3: Run the test and observe the missing Nuxt-owned files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
```

Expected: the CSS/background ownership tests fail with `ENOENT` for the Nuxt-owned files.

- [ ] **Step 4: Copy the visual sources mechanically, then add only the Nuxt wrapper override.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
rsync -a app/styles/ nuxt/app/assets/styles/
rsync -a app/img/ nuxt/app/assets/img/
rsync -a app/public/assets/img/ nuxt/public/assets/img/
mkdir -p nuxt/public/assets/fonts/requiem nuxt/public/assets/img/backgrounds
cp \
  app/styles/requiem/RequiemText-HTF-Roman.otf \
  app/styles/requiem/RequiemText-HTF-Italic.otf \
  app/styles/requiem/RequiemText-HTF-SmallCaps.otf \
  app/styles/requiem/RequiemDisplay-HTF-Roman.otf \
  app/styles/requiem/RequiemDisplay-HTF-Italic.otf \
  nuxt/public/assets/fonts/requiem/
curl -fsSL \
  -A 'Mozilla/5.0' \
  -e https://litteraturbanken.se/om/statistik \
  https://litteraturbanken.se/red/bilder/bakgrundsbilder/about_bkg.jpg \
  -o nuxt/public/assets/img/backgrounds/about_bkg.jpg
echo '4cee371c1563f34be963587ec894c0ead65cc46e83d662785ece3b575eb49e92  nuxt/public/assets/img/backgrounds/about_bkg.jpg' \
  | shasum -a 256 -c -
```

These are copies, not imports; the Angular originals remain untouched. The downloaded JPEG is the current `/om/*` background selected by the legacy `backgrounds.xml`; the checksum locks the one-time visual reference to a reviewed 2000×1727, 356762-byte asset. Then add:

```scss
// nuxt/app/assets/styles/nuxt.scss
@font-face {
    font-family: "Requiem Text A";
    src: url("/assets/fonts/requiem/RequiemText-HTF-Roman.otf") format("opentype");
    font-style: normal;
    font-weight: 400;
    font-display: block;
}

@font-face {
    font-family: "Requiem Text A";
    src: url("/assets/fonts/requiem/RequiemText-HTF-Italic.otf") format("opentype");
    font-style: italic;
    font-weight: 400;
    font-display: block;
}

@font-face {
    font-family: "Requiem Text SC A";
    src: url("/assets/fonts/requiem/RequiemText-HTF-SmallCaps.otf") format("opentype");
    font-style: normal;
    font-weight: 400;
    font-display: block;
}

@font-face {
    font-family: "Requiem Display A";
    src: url("/assets/fonts/requiem/RequiemDisplay-HTF-Roman.otf") format("opentype");
    font-style: normal;
    font-weight: 400;
    font-display: block;
}

@font-face {
    font-family: "Requiem Display A";
    src: url("/assets/fonts/requiem/RequiemDisplay-HTF-Italic.otf") format("opentype");
    font-style: italic;
    font-weight: 400;
    font-display: block;
}

#__nuxt,
.site-shell {
    display: contents;
}

.site-shell {
    white-space: nowrap;
}

.site-shell > * {
    white-space: normal;
}
```

The local faces remove a runtime dependency on the hosted font stylesheet. The wrapper override neutralizes Nuxt’s unavoidable elements while preserving the legacy parent `white-space: nowrap` and child `white-space: normal` behavior, so `#leftCorridor` and `#mainview` remain in the same inline formatting context.

- [ ] **Step 5: Add Tailwind 3.4 and Nuxt runtime/proxy configuration.**

```js
// nuxt/tailwind.config.cjs
module.exports = {
  content: ["./app/**/*.{vue,js,ts}"],
  theme: {
    extend: {
      opacity: { 85: "0.85", 90: "0.90" },
      colors: {
        gray: {
          100: "#f5f5f5",
          200: "#eeeeee",
          300: "#e0e0e0",
          400: "#bdbdbd",
          500: "#9e9e9e",
          600: "#757575",
          700: "#616161",
          800: "#424242",
          900: "#212121"
        },
        primary: "#7A1400"
      }
    }
  },
  variants: {},
  plugins: []
}
```

```ts
// nuxt/nuxt.config.ts
const apiProxyTarget = process.env.LBAPI_PROXY_TARGET || "http://127.0.0.1:8000"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: true,
  devtools: { enabled: false },
  css: [
    "~/assets/styles/bootstrap.scss",
    "~/assets/styles/tailwind.css",
    "~/assets/styles/styles.scss",
    "~/assets/styles/nuxt.scss"
  ],
  routeRules: {
    "/om/statistik": { ssr: true }
  },
  runtimeConfig: {
    apiBase: "http://127.0.0.1:8000/v2",
    public: {
      apiBase: "/api/v2"
    }
  },
  typescript: {
    strict: true
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },
  vite: {
    server: {
      proxy: {
        "^/api/v2(?:/|$)": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/v2(?=\/|$)/, "/v2")
        }
      }
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: "sv" },
      link: [
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/assets/img/favicons/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/assets/img/favicons/favicon-16x16.png" }
      ],
      meta: [{ name: "theme-color", content: "#ffffff" }]
    }
  }
})
```

Use the Vite development proxy, not `nitro.devProxy`: the anchored regex and rewrite are required to turn `/api/v2/stats` into backend `/v2/stats` without affecting `/api/v20` or other `/api` traffic. SSR never uses this proxy; it calls `runtimeConfig.apiBase` directly.

- [ ] **Step 6: Add the Nuxt app/layout entry points with the existing shell structure.**

```vue
<!-- nuxt/app/app.vue -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

Create `nuxt/app/layouts/default.vue` by translating only Angular attributes in the shell from `app/index.html`: keep the exact `#leftCorridor`, `.logo_link_monogram`, inline two-path LB SVG, `.mainnav`, `#toolkit`, `#mainview`, `#rightCorridor`, `#toolkit-right`, and `#bkgimg` DOM order. Its navigation list must be exactly:

```vue
<template>
  <div class="site-shell">
    <div id="leftCorridor">
      <a class="logo_link_monogram block" href="/" aria-label="Litteraturbanken">
        <svg
          class="lb-logo inline-block"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          x="0px"
          y="0px"
          width="360"
          height="280"
          viewBox="70 0 469 600"
          xml:space="preserve"
          preserveAspectRatio="xMinYMin"
          aria-hidden="true"
        >
          <g>
            <path class="b-fill" d="M370.36,577.35c-40.299,0-72.82,2.121-101.808,5.656c-1.414,0,0-3.535,0.707-4.242c63.63-5.655,68.579-4.948,68.579-116.654V250.009c0-111.706-4.242-110.999-69.286-118.069c-0.707,0-1.414-2.828,0-2.828c28.987,3.535,49.489,4.949,89.789,4.949c16.261,0,61.509-2.828,84.133-2.828c74.942,0,137.865,34.643,137.865,101.808c0,43.127-45.248,90.496-108.878,101.102v1.414c91.202-1.414,150.591,44.541,150.591,108.878c0,76.355-63.63,136.451-165.438,136.451C433.282,580.885,386.62,577.35,370.36,577.35z M409.244,336.262c86.961,0,122.312-25.451,122.312-94.737c0-74.942-43.834-101.101-106.05-101.101c-10.605,0-18.383,0-30.401,2.121c-4.949,21.917-7.07,53.025-7.07,106.757v216.342c0,97.566,7.07,106.051,61.51,106.051c79.184,0,120.896-28.279,120.896-115.948c0-72.113-51.611-120.189-161.196-115.948C408.537,339.797,408.537,336.262,409.244,336.262z" />
          </g>
          <g>
            <path class="l-fill" d="M507.364,492.948c-26.784,0-66.216-4.464-119.785-4.464c-73.655,0-154.751,2.231-208.32,5.951c-1.488,0,0-4.464,0.744-4.464c77.376-8.185,78.864-4.464,78.864-122.761v-223.2c0-117.552-3.721-116.809-72.168-124.249c-0.744,0-2.232-2.976-0.744-2.976c31.249,3.72,65.473,5.208,107.137,5.208c31.248,0,67.704-2.232,90.023-5.208c1.488,0,1.488,2.976,0.744,2.976c-71.424,5.952-72.168,11.16-72.168,124.249v223.201c0,96.721,8.185,105.648,47.616,105.648h40.92c117.553,0,119.785-8.929,129.457-52.824c0,0,3.72-0.744,3.72,0c-2.231,19.344-5.952,45.384-10.416,61.008C520.013,491.46,516.291,492.948,507.364,492.948z" />
          </g>
        </svg>
      </a>
      <ul role="navigation" class="mainnav">
        <li><a href="/bibliotek">Biblioteket</a></li>
        <li><a title="Snabbkommando: 's'">Snabbsökning</a></li>
        <li><a href="/sök">Sök i texterna</a></li>
        <li><a href="/epub?visa=epub&amp;sort=popularitet">Hämta e-böcker</a></li>
        <li><a href="/presentationer">Presentationer</a></li>
        <li><a href="https://litteraturbanken.se/diktensmuseum/">Diktens museum</a></li>
        <li><a href="/litteraturkartan/">Litteraturkartan</a></li>
        <li><a href="/översättarlexikon/">Översättarlexikon</a></li>
        <li><a href="/bibliotekariesidor/shared-reading/">Shared reading</a></li>
        <li><a href="/dramawebben">Dramawebben</a></li>
        <li><a href="/ljudochbild/">Ljud <em>&amp;</em> bild</a></li>
        <li><a href="/skolan/">Skolan</a></li>
        <li><a href="/om/ide">Om LB</a></li>
      </ul>
      <div id="toolkit" />
    </div>
    <main id="mainview" role="main"><slot /></main>
    <div id="rightCorridor" class="ml-4 sm:ml-16 relative z-50">
      <div id="toolkit-right" />
    </div>
    <div id="bkgimg" />
  </div>
</template>

<style scoped>
.l-fill { fill: var(--logo-l-color, white); }
.b-fill { fill: var(--logo-b-color, white); }
</style>
```

The two `d` attributes above are copied from `app/index.html`; do not simplify or redraw the SVG.

- [ ] **Step 7: Run foundation checks and a production build.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
yarn typecheck
yarn build
```

Expected: 3 unit tests pass; strict typecheck and Nitro build exit 0. No Angular package appears in `nuxt/yarn.lock` as a direct dependency.

- [ ] **Step 8: Commit only the Nuxt foundation and owned copies.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add \
  nuxt/.nvmrc \
  nuxt/.gitignore \
  nuxt/package.json \
  nuxt/yarn.lock \
  nuxt/tsconfig.json \
  nuxt/vitest.config.ts \
  nuxt/tailwind.config.cjs \
  nuxt/nuxt.config.ts \
  nuxt/app/app.vue \
  nuxt/app/layouts/default.vue \
  nuxt/app/assets \
  nuxt/public/assets/fonts/requiem \
  nuxt/public/assets/img \
  nuxt/test/unit/foundation.spec.ts
git commit -m "build(nuxt): scaffold standalone application"
```

## Task 6: Generate and configure the typed v2 client

**Files:**

- Create (generated): `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/generated/lbapi.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/client.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/api-client.spec.ts`

**Interfaces:** `createLbApiClient(baseUrl, customFetch?)` returns the raw `openapi-fetch` client typed by generated `paths`. Page code calls literal schema paths directly. `LBAPI_OPENAPI_SCHEMA` accepts either a URL or filesystem path; absent it, generation uses `http://127.0.0.1:8000/v2/openapi.json`. The pinned CLI's `--check` mode is the only drift check and never writes.

- [ ] **Step 1: Prove the generated client is absent/stale without writing it.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
```

Expected: `openapi-typescript --check` exits nonzero because `app/lib/api/generated/lbapi.ts` does not exist. The command must not create the file. Both generation scripts use `--alphabetize`, so live FastAPI JSON and the key-sorted committed snapshot produce identical TypeScript bytes.

- [ ] **Step 2: Generate from the committed backend snapshot.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:generate
rg -n '"/stats"|"/works/popular"|"/epubs/popular"|StatsResponse|ApiErrorResponse' app/lib/api/generated/lbapi.ts
```

Expected: generation prints the absolute `lbapi.ts` path; `rg` finds all three paths and the approved contract names. Never edit this file manually.

- [ ] **Step 3: Write failing raw-client tests using an injected Fetch implementation.**

```ts
// nuxt/test/unit/api-client.spec.ts
import { describe, expect, test, vi } from "vitest"

import { createLbApiClient } from "../../app/lib/api/client"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })

describe("generated LB API client", () => {
  test("calls the schema-relative stats path under the supplied v2 base", async () => {
    const fetchMock = vi.fn(async (request: Request) =>
      json({
        works: 1,
        authors: 2,
        pages: { etext: 3, faksimil: 4 },
        words: { etext: 5, faksimil: 6 },
        epubs: 7
      })
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error } = await client.GET("/stats")

    expect(error).toBeUndefined()
    expect(data?.pages.etext).toBe(3)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0].url).toBe("http://example.test/v2/stats")
  })

  test("serializes the typed ranking limit", async () => {
    const fetchMock = vi.fn(async () => json({ items: [] }))
    const client = createLbApiClient("http://example.test/api/v2/", fetchMock)

    await client.GET("/works/popular", { params: { query: { limit: 30 } } })

    expect(fetchMock.mock.calls[0][0].url).toBe(
      "http://example.test/api/v2/works/popular?limit=30"
    )
  })

  test("returns the typed v2 error body for a non-2xx response", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          error: {
            code: "popular_epubs_unavailable",
            message: "Unable to load popular EPUBs",
            details: null
          }
        },
        503
      )
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error, response } = await client.GET("/epubs/popular", {
      params: { query: { limit: 12 } }
    })

    expect(response.status).toBe(503)
    expect(data).toBeUndefined()
    expect(error?.error.code).toBe("popular_epubs_unavailable")
  })
})
```

- [ ] **Step 4: Run the client test and confirm it fails because `client.ts` is absent.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
```

Expected: Vitest reports that `../../app/lib/api/client` cannot be resolved.

- [ ] **Step 5: Add the minimal generated-client factory—no endpoint wrapper methods.**

```ts
// nuxt/app/lib/api/client.ts
import createClient, { type ClientOptions } from "openapi-fetch"

import type { paths } from "./generated/lbapi"

export function createLbApiClient(
  baseUrl: string,
  customFetch?: ClientOptions["fetch"]
) {
  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    ...(customFetch ? { fetch: customFetch } : {})
  })
}
```

Do not add `getStats()`/`getPopularWorks()` convenience methods: with one page consumer they would be another page-specific model layer. Literal `client.GET(...)` calls remain fully typed by the generated contract.

- [ ] **Step 6: Run client, drift, type, and build checks.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn typecheck
yarn build
```

Expected: all unit tests pass; `api:check` exits 0 without rewriting `lbapi.ts`; typecheck and build pass.

- [ ] **Step 7: Commit only the generation/client files.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add \
  nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/app/lib/api/client.ts \
  nuxt/test/unit/api-client.spec.ts
git commit -m "feat(nuxt): add generated v2 API client"
```

## Task 7: SSR-render the complete statistics page with page-owned requests

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/pages/om/statistik.vue`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/playwright.config.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/fixtures/statistics-data.mjs`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/fixtures/v2-server.mjs`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/ssr/statistics.spec.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/e2e/statistics.behavior.spec.ts`

**Interfaces:** The page makes three literal generated-client calls from `<script setup>` and no other module: `GET("/stats")`, `GET("/works/popular", { params: { query: { limit: 30 } } })`, and `GET("/epubs/popular", { params: { query: { limit: 30 } } })`. SSR chooses private `runtimeConfig.apiBase`; client navigation chooses public `runtimeConfig.public.apiBase`. Each independent `useAsyncData` handler returns a truthy wrapper even when its resource fails, preventing a hydration retry.

- [ ] **Step 1: Add deterministic v2/legacy fixture data shared by SSR, browser, and later Angular baseline capture.**

```js
// nuxt/test/fixtures/statistics-data.mjs
export const stats = {
  works: 16237,
  authors: 5521,
  pages: { etext: 342753, faksimil: 2737882 },
  words: { etext: 71987189, faksimil: 669221541 },
  epubs: 1513
}

const author = (authorId, fullName, surname) => ({
  author_id: authorId,
  full_name: fullName,
  surname
})

function workAt(rank) {
  if (rank === 1) {
    return {
      title_id: "DoktorGlas",
      title_path: "DoktorGlas",
      title: "Doktor Glas",
      short_title: null,
      author: author("SoderbergH", "Hjalmar Söderberg", "Söderberg"),
      representation: {
        work_id: "lb-doktor-glas",
        media_type: "etext",
        start_page_name: "-2"
      }
    }
  }
  if (rank === 2) {
    return {
      title_id: "FrokenJulie1888",
      title_path: "FrokenJulie1888",
      title: "Fröken Julie",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg"),
      representation: {
        work_id: "lb-froken-julie",
        media_type: "faksimil",
        start_page_name: "i"
      }
    }
  }
  if (rank === 3) {
    return {
      title_id: "SamladeVerk27",
      title_path: "SamladeVerk27",
      title: "Samlade Verk 27. Fadren. Fröken Julie. Fordringsägare",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg"),
      representation: {
        work_id: "lb-samlade-verk-27",
        media_type: "etext",
        start_page_name: "1"
      }
    }
  }

  return {
    title_id: `PopularWork${rank}`,
    title_path: `PopularWork${rank}`,
    title: `Popular Work ${rank}`,
    short_title: rank === 5 ? "Work Five" : null,
    author: author(
      `Author${rank}`,
      `Full Author ${rank}`,
      rank % 2 === 0 ? `Surname ${rank}` : null
    ),
    representation: {
      work_id: `lb-popular-${rank}`,
      media_type: rank % 3 === 0 ? "pdf" : rank % 2 === 0 ? "faksimil" : "etext",
      start_page_name: rank === 4 ? null : String(rank)
    }
  }
}

function epubAt(rank) {
  if (rank === 1) {
    return {
      title_id: "DoktorGlas",
      title: "Doktor Glas",
      short_title: null,
      author: author("SoderbergH", "Hjalmar Söderberg", "Söderberg")
    }
  }
  if (rank === 2) {
    return {
      title_id: "FrokenJulie1888",
      title: "Fröken Julie",
      short_title: null,
      author: author("StrindbergA", "August Strindberg", "Strindberg")
    }
  }
  return {
    title_id: `EpubWork${rank}`,
    title: `EPUB Work ${rank}`,
    short_title: rank === 5 ? "EPUB Five" : null,
    author: author(
      `EpubAuthor${rank}`,
      `Full EPUB Author ${rank}`,
      rank % 2 === 0 ? `EPUB Surname ${rank}` : null
    )
  }
}

export const popularWorks = Array.from({ length: 30 }, (_, index) => workAt(index + 1))
export const popularEpubs = Array.from({ length: 30 }, (_, index) => epubAt(index + 1))

const legacyAuthor = item => ({
  authorid: item.author.author_id,
  full_name: item.author.full_name,
  surname: item.author.surname
})

export const legacyWorks = popularWorks.map(item => {
  const mappedAuthor = legacyAuthor(item)
  return {
    lbworkid: item.representation.work_id,
    titlepath: item.title_path,
    title: item.title,
    shorttitle: item.short_title,
    titleid: item.title_id,
    work_titleid: item.title_id,
    mediatype: item.representation.media_type,
    startpagename: item.representation.start_page_name,
    authors: [mappedAuthor],
    main_author: mappedAuthor,
    work_authors: [mappedAuthor],
    export: []
  }
})

export const legacyEpubs = popularEpubs.map(item => ({
  title: item.title,
  shorttitle: item.short_title,
  titleid: item.title_id,
  work_titleid: item.title_id,
  authors: [legacyAuthor(item)]
}))
```

This data intentionally exercises four-digit/non-grouped counts, five-plus-digit grouped counts, nullable display fields, both reader URL forms, Unicode display text, and exactly 30 ordered rows per ranking.

- [ ] **Step 2: Add the controllable HTTP fixture server.**

```js
// nuxt/test/fixtures/v2-server.mjs
import { createServer } from "node:http"

import { popularEpubs, popularWorks, stats } from "./statistics-data.mjs"

const port = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
let requests = []
let failure = null

const errorByResource = {
  stats: ["stats_unavailable", "Unable to load statistics"],
  works: ["popular_works_unavailable", "Unable to load popular works"],
  epubs: ["popular_epubs_unavailable", "Unable to load popular EPUBs"]
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type"
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}
}

function resourceFor(pathname) {
  if (pathname === "/v2/stats") return "stats"
  if (pathname === "/v2/works/popular") return "works"
  if (pathname === "/v2/epubs/popular") return "epubs"
  return null
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === "OPTIONS") return sendJson(response, 204, null)
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true })
  }
  if (url.pathname === "/_requests" && request.method === "GET") {
    return sendJson(response, 200, { requests })
  }
  if (url.pathname === "/_requests" && request.method === "DELETE") {
    requests = []
    return sendJson(response, 200, { requests })
  }
  if (url.pathname === "/_failure" && request.method === "PUT") {
    const body = await readJson(request)
    failure = body.resource ?? null
    return sendJson(response, 200, { failure })
  }
  if (url.pathname === "/_failure" && request.method === "DELETE") {
    failure = null
    return sendJson(response, 200, { failure })
  }

  const resource = resourceFor(url.pathname)
  if (request.method === "GET" && resource) {
    requests.push(`${url.pathname}${url.search}`)
    if (failure === resource) {
      const [code, message] = errorByResource[resource]
      return sendJson(response, 503, {
        error: { code, message, details: null }
      })
    }

    const limit = Number(url.searchParams.get("limit") || 30)
    if (resource === "stats") return sendJson(response, 200, stats)
    if (resource === "works") {
      return sendJson(response, 200, { items: popularWorks.slice(0, limit) })
    }
    return sendJson(response, 200, { items: popularEpubs.slice(0, limit) })
  }

  return sendJson(response, 404, {
    error: { code: "not_found", message: "Resource not found", details: null }
  })
})

server.listen(port, "127.0.0.1", () => {
  console.log(`LB API fixture listening on http://127.0.0.1:${port}`)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
```

- [ ] **Step 3: Configure one SSR project and deterministic desktop/mobile browser projects.**

```ts
// nuxt/playwright.config.ts
import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const fixtureOrigin = "http://127.0.0.1:4100"

export default defineConfig({
  testDir: "./test",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  snapshotPathTemplate: resolve(
    import.meta.dirname,
    "test/visual/baselines/{arg}{ext}"
  ),
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: "ssr",
      testMatch: /ssr\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "desktop-chromium",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: /e2e\/.*\.visual\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  webServer: [
    {
      command: "node test/fixtures/v2-server.mjs",
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command:
        `NUXT_API_BASE=${fixtureOrigin}/v2 ` +
        `NUXT_PUBLIC_API_BASE=/api/v2 ` +
        `LBAPI_PROXY_TARGET=${fixtureOrigin} yarn dev`,
      url: "http://127.0.0.1:3000/_nuxt/@vite/client",
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
```

The SSR runtime override uses Nuxt's native `NUXT_API_BASE`; the public override remains `/api/v2`; only the test-only Vite target uses `LBAPI_PROXY_TARGET`. The internal Vite client is the readiness URL so the RED run can start before the page route exists.

- [ ] **Step 4: Write the failing direct-SSR contract test.**

```ts
// nuxt/test/ssr/statistics.spec.ts
import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const expectedRequests = [
  "/v2/epubs/popular?limit=30",
  "/v2/stats",
  "/v2/works/popular?limit=30"
]

async function resetFixture(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

test("direct HTML contains metadata, data, and rankings before hydration", async ({
  request
}) => {
  await resetFixture(request)

  const response = await request.get("/om/statistik")
  expect(response.status()).toBe(200)
  const html = await response.text()

  for (const text of [
    "<title>Om LB | Litteraturbanken</title>",
    "Statistik för Litteraturbanken.",
    "Om Litteraturbanken",
    "Litteraturbanken innehåller just nu",
    "De mest lästa verken",
    "De mest nedladdade epubarna",
    "16 237 verk",
    "5521 författare",
    "342 753 sidor etext",
    "2 737 882 sidor faksimil",
    "741 208 730 ord",
    "1513 epubfiler",
    "Doktor Glas",
    "Popular Work 30",
    "EPUB Work 30"
  ]) {
    expect(html).toContain(text)
  }

  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect([...log.requests].sort()).toEqual(expectedRequests)
})
```

- [ ] **Step 5: Write failing browser behavior and partial-failure tests.**

```ts
// nuxt/test/e2e/statistics.behavior.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const allRequests = [
  "/v2/epubs/popular?limit=30",
  "/v2/stats",
  "/v2/works/popular?limit=30"
]

async function resetFixture(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

async function failResource(request: APIRequestContext, resource: string) {
  await request.put(`${fixture}/_failure`, { data: { resource } })
}

async function recordedRequests(request: APIRequestContext) {
  const body = await (await request.get(`${fixture}/_requests`)).json()
  return [...body.requests].sort()
}

async function openReadyPage(page: Page) {
  const problems = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))

  const response = await page.goto("/om/statistik", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await page.evaluate(() => document.fonts.ready)
  return problems
}

test.beforeEach(async ({ request }) => resetFixture(request))

test("renders exact copy, order, URLs, metadata, and no hydration errors", async ({
  page,
  request
}) => {
  const problems = await openReadyPage(page)
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Statistik för Litteraturbanken."
  )
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveText([
    "16 237 verk",
    "5521 författare",
    "342 753 sidor etext",
    "2 737 882 sidor faksimil",
    "741 208 730 ord",
    "1513 epubfiler"
  ])

  const works = lists.nth(1).locator("li")
  const epubs = lists.nth(2).locator("li")
  await expect(works).toHaveCount(30)
  await expect(epubs).toHaveCount(30)
  await expect(works.first()).toContainText("1. Doktor Glas")
  await expect(works.last()).toContainText("30. Popular Work 30")
  await expect(epubs.first()).toContainText("1. Doktor Glas")
  await expect(epubs.last()).toContainText("30. EPUB Work 30")

  await expect(works.first().locator("a").first()).toHaveAttribute(
    "href",
    "/författare/SoderbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  await expect(works.first().locator("a.author")).toHaveAttribute(
    "href",
    "/författare/SoderbergH"
  )
  await expect(works.nth(3).locator("a").first()).toHaveAttribute(
    "href",
    "/författare/Author4/titlar/PopularWork4/faksimil"
  )
  await expect(epubs.first().locator("a").first()).toHaveAttribute(
    "href",
    "/txt/epub/SoderbergH_DoktorGlas.epub"
  )
  await expect(epubs.first().locator("a").first()).toHaveAttribute("download", "")
  await expect(epubs.first().locator("a").first()).toHaveAttribute("target", "_self")

  expect(await recordedRequests(request)).toEqual(allRequests)
  expect(problems).toEqual([])
})

test("the development proxy maps the public browser base to backend v2", async ({
  page,
  request
}) => {
  await openReadyPage(page)
  await request.delete(`${fixture}/_requests`)

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/v2/stats")
    return { status: response.status, body: await response.json() }
  })

  expect(result.status).toBe(200)
  expect(result.body.works).toBe(16237)
  expect(await recordedRequests(request)).toEqual(["/v2/stats"])
})

test("summary failure hides only the current statistics content", async ({
  page,
  request
}) => {
  await failResource(request, "stats")
  await openReadyPage(page)

  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await expect(page.locator(".content.stats")).toHaveCount(0)
  expect(await recordedRequests(request)).toEqual(allRequests)
})

test("popular-work failure leaves that ranking empty", async ({ page, request }) => {
  await failResource(request, "works")
  await openReadyPage(page)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveCount(6)
  await expect(lists.nth(1).locator("li")).toHaveCount(0)
  await expect(lists.nth(2).locator("li")).toHaveCount(30)
  expect(await recordedRequests(request)).toEqual(allRequests)
})

test("popular-EPUB failure leaves that ranking empty", async ({ page, request }) => {
  await failResource(request, "epubs")
  await openReadyPage(page)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveCount(6)
  await expect(lists.nth(1).locator("li")).toHaveCount(30)
  await expect(lists.nth(2).locator("li")).toHaveCount(0)
  expect(await recordedRequests(request)).toEqual(allRequests)
})
```

The failure tests intentionally do not require an empty console: the page emits development diagnostics for the failed resource. They do require a 200 page, no Nuxt error screen, and preservation of every unaffected section.

- [ ] **Step 6: Install Chromium and observe both SSR/browser tests fail before the page exists.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn playwright install chromium
yarn test:ssr
yarn playwright test --project=desktop-chromium test/e2e/statistics.behavior.spec.ts
```

Expected: Playwright starts both servers, but the SSR/body assertions fail because `/om/statistik` has not been implemented. Do not change the fixtures to make the red state pass.

- [ ] **Step 7: Implement all page-owned fetching, mappings, metadata, and markup in one SFC.**

```vue
<!-- nuxt/app/pages/om/statistik.vue -->
<script setup lang="ts">
import { createLbApiClient } from "../../lib/api/client"
import type { components } from "../../lib/api/generated/lbapi"

type PopularWork = components["schemas"]["PopularWork"]
type PopularEpub = components["schemas"]["PopularEpub"]

useSeoMeta({
  title: "Om LB | Litteraturbanken",
  description: "Statistik för Litteraturbanken."
})

useHead({
  htmlAttrs: {
    style: "background: url('/assets/img/backgrounds/about_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-about ready" }
})

const config = useRuntimeConfig()
const client = createLbApiClient(
  import.meta.server ? config.apiBase : config.public.apiBase
)

function reportFailure(resource: string, error: unknown) {
  if (import.meta.dev) console.error(`Statistics ${resource} request failed`, error)
}

async function requestStats() {
  try {
    const { data, error } = await client.GET("/stats")
    if (error) reportFailure("summary", error)
    return data ?? null
  } catch (error) {
    reportFailure("summary", error)
    return null
  }
}

async function requestPopularWorks() {
  try {
    const { data, error } = await client.GET("/works/popular", {
      params: { query: { limit: 30 } }
    })
    if (error) reportFailure("popular works", error)
    return data ?? null
  } catch (error) {
    reportFailure("popular works", error)
    return null
  }
}

async function requestPopularEpubs() {
  try {
    const { data, error } = await client.GET("/epubs/popular", {
      params: { query: { limit: 30 } }
    })
    if (error) reportFailure("popular EPUBs", error)
    return data ?? null
  } catch (error) {
    reportFailure("popular EPUBs", error)
    return null
  }
}

const [statsAsync, worksAsync, epubsAsync] = await Promise.all([
  useAsyncData("statistics-summary", async () => ({ value: await requestStats() })),
  useAsyncData("statistics-popular-works", async () => ({
    value: await requestPopularWorks()
  })),
  useAsyncData("statistics-popular-epubs", async () => ({
    value: await requestPopularEpubs()
  }))
])

const statsData = computed(() => statsAsync.data.value?.value ?? null)
const popularWorks = computed(() => worksAsync.data.value?.value?.items ?? [])
const popularEpubs = computed(() => epubsAsync.data.value?.value?.items ?? [])

function numberFmt(value: number): string {
  const digits = String(value)
  return digits.length < 5 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function authorHref(item: PopularWork | PopularEpub): string {
  return `/författare/${item.author.author_id}`
}

function authorLabel(item: PopularWork | PopularEpub): string {
  return item.author.surname || item.author.full_name
}

function readerHref(item: PopularWork): string {
  const base = `/författare/${item.author.author_id}/titlar/${item.title_id}`
  const page = item.representation.start_page_name
  return page === null
    ? `${base}/${item.representation.media_type}`
    : `${base}/sida/${page}/${item.representation.media_type}`
}

function epubHref(item: PopularEpub): string {
  return `/txt/epub/${item.author.author_id}_${item.title_id}.epub`
}
</script>

<template>
  <h1>Om Litteraturbanken</h1>
  <ul class="links">
    <li><a href="/om/ide">Intro</a></li>
    <li><a href="/om/organisation">Organisation</a></li>
    <li><a href="/om/hjalp">Hjälp</a></li>
    <li><a href="/om/rattigheter">Rättigheter</a></li>
    <li><a href="/om/tack">Tack</a></li>
    <li><a class="active" href="/om/statistik">Statistik</a></li>
    <li><a href="/om/kontakt">Kontakt</a></li>
  </ul>

  <div v-if="statsData" class="content stats unbox">
    <h3>Litteraturbanken innehåller just nu</h3>
    <ul>
      <li>{{ numberFmt(statsData.works) }} verk</li>
      <li>{{ numberFmt(statsData.authors) }} författare</li>
      <li>{{ numberFmt(statsData.pages.etext) }} sidor etext</li>
      <li>{{ numberFmt(statsData.pages.faksimil) }} sidor faksimil</li>
      <li>{{ numberFmt(statsData.words.etext + statsData.words.faksimil) }} ord</li>
      <li>{{ numberFmt(statsData.epubs) }} epubfiler</li>
    </ul>

    <h3>De mest lästa verken</h3>
    <ul>
      <li v-for="(item, index) in popularWorks" :key="item.representation.work_id">
        <span class="num">{{ index + 1 }}. </span>
        <a :href="readerHref(item)">{{ item.short_title || item.title }}</a>
        <a class="author pull-right" :href="authorHref(item)">
          {{ authorLabel(item) }}
        </a>
      </li>
    </ul>

    <h3>De mest nedladdade epubarna</h3>
    <ul>
      <li v-for="(item, index) in popularEpubs" :key="item.title_id">
        <span class="num">{{ index + 1 }}. </span>
        <a :href="epubHref(item)" download target="_self">
          {{ item.short_title || item.title }}
        </a>
        <a class="author pull-right" :href="authorHref(item)">
          {{ authorLabel(item) }}
        </a>
      </li>
    </ul>
  </div>
</template>
```

Do not extract any of these functions or requests: every mapping is used only by this page. Do not add loading/error markup. A null start page takes the existing valid short reader route and must never serialize as `/sida/null/...`.

- [ ] **Step 8: Run SSR, browser, unit, type, and build checks green.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:ssr
yarn playwright test --project=desktop-chromium test/e2e/statistics.behavior.spec.ts
yarn test:unit
yarn typecheck
yarn build
git diff --check -- app/pages/om/statistik.vue playwright.config.ts test
```

Expected: the SSR response contains all fixture content before hydration; the fixture records each v2 request exactly once; all five desktop behavior tests pass; no success-path console/hydration errors occur; unit/type/build checks exit 0.

- [ ] **Step 9: Commit only the statistics page and deterministic test harness.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add \
  nuxt/app/pages/om/statistik.vue \
  nuxt/playwright.config.ts \
  nuxt/test/fixtures/statistics-data.mjs \
  nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/ssr/statistics.spec.ts \
  nuxt/test/e2e/statistics.behavior.spec.ts
git commit -m "feat(nuxt): SSR-render statistics page"
```

## Task 8: Capture the Angular authority and enforce desktop/mobile visual parity

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/playwright.angular.config.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/capture-angular.spec.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/e2e/statistics.visual.spec.ts`
- Create (generated only by Angular capture): `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/statistics-desktop.png`
- Create (generated only by Angular capture): `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/statistics-mobile.png`
- Modify only if a comparison exposes a real mismatch: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/layouts/default.vue`
- Modify only if a comparison exposes a real mismatch: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/assets/styles/nuxt.scss`
- Modify only if a comparison exposes a real mismatch: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/pages/om/statistik.vue`

**Interfaces:** The two committed PNGs come from the current Angular application with deterministic intercepted statistics responses. Normal Nuxt visual tests may read them but never regenerate them. Both apps use identical Chromium profiles, CSS viewport dimensions, data, font readiness, background-image readiness, disabled animations, hidden carets, and full-page capture.

- [ ] **Step 1: Write the Nuxt screenshot assertion and observe the missing-baseline red state.**

```ts
// nuxt/test/e2e/statistics.visual.spec.ts
import { expect, test } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function waitForVisualAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(image => new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true })
          image.addEventListener("error", resolve, { once: true })
        }))
    )

    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      const image = new Image()
      image.src = match[1]
      await image.decode()
    }
  })
}

test.beforeEach(async ({ request }) => {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
})

test("matches the approved Angular statistics page", async ({ page }, testInfo) => {
  await page.goto("/om/statistik", { waitUntil: "domcontentloaded" })
  await expect(page.locator(".content.stats > ul").nth(1).locator("li")).toHaveCount(30)
  await expect(page.locator(".content.stats > ul").nth(2).locator("li")).toHaveCount(30)
  await waitForVisualAssets(page)

  const baseline = testInfo.project.name === "mobile-chromium"
    ? "statistics-mobile.png"
    : "statistics-desktop.png"

  await expect(page).toHaveScreenshot(baseline, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })
})
```

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn playwright test \
  --project=desktop-chromium \
  --project=mobile-chromium \
  test/e2e/statistics.visual.spec.ts
```

Expected: both projects fail because the approved Angular baseline files do not exist. Playwright may write first-run Nuxt images at the expected paths; they are unapproved temporary output and must be overwritten by Step 4 before staging.

- [ ] **Step 2: Add the one-time Angular-production capture configuration.**

```ts
// nuxt/playwright.angular.config.ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./test/visual",
  testMatch: "capture-angular.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.ANGULAR_BASE_URL || "https://litteraturbanken.se",
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: "angular-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "angular-mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ]
})
```

This one-time command reads the currently deployed Angular application as a visual authority; it does not deploy or proxy Nuxt, mutate Angular source, or make Nuxt depend on Angular at runtime.

- [ ] **Step 3: Intercept Angular's three legacy requests with the same deterministic data and capture exact baseline paths.**

```ts
// nuxt/test/visual/capture-angular.spec.ts
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

// This JavaScript fixture is deliberately shared with the Node HTTP fixture.
// @ts-ignore -- Playwright transpiles the adjacent ESM module directly.
import { legacyEpubs, legacyWorks, stats } from "../fixtures/statistics-data.mjs"

async function waitForVisualAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(image => new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true })
          image.addEventListener("error", resolve, { once: true })
        }))
    )

    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      const image = new Image()
      image.src = match[1]
      await image.decode()
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.route(/\/get_stats(?:\?|$)/, route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stats) })
  )
  await page.route(/\/query_string\/etext,faksimil,pdf(?:\?|$)/, route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hits: legacyWorks.length,
        distinct_hits: legacyWorks.length,
        data: legacyWorks
      })
    })
  )
  await page.route(/\/query\/etext(?:\?|$)/, route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: legacyEpubs, hits: legacyEpubs.length })
    })
  )
})

test("captures the current Angular visual authority", async ({ page }, testInfo) => {
  await page.goto("/om/statistik", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/\bready\b/)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(1).locator("li")).toHaveCount(30)
  await expect(lists.nth(2).locator("li")).toHaveCount(30)
  await waitForVisualAssets(page)

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const filename = testInfo.project.name === "angular-mobile"
    ? "statistics-mobile.png"
    : "statistics-desktop.png"

  await page.screenshot({
    path: resolve(directory, filename),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })
})
```

No helper, fixture, or module is imported from the Angular source tree; only HTTP is intercepted. The current Angular route, compiled CSS, DOM, background configuration, and hosted page behavior remain the authority.

- [ ] **Step 4: Generate, inspect, and approve both Angular baselines.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:visual:capture
file \
  test/visual/baselines/statistics-desktop.png \
  test/visual/baselines/statistics-mobile.png
```

Expected: both Angular capture projects pass and overwrite any first-run Nuxt images. Open both exact PNGs in the image viewer and verify that they show the complete current shell, about background, active Statistik link, six counts, 30 works, and 30 EPUBs without missing fonts/assets or error overlays. Do not continue if either capture is incomplete.

- [ ] **Step 5: Compare Nuxt to the approved images and correct source—not baselines—if necessary.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn playwright test \
  --project=desktop-chromium \
  --project=mobile-chromium \
  test/e2e/statistics.visual.spec.ts
```

Expected: both projects pass. The 100-pixel allowance across each full page covers only isolated rasterization noise; any text, geometry, spacing, color, wrapping, background, or responsive-layout change produces a much larger failure and must be fixed in the three listed Nuxt source files. Never run `--update-snapshots` against Nuxt output. If a diff occurs, inspect Playwright's expected/actual/diff artifacts, identify the first mismatched DOM/CSS rule against the Angular source, patch that Nuxt-owned rule, and rerun this same command until green.

- [ ] **Step 6: Run all Nuxt checks after parity corrections.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
yarn test:ssr
yarn test:e2e
yarn typecheck
yarn build
git diff --check -- \
  app/layouts/default.vue \
  app/assets/styles/nuxt.scss \
  app/pages/om/statistik.vue \
  playwright.angular.config.ts \
  test/visual \
  test/e2e/statistics.visual.spec.ts
```

Expected: unit, SSR, behavior, both visual projects, typecheck, and build all pass; diff check is silent.

- [ ] **Step 7: Commit capture tooling, reviewed Angular baselines, Nuxt assertion, and any parity-only corrections.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add \
  nuxt/playwright.angular.config.ts \
  nuxt/test/visual/capture-angular.spec.ts \
  nuxt/test/visual/baselines/statistics-desktop.png \
  nuxt/test/visual/baselines/statistics-mobile.png \
  nuxt/test/e2e/statistics.visual.spec.ts \
  nuxt/app/layouts/default.vue \
  nuxt/app/assets/styles/nuxt.scss \
  nuxt/app/pages/om/statistik.vue
git commit -m "test(nuxt): lock statistics visual parity"
```

Because the three Nuxt source files may already be unchanged from earlier commits, `git add` simply stages no new blob for those paths when parity is exact. It still cannot stage any Angular path.

## Task 9: Run the cross-repository completion and local-runtime gates

**Files:** No planned file changes. This task verifies committed output in both repositories. If any command fails, return to the task that owns that behavior, add a focused failing regression there, fix it, rerun that task's checks, and only then repeat this gate.

- [ ] **Step 1: Run the complete scoped backend contract and legacy-regression gate.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
virtual_env/bin/pytest -q -p no:cacheprovider test_lbapi/v2
virtual_env/bin/python scripts/export_v2_openapi.py --check
virtual_env/bin/pytest -q -p no:cacheprovider \
  test_lbapi/test_smoke.py \
  test_lbapi/test_deployment_info.py \
  test_lbapi/test_filter_query.py \
  test_lbapi/test_query_string.py \
  test_lbapi/test_search_highlight_window.py
git diff --check -- \
  lbapi/v2 \
  lbapi/web.py \
  setup.py \
  scripts/export_v2_openapi.py \
  openapi/v2.json \
  test_lbapi/v2
git status --short -- \
  lbapi/v2 \
  lbapi/web.py \
  setup.py \
  scripts/export_v2_openapi.py \
  openapi/v2.json \
  test_lbapi/v2
```

Expected: all scoped backend tests pass; the OpenAPI check writes nothing; diff check is silent; scoped status is empty because Tasks 1–4 committed every owned file. Ignore—but do not alter, stage, or clean—pre-existing status outside these pathspecs.

- [ ] **Step 2: Reinstall and run the complete deterministic Nuxt gate from committed inputs.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
nvm use
yarn install --frozen-lockfile
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn test:unit
yarn test:ssr
yarn test:e2e
yarn typecheck
yarn build
```

Expected: Node reports `v22.22.0`; frozen install changes neither manifest nor lockfile; generated-client drift check exits 0; all unit/SSR/desktop/mobile tests pass; typecheck passes under strict TypeScript; Nitro produces `.output/` successfully.

- [ ] **Step 3: Prove the frozen Angular application remains buildable and byte-unchanged in source control.**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
yarn test:unit
yarn build
git diff --exit-code 41ec250 -- \
  app \
  package.json \
  yarn.lock \
  vite.config.mjs \
  playwright.config.js \
  test
git diff --check -- nuxt
git status --short -- nuxt
```

Expected: the legacy unit suite and production build pass; the comparison to the approved design commit `41ec250` is empty for every frozen Angular path; Nuxt diff check is silent; Nuxt scoped status is empty because Tasks 5–8 committed every owned file. The unrelated untracked `.superpowers/` companion is outside the pathspec and remains untouched.

- [ ] **Step 4: Start the real local FastAPI and Nuxt processes in separate terminals.**

Terminal A:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
ELASTIC_INDEX=littb-red virtual_env/bin/uvicorn \
  lbapi.web:app --host 127.0.0.1 --port 8000 --reload
```

Terminal B:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
nvm use
yarn dev
```

Expected: FastAPI listens on `127.0.0.1:8000`, Nuxt listens on `127.0.0.1:3000`, and neither process starts Angular or a framework-routing gateway.

- [ ] **Step 5: Verify live OpenAPI equality, default live code generation, all real resources, SSR, and the browser proxy.**

In a third terminal:

```bash
curl -fsS http://127.0.0.1:8000/v2/openapi.json | jq -S . > /tmp/lb-v2-live.json
jq -S . /Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json > /tmp/lb-v2-committed.json
diff /tmp/lb-v2-live.json /tmp/lb-v2-committed.json

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn api:check

curl -fsS http://127.0.0.1:8000/v2/stats | jq -e \
  '.works >= 0 and .authors >= 0 and .pages.etext >= 0 and .epubs >= 0'
curl -fsS 'http://127.0.0.1:8000/v2/works/popular?limit=30' | jq -e \
  '.items | type == "array" and length <= 30'
curl -fsS 'http://127.0.0.1:8000/v2/epubs/popular?limit=30' | jq -e \
  '.items | type == "array" and length <= 30'

curl -fsS http://127.0.0.1:3000/om/statistik > /tmp/lb-statistik.html
rg -n \
  'Om LB \| Litteraturbanken|Litteraturbanken innehåller just nu|De mest lästa verken|De mest nedladdade epubarna' \
  /tmp/lb-statistik.html
curl -fsS http://127.0.0.1:3000/api/v2/stats | jq -e '.works >= 0'
```

Expected: schema diff is empty; default URL-based `api:check` is green; all resources return typed final-form envelopes; SSR HTML already contains metadata/headings; Nuxt's browser-only `/api/v2` development proxy reaches backend `/v2`. Terminal A's access log shows `/v2/stats`, `/v2/works/popular?limit=30`, and `/v2/epubs/popular?limit=30` during the SSR request, proving server rendering bypasses the browser proxy.

- [ ] **Step 6: Perform the final visual/browser smoke against real local data, then stop both processes.**

Open `http://127.0.0.1:3000/om/statistik` in the browser at desktop and narrow mobile widths. Confirm the reviewed shell/background/typography remain unchanged, live counts render, both rankings preserve backend order, links have the approved destination formats, and the browser console has no hydration warning or uncaught error. Then stop Terminals A and B with `Ctrl-C`; no long-running compatibility process remains.

Completion means every automated gate and this local smoke passed, both repositories have no uncommitted changes in owned paths, Angular remains frozen, and no production infrastructure work was introduced.
