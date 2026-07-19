# Nuxt Author Profile Audio Link Design

## Goal

Restore the AngularJS `Ljud` navigation item on ordinary and Dramawebben author profile pages without changing the established author-page layout.

## Authority and constraints

- Angular authority is `app/views/authorInfo.html`, where `Ljud` appears after `Verk` and before `Dramawebben` when the author has an audio page.
- FastAPI already has the authoritative `query_optional_author_audio_url()` provider and exposes `audio_url` on author works and author-document DTOs, but not yet on `AuthorProfile`. This corridor adds the same nullable typed field to `AuthorProfile`; the frontend must not derive availability or synthesize a URL from the author identifier.
- Preserve current visual geometry, classes, copy, and whitespace. This is an architectural parity change, not a redesign.
- Keep the profile page SSR-rendered and hydration-stable.
- External audio links open in a new tab with `noopener noreferrer`, matching the hardened Nuxt author-document and author-works implementations.
- Omit the item completely when `audio_url` is null.

## Approaches considered

1. **Project `audio_url` through `AuthorProfileView` (selected).** This keeps backend truth authoritative and follows the existing `AuthorWorksContent` and supplemental-document patterns.
2. **Derive the link from `author_id`.** Rejected because an identifier does not prove that the external audio page exists.
3. **Refactor all author navigation into a shared component first.** Rejected for this corridor because it broadens the change and risks shifting established whitespace and visual geometry.

## Data flow

`transform_author_profile()` asks the existing audio provider for the normalized author identifier and returns its nullable result as `AuthorProfile.audio_url`. The OpenAPI document and generated Nuxt client are refreshed from that model. `createAuthorProfileView()` copies the typed nullable field into a normalized view string, and `AuthorProfileContent.vue` renders the link only when that string is non-empty. Ordinary and Dramawebben profiles use the same view and therefore receive identical availability and ordering behavior.

No new composable or client fetch is introduced. The page-level profile request remains the sole data owner, and the audio-provider failure contract remains nullable as in the existing author works and document endpoints.

## Rendering and accessibility

The new list item sits between `Verk` and `Dramawebben`, with the same inter-item whitespace strategy already used by the component. The anchor copy is exactly `Ljud`; it uses `target="_blank"` and `rel="noopener noreferrer"`. The existing `Författarsidor` navigation label remains unchanged.

## Validation and errors

The FastAPI response model becomes the trust boundary for `audio_url`. The view uses an empty string for null. This corridor does not add client-side URL synthesis, fallback behavior, or a second frontend network request.

## Verification

- Backend model, transform, API, and OpenAPI tests prove `audio_url` projection for present, absent, and provider-failure values.
- Generated-client drift checking proves Nuxt consumes the typed backend contract.
- Frontend unit tests prove `audio_url` projection for present and absent values.
- SSR tests prove exact navigation order, target/rel attributes, and omission for an author without audio.
- Browser behavior tests prove the link remains present after hydration on ordinary and Dramawebben variants without warnings.
- Existing Angular and Nuxt author-profile visual captures are compared at desktop and mobile; any baseline update requires a fresh Angular authority capture.
- Nuxt typecheck and `git diff --check` must pass.

## Scope boundary

This design does not add the author-ID clipboard shortcut, footnote popovers, or `/biblinfo`; those are separate migration corridors with their own designs and tests.
