import axe from "axe-core";
import { layout, compareLayouts } from "./layout.js";
import { REGISTRY } from "./registry.js";
import { aggregateAxe } from "./registry.js";
import { BUDGETS, VIEWPORTS } from "./config.js";
import {
  execute,
  navigatePage,
  state,
  stateKey,
  settlePage,
  interactionMatches,
  sourceStateMatches,
} from "./browser.js";

const RULES = [...new Set(REGISTRY.flatMap((r) => r.rules))];
if (RULES.some((id) => !axe.getRules().some((r) => r.ruleId === id)))
  throw new Error("Frozen axe mapping contains an unsupported rule");
export const methodVersion = `axe-${axe.version}/probes-v2`;
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
  await navigatePage(page, url, { waitUntil: "domcontentloaded" });
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
  selectionReason,
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
          ? selectionReason ||
              "No successful pointer interaction with an observed outcome was selected; keyboard operation remains untested."
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
      const locator = page.locator(target.selector);
      const targetMatches =
        (await locator.count()) === 1 &&
        (await locator.evaluate(
          (e, original) =>
            e.tagName === original.tag &&
            (e.getAttribute("role") || null) === (original.role || null) &&
            (e.getAttribute("aria-controls") || null) ===
              (original.controls || null) &&
            e.tabIndex === original.tabIndex &&
            (e.getAttribute("href") || null) === (original.href || null) &&
            (
              e.getAttribute("aria-label") ||
              e.innerText ||
              e.getAttribute("alt") ||
              ""
            ).slice(0, 200) === original.name,
          target,
        ));
      const equivalent =
        targetMatches && sourceStateMatches(initial, selectedAction.before);
      const focusTrail = [];
      let reached = false,
        activated = false;
      const visited = new Set();
      if (equivalent) {
        await page.evaluate((scroll) => {
          document.activeElement?.blur();
          window.scrollTo(scroll?.x || 0, scroll?.y || 0);
        }, selectedAction.before.scroll);
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
            try {
              await execute(page, {
                type: "key",
                keys: key.toLowerCase(),
                reason: "Independent selected-control keyboard probe",
                commits: false,
              });
            } catch (error) {
              if (signal?.aborted) throw signal.reason;
              focusTrail.push({ key, blockedReason: error.message });
              break;
            }
            await settlePage(page, page.url() !== beforeUrl);
            const observed = await state(page);
            focusTrail.push({ key, state: observed });
            if (interactionMatches(observed, selectedAction)) {
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
        expectedSource: selectedAction.before,
        actualSource: initial,
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
        : status === "passed"
          ? "Selected interaction positively verified from a matched reset state."
          : observations.some((o) => o.attempts.every((a) => !a.equivalent))
            ? "The source heading, widgets, dialogs or target metadata did not match on reset; no keyboard conclusion is claimed."
            : property === "reach"
              ? "The bounded Tab search did not reach every selected target; this alone does not establish a keyboard barrier."
              : "Keyboard activation did not conclusively reproduce every selected pointer outcome; see the focus and activation evidence.",
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
  const fields = await page
    .locator("input,select,textarea,[role=textbox],[contenteditable=true]")
    .evaluateAll((nodes) =>
      nodes.map((e) => {
        const style = getComputedStyle(e),
          box = e.getBoundingClientRect();
        const excluded =
          ["hidden", "submit", "reset", "button", "image"].includes(e.type) ||
          e.disabled ||
          e.readOnly;
        return {
          selector: window.__abSelector(e),
          relevant:
            !excluded &&
            box.width > 0 &&
            box.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            !e.closest("[inert],[aria-hidden=true]"),
        };
      }),
    );
  const count = fields.filter((f) => f.relevant).length;
  if (!count)
    return ["F02", "F03"].map((id) =>
      result(
        id,
        checkpointId,
        "not_applicable",
        "No visible, enabled, editable fields in this state; hidden, disabled and button-only controls do not require validation here.",
        [{ fields }],
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

export async function reflowChecks(
  page,
  checkpointId,
  selected,
  record,
  reset = {},
) {
  const desktop = await layout(page);
  await page.setViewportSize(VIEWPORTS.narrow);
  await page.waitForTimeout(150);
  const narrow = await layout(page, desktop.nodes);
  const evidenceId = await record(page, "Other accessibility checks", "probe", {
    desktop,
    narrow,
  });
  const lost = narrow.nodes.filter(
    (n) =>
      n.clipped && !n.table && (n.text || ["INPUT", "BUTTON"].includes(n.tag)),
  );
  const { comparable, unmatched } = compareLayouts(desktop, narrow);
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
    if (reset.url) {
      await restore(page, reset.url, reset.setupActions || []);
      await page.setViewportSize(VIEWPORTS.narrow);
      await settlePage(page);
    }
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
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 320) continue;
    try {
      const before = await state(page);
      if (!sourceStateMatches(before, selection.before)) continue;
      const action = {
        ...selection.action,
        x: ((box.x + box.width / 2) / 320) * 1000,
        y: ((box.y + box.height / 2) / 800) * 1000,
      };
      const outcome = await execute(page, action);
      const passed = interactionMatches(outcome.after, selection);
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
      unmatched,
      scope:
        "Up to 60 frozen desktop text/control targets relocated at narrow width; unique same-tag/text responsive replacements accepted. Tables and graphical content excluded from clipping confirmation.",
    },
  ];
  return [
    result(
      "R01",
      checkpointId,
      status,
      lost.length
        ? "Text or controls are clipped by a non-scrollable ancestor at 320 CSS pixels."
        : unmatched.length
          ? `Could not verify ${unmatched.length} desktop target(s) at 320 CSS pixels: ${unmatched
              .slice(0, 5)
              .map((n) => `${n.target} (${n.reason})`)
              .join(", ")}. See unmatched-target evidence.`
          : overflow
            ? "Horizontal overflow observed at 320 CSS pixels; its cause or exception needs review."
            : "Frozen desktop targets preserved and scroll geometry assessed at 320 CSS pixels.",
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
          : !targets.length
            ? "No successful pointer interaction was selected, so narrow control operation could not be tested."
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
