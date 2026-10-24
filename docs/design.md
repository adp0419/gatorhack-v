---
name: AccessBench
description: A paper, ink, and lime experience lab grounded in actual website evidence.
colors:
  bg: "#f4f1e8"
  surface: "#fcfaf5"
  text: "#20251d"
  muted: "#555e4b"
  accent: "#35491d"
  accent-soft: "#e6edd9"
  lime: "#d1ed73"
  border: "#b4b8a8"
  error: "#991b1b"
  focus: "#35491d"
  score-accessibility: "#5c7828"
  score-seo: "#3477a3"
  score-performance: "#a86a24"
  score-functionality: "#935b83"
  score-track: "#d9ddcf"
typography:
  display:
    fontFamily: '"Gelasio", Georgia, "Times New Roman", serif'
    fontSize: "clamp(2.25rem, 4.1vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.07
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Gelasio", Georgia, "Times New Roman", serif'
    fontSize: "clamp(1.75rem, 3vw, 2.4rem)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8rem"
    lineHeight: 1.5
rounded:
  control: "0.375rem"
  launcher: "4px"
  capture: "6px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-launch:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.text}"
    padding: "1rem 1.75rem"
    rounded: "0 3px 3px 0"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "white"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "0.4rem 0"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0.65rem 0.75rem"
  badge:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0.25rem 0.6rem"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "{spacing.6}"
---

# Design System: AccessBench

## Overview

**Creative North Star: "AI experience lab"**

AccessBench is an AI experience lab for a website. Warm paper and dark ink give actual browser evidence room to speak; a sharp lime action invites exploration. Editorial serif headings pair with precise sans-serif controls and plain-language explanations.

The implemented start screen is a launch surface and visual archive of saved reports. Finished website evaluation v2 reports extend the same system with a compact, score- and feedback-led reading order. Actual captures and readable uncertainty keep the experience grounded in bounded observation. The browser-centered structural overhaul remains deferred for live evaluations; legacy accessibility reports retain their original scope and presentation.

**Key Characteristics:**

- Warm paper, dark ink, and a sharp lime launch action.
- Editorial display type with precise, readable interface text.
- Actual browser evidence, restrained rules, and flat surfaces.
- Visible scope, provenance, and uncertainty.

## Colors

The implemented palette combines warm paper and ink with one sharp lime action; the frontmatter is normative and mirrors the shared CSS tokens.

### Primary

- **Sharp Lime** (`lime`): the start-screen launch button and text selection, paired with ink text.
- **Deep Olive** (`accent`, `focus`): links, supporting buttons, callouts, and high-contrast focus outlines.
- **Soft Olive** (`accent-soft`): quiet status badges and callout backgrounds.

### Neutral

- **Warm Paper** (`bg`): the page canvas.
- **Light Paper** (`surface`): form and panel surfaces.
- **Ink** (`text`): primary content and strong section rules.
- **Muted Olive Ink** (`muted`): supporting text and metadata.
- **Paper Rule** (`border`): restrained borders and dividers.

Error red (`error`) carries error text alongside an explicit message; status never relies on color alone.

**The Ink on Lime Rule.** Use ink text on lime actions; use deep olive for readable links and focus indicators.

## Typography

**Display Font:** locally hosted Gelasio, with Georgia and Times New Roman fallbacks. The variable font supports normal weights 400–700; `font-display: swap` keeps content visible. Font source and OFL license are retained in [the font directory](../public/fonts/README.md).

**Body Font:** the platform system sans-serif stack. **Label/Mono Font:** system sans-serif for labels and system monospace for code evidence.

The serif gives the opening promise and archive heading an editorial voice; interface copy remains direct and legible. The frontmatter captures the implemented roles. Display serves the start headline, headline serves the archive title, title serves report captions, label serves launcher labels, and mono serves preformatted evidence. Body defaults to a comfortable 16 px with 1.5 line height; supporting metadata is smaller. Finished v2 site headings use the display family at 2rem, reducing to 1.65rem below 36rem; report section headings and controls remain sans-serif. Scores use tabular numerals.

