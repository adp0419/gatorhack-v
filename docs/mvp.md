# MVP

Owner of product scope. Check mechanics live in [checks.md](checks.md); numerical rules live in [scoring.md](scoring.md).

## Thesis

**AccessBench checks a defined slice of website accessibility, shows its exploration and evidence, and makes improvement measurable after a fix.**

The primary user is a developer or small team that needs actionable findings. This is a website benchmark across five categories, rather than a benchmark of AI agents. A selected interaction supplies useful evidence, but does not replace the five-category audit.

## Accepted decisions

| Area | Decision |
|---|---|
| Team and time | Two builders; 48-hour hackathon |
| Standards | Bounded checks mapped to selected WCAG 2.2 A/AA criteria |
| Categories | Keyboard; forms; contrast; semantics; zoom/reflow |
| Exploration | Automatic selection of accessibility-relevant interactions |
| Navigation | Same-origin navigation permitted; maximum three audited states |
| Future extension | Optional user-directed goal can later replace automatic selection |
| Agent | Twinly computer-use next-action loop directs the walkthrough |
| Viewer | Live browser screenshots and actual action progress |
| Evidence authority | Deterministic assertions confirm results; uncertain findings need review |
| Decisions | Ambiguity classification and impact prioritization, separate from scoring |
| Scores | Overall 0–100 and five category score slots, with coverage |
| Incomplete audits | Provisional scores remain visible where conclusive evidence exists |
| N/A categories | Excluded; remaining scored categories weighted equally |
| Scoring unit | One defined check per audited state, not one point per element |
| Forms | Active validation only on controlled or explicitly authorized test sites |
| Keyboard depth | Selected interactions, rather than every control |
| Reflow | 320 CSS-pixel width; dedicated text resizing deferred |
| Demo | Broken/fixed controlled site plus a real public site; same engine |
| Centerpiece | Pointer-operable navigation with an evidenced keyboard barrier, then verified fix |
| Deployment | Vercel + Sandbox target; local runner retained |

The exact check registry, budgets, data structures, storage choice, and visual styling are defaults specified in the other documents. Provider access and deployment are not assumed proven.

## User flow

1. Enter a public website URL and start an audit. A configured test target may also permit active validation.
2. Watch Twinly inspect and operate the real browser. See the currently tested URL, phase, and scope.
3. Inspect five-category results, overall score, coverage, confirmed blockers, and review findings.
4. Open a finding for its screenshot, observed behavior, relevant criterion, reproduction steps, and suggested remedy.
5. Apply a fix outside AccessBench. Retest against the same manifest and inspect comparable results.

## Must ship

- A working local end-to-end audit and public Vercel + Sandbox deployment after feasibility verification. A local-only fallback leaves the public deployment requirement incomplete.
- A real Twinly-driven exploration, visible while it runs; three-state maximum, not a requirement to fabricate three states.
- Every category represented by the bounded registry, with honest result states.
- At least one real Decisions request whose answer affects triage or ordering in the report.
- Deterministic scoring, coverage, and explicit category-unavailable/N/A displays.
- A finding inspector and retained action/evidence timeline.
- Same-scope retest with resolved, persistent, new, and unverified findings distinguished.
- A controlled broken/fixed fixture and a smoke audit of an actual public site.
- An interface usable by keyboard, with equivalent text for all meaningful visuals.

## Scope boundaries

Do not build user accounts, billing, a whole-domain crawler, authenticated audits, CAPTCHA handling, automated production submissions, automatic code edits, scheduled monitoring, or comprehensive assistive-technology simulation.

Dedicated 200% text resizing, exhaustive keyboard traversal, video/VNC streaming, manual browser takeover, goal-entry UI, cross-browser testing, full history management, exports, and a vanilla-versus-React benchmark are deferred. The MVP still retains the evidence required to reopen a run and compare one retest.

## Product success

The same engine must demonstrate a genuine pointer/keyboard discrepancy, preserve evidence, and verify its removal after a developer-applied fix. The public-site run must produce honest bounded results without fixture-specific detection logic.

A successful audit does not establish that an entire site meets WCAG. Report exactly which checks, states, samples, and viewport conditions were exercised.
