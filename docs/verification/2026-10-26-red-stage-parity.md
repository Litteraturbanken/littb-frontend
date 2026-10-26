# Red to Stage feature parity — 2026-10-26

Audited frontend master `0e7507c83` against Stage `1c0ae1313`, and backend master `141173c` against Stage `be92b79`. Ports are based on behavior, without merging or rebasing legacy master into Stage.

## Frontend audit

| Red commits | Stage disposition |
| --- | --- |
| `75721f84` | Empty author lifespans already omit parentheses in the Nuxt search label. Academy collection predicates now include Academy contributors. |
| `709ab321`, `7486c092` | Academy provenance OR Academy authors/parent-work authors ported to V2 library predicates and title-option/legacy diagnostic queries. Corpus service expands the collection using the existing contributor bitmap. |
| `7daae84e` | Existing Nuxt route serialization and reader recovery retain structured filters and encode URL parameters; focused navigation/recovery tests pass. |
| `5a88e035` | Tal appears directly below Sakprosa in library and text search. Backend enum, generated types, fixtures and category limits updated (39 options). |
| `ca76d0fd` | Desktop relevance table uses automatic layout and a content-sized type column. |
| `80df4c6d` | Public reader and editor use document clientWidth with the existing edge tolerance, preserving pan-before-turn. |
| `0e7507c83` | Author mer exposes only about-work and about-part sections; authored editor/translator sections remain. |

## Backend audit

| Red changes | Stage disposition |
| --- | --- |
| `e60e4dd` | Local downloads stream bounded 64 KiB chunks. |
| `c369700`, `f7cdb3f` | OPDS catalogue/router and tests ported; Stage public base URL configured. Nuxt preserves Content-Length for unencoded EPUB GET/HEAD/range responses. |
| `f073084`, `51ca62e`, `da9212d` | Final NEST/JSON compatibility retained, including phrase semantics and invalid-filter rejection. V2 Academy expansion implemented in the typed compiler rather than changing legacy JSON semantics. |
| `9d28451` | Request-owned OpenSearch response cycles released in shared query paths. |
| `813b9e0` | Bounded connect timeout and retries, no sniff-on-failure, dead-node backoff preserved. |
| `84a08cd`, `ca947ba`, `02a1175`, `9e2ac4a` | Final name-evidence and matched-popularity ranking ported into Stage's extracted library_legacy implementation. Stage part-title and empty-query part-popularity rules retained. |
| `fd4adf3`, `7599f8c` | Legacy search and counts run off the event loop under separate single-slot limiters. Stage corpus path already uses async I/O and bounded diagnostic workers. |
| Documentation and merge commits | No additional runtime behavior. Relevant OPDS/filter documentation and opt-in read-only relevance tests retained. Historical Red verification receipts were not presented as Stage verification. |

## Verification

- Backend: 2,963 passed, 15 skipped across full V2 and affected legacy suites; four new Academy compiler/constraint cases included.
- Frontend: 266 passed across affected filters, author works, reader navigation/recovery and proxy suites.
- Corpus: all 12 filter/sort integration tests pass, including Academy contributors with Tal and an unrelated decoy.
- Frontend typecheck, architecture policy and changed-file ESLint pass. Backend critical Ruff rules pass; changed text-search module passes mypy.
- Full backend strict mypy remains blocked by ten existing errors in unchanged `lbapi/v2/editorial_redirects.py`.
- Local browser with fixture API: Tal order verified in both menus; author mer shows only the two about sections; desktop type column is content-sized; ArrowRight turns the multi-page reader from -2 to -1 at the horizontal edge.
- Live catalogue ranking tests are opt-in and were not run against a remote search cluster.

## Release boundary

This is source integration into Stage, not a live deployment. The author response contract and frontend validator must be released together; the corpus Academy change must accompany the backend/frontend release. No Red or production deployment is part of this port.
