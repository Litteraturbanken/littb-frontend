# Author Works Title Identity Design

## Problem

The author-works response validator rejects valid Reader actions when the API's
`title_path` identifies a nested work part, such as `Book/Part`, while the
Reader URL correctly uses the work's `title_id`, such as `Book`.

Existing fixtures make `title_id` and `title_path` equal, so unit and browser
regressions do not exercise the production contract. The staging smoke suite
also omits the author works route.

## Design

Pass both identities into action validation. Validate `etext` and `faksimil`
Reader URL title segments against `title_id`. Continue validating an
`infopost` action's `titlepath` query against `title_path`. Keep all existing
URL parsing, route-segment, media-type, query, fragment, and internal-link
checks unchanged.

Add a production-shaped fixture item whose `title_id` is `AbuCasemsTofflor`
and whose `title_path` is `AbuCasemsTofflor/AbuCasemsTofflor`. Unit coverage
must reject a Reader URL whose title segment does not match `title_id`. The
author-works browser/SSR coverage must render the composite-path item. Add the
exact Strindberg works route to the live staging smoke suite so future stage
deployments exercise the real backend payload.

## Success criteria

- The production-shaped response is accepted and renders.
- Reader URL validation remains fail-closed for wrong author/title/page/media
  and unsafe URL forms.
- Infopost validation remains tied to `title_path`.
- The exact staging page returns 200 and renders Strindberg's works after
  deployment.
