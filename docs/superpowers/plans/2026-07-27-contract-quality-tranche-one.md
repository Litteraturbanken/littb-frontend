# Contract Quality Tranche One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing FastAPI v2 package strictly type-checkable, replace low-value syntax/schema tests with specification-focused coverage, and expose deterministic backend and contract quality commands without changing API or Nuxt behavior.

**Architecture:** Treat every legacy provider return as `object` until it passes a small runtime boundary, then carry `dict[str, object]`, protocols, literals, and Pydantic models through v2. Keep the committed OpenAPI snapshot as the exact contract test and retain only cross-cutting OpenAPI invariants beside it. Orchestrate the resulting backend and cross-repository checks from the existing root Invoke tasks.

**Tech Stack:** Python 3.13, FastAPI 0.119, Pydantic 2.12, mypy 2.3.0 with `pydantic.mypy`, Ruff 0.15.22, pytest 8.4, defusedxml 0.7.1, Invoke, OpenAPI, openapi-typescript, Nuxt 4, TypeScript 5.9.

## Global Constraints

- Work in `/Users/johan/.codex/worktrees/8c5c/littb` and `/Users/johan/dev/lb-backend`; they are separate Git repositories on corresponding development branches.
- Preserve all unrelated dirty files in both repositories. Stage only files named by the current task.
- Do not change routes, serialized payloads, status codes, search semantics, visuals, copy, or interactions.
- Do not manually edit `/Users/johan/dev/lb-backend/openapi/v2.json` or `nuxt/app/lib/api/generated/lbapi.ts`; regenerate them only if a verified contract change requires it. This tranche is intended to leave both byte-identical.
- Do not move one-page fetching into composables.
- Do not add broad `# type: ignore`, `# noqa`, ESLint suppressions, missing-import wildcards, or per-file type baselines.
- `Any` is permitted only in the narrow `FastApiResponses` alias required by FastAPI's published decorator type. Legacy provider values begin as `object`, not `Any`.
- Ruff automatic changes remain safe-only. Never use `--unsafe-fixes`.
- The blocking Ruff production subset is exactly `E4,E7,E9,F,S`; the full `ALL` inventory remains advisory.
- Backend strict typing covers every production file below `lbapi/v2` by the end of Task 6 with zero mypy findings.
- Backend tests protect observable contract/domain behavior. They do not inspect handler syntax, source text, annotations, or duplicate the committed OpenAPI snapshot field by field.
- The complete Nuxt ESLint baseline is closed in tranche four, not hidden here. This tranche must leave its measured `104 errors / 28 warnings` baseline no worse.
- Full backend, Nuxt unit, SSR, build, and desktop/mobile Playwright verification is required before tranche completion.

## Baseline Evidence

- `uvx --from mypy==2.3.0 mypy --python-executable virtual_env/bin/python --strict --ignore-missing-imports lbapi/v2` reports 128 errors across 15 files: 39 `arg-type`, 27 `no-untyped-call`, 20 `type-arg`, 19 `no-untyped-def`, 17 `no-any-return`, and six other narrowing/return errors.
- `python -m ruff check lbapi/v2 --select E4,E7,E9,F,S` reports two unsafe XML imports, two unsafe XML parse calls, and one unused local.
- `pytest --collect-only -q test_lbapi/v2` collects 1,392 cases.
- `test_lbapi/v2/test_openapi.py` is 1,088 lines and manually repeats many fields already protected by `openapi/v2.json`.
- Eleven tests assert `inspect.iscoroutinefunction(...)` rather than observable HTTP behavior.

---

### Task 1: Replace Syntax and Duplicate-Schema Tests with a Requirement Matrix

**Files:**
- Create: `/Users/johan/dev/lb-backend/docs/v2-contract-test-matrix.md`
- Replace: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_author_works_api.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_author_works.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_dramawebben.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_text_search.py`

**Interfaces:**
- Consumes: committed `/Users/johan/dev/lb-backend/openapi/v2.json` and current v2 behavior tests.
- Produces: five cross-cutting OpenAPI tests and a requirement-to-owning-layer matrix used by every later test review.

- [ ] **Step 1: Write the requirement-to-test ownership matrix**

Create `docs/v2-contract-test-matrix.md` with this exact ownership table and the rule that every future test names one of these requirements in its review note:

```markdown
# FastAPI v2 contract test ownership

| Requirement | Owning evidence |
| --- | --- |
| All v2 paths and operation IDs are stable | committed `openapi/v2.json` snapshot |
| Public object schemas are closed | cross-cutting OpenAPI invariant |
| Declared JSON errors use `ApiErrorResponse` | cross-cutting OpenAPI invariant plus representative API error tests |
| v2 is mounted under `/v2` without polluting legacy OpenAPI | mount smoke test |
| Author profile/document/resolve normalization and redaction | `test_authors.py`, focused cases in `test_api.py` |
| Author-work grouping, action discrimination, and ordering | author-work provider/transform/API tests |
| Bibliography parsing, query translation, and typed failures | `test_bibliography.py` |
| Contact validation, environment routing, and delivery failure | `test_models.py`, `test_contact.py` |
| Dictionary XML parsing and typed missing/failure behavior | `test_dictionary.py` |
| Dramawebben grouping, canonical author projection, and legacy resolution | `test_dramawebben.py` |
| Quick-search projection, filtering, correction, and failures | `test_quick_search.py`, focused API cases |
| Work lookup normalization, cache, single-flight, and failures | `test_work_lookup.py`, focused API cases |
| Reader hit normalization, paging, options, and failures | `test_reader_search.py`, focused API cases |
| Similar-work vector boundary, projection, and failures | similar-work provider/API tests |
| Source-info normalization, provenance, actions, and failures | source-info model/provider/API tests |
| Statistics counts, ranking, normalization, and failures | `test_stats.py`, focused API cases |
| Text-search compilation, options, results, stale/error boundaries | text-search focused modules |

