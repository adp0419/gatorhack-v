import axe from "axe-core";
import { REGISTRY } from "./registry.js";
import { aggregateAxe } from "./registry.js";
import { BUDGETS, VIEWPORTS } from "./config.js";
import { execute, state, stateKey, settlePage } from "./browser.js";

const RULES = [...new Set(REGISTRY.flatMap((r) => r.rules))];
if (RULES.some((id) => !axe.getRules().some((r) => r.ruleId === id)))
  throw new Error("Frozen axe mapping contains an unsupported rule");
export const methodVersion = `axe-${axe.version}/probes-v1`;
export function result(
  checkId,
  checkpointId,
  status,
  reason,
  observations = [],
  extra = {},
) {
  return {
    checkId,
    checkpointId,
    status,
    reason,
    observations,
    method: methodVersion,
    viewport: VIEWPORTS.desktop,
    timestamp: new Date().toISOString(),
    evidenceIds: [],
    sample: [],
    passedTargets: [],
    ...extra,
  };
}

export async function axeChecks(page, checkpointId, evidenceId) {
  await page.evaluate(axe.source);
  const raw = await page.evaluate(
    async (rules) =>
      window.axe.run(document, {
        runOnly: { type: "rule", values: rules },
        resultTypes: ["violations", "incomplete", "passes", "inapplicable"],
      }),
    RULES,
  );
  return {
    raw,
    results: await Promise.all(
      REGISTRY.filter((c) => c.rules.length).map(async (check) => {
        let status = aggregateAxe(raw, check.rules);
        const observations = [
          "violations",
          "incomplete",
          "passes",
          "inapplicable",
        ].flatMap((kind) =>
          raw[kind]
            .filter((r) => check.rules.includes(r.id))
            .map((r) => ({
              kind,
              ruleId: r.id,
              help: r.help,
              helpUrl: r.helpUrl,
              nodes: r.nodes.map((n) => ({
                target: n.target,
                html: n.html,
                summary: n.failureSummary,
                any: n.any,
                all: n.all,
                none: n.none,
              })),
            })),
        );
        if (check.id === "F01") {
          const nodes = observations.flatMap((o) => o.nodes);
          for (const node of nodes.slice(0, 20)) {
            try {
              if (node.target.length !== 1)
                throw new Error("Unsupported compound target");
              node.accessibleSnapshot = await page
                .locator(node.target[0])
                .ariaSnapshot({ timeout: 1000 });
            } catch {
              node.nameEvidenceUnavailable = true;
            }
          }
          if (
            status === "passed" &&
            (nodes.length > 20 || nodes.some((n) => n.nameEvidenceUnavailable))
          )
            status = "review";
        }
        const passedTargets = observations
          .filter((o) => o.kind === "passes")
          .flatMap((o) => o.nodes.map((n) => identity(n.target)));
        return result(
          check.id,
          checkpointId,
          status,
          `${status.replaceAll("_", " ")} within the supported axe rule sample.`,
          observations,
          {
            evidenceIds: [evidenceId],
            passedTargets,
            sample: observations.flatMap((o) =>
              o.nodes.map((n) => identity(n.target)),
            ),
          },
        );
      }),
    ),
  };
}
export const identity = (targets) => {
  const s = Array.isArray(targets) ? targets.join(" ") : targets;
  return /^#[\w-]+$/.test(s) ? `id:${s.slice(1)}` : s;
};

export async function restore(page, url, actions) {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await settlePage(page, true);
  for (const action of actions) {
    if (["done", "fail"].includes(action.type)) continue;
    await execute(page, action);
  }
}

