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
export function recentReport(item) {
  const schema = item.versions?.schema;
  const scope =
    schema === "website-evaluation-v2"
      ? "Website evaluation · one journey"
      : schema === "accessbench-v1"
        ? "Accessibility report · v1"
        : "Saved report";
  let site = item.url;
  try {
    site = new URL(item.url).host;
  } catch {}
  const lifecycle = String(item.status || "Unknown");
  const status = `${lifecycle.charAt(0).toUpperCase()}${lifecycle.slice(1)}${item.summary?.provisional ? " · Provisional" : ""}`;
  const hasPreview = /^frame-[a-f0-9-]+$/.test(item.previewEvidenceId || "");
  return `<li><a class="report-preview" data-recent="${escape(item.id)}" href="#run/${escape(item.id)}">
    <div class="report-capture" data-capture="${escape(item.id)}">
      <span class="capture-placeholder">${hasPreview ? "Loading saved capture…" : "No screenshot captured"}</span>
      <img alt="Saved browser capture of ${escape(site)}" width="1280" height="800" hidden />
    </div>
    <div class="preview-caption"><h3>${escape(site)}</h3><span class="preview-open">View report</span></div>
    <p class="preview-status">${escape(status)} <span aria-hidden="true">·</span> <time datetime="${escape(item.createdAt)}">${escape(new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }))}</time></p>
    <p class="preview-scope">${escape(scope)}${item.baselineRunId ? " · Retest" : ""}</p>
    <p class="preview-url">${escape(item.url)}</p>
  </a></li>`;
}
export const verdict = (status) =>
  ({
    pass: "Passed",
    fail: "Failed",
    inconclusive: "Unverified",
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
const verificationLabel = (state) =>
  ({
    confirmed: "Confirmed finding",
    automated: "Observed by automated checks",
    suggestion: "AI suggestion",
  })[state] || "Needs review";
export const findingRow = (finding) =>
  `<article class="finding-row"><div><button type="button" data-finding="${escape(encodeURIComponent(finding.key))}">${escape(finding.checkId)} · ${escape(finding.title)}</button><p>${escape(finding.source || finding.checkpointId)} · ${escape(verificationLabel(finding.verification))}${finding.affectedCount != null ? ` · ${escape(finding.affectedCount)} affected` : ""}</p></div>${finding.impactSource && finding.impactSource !== "unavailable" ? `<span class="subtle">${escape(finding.impact)} · ${escape(finding.impactSource)}</span>` : ""}</article>`;
export const actionLine = (event) => {
  const p = event.payload || {};
  let label;
  switch (event.type) {
    case "action.executed":
      label = `Executed ${p.action?.type}: ${p.action?.reason || ""}`;
      break;
    case "action.proposed":
      label = `Proposed ${p.action?.type}: ${p.action?.reason || ""}`;
      break;
    case "action.blocked":
      label = `Blocked: ${p.reason}`;
      break;
    case "scope.updated":
      label = p.reason;
      break;
    case "check.completed":
      label = `${p.checkId}: ${verdict(p.status)}`;
      break;
    case "checkpoint.selected":
      label = `Selected ${p.id}`;
      break;
    case "run.finished":
      label = `Evaluation ${p.status}`;
      break;
    case "probe.observed":
      label = p.assertionId
        ? `${p.assertionId}: ${verdict(p.status)}`
        : "Captured independent probe evidence";
      break;
    case "journey.selected":
      label = `Selected journey: ${p.plan?.goal || p.goal || "Goal selection unavailable"}`;
      break;
    case "journey.observed":
      label = `Independent outcomes: ${(p.assertions || []).map((a) => `${a.label || a.id}: ${verdict(a.status)}`).join("; ")}`;
      break;
    case "journey.finished":
      label = `Journey ${p.status}: ${p.stop}`;
      break;
    case "source.started":
      label = `${p.source || event.actor}: started`;
      break;
    case "source.completed":
      label = `${p.source || event.actor}: ${p.status}`;
      break;
    case "reconstruction.fallback":
      label = `${p.checkpointId}: ${p.reason}`;
      break;
  }
  return label
    ? `<li><span class="actor">${escape(event.phase)} · ${escape(event.actor)} · ${new Date(event.timestamp).toLocaleTimeString()}</span>${escape(label)}</li>`
    : "";
};
export const findingDetail = (f) =>
  f.source
    ? `<p><span class="badge">${escape(verificationLabel(f.verification))}</span> ${escape(f.source)} · ${escape(f.category)}</p><h3>Observation</h3><p>${escape(f.observed)}</p><h3>Suggested improvement</h3><p>${escape(f.recommendation || f.remedy)}</p>${f.expected ? `<h3>Expected outcome</h3><p>${escape(f.expected)}</p>` : ""}${f.reproduction?.length ? `<h3>Reproduce</h3><ol>${f.reproduction.map((s) => `<li>${escape(s)}</li>`).join("")}</ol>` : ""}${f.wcag?.length ? `<p>Related WCAG criteria: ${f.wcag.map(escape).join(", ")}</p>` : ""}<p class="subtle">${escape(f.checkId)} · ${escape(f.checkpointId)} · ${escape(f.target)}</p><h3>Recorded evidence</h3><div id="finding-images"></div>${evidenceButtons((f.evidenceIds || []).filter((id) => !/^frame-/.test(id)))}<details><summary>Source observations</summary><pre>${escape(JSON.stringify(f.observations || [], null, 2))}</pre></details>`
    : `<p><span class="badge">${f.verification === "confirmed" ? "Confirmed finding" : "Needs review"}</span> ${escape(f.checkId)} · ${escape(f.checkpointId)}</p><h3>Observed</h3><p>${escape(f.observed)}</p><h3>Expected</h3><p>${escape(f.expected)}</p><p class="wrap">Target: ${escape(f.target)} · ${f.affectedCount} affected instance(s)</p><h3>Reproduce</h3><ol>${f.reproduction.map((s) => `<li>${escape(s)}</li>`).join("")}</ol><h3>Suggested remedy</h3><p>${escape(f.remedy)}</p><p>Related WCAG 2.2 criteria: ${f.wcag.map(escape).join(", ")}. This finding is limited to the recorded sample.</p><h3>Impact triage</h3><p>${escape(f.triage ? `${f.impact} (OpenAI Decisions estimate). Evidence: ${f.triage.evidenceState}. Model judgments do not change scores.` : "Unavailable or not assessed. Deterministic evidence remains available.")}</p><h3>Recorded evidence</h3><div id="finding-images"></div><details><summary>Raw observations and focus timeline</summary><pre>${escape(JSON.stringify(f.observations, null, 2))}</pre></details>${f.targets
        .filter((t) => t.html)
        .map((t) => `<pre>${escape(t.html)}</pre>`)
        .join("")}`;

const evidenceButtons = (ids = []) =>
  ids.length
    ? `<div class="evidence-links">${ids.map((id, i) => `<button class="text-button" type="button" data-evidence="${escape(id)}">Evidence ${i + 1}<span class="sr-only">: ${escape(id)}</span></button>`).join("")}</div>`
    : "";
// Category order matches the equal-weight website-health formula. These are
// presentation arcs only; the persisted summary remains the score authority.
const scoreCategories = [
  "accessibility",
  "seo",
  "performance",
  "functionality",
];
const validScore = (score) =>
  typeof score === "number" &&
  Number.isFinite(score) &&
  score >= 0 &&
  score <= 100;
export function scoreRing(categories = []) {
  const measured = scoreCategories
    .map((id) => categories.find((c) => c.id === id && validScore(c.score)))
    .filter(Boolean);
  const gap = measured.length > 1 ? 4.5 : 0;
  const span = measured.length ? 100 / measured.length : 100;
  const arcs = measured
    .map((category, index) => {
      const length = span - gap;
      const start = index * span + gap / 2;
      const filled = (length * category.score) / 100;
      const circle = (className, amount) =>
        `<circle class="${className}" cx="60" cy="60" r="50" pathLength="100" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${amount} ${100 - amount}" stroke-dashoffset="${-start}" transform="rotate(-90 60 60)"></circle>`;
      return `<g class="score-color-${category.id}" data-score-segment="${category.id}" data-score="${category.score}">${circle("score-ring-track", length)}${filled > 0 ? circle("score-ring-fill", filled) : ""}</g>`;
    })
    .join("");
  return `<svg class="score-ring-graphic" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${arcs || '<circle class="score-ring-empty" cx="60" cy="60" r="50" fill="none" stroke-width="3" stroke-dasharray="3 4"></circle>'}</svg>`;
}
export function scoreLegend(categories = []) {
  return scoreCategories
    .map((id) => categories.find((c) => c.id === id && validScore(c.score)))
    .filter(Boolean)
    .map(
      (c) =>
        `<li class="score-color-${c.id}"><span class="score-swatch" aria-hidden="true"></span>${escape(c.name || c.id)} <span>${round(c.score)}/100</span></li>`,
    )
    .join("");
}
export const healthCategoryCard = (category, linked = false) =>
  `<article class="panel category" data-category="${escape(category.id)}"><h3 class="score-color-${scoreCategories.includes(category.id) ? category.id : "unavailable"}"><span class="score-swatch" aria-hidden="true"></span>${escape(category.name || category.title || category.id)}</h3><div class="category-score-ring">${scoreRing([category])}<strong>${validScore(category.score) ? `${round(category.score)}<span class="score-denominator">/100</span>` : "Not scored"}</strong></div><p>${escape(category.source || (category.id === "functionality" ? "Playwright · selected journey" : "Lighthouse · entry page"))}</p>${category.reason ? `<p>${escape(category.reason)}</p>` : ""}${category.partial && category.score != null ? "<p>Partial journey coverage</p>" : ""}${linked ? `<button class="text-button" type="button" data-category-link="details-${escape(category.id)}">View findings<span class="sr-only"> for ${escape(category.name || category.id)}</span></button>` : ""}</article>`;
const designModelLabel = (model) =>
  model?.startsWith("gemma-4-")
    ? "Gemma4"
    : model?.startsWith("gemini-")
      ? "Gemini"
      : "Design review";
export const designCard = (design) =>
  `<article class="panel category qualitative" data-category="design"><h3>Design &amp; UX</h3><strong>Qualitative review</strong><p>${designModelLabel(design?.model)} · captured browser states</p>${design?.model ? `<details><summary>Model details</summary><p class="subtle wrap">${escape(design.model)} · Google’s Gemini API</p></details>` : ""}${
    design?.status === "available"
      ? `<p>${escape(design.summary)}</p>${(design.observations || [])
          .filter((o) => o.category === "design")
          .map(
            (o) =>
              `<details><summary>${escape(o.title)}</summary><p>${escape(o.observation)}</p>${evidenceButtons(o.evidenceIds)}</details>`,
          )
          .join("")}`
      : `<p>${design?.status === "pending" ? "Waiting for captured evidence." : "Design review unavailable."} ${escape(design?.reason || "")}</p>`
  }</article>`;
export const journeyPanel = (journey) =>
  `<div class="section-heading"><h3 id="journey-title">Customer journey</h3><span class="badge">${escape(journey?.status || "pending")}</span></div>${journey?.goal ? `<p><strong>${escape(journey.goal)}</strong></p><p>Safe endpoint: ${escape(journey.safeEndpoint)}</p>` : "<p>The browser will select one safe journey from the observed page.</p>"}${journey?.stop ? `<p class="subtle">${escape(journey.stop)}</p>` : ""}${journey?.assertions?.length ? `<ol class="outcome-list">${journey.assertions.map((a) => `<li><strong>${escape(a.label || a.id)}</strong><span class="badge">${escape(verdict(a.status))}</span><p>${escape(a.reason)}</p>${evidenceButtons(a.evidenceIds)}</li>`).join("")}</ol>` : '<p class="subtle">No assertion plan available. Unobserved outcomes are never passes.</p>'}`;
export const recommendationList = (design) =>
  `<h3 id="recommendations-title">AI suggestions</h3><p class="subtle">Qualitative recommendations from the design review. Priority is suggested; measured scores and journey outcomes stay unchanged.</p>${
    design?.status === "available" && design.recommendations?.length
      ? `<ol class="recommendation-list">${[...design.recommendations]
          .sort(
            (a, b) =>
              (({ high: 0, medium: 1, low: 2 })[a.priority] ?? 3) -
              ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 3),
          )
          .map(
            (r) =>
              `<li><div class="section-heading"><strong>${escape(r.title)}</strong><span class="badge">${escape(r.priority)} priority · AI suggestion</span></div><p>${escape(r.recommendation)}</p><p class="subtle">${escape({ accessibility: "Accessibility", design: "Design & UX", seo: "SEO", performance: "Performance", functionality: "Functionality" }[r.category] || r.category)}</p>${evidenceButtons(r.evidenceIds)}</li>`,
          )
          .join("")}</ol>`
      : '<p class="subtle">AI recommendations are unavailable. Use the recorded observations and suggested remedies in the findings below.</p>'
  }${design?.limitations?.length ? `<p class="subtle">${design.limitations.map(escape).join(" ")}</p>` : ""}`;
export const sourceDiagnostics = (lighthouse) => {
  if (!lighthouse) return "<p>Page measurements are pending.</p>";
  const bp = lighthouse.categories?.["best-practices"];
  return `<p>Google PageSpeed Insights · Lighthouse ${escape(lighthouse.lighthouseVersion || "version unavailable")} · ${escape(lighthouse.strategy || "mobile")}</p><p class="wrap">Measured URL: ${escape(lighthouse.finalUrl || "Unavailable")}</p><p>Best Practices: ${bp?.score == null ? "Not scored" : `${round(bp.score)}/100`}. Supporting diagnostics only; excluded from website health and Functionality scores.</p>${lighthouse.reason ? `<p>${escape(lighthouse.reason)}</p>` : ""}${lighthouse.warnings?.length ? `<ul>${lighthouse.warnings.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>` : ""}<p class="subtle">Google measures a separate page load with mobile emulation. The journey uses our desktop browser. Lab metrics do not represent real-user field data.</p><details><summary>Returned Lighthouse audits</summary><pre>${escape(JSON.stringify(lighthouse.audits || {}, null, 2))}</pre></details>`;
};

const reportCategories = [
  ["accessibility", "Accessibility"],
  ["seo", "SEO"],
  ["performance", "Performance"],
  ["functionality", "Functionality"],
];
const feedbackContext = {
  accessibility:
    "People need readable content and controls they can identify and operate.",
  seo: "Search engines need clear page information to understand the entry page.",
  performance:
    "Loading delays can make visitors wait before they can use the page.",
  functionality:
    "Visitors need a clear, observable result when they follow the selected journey.",
};
const feedbackTitle = (f) =>
  ({
    C01: "Review text contrast",
    R01: "Check content at narrow widths",
    R02: "Keep controls within reach at narrow widths",
  })[f.checkId] || f.title;
export function priorityFeedback(findings = []) {
  const measured = findings.filter((f) => f.verification !== "suggestion");
  const rank = (f) =>
    f.blocker
      ? 0
      : ({
          critical: 1,
          high: 1,
          serious: 1,
          medium: 2,
          moderate: 2,
          low: 3,
          minor: 3,
        }[f.impact] ?? 4);
  const ordered = [...measured].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  return `<h3 id="priority-title">What to improve first</h3><p class="subtle">Confirmed blockers first, then recorded impact where available. Open a finding for its source and evidence.</p>${ordered.length ? `<ol class="priority-list">${ordered.map((f) => `<li><span class="badge">${f.blocker ? "Confirmed blocker" : escape(verificationLabel(f.verification))}</span><h4>${escape(feedbackTitle(f))}</h4><p>${escape(feedbackContext[f.category] || "Review the recorded issue within the tested scope.")}</p><p><strong>Next step:</strong> ${escape(f.recommendation || f.remedy || "Review the observation and verify the expected outcome.")}</p><button class="text-button" type="button" data-finding="${escape(encodeURIComponent(f.key))}">View finding and evidence<span class="sr-only">: ${escape(f.title)}</span></button></li>`).join("")}</ol>` : `<p>No measured findings are available in this sample. Review category availability and unresolved journey outcomes below; missing evidence never becomes a pass.</p>`}`;
}
export function categoryDetails(run) {
  return reportCategories
    .map(([id, title]) => {
      const category = run.summary?.categories?.find((c) => c.id === id);
      const findings = run.findings.filter((f) => f.category === id);
      const source =
        id === "functionality" ? run.journey : run.sources?.lighthouse;
      return `<details id="details-${id}" class="category-details"><summary>${title} · ${category?.score == null ? "Unavailable" : `${round(category.score)}/100`}${id === "functionality" && run.summary?.journeyCoverage !== 100 ? " · Partial coverage" : ""}</summary><p>${escape(category?.source || (id === "functionality" ? "Playwright · one selected journey" : "Google PageSpeed Insights · entry page"))} · ${escape(source?.status || "unavailable")}</p>${category?.reason || source?.reason ? `<p>${escape(category?.reason || source?.reason)}</p>` : ""}${findings.length ? findings.map(findingRow).join("") : `<p>No findings recorded for this category. This does not establish whole-site correctness.</p>`}${id === "functionality" ? `<p>Journey outcome and individual assertions are retained in Customer journey below.</p>` : `<p>Source diagnostics and returned Lighthouse audits are available below.</p>`}</details>`;
    })
    .join("");
}