Retain a test only when it catches a plausible regression in its owning row.
Do not test sync/async declaration, private source structure, framework mechanics,
or schema properties already made exact by the snapshot.
```

- [ ] **Step 2: Replace the manual OpenAPI restatement with five generic invariants**

Replace `test_openapi.py` with helpers and tests shaped exactly as follows. Preserve the existing `main_app` import and use `TestClient` for the mount smoke:

```python
import json
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from lbapi.v2.app import v2_app
from lbapi.web import app as main_app

ROOT = Path(__file__).resolve().parents[2]
OPENAPI_PATH = ROOT / "openapi" / "v2.json"
HTTP_METHODS = frozenset({"delete", "get", "head", "options", "patch", "post", "put", "trace"})


def operations(schema: Mapping[str, Any]) -> Iterator[tuple[str, str, Mapping[str, Any]]]:
    for path, path_item in schema["paths"].items():
        for method, operation in path_item.items():
            if method in HTTP_METHODS:
                yield path, method, operation


def json_schema_ref(response: Mapping[str, Any]) -> str | None:
    content = response.get("content", {})
    return content.get("application/json", {}).get("schema", {}).get("$ref")


def test_committed_snapshot_matches_offline_and_mounted_schema() -> None:
    expected = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    current = v2_app.openapi()
    assert current == expected
    with TestClient(main_app) as client:
        assert client.get("/v2/openapi.json").json() == expected


def test_all_public_object_schemas_are_closed() -> None:
    schemas = v2_app.openapi()["components"]["schemas"]
    open_schemas = sorted(
        name for name, schema in schemas.items()
        if (schema.get("type") == "object" or "properties" in schema)
        and schema.get("additionalProperties") is not False
    )
    assert open_schemas == []


def test_all_operations_have_unique_explicit_v2_operation_ids() -> None:
    found = [operation["operationId"] for _, _, operation in operations(v2_app.openapi())]
    assert all(operation_id.startswith("v2_") for operation_id in found)
    assert len(found) == len(set(found))


def test_all_declared_json_errors_use_the_shared_envelope() -> None:
    wrong = []
    for path, method, operation in operations(v2_app.openapi()):
        for status, response in operation["responses"].items():
            if str(status).startswith("2") or json_schema_ref(response) is None:
                continue
            if json_schema_ref(response) != "#/components/schemas/ApiErrorResponse":
                wrong.append((path, method, status, json_schema_ref(response)))
    assert wrong == []


def test_main_application_mounts_v2_without_polluting_legacy_openapi() -> None:
    with TestClient(main_app) as client:
        assert client.get("/v2/openapi.json").status_code == 200
    legacy_paths = main_app.openapi()["paths"]
    assert "/stats" not in legacy_paths
    assert "/text-search/results" not in legacy_paths
    assert "/autocomplete/{search_string}" in legacy_paths
```

- [ ] **Step 3: Delete the eleven handler-syntax tests**

Delete these tests and the now-unused `inspect` imports:

```text
test_api.py::test_statistics_routes_use_synchronous_get_handlers
test_api.py::test_contact_route_is_a_synchronous_post_handler
test_api.py::test_quick_search_route_is_a_synchronous_get_handler
test_api.py::test_reader_search_hit_route_is_a_synchronous_get_only_handler
test_api.py::test_text_search_routes_are_synchronous_post_only_handlers
test_api.py::test_work_lookup_route_is_a_synchronous_post_handler
test_api.py::test_author_resolve_route_is_a_synchronous_post_handler
test_api.py::test_legacy_author_route_resolve_is_a_synchronous_post_handler
test_api.py::test_author_profile_route_is_a_synchronous_get_handler
test_api.py::test_author_document_route_is_a_synchronous_get_only_handler
test_author_works_api.py::test_author_works_route_is_synchronous_get_only
```

- [ ] **Step 4: Delete schema assertions now owned by the snapshot/invariants**

Delete these tests without replacing them locally:

```text
test_api.py::test_contact_operation_declares_typed_success_and_error_responses
test_api.py::test_openapi_uses_stable_operation_ids_and_error_references
test_author_works.py::test_author_work_action_schema_is_discriminated_by_kind
test_dramawebben.py::test_openapi_catalog_contract_is_strict_and_stable
test_dramawebben.py::test_legacy_route_openapi_contract_is_strict_and_stable
test_text_search.py::test_text_search_openapi_contract_is_strict_recursive_and_method_bound
```

Keep runtime Pydantic tests that exercise business validation (discriminator/media compatibility, required nullable semantics, bounds, normalization, or rejection of provider-only fields). They own runtime behavior distinct from JSON-schema serialization.

- [ ] **Step 5: Prove the rewritten contract tests and complete v2 suite pass**

Run:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_openapi.py
virtual_env/bin/python -m pytest -q test_lbapi/v2
virtual_env/bin/python scripts/export_v2_openapi.py --check
```

