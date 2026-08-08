# Nuxt V2 Semantic Review Ledger Design

## Purpose

Give every authored Nuxt V2 production code unit a bounded, evidence-backed semantic review. Deterministic analyzers remain the first line of defense, but a clean analyzer report must no longer be treated as proof that a function, component, or handler has received meaningful code review.

The system reviews the current repository state rather than reconstructing or rewriting the migration history. It creates small review packets, records independent review evidence against a content fingerprint, and invalidates an approval whenever the reviewed code changes.

## Scope

The authoritative scope is authored production source under:

- `nuxt/app/`
- `nuxt/server/`
- `nuxt/shared/`

Generated OpenAPI clients, tests, fixtures, build output, browser artifacts, and vendored code are excluded. Tests remain review context and verification evidence, but do not require their own coverage entry in the first retrospective pass.

The review is provenance-neutral. All in-scope code is reviewed regardless of whether it was written by a person or an AI. This avoids unreliable authorship inference and ensures that shared code surrounding the migration receives the same scrutiny as obviously new pages.

## Alternatives Considered

### Recommended: semantic packets over current HEAD

Inventory the current codebase, group related named units into bounded packets, and review those packets with their callers, dependencies, contracts, and tests. This preserves current architectural context, avoids history rewriting, and supports stable re-review after later changes.

### File-by-file review

This is operationally simple but produces arbitrary boundaries. A component can only be judged with the helper, API adapter, and test that define its behavior, while a large page can contain several unrelated responsibilities. File coverage would therefore overstate semantic coverage.

### Reconstruct small historical commits

Rebasing the migration into small commits would produce attractive diffs but is disruptive, difficult to validate, and still does not guarantee coherent review units. The system must improve the current code without rewriting shared history.

## Review Coverage Model

The inventory extends the existing TypeScript and Vue unit attribution code. It enumerates every authored source file and every named function, method, callback, component, route handler, and module fallback. Every in-scope unit must be owned by exactly one packet; appearing only as contextual material does not count as review coverage.

Packet roots are semantic entry points:

- Vue pages and components;
- Nitro route and middleware handlers;
- exported domain operations and adapters;
- composables and shared utilities;
- module fallbacks where no smaller named unit exists.

Nested and private helpers are owned by their nearest root. Imports, callers, and related tests are attached as context but remain owned by their own packet when they are production units.

The normal packet target is 200–400 nonblank production lines. A packet may be smaller when it represents one complete responsibility. A packet above 450 lines is marked oversized and cannot be approved until it is split along named-unit or responsibility boundaries, unless a checked-in waiver explains why splitting would make the review less coherent. A waiver is review debt, visible in the ledger, and does not silently change the global threshold.

Coverage is complete only when:

1. every in-scope source file is represented;
2. every discovered named production unit has exactly one owner packet;
3. no packet is unreviewed, stale, changes-requested, or impermissibly oversized;
4. every approved packet has valid independent evidence for its current fingerprint.

## Packet Contents

The ignored generated directory `.quality/semantic-review/` contains canonical JSON and readable Markdown. The index ranks packets and each packet contains:

- stable packet ID, roots, owned units, paths, and current line spans;
- current content fingerprint and production line count;
- direct imports, direct callers, and dependency direction;
- relevant generated API types and other public type boundaries;
- candidate unit, SSR, E2E, and visual tests discovered through imports and naming conventions;
- current maintainability findings and risk-selection reasons;
- risk flags for API boundaries, routing, SSR/client state, raw HTML, sanitization, storage, concurrency, and unusually large or complex code;
- review instructions and the exact evidence schema expected from an independent reviewer.

Packets point at current repository locations instead of copying entire source files. The reviewer must inspect the implementation and context in the working tree, preventing stale excerpts from becoming the reviewed artifact.

Packet ordering is deterministic: risk score descending, then stable packet ID. Risk affects order, never whether a unit is reviewed.

## Fingerprints and Invalidation

Each packet has a SHA-256 fingerprint over a canonical manifest of:

- the complete owned production source ranges;
- the packet ownership graph;
- public signatures and relevant type-boundary references;
- the paths and identities of attached direct dependencies.

Line numbers, absolute paths, timestamps, and generated report formatting are excluded. Comments and source tokens remain part of the reviewed material; changing documentation inside a reviewed unit conservatively requires re-review. Moving an unchanged unit within a file does not invalidate it, while changing its implementation, ownership, public contract, or dependency neighborhood does.

The checked-in ledger stores the stable packet ID and approved fingerprint. A mismatch changes the effective status to `stale` even if the stored record still says `approved`. Normal checks never rewrite approvals.

## Ledger and Evidence

`nuxt/quality/semantic-review-ledger.json` is the canonical checked-in coverage ledger. Records are strictly validated, canonically sorted, and contain:

- packet ID and approved fingerprint;
- explicit state: `unreviewed`, `reviewing`, `changes-requested`, or `approved`;
- reviewer identity and review method;
- evidence document path and evidence SHA-256;
- finding IDs and their dispositions;
- verification commands relevant to the packet.

