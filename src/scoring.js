import { REGISTRY, CATEGORIES } from "./registry.js";
import { VERSIONS } from "./config.js";
const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function score(results, manifest, explorationComplete = true) {
  const units = manifest.checkpoints.flatMap((cp) =>
    REGISTRY.map(
      (check) =>
        results.find(
          (r) => r.checkId === check.id && r.checkpointId === cp.id,
        ) || { checkId: check.id, checkpointId: cp.id, status: "not_tested" },
    ),
  );
  const categories = Object.entries(CATEGORIES).map(([id, title]) => {
    const subset = units.filter(
      (u) => REGISTRY.find((r) => r.id === u.checkId).category === id,
    );
    const counts = Object.fromEntries(
      ["passed", "failed", "review", "not_tested", "not_applicable"].map(
        (s) => [s, subset.filter((u) => u.status === s).length],
      ),
    );
    const conclusive = counts.passed + counts.failed,
      eligible = subset.length - counts.not_applicable;
    return {
      id,
      title,
      counts,
      score: conclusive ? (100 * counts.passed) / conclusive : null,
      coverage: eligible ? (100 * conclusive) / eligible : null,
      conclusive,
      eligible,
      state:
        eligible === 0
          ? "not_applicable"
          : conclusive === 0
            ? "not_scored"
            : "scored",
    };
  });
  return {
    version: VERSIONS.scoring,
    score: mean(categories.map((c) => c.score).filter((n) => n !== null)),
    coverage: mean(categories.map((c) => c.coverage).filter((n) => n !== null)),
    provisional:
      !explorationComplete ||
      units.some((u) => ["review", "not_tested"].includes(u.status)),
    conclusive: categories.reduce((s, c) => s + c.conclusive, 0),
    eligible: categories.reduce((s, c) => s + c.eligible, 0),
    categories,
  };
}
export const findingKey = (checkId, checkpointId, target) =>
  JSON.stringify([checkId, checkpointId, target]);
export function compare(baseline, current) {
  const scope = (m) =>
    JSON.stringify({
      versions: m.versions,
      viewports: m.viewports,
      budgets: m.budgets,
      authorization: m.authorization,
      policy: m.policy,
      runtime: m.runtime,
      checkpoints: m.checkpoints.map((c) => ({
        id: c.id,
        logicalUrl: c.logicalUrl,
        goal: c.goal,
        sample: c.sample,
        checkSamples: c.checkSamples,
      })),
    });
  const comparable =
    scope(baseline.manifest) === scope(current.manifest) &&
    current.manifest.checkpoints.every(
      (c) => c.reconstructed !== false && !c.sampleMismatch,
    ) &&
    current.explorationComplete;
  const before = baseline.findings.filter(
      (f) => f.verification === "confirmed",
    ),
    after = current.findings.filter((f) => f.verification === "confirmed");
  const changes = before.map((f) => {
    const same = after.find((n) => n.key === f.key);
    const required = [
      ...new Set([
        f.target,
        ...(f.targets || []).map((t) => t.identity || t.target).filter(Boolean),
      ]),
    ];
    const positive = current.results.find(
      (r) =>
        r.checkId === f.checkId &&
        r.checkpointId === f.checkpointId &&
        r.status === "passed" &&
        required.every((t) => r.passedTargets?.includes(t)),
    );
    const beforeCheckpoint = baseline.manifest.checkpoints.find(
        (c) => c.id === f.checkpointId,
      ),
      afterCheckpoint = current.manifest.checkpoints.find(
        (c) => c.id === f.checkpointId,
      );
    const sameMethods = [
      "versions",
      "viewports",
      "runtime",
      "budgets",
      "policy",
      "authorization",
    ].every(
      (k) =>
        JSON.stringify(baseline.manifest[k]) ===
        JSON.stringify(current.manifest[k]),
    );
    const targetScope =
      !!afterCheckpoint &&
      afterCheckpoint.reconstructed !== false &&
      beforeCheckpoint?.logicalUrl === afterCheckpoint.logicalUrl &&
      !current.results.find(
        (r) => r.checkId === f.checkId && r.checkpointId === f.checkpointId,
      )?.missingTargets?.length;
    return {
      ...f,
      retest: same
        ? "persistent"
        : sameMethods && targetScope && positive
          ? "resolved"
          : "unverified",
    };
  });
  for (const f of after)
    if (!before.some((b) => b.key === f.key))
      changes.push({ ...f, retest: "new" });
  return {
    baselineRunId: baseline.id,
    comparable,
    delta:
      comparable &&
      baseline.summary.score !== null &&
      current.summary.score !== null
        ? current.summary.score - baseline.summary.score
        : null,
    changes,
  };
}