Expected: all commands exit 0; the collected test count is lower for documented reasons, and `openapi/v2.json` is unchanged.

- [ ] **Step 6: Commit only the test-quality change**

```bash
cd /Users/johan/dev/lb-backend
git add docs/v2-contract-test-matrix.md \
  test_lbapi/v2/test_openapi.py \
  test_lbapi/v2/test_api.py \
  test_lbapi/v2/test_author_works_api.py \
  test_lbapi/v2/test_author_works.py \
  test_lbapi/v2/test_dramawebben.py \
  test_lbapi/v2/test_text_search.py
git commit -m "test(v2): focus contract suite on behavior"
```

---

### Task 2: Add Strict Typing Infrastructure and Safe Legacy-Value Primitives

**Files:**
- Modify: `/Users/johan/dev/lb-backend/requirements-dev.txt`
- Modify: `/Users/johan/dev/lb-backend/requirements.txt`
- Create: `/Users/johan/dev/lb-backend/mypy.ini`
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/contracts.py`
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/legacy_values.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_legacy_values.py`
- Modify: every `/Users/johan/dev/lb-backend/lbapi/v2/*.py` file declaring a `*_RESPONSES` mapping
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/contact.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/bibliography.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/dictionary.py`

**Interfaces:**
- Consumes: Python 3.13, current strict `V2Model`, existing response metadata, and untrusted provider values.
- Produces: `FastApiResponses`, `LegacyObject`, `legacy_object`, `legacy_objects`, `legacy_string`, and a repository-wide strict mypy configuration consumed by Tasks 3–8.

- [ ] **Step 1: Pin the type/security tooling**

Make `requirements-dev.txt` exactly:

```text
-r requirements.txt
mypy==2.3.0
ruff==0.15.22
types-defusedxml==0.7.0.20260504
```

Add `defusedxml==0.7.1` to `requirements.txt` in alphabetical dependency order. Install with:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pip install -r requirements-dev.txt
```

- [ ] **Step 2: Add the strict mypy configuration**

Create `mypy.ini`:

```ini
[mypy]
python_version = 3.13
plugins = pydantic.mypy
files = lbapi/v2
strict = True
follow_imports = silent
disallow_any_generics = True
disallow_untyped_defs = True
no_implicit_reexport = True
warn_redundant_casts = True
warn_unused_ignores = True

[pydantic-mypy]
init_forbid_extra = True
init_typed = True
warn_required_dynamic_aliases = True

[mypy-opensearchpy.*]
ignore_missing_imports = True

[mypy-nest.*]
ignore_missing_imports = True
```

Do not add `ignore_errors`, `disable_error_code`, or file-specific exclusions.

- [ ] **Step 3: Write failing tests for safe legacy-value narrowing**

Create `test_legacy_values.py` with tests for non-mapping input, non-string keys, undeclared keys, excessive list length, non-object list items, blank/oversized strings, and a successful nested object. Use this public interface:

```python
from lbapi.v2.legacy_values import legacy_object, legacy_objects, legacy_string


def test_legacy_object_accepts_only_string_keyed_declared_fields() -> None:
    assert legacy_object(
        {"title": "Doktor Glas"},
        malformed="bad",
        allowed=frozenset({"title"}),
    ) == {"title": "Doktor Glas"}


def test_legacy_objects_rejects_excessive_or_non_object_items() -> None:
    with pytest.raises(ValueError, match="bad"):
        legacy_objects([{}, {}], malformed="bad", maximum=1)
    with pytest.raises(ValueError, match="bad"):
        legacy_objects(["not an object"], malformed="bad")


def test_legacy_string_enforces_nonblank_and_length() -> None:
    assert legacy_string(" title ", malformed="bad", maximum=20, strip=True) == "title"
    with pytest.raises(ValueError, match="bad"):
        legacy_string(" ", malformed="bad", maximum=20, strip=True)
```

Run and expect import failure:

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_legacy_values.py
```

- [ ] **Step 4: Implement the narrow framework and legacy-value interfaces**

Create `contracts.py`:

```python
from typing import Any, TypeAlias

FastApiResponses: TypeAlias = dict[int | str, dict[str, Any]]
```

The `Any` is confined to the exact type FastAPI requires for route response metadata. Create `legacy_values.py` with this interface and runtime-checked casts:

```python
from typing import cast

type LegacyObject = dict[str, object]


def legacy_object(
    value: object,
    *,
    malformed: str,
    allowed: frozenset[str] | None = None,
) -> LegacyObject:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError(malformed)
    narrowed = cast(dict[str, object], value)
    if allowed is not None and not set(narrowed).issubset(allowed):
        raise ValueError(malformed)
    return narrowed


