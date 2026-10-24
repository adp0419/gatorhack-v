# Architecture and integration contracts

Owner of runtime boundaries, provider integration, storage, and browsing restrictions. These are engineering defaults; feasibility gates live in [status.md](status.md).

## Runtime shape

```text
Vanilla frontend on Vercel
  -> short Node API: validate request, create run, start runner, return run ID
  -> status/events/evidence API: read durable artifacts, stream or poll updates

Vercel Sandbox runner (or local Node/Express runner)
  -> Playwright browser + axe + custom probes
  -> screenshot/history -> Twinly computer use -> proposed action
  -> action guard -> Playwright execution -> next screenshot/checkpoint
  -> structured evidence -> OpenAI Decisions -> triage annotations
  -> pure scoring/comparison functions -> persisted report
```

Twinly owns exploratory action selection. Our backend owns the loop, execution restrictions, checkpoint budget, and measurements. Deterministic keyboard probes are explicitly separate from the agent walkthrough. Do not label those probes as Twinly actions.

## Modules

| Boundary | Responsibility |
|---|---|
| Exploration policy | Automatic audit objective now; optional `goal` later; checkpoint selection |
| Twinly adapter | Provider request/response validation; no direct scoring |
| Executor and recorder | Translate actions, enforce restrictions, capture real outcomes |
| Check engine | Versioned assertions and normalized evidence/verdicts |
| Decisions adapter | Evidence-based triage; no browser execution or verdict promotion |
| Scoring/comparison | Pure functions over persisted results/manifests |
| Run/event store | Append events, store images and reports, resume UI reads |
| Transport/UI | Start/cancel/status/events/evidence; accessible presentation |

The proposed request is `{ url, goal?: string, baselineRunId?: string }`. There is no goal input in the MVP interface. Never let a client assert that a target is authorized for active testing.

## Twinly computer use

Use cloud `POST /v1/computer/next-action`, model `twinly-core`, with server-side bearer authentication. Current documented API base: `https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1`. Keep the base configurable and verify it against official docs before implementation. User reports having API access; no live call has been verified here.

Request: required `goal` (up to 2000 characters) and base64 `screenshot` (PNG/JPEG/WebP, up to 4 MB); optional `previous_screenshot`, chronological action-object `steps`, and visible `elements`. The docs allow up to 50 step objects and use the last 20; strings are invalid. Element centers use the same normalized coordinates as actions.

Response: `action` with type, applicable action fields, `reason`, and `commits`; response also identifies coordinates as `0-1000`. Supported types include `click`, `double_click`, `type`, `key`, `scroll`, `wait`, `done`, and `fail`.

Twinly returns an action; it does not execute the browser or supply the live viewer. Our loop performs the action, captures the resulting browser, and calls again. Mac `/v1/tasks` and chat completions are different products and are not substitutes for this integration.

Convert coordinates using the actual screenshot dimensions and its scale relative to the CSS viewport. Prefer viewport screenshots without resizing; use device scale 1. Clamp to valid pixel indices. Store normalized coordinates, executed CSS coordinates, screenshot size, and any reliably matched DOM target. Never mix full-page screenshot coordinates with viewport clicks.

Automatic objective: inspect the current site for high-value accessibility interactions, prioritizing main navigation, then a relevant dialog or form, while respecting the state/action budgets. Twinly chooses the actions; use novelty and DOM metadata to select distinct audited checkpoints. Do not pre-script the demo route.

Default engineering budgets: 12 Twinly calls, 180 seconds for exploration, 30 seconds per provider request within the remaining budget, and a 300-second total runner deadline. These are limits, not promised latency. Record and version them; calibrate after the first real runs. Bound each checkpoint’s checks to 90 seconds and its keyboard probe to 45 seconds; close affected pages on timeout, retain completed measurements, and mark remaining checks not tested. New probe pages inherit 5-second operation and 15-second navigation timeouts. Stop on budget, cancellation, `done`, `fail`, a committing action, or three consecutive rejected actions. Feed rejected non-committing proposals and executor reasons back to Twinly so it can select another safe action within the original budgets. Keep rejected proposals out of checkpoint replay setup; preserve them in provider history and the action trail. Never invent additional states to reach three.

