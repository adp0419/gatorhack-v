import { REGISTRY } from "./registry.js";
import { identity } from "./checks.js";

export function reconstructionComplete(manifest, checkpoints) {
  return manifest.checkpoints.every((planned) => {
    const current = checkpoints.find((c) => c.id === planned.id);
    return (
      current?.reconstructed === true &&
      planned.sample.every((target) =>
        current.selected.some((s) => s.target.identity === target),
      )
    );
  });
}

// Re-evaluate the frozen target sample, retaining new observations separately.
// Missing targets are unresolved even when the engine's new page-wide result passes.
export function retainSample(result, planned) {
  if (!planned) return result;
  const allowed = new Set(planned),
    observed = new Set(result.sample);
  const missing = planned.filter((t) => !observed.has(t));
  const check = REGISTRY.find((c) => c.id === result.checkId);
  let status = result.status,
    observations = result.observations;
  const advisory = [];
  if (check.rules.length && planned.length) {
    observations = result.observations.map((o) => {
      const nodes =
        o.nodes?.filter((n) => allowed.has(identity(n.target))) || [];
      const extras =
        o.nodes?.filter((n) => !allowed.has(identity(n.target))) || [];
      if (extras.length) advisory.push({ ...o, nodes: extras });
      return { ...o, nodes };
    });
    const has = (kind) =>
      observations.some((o) => o.kind === kind && o.nodes.length);
    status = has("violations")
      ? "failed"
      : has("incomplete")
        ? "review"
        : missing.length
          ? "not_tested"
          : has("passes")
            ? "passed"
            : result.status === "not_tested"
              ? "not_tested"
              : "review";
  } else if (check.id === "R01" && planned.length) {
    observations = result.observations.map((o) => ({
      ...o,
      lost: o.lost?.filter((n) =>
        allowed.has(n.target || `${n.tag}:${n.text}`),
      ),
    }));
    const lost = observations.some((o) => o.lost?.length);
    if (lost) status = "failed";
    else if (missing.length) status = "not_tested";
    else if (result.status === "failed") status = "review";
  }
  if (missing.length && !["failed", "review"].includes(status))
    status = "not_tested";
  if (!planned.length && result.sample.length) status = "not_tested";
  return {
    ...result,
    status,
    sample: [...planned],
    passedTargets: result.passedTargets.filter((t) => allowed.has(t)),
    observations,
    advisory,
    missingTargets: missing,
    scopeChanged: !planned.length && result.sample.length > 0,
    reason: missing.length
      ? `${result.reason} Baseline targets were not positively observed: ${missing.join(", ")}.`
      : result.reason,
  };
}
