# Staging Crawl Compatibility Implementation Plan

> **For agentic workers:** Execute this plan with `superpowers:executing-plans`; keep every change test-driven and use `superpowers:verification-before-completion` before reporting success.

**Goal:** Eliminate the six application failures found by the staging crawl while preserving strict v2 API output and distinguishing valid legacy data from malformed identifiers or duplicate contributor records.

**Architecture:** Normalize legacy whitespace only where the backend maps human-facing display strings into typed manifest fields. Keep path and identifier segments strict. Treat contributor identity as the full `(author_id, author_type, role)` tuple. In Nuxt, accept the backend's documented nullable SLA audio URL while retaining exact URL checks for any value that is present.

**Tech Stack:** FastAPI, Pydantic, pytest, Nuxt 3, TypeScript, Vitest, Nomad staging deployment, Grafana/Loki observability.

---

## Task 1: Normalize legacy manifest display text

**Files:**

- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_provider.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest_provider.py`

1. Add focused provider tests proving that trailing whitespace in `showtitle` and part titles is removed and embedded legacy newlines in `full_title` collapse to one space.
2. Run the focused pytest selection and confirm the new tests fail because the provider currently rejects those values.
3. Add a display-text adapter that collapses whitespace runs and then validates the normalized result.
4. Keep `_segment` independent of display-text normalization so whitespace in identifiers remains invalid.
5. Add or retain a regression test proving malformed identifier whitespace is rejected.
6. Run the focused provider tests and confirm they pass.

## Task 2: Make contributor uniqueness role-aware

**Files:**

- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_work_manifest_models.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/work_manifest_models.py`

1. Add a model test accepting one person as both editor and translator.
2. Add a model test rejecting an exact duplicate contributor tuple.
3. Run the focused model tests and confirm the role-distinct case fails.
4. Change the uniqueness key from `author_id` to `(author_id, author_type, role)`.
5. Run the focused model tests and confirm both cases pass.

## Task 3: Accept SLA articles without audio

**Files:**

- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/sla-article.spec.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/server/utils/sla-article.ts`

1. Add a unit test proving an otherwise exact SLA descriptor with `audio_url: null` is valid.
2. Add a loading test proving the article HTML is fetched and the resulting author model retains `audioUrl: null`.
3. Run the focused Vitest file and confirm the descriptor test fails.
4. Allow `null` or the exact approved audio URL in the descriptor guard; continue rejecting unexpected URLs.
5. Run the focused Vitest file and confirm it passes.

## Task 4: Verify repository quality gates

**Files:** None unless a directly related regression is exposed.

1. Run the full backend v2 manifest/provider test modules.
2. Run backend Ruff and type checks on the touched v2 files using the repository's configured commands.
3. Run Nuxt unit tests, ESLint, typecheck, and the generated API contract check.
4. Review the diffs for unintended normalization, weakened URL validation, or unrelated files.
5. Commit backend and frontend changes separately with narrow messages.

## Task 5: Deploy and prove the staging outcome

**Files:** None unless deployment exposes a directly related configuration error.

1. Deploy the backend with `/Users/johan/dev/lb-backend/scripts/deploy-stage.sh` from a clean worktree at the committed backend revision, preserving unrelated dirty files in the main backend checkout.
2. Deploy the frontend with `/Users/johan/.codex/worktrees/8c5c/littb/scripts/deploy-stage.sh`.
3. Request the five previously failing reader URLs and the SLA article URL and require successful responses.
4. Rerun the staging spider while excluding WordPress-owned routes such as `/ljudochbild`.
5. Inspect Grafana/Loki for the crawl window and require no recurrence of the six fixed fingerprints. Record any genuinely new application failure separately rather than hiding it.

