import { REGISTRY } from "./registry.js";
import { findingKey } from "./scoring.js";

export function findingsFromResults(results) {
  return results
    .filter((r) => ["failed", "review"].includes(r.status))
    .flatMap((r) => {
      const check = REGISTRY.find((c) => c.id === r.checkId);
      const violations = r.observations.flatMap(
        (o) =>
          o.nodes
            ?.filter(() => ["violations", "incomplete"].includes(o.kind))
            .map((n) => ({
              target: n.target?.join(" "),
              identity:
                n.target?.length === 1 && /^#[\w-]+$/.test(n.target[0])
                  ? `id:${n.target[0].slice(1)}`
                  : n.target?.join(" "),
              html: n.html,
              summary: n.summary,
            })) || [],
      );
      const layoutTargets = r.observations
        .flatMap((o) => [...(o.lost || []), ...(o.unavailable || [])])
        .map((n) => ({
          target: n.target || `${n.tag}:${n.text}`,
          identity: n.target || `${n.tag}:${n.text}`,
        }));
      const targets = violations.length
        ? violations
        : layoutTargets.length
          ? layoutTargets
          : r.observations
              .filter((o) => o.target)
              .map((o) => ({ target: o.target, identity: o.target }));
      const representative = targets[0];
      const target = representative?.identity || r.sample[0] || "sample";
      return [
        {
          key: findingKey(r.checkId, r.checkpointId, target),
          checkId: r.checkId,
          checkpointId: r.checkpointId,
          target,
          title: check.title,
          verification: r.status === "failed" ? "confirmed" : "review",
          impact: "unclear",
          impactSource: "unavailable",
          blocker: false,
          reason: r.reason,
          expected: check.title,
          observed: representative?.summary || r.reason,
          affectedCount: Math.max(targets.length, 1),
          targets,
          wcag: check.wcag,
          remedy: check.remedy,
          evidenceIds: r.evidenceIds,
          reproduction: [
            `Restore checkpoint ${r.checkpointId}.`,
            ...(["K01", "K02"].includes(r.checkId)
              ? [
                  "Use the recorded pointer action to observe the expected state.",
                  "Reset the page and follow the recorded keyboard focus trail.",
                ]
              : r.checkId.startsWith("R")
                ? [
                    "Set the viewport to 320 CSS pixels.",
                    "Inspect the recorded geometry and screenshot.",
                  ]
                : [
                    "Inspect the recorded rule observations and affected target.",
                  ]),
          ],
          observations: r.observations,
        },
      ];
    });
}
export function sortFindings(findings) {
  const rank = (f) => (f.blocker ? 0 : f.verification === "confirmed" ? 1 : 2);
  const impact = { critical: 0, high: 1, moderate: 2, low: 3, unclear: 4 };
  return [...findings].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (impact[a.impact] ?? 4) - (impact[b.impact] ?? 4) ||
      a.key.localeCompare(b.key),
  );
}
