# Shared mobile navigation baselines

These screenshots cover the responsive site header and library layout introduced
in September 2026. The mobile Playwright project uses this directory; desktop
screenshots and the original Angular reference images remain in `../baselines`.

The header uses Headless UI Popover with a static navigation panel: mobile CSS
hides the closed panel while desktop CSS keeps the sidebar navigation visible.
The site-navigation behavior suite checks keyboard opening, Escape and focus
return, outside clicks, route changes, quick search, breakpoint changes, and
reader focus mode across the main page types.

Wide reader pages scroll inside `#mainview` on mobile so they cannot expand the
navigation viewport. Reading controls remain outside that horizontal scroll area.
Font readiness is checked again when the authority stylesheet loads, including
when the collapsed navigation does not itself trigger font loading.
