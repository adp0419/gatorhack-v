# Migration and validation plan

Owner of implementation order, acceptance gates, and demo. The local v2 implementation now covers the pipeline, assertions, scoring, compatibility and dashboard. Provider success and integrated-demo gates remain distinct from implementation. See [status.md](status.md) for observed progress and actual commands.

## Reuse, replace, add

| Reuse | Replace or adapt | Add |
|---|---|---|
| Local Node/Express runtime, Playwright, guarded public browsing | Accessibility-only runner/category contract -> versioned evaluation pipeline | PageSpeed Insights adapter and Lighthouse artifacts |
| Real Twinly action loop and actual frames/trail | Exploration objective -> one automatically chosen safe customer journey | Journey plan and independently verified outcome records |
| Persistence, SSE/polling, cancellation, saved reports, JSON export | Decisions requirement -> Gemma 4 qualitative review and synthesis | Gemma 4 image/validated-JSON adapter and evidence validation |
| Accessibility evidence/probes, accessible UI, fixture infrastructure | Legacy overall score -> four-category website health score | Source availability, new schema versions and migration tests |
| Existing legacy retest behavior | Developer-centric report -> business-facing five-category dashboard | Qualitative Design & UX section and practical recommendation list |

Preserve the old reports/tests through explicit version dispatch. Do not rewrite unrelated working guards or build a new frontend framework. The broader MVP does not require all eleven legacy accessibility checks at every state. Exact source/score contracts live in [checks.md](checks.md), [architecture.md](architecture.md), and [scoring.md](scoring.md).

## Execution order and exit evidence

| Order | Deliverable | Exit evidence |
|---|---|---|
| 1 | Provider feasibility spike | One successful real PageSpeed response with four requested Lighthouse categories; one real Gemma 4 screenshot-based, validated JSON response; Twinly selection/execution works for a safe journey |
| 2 | Versioned run and source adapters | Raw artifacts plus validated normalized source results; per-source failures retained; old saved reports still load under v1 |
| 3 | One-journey execution | Visible selected goal/safe endpoint; frozen assertion plan; actual actions/frames; independent completed/blocked/partial outcomes |
| 4 | Scoring and synthesis | Required four-category examples pass; qualitative design has no numeric slot; evidence-linked Gemma 4 recommendations cannot alter measured results |
| 5 | Unified dashboard | URL-only launch -> real progress -> health score, five category sections, issues/recommendations, saved report/export, cancel/partial handling |
| 6 | Integrated verification and demo | Controlled cases plus actual public evaluation through the same pipeline; provider/guard failures honest; keyboard/narrow interface checks; real run IDs/timings recorded |

Local-first remains the execution order. Deployment is deferred until the local MVP is ready and the user resumes hosting work. Do not block this migration on the old Decisions credit gate.

Suggested two-builder ownership: one owns providers/journey/evidence/scoring; the other owns report contracts, transport/storage integration, and dashboard wording/UI. Agree on application schemas first. This is a human work split, not an instruction to launch coding subagents.

## First concrete spike

1. Read current official provider docs and verify credentials without logging secrets. Verify the implemented PageSpeed/Gemma configuration in code and `.env.example`; Gemma uses the Gemini API key and model variable names.
2. Request all four Lighthouse categories explicitly for a known public controlled target; record actual version, strategy, final URL, scores, warnings/errors, elapsed time, and raw artifact reference. Verify null/zero handling against response samples.
3. Exercise Twinly on the controlled target, validating automatic safe-goal selection through the documented action contract. Demonstrate a real chosen action, coordinate execution, actual screenshot change, and independently verified outcome. No fake route or invented provider planning fields.
4. Send real captured evidence to Gemma 4; validate qualitative review/recommendations and evidence references. Demonstrate that no numeric design score is required or consumed.
5. Record commands, sanitized outcomes, costs/limits if actually observed, and remaining gaps in `status.md`. Provider mocks cannot satisfy this gate. Documentation-only browsing is not a live integration test.