export async function keyboardChecks({
  page,
  url,
  setupActions,
  selected,
  checkpointId,
  record,
  signal,
}) {
  await restore(page, url, setupActions);
  if (!selected.length) {
    const controls = await page
      .locator(
        "a,button,input,select,textarea,[role=button],[onclick],[tabindex]",
      )
      .count();
    const status = controls ? "not_tested" : "not_applicable";
    return ["K01", "K02"].map((id) =>
      result(
        id,
        checkpointId,
        status,
        controls
          ? "No safe pointer interaction was selected for this state."
          : "No candidate interactive controls were observed.",
      ),
    );
  }
  const observations = [];
  for (const selectedAction of selected.slice(0, 2)) {
    const { target, after } = selectedAction;
    if (!target || !selectedAction.changed) continue;
    const attempts = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw signal.reason;
      await restore(page, url, setupActions);
      const initial = await state(page);
      const equivalent = stateKey(initial) === stateKey(selectedAction.before);
      const focusTrail = [];
      let reached = false,
        activated = false;
      const visited = new Set();
      if (equivalent) {
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        for (let i = 0; i < BUDGETS.keyboardKeys; i++) {
          if (signal?.aborted) throw signal.reason;
          await page.keyboard.press("Tab");
          const focused = await page.evaluate(() => {
            const e = document.activeElement;
            return {
              id: e?.id,
              tag: e?.tagName,
              text: e?.textContent?.trim().slice(0, 100),
              selector: e ? window.__abSelector(e) : null,
            };
          });
          focusTrail.push({ key: "Tab", focused });
          if (
            await page
              .locator(target.selector)
              .evaluate((e) => e === document.activeElement)
          ) {
            reached = true;
            break;
          }
          const key = JSON.stringify(focused);
          if (visited.has(key)) break;
          visited.add(key);
        }
        if (reached) {
          const keys = target.tag === "A" ? ["Enter"] : ["Enter", "Space"];
          for (const key of keys) {
            // The selected pointer action was already validated as non-submitting.
            if (target.inForm) break;
            const beforeUrl = page.url();
            await execute(page, {
              type: "key",
              keys: key.toLowerCase(),
              reason: "Independent selected-control keyboard probe",
              commits: false,
            });
            await settlePage(page, page.url() !== beforeUrl);
            const observed = await state(page);
            focusTrail.push({ key, state: observed });
            if (stateKey(observed) === stateKey(after)) {
              activated = true;
              break;
            }
          }
        }
      }
      const evidenceId = await record(page, "Keyboard checks", "probe", {
        target: target.identity,
        attempt,
        focusTrail,
        equivalent,
        reached,
        activated,
      });
      attempts.push({ equivalent, reached, activated, focusTrail, evidenceId });
      if (reached && activated) break;
    }
    // A timeout or a bounded tab search is never a confirmed missing path.
    // A repeatable non-focusable click listener with no recognized keyboard
    // handler supplies implementation evidence in addition to the probe.
    const missing =
      attempts.length === 2 &&
      attempts.every((a) => a.equivalent && !a.reached) &&
      target.tabIndex < 0 &&
      target.clickListener &&
      !target.keyboardListener &&
      !target.alternativePath &&
      !["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(
        target.tag,
      );
    observations.push({
      target: target.identity,
      metadata: target,
      attempts,
      reach: attempts.some((a) => a.reached)
        ? "passed"
        : missing
          ? "failed"
          : "review",
      activation: attempts.some((a) => a.activated)
        ? "passed"
        : missing
          ? "failed"
          : "review",
      expected: after,
      actual: "See focus and activation timeline",
    });
  }
  return ["K01", "K02"].map((id, index) => {
    const property = index ? "activation" : "reach";
    const status = observations.some((o) => o[property] === "failed")
      ? "failed"
      : !observations.length
        ? "not_tested"
        : observations.some((o) => o[property] === "review")
          ? "review"
          : "passed";
    return result(
      id,
      checkpointId,
      status,
      status === "failed"
        ? "Repeated keyboard probe and implementation evidence demonstrate a missing keyboard path."
        : "Selected interaction tested from an equivalent reset state; uncertainty is retained.",
      observations,
      {
        evidenceIds: observations.flatMap((o) =>
          o.attempts.map((a) => a.evidenceId),
        ),
        sample: observations.map((o) => o.target),
        passedTargets: observations
          .filter((o) => o[property] === "passed")
          .map((o) => o.target),
      },
    );
  });
}

