import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import axe from "axe-core";
import { mkdir } from "node:fs/promises";
import { testApp } from "./helpers.js";
import { newWebsiteRun } from "../../src/evaluation.js";
import { scoreWebsite } from "../../src/health-scoring.js";
import { config } from "../../src/config.js";

test("start screen reopens authenticated screenshot reports, handles missing evidence and reflows", async () => {
  const oldToken = config.demoToken;
  config.demoToken = "browser-test-only-token";
  const app = await testApp();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const run = newWebsiteRun("https://example.com/", app.origin);
    run.status = "partial";
    run.summary = scoreWebsite();
    await page.goto(`${app.origin}/fixtures/fixed`);
    const frame = await app.store.frame(run, page, "Test evidence", "system");
    run.evidence = [{ id: frame }];
    await app.store.save(run);
    const absent = {
      ...run,
      id: "missing-capture",
      latestFrame: null,
      evidence: [],
    };
    await app.store.save(absent);
    await app.store.save({
      ...absent,
      id: "missing-file",
      evidence: [{ id: "frame-deadbeef" }],
    });
    assert.equal(
      (
        await page.request.get(
          `${app.origin}/api/audits/${run.id}/evidence/${frame}`,
        )
      ).status(),
      401,
    );
    await page.addInitScript(() =>
      sessionStorage.setItem("accessbench-token", "browser-test-only-token"),
    );
    await page.goto(app.origin);
    assert.equal(
      await page.locator(".url-prefix").textContent(),
      "https://www.",
    );
    assert.equal(await page.locator("#target-url").inputValue(), "");
    await page.locator("#target-url").fill("example.com/path");
    assert.equal(
      await page.locator("#start-form").evaluate((form) => {
        const value = form.querySelector("#target-url").value.trim();
        return `https://www.${value}`;
      }),
      "https://www.example.com/path",
    );
    await page.locator("#target-url").fill("");
    await page.waitForSelector(".capture-ready img");
    assert.equal(await page.locator(".report-preview").count(), 3);
    assert.equal(
      await page
        .locator(".capture-ready img")
        .getAttribute("src")
        .then((s) => s.startsWith("blob:")),
      true,
    );
    assert.match(
      await page.locator('[data-recent="missing-capture"]').textContent(),
      /No screenshot captured/,
    );
    await page.waitForFunction(() =>
      document
        .querySelector('[data-recent="missing-file"]')
        .textContent.includes("Saved screenshot unavailable"),
    );
    assert.match(
      await page.locator("#recent-audits").textContent(),
      /Provisional/,
    );
    await mkdir(".impeccable/review", { recursive: true });
    await page.screenshot({
      path: ".impeccable/review/start-fixture-desktop.png",
      fullPage: true,
    });
    await page.evaluate(axe.source);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.deepEqual(
        (await page.evaluate(() => axe.run())).violations.map((v) => v.id),
        [],
        `start axe ${width}`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "320px with 200% text",
    );
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "100%"),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: ".impeccable/review/start-fixture-mobile.png",
      fullPage: true,
    });
    const preview = page.locator(`[data-recent="${run.id}"]`);
    await preview.focus();
    await preview.press("Enter");
    await page.waitForSelector("#run-view:not([hidden])");
    assert.match(page.url(), new RegExp(run.id));
    await page.locator(".brand").click();
    await page.waitForSelector(".capture-ready img");
    await page.route("**/api/audits", (route) => route.fulfill({ json: [] }));
    await page.reload();
    await page.waitForSelector(".archive-empty");
    assert.match(
      await page.locator(".archive-empty").textContent(),
      /Illustrative journey/,
    );
    await page.route("**/api/audits", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Try again when the runner is available." },
      }),
    );
    await page.reload();
    await page.waitForFunction(() =>
      document
        .getElementById("recent-audits")
        .textContent.includes("Saved runs unavailable"),
    );
    assert.equal(await page.locator("#start-button").isEnabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    config.demoToken = oldToken;
    await browser.close();
    await app.close();
  }
});
