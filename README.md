# AccessBench

An accessibility benchmark that checks websites across five defined categories, shows Twinly exploring the site live, and helps developers verify fixes.

**Status:** product planning complete; application implementation has not started. Two builders, 48-hour hackathon MVP.

## Start here

- [MVP](docs/mvp.md): product scope and accepted decisions.
- [Checks](docs/checks.md): the bounded checklist and evidence requirements.
- [Scoring](docs/scoring.md): scores, coverage, and comparison rules.
- [Architecture](docs/architecture.md): Twinly, Decisions, browser execution, and deployment.
- [Design](docs/design.md): live viewer, reports, and accessible interface.
- [Build plan](docs/build-plan.md): milestones, validation, and demo.
- [Status](docs/status.md): current progress and unresolved verification gates.

Coding agents should begin with [AGENTS.md](AGENTS.md) and load only the documents relevant to their task.

## Intended stack

Vanilla HTML/CSS/JavaScript, Node.js/Express, Playwright, axe-core, Twinly computer use, and OpenAI Decisions. Public deployment targets Vercel plus Vercel Sandbox; local execution remains supported.

There is no runnable app, package manifest, deployment, or verified setup command yet. Add real setup instructions here when the first working slice exists.
