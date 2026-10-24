# AccessBench

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Business owners and small teams who need to diagnose friction on an existing website. This is the primary use case, confirmed on 2026-10-24. They need plain-language explanations of observed problems and practical next steps, with technical evidence available on demand.

## Product Purpose

Help businesses understand how well a website attracts, serves, and supports customers through entry-page measurements, one observed customer journey, and actionable AI recommendations. Success means the user understands the tested scope, the main evidenced problems, and what to improve next.

## Positioning

AccessBench is an AI experience lab for a website. Its distinctive mechanism combines actual browser actions and captured evidence with automated page measurements and qualitative AI interpretation. The user can follow what was attempted, what happened, and which outcomes were independently verified. This is bounded observation, not human user research or conversion analytics.

## Operating Context

- Start with a public website URL; no user-entered journey or goal is required.
- Follow one automatically selected journey through actual browser captures and a textual action trail.
- Inspect the resulting report, open evidence and issue details, revisit saved runs, or download JSON. Cancelled and interrupted runs preserve available evidence.
- Continue with the local Node runner; deployment remains deferred. The existing frontend uses vanilla HTML, CSS, and JavaScript with shared tokens and presentation components. No framework migration is part of the overhaul.
- Product scope is owned by [docs/mvp.md](docs/mvp.md); implementation evidence and remaining acceptance work by [docs/status.md](docs/status.md). [docs/design.md](docs/design.md) owns interface direction and wording. Keep these authorities intact rather than duplicating their detailed rules here.

## Capabilities and Constraints

- Five report categories: Accessibility; Design & UX; SEO; Performance; Functionality.
- Google PageSpeed Insights supplies Lighthouse Accessibility, SEO, and Performance scores. Lighthouse Best Practices is supporting diagnostics, not a sixth category or a Functionality score.
- Twinly's computer-use API selects one journey; Playwright executes permitted actions, records screenshots, and independently verifies observable outcomes. Same-origin exploration is limited to at most three selected states including the initial state. Current journey selection is bounded; multi-hop objective discovery remains limited.
- Gemma 4 through Google's Gemini API provides qualitative Design & UX assessment and evidence-linked recommendations. Design & UX has no numeric score. AI prose cannot alter measurements or confirm a functional outcome.
- Overall health combines four numeric categories under [docs/scoring.md](docs/scoring.md). Missing sources, unverified outcomes, and provisional scores remain visible. Failure, timeout, and untested steps never become passes.
- Public evaluations are non-submitting. URL entry does not authorize purchases, account changes, or production form submissions. Explicit test-environment authorization stays server-side.
- Keep site content untrusted, keys server-side, audited HTML escaped, and browser/network guards intact; detailed restrictions belong to [docs/architecture.md](docs/architecture.md).
- Preserve legacy accessibility reports with their original version, labels, scoring, and retests. New website-health comparisons are deferred.
- Accounts, billing, authenticated journeys, comprehensive crawling, scheduled monitoring, automatic code modification, keyword research, backlink analysis, conversion analytics, and security penetration testing are outside this MVP.

## Brand Commitments

Keep **AccessBench** as the product and code name. Use direct, approachable language about discovery, friction, evidence, and practical improvements. Explain customer impact before technical audit details. The accepted experience-lab direction is recorded in [docs/design.md](docs/design.md); visual recipes belong there.

Do not claim WCAG certification, percent accessible, full screen-reader compatibility, guaranteed rankings, increased conversions, or comprehensive website correctness.

## Evidence on Hand

- The local v2 evaluation pipeline and dashboard are implemented. PageSpeed, Twinly, and Gemma 4 have succeeded live in one combined public evaluation; recorded run IDs, timings, actual outcomes, and commands are in [docs/status.md](docs/status.md).
- That combined public run remains provisional because one journey outcome is unresolved. Integration success is separate from journey completion.
- Actual reports, provider artifacts, screenshots, and events are private under ignored `.accessbench/`; do not publish them as marketing assets without appropriate authorization.
- Local broken/fixed fixtures support controlled demonstrations. Hosted PageSpeed cannot measure local fixtures. A suitable public controlled target and two integrated demo rehearsals remain acceptance work.
- The visual overhaul is accepted direction awaiting implementation. Do not present mockups, illustrative values, or saved captures as fresh run evidence, customer testimonials, or proof of whole-site quality.

## Product Principles

1. Make the observed customer journey understandable and traceable to actual browser evidence.
2. Preserve the distinction between measured facts, verified outcomes, unresolved checks, and AI suggestions.
3. Give business users practical next steps while keeping source details accessible.
4. Retain useful partial results and explain uncertainty honestly.
5. Keep public exploration bounded and non-submitting.

## Accessibility & Inclusion

AccessBench's own interface must support keyboard operation, visible focus, semantic landmarks and headings, labeled inputs, associated errors, accessible issue details with focus restoration, and polite announcements of meaningful status changes. Provide textual equivalents for visual evidence, respect reduced motion, and never rely on color alone. Verify the actual interface with axe and manual keyboard checks, at 320 CSS pixels and 200% text enlargement; automated checks alone are insufficient.