export async function validationChecks(page, checkpointId, recipe, record) {
  const count = await page
    .locator("input:not([type=hidden]),select,textarea")
    .count();
  if (!count)
    return ["F02", "F03"].map((id) =>
      result(
        id,
        checkpointId,
        "not_applicable",
        "No relevant fields observed.",
      ),
    );
  if (!recipe)
    return ["F02", "F03"].map((id) =>
      result(
        id,
        checkpointId,
        "not_tested",
        "Active validation is not authorized for this target.",
      ),
    );
  await page.locator(recipe.field).fill("");
  await page.locator(recipe.trigger).click();
  const observation = await page.evaluate((recipe) => {
    const field = document.querySelector(recipe.field),
      error = document.querySelector(recipe.error);
    const text = error?.innerText?.trim() || "";
    const ids = [
      ...(field?.getAttribute("aria-describedby") || "").split(/\s+/),
      ...(field?.getAttribute("aria-errormessage") || "").split(/\s+/),
    ];
    return {
      text,
      errorId: error?.id,
      fieldId: field?.id,
      invalid: field?.getAttribute("aria-invalid"),
      related: !!error?.id && ids.includes(error.id),
      visible: !!error?.getBoundingClientRect().height,
      html: field?.outerHTML,
    };
  }, recipe);
  const evidenceId = await record(
    page,
    "Other accessibility checks",
    "probe",
    observation,
  );
  const target = `id:${observation.fieldId}`;
  const identified =
    observation.visible &&
    new RegExp(recipe.problemPattern, "i").test(observation.text);
  const relationship = observation.visible && observation.related;
  return [
    result(
      "F02",
      checkpointId,
      identified ? "passed" : observation.visible ? "failed" : "not_tested",
      "Configured, client-only validation recipe: field/problem identification.",
      [observation],
      {
        evidenceIds: [evidenceId],
        sample: [target],
        passedTargets: identified ? [target] : [],
      },
    ),
    result(
      "F03",
      checkpointId,
      relationship
        ? "passed"
        : recipe.relationshipRequired && observation.visible
          ? "failed"
          : "review",
      "Configured recipe assesses the required error relationship, accepting describedby or errormessage.",
      [observation],
      {
        evidenceIds: [evidenceId],
        sample: [target],
        passedTargets: relationship ? [target] : [],
      },
    ),
  ];
}

