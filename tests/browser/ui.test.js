import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import axe from "axe-core";
import { mkdir } from "node:fs/promises";
import { testApp } from "./helpers.js";
import { runAudit } from "../../src/runner.js";

test("actual application start/results/inspector, keyboard focus, narrow layout and text enlargement", async () => {
  let startedRuns = 0;
  const app = await testApp((run, options) => {
    const hold = ++startedRuns === 3;
    return runAudit(run, {
      ...options,
      provider: async ({ signal }) => {
        if (!hold)
          throw new Error("Deliberate provider outage in test harness");
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
      decisionProvider: async () => {
        throw new Error("Deliberate triage outage in test harness");
      },
    });
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(app.origin);
    await page.waitForSelector("[data-demo=broken]");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(), "Skip to content");
    await page.keyboard.press("Enter");
    await page.locator("#target-url").focus();
    await page.keyboard.type("https://unconfigured.example");
    await page.locator("#start-button").press("Enter");
    await page.waitForFunction(
      () => document.getElementById("form-error").textContent.length > 0,
    );
    assert.equal(
      await page.locator("#target-url").getAttribute("aria-invalid"),
      "true",
    );
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(axe.source);
      const scan = await page.evaluate(() => axe.run());
      assert.deepEqual(
        scan.violations.map((v) => v.id),
        [],
        `start axe at ${width}`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await mkdir("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/start.png", fullPage: true });
    await page.locator('input[name="variant"][value="fixed"]').check();
    assert.ok(
      (await page.locator("#demo-link").getAttribute("href")).endsWith(
        "/fixtures/fixed",
      ),
    );
    await page.locator('input[name="variant"][value="broken"]').check();
    await page.locator("#demo-button").press("Enter");
    {
      await page.waitForSelector("[data-finding]");
      await page.waitForFunction(
        () => document.getElementById("lifecycle").textContent === "partial",
      );
      const downloadEvent = page.waitForEvent("download");
      await page.locator("#download-report").press("Enter");
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /^accessbench-.*\.json$/);
      const focusedKey = await page
        .locator("[data-finding]")
        .first()
        .getAttribute("data-finding");
      await page.locator("[data-finding]").first().focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector("#finding-dialog[open]");
      assert.equal(
        await page.locator(":focus").getAttribute("id"),
        "close-finding",
      );
      await page.evaluate(axe.source);
      const inspector = await page.evaluate(() => axe.run());
      assert.deepEqual(
        inspector.violations.map((v) => v.id),
        [],
        "inspector axe",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(":focus").getAttribute("data-finding"),
        focusedKey,
      );
      for (const width of [1280, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const scan = await page.evaluate(() => axe.run());
        assert.deepEqual(
          scan.violations.map((v) => v.id),
          [],
          `report axe at ${width}`,
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
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .map((e) => ({
            tag: e.tagName,
            id: e.id,
            text: e.textContent.slice(0, 80),
          })),
      );
      assert.deepEqual(overflow, [], "200% text at 320px");
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "100%"),
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({
        path: "test-results/report.png",
        fullPage: true,
      });
      const baselineHash = await page.evaluate(() => location.hash);
      await page.locator("#use-fixed").focus();
      await page.keyboard.press("Enter");
      assert.ok(
        (await page.locator("#retest-url").inputValue()).endsWith(
          "/fixtures/fixed",
        ),
      );
      await page.locator("#retest-button").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        (hash) => location.hash !== hash,
        baselineHash,
      );
      await page.waitForSelector("#comparison:not([hidden])");
      assert.match(
        await page.locator("#comparison-changes").textContent(),
        /Resolved/,
      );
      await page.locator(".brand").focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector("#start-view:not([hidden])");
      await page.waitForSelector("#recent-audits a");
      const savedHash = await page
        .locator("#recent-audits a")
        .first()
        .getAttribute("href");
      await page.locator("#recent-audits a").first().press("Enter");
      await page.waitForSelector("#download-report:not([hidden])");
      assert.equal(await page.evaluate(() => location.hash), savedHash);
      await page.locator(".brand").press("Enter");
      await page.waitForSelector("#start-view:not([hidden])");
      await page.locator("[data-demo=broken]").click();
      await page.locator("#start-button").focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector("#cancel-button:not([hidden])");
      await page.locator("#cancel-button").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.getElementById("lifecycle").textContent === "canceled",
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await app.close();
  }
});
