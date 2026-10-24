import { state, execute, inspectAt } from "./browser.js";
import { restore } from "./checks.js";
import { logicalUrl } from "./fixtures.js";

export const checkpointSignature = (snapshot, fixtureOrigin) => ({
  url: logicalUrl(snapshot.url, fixtureOrigin),
  expanded: snapshot.expanded,
});
const matches = (snapshot, signature, fixtureOrigin) =>
  JSON.stringify(checkpointSignature(snapshot, fixtureOrigin)) ===
  JSON.stringify(signature);

// Only reuse a URL already observed in the baseline, on the retest origin.
// Browser routing and the IP-pinned proxy still guard every request.
export function fallbackUrl(storedUrl, startUrl, fixtureOrigin) {
  const stored = new URL(storedUrl),
    start = new URL(startUrl);
  if (
    stored.origin !== start.origin ||
    stored.username ||
    stored.password ||
    stored.search ||
    !["http:", "https:"].includes(stored.protocol)
  )
    return null;
  if (stored.origin === fixtureOrigin) return start.href;
  return stored.href;
}

export async function reconstructCheckpoint({
  page,
  stored,
  startUrl,
  fixtureOrigin,
  guard,
  record,
}) {
  const attempts = [
    { method: "recorded replay", url: startUrl, actions: stored.setupActions },
  ];
  // ADP's page-local replay recovers overlays without repeating earlier
  // navigation. Only reuse the observed same-origin checkpoint URL.
  const actions = stored.setupActions || [];
  const tail = [];
  for (
    let i = actions.length - 1;
    i >= 0 &&
    actions[i].beforeUrl === stored.url &&
    actions[i].afterUrl === stored.url;
    i--
  )
    tail.unshift(actions[i]);
  const localReplay = fallbackUrl(stored.url, startUrl, fixtureOrigin);
  if (localReplay && tail.length && tail.length < actions.length)
    attempts.push({
      method: "page-local replay",
      url: localReplay,
      actions: tail,
    });
  const direct = fallbackUrl(stored.url, startUrl, fixtureOrigin);
  if (direct) attempts.push({ method: "direct URL", url: direct, actions: [] });
  for (const attempt of attempts) {
    guard();
    try {
      await restore(page, attempt.url, attempt.actions);
      if (!matches(await state(page), stored.signature, fixtureOrigin))
        throw new Error("Stored widget state did not match.");
      const selected = [];
      for (const identity of stored.sample) {
        guard();
        const original = stored.selected.find(
          (s) => s.target.identity === identity,
        );
        if (!original) continue;
        await restore(page, attempt.url, attempt.actions);
        if (!matches(await state(page), stored.signature, fixtureOrigin))
          continue;
        const locator = page.locator(original.target.selector);
        if ((await locator.count()) !== 1 || !(await locator.isVisible()))
          continue;
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        if (!box) continue;
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        if ((await inspectAt(page, point))?.identity !== identity) continue;
        const beforeEvidenceId = await record("Before fallback pointer probe");
        const outcome = await execute(page, {
          ...original.action,
          x: (point.x / page.viewportSize().width) * 1000,
          y: (point.y / page.viewportSize().height) * 1000,
        });
        const afterEvidenceId = await record(
          "After fallback pointer probe",
          outcome,
        );
        if (
          outcome.changed &&
          matches(
            outcome.after,
            checkpointSignature(original.after, fixtureOrigin),
            fixtureOrigin,
          )
        )
          selected.push({ ...outcome, beforeEvidenceId, afterEvidenceId });
      }
      await restore(page, attempt.url, attempt.actions);
      if (!matches(await state(page), stored.signature, fixtureOrigin))
        throw new Error("Stored state changed during reconstruction.");
      const evidenceId = await record(
        `Reconstructed by ${attempt.method} fallback`,
      );
      return {
        ...stored,
        url: page.url(),
        setupUrl: attempt.url,
        setupActions: [...attempt.actions],
        selected,
        reconstructed: true,
        reconstructedBy: `${attempt.method} fallback`,
        evidenceId,
      };
    } catch (error) {
      guard();
      await record(`${attempt.method} fallback failed: ${error.message}`);
    }
  }
  return null;
}
