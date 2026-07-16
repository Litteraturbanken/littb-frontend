# Nuxt global Quick Search design

## Scope

This slice ports the global `Snabbsökning` entry that is currently inert in the Nuxt shell. It adds:

- a typed, display-ready `GET /v2/quick-search?query=...` FastAPI operation;
- a reusable global `QuickSearch.vue` component mounted once by the default layout;
- the ordinary production search, correction, local-page command, keyboard, mouse, and modal behavior;
- desktop/mobile Angular visual authority for the empty and populated dialog.

Reader-, author-, and editor-context development commands (`/id`, `/editor`, `/info`, LB-id editor/FTP actions) are excluded. They currently scrape Angular scopes and must wait for explicit Nuxt page-context contracts in their own migration slices. Quick-search analytics is also deferred while this remains local-only; Nuxt does not call the hidden legacy logging endpoint.

## Invariants

- This is an architectural migration only. Trigger copy, input copy, rows, labels, order, modal geometry, blur/backdrop, typography, keyboard flow, and responsive behavior remain Angular-authority exact.
- No Angular scope bridge, iframe, or compatibility runtime is introduced.
- The reusable component owns its query, debounce, request, modal, focus, and selection state. No composable is needed.
- FastAPI returns public display data, not irregular Elasticsearch documents.
- The legacy `/autocomplete/{search_string}` operation and Angular source remain unchanged.
- Production Nuxt consumes only the generated v2 client. Test fixtures never query production search.

## Typed API contract

`GET /v2/quick-search` requires a trimmed `query` of 1–200 characters and returns:

```json
{
  "items": [
    {
      "kind": "author",
      "label": "Strindberg, August (1849-1912)",
      "url": "/författare/StrindbergA",
      "type_label": "Författare",
      "media_type_label": null
    }
  ],
  "correction": null
}
```

`QuickSearchItem.kind` is `author | work | part`; `type_label` is `Författare | Verk | Del`; `media_type_label` is `etext | faksimil | null`. All models forbid unknown fields.

The synchronous route calls the blocking legacy autocomplete query in FastAPI's thread pool. A pure transformer preserves source ordering and exact Angular display/route rules:

- audio results are removed;
- works use `work_titleid || titleid`, the work-author fallback for their route, the first displayed author surname, `shorttitle || title`, `startpagename`, and source media type;
- parts use their work author/title, `startpagename`, representation media type, author fallback, and `shorttitle || title`;
- authors use `name_for_index`, `/författare/<authorid>`, and the existing year grammar: `birth-death`, `f. birth`, `d. death`, or no suffix, with missing/`0000` ignored;
- only the first provider correction is exposed.

Malformed source documents fail generically rather than leaking backend fields. Validation uses the typed 422 envelope, unexpected transformation failures use 500, and OpenSearch failures use typed 503 `quick_search_unavailable`. Provider details never cross the API boundary.

## Local commands and result composition

The component owns the ordinary static commands in their Angular order and exact copy/targets:

1. Start — `/`
2. Bibliotek — `/bibliotek`
3. Epub — `/epub`
4. Ljud och bild — `/ljudochbild`
5. Sök (`Sok` alias) — `/sok`
6. Presentationer — `/presentationer`
7. Dramawebben — `/dramawebben`
8. Nytillkommet — `/bibliotek?sort=nytillkommet`
9. Skolan — `/skolan`
10. Skolan/lyrik — `/skolan/lyrik`
11. Om — `/om/ide`
12. Hjälp (`hjalp` alias) — `/om/hjalp`
13. Kontakt — `/om/kontakt`
14. Statistik — `/om/statistik`
15. Läshistorik — `/historik`

Commands use case-insensitive prefix matching over label and aliases. `startsWith` intentionally replaces Angular's unescaped dynamic regular expression so metacharacter input cannot crash the UI; visible matching semantics remain the intended prefix behavior.

For a non-slash query, remote rows come first and matching commands are appended. A correction becomes a `Menade du` row that replaces the input and reruns search without closing. If the backend has neither items nor a correction, the list begins with the visually unchanged, disabled `Inga träffar.` row before any matching command. A query beginning `/` never calls the API and returns only supported local slash commands; because context-only development commands are deferred, this slice returns an empty list for ordinary slash input.

## Component and interaction behavior

`nuxt/app/components/global/QuickSearch.vue` uses the exact `@headlessui/vue` 1.7.23 `Dialog` and `Combobox` primitives. It is mounted once in `nuxt/app/layouts/default.vue`. The inactive shell entry becomes a semantic button styled exactly as the old main-navigation link.

Opening:

- click `Snabbsökning`, or press lowercase `s` while no input, textarea, or select has focus;
- render the modal only in the browser and perform no SSR request;
- add `modal-open` to `<body>`, autofocus the input, and restore focus to the trigger on close;
- preserve the exact placeholder and autocomplete/autocorrect/autocapitalize/spellcheck attributes.

Searching:

- wait 200 ms after input;
- abort the previous request and ignore stale completions;
- keep matching local commands available if the API fails;
- select the first selectable row, wrap with Up/Down, and select with Enter, Tab, or click;
- hover activates a row;
- selecting a result closes and uses `navigateTo` for its exact URL;
- selecting a correction updates the query and keeps the dialog open.

Escape preserves the Angular typeahead sequence: with the options list open, the first Escape dismisses the list; a later Escape closes the dialog. With no open list, Escape closes immediately. Clicking the backdrop closes. Closing clears query/results and cancels pending work. The footer keeps its exact copy and `/bibliotek` link behavior.

## Styling

The component emits the Bootstrap/Angular hooks already owned by Nuxt: `modal autocomplete fade in`, `modal-backdrop`, `modal-dialog modal-sm`, `modal-content`, `modal-body`, `dropdown-menu`, active row, `type_label`, and `footer`. Narrow glue for the semantic trigger and Headless UI state belongs in `nuxt/app/assets/styles/nuxt.scss`; the byte-locked migrated `styles.scss` remains unchanged.

Desktop authority includes the 700px dialog at 768px and above, white modal chrome/shadow, 94% result list, compact rows, red small-caps type labels, centered gray footer, translucent white backdrop, and 4px blur on the three shell corridors.

Mobile authority keeps the fixed modal at 20px with 3% side gutters, dark body, hidden shell/header/backdrop behavior, native field geometry, and existing modal padding. No responsive redesign is permitted.

## Verification

- Backend model/transformer tests cover every kind, field fallback, author-year form, audio filtering, correction/no-hit, LB-id results, malformed documents, 422, 500, and 503.
- The canonical OpenAPI snapshot regenerates the sole frontend payload authority.
- The local fixture server provides deterministic typed results, delay/latest-response and failure controls, plus request/reset ledgers.
- SSR proves the global component submits no query.
- Browser tests cover trigger click and `s`, focused-control suppression, exact debounce/latest-wins, local/slash no-network behavior, correction, disabled no-hit, API failure plus commands, keyboard/mouse selection, Escape sequence, backdrop/footer close, focus restoration, and clear/reopen.
- Test-only Angular raw fixtures and Nuxt typed fixtures drive empty and populated desktop/mobile authority captures. No production autocomplete/log endpoint is contacted during capture.
- Full backend, Nuxt, unchanged Angular, generated-client, and visual gates close the slice.
