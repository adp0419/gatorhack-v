# Website evaluation MVP

Owner of scope and accepted product decisions. Implementation progress is in [status.md](status.md); evaluation mechanics in [checks.md](checks.md); numerical policy in [scoring.md](scoring.md).

## Thesis

**AccessBench helps businesses understand how well a website attracts, serves, and supports customers through automated measurements, one observed customer journey, and actionable AI recommendations.**

The primary audience is business owners and small teams. Reports explain problems and practical improvements in plain language, with technical evidence available on demand. Accessibility remains one of five categories. The two-builder, 48-hour hackathon remains a planning constraint; this pivot is a reprioritization, not proof that the expanded MVP already exists or fits the remaining time.

## Accepted decisions

The user's updated direction and follow-up answers on 2026-10-23 supersede the accessibility-only product contract.

The subsequent model choice is **Gemma 4 via Google's Gemini API**, replacing the earlier Gemini-model default. The qualitative role and evidence/score boundaries remain the same. Default hosted model: `gemma-4-26b-a4b-it`; environment names remain `GEMINI_API_KEY` and `GEMINI_MODEL` because the transport is Google's Gemini API.

| Area | Decision |
|---|---|
| Categories | Accessibility; Design & UX; SEO; Performance; Functionality |
| Automated source | Lighthouse through Google's PageSpeed Insights API |
| Lighthouse mapping | Accessibility, SEO, and Performance supply their corresponding numeric scores; Best Practices supplies supporting diagnostics |
| Journey | One automatically selected customer journey per website evaluation; no goal-entry UI |
| Navigation | Twinly computer-use decisions executed by Playwright; same-origin, maximum three selected states including initial |
| Design & UX | Gemma 4 qualitative assessment only; no numeric design score |
| Recommendations | Gemma 4 interprets evidence and suggests improvements, keeping observations and hypotheses separate |
| Overall score | Four numeric categories; Design & UX remains visible and excluded from numeric scoring |
| Public-site behavior | Non-submitting checks; stop before purchases, sending forms, account changes, and other committing actions |
| Evidence | Actual screenshots/action trail; independently verified journey outcomes; source attribution |
| Runtime | Local Node first; deployment deferred under the existing user direction |
| Branding | Keep AccessBench as the existing product and code name; “Access Bench” in the brief refers to the same product |

Device profiles, score weights, budgets, and assertion details in owner documents are engineering defaults, not additional user promises.

## Core experience

1. Paste a public URL and start an evaluation. Explain the bounded scope and non-submitting behavior next to the input.
2. Collect a Lighthouse report for the entry page. Twinly chooses one relevant customer journey, such as finding a service and reaching its inquiry form, and navigates the real browser.
3. Watch real action screenshots, progress, and a textual trail. The chosen goal and safe endpoint are visible.
4. Receive an overall health score, five category sections, journey outcome, prioritized issues, and suggested improvements. Design & UX is a qualitative section; the other four categories can have numeric scores.
5. Open an issue for evidence, source, observed behavior, and a practical remedy. Reopen the saved report or download its JSON.

## Must ship

- One local end-to-end run using actual PageSpeed Insights, Twinly computer use, and Gemma 4 responses. Each integration needs a successful recorded live call; a mock is insufficient.
- Entry-page Lighthouse Accessibility, SEO, Performance, and Best Practices results, preserving source and configuration.
- Exactly one selected journey, with independently checked outcomes and an honest completed/blocked/partial/unavailable result. A safe endpoint is stated before execution; sending or purchasing is never implied by reaching a form or checkout.
- Qualitative Gemma 4 design review and evidence-linked recommendations across available sources. Keep measured facts and AI suggestions distinct.
- Five-category dashboard, versioned four-category health scoring, visible score availability and limitations, issue details, live frames/trail, cancellation, persistence, and graceful provider failure.
- Keep the interface usable by keyboard and at narrow widths, and preserve browser/network guards.
- Controlled examples and a genuine public-site smoke evaluation through the same pipeline. Use a public controlled fixture for live PageSpeed verification; Google's hosted service cannot read the local fixture server.

## Scope boundaries

Evaluate the entry page plus a bounded journey, not every page or customer path. Form labels, navigation, and reaching a form may be checked publicly; submitting it is outside public mode. Authorized client-only test recipes can exercise validation without changing production data.

Do not add accounts, billing, authenticated browsing, CAPTCHA handling, purchases, production submissions, automatic code edits, whole-site crawling, scheduled monitoring, keyword research, backlink analysis, conversion analytics, or security penetration testing. Do not promise improved revenue, search rankings, WCAG conformance, or correctness of all buttons/forms.

No numeric Design & UX score, user-entered journey, multiple journeys, mandatory desktop-and-mobile Lighthouse pair, or exhaustive keyboard testing in this MVP. Browser text-resizing tests of audited sites remain deferred. Existing detailed accessibility probes may provide supporting findings; completing all eleven legacy checks at every state is no longer the broad MVP's release gate.

Preserve existing saved runs, comparison logic, recent-run links, and JSON export. New website-health retest comparisons are a follow-up after the core evaluation works; legacy accessibility comparisons must retain their original meaning. Deployment is also a follow-up, not a local acceptance gate.

## Success criteria

A business user can see the tested scope, understand the main evidenced problems, follow practical recommendations, and distinguish automated measurements from AI opinion. One genuine journey is visible and its reported outcome matches browser evidence. Missing providers leave useful partial results with explicit limitations. The team can demonstrate the live integrated pipeline without fabricated scores or scripted provider activity.
