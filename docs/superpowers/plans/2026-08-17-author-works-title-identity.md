# Author Works Title Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept valid production author-work Reader links when `title_path` is composite, without weakening URL validation.

**Architecture:** Keep the existing response validator as the security boundary. Supply both API identities to action validation, using `title_id` for Reader routes and `title_path` for infopost query routes, then cover the production distinction in fixtures and live smoke tests.

**Tech Stack:** Nuxt 4, TypeScript, Vitest, Playwright, Nomad staging deployment.

## Global Constraints

- Preserve every existing URL-safety and exact-shape check.
- Do not make `title_path` a valid Reader route segment when it contains `/`.
- Add a staging check for `/författare/StrindbergA/titlar`.

---

### Task 1: Encode and fix the title identity contract

**Files:**
- Modify: `nuxt/test/fixtures/author-works-data.mjs`
- Modify: `nuxt/test/unit/author-works.spec.ts`
- Modify: `nuxt/app/lib/author-works.ts`
- Modify: relevant author-works SSR/browser test if fixture rendering needs an explicit assertion

**Interfaces:**
- Consumes: `AuthorWork.title_id`, `AuthorWork.title_path`, and existing action URL validators.
- Produces: `isAuthorWorksResponse(value)` accepting composite `title_path` Reader items only when the Reader URL matches `title_id`.

- [ ] Add a fixture/test where `title_id` is `AbuCasemsTofflor`, `title_path` is `AbuCasemsTofflor/AbuCasemsTofflor`, and the Reader URL uses `AbuCasemsTofflor`.
- [ ] Run the focused unit test and verify it fails because the response is rejected.
- [ ] Pass both identities through `isWork` → `isAction`; compare Reader URLs with `title_id` and infopost URLs with `title_path`.
- [ ] Run focused unit, author-works SSR, and author-works browser tests and verify they pass.
- [ ] Add the exact stage route to live smoke coverage and verify that test is capable of failing against the currently broken stage.

### Task 2: Verify and deploy

**Files:**
- Modify: the established live-stage Playwright spec only if Task 1 did not already do so.

**Interfaces:**
- Consumes: committed frontend image and staging Nomad deployment script.
- Produces: a healthy staging author-works page backed by the real API response.

- [ ] Run lint, typecheck, maintainability, build, affected unit/SSR/browser suites, and diff checks.
- [ ] Commit and push the exact source/test change.
- [ ] Deploy that commit to staging with the existing secure Nomad-token workflow.
- [ ] Run the exact live stage regression and confirm the page returns 200 and renders works.
