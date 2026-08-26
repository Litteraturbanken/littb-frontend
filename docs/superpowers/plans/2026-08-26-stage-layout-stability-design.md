# Stage Layout Stability Design

## Scope

Fix layout shifts that occur in a production Nuxt build and therefore affect Stage. Development-only Vite stylesheet reinjection is explicitly out of scope. The settled visual appearance must remain unchanged.

The audited route matrix covers the start page, Library, EPUB, text search, Presentations, Dramawebben, About, author profile, author works, etext reader, and facsimile reader at 1440x1000 and 390x844.

## Root causes

The authority font stylesheet is already emitted in the server-rendered head. The remaining Stage-relevant shift occurs after that stylesheet loads: Chromium initially lays out Requiem text using Georgia, then reflows it when the embedded Requiem font becomes usable. Georgia is sufficiently wider to make several headings wrap for one frame.

The facsimile reader has a separate mobile shift. Its image has a width attribute but no height, although OCR-backed pages already carry the page's intrinsic width and height. The browser therefore cannot reserve the image's vertical space before decoding it.

## Design

Define metric-adjusted local fallback faces for Requiem Display, Text, and Small Caps in the production CSS path. Insert them into the existing font stacks ahead of Georgia. The authority Requiem faces remain first, so settled rendering is unchanged; the fallback only makes the first layout close enough to the final metrics to avoid line-wrap changes.

For facsimile pages with OCR geometry, compute the selected image height from the OCR aspect ratio and emit both intrinsic width and height on the image and its container. Do not invent a generic page ratio for pages whose source data lacks dimensions.

Add production-build browser regression coverage that measures layout-shift entries and first-frame/final heading geometry on representative affected routes. Keep the existing visual suite as the authority for settled pixels.

## Rejected work

- Do not move additional legacy layout rules merely to improve the Vite dev server.
- Do not hide the page until fonts load; that trades movement for a blank flash.
- Do not extract or rewrite the licensed embedded font payload.
- Do not change approved spacing, typography, wrapping, or responsive layout after fonts and images have loaded.
