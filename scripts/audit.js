import { FileStore } from "../src/store.js";
import { newRun, runAudit } from "../src/runner.js";
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
const run = newRun(target.href, fixtureOrigin, baseline?.id);
await store.save(run);
await runAudit(run, { store, fixtureOrigin, baseline });
console.log(
  JSON.stringify(
    {
      id: run.id,
      status: run.status,
      score: run.summary.score,
      coverage: run.summary.coverage,
      providers: run.providers,
      errors: run.errors,
    },
    null,
    2,
  ),
);
