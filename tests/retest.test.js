import { test } from "node:test";
import assert from "node:assert/strict";
import { retainSample, reconstructionComplete } from "../src/retest.js";
test("retest stops only after every baseline state and required pointer interaction is reconstructed", () => {
  const manifest = {
    checkpoints: [
      { id: "a", sample: ["id:menu"] },
      { id: "b", sample: [] },
    ],
  };
  const states = [
    {
      id: "a",
      reconstructed: true,
      selected: [{ target: { identity: "id:menu" } }],
    },
    { id: "b", reconstructed: true, selected: [] },
  ];
  assert.equal(reconstructionComplete(manifest, states), true);
  assert.equal(reconstructionComplete(manifest, states.slice(0, 1)), false);
  assert.equal(
    reconstructionComplete(manifest, [
      { ...states[0], selected: [] },
      states[1],
    ]),
    false,
  );
  assert.equal(
    reconstructionComplete(manifest, [
      states[0],
      { ...states[1], reconstructed: false },
    ]),
    false,
  );
});
test("frozen axe sample excludes new nodes while missing baseline targets stay untested", () => {
  const result = {
    checkId: "F01",
    status: "failed",
    sample: ["id:name", "id:added"],
    passedTargets: ["id:name"],
    reason: "test",
    observations: [
      { kind: "passes", nodes: [{ target: ["#name"] }] },
      { kind: "violations", nodes: [{ target: ["#added"] }] },
    ],
  };
  const retest = retainSample(result, ["id:name"]);
  assert.equal(retest.status, "passed");
  assert.equal(retest.advisory.length, 1);
  assert.deepEqual(retest.sample, ["id:name"]);
  const missing = retainSample(
    {
      ...result,
      status: "passed",
      sample: ["id:added"],
      observations: [{ kind: "passes", nodes: [{ target: ["#added"] }] }],
    },
    ["id:name"],
  );
  assert.equal(missing.status, "not_tested");
  assert.deepEqual(missing.missingTargets, ["id:name"]);
});
test("new applicability is an explicit scope change, never a comparable invented pass", () => {
  const r = retainSample(
    {
      checkId: "S03",
      status: "passed",
      sample: ["id:new"],
      passedTargets: ["id:new"],
      observations: [],
    },
    [],
  );
  assert.equal(r.status, "not_tested");
  assert.equal(r.scopeChanged, true);
});
