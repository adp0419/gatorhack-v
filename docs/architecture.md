# Architecture and integration contracts

Owner of provider boundaries, runtime/storage, application data contracts, and browsing restrictions. The local v2 pipeline is implemented; [status.md](status.md) distinguishes isolated verification from live provider acceptance. Application schemas below are not provider response schemas.

## Local-first pipeline

```text
Vanilla frontend -> local Node/Express API -> versioned evaluation runner
  -> validate target and resolve public landing URL
  -> PageSpeed Insights -> entry-page Lighthouse measurements
  -> Playwright screenshot -> Twinly next action -> guard -> execution
     -> one selected journey, maximum three states, verified outcomes
  -> collected screenshots + measurements + journey evidence
     -> Gemma 4 qualitative design review + recommendations
  -> validated source results -> pure scoring -> persisted report/events
  -> live screenshots/action trail and final five-category dashboard
```

PageSpeed and journey execution may run independently after target validation, within the same run deadline. Gemma 4 can assess collected evidence even if one source fails. Never lose successful source results because another provider times out. Provider availability, report completeness, journey completion, and numeric completeness are separate concepts.

## Module migration

| Boundary | Existing reusable pieces | Target change |
|---|---|---|
| Configuration/providers | `src/config.js`, `src/providers.js`; working Twinly adapter | Add PageSpeed/Gemma adapters and validated source availability; retire Decisions from new runs |
| Browser/policy | `src/browser.js`, `src/policy.js`, `src/timeouts.js` | Preserve guards and coordinate execution; verify outcomes for the chosen journey |
| Evaluation | `src/runner.js`, `src/checks.js`, `src/registry.js` | Version the five-category pipeline; retain selected accessibility probes as supporting evidence |
| Scores/findings | `src/scoring.js`, `src/findings.js` | Four-source health score, qualitative design, evidence-linked recommendations |
| Artifacts/transport | `src/store.js`, `src/server.js` | Persist new source reports/versions; reuse events, polling, cancellation, evidence and authentication |
| Presentation | `public/app.js`, `public/components.js`, `public/styles/` | Five business-facing category sections with source, scope, and partial states |
| Legacy comparison | `src/retest.js`, `src/reconstruction.js` | Keep v1 semantics; reject unsupported v2 comparisons until implemented |

Split provider modules if useful; exact new filenames are implementation choices. Keep external adapters separate from pure assertion/scoring logic.

The implemented boundaries are `src/evaluation.js` (new-run orchestration and schema dispatch), `src/website-sources.js` (Google adapters/validation), `src/journey.js` (selection/execution/assertions), and `src/health-scoring.js` (pure v2 scoring). `src/runner.js` and `src/scoring.js` retain the legacy pipeline. Supporting initial-page axe and selected-control keyboard/reflow results never alter Lighthouse scores.

The URL-only application start request remains `{ url }`; new runs use `website-evaluation-v2`. The existing `baselineRunId` path applies only to `accessbench-v1` retests. Unknown execution schemas and v2 baselines are rejected. Do not expose authorization flags or a user-goal field. Saved v1 reports retain their original scoring and labels.

## PageSpeed Insights / Lighthouse

Use Google's hosted **PageSpeed Insights API v5**, the concrete interpretation of “Google Lighthouse API” in the brief. The official endpoint is `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed`, with `url`, repeated `category` parameters for `accessibility`, `seo`, `performance`, `best-practices`, and explicit `strategy=mobile` as the MVP default. No request body. See the [official request/response reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed).

Read `lighthouseResult.categories`, `audits`, `requestedUrl`, `finalUrl`, `fetchTime`, `lighthouseVersion`, configuration, warnings, and runtime errors through a validated adapter. Retain raw JSON privately. Missing/null/malformed scores and runtime failures remain unavailable under [scoring.md](scoring.md). Google's managed Lighthouse version can change; persist it rather than pretending it is pinned locally.