def legacy_objects(
    value: object,
    *,
    malformed: str,
    maximum: int | None = None,
) -> list[LegacyObject]:
    if not isinstance(value, list) or (maximum is not None and len(value) > maximum):
        raise ValueError(malformed)
    return [legacy_object(item, malformed=malformed) for item in value]


def legacy_string(
    value: object,
    *,
    malformed: str,
    maximum: int,
    strip: bool = False,
) -> str:
    if not isinstance(value, str):
        raise ValueError(malformed)
    normalized = value.strip() if strip else value
    if not normalized or len(normalized) > maximum:
        raise ValueError(malformed)
    return normalized
```

- [ ] **Step 5: Type all FastAPI response metadata at its narrow boundary**

Import `FastApiResponses` and annotate every `*_RESPONSES` constant, including `SERVER_ERROR_RESPONSES` and `LIMITED_ERROR_RESPONSES`:

```python
from lbapi.v2.contracts import FastApiResponses

CONTACT_RESPONSES: FastApiResponses = {
    422: {"model": ApiErrorResponse, "description": "Invalid request"},
    500: {"model": ApiErrorResponse, "description": "Unexpected server error"},
    502: {"model": ApiErrorResponse, "description": "Contact delivery failed"},
}
```

Do not change any status, model, or description.

- [ ] **Step 6: Close the core-model and simple-endpoint findings**

Apply these concrete changes:

- Import `Self` and give `LegacyAuthorRouteRequest.validate_title_pair` the return type `Self`.
- Change `build_contact_email` and `send_via_provider` to use `resend.Emails.SendParams` instead of `dict[str, Any]`.
- Replace `xml.etree.ElementTree` with `defusedxml.ElementTree` in `bibliography.py` and `dictionary.py` without changing parsing code or error mapping.
- Remove now-unused `Any` imports from these files.

Run:

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/contracts.py lbapi/v2/legacy_values.py lbapi/v2/models.py \
  lbapi/v2/contact.py lbapi/v2/bibliography.py lbapi/v2/dictionary.py
virtual_env/bin/python -m ruff check \
  lbapi/v2/contracts.py lbapi/v2/legacy_values.py lbapi/v2/models.py \
  lbapi/v2/contact.py lbapi/v2/bibliography.py lbapi/v2/dictionary.py \
  --select E4,E7,E9,F,S
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_legacy_values.py test_lbapi/v2/test_models.py \
  test_lbapi/v2/test_contact.py test_lbapi/v2/test_bibliography.py \
  test_lbapi/v2/test_dictionary.py
```

Expected: all three commands exit 0.

- [ ] **Step 7: Commit the typing foundation**

```bash
cd /Users/johan/dev/lb-backend
git add requirements-dev.txt requirements.txt mypy.ini \
  lbapi/v2/contracts.py lbapi/v2/legacy_values.py \
  lbapi/v2/models.py lbapi/v2/contact.py lbapi/v2/bibliography.py \
  lbapi/v2/dictionary.py test_lbapi/v2/test_legacy_values.py \
  lbapi/v2/text_search.py lbapi/v2/legacy_author_routes.py \
  lbapi/v2/work_lookup.py lbapi/v2/stats.py lbapi/v2/source_info.py \
  lbapi/v2/similar_works.py lbapi/v2/reader_search.py \
  lbapi/v2/author_works.py lbapi/v2/quick_search.py \
  lbapi/v2/dramawebben.py lbapi/v2/authors.py
git commit -m "chore(v2): establish strict typing boundary"
```

Before committing, inspect `git diff --cached --name-only` and unstage any v2 file whose only change is unrelated to `FastApiResponses`.

---

### Task 3: Type Lookup and Reader-Support Provider Boundaries

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/work_lookup.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/quick_search.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/reader_search.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/similar_works.py`
- Test: corresponding `/Users/johan/dev/lb-backend/test_lbapi/v2/test_*.py` files

**Interfaces:**
- Consumes: `LegacyObject`, `legacy_object`, `legacy_objects`, `legacy_string`, and `FastApiResponses` from Task 2.
- Produces: four strict provider adapters returning Pydantic responses without `dict[Any, Any]`, untyped legacy calls, or string-to-literal type gaps.

- [ ] **Step 1: Record the focused mypy failures**

Run:

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/work_lookup.py lbapi/v2/quick_search.py \
  lbapi/v2/reader_search.py lbapi/v2/similar_works.py
```

Expected before implementation: failures include untyped `_legacy_api`, generic `dict`, `Any` returns, and unchecked media-type strings.

- [ ] **Step 2: Give each legacy module a minimal protocol**

Define a private protocol beside each `_legacy_api` and cast only the imported legacy module:

```python
from typing import Protocol, cast


class _QuickSearchLegacyApi(Protocol):
    def autocomplete(self, query: str) -> object: ...


def _legacy_api() -> _QuickSearchLegacyApi:
    from lbapi import elasticapi

    return cast(_QuickSearchLegacyApi, elasticapi)
```

Use the same pattern with these exact capabilities:

```python
class _WorkLookupLegacyApi(Protocol):
    def query(self, *args: object, **kwargs: object) -> object: ...

class _ReaderSearchLegacyApi(Protocol):
    def search_in_document(self, *args: object, **kwargs: object) -> object: ...

class _SearchClient(Protocol):
    def search(self, **kwargs: object) -> object: ...

class _StrixSearch(Protocol):
    es: _SearchClient

class _SimilarWorksLegacyApi(Protocol):
    strixsearch: _StrixSearch
    INDEX_NAME_EXPANSION: Mapping[str, str]
```

