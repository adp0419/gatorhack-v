import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openBrowser, execute } from "../../src/browser.js";
import { fixtureHtml, validationRecipe } from "../../src/fixtures.js";
import {
  axeChecks,
  keyboardChecks,
  validationChecks,
  reflowChecks,
  restore,
} from "../../src/checks.js";

test("same detectors confirm seeded defects and accept fixed/negative controls", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(fixtureHtml(req.url.split("/").at(-1)));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  const record = async () => "frame-test";
  try {
    for (const variant of ["broken", "fixed", "negative"]) {
      const page = session.page,
        url = `${origin}/fixtures/${variant}`;
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      const axe = await axeChecks(page, "state-1", "frame-test");
      const statuses = Object.fromEntries(
        axe.results.map((r) => [r.checkId, r.status]),
      );
      assert.equal(
        statuses.F01,
        variant === "broken" ? "failed" : "passed",
        `${variant} form name`,
      );
      assert.equal(
        statuses.C01,
        variant === "broken" ? "failed" : "passed",
        `${variant} text contrast`,
      );
      assert.equal(
        statuses.S02,
        variant === "broken" ? "failed" : "passed",
        `${variant} image alternatives`,
      );
      assert.equal(
        statuses.S03,
        variant === "broken" ? "failed" : "passed",
        `${variant} ARIA relationships`,
      );
      const box = await page.locator("#menu-control").boundingBox();
      const selected = await execute(page, {
        type: "click",
        x: ((box.x + box.width / 2) / 1280) * 1000,
        y: ((box.y + box.height / 2) / 800) * 1000,
        reason: "Test-selected control, not a Twinly demonstration",
        commits: false,
      });
      const keyboard = await keyboardChecks({
        page,
        url,
        setupActions: [],
        selected: [selected],
        checkpointId: "state-1",
        record,
      });
      assert.deepEqual(
        keyboard.map((r) => r.status),
        variant === "broken" ? ["failed", "failed"] : ["passed", "passed"],
        `${variant} keyboard probe`,
      );
      await restore(page, url, []);
      const validation = await validationChecks(
        page,
        "state-1",
        validationRecipe,
        record,
      );
      assert.deepEqual(
        validation.map((r) => r.status),
        variant === "broken" ? ["failed", "failed"] : ["passed", "passed"],
        `${variant} validation`,
      );
      await restore(page, url, []);
      const reflow = await reflowChecks(page, "state-1", [selected], record);
      assert.equal(
        reflow[0].status,
        variant === "broken"
          ? "failed"
          : variant === "negative"
            ? "review"
            : "passed",
        `${variant} reflow`,
      );
      assert.equal(
        reflow[1].status,
        "passed",
        `${variant} menu works at narrow width`,
      );
      if (variant === "negative") {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.locator("#open-dialog").click();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#info-dialog")
            .evaluate((e) => e.contains(document.activeElement)),
          true,
        );
      }
    }
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});

test("executor blocks implicit Enter, credentials, side effects and cross-origin navigation", async () => {
  const server = http.createServer((_req, res) =>
    res.end(
      '<html><body><form><input id="name"><button id="commit">Confirm order</button></form><a id="external" href="https://example.org/">Learn</a></body></html>',
    ),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`,
    session = await openBrowser({ origin, fixtureOrigin: origin });
  try {
    const page = session.page;
    await page.goto(`${origin}/fixtures/fixed`);
    await page.locator("#name").focus();
    await assert.rejects(
      () =>
        execute(page, {
          type: "key",
          keys: "return",
          reason: "test",
          commits: false,
        }),
      /submission/,
    );
    const box = await page.locator("#commit").boundingBox();
    await assert.rejects(
      () =>
        execute(page, {
          type: "click",
          x: ((box.x + box.width / 2) / 1280) * 1000,
          y: ((box.y + box.height / 2) / 800) * 1000,
          reason: "test",
          commits: false,
        }),
      /blocked/,
    );
    assert.equal(
      await page.evaluate(async () => {
        try {
          const r = await fetch("/api/config");
          return r.ok;
        } catch {
          return false;
        }
      }),
      false,
    );
    await assert.rejects(() =>
      page.goto("http://169.254.169.254/latest/meta-data/"),
    );
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});

test("keyboard probes operate unique controls without IDs and with duplicate IDs", async () => {
  const server = http.createServer((_req, res) =>
    res.end(`
    <html><body><h1>Repeated navigation</h1>
    <nav><div><button id="duplicate">Open</button></div></nav>
    <main><div><button id="duplicate">Open</button><button>Open details</button></div></main>
    <p id="details" hidden>Details are visible</p>
    <script>
      document.querySelector('main button').onclick = () => document.querySelector('#details').hidden = false;
      document.querySelector('main button:last-child').onclick = () => document.querySelector('#details').hidden = false;
    </script></body></html>`),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  const url = `${origin}/fixtures/fixed`;
  try {
    for (const selector of [
      "main button:first-child",
      "main button:last-child",
    ]) {
      await session.page.goto(url);
      const box = await session.page.locator(selector).boundingBox();
      const outcome = await execute(session.page, {
        type: "click",
        x: ((box.x + box.width / 2) / 1280) * 1000,
        y: ((box.y + box.height / 2) / 800) * 1000,
        reason: "Regression test",
        commits: false,
      });
      assert.equal(
        await session.page.locator(outcome.target.selector).count(),
        1,
      );
      assert.notEqual(outcome.target.identity, "id:duplicate");
      const checks = await keyboardChecks({
        page: session.page,
        url,
        setupActions: [],
        selected: [outcome],
        checkpointId: "state-1",
        record: async () => "test",
      });
      assert.deepEqual(
        checks.map((r) => r.status),
        ["passed", "passed"],
      );
    }
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});

test("start navigation cannot redirect an authorized fixture outside its origin", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(302, { Location: "https://example.com/" });
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  try {
    await assert.rejects(() =>
      session.navigateStart(`${origin}/fixtures/fixed`),
    );
    assert.notEqual(new URL(session.page.url()).origin, "https://example.com");
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});

test("initial same-origin redirects work but exploration redirects cannot escape", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/fixtures/broken") {
      res.writeHead(302, { Location: "/fixtures/fixed" });
      return res.end();
    }
    if (req.url === "/fixtures/negative") {
      res.writeHead(302, { Location: "https://example.com/" });
      return res.end();
    }
    res.end(
      '<html><body><h1>Landing page</h1><a href="/fixtures/negative">Learn more</a></body></html>',
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  try {
    assert.equal(
      await session.navigateStart(`${origin}/fixtures/broken`),
      `${origin}/fixtures/fixed`,
    );
    assert.equal(await session.page.locator("h1").innerText(), "Landing page");
    await assert.rejects(() =>
      session.page.goto(`${origin}/fixtures/negative`),
    );
    assert.notEqual(new URL(session.page.url()).origin, "https://example.com");
    assert.ok(
      session.restrictions.some(
        (r) => r.kind === "Blocked navigation or request",
      ),
    );
  } finally {
    await session.close();
    await new Promise((r) => server.close(r));
  }
});
