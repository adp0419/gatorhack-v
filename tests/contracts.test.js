import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateAxe, REGISTRY } from "../src/registry.js";
import { parseTriage } from "../src/providers.js";
import {
  isPublicAddress,
  parseTarget,
  resolvePublic,
  validateAction,
  validateStart,
} from "../src/policy.js";
import { score } from "../src/scoring.js";
import axe from "axe-core";
const raw = {
  violations: [],
  passes: [{ id: "label" }],
  incomplete: [],
  inapplicable: [],
};
test("frozen axe IDs exist and mixed engine results aggregate honestly", () => {
  for (const id of REGISTRY.flatMap((c) => c.rules))
    assert.ok(
      axe.getRules().some((r) => r.ruleId === id),
      id,
    );
  assert.equal(aggregateAxe(null, ["label"]), "not_tested");
  assert.equal(aggregateAxe({ ...raw, passes: [] }, ["label"]), "not_tested");
  assert.equal(aggregateAxe(raw, ["label"]), "passed");
  assert.equal(
    aggregateAxe({ ...raw, incomplete: [{ id: "label" }] }, ["label"]),
    "review",
  );
  assert.equal(
    aggregateAxe(
      { ...raw, incomplete: [{ id: "label" }], violations: [{ id: "label" }] },
      ["label"],
    ),
    "failed",
  );
  assert.equal(
    aggregateAxe({ ...raw, passes: [], inapplicable: [{ id: "label" }] }, [
      "label",
    ]),
    "not_applicable",
  );
});
test("normalized endpoints clamp to actual CSS pixel indices", () => {
  const result = validateAction(
    { type: "click", x: 1000, y: 500, reason: "test", commits: false },
    { width: 1280, height: 800 },
  );
  assert.deepEqual(result.css, { x: 1279, y: 400 });
});
test("malformed and committing actions, implicit submission typing and browser keys rejected", () => {
  for (const action of [
    { type: "click", x: 10, y: 0, commits: true, reason: "x" },
    { type: "click", x: 1001, y: 0, commits: false, reason: "x" },
    { type: "type", text: "hello\n", commits: false, reason: "x" },
    { type: "key", keys: "cmd+l", commits: false, reason: "x" },
    {
      type: "scroll",
      x: 0,
      y: 0,
      amount: 500,
      direction: "down",
      commits: false,
      reason: "x",
    },
    { type: "unknown", commits: false, reason: "x" },
  ])
    assert.throws(() => validateAction(action, { width: 1280, height: 800 }));
});
test("network policy covers IPv4, mapped IPv6, credentials, DNS rebinding and ports", async () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "100.100.100.200",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("93.184.216.34"), true);
  for (const url of [
    "http://localhost",
    "http://2130706433",
    "https://user:secret@example.com",
    "file:///etc/passwd",
    "https://example.com:8080",
    "http://[::1]",
  ])
    assert.throws(() => parseTarget(url));
  await assert.rejects(() =>
    resolvePublic("example.com", async () => [
      { address: "93.184.216.34" },
      { address: "10.0.0.1" },
    ]),
  );
  await assert.rejects(() =>
    validateStart("http://127.0.0.1:3000/api/config", {
      allowedOrigins: [],
      fixtureOrigin: "http://127.0.0.1:3000",
    }),
  );
});
test("Decisions validates typed answers and cannot influence score", () => {
  const r = REGISTRY.map((c) => ({
    checkId: c.id,
    checkpointId: "a",
    status: "review",
  }));
  const before = score(r, { checkpoints: [{ id: "a" }] });
  const triage = parseTriage({
    answers: [
      { name: "evidence_state", type: "choice", choice: "observed_barrier" },
      { name: "impact_band", type: "choice", choice: "critical" },
      { name: "needs_review", type: "predicate", probability: 0.99 },
    ],
  });
  r.forEach((x) => (x.triage = triage));
  assert.deepEqual(score(r, { checkpoints: [{ id: "a" }] }), before);
  assert.throws(() => parseTriage({ answers: [] }));
  assert.throws(() =>
    parseTriage({ answers: [{ name: "evidence_state", type: "refusal" }] }),
  );
});
test("public target mode accepts unlisted public hosts but rejects private DNS and retains restricted mode", async () => {
  const options = {
    fixtureOrigin: "http://127.0.0.1:3000",
    allowedOrigins: [],
    publicTargets: true,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
  };
  assert.equal(
    (await validateStart("https://public.example/path", options)).href,
    "https://public.example/path",
  );
  await assert.rejects(
    () =>
      validateStart("https://public.example", {
        ...options,
        publicTargets: false,
      }),
    /configured/,
  );
  await assert.rejects(
    () =>
      validateStart("https://public.example", {
        ...options,
        lookup: async () => [{ address: "10.0.0.1", family: 4 }],
      }),
    /private/,
  );
  await assert.rejects(() =>
    validateStart("http://127.0.0.1:3000/api/config", options),
  );
  await assert.rejects(
    () =>
      validateStart("https://public.example", {
        ...options,
        lookup: async () => {
          throw new Error("ENOTFOUND internal detail");
        },
      }),
    /could not be resolved/,
  );
});
