# Reader Dictionary Observability Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing privacy-safe dictionary lookup event so the Reader can report SO/SAOB availability, empty results, embedded-child failures, and timeouts without recording the selected word.

**Architecture:** `lb-backend` remains the authority for the typed observability envelope. This plan adds optional, backward-compatible outcome fields only; the later `littb` plan regenerates the client and adds the browser-to-Nitro intake adapter.

**Tech Stack:** Python 3, FastAPI, Pydantic v2, pytest, Ruff, mypy, OpenAPI.

**Spec:** `/Users/johan/.codex/worktrees/8c5c/littb/docs/superpowers/specs/2026-08-23-reader-svenska-dictionary-embed-design.md`

## Global Constraints

- Work in an isolated `lb-backend` worktree; `/Users/johan/dev/lb-backend` currently contains unrelated changes.
- Keep `event_name` equal to `business.dictionary_lookup` and schema version equal to `lb.observability.v1`.
- Never add the selected word, query, URL, HTML, or arbitrary error text to the event.
- New fields are optional so existing emitters remain valid.
- Allowed outcomes are exactly `opened`, `so`, `saob`, `both`, `empty`, `child_error`, and `timeout`.
- Allowed selected dictionaries are exactly `so` and `saob`.

---

### Task 1: Extend the closed dictionary event model

**Files:**
- Modify: `lbapi/v2/observability_models.py`
- Modify: `test_lbapi/v2/test_observability_models.py`

**Interfaces:**
- Consumes: existing `DictionaryLookupAttributes(word_length, found)`.
- Produces: `DictionaryLookupOutcome`, `DictionaryLookupDictionary`, and optional `outcome`/`selected_dictionary` fields.

- [ ] **Step 1: Write failing validation tests**

Add a helper payload and assertions:

```python
def _dictionary_lookup_payload() -> dict[str, object]:
    return {
        **_request_event_payload(),
        "event_name": "business.dictionary_lookup",
        "event_kind": "business",
        "service": "lb-frontend",
        "producer": "browser",
        "attributes": {
            "word_length": 7,
            "found": True,
            "outcome": "both",
            "selected_dictionary": "so",
        },
    }


def test_dictionary_lookup_records_only_bounded_outcomes() -> None:
    event = TypeAdapter(ObservabilityEvent).validate_python(
        _dictionary_lookup_payload()
    )
    assert event.attributes.outcome == "both"  # ruff:ignore[assert]
    assert event.attributes.selected_dictionary == "so"  # ruff:ignore[assert]


@pytest.mark.parametrize("outcome", ["opened", "so", "saob", "both", "empty", "child_error", "timeout"])
def test_dictionary_lookup_accepts_every_public_outcome(outcome: str) -> None:
    payload = _dictionary_lookup_payload()
    payload["attributes"] = {
        "word_length": 4,
        "found": outcome in {"so", "saob", "both"},
        "outcome": outcome,
        "selected_dictionary": "so" if outcome in {"so", "both"} else None,
    }
    TypeAdapter(ObservabilityEvent).validate_python(payload)


@pytest.mark.parametrize("attributes", [
    {"word_length": 4, "found": True, "outcome": "unknown"},
    {"word_length": 4, "found": True, "outcome": "so", "selected_dictionary": "saol"},
    {"word_length": 4, "found": True, "outcome": "so", "selected_text": "secret"},
])
def test_dictionary_lookup_rejects_unbounded_or_private_fields(attributes: dict[str, object]) -> None:
    payload = _dictionary_lookup_payload()
    payload["attributes"] = attributes
    with pytest.raises(ValidationError):
        TypeAdapter(ObservabilityEvent).validate_python(payload)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `uv run pytest -q test_lbapi/v2/test_observability_models.py -k dictionary_lookup`

Expected: failures because `outcome` and `selected_dictionary` are forbidden extras.

- [ ] **Step 3: Add the typed optional fields**

Immediately above `DictionaryLookupAttributes`, add:

```python
DictionaryLookupOutcome = Literal[
    "opened",
    "so",
    "saob",
    "both",
    "empty",
    "child_error",
    "timeout",
]
DictionaryLookupDictionary = Literal["so", "saob"]
```

Then change the model to:

```python
class DictionaryLookupAttributes(V2Model):
    """Describe a dictionary lookup without retaining the selected word."""

    word_length: int = Field(ge=1, le=100)
    found: bool | None = None
    outcome: DictionaryLookupOutcome | None = None
    selected_dictionary: DictionaryLookupDictionary | None = None
```

- [ ] **Step 4: Run focused static and behavioral checks**

Run:

```bash
uv run ruff check lbapi/v2/observability_models.py test_lbapi/v2/test_observability_models.py
uv run mypy lbapi/v2/observability_models.py
uv run pytest -q test_lbapi/v2/test_observability_models.py
```

Expected: all pass.

- [ ] **Step 5: Commit the model change**

```bash
git add lbapi/v2/observability_models.py test_lbapi/v2/test_observability_models.py
git commit -m "feat(observability): classify Reader dictionary outcomes"
```

### Task 2: Verify API compatibility and hand off the schema

**Files:**
- Verify only: `lbapi/v2/app.py`
- Verify only: generated `/v2/openapi.json`

**Interfaces:**
- Consumes: Task 1's optional dictionary event fields.
- Produces: an OpenAPI schema that the `littb` client generator can consume unchanged for existing events.

- [ ] **Step 1: Run the complete backend quality gate**

Run from the isolated `lb-backend` worktree:

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy lbapi/v2
uv run pytest -q test_lbapi/v2
```

Expected: all checks pass; unrelated dirty files from the main checkout are absent.

- [ ] **Step 2: Inspect the emitted schema**

Run:

```bash
uv run python - <<'PY'
from lbapi.v2.app import v2_app
schema = v2_app.openapi()["components"]["schemas"]["DictionaryLookupAttributes"]
print(schema)
PY
```

Expected: `outcome` contains the seven-value enum, `selected_dictionary` contains `so` and `saob`, and neither field is required.

- [ ] **Step 3: Record the commit for the dependent plan**

Run: `git rev-parse HEAD`

Expected: the SHA of `feat(observability): classify Reader dictionary outcomes`; pass that SHA to the `littb` implementation so its generated client comes from this exact contract.
