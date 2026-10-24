# Interface and report design

Owner of interaction, visual defaults, and report wording. The local interface implements the website evaluation experience with explicit legacy report dispatch; [status.md](status.md) records verification and remaining provider gates. Keep vanilla HTML/CSS/JavaScript and reusable presentation boundaries.

## Accepted creative direction

Accepted on 2026-10-24: frame **AccessBench as an AI experience lab for a website**, using direct language about discovering friction and understanding the customer's next step. Keep the AccessBench name. Lead with curiosity, discovery, and evidence from the browser journey; categories explain the findings underneath that story.

**The website under test is the visual centerpiece of AccessBench.** Actual browser captures, evidence annotations, and selectable observed states give each report its character. The experience should feel like an investigation the user can follow, with observed problems paired with practical next steps.

Proposed opening copy for the overhaul:

> **Your website makes a promise.**
>
> **See how it holds up.**
>
> AccessBench explores one customer journey, measures the entry page, and turns the evidence into practical improvements.
>
> **Explore my website →**

This is the accepted direction, with copy and exact visual tokens still subject to implementation refinement. It does not expand the tested scope or imply human user research, conversion measurement, comprehensive crawling, or guaranteed outcomes. The visual overhaul is planned; the existing interface remains implemented until the frontend changes land.

## Three views

1. **Start:** use an oversized headline, a prominent labeled website URL input and proposed **Explore my website** button, and an annotated browser composition. Summarize the entry-page scan plus one automatically selected, non-submitting customer journey near the input. Present the five categories as a quieter supporting line rather than five equal hero boxes. No goal-entry field. Any illustrative browser composition must be clearly distinguished from actual run evidence.
2. **Live evaluation / dashboard:** one view evolves from source progress into results. Make the captured browser the main stage, with the selected goal, actual actions, and verified outcomes alongside it. Retain provider provenance and source availability as supporting information.
3. **Issue details:** addressable panel with observation, source, evidence, affected journey/state, suggested improvement, and reproduction steps. Restore focus when it closes.

Keep existing saved-run links, the bounded recent-run list, demo selector, and JSON report download. Legacy saved accessibility reports must open with original labels/version context, not website-health branding that implies new measurements. The existing v1 retest flow can remain on v1 reports; new v2 comparison controls are deferred until supported.

## Live evaluation

Show target, selected journey and safe endpoint, elapsed time, cancel control, source availability, and phase progress. Suggested phases: **Page measurements**, **Customer journey**, **Design review**, and **Preparing recommendations**. They may overlap; the interface must reflect actual execution rather than a fabricated linear animation or percentage.

Display the latest Twinly/Playwright screenshot with capture time and actual action text. Separate Twinly proposals, executed actions, independent Playwright probes, and system recovery events. Google's Lighthouse session runs separately; the viewer shows our browser and cannot claim to stream Google's execution.

Keep a readable textual trail with selected states and observed outcomes. Screenshots update after actual actions/probes; continuous video, remote control, and browser takeover are deferred. Announce disconnection/stale captures, preserve partial results after cancellation, and never present saved frames as live activity.

## Dashboard hierarchy

- Concise evidence-derived takeaway and the most useful next steps, with confirmed customer blockers prominent. Keep AI suggestions visibly distinct from verified observations; preserve a deterministic summary when Gemma is unavailable.
- Prominent website health score with **tested scope**, numeric availability, and provisional status attached to the score.
- Scope summary: entry page and device strategy; one journey; states actually visited; source warnings.
- Five category sections in order: Accessibility, Design & UX, SEO, Performance, Functionality.
- Journey result: selected goal, safe endpoint, completed/blocked/partial/unavailable status, and passed/failed/unverified outcomes.
- Prioritized issues and suggested improvements, with confirmed customer blockers prominent.
- Expandable source diagnostics, including Lighthouse Best Practices, and the retained evidence trail.

The audience is business owners and small teams. Lead issue wording with the observed problem and practical remedy; put audit IDs and implementation detail in expandable evidence.

## Scores and qualitative results

Design & UX shows **Qualitative review**, a short Gemma 4 summary, and evidence-linked findings. Do not show a numeric score, empty score ring, N/A score, or a manufactured pass. If Gemma 4 fails, show **Design review unavailable** with the reason and preserve other results.

The four numeric category cards show their source and scope. Accessibility, SEO, and Performance are Lighthouse scores; Functionality is based on the one observed journey. Unavailable values say **Not scored**, with the source-specific reason. Best Practices lives in supporting diagnostics rather than another top-level card.

Illustrative wording: **83/100 · Website health — tested scope · 4 of 4 numeric categories scored**. Design remains qualitative. For partial evidence: **77/100 · Provisional · 3 of 4 numeric categories scored · Journey unavailable**. Never seed these example numbers into production.

Show journey assertion coverage separately, such as **3 of 4 planned outcomes verified**. Avoid the old generic coverage percentage as a whole-site claim. A 100 Functionality score with unresolved assertions still requires a provisional label and a partial journey status. Follow [scoring.md](scoring.md) for all denominator and rounding rules.

## Issue and recommendation language

Each issue includes concise title, category, source, verification state, actual observation, relevant URL/state/target, evidence, expected behavior, and a concrete next step. Show WCAG references only on relevant accessibility findings.

Use **Observed by automated checks**, **Verified journey outcome**, **Needs review**, and **AI suggestion** where appropriate. Gemma 4's suggested impact/priority is distinct from a confirmed defect. Do not promise ranking gains, conversion increases, compliance, or complete website correctness. One issue can link several source records without duplicate deductions.

Recommendation lists group practical next steps by urgency and category. Preserve a deterministic evidence-derived summary if Gemma 4 recommendations are unavailable; do not imply AI review succeeded. Blocked resources and source/URL differences have visible sanitized explanations.

## Visual defaults and frontend boundaries

Use warm paper/ivory backgrounds, ink-colored text, oversized expressive headings, precise sans-serif interface text, generous space, restrained borders, and a single sharp electric-lime accent. Keep status colors paired with text labels. Browser imagery and evidence annotations should carry the visual identity. Exact colors, typefaces, and sizes are implementation defaults to choose and verify, not fixed accepted tokens; do not assume the lime accent is suitable for small text or focus indicators without contrast checks.

Use motion to mark real evidence arriving: a captured frame, an executed action, or a verified outcome. Honor reduced motion and keep textual equivalents. Do not fabricate activity, smooth percentages, or a continuous browser stream.

Preserve shared tokens in `public/styles/tokens.css`, component styles in `public/styles/components.css`, presentation templates in `public/components.js`, routing/transport/focus in `public/app.js`, and semantic structure in `public/index.html`. The existing slate/blue tokens describe the current implementation and are superseded as the target visual direction. Retain readable body text (16 px default), comfortable line height (1.5 default), and a consistent spacing scale. Verify actual contrast and focus behavior. No design-system or framework migration is required for the overhaul.

## Interface acceptance

- Semantic landmarks, headings, skip link, labeled inputs, descriptive controls, and keyboard-accessible issue details.
- Complete start, inspect, cancel, saved-report, and existing retest flows by keyboard; preserve focus during updates and on closing a dialog.
- Polite announcements for phase/completion changes, without reading every screenshot or log line aloud.
- Equivalent textual evidence, associated form errors, reduced-motion support, and no color-only meaning.
- Stack cards/viewer/trail at narrow widths; fit screenshots without losing access to their full content. Test the app at 320 CSS pixels and 200% text enlargement.
- Run axe and manual keyboard checks on actual application views. A clean automated scan alone is insufficient.
