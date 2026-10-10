# Explain empty author works pages

Slack: https://litteraturbanken.slack.com/lists/T18B5J892/F0ACH3G9HBM?record_id=Rec0BQKBMKWF7

Read all six discussion comments in the Slack desktop app. Authors represented
in Ljud & Bild still need their author pages even when they have no published
works. The report explicitly proposes either removing the Verk link or showing
an explanatory message; this fix takes the latter option.

## Reproduction and change

Stage's `/författare/EggehornY/titlar` displayed the author navigation and
encyclopedia links but no works and no explanation. When every authored section
is empty, the Nuxt works page now displays:

> Författaren har inga verk publicerade hos Litteraturbanken.

Introduction and Ljud links remain available. Nonempty sections and the separate
Texter om page retain their existing behavior.

## Verification

Playwright against an isolated local Nuxt server using read-only Stage APIs:
- EggehornY: message visible, introduction and audio links retained.
- SnoilskyC: normal populated works list, no empty-state message.
- ESLint on the changed component passed.

Prepared in a feature worktree; not merged or deployed. No data rebuild needed.
