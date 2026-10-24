# Current status

Last updated: 2026-10-23. Branch: `main`.

## Implemented and exercised

- Runnable local Node/Express app with a minimal vanilla frontend, shared design tokens, presentation components, accessible finding dialog and direct run/finding links.
- Broken/fixed demo selector and preview, ten recent saved-run links with score/coverage, and finished-run JSON downloads behind the existing API authentication boundary.
- Real Twinly `computer/next-action` calls, normalized coordinate execution, actual before/after frames and sequenced action events. No scripted demo walkthrough replaces Twinly.
- Eleven frozen checks across all five categories, pinned axe/Playwright versions, reset-state keyboard probes, authorized client-only validation, 320 px reflow geometry and selected-control operation.
- Equal-category scoring and coverage, unresolved/N/A states, immutable baseline samples, positive target-level resolution, partial comparisons and conditional score deltas.
- Local atomic artifact persistence; start/status/SSE/poll/evidence/cancel API; one interface-launched audit at a time; stale-view labeling and interrupted-run detection.
- Public HTTP(S) URL launches, fresh browser contexts, request/action guards, IP-pinned public-network proxy, blocked mutations, downloads and popups. `AUDIT_PUBLIC_TARGETS=false` restores configured-origin launch restrictions. Public form checks remain non-submitting.
- Retests try labeled system replay/direct-URL fallbacks when Twinly cannot finish reconstruction. Stored widget signatures and sampled pointer outcomes must match; missing interactions prevent a comparable delta. Cancellation and deadlines apply to fallbacks.
- Broken/fixed fixtures plus negative cases for dialog focus containment, responsive control replacement, decorative images, alternative error relationships and a two-dimensional table.

## Public-site reliability fixes

- Safe `/` and `?` site shortcuts work outside editable fields. Rejected non-committing proposals go back to Twinly with executor feedback; three consecutive rejections stop exploration. Committing proposals still stop immediately. Rejected proposals never enter replay setup.
- Scroll-only anchors retain before/after coordinates and visible destination/text evidence, so they qualify for selected keyboard/narrow checks. Reset matching checks URL, heading, widgets/dialogs and target metadata instead of incidental clocks/rotating hero text. Keyboard activation inspects the actual focused element, independent of pointer hit testing or overlays; a blocked activation retains review evidence and does not skip forms/reflow.
- Initial/programmatic navigation resolves each HTTP redirect through the IP-pinned proxy before rendering the buffered final response at its actual URL. Landing scope is committed before embedded documents load. Pointer redirects use the same bounded resolver; later cross-origin and private destinations remain blocked.
- Reflow freezes desktop targets instead of independently resampling mobile content. Unique tag/text responsive replacements are matched; missing or changed targets remain review with target-specific reasons. Each selected narrow control gets a reset state.
- Validation applicability excludes hidden, disabled, read-only and button-only fields and retains its inventory. Visible public fields remain untested without server authorization.
- Category cards explain unscored/N/A results, and run limitations show sanitized blocked resources, reasons and loaded-content scope. The interface displays loaded revision/start time and warns about stale server or client code; `npm run dev` restarts the backend during development.
- Prompt/probe/navigation versions changed so older results do not receive an invented comparable delta. Numeric scoring policy is unchanged.
- Final real portfolio verification through the refreshed interface: run `1b8d68d7-1f61-4653-8528-019c474bd5a0`, five Twinly calls, 45.4 seconds. K01/K02 both passed; hidden search fields were validation N/A; no PDF or other network requests were blocked. Reflow retained review with two specifically identified unmatched responsive controls. The run correctly remained partial after Twinly proposed a committing action; that proposal was blocked immediately. Decisions still returned exhausted credits. Score 66.7, coverage 75.0%; neither is a whole-site claim.

## Verification actually run