Independent evidence lives under `nuxt/quality/semantic-reviews/`. Evidence is machine-readable JSON with a short Markdown rendering generated for humans. Every finding must include severity, category, exact path and unit, line evidence, consequence, and the simpler or safer alternative. Questions and tool false positives are distinct from confirmed findings.

Confirmed findings are resolved by small ordinary commits. The evidence records the resolution commit and focused verification. Recurring findings are additionally converted into the narrowest deterministic regression test, ESLint/SonarJS rule, dependency rule, ast-grep rule, or architecture-policy check that accurately represents the lesson.

The implementation agent cannot approve its own packet. The bootstrap pass uses a separate review-only model process with no write authority. Its structured result is validated before the authoring workflow may record an approval. A packet with an unresolved Important or Critical finding remains `changes-requested`.

## Commands and Quality Integration

The Nuxt package exposes:

- `yarn quality:review:inventory` — generate the complete packet inventory and queue;
- `yarn quality:review:check` — fail on coverage gaps, duplicate ownership, stale approvals, malformed evidence, unresolved blocking findings, or oversized unwaived packets;
- `yarn quality:review:packet --id <packet-id>` — render one bounded review packet;
- `yarn quality:review:record --packet <packet-id> --evidence <path>` — validate independent evidence and update only that ledger record;
- `yarn quality:review:queue` — show the next unreviewed, stale, or changes-requested packets.

The existing `yarn quality:maintainability` command remains responsible for analyzer findings and feeds its signals into packet risk ranking. It does not own review coverage or approvals.

During bootstrap, inventory and packet contracts are blocking while incomplete review coverage is reported explicitly. Once the initial retrospective pass is complete in the same implementation goal, `yarn quality:review:check` becomes part of `invoke quality.frontend` and the release-quality path. The final merged state therefore has no permanent nonblocking bootstrap loophole.

## Retrospective Review Workflow

The initial audit proceeds in deterministic risk order:

1. Generate and validate the complete inventory.
2. Review one packet at a time with an independent, read-only reviewer.
3. Validate and store the evidence.
4. For confirmed findings, write focused failing tests where behavior is affected.
5. Implement the smallest repair in a separate auditable commit.
6. Re-run the focused checks and request re-review of the changed packet.
7. Record approval only for the resulting fingerprint.
8. Periodically run the global coverage check so refactors cannot create gaps.

Review categories are correctness, unnecessary complexity, duplicated ownership, type and API integrity, SSR/client races, accessibility, security boundaries, test quality, and consistency with the simplest established local pattern. Style-only preferences are not findings unless a checked-in project convention makes them objective.

Large fixes are decomposed into small commits by finding or tightly coupled responsibility. The code is never approved merely because broad tests are green, and the review result is never accepted merely because a model returned no findings; packet size, context completeness, evidence shape, and reviewer independence are deterministic gates.

## Testing Strategy

Implementation follows test-driven development. Focused tests cover:

- exhaustive source discovery and generated/test exclusions;
- stable named-unit and packet ownership;
- no missing or duplicate coverage;
- packet splitting at responsibility and size boundaries;
- deterministic dependency, caller, type, and test context;
- fingerprint stability across line movement and invalidation on source, ownership, contract, or dependency changes;
- fail-closed ledger and evidence schemas;
- stale approval detection;
- rejection of self-review, unresolved Important/Critical findings, and oversized unwaived packets;
- canonical report and ledger serialization;
- authoritative package and Invoke task integration;
- policy protection against disabling or bypassing the review gate.

The first retrospective pass additionally runs relevant focused tests for every repaired packet. Final verification runs architecture policy, lint, maintainability, semantic review coverage, typecheck, all unit tests, all SSR tests, relevant desktop and mobile E2E suites, and a production build. Visual suites are run where touched behavior or presentation warrants them; unrelated legacy baseline failures must be reproduced against the pre-change revision before being classified as outside the goal.

## Failure Handling

Inventory, parsing, dependency discovery, evidence validation, and reviewer execution fail closed. A tool crash or malformed reviewer response is not an approval. Missing test context is reported as a risk signal rather than guessed away.

If an independent review identifies a product decision rather than a code defect, the packet remains unresolved until existing behavior, production parity, or a user decision supplies authority. The autonomous pass may preserve behavior, delete demonstrably dead code, simplify equivalent implementation, strengthen types, and add tests; it must not invent new product behavior.

## Success Criteria

- Every authored Nuxt V2 production unit belongs to exactly one bounded semantic review packet.
- Every packet is approved by independent evidence for its current fingerprint.
- A meaningful change to reviewed code or its dependency neighborhood makes the authoritative quality check fail as stale.
- Clean analyzer output cannot create an implicit approval.
- Confirmed findings are fixed in small auditable commits with focused verification.
- Recurring review lessons become deterministic protections where they can be expressed accurately.
- The checked-in ledger and evidence are reproducible, canonical, and free of absolute paths or timestamps that create noise.
- `invoke quality.frontend` enforces both analyzer cleanliness and semantic review coverage.
- Existing behavior and visuals are preserved unless a confirmed defect requires a tested correction.
- Final completion is supported by independent review and fresh full verification evidence.