**The Evidence First Rule.** Use expressive display type to frame the investigation, and readable interface type to explain its observations.

## Layout

The shared content container is at most 80rem, with centered margins and the existing spacing scale. Main content uses 2rem vertical and 1.5rem horizontal padding; at 36rem and below it uses 1.5rem vertical and 1rem horizontal padding.

The implemented start screen puts the URL launcher across the available width. Recent reports use two equal columns with 2.5rem row and 2rem column gaps; at 45rem and below the gallery and launcher stack. A fixed 16:10 preview region reserves image space, with top-aligned cover cropping and an attached caption. Long URLs wrap. The demo follows recent reports and the quieter scope summary.

Live evaluations retain the two-to-one viewer/trail grid, collapsing at 60rem; their browser-centered workspace overhaul remains deferred. Finished v2 reports put the compact identity header and overall score/availability summary before four numeric category cards. The numeric row uses four equal columns, two at 60rem and below, and one at 36rem and below. The overall summary also stacks at 36rem. Journey summary, measured feedback, AI suggestions, qualitative review, and expandable detail follow; browser evidence and activity sit after the report. Legacy reports retain their original structure. Preserve usable layouts at 320 CSS pixels and 200% text enlargement.

## Elevation & Depth

The system uses flat paper surfaces, restrained borders, and strong section rules rather than shadows. The archive and finished report begin with two-pixel ink rules. Finished numeric cards and qualitative review use transparent surfaces and thin dividers, with no nested panel chrome. Actual website captures supply visual detail; they do not receive decorative elevation. The existing issue dialog uses a translucent backdrop to separate it from the page.

**The Flat Paper Rule.** Convey grouping with space, surface tone, and rules; keep resting surfaces free of decorative shadows.

## Shapes

Controls and panels share gently curved corners. The launcher has a small continuous outer radius and a joined button; at narrow widths the button sits below the field. Preview captures use modest rounded clipping. Borders and dividers keep the geometry precise, without nested card chrome around archive items.

## Components

### Buttons

The lime launcher is the strongest action, with ink text and a joined border. Other primary buttons use deep olive with white text; secondary buttons use light paper with ink text and a paper-rule border. Text buttons are underlined and left aligned. Standard buttons have a 2.75rem minimum height, hover darkens through a brightness filter, and disabled buttons reduce opacity with a default cursor. Keyboard focus uses a three-pixel deep-olive outline offset by four pixels.

### Inputs / Fields

The start URL field and launch button share one full-width ink-bordered surface. The launcher has an additional two-pixel focus-within outline. Other fields retain the existing bordered light-paper treatment; do not infer that every dashboard field has been redesigned. Labels and associated errors remain visible and semantic.

### Cards / Containers

Panels retain light-paper fill, a thin rule, shared control radius, and spacing-scale padding. Recent reports have no surrounding panel: the actual capture leads, followed by site, date, status, scope/version, and URL. Image loading, no capture, and unavailable image states keep the reserved preview area and explicit text. Private previews are fetched through authenticated APIs and shown using local blob URLs. The list remains bounded to ten reports; v1 context remains explicit.

### Chips

Status badges use soft olive, ink text, a thin border, and modest rounded corners. They always carry a text label rather than using color to imply an outcome.

### Navigation

The compact AccessBench masthead is a text link in ink, paired with the product descriptor. Standard links are deep olive and underlined. Each report preview is a single link with a visible open-report cue; hover thickens that cue's underline. The shared focus outline applies to links and controls.

### Finished v2 reports

A compact site heading, wrapping URL, version/scope, date, and explicit status identify the saved report; **Recent reports** and **Download JSON report** are header actions. Hide saved phase, elapsed-time, connection, and source-progress chrome. Terminal status remains honest: **Complete**, **Partial**, **Provisional**, **Failed · partial evidence**, or **Canceled · partial evidence** as supported by the run and its summary.