For a retest, also stop successfully as soon as all baseline checkpoints and their required pointer interactions have been reconstructed. Record this as a system policy event, not a Twinly `done` response. Ignore extra targets outside the frozen sample when selecting keyboard/reflow probes.

If Twinly stops before reconstruction is complete, try the baseline's recorded setup actions, followed by its same-origin URL without credentials or query parameters. For a checkpoint reached after navigation, also try its observed URL with only trailing page-local actions to reopen menus or dialogs. These are labeled system fallbacks, never Twinly exploration. Verify the stored URL/widget signature, relocate each frozen pointer target, execute it through the existing action guard, and verify the observed outcome before including it in the sample. Persist the recovered setup URL/actions for independent probes. Failed state reconstruction and missing sampled interactions remain unresolved and suppress a comparable delta. Cancellation and the total runner deadline also stop fallbacks.

## OpenAI Decisions

Use `POST https://api.openai.com/v1/decisions` with `gpt-6-luna`. Current documentation supports text/images/JSON evidence and named `predicate`, `choice`, and `score` questions. Verify concrete SDK and request schemas before implementation; use the official SDK or validated HTTP calls rather than an invented wrapper.

For one candidate finding, supply the structured observation, rule/check ID, expected/actual state, target metadata, and optional relevant screenshots. Define separate typed questions:

- `evidence_state` (choice): `observed_barrier`, `ambiguous`, `insufficient`.
- `impact_band` (choice): `low`, `moderate`, `high`, `critical`, `unclear`, with explicit observable definitions.
- `needs_review` (predicate): whether the supplied evidence requires further assessment.

Use exact categorical impact bands rather than rounding a probability-weighted score into a severity. Low means limited friction; moderate means substantial friction with an observed workaround; high means a major impediment; critical is a candidate essential-task blockage. A critical AI answer alone never creates a confirmed blocker.

Store raw answers and probabilities separately from rule verification. Use answers to annotate/sort ambiguous findings and choose a review queue. Deterministic category/rule mappings cannot be overridden. No calibrated confidence cutoff is claimed until labeled examples validate it; ambiguous model-assessed findings remain `review` regardless of confidence.

Decisions returns typed answers, not an explanation paragraph or arbitrary report object. Use evidence-derived templates for explanations and remedies. No additional generative API is required for MVP. Keep deterministic results when this service fails and show triage as unavailable. Order confirmed blockers first, then confirmed findings, then review findings, using impact and stable IDs within those groups.

## Data and live transport

Persist these concepts, with versioned JSON schemas:

- `AuditRun`: ID, lifecycle, start URL, manifest, timestamps, budgets, provider availability, runner ID, final report reference.
- `Checkpoint`: logical identity, actual URL, source action/setup goals, sampled targets, desktop/narrow evidence.
- `ActionEvent`: monotonic sequence, phase/actor, proposed/executed action, reason, outcome, before/after evidence references.
- `CheckResult`: check ID, checkpoint ID, verdict, applicability basis, sample, observations, evidence references.
- `Finding`: stable key, check result reference, affected targets, verification, impact source, remedy template, triage answers.

Events use `{ runId, seq, timestamp, type, phase, actor, payload }`. Types include `run.started`, `action.proposed`, `action.executed`, `frame.captured`, `checkpoint.selected`, `check.completed`, `finding.updated`, and `run.finished`. Actor is `twinly`, `probe`, or `system`. Lifecycle: `queued -> running -> completed | partial | failed | canceled`; lifecycle is separate from score provisionality.

Write events/frames before announcing them. Display the latest actual frame with capture time. Stream SSE events with image references, not repeated large base64 images. Support reconnection from a sequence number and polling fallback. A stale/disconnected view must be labeled; the last screenshot must not masquerade as continuing activity.

Local storage can be files outside source control. Hosted storage default: private Vercel Blob for immutable event/frame/report objects and run snapshots, through one storage adapter. A single runner writes each run; use sequence IDs and deduplication. No relational database is required initially. Verify private reads and write-to-read latency in the deployment spike.

