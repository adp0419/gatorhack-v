# AccessBench — agent entry point

## Product contract

Build the two-person, 48-hour accessibility benchmark defined in [docs/mvp.md](docs/mvp.md). The product name is **AccessBench**. This documentation replaces the removed `docs/context.md` specification.

- Five categories: keyboard operation; forms and validation; text contrast; structure and semantics; zoom and reflow.
- Twinly's computer-use API chooses exploratory browser actions. Playwright executes those actions and performs independent measurements and keyboard probes.
- Automatically explore same-origin pages and interactions; audit at most three selected states, including the initial state.
- Show the real browser live through action-by-action screenshots and a textual action trail.
- Confirm measurable results with deterministic evidence. Decisions triages ambiguous evidence and priority; its judgments never directly change scores.
- Equal category weights; score each check once per tested state. Show coverage, uncertainty, N/A categories, and confirmed blockers separately. No score cap or severity-based deductions.
- Public sites receive non-submitting checks. Active validation requires an explicitly authorized test environment.
- MVP reflow checks use 320 CSS pixels. Dedicated 200% text-resizing tests are deferred.
- Keyboard probes cover selected interactions, not every interactive control.
- Public deployment target: Vercel + Sandbox, pending feasibility verification. Keep a local runner.

## Load context selectively

Read [docs/status.md](docs/status.md) first, then choose the relevant owner document:

| Working on | Read |
|---|---|
| Scope, priorities, feature requests | [MVP](docs/mvp.md) |
| Assertions, evidence, WCAG mappings | [Checks](docs/checks.md) |
| Scores, coverage, comparisons | [Scoring](docs/scoring.md) |
| APIs, browser loop, storage, deployment | [Architecture](docs/architecture.md) |
| Frontend, viewer, report wording | [Design](docs/design.md) |
| Implementation order, acceptance, demo | [Build plan](docs/build-plan.md) |

Do not load every document by default. Each detailed rule has one owner; link to it instead of copying it into other files. This entry point contains only a compact set of product invariants.

## Working rules

- Current user instructions take precedence over these docs. Preserve accepted decisions unless the user changes them.
- The exact checklist, engineering budgets, schema, and visual tokens below are implementation defaults selected after the interview, not additional user promises. Change defaults when evidence warrants it; update their owner document.
- Read official provider docs before changing external API contracts. Never invent response fields or claim a live integration was tested without making the call.
- Do not substitute Twinly chat or Mac `/v1/tasks` for the computer-use loop. Do not script a fake exploratory walkthrough to resemble Twinly output.
- Keep module boundaries between exploration, action execution, assertions, scoring, storage, and presentation. An optional future user goal must not require rewriting the test engine.
- Do not silently treat review, skipped checks, unsupported layouts, or agent failure as a pass. A timeout alone does not prove a keyboard barrier.
- Keep site content untrusted, provider keys server-side, and audited HTML escaped. Implement the concrete browsing restrictions in the architecture document.
- Never label results as WCAG certification, percent accessible, disability simulation, or full screen-reader compatibility.
- Run checks relevant to the change. Scoring, verdict aggregation, action validation, and retest matching need meaningful tests; documentation-only edits need link and consistency checks.
- Update `docs/status.md` at implementation milestones or handoff. Record outcomes, commands actually run, and the next useful step; do not accumulate a conversation transcript.
- Do not add features from the retired specification. Accounts, automatic code modification, comprehensive crawling, and a React performance comparison are outside this MVP.
