---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/app.js","public/components.js","public/styles/tokens.css","public/styles/components.css"]
---

# Start screen

Target: `public/index.html` / `#start-view`. Mode: Persuade, with a returning-user report index. Business owners diagnose friction on existing websites. Launch first; recent reports take precedence over the demo. Code-first, as confirmed by the user.

## Direction contract

THESIS: A launch surface and visual archive of actual website evidence, rather than a category-card marketing page.

OWN-WORLD: Warm paper #f4f1e8, ink #20251d, lime #d1ed73. Editorial serif headings, precise sans-serif controls, ruled section boundaries, large screenshot previews without nested card chrome. Restrained color serves business owners reading in ordinary daylight.

STORY: Understand one measured entry page and one observed journey; enter a URL immediately or recognize a past website by its saved screenshot and reopen its report.

FIRST VIEWPORT: Compact AccessBench masthead; left-aligned expressive headline and one-sentence explanation; full-width labeled URL action with lime submit; readable scope and sharing notice. A substantial Recent reports section follows, actual captures leading each report with site, date, scope/version and status attached. User correction replaces the chosen sketch's text table with screenshot-led previews. Signature interaction: a preview resolves into actual saved evidence without moving its caption or keyboard focus; reduced motion gets the same static result. Empty history explains the journey with a clearly labeled textual example and demo access, never a fake capture.

FORM: Report index, candidate 1 in the second grounded list, second displayed card; seed:5f7db6845b89a161. Reference: `.impeccable/mocks/decision/report-index.html` plus the user's screenshot-led correction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Boundaries

Preserve URL-only start, public non-submitting policy, provider sharing disclosure, auth, legacy report labels, existing saved links, demo selection and report behavior. At most ten recent runs; show loading, empty, missing-image, unavailable-list, long-URL, launch-error and authentication states. Narrow layouts stack naturally; verify 320px and 200% text. Shared frontend tokens may change palette, but the dashboard's structure and all evaluation logic stay intact. No deployment or provider calls are needed to implement this surface.