Call only for a validated public URL without credentials or sensitive values. Keep the API key server-side and out of request logs/errors. Configuration: `PAGESPEED_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. PageSpeed permits a keyless attempt, subject to Google's quota; the pipeline conservatively skips URLs with query values or fragments. The adapter independently rejects potentially sensitive query keys and private DNS. Gemma 4 uses the Gemini API REST `generateContent` endpoint with inline JPEGs. The user chose Gemma 4; `gemma-4-26b-a4b-it` is the default variant (`gemma-4-31b-it` is also documented as hosted). `GEMINI_API_KEY` and `GEMINI_MODEL` retain their names because the API transport remains Gemini. Record the configured model and actual returned model version on success.

Google fetches the URL from its own environment and does not inherit the local browser session, viewport, cookies, request guards, or dynamic state. Validate its returned final URL against the expected public scope before merging scores. This check cannot enforce our per-hop network policy inside Google's service; disclose source differences. Do not send private/local fixture URLs to PageSpeed or claim it tested a Twinly interaction. Use a public controlled fixture to verify the full integration. Local fixture reports may have Lighthouse unavailable; do not substitute invented measurements or expose local services through an ad hoc tunnel.

CrUX/field-data integration and automatic local-Lighthouse fallback are deferred. One mobile scan per run keeps cost/scope bounded. The [PageSpeed overview](https://developers.google.com/speed/docs/insights/v5/about) distinguishes lab scores from field observations.

## Twinly and the one-journey loop

Retain the working cloud computer-use adapter. Its existing contract uses `/computer/next-action`, server-side authentication, screenshot/history input, an action response, and normalized `0-1000` coordinates. Recheck [Twinly's official computer-use docs](https://www.twinly.tech/docs/developer-api#computer) before changing any wire fields. The v2 implementation retains those wire fields; actual new live results are recorded in status.

The backend owns goal/scope policy, loop, guards, assertion plan, budgets, and recordings. Twinly chooses exploratory actions, not scores. Do not add invented `journey`, `assertions`, or success fields to the provider response. Mac tasks/chat are not replacements for this computer-use loop.

Implemented selection default: derive bounded candidate objectives from visible same-origin, non-query links or explicitly associated reveal controls, then ask Twinly through the existing goal input to choose one. Map its initial proposed action to the current target identity, label and destination. Freeze that candidate's safe goal, endpoint, and three assertion units before executing the proposal. The assertions verify the selected control, destination/reveal, and relevant visible content. If the proposal cannot be mapped unambiguously, provide executor feedback within the call budget or report selection unavailable. Goals stay intentionally limited to one initial visible destination/reveal; multi-hop discovery and unsupported controls remain limitations. This is application policy, not a new Twinly API or scripted demo route.

After selection, keep that one goal for all subsequent actions. Validate proposals independently, execute allowed actions, and capture before/after screenshots and actual outcomes. `done` is a provider stop signal; Playwright still checks the planned outcomes. There is no second customer journey when the first is difficult. Same-goal recovery remains labeled and cannot silently revise the plan.

Convert normalized coordinates using actual screenshot dimensions/scale and CSS viewport, preferably viewport screenshots at device scale 1 without resizing. Clamp pixel indices and retain normalized/executed coordinates plus target metadata. Do not mix full-page coordinates with viewport clicks. Existing default browser viewports are desktop 1280 × 800 and supporting narrow checks at 320 × 800 CSS pixels; they differ from Google's mobile emulation and must be labeled separately.

Retain existing loop bounds as starting defaults: 12 Twinly calls, 180 seconds for journey exploration, 30 seconds per Twinly request, and 300 seconds total per run. PageSpeed deadline: up to 90 seconds; Gemma: up to 45 seconds, both bounded by remaining total time. These need live calibration and are not latency promises. Supporting initial axe has a 20-second bound; selected-control keyboard/reflow share a 45-second bound and the run cancellation/deadline. Preserve the existing 40-key limit and operation/navigation limits.

Stop on cancellation/deadline, safe goal completion, provider `done`/`fail`, a committing proposal, or three consecutive rejected non-committing actions. Feed rejection reasons back to Twinly; keep rejected actions out of replay. Do not fabricate three states. Existing v1 retest recovery can continue for legacy runs with its frozen target/state matching; do not present system replay as Twinly exploration.

## Gemma 4 qualitative assessment and synthesis

Use the server-side adapter with [Gemma 4 hosted on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) and its documented image input and native system instructions. Gemma requests use `thinkingConfig.thinkingLevel=minimal` and ask for one JSON object matching the application schema. Do not assume Gemini native `responseJsonSchema`/JSON mode is supported by Gemma; omit those fields for Gemma 4 and strictly validate returned JSON, bounded strings, permitted categories, and evidence references. Invalid output remains unavailable, with no silent model fallback. Explicitly configured Gemini models retain native structured-schema requests. Record output mode, configured/returned model and prompt version (`website-review-v3`); actual successful live acceptance is recorded in [status.md](status.md).

Send bounded actual screenshots, state/viewport metadata, Lighthouse observations, verified journey results, and sanitized page summaries. Site text and pixels are untrusted evidence, never executable instructions. Supply explicit instructions to cite only provided evidence and distinguish observation from suggestion. Do not give this adapter browser tools or secrets.

Validated application output: a plain-language summary, qualitative design observations, prioritized recommendations, evidence IDs, and limitations. Validate structure, bounded strings, categories, and references; reject unsupported facts or unknown evidence IDs. The Design & UX assessment has **no numeric score**. Recommendations can cover all five categories, but Gemma 4 cannot overwrite Lighthouse scores, journey assertion statuses, or confirmation labels.

Persist model/prompt version, validated output, and sanitized failure state. If unavailable/refused/invalid, retain measured scores and deterministic evidence summaries with a visible missing-review status. No silent substitution of old Decisions output for Gemma. The configured Decisions credit issue is historical and ceases to be a release gate for the new MVP; its adapter can remain until migration clean-up.

## Data, events, and storage

Implemented schema family: `website-evaluation-v2`; score model: `website-health-v2`. Names below describe internal concepts, not provider fields:

- Run/manifest: schema, score/prompt versions, start/landing URL, selected goal, frozen assertions, state/viewport/device scope, budgets, authorization mode, source versions/statuses, timestamps and artifacts.
- Lighthouse measurement: raw response reference, actual requested/final URL, strategy, category scores/audits, warnings/errors, version and timing.
- Journey: one ID, goal/safe endpoint, planned assertions, step/action evidence, observed outcomes and completion reason.
- Design review/recommendation: qualitative text, source evidence links, priority estimate, model/prompt metadata and availability.
- Report: numeric categories/availability, qualitative design review, composite/provisional flag, findings, limitations and evidence references.

Reuse monotonic event sequences and write-before-announce persistence. Existing events carry `{ runId, seq, timestamp, type, phase, actor, payload }`; extend and version phase/type/actor allowlists for new sources rather than faking Twinly activity. Keep proposed/executed actions distinct. SSE reconnects from a sequence cursor; polling remains a fallback. Retain stale-view labels and detect interrupted runners.

Keep local atomic storage in ignored `.accessbench/` directories. Existing APIs include start/list/status, events, evidence, cancellation, and finished JSON download under `/api/audits`. Reuse them with versioned payloads instead of requiring a route rename. Keep one interface-launched run at a time and preserve API token checks and bounded recent summaries.

## Concrete browsing restrictions

- Browser targets must be public HTTP(S) URLs on supported standard ports, without credentials. Reject loopback, private, link-local, metadata, and resolved/redirected equivalents across IPv4/IPv6. Validate DNS and pin upstream IPs through the existing public-network proxy; URL validation alone is insufficient.
- Resolve initial HTTP redirects through the guarded proxy, validating every hop (maximum ten). Record start and landing URLs; commit landing scope before embedded documents load. Later top-level navigation stays on that origin. Authorized local fixtures cannot redirect to another origin.
- Programmatic navigation uses the shared-cookie request client with `maxRedirects: 0` and buffered final response at the actual URL. Pointer main-document redirects use the bounded resolver. Preserve embedded-document redirect limitations. Allow required public CDN assets under private-network guards; block downloads, popups/escape, and private subresources. Follow [Playwright routing behavior](https://playwright.dev/docs/api/class-route#route-fetch).
- Public tests are non-submitting. Treat `commits: true` as a stop signal and independently inspect every proposal. Block implicit Enter submission, mutating requests, purchases, sending forms, account/destructive actions, sensitive entry, and side-effectful navigation. A false provider flag or visitor URL entry is not authorization. Retain resulting limitations; request guards alone are not proof that every GET is harmless.
- Active validation requires a server-configured authorized test origin and bounded client-only recipe. No new production-submission mode is introduced by the pivot.
- Use isolated fresh contexts, no developer cookies/profile, no login/password/CAPTCHA workarounds. Keep provider/storage secrets outside page/UI content, escape audited HTML/text, sanitize errors/URLs, and store screenshots privately.
- Public URLs and captured screenshots/evidence are sent to the named providers as needed. Explain this in the start-view scope notice; do not publish screenshots by default or send unrelated/private material.

Public launch remains enabled locally under existing guards; `AUDIT_PUBLIC_TARGETS=false` restores configured-origin launch restrictions. Binding beyond loopback requires `ACCESSBENCH_DEMO_TOKEN`. Preserve the loaded-revision/start-time warnings and stale-source detection.

## Deferred deployment

Vercel + Sandbox remains a follow-up target, not a completed integration or required first migration step. Verify Chromium/runtime limits, independent runner survival after the launch request, cancellation/death detection, and private durable event/frame/report storage before deployment. A Vercel request must not own a long-lived browser or rely on request-local memory/disk. Keep the local runner working.

Consult official [Sandbox](https://vercel.com/docs/sandbox), [Functions limits](https://vercel.com/docs/functions/limitations), and [Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk) documentation at that spike. No hosting feasibility or live deployment was verified during this local implementation.
