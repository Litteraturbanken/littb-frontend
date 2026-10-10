# Hide empty author works pages

Slack: https://litteraturbanken.slack.com/lists/T18B5J892/F0ACH3G9HBM?record_id=Rec0BQKBMKWF7

Read all six discussion comments through the Slack desktop app. Authors
represented in Ljud & Bild need their author pages even without published works.
The user chose hiding the Verk tab and redirecting direct visits to Introduktion.
This supersedes the earlier explanatory empty-state message.

## Behavior

- Hide Verk when all authored sections are empty, including introduction,
  Dramawebben, Texter om, and document navigation.
- Direct /författare/{author}/titlar visits redirect to the author root with 307;
  client navigation replaces the current history entry. Preserve query parameters.
- Do not redirect on API errors or unavailable data.
- Prevent the API's default /titlar canonical path for authors without intro text
  from redirecting an empty author back to the works page.
- Keep Introduktion active at the root and retain Ljud access for audio authors.

## Verification

Isolated local Nuxt frontend using read-only Stage APIs:
- EggehornY/titlar returns HTTP 307 to EggehornY.
- Browser reaches the introduction, shows Introduktion and Ljud, and omits Verk.
- SnoilskyC introduction retains Verk; clicking it opens the populated works list.
- ESLint on all changed components/composable/pages and Nuxt typecheck passed.

Committed in a feature worktree; not merged or deployed. No data rebuild needed.
