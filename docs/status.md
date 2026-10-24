# Current status

Last updated: 2026-10-24. Keep this file short and outcome-oriented.

## Completed (branch `mvp`)

- Local end-to-end MVP: Express server + vanilla UI, in-process runner, file-backed run store (`runs/`, gitignored).
- Twinly computer-use loop with an independent safety executor (commit/submit/cross-origin/sensitive vetoes), network and navigation guard, max three checkpoints.
- Check registry `accessbench-v1`: axe-mapped F01/C01/S01–S03 (rule IDs verified against axe-core 4.14.0), keyboard probes K01/K02, authorized-only form recipe F02/F03, 320 px reflow R01/R02.
- Scoring `equal-categories-v1`, findings with reproduction steps and curated remedies, Decisions triage adapter (ordering/annotation only), retest comparison (Resolved/Persistent/New/Unverified).
- Live viewer (SSE with resume + polling fallback), results report, finding inspector, retest button, JSON download.
- Controlled fixture (`npm run fixtures`, `npm run fixture:broken|fixed`) with one seeded defect per category.

## What actually ran (2026-10-24)

- `npm test`: 31 tests pass (scoring worked examples, verdict aggregation, executor policy, address blocking, retest matching, ordering).
- Broken fixture audit: completed, 3 Twinly calls (Home → Services → Contact). Every seeded defect detected; the pointer-only "Contact" is a confirmed K01 blocker on two states. Score 39, coverage 100%.
- Retest after `npm run fixture:fixed`: Twinly reconstructed both stored states; 13/13 baseline findings **Resolved**; score 100, coverage 100%, comparable scope (+61).
- Public smoke audit, https://www.w3.org/WAI/demos/bad/before/home.html: completed, 5 Twinly calls, 3 states (Home, News, Tickets). Score 28, provisional, coverage 70%. Findings (missing alt, unnamed links, unlabeled select, 3.88:1 contrast, no reflow at 320 px) match the demo's documented defects; F02/F03 not tested (public site), keyboard passed on sampled navigation, Tickets keyboard not tested (no sampled interaction). Results were reviewed by reading the report, not against an expert label set.
- `node scripts/self-audit.js <runId>`: AccessBench's own start, report, and inspector views have no axe WCAG A/AA violations and no horizontal overflow at 1280 and 320 px; keyboard flow (skip link, form error focus, open/close inspector with focus return) passes. axe reports color-contrast as *incomplete* on the report view (text over screenshots); not manually verified yet.

## Blockers and gaps

- **OpenAI Decisions: HTTP 429 `credit_balance_exhausted`.** Every run records triage as unavailable and falls back to rule-based ordering. The must-ship "real Decisions request affecting triage" is not met until credits are added; then rerun `npm run spike` and an audit.
- **Deployment:** local only. Vercel + Sandbox not attempted (no access configured). Public deployment requirement is incomplete.
- DNS-rebinding protection is per-request host resolution in the route guard; Chromium resolves separately, so a rebinding window remains. Acceptable for the local demo; revisit before a public runner.

## Next action

1. Add OpenAI credits, run `npm run spike`, then one audit to confirm live triage answers appear in the inspector.
2. Provide Vercel access and run the hosting spike in [build-plan.md](build-plan.md).
3. Rehearse the demo sequence twice.

## Gates and defaults

| Item | Current position |
|---|---|
| Twinly | Verified live: `computer` scope, ~3–4 s per next-action, free tier + $20 extra usage |
| OpenAI | Request shape implemented per docs; live answer blocked by account credits |
| Public hosting | Not started; local runner works |
| Storage | Local files behind `src/store/run-store.js`; Blob adapter not written |
| Registry | Eleven v1 checks implemented; axe rule allowlist frozen in `src/checks/axe.js` |
| Engine confirmation | Fixture proves a real defect and its fix in every category |
| Judging requirements | Rubric and presentation time not supplied |