async function layout(page) {
  return page.evaluate(() => {
    const visible = (e) => {
      const s = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return (
        !!r.width &&
        !!r.height &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };
    const nodes = [
      ...document.querySelectorAll(
        "h1,h2,h3,p,a,button,input,label,li,[onclick],[role=button],[tabindex]",
      ),
    ]
      .filter(visible)
      .slice(0, 60)
      .map((e) => {
        const r = e.getBoundingClientRect();
        let clipped = false;
        const clips = [];
        for (
          let p = e.parentElement;
          p && p !== document.body;
          p = p.parentElement
        ) {
          const style = getComputedStyle(p),
            b = p.getBoundingClientRect();
          if (
            ["hidden", "clip"].includes(style.overflowX) &&
            (r.right > b.right + 2 || r.left < b.left - 2)
          ) {
            clipped = true;
            clips.push({
              tag: p.tagName,
              overflow: style.overflowX,
              bounds: { left: b.left, right: b.right },
            });
          }
        }
        const table = !!e.closest("table,[role=table],svg,canvas");
        const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)),
          y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
        const hit = document.elementFromPoint(x, y);
        return {
          target: e.id ? `id:${e.id}` : null,
          text: (e.textContent || "").trim().slice(0, 250),
          tag: e.tagName,
          clipped,
          clips,
          table,
          bounds: { left: r.left, right: r.right, width: r.width },
          hit: e === hit || e.contains(hit),
          outside: r.left >= innerWidth || r.right <= 0,
        };
      });
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      nodes,
    };
  });
}
export async function reflowChecks(page, checkpointId, selected, record) {
  const desktop = await layout(page);
  await page.setViewportSize(VIEWPORTS.narrow);
  await page.waitForTimeout(150);
  const narrow = await layout(page);
  const evidenceId = await record(page, "Other accessibility checks", "probe", {
    desktop,
    narrow,
  });
  const lost = narrow.nodes.filter(
    (n) =>
      n.clipped && !n.table && (n.text || ["INPUT", "BUTTON"].includes(n.tag)),
  );
  const comparable = desktop.nodes.every((n) =>
    n.target
      ? narrow.nodes.some((m) => m.target === n.target)
      : narrow.nodes.some((m) => m.text === n.text && m.tag === n.tag),
  );
  const overflow = narrow.scrollWidth > 322;
  const status = lost.length
    ? "failed"
    : overflow || !comparable
      ? "review"
      : "passed";
  const targets = selected.map((s) => (s.target || s).identity);
  const important = narrow.nodes.filter((n) => targets.includes(n.target));
  const unavailable = important.filter((n) => n.clipped || n.outside);
  const narrowOutcomes = [];
  for (const selection of selected) {
    if (!selection.target || !selection.changed || unavailable.length) continue;
    let locator = page.locator(selection.target.selector),
      replacement = false;
    if ((await locator.count()) !== 1 || !(await locator.isVisible())) {
      if (!selection.target.controls) continue;
      locator = page
        .locator("button:visible")
        .filter({ hasNot: page.locator("[disabled]") });
      const candidates = await locator.evaluateAll(
        (buttons, id) =>
          buttons
            .filter((e) => e.getAttribute("aria-controls") === id)
            .map((e) => e.id),
        selection.target.controls,
      );
      if (candidates.length !== 1 || !candidates[0]) continue;
      locator = page.locator(`[id=${JSON.stringify(candidates[0])}]`);
      replacement = true;
    }
    const box = await locator.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 320) continue;
    try {
      const before = await state(page);
      if (stateKey(before) !== stateKey(selection.before)) continue;
      const action = {
        ...selection.action,
        x: ((box.x + box.width / 2) / 320) * 1000,
        y: ((box.y + box.height / 2) / 800) * 1000,
      };
      const outcome = await execute(page, action);
      const passed = stateKey(outcome.after) === stateKey(selection.after);
      narrowOutcomes.push({
        target: selection.target.identity,
        passed,
        replacement,
        replacementSelector: replacement
          ? await locator.getAttribute("id")
          : null,
        outcome,
      });
      await record(page, "Other accessibility checks", "probe", {
        narrowActivation: outcome,
        passed,
      });
    } catch {
      narrowOutcomes.push({ target: selection.target.identity, passed: false });
    }
  }
  const controlStatus = !targets.length
    ? "not_tested"
    : unavailable.length
      ? "failed"
      : narrowOutcomes.length === targets.length &&
          narrowOutcomes.every((o) => o.passed)
        ? "passed"
        : "review";
  const observations = [
    {
      desktop,
      narrow,
      lost,
      overflow,
      comparable,
      scope:
        "Up to 60 visible text/control nodes; tables and graphical content excluded from clipping confirmation.",
    },
  ];
  return [
    result(
      "R01",
      checkpointId,
      status,
      lost.length
        ? "Text or controls are clipped by a non-scrollable ancestor at 320 CSS pixels."
        : "Sampled text/control preservation and scroll geometry assessed at 320 CSS pixels.",
      observations,
      {
        viewport: VIEWPORTS.narrow,
        evidenceIds: [evidenceId],
        sample: desktop.nodes.map((n) => n.target || `${n.tag}:${n.text}`),
        passedTargets:
          status === "passed"
            ? desktop.nodes.map((n) => n.target || `${n.tag}:${n.text}`)
            : [],
      },
    ),
    result(
      "R02",
      checkpointId,
      controlStatus,
      unavailable.length
        ? "A selected control is clipped outside its non-scrollable container."
        : controlStatus === "passed"
          ? "Selected controls reproduce their safe desktop outcomes at 320 CSS pixels."
          : "Narrow control geometry observed; activation or responsive replacement needs review.",
      [{ targets, important, unavailable, narrowOutcomes }],
      {
        viewport: VIEWPORTS.narrow,
        evidenceIds: [evidenceId],
        sample: targets,
        passedTargets: narrowOutcomes
          .filter((o) => o.passed)
          .map((o) => o.target),
      },
    ),
  ];
}
