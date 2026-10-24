import {
  escape,
  round,
  verdict,
  categoryCard,
  findingRow,
  actionLine,
  findingDetail,
  healthCategoryCard,
  designCard,
  journeyPanel,
  recommendationList,
  sourceDiagnostics,
  recentReport,
} from "./components.js";
const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem("accessbench-token") || "",
  settings,
  run,
  runId,
  seq = 0,
  events = [],
  pollTimer,
  source,
  frameUrl,
  frameId,
  opener,
  requestInFlight = false;
const seenPhases = new Set();
const websiteRun = (value) =>
  value?.manifest?.versions?.schema === "website-evaluation-v2";
let clientFingerprint;
function showRuntime(info) {
  if (!info) {
    $("runtime-status").textContent =
      "Server version unavailable. Restart the local server to load the current code.";
    return;
  }
  clientFingerprint ||= info.fingerprint;
  $("runtime-status").textContent =
    `Server ${info.revision} · started ${new Date(info.startedAt).toLocaleTimeString()} · ${info.stale ? "Source files changed. Restart the server with npm start, or use npm run dev while developing." : clientFingerprint !== info.fingerprint ? "Server code updated. Reload this page to load the matching interface." : "Current loaded build"}`;
}
const done = (status) =>
  ["completed", "partial", "failed", "canceled"].includes(status);
const headers = () => (token ? { Authorization: `Bearer ${token}` } : {});
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    settings = undefined;
    $("token-row").hidden = false;
    $("start-view").hidden = false;
    $("run-view").hidden = true;
    throw new Error("Enter the configured demo access token.");
  }
  if (!response.ok)
    throw new Error((await response.json()).error || "Request failed");
  return response;
}
const setHTML = (id, html) => {
  if ($(id).innerHTML === html) return;
  const focus = $(id).contains(document.activeElement)
    ? document.activeElement.dataset.finding
    : null;
  $(id).innerHTML = html;
  if (focus)
    [...$(id).querySelectorAll("[data-finding]")]
      .find((e) => e.dataset.finding === focus)
      ?.focus({ preventScroll: true });
};
const announce = (text) => {
  $("announcer").textContent = text;
};
async function configure() {
  try {
    settings = await (await api("/api/config")).json();
    showRuntime(settings.server);
    setHTML(
      "demo-targets",
      `<button type="button" class="text-button" data-demo="broken">Try broken fixture</button><button type="button" class="text-button" data-demo="fixed">Try fixed fixture</button><button type="button" class="text-button" data-demo="public">Try example.com</button>`,
    );
    $("configuration").textContent = settings.publicTargets
      ? "Public HTTP(S) sites on standard ports. Private networks are blocked. Runs locally in an isolated browser."
      : `Allowlisted public origins: ${settings.allowedOrigins.join(", ")}. Runs locally in an isolated browser.`;
    document.querySelectorAll("[data-demo]").forEach(
      (button) =>
        (button.onclick = () => {
          $("target-url").value =
            button.dataset.demo === "public"
              ? settings.allowedOrigins[0]
              : settings.fixtures[button.dataset.demo];
          $("target-url").removeAttribute("aria-invalid");
          $("form-error").textContent = "";
          $("target-url").focus();
        }),
    );
    $("token-row").hidden = true;
    updateDemoLink();
  } catch (error) {
    $("form-error").textContent = error.message;
  }
}
function updateDemoLink() {
  const variant = document.querySelector('input[name="variant"]:checked').value;
  $("demo-link").hidden = !settings;
  if (settings) $("demo-link").href = settings.fixtures[variant];
}
document
  .querySelectorAll('input[name="variant"]')
  .forEach((radio) => radio.addEventListener("change", updateDemoLink));