Vercel request handlers must not own a long-lived browser or rely on process memory/local disk for run persistence. Start the runner as an independent Sandbox process, persist its ID and launch acknowledgment, and stop it after final artifact persistence. Prove it continues after the start request returns. Status must detect runner death/deadline even if the runner cannot write a final event. Do not make a five-minute audit depend on a single frontend connection surviving.

Suggested routes: `POST /api/audits`, `GET /api/audits/:id`, `GET /api/audits/:id/events`, `GET /api/audits/:id/evidence/:evidenceId`, and `POST /api/audits/:id/cancel`. These are application contracts, not existing endpoints.

The local implementation also provides `GET /api/audits` (ten recent summaries) and `GET /api/audits/:id/report.json` (finished-run attachment). Both use the same API authentication boundary as status/evidence; they do not expose provider configuration or keys.

## Concrete browsing restrictions

- Audit only public HTTP(S) targets. Reject credentials in URLs, unsupported ports/protocols, loopback/private/link-local/metadata destinations, and redirected or resolved equivalents. Cover IPv4/IPv6, subresource requests, popups, redirects, and DNS rebinding; URL string validation alone is insufficient. Enforce at the network layer where possible.
- Resolve the initial HTTP redirect chain through the IP-pinned proxy, validating each destination before following it. Record the requested URL and landing URL; restrict subsequent agent top-level navigation to the validated landing origin. Authorized local fixtures cannot redirect to another origin. Resolve programmatic navigation with the context’s shared-cookie request client and `maxRedirects: 0`, validating each hop (maximum ten). Fulfill the buffered final response at its actual URL after committing landing scope, so same-origin embedded documents see the correct scope immediately. Pointer-triggered main-document redirects abort the native redirect and use the same resolver; capture waits for completion. Embedded-document redirects remain review limitations. `route.continue()` and fulfilled redirects alone do not guarantee interception of subsequent hops. Permit required public CDN/assets under the same private-network restrictions. Reject browser downloads and escape from the audit context.
- Treat `commits: true` as a stop signal on public sites, and independently inspect actions; a false model flag is not authorization. Deny submissions including implicit Enter, destructive operations, account actions, and side-effectful navigation. Abort mutating requests in public mode and label any resulting limitations.
- Cross-site login, passwords, sensitive values, CAPTCHAs, purchases, and production submissions remain outside scope. Isolate contexts; never reuse the developer's browser profile/cookies.
- Keep provider/storage secrets outside audited page content and the frontend. Escape page-derived output. Do not publish screenshots by default.
- Use a deployment demo token/capability and a bounded launch/concurrency policy before enabling a public paid runner; no user-account feature is needed. Permit only one concurrent audit initially. If safe arbitrary-URL browsing cannot be completed, publish a clearly labeled allowlisted demo, retaining the selected real public site.

The local runner accepts public targets by default, behind the IP-pinned proxy and existing action/request restrictions. `AUDIT_PUBLIC_TARGETS=false` restores launch allowlisting via `AUDIT_ALLOWED_ORIGINS`. Binding beyond loopback still requires the demo token. This local capability does not verify hosted deployment feasibility.

## Official references

Verified by reading during planning on 2026-10-23; real integration remains untested:

- [Twinly computer-use contract](https://www.twinly.tech/docs/developer-api#computer).
- [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions).
- [Vercel Sandbox](https://vercel.com/docs/sandbox), [Functions limits](https://vercel.com/docs/functions/limitations), and [streaming](https://vercel.com/docs/functions/streaming-functions).
- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).

Navigation redirect handling follows the [Playwright routing contract](https://playwright.dev/docs/api/class-route#route-fetch), with automatic redirect following disabled during inspection.

Safe site shortcuts `/` and `?` are permitted only outside editable fields; browser/system key combinations remain blocked. The configuration API reports the loaded revision, start time, instance and source fingerprint. It compares the loaded fingerprint with source files on disk, and the interface warns about stale server code or a mismatched loaded client. No credentials are included.
