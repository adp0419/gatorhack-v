import { test } from "node:test";
import assert from "node:assert/strict";
import { responseNavigationOrigin, validateAction } from "../src/policy.js";
import { interactionMatches, sourceStateMatches } from "../src/browser.js";
import { categoryCard } from "../public/components.js";
import { runtimeInfo, codeFingerprint } from "../src/runtime-info.js";

test("landing scope is set by the final main-document response before embedded requests", () => {
  let scope = "http://www.public.example";
  scope = responseNavigationOrigin(
    scope,
    "https://www.public.example",
    302,
    true,
  );
  assert.equal(scope, "http://www.public.example");
  scope = responseNavigationOrigin(
    scope,
    "https://www.public.example",
    200,
    true,
  );
  assert.equal(new URL("https://www.public.example/file.pdf").origin, scope);
  assert.equal(
    responseNavigationOrigin(scope, "https://outside.example", 200, false),
    scope,
  );
  assert.equal(
    responseNavigationOrigin(scope, "https://outside.example", 500, true),
    scope,
  );
});
test("site shortcut keys do not broaden browser command permission", () => {
  for (const keys of ["/", "?", "slash"])
    assert.ok(
      validateAction(
        { type: "key", keys, reason: "test", commits: false },
        { width: 1280, height: 800 },
      ).key,
    );
  for (const keys of ["Control+L", "Meta+R", "Alt+Left", "F12"])
    assert.throws(() =>
      validateAction(
        { type: "key", keys, reason: "test", commits: false },
        { width: 1280, height: 800 },
      ),
    );
});
test("scroll outcome requires the intended destination, not arbitrary scroll movement", () => {
  const after = {
    url: "https://public.example/",
    text: "Biography",
    expanded: [],
    visibleAnchors: ["about"],
  };
  const selection = { after, scrollTarget: "about" };
  assert.equal(interactionMatches(after, selection), true);
  assert.equal(
    interactionMatches({ ...after, visibleAnchors: ["footer"] }, selection),
    false,
  );
});
test("unscored categories explain missing evidence and escape site-derived reasons", () => {
  const html = categoryCard(
    {
      title: "Keyboard",
      id: "keyboard",
      state: "not_scored",
      score: null,
      coverage: 0,
      conclusive: 0,
      eligible: 2,
      checkIds: ["K01"],
    },
    [
      {
        checkId: "K01",
        checkpointId: "state-1",
        reason: "No observed interaction <script>",
      },
    ],
  );
  assert.match(html, /No conclusive pass\/fail/);
  assert.match(html, /No observed interaction &lt;script&gt;/);
});
test("runtime identity reflects the loaded build without exposing configuration secrets", () => {
  const info = runtimeInfo();
  assert.equal(info.fingerprint, codeFingerprint());
  assert.equal(info.stale, false);
  assert.ok(info.instanceId && info.startedAt && info.revision);
  assert.equal(Object.keys(info).length, 5);
});

test("reset matching tolerates unrelated rotating text while rejecting changed headings or dialog state", () => {
  const before = {
    url: "https://public.example/",
    heading: "Biography",
    expanded: [],
    dialogs: [],
    text: "9:31 PM · Analyst",
  };
  assert.equal(
    sourceStateMatches({ ...before, text: "9:32 PM · Researcher" }, before),
    true,
  );
  assert.equal(
    sourceStateMatches({ ...before, heading: "Checkout" }, before),
    false,
  );
  assert.equal(
    sourceStateMatches({ ...before, dialogs: ["#payment"] }, before),
    false,
  );
});