Do not type a provider method as returning a Pydantic DTO; provider output is untrusted `object`.

- [ ] **Step 3: Replace broad dictionaries with checked legacy objects**

Change transformer entry points to accept `object`. Use `legacy_object` and `legacy_objects` immediately, then carry `LegacyObject` through helpers. For media values, narrow before model construction:

```python
media_type = legacy_string(raw_media, malformed=_MALFORMED_RESPONSE, maximum=20)
if media_type not in ("etext", "faksimil"):
    raise ValueError(_MALFORMED_RESPONSE)
typed_media: LegacyMediaType = media_type
```

Import the existing `LegacyMediaType` alias from `lbapi.v2.models` in all four modules instead of creating module-local equivalents. For work lookup, define `_MEDIA_ORDER` as a mapping keyed by `LegacyMediaType` and make `_required_media_type` perform the narrowing once. For quick search, split `_work_item` and `_part_item` inputs into `LegacyObject` and narrow `media_type_label` before constructing `QuickSearchItem`.

- [ ] **Step 4: Make iterable/search response boundaries structural rather than `Any`**

Where a legacy query returns objects with `.to_dict()`, declare:

```python
class _LegacyHit(Protocol):
    def to_dict(self) -> object: ...

class _LegacyHits(Protocol):
    def __iter__(self) -> Iterator[_LegacyHit]: ...
```

Validate every `to_dict()` result with `legacy_object`. For Similar Works, parse both `client.search()` returns as `object` using the existing hit-envelope validators; do not cast them directly to a mapping.

- [ ] **Step 5: Verify static and behavioral ownership**

Run:

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/work_lookup.py lbapi/v2/quick_search.py \
  lbapi/v2/reader_search.py lbapi/v2/similar_works.py
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_work_lookup.py test_lbapi/v2/test_quick_search.py \
  test_lbapi/v2/test_reader_search.py test_lbapi/v2/test_similar_works.py \
  test_lbapi/v2/test_similar_works_api.py
```

Expected: zero mypy findings and all focused tests pass without snapshot changes.

- [ ] **Step 6: Commit the typed lookup/read-support adapters**

```bash
git add lbapi/v2/work_lookup.py lbapi/v2/quick_search.py \
  lbapi/v2/reader_search.py lbapi/v2/similar_works.py
git commit -m "refactor(v2): type lookup provider boundaries"
```

---

### Task 4: Type Author and Dramawebben Provider Boundaries

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/legacy_author_routes.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/dramawebben.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/authors.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/author_works.py`
- Test: author, author-work, and Dramawebben v2 tests

**Interfaces:**
- Consumes: Task 2's runtime narrowing helpers and generated Pydantic literals in `models.py`.
- Produces: strict author/document/work/Dramawebben transformations whose provider modules are represented by minimal protocols.

- [ ] **Step 1: Capture the focused failures**

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/legacy_author_routes.py lbapi/v2/dramawebben.py \
  lbapi/v2/authors.py lbapi/v2/author_works.py
```

Expected before implementation: untyped legacy calls, `Any` returns, nullable narrowing gaps, `Mapping | None` assignment, and unchecked literal fields.

- [ ] **Step 2: Add exact provider protocols and object-return boundaries**

Each module declares only the methods it calls. Use these signatures as the contract:

```python
class _AuthorDocumentLegacyApi(Protocol):
    def get_documents(self, *args: object, **kwargs: object) -> object: ...

class _AuthorWorksLegacyApi(Protocol):
    def search_work_by_authors(self, *args: object, **kwargs: object) -> object: ...
    def list_parts_in_others_works(self, *args: object, **kwargs: object) -> object: ...

class _AuthorLegacyApi(_AuthorDocumentLegacyApi, _AuthorWorksLegacyApi, Protocol):
    pass
```

Dramawebben and legacy-author routing use `_AuthorDocumentLegacyApi`. Cast the imported module once inside each `_legacy_api`; never cast individual response fields to their desired output type.

- [ ] **Step 3: Narrow nullable and literal values before constructing models**

Use explicit guard functions with generated literal aliases:

```python
def _author_work_section_kind(value: object) -> AuthorWorkSectionKind:
    if value not in get_args(AuthorWorkSectionKind):
        raise ValueError(_MALFORMED_RESPONSE)
    return cast(AuthorWorkSectionKind, value)
