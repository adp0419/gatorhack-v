# AccessBench

AccessBench is a local AI-powered website evaluation platform for businesses: paste a URL, collect automated measurements, observe one customer journey, and review practical recommendations across **Accessibility, Design & UX, SEO, Performance, and Functionality**.

**The v2 pipeline and dashboard are implemented, with successful live PageSpeed, Twinly and Gemma 4 responses in one public evaluation.** The latest report has all four numeric categories available and an 89/100 provisional health score; one journey outcome remains uncertain. Source availability and journey completion stay separate. See [current status](docs/status.md) and the [migration plan](docs/build-plan.md).

## Updated product direction

- **PageSpeed Insights / Lighthouse:** entry-page Accessibility, SEO, and Performance scores, plus supporting Best Practices diagnostics.
- **Twinly + Playwright:** one automatically chosen, non-submitting customer journey with real browser screenshots and independently checked outcomes.
- **Gemma 4 via Google’s Gemini API:** qualitative Design & UX review, interpretation, and evidence-linked recommendations. The user chose no numeric design score.
- **Unified dashboard:** five category sections, four potential numeric scores, an overall website health score, journey result, issues, and improvements. Exact defaults and missing-data behavior live in [scoring.md](docs/scoring.md).

Continue locally with Node; deployment remains deferred. Public tests stop before sending forms, purchases, or account/data changes. Reports describe a bounded page/journey sample, not full-site certification or guaranteed business results.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npx playwright install chromium
npm start
```

Open [AccessBench](http://127.0.0.1:3000). Copy `.env.example` to `.env` if needed and configure `TWINLY_KEY`, `GEMINI_API_KEY`, and `PAGESPEED_API_KEY`. Gemma 4 is hosted by the Gemini API, so the key remains `GEMINI_API_KEY`. `GEMINI_MODEL` defaults to `gemma-4-26b-a4b-it`; the model remains configurable through the same API. A keyless PageSpeed request is supported but subject to Google's quota. Keep keys server-side. `OPENAI_API_KEY` is only used by legacy accessibility retests and legacy spike/rehearsal commands.

The interface supports URL-only evaluations, actual frames/action trails, a frozen safe journey plan and independent outcomes, five report sections, qualitative design review, four-category scoring, findings, ten recent runs, cancellation, and JSON download. Styling remains vanilla CSS with shared tokens and reusable components. Local broken/fixed fixtures exercise browser evidence; Google cannot measure local URLs. AccessBench does not modify audited sites.

Artifacts live under ignored `.accessbench/` directories. Saved reports open at `/#run/<run-id>`. Keep Node running for audits/evidence access. Use `npm run dev` for automatic backend restart during development; restarting interrupts active audits. With `npm start`, restart Node after backend changes and reload the browser after frontend changes. Loaded revision/start-time warnings help identify stale code.

Private destinations stay blocked through DNS validation and the IP-pinned browser proxy. Starting URLs may redirect to a validated public landing origin; later navigation stays on that origin. Public forms are never submitted. `AUDIT_PUBLIC_TARGETS=false` restores launch restrictions through `AUDIT_ALLOWED_ORIGINS`. Binding beyond loopback requires `ACCESSBENCH_DEMO_TOKEN`. Only server-configured client-only test recipes authorize active fixture validation.

## Current commands

```sh
npm test                 # Legacy + v2 scoring, sources, verdicts, guards, persistence
npm run test:browser     # Isolated Chromium fixtures, API and interface checks
npm run check            # JavaScript syntax and top-level local Markdown links
npm run format:check     # Source formatting
npm run spike            # Real PageSpeed + fixture Twinly/Gemma feasibility; uses credits
npm run audit -- https://example.com
npm run audit -- http://127.0.0.1:3000/fixtures/fixed <baseline-run-id>
npm run spike:legacy     # Historical Twinly + Decisions spike; uses credits
npm run rehearse         # Legacy accessibility broken/fixed pairs; uses credits
```

`audit` starts v2 by default; a finished v1 baseline keeps the legacy retest pipeline. V2 comparisons are rejected until supported. `spike` tests a public PageSpeed URL (default example.com) separately from a controlled local Twinly/Gemma journey, saves actual artifacts, and exits nonzero if a required provider or endpoint is unverified. Use `npm run audit -- https://your-public-site.example` for a full public run through the same pipeline. Browser tests use isolated harness providers, do not spend credits, and do not count as live integration evidence.

## Implementation boundaries

Reuse browser/policy, Twinly execution, storage, transport, and accessible presentation. Adapt providers, runner, checks/registry, scoring/findings, and dashboard contracts under new versions; keep legacy retest semantics. Frontend boundaries remain `public/index.html`, `public/app.js`, `public/components.js`, and `public/styles/`. No framework migration is required.

Existing accessibility reports keep their original five subcategories and score formula. They must not be relabeled as broader website health reports or compared numerically across score versions. New v2 retest UI is deferred behind the core evaluation pipeline.

## Documentation

- [Current status and verified work](docs/status.md)
- [Updated MVP and accepted decisions](docs/mvp.md)
- [Evaluation scope and evidence](docs/checks.md)
- [Health scoring and comparison policy](docs/scoring.md)
- [Architecture, providers, and browsing restrictions](docs/architecture.md)
- [Dashboard and report design](docs/design.md)
- [Migration order, acceptance, and demo](docs/build-plan.md)

Coding agents should begin with [AGENTS.md](AGENTS.md). Historical verification and the legacy accessibility check/scoring contracts are linked from the status and owner documents.
