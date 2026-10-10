# Author introduction quotation styling

Slack issue: [<blockquote> har ingen maxbredd](https://litteraturbanken.slack.com/lists/T18B5J892/F0ACH3G9HBM?record_id=Rec0C2A4DSJ66)

Read the List description and its discussion in the Slack desktop app. The requested styling is `max-width: 400px; line-height: 1.4; font-size: .85em`. The discussion agrees that the current layout needs correcting. This concerns website author introductions, not EPUB.

## Reproduction and fix

On https://red.litteraturbanken.se/författare/EnckellR the introduction's blockquote has computed `max-width: none`, `font-size: 16px`, and `line-height: 19.2px` at a 20px base font. The source includes twelve explicit poetry line breaks.

Apply the requested values only to author-introduction blockquotes. Update the legacy stylesheet and the active Nuxt stylesheet. Nuxt needs a selector independent of the legacy `#mainview` wrapper, which is absent in its author component. Reader and EPUB styling are unchanged.

## Verification (2026-10-10)

Ran the feature-worktree Nuxt preview against red's read-only author/content APIs and inspected the actual Enckell introduction in the browser:

- Computed maximum width: **400px**.
- Computed font size: **17px** (0.85 × 20px).
- Computed line height: **23.8px** (1.4 × 17px).
- At the narrow browser viewport: rendered width **274.5px**, fitting the available width.
- At a 1280px desktop test viewport: rendered width **400px**.
- All **12 explicit line breaks** remain in the quotation.
- Nuxt compiled the stylesheet successfully; `git diff --check` passes.

The legacy rule has the same declarations but was not independently browser-tested in the Angular application. No deployment, Slack status change, or Slack comment was made.

## Swedish handoff draft

Blockcitat i författarintroduktionerna har fått maxbredd 400 px, radavstånd 1,4 och textstorlek 0,85 em enligt förslaget. Ändringen är avgränsad till introduktionerna och finns i både Nuxt- och legacy-stilmallarna. Kontrollerat i lokal Nuxt med Rabbe Enckells introduktion: bredden begränsas korrekt och diktens radbrytningar finns kvar. Fixen ligger i separat worktree och är inte driftsatt.
