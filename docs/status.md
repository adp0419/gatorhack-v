# Current status

Last updated: 2026-10-23. Branch: `rohit-mvp`.

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

## Latest branch comparison and integration

- Fetched `origin`; latest ADP `origin/mvp` is `5d5930f` (2026-10-23). Compared its runtime, guards, selectors, probes, restoration, UI and status against the local implementation. Integrated selected improvements into `rohit-mvp`; existing local work was preserved. No remote branch was changed.
- Adopted validated initial redirects with landing-origin scope and a visible scope event; unique selectors and keyboard focus matching for controls without unique IDs; navigation settling and transient context-replacement retries; bounded checkpoint/probe execution; page-local replay fallback; and clear occupied-port errors.
- Retained the local IP-pinned network proxy, request/action restrictions, richer fixture coverage, evidence storage, and strict widget/sample retest matching. ADP documents a DNS-rebinding window in its route-only guard; the merged runner keeps network-layer enforcement. Public URL acceptance does not promise that every site, authentication flow, or interaction is supported.
- Browser regression uncovered redirect chains escaping `route.continue()` interception. Navigation responses now use non-following fetch, validate the Location before fulfillment, and keep local fixtures confined. Proxy CONNECT supports the public standard ports and configured fixture transport used by Playwright fetch.
- Real W3C demo audit after integration: requested `https://w3.org/WAI/demos/bad/before/home.html`, landed on `https://www.w3.org/WAI/demos/bad/before/home.html`, two Twinly calls, two audited states, no browser execution errors. Run `9aeb5131-d779-46eb-9501-32790624dfa8` took 24.5 seconds, score 25 with 41.7% coverage, explicitly partial/provisional. Form validation stayed untested; unresolved keyboard/reflow outcomes stayed review. Decisions still returned HTTP 429. The preceding smoke run exposed the transient navigation capture error fixed in this integration.

## Verification actually run

- `npm install` and `npx playwright install chromium`; versions are pinned in `package-lock.json` (Playwright 1.64.1; axe-core 4.14.0).
- `npm test`: 20 tests passed for numerical examples, verdict aggregation, action/network validation (including unlisted public targets and private DNS rejection), target matching, partial resolution, event persistence and bounded recent-run summaries.
- `npm run test:browser`: 9 tests passed. The fixture test verifies nine seeded failed assertions across the five categories. Fixed/negative variants produce no confirmed failures for those assertions; responsive text preservation remains review while the replacement control is positively operated.
- New regressions cover controls without IDs, duplicate IDs, initial redirects, fixture redirect escape and later cross-origin redirect rejection. The browser suite also checks API concurrency, cancellation, saved evidence, event cursor reconnection, provider outage, keyboard start/inspect/retest/cancel flows, focus restoration, axe on actual start/report/inspector views, 320 px layout and 200% interface text enlargement.
- Workflow regression tests exercise the demo selector, JSON attachment/download, recent-run reopening, replay recovery during provider outage, direct-URL fallback, widget mismatch, missing samples and cancellation. Test provider actions are isolated to the harness; no provider usage was spent for this update. Reviewed the captured start-view screenshot.
- `npm run check`: JavaScript syntax and local Markdown links passed. `npm run format:check` also passed. Dependency audit previously ran; installed dependencies reported zero known vulnerabilities after removing deferred hosting packages.
- `npm run spike`: Twinly selected a real navigation click; Playwright executed it and captured the changed state. Artifacts are retained locally under `.accessbench/spike/`.
- Real `npm run audit -- https://example.com`: one bounded initial state; Twinly declined its off-origin-only link. Static contrast, naming and reflow results were retained with keyboard checks untested and an explicitly provisional report. No public form was submitted.
- `npm run rehearse`: two final real-provider pairs passed with comparable manifests, both keyboard findings positively resolved, and 16 resolved findings per pair. The measured combined audit/retest times were 19.2 s and 16.6 s. Both pairs retained 85% coverage and provisional scores; the comparable score change was +86.7 points. Run IDs and full outcomes are retained in `.accessbench/rehearsals.json`. These timings are observed local runs, not latency promises.

## Remaining external gate and deferred work

- The configured OpenAI key returns **HTTP 429 `credit_balance_exhausted`** on real Decisions requests. The typed request/answer adapter, impact ordering and outage display exist, but no successful live Decisions answer has been observed. A funded/usable key is needed to finish this acceptance gate.
- User explicitly deferred deployment on 2026-10-23: continue running with Node in the terminal until the local MVP is ready. No Vercel project was linked, no Sandbox/Blob integration was exercised, and nothing was deployed.
- No population-wide precision/recall, full WCAG conformance, comprehensive crawling or screen-reader compatibility is claimed. Fixture results are a small seeded demonstration.

## Next useful action

Rerun the provider spike with a funded Decisions key, then verify that real triage answers annotate and order findings without changing scores. Keep the local server running with `npm start`. Hosting resumes only after the local MVP and the user's deployment direction.