$("demo-form").onsubmit = (event) => {
  event.preventDefault();
  if (!settings) {
    $("demo-error").textContent = "Connect to the local runner first.";
    return;
  }
  const variant = document.querySelector('input[name="variant"]:checked').value;
  void launch(
    settings.fixtures[variant],
    undefined,
    "demo-error",
    "demo-button",
  );
};
let recentGeneration = 0;
let recentController;
const recentImageUrls = new Set();
function clearRecentImages() {
  recentGeneration++;
  recentController?.abort();
  for (const url of recentImageUrls) URL.revokeObjectURL(url);
  recentImageUrls.clear();
}
async function loadRecent() {
  clearRecentImages();
  const generation = recentGeneration;
  recentController = new AbortController();
  const signal = recentController.signal;
  $("recent-audits").setAttribute("aria-busy", "true");
  try {
    const recent = await (await api("/api/audits", { signal })).json();
    if (generation !== recentGeneration) return;
    const focused =
      document.activeElement?.closest("[data-recent]")?.dataset.recent;
    setHTML(
      "recent-audits",
      recent.length
        ? `<ol class="recent-gallery">${recent.map(recentReport).join("")}</ol>`
        : `<div class="archive-empty"><h3>Your next discovery starts here.</h3><p>No saved reports yet. Enter your website above, or try the broken and fixed demo.</p><p class="subtle">Illustrative journey: open a service page, capture the result, and independently check what appeared. Actual runs may be partial.</p><a href="#demo-title">Explore the demo</a></div>`,
    );
    if (focused)
      [...document.querySelectorAll("[data-recent]")]
        .find((el) => el.dataset.recent === focused)
        ?.focus({ preventScroll: true });
    $("recent-audits").setAttribute("aria-busy", "false");
    // Evidence stays behind the existing authenticated API; tokens never enter image URLs.
    await Promise.all(
      recent.map(async (item) => {
        if (!/^frame-[a-f0-9-]+$/.test(item.previewEvidenceId || "")) return;
        const capture = [...document.querySelectorAll("[data-capture]")].find(
          (el) => el.dataset.capture === item.id,
        );
        if (!capture) return;
        try {
          const response = await api(
            `/api/audits/${encodeURIComponent(item.id)}/evidence/${item.previewEvidenceId}`,
            { signal },
          );
          const blob = await response.blob();
          if (generation !== recentGeneration) return;
          const url = URL.createObjectURL(blob);
          recentImageUrls.add(url);
          const img = capture.querySelector("img");
          img.src = url;
          await img.decode();
          if (generation !== recentGeneration) return;
          img.hidden = false;
          capture.querySelector(".capture-placeholder").hidden = true;
          capture.classList.add("capture-ready");
        } catch {
          if (generation === recentGeneration)
            capture.querySelector(".capture-placeholder").textContent =
              "Saved screenshot unavailable";
        }
      }),
    );
  } catch (error) {
    if (generation !== recentGeneration) return;
    $("recent-audits").textContent = `Saved runs unavailable. ${error.message}`;
  } finally {
    if (generation === recentGeneration)
      $("recent-audits").setAttribute("aria-busy", "false");
  }
}
$("unlock").onclick = async () => {
  token = $("access-token").value;
  sessionStorage.setItem("accessbench-token", token);
  await configure();
  route();
  if (runId) void poll();
};
async function launch(url, baselineRunId, errorId, buttonId) {
  $(errorId).textContent = "";
  $(buttonId).disabled = true;
  $(buttonId).setAttribute("aria-busy", "true");
  try {
    const response = await (
      await api("/api/audits", {
        method: "POST",
        body: JSON.stringify({ url, baselineRunId }),
      })
    ).json();
    location.hash = `run/${response.id}`;
    announce("Audit started.");
  } catch (error) {
    $(errorId).textContent = error.message;
    if (errorId === "form-error")
      $("target-url").setAttribute("aria-invalid", "true");
  } finally {
    $(buttonId).disabled = false;
    $(buttonId).removeAttribute("aria-busy");
  }
}
$("target-url").oninput = () => {
  $("target-url").removeAttribute("aria-invalid");
  $("form-error").textContent = "";
};
$("start-form").onsubmit = (event) => {
  event.preventDefault();
  void launch($("target-url").value, undefined, "form-error", "start-button");
};
$("retest-form").onsubmit = (event) => {
  event.preventDefault();
  void launch($("retest-url").value, runId, "retest-error", "retest-button");
};
$("use-fixed").onclick = () => {
  $("retest-url").value = settings.fixtures.fixed;
  $("retest-error").textContent = "";
  $("retest-url").focus();
};
$("cancel-button").onclick = async () => {
  try {
    await api(`/api/audits/${runId}/cancel`, { method: "POST" });
    $("cancel-button").disabled = true;
    announce("Cancellation requested. Collected evidence will be retained.");
  } catch (error) {
    $("errors").textContent = error.message;
  }
};
$("download-report").onclick = async () => {
  const id = runId;
  $("download-error").textContent = "";
  try {
    const response = await api(`/api/audits/${id}/report.json`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `accessbench-${id}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    $("download-error").textContent = error.message;
  }
};

async function loadFrame(frame) {
  if (!frame || frame.id === frameId) return;
  const activeId = runId;
  const response = await api(frame.url);
  if (activeId !== runId) return;
  const url = URL.createObjectURL(await response.blob());
  if (frameUrl) URL.revokeObjectURL(frameUrl);
  frameUrl = url;
  frameId = frame.id;
  $("browser-frame").src = url;
  $("frame-link").href = url;
  $("frame-link").hidden = false;
}
function receive(items) {
  const known = new Set(events.map((e) => e.seq));
  for (const event of items) {
    if (event.runId !== runId || known.has(event.seq)) continue;
    events.push(event);
    seq = Math.max(seq, event.seq);
    if (event.phase) {
      $("phase").textContent = event.phase;
      if (!seenPhases.has(event.phase)) {
        seenPhases.add(event.phase);
        announce(event.phase);
      }
    }
    if (event.type === "action.executed")
      $("current-action").textContent =
        `Playwright executed Twinly action: ${event.payload.action?.reason || event.payload.action?.type || "interaction"}`;
    if (event.type === "action.blocked")
      $("current-action").textContent =
        `Blocked by action policy: ${event.payload.reason}`;
    if (event.type === "frame.captured")
      void loadFrame(event.payload).catch(() => {});
    if (["run.finished", "checkpoint.selected"].includes(event.type))
      announce(
        event.type === "run.finished"
          ? `Audit ${event.payload.status}. Results available.`
          : `Selected ${event.payload.id}.`,
      );
  }
  events.sort((a, b) => a.seq - b.seq);
  setHTML("action-trail", events.map(actionLine).join(""));
}
function connect() {
  if (source || token || !runId || done(run?.status)) return;
  source = new EventSource(`/api/audits/${runId}/events?after=${seq}`);
  source.onmessage = (message) => {
    receive([JSON.parse(message.data)]);
    $("connection").textContent = "Connected · action-by-action captures";
  };
  source.onerror = () => {
    source?.close();
    source = null;
    if (!done(run?.status))
      $("connection").textContent =
        "Stream interrupted · polling saved evidence";
  };
}
function render() {
  const v2 = websiteRun(run);
  $("run-title").textContent = v2
    ? "Website evaluation"
    : "Accessibility benchmark";
  $("report-version").textContent = v2
    ? "Website evaluation v2 · one page and one journey"
    : "Legacy accessibility report · original scoring and scope";
  $("score-label").textContent = v2
    ? "Website health score — tested scope"
    : "AccessBench accessibility score";
  $("coverage-label").textContent = v2
    ? "Numeric categories scored"
    : "Planned-check coverage";
  $("score-explanation").textContent = v2
    ? "The health score averages available Accessibility, SEO, Performance, and Functionality scores equally. Lighthouse measures one entry-page load; Functionality uses conclusive outcomes from one journey. Design & UX is qualitative and does not change scores. Missing categories or unresolved journey outcomes make the score provisional. This is tested scope, not a percentage of your website checked."
    : "Each check is counted once per selected state. Category scores summarize conclusive passes and failures; the overall score averages scored categories equally. Coverage averages each applicable category’s conclusive checks divided by planned checks. Review and untested checks reduce coverage. Proven inapplicability is excluded. Missing evidence never becomes a pass.";
  $("source-progress").hidden = !v2;
  if (v2)
    setHTML(
      "source-progress",
      [
        ["pagespeed", "Page measurements"],
        ["twinly", "Customer journey"],
        ["gemini", "Design review"],
      ]
        .map(
          ([id, label]) =>
            `<div class="source-status"><strong>${label}</strong><span>${escape(run.providers?.[id] || "pending")}</span></div>`,
        )
        .join(""),
    );
  $("run-target").textContent = run.url;
  $("lifecycle").textContent = run.status;
  if (done(run.status))
    $("current-action").textContent =
      `Audit ${run.status}. Recorded actions and measurements are retained below.`;
  $("elapsed").textContent =
    `${Math.round((Date.parse(run.finishedAt || new Date()) - Date.parse(run.startedAt || run.createdAt)) / 1000)} seconds`;
  $("cancel-button").hidden = done(run.status);
  $("cancel-button").disabled = false;
  if (run.latestFrame) {
    $("frame-status").textContent =
      `${done(run.status) ? "Saved capture" : "Latest actual capture"} · ${new Date(run.latestFrame.capturedAt).toLocaleTimeString()} · ${run.latestFrame.viewport.width} × ${run.latestFrame.viewport.height} CSS px${!done(run.status) && Date.now() - Date.parse(run.latestFrame.capturedAt) > 15000 ? " · Waiting for a newer frame" : ""}`;
    void loadFrame(run.latestFrame).catch(() => {});
  } else {
    $("frame-status").textContent = done(run.status)
      ? "No browser capture was retained for this run."
      : "Waiting for the first captured frame.";
  }
  setHTML(
    "checkpoints",
    (run.manifest?.checkpoints || [])
      .map(
        (c) =>
          `<li>${escape(c.id)}${c.reconstructed === false ? " · Not reconstructed" : c.reconstructedBy ? ` · ${escape(c.reconstructedBy)}` : ""}<span class="actor">${escape(c.logicalUrl)}</span></li>`,
      )
      .join(""),
  );
  if (v2) {
    const summary = run.summary;
    const categories = summary?.categories || [
      { id: "accessibility", name: "Accessibility", score: null },
      { id: "seo", name: "SEO", score: null },
      { id: "performance", name: "Performance", score: null },
      { id: "functionality", name: "Functionality", score: null },
    ];
    $("overall-score").textContent =
      summary?.score == null
        ? "No score available"
        : `${round(summary.score)}/100`;
    $("overall-coverage").textContent =
      `${summary?.numericAvailable || 0} of 4`;
    $("conclusive").textContent =
      `${summary?.conclusive || 0} of ${summary?.eligible || 0} planned journey outcomes verified${summary?.journeyCoverage == null ? "" : ` · ${round(summary.journeyCoverage)}% assertion coverage`}`;
    $("provisional").textContent =
      !summary || summary.provisional
        ? "Provisional"
        : summary.reportPartial
          ? "Partial report"
          : "Tested scope complete";
    const card = (id) =>
      healthCategoryCard(
        categories.find((c) => c.id === id) || { id, score: null },
      );
    setHTML(
      "categories",
      card("accessibility") +
        designCard(run.sources?.design) +
        card("seo") +
        card("performance") +
        card("functionality"),
    );
    $("scope-description").textContent =
      `Entry page: ${run.landedUrl || run.url}. Lighthouse: ${run.sources?.lighthouse?.strategy || "mobile"} page load in Google’s session. Journey: desktop 1280 × 800 CSS px, ${(run.manifest?.checkpoints || []).length} selected state(s), one non-submitting journey. Sources can observe different page states.`;
    $("journey-result").hidden = false;
    setHTML("journey-result", journeyPanel(run.journey));
    $("recommendations").hidden = false;
    setHTML("recommendations", recommendationList(run.sources?.design));
    $("source-diagnostics").hidden = false;
    setHTML(
      "source-diagnostic-details",
      sourceDiagnostics(run.sources?.lighthouse),
    );
  } else {
    if (run.summary) {
      const s = run.summary;
      $("overall-score").textContent =
        s.score === null ? "No score yet" : `${round(s.score)}/100`;
      $("overall-coverage").textContent =
        s.coverage === null ? "Not applicable" : `${round(s.coverage)}%`;
      $("conclusive").textContent =
        `${s.conclusive} / ${s.eligible} conclusive planned checks`;
      $("provisional").textContent = s.provisional
        ? "Provisional"
        : "Bounded plan complete";
      setHTML(
        "categories",
        s.categories
          .map((category) =>
            categoryCard(
              {
                ...category,
                checkIds:
                  category.checkIds ||
                  settings?.checks
                    ?.filter((c) => c.category === category.id)
                    .map((c) => c.id),
              },
              run.results,
            ),
          )
          .join(""),
      );
    }
    $("scope-description").textContent =
      `${run.manifest.checkpoints.filter((c) => c.reconstructed !== false).length} of ${run.manifest.checkpoints.length} planned states reconstructed. Exploration ${run.explorationComplete ? "finished normally" : run.explorationStop || "in progress"}. Keyboard checks cover selected interactions; reflow uses 320 CSS pixels.`;
    $("journey-result").hidden = true;
    $("recommendations").hidden = true;
    $("source-diagnostics").hidden = true;
  }
  const blockers = run.findings.filter((f) => f.blocker);
  $("blockers").textContent = blockers.length
    ? `${blockers.length} confirmed essential-task blocker(s).`
    : "No confirmed essential-task blockers in this sample. Individual failures and uncertainty remain visible below.";
  $("triage-status").textContent = v2
    ? "Measurements and verified outcomes are shown separately from AI suggestions. Suggested priority does not change measured scores."
    : `Twinly: ${run.providers.twinly}. Decisions triage: ${run.providers.decisions}. Estimated impact never changes scores.`;
  setHTML(
    "findings",
    run.findings.length
      ? run.findings.map(findingRow).join("")
      : '<p class="subtle">No findings available yet. Untested checks are not passes.</p>',
  );
  document.querySelectorAll("[data-finding]").forEach(
    (button) =>
      (button.onclick = () => {
        opener = button;
        location.hash = `run/${run.id}/finding/${button.dataset.finding}`;
      }),
  );
  setHTML(
    "check-results",
    (run.results || [])
      .map(
        (r) =>
          `<div class="check-row"><strong>${escape(r.checkId)} · ${escape(r.checkpointId)} · ${escape(verdict(r.status))}</strong><p class="subtle">${escape(r.reason)}</p></div>`,
      )
      .join(""),
  );
  $("check-results-details").hidden = v2 && !run.results?.length;
  wireEvidenceButtons();
  const networkDetails = run.networkLimitations?.length
    ? `<h3>Blocked resources and affected scope</h3><ul>${run.networkLimitations.map((item) => `<li><strong>${escape(item.resourceType || item.kind)}</strong> · ${escape(item.destination)}<p>${escape(item.reason || item.kind)}. ${escape(item.affectedChecks || "Checks cover loaded content only.")}</p></li>`).join("")}</ul>`
    : "";
  setHTML(
    "errors",
    `${run.errors.length ? `<h3>Run limitations</h3><ul>${run.errors.map((e) => `<li>${escape(e)}</li>`).join("")}</ul>` : ""}${networkDetails}`,
  );
  $("retest-form").hidden = v2 || !done(run.status);
  $("download-report").hidden = !done(run.status);
  if (!$("retest-url").value) $("retest-url").value = run.url;
  $("use-fixed").hidden = !settings || !run.url.includes("/fixtures/");
  $("comparison").hidden = v2 || !run.comparison;
  if (!v2 && run.comparison) {
    $("comparison-summary").textContent = run.comparison.comparable
      ? `Matching manifest${run.comparison.delta === null ? "" : ` · score change ${run.comparison.delta >= 0 ? "+" : ""}${round(run.comparison.delta)}`}`
      : "Not directly comparable. Scope reconstruction or manifest differs; no score delta is shown.";
    setHTML(
      "comparison-changes",
      run.comparison.changes
        .map(
          (f) =>
            `<p><strong>${escape(f.retest[0].toUpperCase() + f.retest.slice(1))}</strong> · ${escape(f.checkId)} · ${escape(f.checkpointId)} · ${escape(f.target)}</p>`,
        )
        .join(""),
    );
  }
}
async function poll() {
  if (requestInFlight || !runId) return;
  requestInFlight = true;
  const activeId = runId;
  try {
    const next = await (await api(`/api/audits/${activeId}`)).json();
    if (activeId !== runId) return;
    const freshEvents = await (
      await api(`/api/audits/${activeId}/events?format=json&after=${seq}`)
    ).json();
    if (activeId !== runId) return;
    run = next;
    receive(freshEvents);
    render();
    $("connection").textContent = done(run.status)
      ? "Saved report · browser stopped"
      : "Connected · saved-event polling";
    if (done(run.status)) {
      source?.close();
      source = null;
    } else connect();
    if (location.hash.includes("/finding/")) void showFinding();
  } catch (error) {
    $("connection").textContent =
      `Disconnected · last frame is stale. ${error.message}`;
  } finally {
    requestInFlight = false;
  }
}
async function showFinding() {
  const key = decodeURIComponent(location.hash.split("/finding/")[1] || "");
  const finding = run?.findings.find((f) => f.key === key);
  if (
    !finding ||
    ($("finding-dialog").dataset.key === finding.key &&
      $("finding-dialog").open)
  )
    return;
  $("finding-title").textContent = finding.title;
  $("finding-dialog").dataset.key = finding.key;
  $("finding-detail").innerHTML = findingDetail(finding);
  if (!$("finding-dialog").open) $("finding-dialog").showModal();
  $("close-finding").focus();
  for (const id of (finding.evidenceIds || [])
    .filter((id) => /^frame-/.test(id))
    .slice(0, 4)) {
    try {
      const response = await api(`/api/audits/${runId}/evidence/${id}`),
        url = URL.createObjectURL(await response.blob());
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Stored browser evidence for ${finding.title}; details in the observations.`;
      img.onload = () => URL.revokeObjectURL(url);
      $("finding-images").append(img);
    } catch {}
  }
}
function wireEvidenceButtons() {
  document.querySelectorAll("[data-evidence]").forEach((button) => {
    button.onclick = async () => {
      opener = button;
      const id = button.dataset.evidence;
      $("finding-dialog").dataset.key = "";
      $("finding-title").textContent = "Recorded evidence";
      $("finding-detail").replaceChildren();
      const description = document.createElement("p");
      description.textContent = id;
      $("finding-detail").append(description);
      if (!$("finding-dialog").open) $("finding-dialog").showModal();
      $("close-finding").focus();
      if (!/^frame-[a-f0-9-]+$/.test(id)) {
        description.textContent = `Source record: ${id}. Open source diagnostics or download the JSON report for details.`;
        return;
      }
      const activeRun = runId;
      try {
        const response = await api(`/api/audits/${activeRun}/evidence/${id}`);
        if (activeRun !== runId || !$("finding-dialog").open) return;
        const url = URL.createObjectURL(await response.blob());
        const img = document.createElement("img");
        img.src = url;
        img.alt =
          "Actual captured browser state; its observation is described in the report.";
        img.onload = () => URL.revokeObjectURL(url);
        $("finding-detail").append(img);
      } catch (error) {
        description.textContent = `Evidence unavailable: ${error.message}`;
      }
    };
  });
}
function closeFinding() {
  if ($("finding-dialog").open) $("finding-dialog").close();
  history.replaceState(null, "", `#run/${runId}`);
  const key = opener?.dataset.finding;
  if (key)
    [...document.querySelectorAll("[data-finding]")]
      .find((e) => e.dataset.finding === key)
      ?.focus();
  else if (opener?.dataset.evidence)
    document.querySelectorAll("[data-evidence]").forEach((button) => {
      if (button.dataset.evidence === opener.dataset.evidence) button.focus();
    });
}
$("close-finding").onclick = closeFinding;
$("finding-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeFinding();
});
function route() {
  if (!$("token-row").hidden && !settings) {
    $("start-view").hidden = false;
    $("run-view").hidden = true;
    return;
  }
  const match = location.hash.match(
    /^#run\/([a-zA-Z0-9-]+)(?:\/finding\/[^/]+)?$/,
  );
  if (match) clearRecentImages();
  $("start-view").hidden = !!match;
  $("run-view").hidden = !match;
  if (!match) {
    $("finding-dialog").close();
    clearInterval(pollTimer);
    source?.close();
    source = null;
    runId = null;
    if (settings) void loadRecent();
    return;
  }
  if (runId !== match[1]) {
    runId = match[1];
    run = null;
    events = [];
    seq = 0;
    frameId = null;
    seenPhases.clear();
    source?.close();
    source = null;
    clearInterval(pollTimer);
    $("retest-url").value = "";
    for (const id of [
      "findings",
      "action-trail",
      "categories",
      "check-results",
      "checkpoints",
      "errors",
    ])
      $(id).replaceChildren();
    $("overall-score").textContent = "No score yet";
    $("overall-coverage").textContent = "Pending";
    $("conclusive").textContent = "";
    $("provisional").textContent = "Coverage pending";
    $("frame-link").hidden = true;
    $("frame-status").textContent = "Waiting for the first captured frame.";
    $("current-action").textContent = "Waiting for the runner.";
    $("connection").textContent = "Connecting…";
    $("retest-form").hidden = true;
    $("comparison").hidden = true;
    $("download-report").hidden = true;
    $("download-error").textContent = "";
    $("cancel-button").hidden = false;
    $("cancel-button").disabled = false;
    pollTimer = setInterval(poll, 1500);
    void poll();
    $("run-title").tabIndex = -1;
    $("run-title").focus();
  } else if (location.hash.includes("/finding/")) void showFinding();
  else if ($("finding-dialog").open) closeFinding();
}
window.addEventListener("hashchange", route);
await configure();
route();

setInterval(async () => {
  if (!settings) return;
  try {
    showRuntime((await (await api("/api/config")).json()).server);
  } catch {}
}, 15000);
