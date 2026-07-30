# Staging crawl compatibility fixes

## Context

The bounded staging crawl exposed six real page failures. Five reader pages fail
while the FastAPI v2 adapter converts legacy search records into the strict
Reader manifest contract. One Selma Lagerlöf article fails because Nuxt rejects
a nullable field that the generated backend contract permits.

The same reader failure appears three times in observability: the FastAPI 500,
the Nuxt reader endpoint's 502, and the outer SSR request's 502. The article
failure appears twice at the two Nuxt layers. The implementation must fix the
root records without weakening unrelated route, size, or HTML-safety checks.

## Considered approaches

1. Normalize legacy data at the FastAPI v2 transformation boundary
   (recommended). This leaves the source index untouched, keeps output models
   strict, and gives every typed consumer consistent values.
2. Rewrite the affected OpenSearch records. This would correct today's five
   records but would not protect the typed API from equivalent legacy records.
3. Add title-specific exceptions in FastAPI or Nuxt. This is brittle and makes
   compatibility depend on a growing list of work IDs.

## Backend design

Human-facing manifest text is normalized before strict model validation:

- trim leading and trailing whitespace;
- collapse runs of whitespace, including embedded newlines, to one space;
- continue rejecting non-whitespace control characters and unsafe Unicode;
- keep route segments and identifiers strict and unmodified.

Contributor identity is the tuple of `author_id`, `author_type`, and `role`.
Exact duplicate tuples remain invalid, but the same person may occur once as
editor and once as translator. The first contributor must still match the
manifest author.

Regression tests cover trailing display titles, trailing part titles, embedded
newlines, multi-role contributors, exact duplicate contributors, and strict
identifier handling.

## Frontend design

The SLA article descriptor validator accepts `audio_url` when it is either
`null` or the one canonical Ljud & bild URL. Any other value remains invalid.
This aligns runtime validation with the generated nullable backend type without
changing source-path, author, article-ID, sanitization, or response-size checks.

Unit and SSR tests cover the nullable descriptor and retain rejection tests for
untrusted URLs.

## Verification and rollout

Run focused regression suites first, then the repositories' lint, type, and
relevant full test commands. Deploy the backend with its existing staging
script, deploy the Nuxt staging job through the existing invoke target, and
request all six failing pages again. Completion requires successful responses,
no new matching errors in OpenSearch/Grafana, healthy Vector delivery, and
healthy staging allocations.
