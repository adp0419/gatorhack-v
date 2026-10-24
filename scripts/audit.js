import { FileStore } from "../src/store.js";
import { newRun } from "../src/runner.js";
import {
  newWebsiteRun,
  runEvaluation,
  isWebsiteRun,
  isLegacyRun,
} from "../src/evaluation.js";
import { config } from "../src/config.js";
import { validateStart } from "../src/policy.js";
const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run audit -- https://example.com");
  process.exit(1);
}
const fixtureOrigin = `http://127.0.0.1:${config.port}`;
const target = await validateStart(url, {
  allowedOrigins: config.allowedOrigins,
  fixtureOrigin,
  publicTargets: config.publicTargets,
});
const store = new FileStore();
const baseline = process.argv[3] ? await store.get(process.argv[3]) : undefined;
if (baseline && isWebsiteRun(baseline))
  throw new Error("Website evaluation comparisons are not supported yet.");
if (baseline && !isLegacyRun(baseline))
  throw new Error("Unsupported baseline schema");
if (
  baseline &&
  (new URL(baseline.url).origin !== target.origin ||
    !["completed", "partial", "failed", "canceled"].includes(baseline.status))
)
  throw new Error(
    "Retest requires a finished legacy baseline on the same origin.",
  );
const run = baseline
  ? newRun(target.href, fixtureOrigin, baseline.id)
  : newWebsiteRun(target.href, fixtureOrigin);
await store.save(run);
await runEvaluation(run, { store, fixtureOrigin, baseline });
console.log(
  JSON.stringify(
    {
      id: run.id,
      status: run.status,
      score: run.summary.score,
      numericAvailable: run.summary.numericAvailable,
      journeyCoverage: run.summary.journeyCoverage ?? run.summary.coverage,
      providers: run.providers,
      errors: run.errors,
    },
    null,
    2,
  ),
);
