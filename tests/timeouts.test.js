import { test } from "node:test";
import assert from "node:assert/strict";
import { withPageDeadline } from "../src/timeouts.js";

test("hung probes close their pages and reject without reporting success", async () => {
  let closed = 0;
  await assert.rejects(
    withPageDeadline(
      15,
      () => [{ close: async () => closed++ }],
      () => new Promise(() => {}),
    ),
    /deadline exceeded/,
  );
  assert.equal(closed, 1);
  assert.equal(
    await withPageDeadline(
      100,
      () => [],
      async () => "next checkpoint",
    ),
    "next checkpoint",
  );
});
