# Reader missing-page copy implementation report

Date: 2026-07-26

## Scope

Restored the legacy work-specific copy for direct invalid normal Reader pages while preserving the Nuxt HTTP error boundary:

- e-text and faksimil Reader page misses remain HTTP 404;
- the global error renderer shows `Hittar ingen sida '<page>' i verket.` only for a strict Reader-owned error marker;
- generic route 404s keep the existing Swedish address-not-found copy;
- malformed/upstream Reader failures keep the generic 502 copy;
- hydrated client page-fetch failures keep `Läsarsidan kunde inte hämtas.`;
- the 404 document title remains `Sidan kan inte hittas | Litteraturbanken`.

## Boundary and safety

The Reader page creates the marker itself only after its typed Reader request returns 404. The payload accepts a non-empty page name up to 160 UTF-16 code units and rejects control characters. The renderer revalidates the exact payload shape and uses Vue text interpolation, so page names containing encoded quotes, ampersands, or apparent HTML are escaped rather than interpreted.

## Verification

- Focused helper unit tests: 3 passed.
- Focused SSR/browser/error-boundary set: 7 passed.
- Nuxt typecheck: passed.
- Broad Reader SSR, routing-error SSR, and desktop Reader E2E: 203 passed, 1 unrelated stale assertion failed. The stale test expects a faksimil search-shaped route to issue no hit request, while the current parity implementation correctly requests `media_type=faksimil` to provide restored faksimil hit navigation.
