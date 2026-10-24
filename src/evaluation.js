import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { BUDGETS, VIEWPORTS, WEBSITE_VERSIONS, config } from "./config.js";
import { openBrowser, state } from "./browser.js";
import { parseTarget, resolvePublic } from "./policy.js";
import { nextAction } from "./providers.js";
import { runAudit } from "./runner.js";
import { runJourney } from "./journey.js";
import { measurePage, reviewWebsite } from "./website-sources.js";
import { scoreWebsite } from "./health-scoring.js";
import { axeChecks, keyboardChecks, reflowChecks, restore } from "./checks.js";
import { findingsFromResults } from "./findings.js";
import { withPageDeadline } from "./timeouts.js";

const require = createRequire(import.meta.url);
export const isWebsiteRun = (run) =>
  run.manifest?.versions?.schema === WEBSITE_VERSIONS.schema;
export const isLegacyRun = (run) =>
  run.manifest?.versions?.schema === "accessbench-v1";

export function newWebsiteRun(url, fixtureOrigin) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    url,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    seq: 0,
    providers: { pagespeed: "pending", twinly: "pending", gemini: "pending" },
    sources: {
      lighthouse: { status: "pending" },
      design: { status: "pending", model: config.geminiModel },
    },
    results: [],
    findings: [],
    checkpoints: [],
    errors: [],
    journey: {
      status: "unavailable",
      goal: null,
      safeEndpoint: null,
      assertions: [],
      stop: "Not started",
    },
    manifest: {
      versions: WEBSITE_VERSIONS,
      runtime: {
        node: process.versions.node,
        playwright: require("playwright/package.json").version,
      },
      viewports: VIEWPORTS,
      lighthouseStrategy: "mobile",
      budgets: BUDGETS,
      authorization:
        new URL(url).origin === fixtureOrigin
          ? "configured-client-only-validation"
          : "public-non-submitting",
      policy: "landing-origin-pinned-proxy-v3",
      checkpoints: [],
    },
  };
}

// Recover from persisted observations, which may be newer than the last score
// snapshot when the process died between two events.
export function interruptWebsiteRun(run, reason) {
  if (!isWebsiteRun(run)) return;
  if (!["completed", "blocked"].includes(run.journey?.status)) {
    run.journey = {
      ...run.journey,
      status: run.journey?.assertions?.length ? "partial" : "unavailable",
      stop: reason,
    };
  }
  for (const [key, provider] of [
    ["lighthouse", "pagespeed"],
    ["design", "gemini"],
  ]) {
    if (run.sources[key]?.status === "pending") {
      run.sources[key] = { ...run.sources[key], status: "unavailable", reason };
      run.providers[provider] = "unavailable";
    }
  }
  if (run.providers.twinly === "pending") run.providers.twinly = "unavailable";
  run.summary = {
    ...scoreWebsite({
      lighthouse: run.sources.lighthouse,
      journey: run.journey,
      design: run.sources.design,
    }),
    provisional: true,
    reportPartial: true,
  };
  run.findings = websiteFindings(run);
}

