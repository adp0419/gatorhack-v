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

The implemented start screen is a launch surface and visual archive of saved reports. The same shared palette reaches the existing dashboard, while its browser-centered structural redesign remains planned. Actual captures and readable uncertainty keep the experience grounded in bounded observation.

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

The serif gives the opening promise and archive heading an editorial voice; interface copy remains direct and legible. The frontmatter captures the implemented roles. Display serves the start headline, headline serves the archive title, title serves report captions, label serves launcher labels, and mono serves preformatted evidence. Body defaults to a comfortable 16 px with 1.5 line height; supporting metadata is smaller. Existing dashboard headings remain sans-serif.

**The Evidence First Rule.** Use expressive display type to frame the investigation, and readable interface type to explain its observations.

## Layout

The shared content container is at most 80rem, with centered margins and the existing spacing scale. Main content uses 2rem vertical and 1.5rem horizontal padding; at 36rem and below it uses 1.5rem vertical and 1rem horizontal padding.

The implemented start screen puts the URL launcher across the available width. Recent reports use two equal columns with 2.5rem row and 2rem column gaps; at 45rem and below the gallery and launcher stack. A fixed 16:10 preview region reserves image space, with top-aligned cover cropping and an attached caption. Long URLs wrap. The demo follows recent reports and the quieter scope summary.

The existing dashboard retains its two-to-one viewer/trail grid, collapsing at 60rem, and its existing report structure. Category cards move from five columns to two at 60rem and one at 36rem. These are current behavior, not completion of the planned browser-centered workspace overhaul. Preserve usable layouts at 320 CSS pixels and 200% text enlargement.

## Elevation & Depth

The system uses flat paper surfaces, restrained borders, and strong section rules rather than shadows. The archive begins with a two-pixel ink rule. Actual website captures supply visual detail; they do not receive decorative elevation. The existing issue dialog uses a translucent backdrop to separate it from the page.

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

### Evidence arrival

A genuinely loaded archive image reveals through a short clipping animation (420ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Its caption and reserved area stay in place. Reduced motion disables the animation and gives the same static result. No generated raster assets are shipped by this redesign; run evidence remains private.

## Do's and Don'ts

### Do:

- Do use actual saved captures with their scope, version, and status attached.
- Do keep body text readable, controls labeled, focus visible, and evidence understandable in text.
- Do distinguish the implemented start screen from the planned browser-centered workspace.

### Don't:

- Don't use lime for small text or as the sole focus indicator.
- Don't manufacture screenshots, progress, passing outcomes, or evidence.
- Don't turn a screenshot-led start-screen composition into a mandatory layout for every product surface.

Owner of interaction, visual defaults, and report wording. The local interface implements the website evaluation experience with explicit legacy report dispatch; [status.md](status.md) records verification and remaining provider gates. Keep vanilla HTML/CSS/JavaScript and reusable presentation boundaries.

## Accepted creative direction

Accepted on 2026-10-24: frame **AccessBench as an AI experience lab for a website**, using direct language about discovering friction and understanding the customer's next step. Keep the AccessBench name. Lead with curiosity, discovery, and evidence from the browser journey; categories explain the findings underneath that story.

**The website under test is the visual centerpiece of AccessBench.** Actual browser captures, evidence annotations, and selectable observed states give each report its character. The experience should feel like an investigation the user can follow, with observed problems paired with practical next steps.

Implemented start-screen copy:

> **Your website makes a promise.**
>
> **See how it holds up.**
>
> AccessBench explores one customer journey, measures the entry page, and turns the evidence into practical improvements.
>
> **Explore my website →**

The start screen now implements this direction, with the opening headline, labeled URL launcher, and screenshot-led recent reports. Shared palette tokens apply globally; the dashboard structure is unchanged. The browser-centered workspace overhaul remains planned. This direction does not expand the tested scope or imply human user research, conversion measurement, comprehensive crawling, or guaranteed outcomes.

## Three views

1. **Start (implemented):** expressive headline, full-width labeled website URL launcher and **Explore my website** button, followed by screenshot-led recent reports. Summarize the entry-page scan plus one automatically selected, non-submitting customer journey near the input. Present the five categories as a quieter supporting line rather than five equal hero boxes. No goal-entry field. Actual saved screenshots lead the two-column gallery, with one column at narrow widths; no-capture and unavailable-image placeholders remain explicit. At most ten reports retain site, date, scope/version, and status; v1 reports retain accessibility labels. Previews use authenticated API fetches and local blob URLs. Demo access is secondary. Empty history uses a clearly labeled textual example, never a fake browser capture.
2. **Live evaluation / dashboard (browser-centered overhaul planned):** one view evolves from source progress into results. Make the captured browser the main stage, with the selected goal, actual actions, and verified outcomes alongside it. Retain provider provenance and source availability as supporting information.
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

## Frontend boundaries

The normative frontmatter and canonical visual-system sections above capture the implemented paper/ink/lime system. Preserve shared tokens in `public/styles/tokens.css`, component styles in `public/styles/components.css`, presentation templates in `public/components.js`, routing/transport/focus in `public/app.js`, and semantic structure in `public/index.html`. No design-system or framework migration is required for the remaining workspace overhaul.

Use motion to mark real evidence arriving: a captured frame, an executed action, or a verified outcome. Honor reduced motion and keep textual equivalents. Do not fabricate activity, smooth percentages, or a continuous browser stream. Verify actual contrast and focus behavior on every changed surface.

## Interface acceptance

- Semantic landmarks, headings, skip link, labeled inputs, descriptive controls, and keyboard-accessible issue details.
- Complete start, inspect, cancel, saved-report, and existing retest flows by keyboard; preserve focus during updates and on closing a dialog.
- Polite announcements for phase/completion changes, without reading every screenshot or log line aloud.
- Equivalent textual evidence, associated form errors, reduced-motion support, and no color-only meaning.
- Stack cards/viewer/trail at narrow widths; fit screenshots without losing access to their full content. Test the app at 320 CSS pixels and 200% text enlargement.
- Run axe and manual keyboard checks on actual application views. A clean automated scan alone is insufficient.
