# Interface and interaction design

Owner of visual/interaction defaults and report wording. Keep the frontend vanilla HTML/CSS/JavaScript. The product itself should demonstrate the accessibility practices it checks.

## Three views

1. **Start:** product explanation, labeled URL input, scope summary, and Start audit button. No user-goal field in MVP.
2. **Live audit / results:** one run view that evolves from progress to final report without losing the action trail. Include browser viewer, current phase, checkpoint list, category results, and findings.
3. **Finding inspector:** an addressable panel or detail view with evidence, reproduction, suggested fix, and retest state. Keep a return-to-results path and restore focus on close.

A baseline/retest comparison lives in the run view. Do not build a separate history application. Preserve direct links to saved runs and the most recent baseline/retest pair.

The start view includes a broken/fixed demo selector with a preview link and direct audit button, plus the ten most recent saved runs with status, score and coverage. Finished reports offer a JSON download with evidence references; this is a local artifact, not automatic publication. Retest states and the action trail explicitly label recorded-replay or direct-URL reconstruction as system fallbacks.

## Live view hierarchy

- Header: AccessBench, target origin, run lifecycle, elapsed time, cancel control.
- Main area: live browser screenshot with actual capture time and current action text.
- Adjacent area: phase, selected checkpoints, textual action trail, and emerging findings.
- Results area: score and coverage together, five category cards, confirmed blockers, then findings.

On narrow screens, stack these regions in that order. Make the screenshot fit its container; provide optional enlargement with keyboard-accessible controls. Never crop away the target without retaining access to the full screenshot.

The viewer updates after executed actions and important probe steps; it is not a promise of continuous video. Proposed actions must be distinguished from executed actions. Label phases **Twinly exploration**, **Keyboard checks**, **Other accessibility checks**, and **Evidence review**. Probe activity must not appear to be Twinly input.

Save the same frames/action records for an inspectable timeline. Do not implement remote mouse control, browser takeover, or video recording for MVP. Show connection loss and stale capture times clearly. Cancellation preserves collected evidence and ends in an honest partial/canceled report.

## Result language

Example: **82/100 · Provisional · 68% planned-check coverage · 2 of 3 planned states audited**. These numbers are illustrative, never seeded production results.

Keep coverage at the same visual prominence as the score. Include a text link explaining the denominator and sampled scope. Show **Not scored** and **Not applicable** instead of invented category numbers. Confirmed blockers get a visible text callout even when the overall number is high. Unscored/N/A category cards show their check-specific reasons beside the number. Run limitations list each blocked resource, its sanitized destination, reason and affected loaded-content scope. A persistent runtime status displays the loaded server revision/start time and warns when source changes require a restart or the loaded interface needs a reload.

Use verdict labels **Passed**, **Failed**, **Needs review**, **Not tested**, and **Not applicable**, supported by icons/text rather than color alone. Category headings describe the actual tested slice: e.g. **Zoom and reflow — 320 px reflow tested; text resizing not tested**.

A finding shows: concise problem, confirmed/review status, affected interaction, evidence, expected versus observed outcome, related WCAG criterion, affected count, and a concrete remedy. Keep AI-estimated impact separate from verified facts; do not expose raw probabilities as an accuracy badge.

Retest labels are **Resolved**, **Persistent**, **New**, and **Unverified**. Follow [scoring.md](scoring.md) before showing deltas or claiming a fix. Source snippets are illustrative guidance unless actual application source is available; the tool does not edit websites.

## Visual defaults

Use a calm developer-tool appearance: light background, dark text, blue accent, strong spacing, readable tables, and restrained borders. No sheriff imagery, mascot, decorative graphs, or animation-heavy scan sequence.

The implementation keeps shared tokens in `public/styles/tokens.css`, component styles in `public/styles/components.css`, presentation templates in `public/components.js`, and transport/focus behavior in `public/app.js`. A later frontend skill can replace the visual design without changing the check engine or scoring.

Suggested starting tokens: background `#F8FAFC`, surface `#FFFFFF`, text `#0F172A`, secondary text `#475569`, accent `#1D4ED8`, focus `#1D4ED8`. Start with a system font at 16 px, line height 1.5, and spacing steps 4/8/12/16/24/32 px. Verify actual component contrast and focus visibility rather than assuming tokens establish accessibility.

## Accessibility acceptance

- Semantic landmarks, sensible headings, skip link, labeled fields, and descriptive buttons/links.
- Complete start, inspect, cancel, and retest flows by keyboard; visible focus and correct dialog/panel focus behavior.
- Announce phase changes and completion through a polite status region. Do not announce every screenshot or flood the screen reader with action chatter.
- Keep an accessible textual action log. Screenshots do not replace findings/reproduction text. Do not replace the focused control when live frames update.
- Show form errors in text and associate them appropriately. Respect reduced motion; animations are optional.
- Test the interface at 320 CSS pixels and 200% text enlargement even though audited-site text resizing is deferred.
- No color-only severity/status encoding, inaccessible clickable cards, unexplained score rings, or chart-only evidence.
- Run axe plus manual keyboard checks on the application's actual flows. A clean axe run alone is not acceptance.
