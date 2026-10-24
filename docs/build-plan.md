# Implementation and validation plan

Owner of execution order, acceptance checks, and demo. Read [status.md](status.md) for actual progress. This plan is not evidence that any application feature exists.

## Milestones

| Order | Deliverable | Exit evidence |
|---|---|---|
| 1 | Provider and hosting spike | Real Twinly next-action and Decisions responses; Chromium in Sandbox; runner survives start-request return; real frame visible remotely |
| 2 | Local vertical slice | URL -> browser -> Twinly-selected action -> screenshot/event -> accessible live viewer |
| 3 | Assertions and scoring | Frozen registry, axe mapping, keyboard probes, reflow, pure numerical functions; known fixtures produce expected verdicts |
| 4 | Findings and triage | Real Decisions output affects review/priority; inspector links facts to stored evidence; no AI verdict promotion |
| 5 | Retest and deployment | Baseline manifest reconstructed, positive fix verification, durable artifacts, reconnect/cancel behavior, public smoke run |
| 6 | Validation and rehearsal | Own-interface checks, false-positive cases, external-site report, complete live demo twice |

Front-load milestone 1. Do not spend the first day styling around an unproven hosted browser session. Milestones can overlap once the shared event/result contracts are agreed.

Current execution override (user, 2026-10-23): finish and run the local Node MVP first; defer deployment and the hosting portions of milestones 1 and 5 until then. Provider verification still applies. See [status.md](status.md) for observed results.

Suggested two-builder ownership: one owns runner, Twinly, checks, and scoring; one owns interface, transport/storage, inspector, and comparison presentation. This is a suggested work split, not an instruction to launch additional coding agents. Agree on JSON contracts before independent implementation.

## First spike

1. Confirm provider credentials without logging keys. Exercise Twinly's computer-use endpoint, not just chat or Mac tasks.
2. Open a controlled page, send a real screenshot, execute the returned permissible action, and record the observable result. Exercise normalized coordinate conversion.
3. Submit actual collected evidence to Decisions and validate its named typed answers.
4. In Sandbox, install/pin Chromium dependencies; start a detached runner through a short Vercel request. Verify continued work after that request returns.
5. Persist a frame/event/report and read them from the hosted UI. Check cancellation, runner timeout/death, event reconnection, and storage latency.
6. Save measured runtime and actual errors in `status.md`. If the hosted route fails, keep the local runner functional and document the deployment gap; do not claim deployment is complete.

## Controlled fixtures

Create one small realistic site with navigation and a non-submitting form, with explicit broken/fixed variants and stable logical control/checkpoint IDs. Use the same audit engine for fixtures and public sites; no detector branching on fixture URL, variant, or seeded expected answer.

Seed at least one testable defect per category: pointer-only navigation; an unnamed input/known inaccessible validation behavior; low text contrast; unnamed icon control or missing image alternative; and genuinely lost content/non-exempt reflow failure. Include clean equivalents. Keep expected labels separate from detector inputs.

For the keyboard centerpiece, construct a demonstrable missing keyboard operation, not merely a long tab order. Record pointer success, equivalent-state keyboard attempts, the implementation evidence, and successful keyboard operation after the semantic/control fix.

Add negative cases: legitimate dialog focus containment, responsive navigation replacement, valid decorative images, valid alternative form-error relationships, and a data table requiring two-dimensional layout. Ambiguous negative cases must not become confirmed failures.

## Required verification

| Area | Meaningful checks |
|---|---|
| Scores | Worked examples in scoring.md; equal weights; N/A vs unavailable; no evidence; mixed/partial results; repeated nodes do not dilute failures; missing checkpoints retained |
| Verdicts | Violation/pass/incomplete/inapplicable aggregation; no false pass on absent engine results; AI cannot promote verdicts |
| Executor | Coordinate scaling, malformed/unsupported actions, committing actions, implicit form submission, navigation/network restrictions, timeouts |
| Evidence | Actual executed actions, correct actors/phases, durable references, sequence deduplication, stale-view labeling |
| Retest | Same-manifest match, changed scope, disappeared targets, failed reconstruction, positive resolution, newly introduced failures |
| UI | Keyboard-only main flows, form errors, focus preservation, narrow layout, own-interface text enlargement, axe scan |
| Failure modes | Twinly/Decisions outage, blocked page, partial audit, cancel, runner death, viewer disconnect/reconnect |

Validate the registry on paired fixtures and report observed true detections, missed defects, and false alarms with counts. Only publish precision/recall if labels, matching rules, and denominators are recorded. A small seeded suite demonstrates behavior, not population-wide accuracy. Never claim empirical accuracy based on model confidence.

Smoke-test one real unauthenticated public site through the same engine, document its tested scope, and inspect findings manually. Do not promise a known score or successful navigation on every external website.

## Demo sequence

1. Explain that a website can look usable while an important interaction fails by keyboard.
2. Start a live audit of the controlled broken site. Show Twinly choosing and executing the navigation interaction.
3. Show the independent keyboard probe and five-category results, including coverage and uncertainty.
4. Open the evidenced keyboard finding and its action/focus timeline.
5. Apply the prepared developer fix or switch the controlled variant with an explicit explanation. AccessBench is not making the code change.
6. Retest the same manifest. Show positive keyboard success and the matching finding resolved; show a score delta only if scope is comparable.
7. Show the bounded report from the real public site to establish the shared engine.

Have a saved, clearly labeled earlier report if connectivity fails. Do not present saved frames as live provider activity. Rehearse the actual timing before claiming the presentation fits a particular slot; judging rubric and demo time limit were not supplied.

## Cut order

Cut visual flourishes, filters, export, broad history, and extra interaction types first. Preserve the real Twinly loop, live actual frames, all five category sections, honest scoring/coverage, real Decisions triage, and the verified keyboard before/after.

If arbitrary-public-URL hardening is incomplete, restrict the hosted demo to configured targets and label that restriction. If public deployment is incomplete, demonstrate locally and disclose the gap. Never hide partial implementation behind fabricated results.