```

Use equivalent guards for `AuthorWorkReadAction.media_type` and `DramawebbenCatalogMedia.media_type`. For `LegacyAuthorRouteRequest`, branch on `normalized_title_id is None` and `media_type is None` together before calling the title provider, so mypy and runtime semantics agree.

Replace the `Mapping[str, object] | None` assignment in `author_works.py` with two variables (`candidate_profile` and validated `profile`) rather than a `cast`. Change `_profile_document` to accept `Mapping[str, object]`, matching callers.

- [ ] **Step 4: Type cache/probe callables without changing call counts**

Give author “more content” probes and injected provider callbacks explicit `Callable` signatures. Preserve bounded query counts and stale/cache behavior exactly; existing tests own those observables. Do not add tests for annotations themselves.

- [ ] **Step 5: Verify the typed author/drama tranche**

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/legacy_author_routes.py lbapi/v2/dramawebben.py \
  lbapi/v2/authors.py lbapi/v2/author_works.py
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_legacy_author_routes.py \
  test_lbapi/v2/test_dramawebben.py \
  test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_author_work_normalization.py \
  test_lbapi/v2/test_author_work_providers.py \
  test_lbapi/v2/test_author_work_sections.py \
  test_lbapi/v2/test_author_work_transform.py \
  test_lbapi/v2/test_author_works.py \
  test_lbapi/v2/test_author_works_api.py
```

Expected: zero focused mypy findings and all behavior tests pass.

- [ ] **Step 6: Commit the typed author and Dramawebben boundaries**

```bash
git add lbapi/v2/legacy_author_routes.py lbapi/v2/dramawebben.py \
  lbapi/v2/authors.py lbapi/v2/author_works.py
git commit -m "refactor(v2): type author provider boundaries"
```

---

### Task 5: Type Statistics and Source-Information Boundaries

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/stats.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/source_info.py`
- Test: statistics and source-info v2 tests

**Interfaces:**
- Consumes: legacy-value helpers and strict response metadata from Task 2.
- Produces: typed statistics/search-hit protocols and source-info normalization with no `Any` return or unchecked nullable access.

- [ ] **Step 1: Capture the focused failures**

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/stats.py lbapi/v2/source_info.py
```

Expected before implementation: generic dictionaries, untyped legacy calls, `Any` returns, one missing return, nullable indexing, and unchecked read-action literals.

- [ ] **Step 2: Model the statistics query response structurally**

Use protocols for legacy hit iteration and `to_dict()`:

```python
class _LegacyHit(Protocol):
    def to_dict(self) -> object: ...

class _LegacyResponse(Protocol):
    hits: Iterable[_LegacyHit]

class _StatsLegacyApi(Protocol):
    def count_distincts_works(self) -> int: ...
    def count_authors(self) -> int: ...
    def get_page_count(self, media_type: str) -> int: ...
    def get_word_count(self, media_type: str) -> int: ...
    def count_epub(self) -> int: ...
    def query(self, *args: object, **kwargs: object) -> _LegacyResponse: ...
```

Change every helper from bare `dict` to `LegacyObject` and validate each `to_dict()` result. Add `_media_type` narrowing for `Literal["etext", "faksimil", "pdf"]` before constructing `WorkRepresentation`.

- [ ] **Step 3: Make source-info provider parsing object-first**

Declare `_SourceInfoLegacyApi.get_work_by_titlepath(...)->object`. Change provider entry points to accept `object`, validate the outer response with `legacy_object`, and use `legacy_objects` for list fields. Replace functions that currently return a dictionary value directly with `legacy_string` or a checked nested object.

For helpers with optional author/source fields, branch before appending:

```python
label = _optional_text(raw_label)
if label is not None:
    labels.append(label)
```

Ensure the function currently flagged `Missing return statement` ends in an explicit `raise ValueError(_MALFORMED_RESPONSE)` for the impossible/malformed branch rather than `assert` or a dummy return.

- [ ] **Step 4: Narrow source-info media actions at one boundary**

Replace the module-local `SourceInfoRequestMedia` alias with the existing `LegacyMediaType` imported from `lbapi.v2.models`, and introduce only the narrowing helper:

```python
def _source_media_type(value: object) -> LegacyMediaType:
    if value not in ("etext", "faksimil"):
        raise ValueError(_MALFORMED_RESPONSE)
    return cast(LegacyMediaType, value)
```

Use it for both `media_type` and the label only where the legacy contract defines them as the same literal. Do not coerce unknown values.

- [ ] **Step 5: Verify statistics and source information**

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini \
  lbapi/v2/stats.py lbapi/v2/source_info.py
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_stats.py \
  test_lbapi/v2/test_source_info_models.py \
  test_lbapi/v2/test_source_info_provider.py \
  test_lbapi/v2/test_source_info_api.py
```

Expected: zero focused mypy findings and all focused tests pass.

- [ ] **Step 6: Commit the typed statistics/source-info boundaries**

```bash
git add lbapi/v2/stats.py lbapi/v2/source_info.py
git commit -m "refactor(v2): type statistics and source info"
```

---

### Task 6: Type Text Search and Close the Complete mypy Gate

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/text_search.py`
- Test: text-search v2 tests and complete v2 suite

**Interfaces:**
- Consumes: all typing primitives and typed provider patterns from Tasks 2–5.
- Produces: zero strict mypy findings across the entire `lbapi/v2` package.

- [ ] **Step 1: Capture the remaining complete baseline**

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
```

Expected before implementation: findings are limited to `text_search.py`. If another module still fails, return that finding to its owning Task 2–5 change rather than folding unrelated edits into this task. Save the output outside the repository for comparison; do not commit a baseline.

- [ ] **Step 2: Type the text-search legacy interface**

Declare the exact provider capabilities:

```python
class _TextSearchLegacyApi(Protocol):
    def search(self, *args: object, **kwargs: object) -> object: ...
    def search_count(self, *args: object, **kwargs: object) -> object: ...
    def get_documents(self, *args: object, **kwargs: object) -> object: ...
    def get_authorkeywords(self) -> object: ...
    def get_imprint_range(self) -> object: ...
    def query(self, *args: object, **kwargs: object) -> object: ...
