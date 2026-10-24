import {
  escape,
  round,
  verdict,
  categoryCard,
  findingRow,
  actionLine,
  findingDetail,
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
    await loadRecent();
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
async function loadRecent() {
  try {
    const recent = await (await api("/api/audits")).json();
    setHTML(
      "recent-audits",
      recent.length
        ? `<ol class="recent-list">${recent.map((item) => `<li><a href="#run/${escape(item.id)}">${escape(item.url)}</a><p class="subtle">${escape(item.status)} · ${escape(new Date(item.createdAt).toLocaleString())}${item.baselineRunId ? " · Retest" : ""}${item.summary ? ` · ${item.summary.score === null ? "Not scored" : `${round(item.summary.score)}/100`}${item.summary.provisional ? " · Provisional" : ""} · ${item.summary.coverage === null ? "Coverage N/A" : `${round(item.summary.coverage)}% coverage`}` : " · Results pending"}</p></li>`).join("")}</ol>`
        : '<p class="subtle">No saved audits yet. Start with the demo site or a public URL.</p>',
    );
  } catch (error) {
    $("recent-audits").textContent = `Saved runs unavailable. ${error.message}`;
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
        `Executed by Twinly: ${event.payload.action.reason}`;
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
    setHTML("categories", s.categories.map(categoryCard).join(""));
  }
  $("scope-description").textContent =
    `${run.manifest.checkpoints.filter((c) => c.reconstructed !== false).length} of ${run.manifest.checkpoints.length} planned states reconstructed. Exploration ${run.explorationComplete ? "finished normally" : run.explorationStop || "in progress"}. Keyboard checks cover selected interactions; reflow uses 320 CSS pixels.`;
  const blockers = run.findings.filter((f) => f.blocker);
  $("blockers").textContent = blockers.length
    ? `${blockers.length} confirmed essential-task blocker(s).`
    : "No confirmed essential-task blockers in this sample. Individual failures and uncertainty remain visible below.";
  $("triage-status").textContent =
    `Twinly: ${run.providers.twinly}. Decisions triage: ${run.providers.decisions}. Estimated impact never changes scores.`;
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
    run.results
      .map(
        (r) =>
          `<div class="check-row"><strong>${escape(r.checkId)} · ${escape(r.checkpointId)} · ${escape(verdict(r.status))}</strong><p class="subtle">${escape(r.reason)}</p></div>`,
      )
      .join(""),
  );
  setHTML(
    "errors",
    run.errors.length
      ? `<h3>Run limitations</h3><ul>${run.errors.map((e) => `<li>${escape(e)}</li>`).join("")}</ul>`
      : "",
  );
  $("retest-form").hidden = !done(run.status);
  $("download-report").hidden = !done(run.status);
  if (!$("retest-url").value) $("retest-url").value = run.url;
  $("use-fixed").hidden = !settings || !run.url.includes("/fixtures/");
  $("comparison").hidden = !run.comparison;
  if (run.comparison) {
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
  for (const id of finding.evidenceIds.slice(0, 4)) {
    try {
      const response = await api(`/api/audits/${runId}/evidence/${id}`),
        url = URL.createObjectURL(await response.blob());
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Stored evidence for ${finding.checkId} at ${finding.checkpointId}; details in the observations.`;
      img.onload = () => URL.revokeObjectURL(url);
      $("finding-images").append(img);
    } catch {}
  }
}
function closeFinding() {
  if ($("finding-dialog").open) $("finding-dialog").close();
  history.replaceState(null, "", `#run/${runId}`);
  const key = opener?.dataset.finding;
  if (key)
    [...document.querySelectorAll("[data-finding]")]
      .find((e) => e.dataset.finding === key)
      ?.focus();
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
