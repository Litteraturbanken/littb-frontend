# Invoke Development Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root Invoke task runner that starts the Nuxt and FastAPI development servers together and exposes repeatable code-generation and verification commands.

**Architecture:** `tasks.py` is orchestration-only. It runs the existing Nuxt package scripts and the backend's Uvicorn entry point, with environment-variable overrides for paths, ports, and module names. The combined development task owns both child processes and terminates them together.

**Tech Stack:** Python 3, Invoke, Yarn, Nuxt, FastAPI/Uvicorn, OpenAPI Typescript codegen.

## Global Constraints

- Preserve existing `package.json` scripts and current visual behavior.
- Default Nuxt port is `3020`.
- Default backend directory is `/Users/johan/dev/lb-backend`.
- Codegen continues to use the existing `nuxt` `api:generate` and `api:check` scripts.
- Backend and Nuxt commands must be independently runnable as well as jointly runnable.

### Task 1: Add the Invoke task runner

**Files:**
- Create: `tasks.py`
- Modify: `requirements-dev.txt` (create if absent)

**Interfaces:**
- Produces `dev`, `dev.backend`, `dev.nuxt`, `codegen`, `codegen.check`, `test`, `typecheck`, and `status` Invoke tasks.
- Consumes `LB_BACKEND_DIR`, `LB_BACKEND_APP`, `LB_BACKEND_HOST`, `LB_BACKEND_PORT`, `NUXT_DIR`, and `NUXT_PORT` environment variables.

- [ ] **Step 1: Add Invoke as a development dependency**

Add `invoke>=2.2,<3` to `requirements-dev.txt` so the task runner is installable without changing runtime dependencies.

- [ ] **Step 2: Implement commands and process lifecycle**

Implement small helpers for repository paths and `Context.run`, a backend task invoking `uvicorn`, a Nuxt task invoking `yarn dev --port`, codegen/check wrappers invoking the existing Nuxt scripts, test/typecheck wrappers, and a combined `dev` task using `ThreadPoolExecutor` with cancellation on failure or Ctrl-C.

- [ ] **Step 3: Verify task discovery and dry-run commands**

Run `python -m invoke --list` and verify all named tasks appear. Run `invoke status` and confirm it reports the configured directories and ports without starting servers.

- [ ] **Step 4: Verify codegen check and typecheck**

Run `invoke codegen.check` and `invoke typecheck` from the repository root; both must exit successfully.

- [ ] **Step 5: Verify combined development startup**

Run `invoke dev` with a short-lived timeout or interrupt after both child processes report startup. Confirm Nuxt is reachable on port 3020 and the backend is reachable on its configured port, then confirm Ctrl-C stops both children.
