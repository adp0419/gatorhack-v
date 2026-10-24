import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openBrowser, execute, stateKey } from "../../src/browser.js";
import {
  keyboardChecks,
  validationChecks,
  reflowChecks,
  restore,
} from "../../src/checks.js";
import { runAudit, newRun } from "../../src/runner.js";
import { testApp } from "./helpers.js";

async function site(html) {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(typeof html === "function" ? html(req) : html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  return {
    origin,
    session,
    close: async () => {
      await session.close();
      await new Promise((r) => server.close(r));
    },
  };
}
const record = async () => "regression-frame";
const key = (keys) => ({
  type: "key",
  keys,
  reason: "Regression probe",
  commits: false,
});

test("safe site shortcuts work outside fields, while editing and browser shortcuts stay blocked", async () => {
  const app = await site(
    `<html><body><h1>Shortcut test</h1><input id="editor"><dialog id="jump">Jump dialog</dialog><script>document.addEventListener('keydown', e => { if (e.key === '/' || e.key === '?') document.querySelector('dialog').showModal(); });</script></body></html>`,
  );
  try {
    const page = app.session.page;
    for (const shortcut of ["/", "?"]) {
      await page.goto(`${app.origin}/fixtures/fixed`);
      assert.equal((await execute(page, key(shortcut))).changed, true);
      assert.equal(await page.locator("dialog").evaluate((e) => e.open), true);
    }
    await page.goto(`${app.origin}/fixtures/fixed`);
    await page.locator("#editor").focus();
    await assert.rejects(() => execute(page, key("/")), /editing/);
    await assert.rejects(() => execute(page, key("Control+L")), /Unsupported/);
    assert.equal(await page.locator("#editor").inputValue(), "");
  } finally {
    await app.close();
  }
});

test("scroll-only anchor outcomes become positively verified keyboard and narrow samples", async () => {
  const app = await site(
    `<html><head><style>html{scroll-behavior:smooth} #about{margin-top:1600px;height:900px}</style></head><body><div id="overlay" hidden style="position:fixed;inset:0 0 auto;height:100px;z-index:999;background:white"></div><a id="jump" onfocus="if(window.keyboardMode)document.querySelector('#overlay').hidden=false" onblur="document.querySelector('#overlay').hidden=true" href="#about" onclick="event.preventDefault();document.querySelector('#about').scrollIntoView()">Biography</a><p id="clock"></p><script>document.querySelector("#clock").textContent=String(Date.now());document.addEventListener("keydown",e=>{if(e.key==="Tab")window.keyboardMode=true})</script><section id="about"><h1>Biography</h1><p>Same content at both viewports</p></section></body></html>`,
  );
  try {
    const page = app.session.page,
      url = `${app.origin}/fixtures/fixed`;
    await page.goto(url);
    const box = await page.locator("#jump").boundingBox();
    const selected = await execute(page, {
      type: "click",
      x: ((box.x + box.width / 2) / 1280) * 1000,
      y: ((box.y + box.height / 2) / 800) * 1000,
      commits: false,
      reason: "Anchor test",
    });
    assert.equal(stateKey(selected.before), stateKey(selected.after));
    assert.equal(selected.scrollTarget, "about");
    assert.equal(selected.changed, true);
    const checks = await keyboardChecks({
      page,
      url,
      setupActions: [],
      selected: [selected],
      checkpointId: "state-1",
      record,
    });
    assert.deepEqual(
      checks.map((r) => r.status),
      ["passed", "passed"],
    );
    await restore(page, url, []);
    const reflow = await reflowChecks(page, "state-1", [selected], record, {
      url,
      setupActions: [],
    });
    assert.equal(reflow[1].status, "passed");
  } finally {
    await app.close();
  }
});

test("hidden, read-only and button fields are validation N/A, visible fields retain authorization limits", async () => {
  const app = await site(
    (req) =>
      `<html><body><h1>Validation</h1>${req.url.endsWith("broken") ? '<input aria-label="Visible field">' : '<div hidden><input type="search"></div><input type="hidden"><input readonly value="Read only"><button>Open</button><input type="submit">'}</body></html>`,
  );
  try {
    const page = app.session.page;
    await page.goto(`${app.origin}/fixtures/fixed`);
    assert.deepEqual(
      (await validationChecks(page, "state-1", null, record)).map(
        (r) => r.status,
      ),
      ["not_applicable", "not_applicable"],
    );
    await page.goto(`${app.origin}/fixtures/broken`);
    assert.deepEqual(
      (await validationChecks(page, "state-1", null, record)).map(
        (r) => r.status,
      ),
      ["not_tested", "not_tested"],
    );
  } finally {
    await app.close();
  }
});

test("reflow freezes desktop targets despite mobile additions and identifies actual missing content", async () => {
  const app = await site(
    `<html><head><style>.mobile{display:none}@media(max-width:400px){.mobile{display:block}}</style></head><body><div class="mobile">${Array.from({ length: 70 }, (_, i) => `<p>Mobile extra ${i}</p>`).join("")}</div>${Array.from({ length: 65 }, (_, i) => `<p id="p${i}">Desktop content ${i}</p>`).join("")}</body></html>`,
  );
  try {
    const page = app.session.page,
      url = `${app.origin}/fixtures/fixed`;
    await page.goto(url);
    let checks = await reflowChecks(page, "state-1", [], record);
    assert.equal(checks[0].status, "passed");
    assert.equal(checks[0].observations[0].unmatched.length, 0);
    await restore(page, url, []);
    await page.addStyleTag({
      content: "@media(max-width:400px){#p10{display:none}}",
    });
    checks = await reflowChecks(page, "state-1", [], record);
    assert.equal(checks[0].status, "review");
    assert.ok(
      checks[0].observations[0].unmatched.some((n) => n.target === "id:p10"),
    );
    assert.match(checks[0].reason, /id:p10/);
  } finally {
    await app.close();
  }
});

test("blocked action feedback reaches Twinly and rejected actions never enter replay setup", async () => {
  const app = await testApp();
  try {
    const run = newRun(`${app.origin}/fixtures/fixed`, app.origin);
    await app.store.save(run);
    let calls = 0;
    await runAudit(run, {
      store: app.store,
      fixtureOrigin: app.origin,
      provider: async ({ steps }) => {
        calls++;
        if (calls === 1) return { action: key("Control+L") };
        if (calls === 2) {
          assert.match(steps.at(-1).result, /Blocked by executor/);
          return { action: key("/") };
        }
        return {
          action: { type: "done", reason: "Recovery verified", commits: false },
        };
      },
      decisionProvider: async () => {
        throw new Error("Offline test");
      },
    });
    assert.equal(calls, 3);
    assert.equal(run.explorationComplete, true);
    assert.ok(
      run.checkpoints.every((cp) =>
        cp.setupActions.every((a) => a.keys !== "Control+L"),
      ),
    );
    const second = newRun(`${app.origin}/fixtures/fixed`, app.origin);
    await app.store.save(second);
    calls = 0;
    await runAudit(second, {
      store: app.store,
      fixtureOrigin: app.origin,
      provider: async () => {
        calls++;
        return { action: key("Control+L") };
      },
      decisionProvider: async () => {
        throw new Error("Offline test");
      },
    });
    assert.equal(calls, 3);
    assert.equal(second.explorationStop, "repeated blocked actions");
    assert.equal(second.explorationComplete, false);
    const committing = newRun(`${app.origin}/fixtures/fixed`, app.origin);
    await app.store.save(committing);
    calls = 0;
    await runAudit(committing, {
      store: app.store,
      fixtureOrigin: app.origin,
      provider: async () => {
        calls++;
        return { action: { ...key("Enter"), commits: true } };
      },
      decisionProvider: async () => {
        throw new Error("Offline test");
      },
    });
    assert.equal(calls, 1);
    assert.equal(committing.explorationStop, "committing action stopped");
    assert.equal(committing.explorationComplete, false);
  } finally {
    await app.close();
  }
});

test("embedded documents load while blocked destinations have redacted, actionable scope evidence", async () => {
  const app = await site((req) =>
    req.url.endsWith("negative")
      ? "<html><body><h1>Embedded document</h1></body></html>"
      : '<html><body><h1>Main document</h1><iframe src="/fixtures/negative" title="Embedded certificate"></iframe></body></html>',
  );
  try {
    const page = app.session.page;
    await app.session.navigateStart(`${app.origin}/fixtures/fixed`);
    await page.frameLocator("iframe").locator("h1").waitFor();
    assert.equal(app.session.restrictions.length, 0);
    await assert.rejects(() =>
      page.goto("https://outside.example/embedded.pdf?private=value"),
    );
    const restriction = app.session.restrictions.at(-1);
    assert.equal(restriction.resourceType, "document");
    assert.match(restriction.reason, /landing origin/);
    assert.match(restriction.affectedChecks, /loaded content/);
    assert.equal(
      restriction.destination,
      "https://outside.example/embedded.pdf",
    );
  } finally {
    await app.close();
  }
});

test("server reports stale source files and returns to current after the change is removed", async () => {
  const { writeFile, rm } = await import("node:fs/promises");
  const filename = new URL(
    `../../public/.runtime-probe-${process.pid}.js`,
    import.meta.url,
  );
  const app = await testApp();
  try {
    const config = async () => (await fetch(`${app.origin}/api/config`)).json();
    assert.equal((await config()).server.stale, false);
    await writeFile(filename, "// Temporary stale-build regression probe\n");
    const stale = (await config()).server;
    assert.equal(stale.stale, true);
    assert.ok(stale.fingerprint && stale.revision && stale.startedAt);
    await rm(filename);
    assert.equal((await config()).server.stale, false);
  } finally {
    await rm(filename, { force: true });
    await app.close();
  }
});

test("multi-hop redirects are validated before rendering and pointer redirects retain the real final URL", async () => {
  let escape = false;
  const server = http.createServer((req, res) => {
    if (req.url === "/fixtures/fixed") {
      res.writeHead(302, { Location: "/fixtures/negative" });
      res.end();
      return;
    }
    if (req.url === "/fixtures/negative" && escape) {
      res.writeHead(302, { Location: "https://outside.example/" });
      res.end();
      return;
    }
    res.end(
      req.url === "/fixtures/negative"
        ? "<html><body><h1>Final destination</h1></body></html>"
        : '<html><body><h1>Start</h1><a href="/fixtures/fixed">Explore</a></body></html>',
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  try {
    await session.navigateStart(`${origin}/fixtures/broken`);
    const box = await session.page.locator("a").boundingBox();
    const outcome = await execute(session.page, {
      type: "click",
      x: ((box.x + box.width / 2) / 1280) * 1000,
      y: ((box.y + box.height / 2) / 800) * 1000,
      reason: "Redirect probe",
      commits: false,
    });
    assert.equal(outcome.after.url, `${origin}/fixtures/negative`);
    assert.equal(
      await session.page.locator("h1").innerText(),
      "Final destination",
    );
    escape = true;
    await assert.rejects(
      () => session.navigateStart(`${origin}/fixtures/fixed`),
      /Fixture escape/,
    );
    assert.ok(
      session.restrictions.some(
        (r) => r.destination === "https://outside.example/",
      ),
    );
    assert.notEqual(
      new URL(session.page.url()).origin,
      "https://outside.example",
    );
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});