- `npm install` and `npx playwright install chromium`; versions are pinned in `package-lock.json` (Playwright 1.64.1; axe-core 4.14.0).
- `npm test`: 26 tests passed for numerical examples, verdict aggregation, action/network validation (including unlisted public targets and private DNS rejection), target matching, partial resolution, event persistence and bounded recent-run summaries.
- `npm run test:browser`: 17 tests passed. The fixture test verifies nine seeded failed assertions across the five categories. Fixed/negative variants produce no confirmed failures for those assertions; the negative fixture’s identical, unique responsive control replacement is positively matched and operated.
- New regressions cover shortcuts/editing, rejection feedback/limits/committing stops, scroll anchors with changing page text and a focus overlay, frozen reflow samples and missing content, validation applicability, multi-hop redirects, embedded documents, actionable restriction evidence, and stale-build detection. The browser suite also checks API concurrency, cancellation, saved evidence, event cursor reconnection, provider outage, keyboard start/inspect/retest/cancel flows, focus restoration, axe on actual start/report/inspector views, 320 px layout and 200% interface text enlargement.
- Workflow regression tests exercise the demo selector, JSON attachment/download, recent-run reopening, replay recovery during provider outage, direct-URL fallback, widget mismatch, missing samples and cancellation. Automated test provider actions are isolated to the harness and spend no provider credits; real portfolio verification is recorded separately. Reviewed the captured start-view screenshot.
- `npm run check`: JavaScript syntax and local Markdown links passed. `npm run format:check` also passed. Dependency audit previously ran; installed dependencies reported zero known vulnerabilities after removing deferred hosting packages.
- `npm run spike`: Twinly selected a real navigation click; Playwright executed it and captured the changed state. Artifacts are retained locally under `.accessbench/spike/`.
- Real `npm run audit -- https://example.com`: one bounded initial state; Twinly declined its off-origin-only link. Static contrast, naming and reflow results were retained with keyboard checks untested and an explicitly provisional report. No public form was submitted.
- `npm run rehearse`: two final real-provider pairs passed with comparable manifests, both keyboard findings positively resolved, and 16 resolved findings per pair. The measured combined audit/retest times were 19.2 s and 16.6 s. Both pairs retained 85% coverage and provisional scores; the comparable score change was +86.7 points. Run IDs and full outcomes are retained in `.accessbench/rehearsals.json`. These timings are observed local runs, not latency promises.

## Remaining external gate and deferred work

- The configured OpenAI key returns **HTTP 429 `credit_balance_exhausted`** on real Decisions requests. The typed request/answer adapter, impact ordering and outage display exist, but no successful live Decisions answer has been observed. A funded/usable key is needed to finish this acceptance gate.
- User explicitly deferred deployment on 2026-10-23: continue running with Node in the terminal until the local MVP is ready. No Vercel project was linked, no Sandbox/Blob integration was exercised, and nothing was deployed.
- No population-wide precision/recall, full WCAG conformance, comprehensive crawling or screen-reader compatibility is claimed. Fixture results are a small seeded demonstration.

## Local server recovery

- The server on port 3000 was an older Node process serving allowlisted-only configuration and missing the recent-audits endpoint, despite updated files on disk. Stopped that stale process and restarted `npm start` from `main`; refreshed the in-app browser. Public URL launch is now available in the running interface. Restart Node after backend changes when using `npm start` (or use `npm run dev` during development).
- Verified through the refreshed interface: public W3C launch `700d802f-0116-46e1-9dca-e69c8af25d17` followed the validated redirect, used four real Twinly calls, audited home/news, and saved a report in 45.5 seconds. Score 40, coverage 51.7%, partial/provisional because checks remained untested/review. No browser errors; Decisions still returned exhausted credits. Screenshot retained at `/private/tmp/accessbench-public-audit.png`.

## Next useful action

Rerun the provider spike with a funded Decisions key, then verify that real triage answers annotate and order findings without changing scores. Keep the local server running with `npm start`. Hosting resumes only after the local MVP and the user's deployment direction.
