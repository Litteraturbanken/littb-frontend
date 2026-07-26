# Dramawebben source-info parity report

## Outcome

- Infopost source information now retains known provenance identity, linked logo,
  and library name even when that media type has no provenance prose.
- Empty provenance prose is not rendered; the linked logo remains visible.
- Licence interpolation uses the retained provenance identity, producing the
  complete Cendrillon attribution to Dramawebben and Litteraturbanken.se without
  a dangling conjunction.
- Typed backend Dramawebben facts now follow the frozen live order, beginning
  with `first_staged_in_sweden` before `first_staged`.
- Opening an infopost modal now owns only `om-boken`, `authorid`, and `titlepath`;
  closing returns to the bare catalogue while retaining `#dw`. Router pushes
  preserve Back/Forward history.

## TDD evidence

- Backend RED: the new complete fact-order test received `first_staged` before
  `first_staged_in_sweden`.
- Frontend unit RED: infopost projection returned no provenance instead of the
  Dramawebben identity.
- Frontend E2E RED: opening from a filtered catalogue retained `visa` and repeated
  `keep` parameters instead of the exact live modal query.
- Frontend SSR RED: Cendrillon initially had no linked provenance logo.

## Verification

- `uv run pytest test_lbapi/v2 -q`: 1377 passed.
- `yarn vitest run --project node-unit test/unit/reader-source-info.spec.ts`: 65 passed.
- Dramawebben SSR suite: 27 passed.
- Dramawebben desktop E2E suite: 21 passed.
- `yarn typecheck`: passed.
- `yarn api:check`: passed; no generated contract change.
- `git diff --check`: passed in both repositories.

The test fixture includes a strict Cendrillon-shaped infopost response and freezes
the exact provenance link/logo, attribution text, fact DOM order, and modal
history behavior.
