# AccessBench

An accessibility benchmark that checks websites across five defined categories, shows Twinly exploring the site live, and helps developers verify fixes.

**Status:** local MVP working on branch `mvp`; see [docs/status.md](docs/status.md) for what has been verified and what is blocked.

## Run it locally

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium
cp .env.example .env        # then fill in TWINLY_KEY and OPENAI_API_KEY
npm run dev                 # AccessBench at http://localhost:3000 + demo site at http://localhost:4100
```

Open http://localhost:3000. Under **Try the demo site**, choose **Broken website** or **Fixed website** and press **Audit the demo site**, or enter any public website address.

### Demo: broken → fixed → retest

1. Audit the demo site with **Broken website** selected. The pointer-only "Contact" navigation is reported as a confirmed keyboard blocker.
2. On the report, set **Demo site version** to **Fixed website** (this stands in for the developer's fix; AccessBench does not edit code).
3. Press **Retest after a fix**. The retest reuses the same plan; matching findings show as **Resolved**.

`npm start` runs AccessBench alone; `npm run fixtures` runs the demo site alone; `npm run fixture:broken|fixed` switches versions from the terminal.

### Other scripts

- `npm run spike` — one live Twinly next-action and one Decisions request against the fixture (prints no keys).
- `node scripts/self-audit.js <runId>` — axe, 320 px, and keyboard checks of AccessBench's own pages.

## Docs

- [MVP](docs/mvp.md): product scope and accepted decisions.
- [Checks](docs/checks.md): the bounded checklist and evidence requirements.
- [Scoring](docs/scoring.md): scores, coverage, and comparison rules.
- [Architecture](docs/architecture.md): Twinly, Decisions, browser execution, and deployment.
- [Design](docs/design.md): live viewer, reports, and accessible interface.
- [Build plan](docs/build-plan.md): milestones, validation, and demo.
- [Status](docs/status.md): current progress and unresolved verification gates.

Coding agents should begin with [AGENTS.md](AGENTS.md) and load only the documents relevant to their task.

## Code map

- `src/server/` — Express API (`/api/audits`, SSE events, evidence) and static frontend.
- `src/runner/` — audit orchestration, Twinly exploration loop, safety executor, browser/network guard.
- `src/checks/` — check registry, axe adapter, keyboard, forms, and reflow probes.
- `src/scoring/` — pure scoring and retest comparison.
- `src/findings/` — findings, reproduction steps, remedy templates.
- `src/providers/` — Twinly and OpenAI Decisions adapters.
- `public/` — vanilla HTML/CSS/JS interface.
- `fixtures/` — controlled broken/fixed demo site.