```

Cast only the imported legacy module. Change raw transformer inputs to `object`, then narrow with `legacy_object`/`legacy_objects` before access.

- [ ] **Step 3: Give validators and mappings exact generic types**

Apply these concrete fixes:

- All Pydantic model/field validators declare parameter and return types.
- Replace bare `list` and `Mapping` with `list[object]`, `Mapping[str, object]`, or the exact model type.
- Give separate loop variables to language and category option loops so mypy does not reuse incompatible literal unions.
- Reuse `LegacyMediaType` from `lbapi.v2.models` for `TextSearchWork.mediatype` and narrow provider media strings before model construction; do not create another equivalent alias.
- When a legacy filter value can be `str | list[str]`, branch on `isinstance(value, str)` before `.split`; list values follow their existing list-specific path.
- Remove the unused `hits` local currently reported by Ruff instead of suppressing `F841`.

- [ ] **Step 4: Prove the complete production package is strictly typed**

Run:

```bash
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
```

Expected: both commands exit 0 with zero findings. Confirm `mypy.ini` still targets `files = lbapi/v2` and contains no exclusions or disabled error codes.

- [ ] **Step 5: Prove text-search and full backend behavior**

```bash
virtual_env/bin/python -m pytest -q \
  test_lbapi/v2/test_text_search.py \
  test_lbapi/v2/test_text_search_title_collapse.py
virtual_env/bin/python -m pytest -q test_lbapi/v2
virtual_env/bin/python scripts/export_v2_openapi.py --check
```

Expected: all tests and snapshot check pass.

- [ ] **Step 6: Commit strict typing closure**

```bash
git add lbapi/v2/text_search.py
git commit -m "refactor(v2): close strict static analysis"
```

Inspect the staged diff before committing. Only the text-search type/narrowing changes belong here.

---

### Task 7: Add Deterministic Backend and Contract Invoke Tasks

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/tasks.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/test/test_tasks.py`

**Interfaces:**
- Consumes: zero-finding backend `mypy.ini`, backend v2 tests, backend snapshot exporter, Nuxt `api:check`, and current environment settings.
- Produces: `invoke quality.backend`, `invoke quality.contract`, and an upgraded file-deterministic `invoke codegen.check`.

- [ ] **Step 1: Write failing task-list and dry-run tests**

Extend `test_lists_the_public_development_tasks` to require `quality.backend` and `quality.contract`. Add tests asserting these exact dry-run fragments:

```python
def test_backend_quality_dry_run_uses_pinned_repository_tools(self) -> None:
    result = run_invoke("--dry", "quality.backend")
    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertIn("-m mypy --config-file mypy.ini lbapi/v2", result.stdout)
    self.assertIn("-m ruff check lbapi/v2 --select E4,E7,E9,F,S", result.stdout)
    self.assertIn("-m pytest -q test_lbapi/v2", result.stdout)


def test_contract_quality_checks_snapshot_before_generated_client(self) -> None:
    result = run_invoke("--dry", "quality.contract")
    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertIn("scripts/export_v2_openapi.py --check", result.stdout)
    self.assertIn("yarn api:check", result.stdout)
```

Also update the existing codegen dry-run test to require the backend snapshot check before `yarn api:check` and require `LBAPI_OPENAPI_SCHEMA` to equal `<backend>/openapi/v2.json` for checks.

Run:

```bash
python -m unittest discover -s test -p 'test_tasks.py' -q
```

Expected: failures because the quality collection and deterministic snapshot check do not exist.

- [ ] **Step 2: Separate live generation input from checked snapshot input**

Add:

```python
def _openapi_snapshot(settings: Settings) -> Path:
    return settings.backend_dir / "openapi" / "v2.json"


def _check_backend_openapi(context: Context, settings: Settings) -> None:
    _run(
        context,
        [_backend_python(settings), "scripts/export_v2_openapi.py", "--check"],
        settings.backend_dir,
    )
```

Keep `_openapi_schema` for live `codegen.generate`. Change `codegen.check` to call `_check_backend_openapi` and then run `yarn api:check` with `LBAPI_OPENAPI_SCHEMA=str(_openapi_snapshot(settings))`.

- [ ] **Step 3: Implement the backend and contract quality tasks**

Add:

```python
@task(name="backend")
def quality_backend(context: Context) -> None:
    settings = Settings.from_environment()
    python = _backend_python(settings)
    _run(context, [python, "-m", "mypy", "--config-file", "mypy.ini", "lbapi/v2"], settings.backend_dir)
    _run(context, [python, "-m", "ruff", "check", "lbapi/v2", "--select", "E4,E7,E9,F,S"], settings.backend_dir)
    _run(context, [python, "-m", "pytest", "-q", "test_lbapi/v2"], settings.backend_dir)


@task(name="contract")
def quality_contract(context: Context) -> None:
    codegen_check.body(context)
```

