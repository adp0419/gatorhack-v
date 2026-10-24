// View-only components. Domain and provider code never depend on this module.
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const round = (value) =>
  value === null || value === undefined ? null : Math.round(value);
export const verdict = (status) =>
  ({
    passed: "Passed",
    failed: "Failed",
    review: "Needs review",
    not_tested: "Not tested",
    not_applicable: "Not applicable",
  })[status] || status;
export const categoryCard = (category, results = []) =>
  `<article class="panel category"><h3>${escape(category.title)}</h3><strong>${category.state === "not_applicable" ? "Not applicable" : category.score === null ? "Not scored" : `${round(category.score)}/100`}</strong><p>${category.coverage === null ? "Coverage N/A" : `${round(category.coverage)}% coverage`}</p><p>${category.conclusive} / ${category.eligible} conclusive checks</p>${
    category.score === null
      ? `<p>${category.state === "not_applicable" ? "All checks in this category were assessed as not applicable to the selected states." : "No conclusive pass/fail measurements are available; this is not a failure score."}</p><ul>${results
          .filter((r) => category.checkIds?.includes(r.checkId))
          .map(
            (r) =>
              `<li>${escape(r.checkId)} · ${escape(r.checkpointId)}: ${escape(r.reason)}</li>`,
          )
          .join("")}</ul>`
      : ""
  }${category.id === "reflow" ? "<p>320 px reflow; text resizing not tested</p>" : ""}</article>`;
export const findingRow = (finding) =>
  `<article class="finding-row"><div><button type="button" data-finding="${escape(encodeURIComponent(finding.key))}">${escape(finding.checkId)} · ${escape(finding.title)}</button><p>${escape(finding.checkpointId)} · ${escape(finding.verification === "confirmed" ? "Confirmed finding" : "Needs review")} · ${finding.affectedCount} affected</p></div><span class="subtle">${escape(finding.impactSource === "unavailable" ? "Impact unassessed" : `${finding.impact} · AI estimate`)}</span></article>`;
export const actionLine = (event) => {
  const label =
    event.type === "action.executed"
      ? `Executed ${event.payload.action.type}: ${event.payload.action.reason}`
      : event.type === "action.proposed"
        ? `Proposed ${event.payload.action.type}: ${event.payload.action.reason}`
        : event.type === "action.blocked"
          ? `Blocked: ${event.payload.reason}`
          : event.type === "scope.updated"
            ? event.payload.reason
            : event.type === "check.completed"
              ? `${event.payload.checkId}: ${verdict(event.payload.status)}`
              : event.type === "checkpoint.selected"
                ? `Selected ${event.payload.id}`
                : event.type === "run.finished"
                  ? `Audit ${event.payload.status}`
                  : event.type === "probe.observed"
                    ? "Captured independent probe evidence"
                    : event.type === "reconstruction.fallback"
                      ? `${event.payload.checkpointId}: ${event.payload.reason}`
                      : null;
  return label
    ? `<li><span class="actor">${escape(event.phase)} · ${escape(event.actor)} · ${new Date(event.timestamp).toLocaleTimeString()}</span>${escape(label)}</li>`
    : "";
};
export const findingDetail = (f) =>
  `<p><span class="badge">${f.verification === "confirmed" ? "Confirmed finding" : "Needs review"}</span> ${escape(f.checkId)} · ${escape(f.checkpointId)}</p><h3>Observed</h3><p>${escape(f.observed)}</p><h3>Expected</h3><p>${escape(f.expected)}</p><p class="wrap">Target: ${escape(f.target)} · ${f.affectedCount} affected instance(s)</p><h3>Reproduce</h3><ol>${f.reproduction.map((s) => `<li>${escape(s)}</li>`).join("")}</ol><h3>Suggested remedy</h3><p>${escape(f.remedy)}</p><p>Related WCAG 2.2 criteria: ${f.wcag.map(escape).join(", ")}. This finding is limited to the recorded sample.</p><h3>Impact triage</h3><p>${escape(f.triage ? `${f.impact} (OpenAI Decisions estimate). Evidence: ${f.triage.evidenceState}. Model judgments do not change scores.` : "Unavailable or not assessed. Deterministic evidence remains available.")}</p><h3>Recorded evidence</h3><div id="finding-images"></div><details><summary>Raw observations and focus timeline</summary><pre>${escape(JSON.stringify(f.observations, null, 2))}</pre></details>${f.targets
    .filter((t) => t.html)
    .map((t) => `<pre>${escape(t.html)}</pre>`)
    .join("")}`;