// Provider failures are deliberately source-local. One outage must never erase
// another provider's measurements or the browser's saved observations.
export async function runEvaluation(run, options) {
  if (isLegacyRun(run)) return runAudit(run, options);
  if (!isWebsiteRun(run)) throw new Error("Unsupported evaluation schema");
  const {
    store,
    fixtureOrigin,
    signal,
    provider = nextAction,
    pageProvider = measurePage,
    designProvider = reviewWebsite,
    journeyRunner = runJourney,
    browserFactory = openBrowser,
    lookup,
  } = options;
  const deadline = AbortSignal.timeout(BUDGETS.totalMs);
  const combined = AbortSignal.any([
    signal || new AbortController().signal,
    deadline,
  ]);
  let session, measurementsTask;
  const emit = (type, phase, actor, payload) =>
    store.append(run, type, phase, actor, payload);
  const summarize = () => {
    for (const result of run.results) {
      result.url ||= run.landedUrl || run.url;
      result.source ||= "Supporting Playwright / axe checks";
    }
    run.summary = scoreWebsite({
      lighthouse: run.sources.lighthouse,
      journey: run.journey,
      design: run.sources.design,
    });
    run.findings = websiteFindings(run);
  };
  const source = async (name, phase, operation) => {
    await emit("source.started", phase, name, { source: name });
    try {
      const response = await operation();
      if (response.raw)
        await store.write(run.id, `${name}-raw.json`, response.raw);
      const { raw: _raw, ...normalized } = response;
      return normalized;
    } catch (error) {
      if (error.raw) await store.write(run.id, `${name}-raw.json`, error.raw);
      // External response text/URLs/credentials are never forwarded as errors.
      const reason = safeError(error, name);
      run.errors.push(reason);
      return { status: "unavailable", reason };
    }
  };
  const startMeasurements = (url) => {
    if (measurementsTask) return;
    measurementsTask = (async () => {
      run.sources.lighthouse = await source(
        "pagespeed",
        "Page measurements",
        async () => {
          combined.throwIfAborted();
          if (new URL(url).origin === fixtureOrigin)
            throw new Error(
              "Local fixtures cannot be measured by Google's hosted PageSpeed service",
            );
          const target = parseTarget(url);
          if (target.search || target.hash)
            throw new Error(
              "PageSpeed requires a URL without query values or fragments",
            );
          await resolvePublic(target.hostname, lookup);
          return pageProvider({ url: target.href, signal: combined });
        },
      );
      run.providers.pagespeed = run.sources.lighthouse.status;
      summarize();
      await emit("source.completed", "Page measurements", "pagespeed", {
        status: run.providers.pagespeed,
      });
    })();
    measurementsTask.catch(() => {});
  };
  try {
    run.status = "running";
    run.runnerPid = process.pid;
    run.startedAt = new Date().toISOString();
    run.deadlineAt = new Date(Date.now() + BUDGETS.totalMs).toISOString();
    await emit("run.started", "Customer journey", "system", {
      url: run.url,
      versions: WEBSITE_VERSIONS,
    });
    combined.throwIfAborted();
    session = await browserFactory({
      origin: new URL(run.url).origin,
      fixtureOrigin,
      signal: combined,
    });
    combined.throwIfAborted();
    run.manifest.runtime.chromium = session.browser.version();
    run.landedUrl = await session.navigateStart(run.url);
    combined.throwIfAborted();
    run.manifest.navigationOrigin = new URL(run.landedUrl).origin;
    // Both sources start from the validated landing URL. Google's session is
    // independent, but a normal www/HTTPS redirect need not discard its scores.
    startMeasurements(run.landedUrl);
    if (new URL(run.url).origin !== new URL(run.landedUrl).origin)
      await emit("scope.updated", "Customer journey", "system", {
        requestedUrl: run.url,
        landedUrl: run.landedUrl,
        reason:
          "Initial redirect validated. Journey stays on the landing origin; PageSpeed measures its separate entry-page load.",
      });
    const initialFrame = await store.frame(
      run,
      session.page,
      "Customer journey",
      "system",
    );
    const initial = await state(session.page);
    combined.throwIfAborted();
    run.evidence = [
      {
        id: initialFrame,
        url: initial.url,
        heading: initial.heading,
        text: initial.text.slice(0, 6000),
        viewport: VIEWPORTS.desktop,
      },
    ];
    try {
      // Static initial-page evidence is advisory and has no extra score weight.
      const checks = await withPageDeadline(
        20_000,
        () => [],
        () => axeChecks(session.page, "state-1", initialFrame),
      );
      await store.write(run.id, "axe-state-1.json", checks.raw);
      run.results = checks.results;
    } catch {
      run.errors.push(
        "Supporting accessibility checks were unavailable; Lighthouse scores are unaffected.",
      );
    }
    try {
      run.journey = await journeyRunner({
        run,
        store,
        session,
        provider,
        signal: combined,
        emit,
      });
    } catch (error) {
      // The journey module updates run.journey after freezing the plan, so a
      // cancellation retains its original denominator and partial evidence.
      run.journey = {
        ...run.journey,
        status: run.journey.assertions?.length ? "partial" : "unavailable",
        stop: signal?.aborted
          ? "Canceled by user"
          : "Journey execution interrupted",
      };
      run.errors.push(safeError(error, "journey"));
    }
    run.explorationComplete = run.journey.status === "completed";
    run.explorationStop = run.journey.stop;
    const selected = run.journey.steps?.[0];
    if (!combined.aborted && selected?.changed && selected.target) {
      let probe;
      try {
        probe = await session.context.newPage();
        const record = async (page, phase, actor, details) => {
          const evidenceId = await store.frame(run, page, phase, actor);
          await emit("probe.observed", phase, actor, {
            ...details,
            evidenceId,
          });
          return evidenceId;
        };
        await withPageDeadline(
          BUDGETS.keyboardProbeMs,
          () => [probe],
          async () => {
            const keyboard = await keyboardChecks({
              page: probe,
              url: run.landedUrl,
              setupActions: [],
              selected: [selected],
              checkpointId: "state-1",
              record,
              signal: combined,
            });
            run.results.push(...keyboard);
            await restore(probe, run.landedUrl, []);
            run.results.push(
              ...(await reflowChecks(probe, "state-1", [selected], record, {
                url: run.landedUrl,
                setupActions: [],
              })),
            );
          },
        );
      } catch {
        run.errors.push(
          "Selected-control keyboard/reflow evidence is incomplete. Supporting checks do not change Lighthouse scores.",
        );
      } finally {
        await probe?.close().catch(() => {});
      }
    }
    await measurementsTask;
    if (combined.aborted) throw combined.reason;
    const frames = new Map(
      (run.checkpoints || [])
        .filter((c) => c.evidenceId)
        .map((c) => [c.evidenceId, c]),
    );
    frames.set(initialFrame, {
      id: "state-1",
      url: initial.url,
      evidenceId: initialFrame,
    });
    const screenshots = [];
    for (const [id, checkpoint] of [...frames].slice(0, 3)) {
      screenshots.push({
        id,
        data: (await store.read(run.id, `${id}.jpg`)).toString("base64"),
        viewport: VIEWPORTS.desktop,
      });
      if (!run.evidence.some((e) => e.id === id))
        run.evidence.push({
          id,
          stateId: checkpoint.id,
          url: checkpoint.url,
          viewport: VIEWPORTS.desktop,
        });
    }
    for (const assertion of run.journey.assertions || []) {
      for (const id of assertion.evidenceIds || []) {
        if (!run.evidence.some((e) => e.id === id))
          run.evidence.push({
            id,
            source: "Playwright journey observation",
            assertionId: assertion.id,
            status: assertion.status,
            observation: assertion.reason,
            viewport: VIEWPORTS.desktop,
          });
      }
    }
    for (const result of run.results) {
      result.url ||= run.landedUrl;
      result.source ||= "Supporting Playwright / axe checks";
      run.evidence.push({
        id: `support-${result.checkpointId}-${result.checkId}`,
        source: result.source,
        method: result.method,
        timestamp: result.timestamp,
        url: result.url,
        viewport: result.viewport,
        status: result.status,
        observation: result.reason,
        evidenceIds: result.evidenceIds,
      });
    }
    if (run.sources.lighthouse.status === "available")
      run.evidence.push({
        id: "lighthouse-report",
        source: "PageSpeed Insights",
        strategy: "mobile",
        url: run.sources.lighthouse.finalUrl,
      });
    run.sources.design = await source("gemini", "Design review", () =>
      designProvider({
        screenshots,
        evidence: run.evidence,
        measurements: run.sources.lighthouse,
        journey: run.journey,
        signal: combined,
      }),
    );
    run.providers.gemini = run.sources.design.status;
    run.sources.design.model ||= config.geminiModel;
    if (run.sources.design.model)
      run.manifest.gemini = {
        model: run.sources.design.model,
        modelVersion: run.sources.design.modelVersion,
        outputMode: run.sources.design.outputMode,
        promptVersion: run.sources.design.promptVersion,
      };
    await emit("source.completed", "Design review", "gemini", {
      status: run.providers.gemini,
    });
  } catch (error) {
    run.errors.push(safeError(error, deadline.aborted ? "deadline" : "runner"));
  } finally {
    // Browser failure does not prevent a separately validated PageSpeed scan.
    if (!measurementsTask) startMeasurements(run.url);
    if (measurementsTask)
      await measurementsTask.catch(() => {
        run.errors.push("Page measurements could not be persisted.");
      });
    for (const [key, name] of [
      ["lighthouse", "pagespeed"],
      ["design", "gemini"],
    ]) {
      if (run.sources[key].status === "pending") {
        run.sources[key] = {
          ...run.sources[key],
          status: "unavailable",
          reason: "Evaluation ended before this source could complete.",
        };
        run.providers[name] = "unavailable";
      }
    }
    if (run.providers.twinly === "pending")
      run.providers.twinly = "unavailable";
    run.networkLimitations = session?.restrictions || [];
    if (run.networkLimitations.length)
      run.errors.push(
        `${run.networkLimitations.length} browser requests or popups were blocked. Journey observations cover loaded content only.`,
      );
    summarize();
    if (signal?.aborted || deadline.aborted || run.networkLimitations.length)
      run.summary.reportPartial = true;
    run.status = signal?.aborted
      ? "canceled"
      : run.summary.reportPartial ||
          run.networkLimitations.length ||
          deadline.aborted
        ? "partial"
        : "completed";
    run.finishedAt = new Date().toISOString();
    run.elapsedMs =
      Date.parse(run.finishedAt) - Date.parse(run.startedAt || run.createdAt);
    await session?.close();
    await store.write(run.id, "report.json", run);
    await emit("run.finished", "Preparing recommendations", "system", {
      status: run.status,
      summary: run.summary,
    });
  }
  return run;
}