Register both in a `quality = Collection("quality")`. Do not add `quality.frontend` or an aggregate `quality` task yet: the approved program assigns zero-warning ESLint closure to tranche four, and a green-named command must not knowingly fail on the current baseline.

- [ ] **Step 4: Verify task behavior**

```bash
python -m unittest discover -s test -p 'test_tasks.py' -q
invoke --list
invoke quality.contract
invoke quality.backend
```

Expected: unit tests pass, both tasks appear, and both real quality tasks exit 0 without requiring a running backend.

- [ ] **Step 5: Commit the root task orchestration**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add tasks.py test/test_tasks.py
git commit -m "chore: add backend contract quality tasks"
```

---

### Task 8: Document the Tranche and Run the Full Cross-Repository Gate

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/docs/quality.md`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/README.md`
- Modify: `/Users/johan/dev/lb-backend/README.md`

**Interfaces:**
- Consumes: Tasks 1–7 and the approved program design.
- Produces: developer instructions for contract ownership, test value, strict backend typing, and deterministic commands; verified evidence that tranche one preserves all frontend behavior.

- [ ] **Step 1: Write the cross-repository quality guide**

Create `docs/quality.md` with these sections and commands:

```markdown
# V2 quality workflow

## Contract ownership
FastAPI/Pydantic owns transport DTOs. `openapi/v2.json` is the committed
contract, generated TypeScript is derived, and Nuxt must not duplicate payload
properties in handwritten transport interfaces.

## Fast checks
- `invoke quality.backend`
- `invoke quality.contract`
- `cd nuxt && yarn lint`
- `cd nuxt && yarn typecheck`

## Backend test policy
Link to `lb-backend/docs/v2-contract-test-matrix.md`. Tests protect observable
contract/domain behavior, not implementation syntax or duplicated schema text.

## Full parity gate
- backend full v2 pytest and OpenAPI snapshot check
- Nuxt lint inventory, typecheck, unit, build, SSR
- full desktop/mobile Playwright suite
```

State explicitly that `yarn lint` remains nonzero after tranche one with the measured 104/28 baseline and that tranche four must take it to zero without suppressions.

- [ ] **Step 2: Update repository-specific READMEs**

In the backend README, add strict mypy and `invoke quality.backend` instructions plus the test-value policy link. In `nuxt/README.md`, add the file-based `invoke quality.contract` command and link to `docs/quality.md`. Do not rewrite the legacy root README in this tranche.

- [ ] **Step 3: Run backend and contract verification from fresh commands**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
invoke quality.backend
invoke quality.contract
```

Expected: zero mypy/Ruff critical findings, all reviewed backend v2 tests pass, and both OpenAPI/codegen checks are clean.

- [ ] **Step 4: Verify the Nuxt static/test baseline is unchanged or better**

Use Node 22.22 from `.nvmrc`:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn lint
yarn typecheck
yarn test:unit
yarn build
```

Expected: lint still exits nonzero with no more than 104 errors and 28 warnings and no new rule/file findings; typecheck, all unit tests, and build pass. Save the JSON lint inventory outside the repository for comparison.

- [ ] **Step 5: Run complete SSR and browser parity suites**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:ssr
yarn test:e2e
```

Expected baseline: 562 SSR tests pass; Playwright reports 688 passed and 6 intentionally skipped across 694 tests. Investigate any changed count against the current tree rather than accepting a looser baseline.

- [ ] **Step 6: Verify repository integrity**

```bash
git -C /Users/johan/dev/lb-backend diff --check
git -C /Users/johan/.codex/worktrees/8c5c/littb diff --check
git -C /Users/johan/dev/lb-backend status --short
git -C /Users/johan/.codex/worktrees/8c5c/littb status --short
```

Expected: no staged or tracked tranche files remain uncommitted. Pre-existing unrelated dirty files and untracked visual artifacts remain untouched.

- [ ] **Step 7: Commit the documentation in each repository**

```bash
cd /Users/johan/dev/lb-backend
git add README.md
git commit -m "docs(v2): document strict quality workflow"

cd /Users/johan/.codex/worktrees/8c5c/littb
git add docs/quality.md nuxt/README.md
git commit -m "docs: document v2 quality workflow"
```

## Tranche-One Completion Audit

Before declaring this plan complete, prove each row:

| Requirement | Evidence |
| --- | --- |
| Backend tests protect specification behavior | matrix exists; syntax/schema-duplication tests absent; full suite green |
| All v2 production code is statically analyzable | strict mypy zero findings on `lbapi/v2` with no baseline/exclusions |
| Critical Ruff findings are closed | `E4,E7,E9,F,S` command exits 0 |
| XML parsing is hardened | defusedxml dependency/imports plus dictionary/bibliography tests |
| Contract drift is deterministic | exporter `--check` and file-based Nuxt `api:check` both pass |
| Quality commands are useful and green | `invoke quality.backend` and `invoke quality.contract` exit 0 |
| No API/UI behavior changed | OpenAPI snapshot byte-identical; backend, Nuxt unit, SSR, build, and full E2E green |
| ESLint debt is not hidden | inventory remains explicit and no worse; zero closure remains assigned to tranche four |
