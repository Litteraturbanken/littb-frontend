# Nuxt Contact design

## Scope

This slice migrates the Angular Contact page and its mail side effect:

- `/om/kontakt`
- `/kontakt` as a permanent alias to `/om/kontakt`
- a typed `POST /v2/contact` FastAPI operation

The legacy schema-hidden `GET /contact` remains unchanged for the Angular application. No other About route, global search behavior, or deployment configuration changes in this slice.

## Invariants

- This is an architectural migration only. Copy, DOM order, classes, dimensions, validation feedback, status timing, typography, shell geometry, and responsive behavior remain Angular-authority exact.
- The page owns its state and generated-client calls inside `nuxt/app/pages/om/kontakt.vue`; no one-use composable is introduced.
- Contact and newsletter forms are ordinary forms, so Headless UI is not applicable.
- Tests and visual capture must never deliver mail. All delivery calls are replaced at the backend boundary, and the Nuxt fixture server only records submissions.
- Backend-owned environment configuration selects recipients. The public request cannot select test routing or arbitrary recipients.

## Typed API contract

`POST /v2/contact` accepts a JSON body with unknown fields forbidden:

| Field | Type | Rules |
| --- | --- | --- |
| `sender_name` | `string \| null` | optional; surrounding whitespace removed |
| `sender_address` | `string` | required; surrounding whitespace removed; maximum 254 characters; Angular 1.7.9 email grammar |
| `message` | `string` | required; surrounding whitespace removed; non-empty |
| `audience` | `"litteraturbanken" \| "oversattarlexikon"` | required |

The email validator deliberately matches Angular 1.7.9 rather than using `EmailStr`; for example, `a@b` remains valid. OpenAPI still publishes the string with `format: email`.

Accepted delivery returns HTTP 202 with `{"status":"accepted"}`. Validation uses the existing typed 422 envelope. A delivery-provider failure returns the generic typed 502 error `contact_delivery_failed`; unexpected failures retain the generic typed 500 envelope. Provider response data and exception text never cross the API boundary.

## Delivery and routing

The new `lbapi/v2/contact.py` owns pure message construction, recipient selection, and the sole Resend call for this operation. The endpoint is synchronous so FastAPI runs the blocking SDK outside the event loop.

Live recipients are selected only when `DEPLOYMENT_ENV` or `LB_ENV` is exactly `red`:

- Litteraturbanken: `info@litteraturbanken.se`
- Översättarlexikon: `nils@oversattarlexikon.se`

Every other value, including unset, development, and stage, uses the existing test recipients and test subject. Test routing takes precedence over audience. Existing subjects, `RESEND_FROM_EMAIL` fallback, reply-to behavior, sender signature, and recipient addresses remain byte-for-byte equivalent to the legacy operation.

## Page behavior

`nuxt/app/pages/om/kontakt.vue` renders inside `AboutPageShell` with only Kontakt active. It preserves the exact Angular template copy and metadata:

- title: `Om LB | Litteraturbanken`
- description: `Litteraturbankens kontaktforumlär och utskicksanmälan.`

Text fields use trimmed models. Name is optional; email and message are required. The submit buttons stay disabled until their form is dirty and valid. Validation messages appear only after the invalid field has been edited and loses focus, matching `.ng-dirty.ng-invalid:not(:focus)`. The initial SOL message does not make the form dirty.

The initial query is captured once, matching Angular's non-reloading query behavior:

- `?sol` prefills `[Ang. Översättarlexikon]\n\n` and submits with audience `oversattarlexikon`.
- `?skola` prefixes the submitted contact message with `[skola] `.
- both flags compose.

Honoring the SOL audience is an intentional repair of an Angular controller typo: Angular computes `isSOL` but sends the never-assigned `this._isSOL`. The visible page remains unchanged.

Contact submission displays the existing Font Awesome 4.4.0 pulse spinner. Success or error hides both forms and displays the exact authority message for four seconds. Contact success then clears name, email, and message. Newsletter success uses sender name `Utskickslista`, sends `<address> vill bli tillagd på utskickslistan.` to the Litteraturbanken audience, clears the contact fields after four seconds, and retains the newsletter address. Failure retains all entered values. The DOM remains mounted during status display, as with Angular `ng-show`/`ng-hide`.

The legacy 400px content width and 390px textarea are retained even at mobile width. No visual cleanup is part of this migration.

`/kontakt` returns HTTP 308 and preserves query and browser fragment.

## Standalone assets

The Nuxt package declares the exact `font-awesome` 4.4.0 dependency and imports its CSS before the migrated styles. This keeps the spinner visible when Nuxt is installed or built independently of the Angular root package.

## Verification

- Backend model, delivery, routing, OpenAPI, and error tests monkeypatch the provider boundary and prove no live call occurs.
- The checked-in OpenAPI snapshot regenerates the Nuxt client; generated types are the only frontend payload authority.
- The fixture API records Contact POST bodies separately, can defer or fail a submission, and supports deterministic test cleanup.
- SSR proves the page renders without submitting and the alias preserves state.
- Browser tests cover validation, dirty/blur behavior, pending state, success/error timing, SOL/skola composition, newsletter semantics, and captured payloads.
- Angular authority capture and Nuxt comparison cover the initial page at desktop and mobile widths. Structural assertions cover transient spinner and status states.
- Full backend, Nuxt, and unchanged Angular regression gates close the slice.