function safeError(error, source) {
  // Keep useful operational detail only when it cannot contain site text or a
  // key-bearing provider URL. All raw source responses remain private artifacts.
  const message = String(error?.message || "Unavailable");
  const known =
    /^(Local fixtures cannot|PageSpeed requires|Provider credential|Gemini credential|PageSpeed credential)/.test(
      message,
    ) ||
    [
      "Gemini review was refused, incomplete, or unavailable.",
      "Gemini review was not valid JSON.",
      "Gemini returned unsupported review content.",
      "Gemini review contained invalid fields or unknown evidence references.",
      "Gemini evidence exceeds the review budget.",
      "Gemini review requires bounded actual screenshots.",
      "Gemini request canceled or timed out.",
      "Gemini request failed.",
      "Gemini returned invalid JSON.",
      "Configure a compatible Gemini model.",
      "PageSpeed request failed.",
      "PageSpeed returned invalid JSON.",
    ].includes(message);
  const http = message.match(/HTTP (\d{3})/);
  return `${source}: ${known ? message : http ? `Provider returned HTTP ${http[1]}` : /abort|cancel/i.test(message) ? "Canceled or deadline exceeded" : "Source or execution unavailable"}`;
}

export function websiteFindings(run) {
  const findings = findingsFromResults(run.results).map((f) => ({
    ...f,
    category: "accessibility",
    source: "Supporting Playwright / axe checks",
    verification: f.verification === "confirmed" ? "automated" : "review",
  }));
  const make = (
    key,
    category,
    source,
    title,
    observed,
    remedy,
    evidenceIds = [],
    extra = {},
  ) => ({
    key,
    category,
    source,
    title,
    observed,
    remedy,
    evidenceIds,
    checkId: key,
    checkpointId: "Tested scope",
    target: run.landedUrl || run.url,
    verification: "automated",
    impact: "unclear",
    impactSource: "unavailable",
    blocker: false,
    reason: observed,
    expected: "See the source observation and recommended improvement.",
    affectedCount: 1,
    wcag: [],
    targets: [],
    reproduction: [
      "Open the recorded source and inspect the observed target in the tested scope.",
    ],
    observations: [],
    ...extra,
  });
  const lighthouse = run.sources.lighthouse;
  const seen = new Set();
  if (lighthouse.status === "available") {
    for (const category of ["accessibility", "seo", "performance"]) {
      for (const ref of lighthouse.categories?.[category]?.auditRefs || []) {
        const audit = lighthouse.audits?.[ref.id];
        if (
          !audit ||
          seen.has(`${category}:${ref.id}`) ||
          (audit.scoreDisplayMode !== "binary" &&
            audit.scoreDisplayMode !== "numeric") ||
          typeof audit.score !== "number" ||
          audit.score >= 1
        )
          continue;
        seen.add(`${category}:${ref.id}`);
        findings.push(
          make(
            `lighthouse-${category}-${ref.id}`,
            category,
            "PageSpeed Insights / Lighthouse",
            audit.title || ref.id,
            audit.displayValue || audit.title || ref.id,
            audit.description || "Review the Lighthouse diagnostic.",
            ["lighthouse-report"],
            {
              observations: [
                {
                  auditId: ref.id,
                  scoreDisplayMode: audit.scoreDisplayMode,
                  score: audit.score,
                  details: audit.details,
                },
              ],
            },
          ),
        );
      }
    }
  }
  for (const assertion of run.journey.assertions || []) {
    if (
      !["fail", "failed", "review", "inconclusive"].includes(assertion.status)
    )
      continue;
    const confirmed = ["fail", "failed"].includes(assertion.status);
    findings.push(
      make(
        `journey-${assertion.id}`,
        "functionality",
        "Playwright verified journey",
        assertion.label,
        assertion.reason,
        "Inspect the recorded action and expected endpoint; repair the control or destination, then verify it again.",
        assertion.evidenceIds,
        {
          verification: confirmed ? "confirmed" : "review",
          blocker: confirmed && run.journey.status === "blocked",
          observations: [assertion],
          expected: assertion.expected || assertion.label,
        },
      ),
    );
  }
  for (const [index, observation] of (
    run.sources.design.observations || []
  ).entries()) {
    findings.push(
      make(
        `gemini-${index}`,
        observation.category,
        run.sources.design.model?.startsWith("gemma-4-")
          ? "Gemma 4 qualitative review"
          : "Gemini qualitative review",
        observation.title,
        observation.observation,
        (run.sources.design.recommendations || []).find(
          (r) => r.category === observation.category,
        )?.recommendation ||
          "Review this AI observation against the supplied evidence.",
        observation.evidenceIds,
        { verification: "suggestion", observations: [observation] },
      ),
    );
  }
  return findings.sort((a, b) => Number(b.blocker) - Number(a.blocker));
}
