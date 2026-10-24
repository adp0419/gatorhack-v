# AccessBench

A local accessibility benchmark with real Twinly browser exploration, independent Playwright/axe measurements, evidence, and same-manifest retests across five categories.

The application runs with Node. Public deployment is deferred until the local MVP is ready. Live OpenAI Decisions triage is implemented but the configured account currently returns `429 credit_balance_exhausted`; deterministic checks and reports continue without it.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npx playwright install chromium
npm start
```

Open [AccessBench](http://127.0.0.1:3000). If `.env` does not already exist, copy `.env.example` and configure `TWINLY_KEY` and `OPENAI_API_KEY`. Keep credentials server-side. `npm run dev` restarts on source edits; restarting interrupts an active audit, so use `npm start` for the demo.

Choose **Broken website**, then **Audit the demo site**. The selector also lets you preview or audit the fixed version directly. Twinly selects browser actions; the runner records actual screenshots and independently checks the selected states. After the run, use **Use the prepared fixed fixture** and **Retest same manifest**. The site fix is a prepared developer change, not an automatic code edit by AccessBench.

Enter a public HTTP(S) URL on a standard port to audit it. Private destinations remain blocked through DNS validation and an IP-pinned browser proxy; navigation stays on the starting origin and public forms are never submitted. Set `AUDIT_PUBLIC_TARGETS=false` to restrict launches to the comma-separated `AUDIT_ALLOWED_ORIGINS` setting instead. Only the built-in, client-only validation recipe is authorized for active form testing. Entering a URL never authorizes submission.

Artifacts live in ignored `.accessbench/` directories. The start view links to the ten most recent saved runs. Saved reports reopen at `/#run/<run-id>`, with addressable finding links and retained frames. Finished runs offer **Download JSON report**, including the manifest, results, comparison and evidence references. The local Node process must remain running for an audit to continue. The interface labels saved captures and connection loss.

Retests try Twinly reconstruction first. If required states or sampled interactions remain missing, the runner tries recorded replay and then a same-origin baseline URL, labeling these as system fallbacks in the trail. State signatures and actual pointer outcomes must match; missing targets remain unverified and prevent a comparable score delta.

## Commands

```sh
npm test                 # Scoring, verdicts, guards, retest matching, persistence
npm run test:browser     # Self-contained Chromium fixtures, API and interface checks
npm run check            # JavaScript syntax and local Markdown links
npm run format:check     # Formatting
npm run spike            # Real Twinly action and Decisions request; spends provider usage
npm run audit -- https://example.com
npm run audit -- http://127.0.0.1:3000/fixtures/fixed <baseline-run-id>
npm run rehearse         # Two real broken/fixed pairs through the running local API
```

Browser tests use isolated temporary storage and deliberate provider outages; they never substitute test-provider actions into the product or spend API credits. Live spike/audit/rehearsal commands call the configured providers. Rehearsals record their real run IDs and outcomes in `.accessbench/rehearsals.json`.

## Frontend upgrade path

The frontend is vanilla HTML/CSS/JavaScript. A later frontend skill can restyle these files without changing the benchmark engine:

| File | Responsibility |
|---|---|
| `public/styles/tokens.css` | Color, typography, spacing, radius and width tokens |
| `public/styles/components.css` | Responsive component styles and focus treatment |
| `public/components.js` | Escaped presentation components and result wording |
| `public/app.js` | Routes, transport, viewer updates and focus handling |
| `public/index.html` | Semantic page structure and labeled controls |

Backend boundaries are `providers`, `browser`/`policy`, `checks`/`registry`, `scoring`/`retest`, `findings`, `store`, and `runner`. The Express API implements start, status, sequenced events (SSE plus polling), evidence reads and cancellation. One audit runs at a time through the interface. Binding beyond loopback requires `ACCESSBENCH_DEMO_TOKEN`; the browser prompts for that token without exposing provider keys.

## Scope and limitations

Scores summarize conclusive checks in the declared sample, with equal category weights. Coverage, uncertainty, N/A categories and blockers are separate. Unmeasured work is never a pass; a high provisional score can have low coverage. Results are not WCAG certification or a measure of whole-site accessibility.

Keyboard probes cover selected interactions. Reflow uses 320 CSS pixels; browser/text resizing of audited sites is deferred. Complex layouts and unproved responsive equivalence remain review. Disappeared targets and failed reconstruction remain unverified; score deltas require comparable manifests. Findings can be positively resolved in a matched checkpoint even if another checkpoint is unavailable.

## Documentation

- [Current status and verification](docs/status.md)
- [MVP](docs/mvp.md)
- [Check registry and evidence](docs/checks.md)
- [Scoring and comparison](docs/scoring.md)
- [Architecture and browsing restrictions](docs/architecture.md)
- [Interface design](docs/design.md)
- [Build plan and demo](docs/build-plan.md)

Coding agents should begin with [AGENTS.md](AGENTS.md).

Public start URLs may redirect to a validated public landing origin (for example, a bare domain to its `www` host). AccessBench records this change in the action trail and restricts exploration to the landing origin. Private destinations and later cross-origin navigation remain blocked.