Google cannot reach local fixtures. Keep local fixtures for browser assertions/unit tests; provide a public controlled target for the real PageSpeed gate. If unavailable, retain the local test results and explicitly leave the full-provider gate incomplete. Do not silently add a tunnel or claim local fixtures were measured remotely.

## Meaningful verification

| Area | Required cases |
|---|---|
| Source adapters | All four Lighthouse categories requested; score 0 preserved; missing/null/nonfinite/out-of-range values rejected; runtime errors/warnings; category audit modes; final URL mismatch; Gemma 4 refusal/invalid JSON/bad evidence reference |
| Scoring | Four-category mean and late rounding; design excluded by policy; Best Practices excluded; partial/no evidence; unresolved journey denominator; Gemma 4 severity/text cannot change points |
| Journey | Goal/plan frozen before actions; repeated actions count once; true endpoint verified independently; provider `done` without success; wrong/error page; no safe journey; no second journey after failure |
| Defect attribution | Reproducible failed outcome vs timeout/blocked resource/policy stop; cannot label infrastructure failure as a site defect; no “form sent” claim from reaching its fields |
| Guards | Existing SSRF/DNS/redirect/action tests retained; implicit submission and committing actions blocked; new adapters do not leak keys or bypass target validation |
| Versions/artifacts | Old reports keep accessibility labels/formula; mixed-version comparisons rejected; raw provider results and screenshot references retained; source outages do not discard other results |
| UI | Five sections/four numeric cards; qualitative design availability; source scope/device differences; provisional composite and journey coverage; evidence navigation, cancel, reconnect, JSON export; keyboard/narrow layout |
| Failures | Each provider unavailable independently; rate limits, deadline/cancel, interrupted runner, disconnected viewer; all sources unavailable without invented success |

Keep `npm test`, `npm run test:browser`, `npm run check`, and `npm run format:check` as the starting checks; extend scripts only when required by implementation. Tests must assert outcomes/denominators rather than mirror internal code. Browser test providers remain isolated from product execution and do not count as live calls.

## Controlled cases

Retain the existing broken/fixed accessibility fixtures and negative cases for regression safety. Add versioned source-response fixtures and controlled journey variants: successful safe navigation, a reproducible broken link/control, an error page with an apparently successful navigation, a policy stop before submission, and a delayed/ambiguous outcome that remains unverified.

Validate SEO and Lighthouse mapping with real source evidence and representative recorded responses, not invented target-specific scores. Design assessment acceptance checks evidence linkage, useful qualitative language, and limitations; aesthetic agreement is not a deterministic accuracy test. Performance measurements vary; do not require a fixed live score or promise a particular speed improvement.

## Demo sequence

1. Explain that AccessBench combines page measurements, one observed customer journey, and AI recommendations to help a business improve its website.
2. Paste the controlled public URL. Show the chosen safe journey and actual Twinly action trail.
3. Show available Lighthouse results and the final five-category dashboard. Explain why Design & UX is qualitative and how the four numeric categories produce the health score.
4. Open one evidenced problem and its practical recommendation. Distinguish the observation from Gemma 4's suggested business impact.
5. Show the journey outcome and any safe stopping boundary; do not imply a transaction or form delivery was tested.
6. Reopen a retained real public report and its scope/limitations. If showing older accessibility before/after results, identify them as legacy examples rather than v2 score comparisons.

Rehearse the real integrated run twice and record actual elapsed time and run IDs. Use clearly labeled saved reports if a provider is down. Earlier accessibility rehearsal timings do not predict the new pipeline's latency.

## Cut order

Cut visual flourishes, filters, wider history, additional device scans, extra probes, new v2 retest comparisons, and hosting work first. Preserve actual PageSpeed/Twinly/Gemma 4 integration, one safe journey, honest evidence/scoring, five category sections, qualitative design/recommendations, and accessible core flows.

If live provider verification is blocked, finish independently testable work and report the specific remaining gate. Do not hide gaps behind fabricated provider output or reinterpret the new MVP as the old accessibility tool.