The overall score and numeric availability lead into exactly four numeric cards: Accessibility, SEO, Performance, Functionality. Keep source, missing-value reason, and partial journey coverage visible. Each **View findings** button opens its category disclosure, focuses its summary, and scrolls it into view. Design & UX remains a separate qualitative section with model details, observations, evidence links, and explicit unavailable state.

**What to improve first** shows at most three measured findings, ordered by confirmed blocker then recorded impact; retain verification labels and practical next steps. All findings remain in expandable category details. **AI suggestions** follow in high/medium/low priority order and carry explicit AI labels. Neither suggested priority nor qualitative prose changes measured scores or journey outcomes.

Native **Evidence** and **Activity** disclosures follow the finished report and start closed when entering that surface. They retain actual captures, selected states, and the textual action trail. Opening evidence must remain keyboard accessible; preserve user disclosure choices during subsequent updates. Live workspace disclosures remain open with their summary controls hidden.

### Evidence arrival

A genuinely loaded archive image reveals through a short clipping animation (420ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Its caption and reserved area stay in place. Reduced motion disables the animation and gives the same static result. No generated raster assets are shipped by this redesign; run evidence remains private.

## Do's and Don'ts

### Do:

- Do use actual saved captures with their scope, version, and status attached.
- Do keep body text readable, controls labeled, focus visible, and evidence understandable in text.
- Do distinguish the implemented start screen and finished v2 report from the deferred live workspace overhaul.

### Don't:

- Don't use lime for small text or as the sole focus indicator.
- Don't manufacture screenshots, progress, passing outcomes, or evidence.
- Don't turn a screenshot-led start-screen composition into a mandatory layout for every product surface.

Owner of interaction, visual defaults, and report wording. The local interface implements the website evaluation experience with explicit legacy report dispatch; [status.md](status.md) records verification and remaining provider gates. Keep vanilla HTML/CSS/JavaScript and reusable presentation boundaries.

## Accepted creative direction

Accepted on 2026-10-24: frame **AccessBench as an AI experience lab for a website**, using direct language about discovering friction and understanding the customer's next step. Keep the AccessBench name. Use curiosity, discovery, and actual journey evidence to explain the investigation. Finished reports lead with scores and practical feedback; live runs retain the accepted browser-centered direction.

**The website under test gives AccessBench its visual character.** Actual browser captures lead start-screen archive previews and remain the intended centerpiece of live evaluations; finished reports make scores and useful feedback easiest to scan, with the captured evidence available below. The experience should feel like an investigation the user can follow, with observed problems paired with practical next steps.

Implemented start-screen copy:

> **Your website makes a promise.**
>
> **See how it holds up.**
>
> AccessBench explores one customer journey, measures the entry page, and turns the evidence into practical improvements.
>
> **Explore my website →**

The start screen implements the opening headline, labeled URL launcher, and screenshot-led recent reports. Finished v2 reports now implement a score- and feedback-led extension of the same paper/ink/olive system. Shared palette tokens apply globally; the browser-centered live workspace overhaul remains deferred. This direction does not expand the tested scope or imply human user research, conversion measurement, comprehensive crawling, or guaranteed outcomes.

## Three views

1. **Start (implemented):** expressive headline, full-width labeled website URL launcher and **Explore my website** button, followed by screenshot-led recent reports. Summarize the entry-page scan plus one automatically selected, non-submitting customer journey near the input. Present the five categories as a quieter supporting line rather than five equal hero boxes. No goal-entry field. Actual saved screenshots lead the two-column gallery, with one column at narrow widths; no-capture and unavailable-image placeholders remain explicit. At most ten reports retain site, date, scope/version, and status; v1 reports retain accessibility labels. Previews use authenticated API fetches and local blob URLs. Demo access is secondary. Empty history uses a clearly labeled textual example, never a fake browser capture.
2. **Evaluation / report:** live evaluations retain the existing browser/trail workspace, with a browser-centered overhaul deferred. Keep the selected goal, actual actions, verified outcomes, provider provenance, and source availability understandable. When a v2 run finishes, the view becomes the compact report described below; evidence and activity move after its results in closed native disclosures. This finished-report hierarchy does not change legacy reports or the live workspace scope.
3. **Issue details:** addressable panel with observation, source, evidence, affected journey/state, suggested improvement, and reproduction steps. Restore focus when it closes.

Keep existing saved-run links, the bounded recent-run list, demo selector, and JSON report download. Legacy saved accessibility reports must open with original labels/version context, not website-health branding that implies new measurements. The existing v1 retest flow can remain on v1 reports; new v2 comparison controls are deferred until supported.

## Live evaluation

Show target, selected journey and safe endpoint, elapsed time, cancel control, source availability, and phase progress. Suggested phases: **Page measurements**, **Customer journey**, **Design review**, and **Preparing recommendations**. They may overlap; the interface must reflect actual execution rather than a fabricated linear animation or percentage.

Display the latest Twinly/Playwright screenshot with capture time and actual action text. Separate Twinly proposals, executed actions, independent Playwright probes, and system recovery events. Google's Lighthouse session runs separately; the viewer shows our browser and cannot claim to stream Google's execution.

Keep a readable textual trail with selected states and observed outcomes. Screenshots update after actual actions/probes; continuous video, remote control, and browser takeover are deferred. Announce disconnection/stale captures, preserve partial results after cancellation, and never present saved frames as live activity.

## Finished report hierarchy

This hierarchy applies to terminal website evaluation v2 runs, including failed and canceled runs with retained evidence. It extends the incumbent interface without changing score logic, providers, or legacy report scope.

1. Compact site identity: site, URL, scope/version, date, honest status, JSON export, and recent-report navigation. Hide saved-run phase and live progress chrome.
2. Overall website health score with tested scope, numeric availability, and explicit partial/provisional limitations, followed by four numeric cards in order: Accessibility, SEO, Performance, Functionality. Missing data says **Not scored** or **No score available**, with the reason; unresolved journey coverage stays visible even when Functionality is 100.
3. Separate concise journey summary: selected goal, actual status, and verified/planned outcome coverage. Keep journey coverage distinct from numeric category availability.
4. **What to improve first:** first three measured findings, confirmed blockers first, then recorded impact where available. Show verification state, customer-facing context, practical next step, and access to the finding/evidence.
5. **AI suggestions:** separate qualitative recommendations sorted high, medium, low; suggested priority never changes measurements or confirms an outcome.
6. **Design & UX:** separate qualitative review, model details, observation disclosures, and evidence links; explicit unavailable review when needed.
7. Score explanation, limitations, all measured findings in expandable category details, the full customer journey/assertion result, and source diagnostics. Best Practices remains supporting diagnostics only. Category card buttons open and focus the matching disclosure.
8. **Evidence** and **Activity** after the report, closed by default on entry. Preserve actual screenshots, textual trail, selected states, source distinctions, and keyboard access.

The four numeric cards are not the five product categories: Design & UX remains qualitative and has its own section. Keep the browser-centered direction for live evaluation and screenshot-led archive previews; do not turn the finished report back into a browser-first workspace.

The audience is business owners and small teams. Lead issue wording with the observed problem and practical remedy; put audit IDs and implementation detail in expandable evidence.

## Scores and qualitative results

Numeric v2 scores use category-colored outline rings: Accessibility olive (`#5c7828`), SEO blue (`#3477a3`), Performance amber (`#a86a24`), and Functionality plum (`#935b83`). Colors encode category identity, never pass/fail bands. Each category ring fills clockwise from the top to the measured score, with its numeric value centered inside. Unavailable categories use a neutral dashed outline and **Not scored**, distinct from a measured zero's empty continuous track. Design & UX has no ring.

The overall ring has one equal segment per available numeric category, in the same clockwise category order as the cards. Each segment uses its category color and fills proportionally to that category's unrounded score; the center keeps the authoritative overall summary value. Small gaps separate segments. A measured zero retains its segment and denominator place; an unavailable category contributes no segment. With no scores, show a neutral dashed outline and **No score available**. A named, numeric legend maps the segments without relying on color, and the explanation makes equal weighting and excluded categories explicit. Rings are decorative SVG geometry hidden from assistive technology; adjacent labels, values, availability and journey coverage retain the meaning. They introduce no animation or scoring changes. Colored strokes meet at least 3:1 against both paper and the unfilled track; text stays ink. Forced-colors mode uses system stroke colors.


Design & UX shows **Qualitative review**, a short Gemma 4 summary, and evidence-linked findings. Do not show a numeric score, empty score ring, N/A score, or a manufactured pass. If Gemma 4 fails, show **Design review unavailable** with the reason and preserve other results.

The four numeric category cards show their source and scope. Accessibility, SEO, and Performance are Lighthouse scores; Functionality is based on the one observed journey. Unavailable values say **Not scored**, with the source-specific reason. Best Practices lives in supporting diagnostics rather than another top-level card.

Illustrative wording: **83/100 · Website health — tested scope · 4 of 4 numeric categories scored**. Design remains qualitative. For partial evidence: **77/100 · Provisional · 3 of 4 numeric categories scored · Journey unavailable**. Never seed these example numbers into production.

Show journey assertion coverage separately, such as **3 of 4 planned outcomes verified**. Avoid the old generic coverage percentage as a whole-site claim. A 100 Functionality score with unresolved assertions still requires a provisional label and a partial journey status. Follow [scoring.md](scoring.md) for all denominator and rounding rules.

## Issue and recommendation language

Each issue includes concise title, category, source, verification state, actual observation, relevant URL/state/target, evidence, expected behavior, and a concrete next step. Show WCAG references only on relevant accessibility findings.

Use **Observed by automated checks**, **Verified journey outcome**, **Needs review**, and **AI suggestion** where appropriate. Gemma 4's suggested impact/priority is distinct from a confirmed defect. Do not promise ranking gains, conversion increases, compliance, or complete website correctness. One issue can link several source records without duplicate deductions.

AI recommendation lists order practical next steps by suggested high, medium, and low priority and retain their category labels. Measured feedback uses confirmed blockers and recorded impact, with all measured findings available in category disclosures. Preserve a deterministic evidence-derived summary if Gemma 4 recommendations are unavailable; do not imply AI review succeeded. Blocked resources and source/URL differences have visible sanitized explanations.

## Frontend boundaries

The normative frontmatter and canonical visual-system sections above capture the implemented paper/ink/lime system. Preserve shared tokens in `public/styles/tokens.css`, component styles in `public/styles/components.css`, presentation templates in `public/components.js`, routing/transport/focus in `public/app.js`, and semantic structure in `public/index.html`. No design-system or framework migration is required for the remaining workspace overhaul.

Use motion to mark real evidence arriving: a captured frame, an executed action, or a verified outcome. Honor reduced motion and keep textual equivalents. Do not fabricate activity, smooth percentages, or a continuous browser stream. Verify actual contrast and focus behavior on every changed surface.

## Interface acceptance

- Semantic landmarks, headings, skip link, labeled inputs, descriptive controls, and keyboard-accessible issue details.
- Complete start, inspect, cancel, saved-report, and existing retest flows by keyboard; preserve focus during updates and on closing a dialog. Numeric category buttons must open and focus the matching details summary; native evidence/activity disclosures must work by keyboard.
- Polite announcements for phase/completion changes, without reading every screenshot or log line aloud.
- Equivalent textual evidence, associated form errors, reduced-motion support, and no color-only meaning.
- Stack cards/viewer/trail at narrow widths; fit screenshots without losing access to their full content. Test the app at 320 CSS pixels and 200% text enlargement.
- Run axe and manual keyboard checks on actual application views. A clean automated scan alone is insufficient.
