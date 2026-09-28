# Dramawebben production / Stage parity — 28 September 2026

This is a first-pass browser audit, not launch sign-off.

## Confirmed failure and fix

From `/dramawebben`, clicking **Pjäser** on Stage displayed the global not-found page. Direct navigation to `/dramawebben/pj%C3%A4ser` worked. The shared shell used an unencoded path for its NuxtLink; the encoded static route was bypassed during client-side navigation. Commit `a924f131` encodes the link and adds both fixture regression coverage and a live deployment smoke assertion that opens the catalogue.

The regression traverses landing → catalogue → Mer läsning → catalogue. The local browser also opened Abu Casems tofflor [1908] in the facsimile reader with `#dw` preserved.

## Browser observations

| Check | Result |
| --- | --- |
| Complete play-title list | All 462 titles match production, in the same order. |
| Text filter `strindberg` | 69 plays on both sites. |
| Clear filters | Stage returns to 462 plays and removes query filters. |
| Mer läsning | Managed content loads locally against live content, including essay links. |
| Information-only entry Cendrillon | Stage opens source information, synopsis, role counts, cast and criticism. |
| Facsimile handoff | Local fixed frontend opens Abu Casems tofflor with Dramawebben reader controls. |

## Open discrepancies — not resolved by the link fix

- `/dramawebben/pj%C3%A4ser?filterTxt=strindberg&number_of_acts=1,1` displayed 17 plays on Stage and zero on production. Stage's range was selected through its slider, then the same query was opened on production. Determine whether this is a production deep-link defect or a semantic/data difference before choosing an expected result. Do not copy an apparent production bug without checking the underlying metadata.
- Some Stage author cells contain additional contributors: **Anders nya mössa** lists Anna Wahlenberg and Aina Stenberg-Masolle on Stage, while production lists Anna Wahlenberg. The new catalogue API supplies both in `authors`; inspect contributor-role projection in the backend. This may affect author and gender filters even when the title list matches.

## Remaining launch checks

- Compare author, gender, media, children's-play and all six numeric filters, separately and in combinations, including copied URLs and back/forward restoration.
- Compare author catalogue entries, mixed-contributor works, PDF handoff, source-info history, etext and facsimile reader searches, and the Dramawebben-restricted full-text search.
- Compare Om and Mer läsning text/link targets and legacy Dramawebben redirects; verify mobile navigation.
- Extend the same production-link corpus to the main library: complex filters, sort/pagination, reader hit navigation and search-return state. Use real production examples alongside fixtures.

## Validation boundary

The targeted fixture navigation regression passed. Lint and diff checks passed. Its first two attempts timed out waiting for `networkidle` in the existing warmup; the warmup now waits for DOM content and the expected visible catalogue rows instead. Live deployment verification is reported separately with the deployment receipt.

## Stage deployment verification

- Public frontend: `a924f131b3a1fbfc2a5e4c49152852a3e79f970a`.
- Image: `sha256:17af18ea66e588377605587386ee338e68e069ffe4b921fd79f440cf2f1f9dfa`.
- Guarded deployment completed; all 19 live smoke checks passed, including the new landing → catalogue assertion.
- Infrastructure manifest receipt: `265294e6e621251d9420727e49a15ac10d50b421`; only the frontend component changed.
- Post-deployment browser: clicking Pjäser opened the catalogue with 462 data rows.
