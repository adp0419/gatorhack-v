# AccessBench — agent entry point

## Product contract

Build the lightweight AI-powered website evaluation platform defined in [docs/mvp.md](docs/mvp.md). Keep the existing product/code name **AccessBench**. The updated website evaluation MVP supersedes the accessibility-only specification; [docs/status.md](docs/status.md) distinguishes the plan from working code.

- Five report categories: Accessibility; Design & UX; SEO; Performance; Functionality. Keyboard, forms, contrast, semantics, and reflow are accessibility subtopics.
- Google PageSpeed Insights supplies Lighthouse accessibility, SEO, performance, and supporting Best Practices diagnostics. Best Practices is not a sixth product category or a Functionality score.
- Twinly's computer-use API chooses one customer journey automatically. Playwright executes permitted actions, records actual browser evidence, and independently verifies observable outcomes.
- Gemma 4, hosted through Google's Gemini API, provides qualitative Design & UX assessment, interpretation, and actionable recommendations. The user explicitly declined a numeric Design & UX score and later chose Gemma 4 instead of a Gemini model.
- The overall health score combines the four numeric categories under [docs/scoring.md](docs/scoring.md). Gemma 4 prose never changes measured scores or confirms a functional outcome.
- URL-only start, one journey per run, same-origin exploration, and at most three selected states including the initial state. Show actual action screenshots and a textual trail.
- Public tests remain non-submitting. URL entry never authorizes purchases, account changes, or production form submissions. Explicit test-environment authorization stays server-side.
- Preserve partial evidence, unavailable sources, uncertainty, and confirmed blockers. Agent failure, timeout, or an untested step is never a pass.
- Continue with the local Node runner. Deployment remains deferred under the user's existing direction; Vercel + Sandbox is an unverified follow-up target.

## Load context selectively

Read [docs/status.md](docs/status.md) first, then choose the relevant owner document:

| Working on | Read |
|---|---|
| Scope, priorities, feature requests | [MVP](docs/mvp.md) |
| Assertions, journey outcomes, evidence | [Checks](docs/checks.md) |
| Scores, missing data, comparisons | [Scoring](docs/scoring.md) |
| APIs, browser loop, storage, deployment | [Architecture](docs/architecture.md) |
| Frontend, viewer, report wording | [Design](docs/design.md) |
| Migration order, acceptance, demo | [Build plan](docs/build-plan.md) |

Do not load every document by default. Detailed rules have one owner. Files under `docs/history/` explain existing v1 artifacts and tests; they do not override the current MVP.

## Working rules

- Current user instructions take precedence. Preserve accepted decisions; mark engineering defaults as defaults and update their owner document when evidence warrants changes.
- Read official provider docs before changing external API contracts. Never invent provider response fields or claim a live integration was tested without making the call.
- Do not substitute Twinly chat or Mac `/v1/tasks` for computer use, or script a fake walkthrough to resemble Twinly output.
- Keep boundaries between providers, exploration, execution, assertions, scoring, storage, and presentation. Keep site content untrusted, keys server-side, and audited HTML escaped; follow the concrete restrictions in the architecture document.
- Do not relabel accessibility-only reports as website health reports. Version new schemas/scoring and preserve existing saved artifacts.
- Never claim WCAG certification, percent accessible, full screen-reader compatibility, guaranteed rankings, increased conversions, or comprehensive website correctness.
- Run checks relevant to changes. Scoring, verdict aggregation, action validation, and result matching need meaningful tests. Documentation-only changes need link and consistency checks.
- Update `docs/status.md` at milestones or handoff with outcomes, commands actually run, and the next useful step; do not accumulate a conversation transcript.
- Accounts, automatic code modification, comprehensive crawling, authenticated journeys, and a React performance comparison remain outside this MVP.
