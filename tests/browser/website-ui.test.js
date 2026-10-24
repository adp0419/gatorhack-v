import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import axe from "axe-core";
import { mkdir } from "node:fs/promises";
import { testApp } from "./helpers.js";

test("website dashboard keeps qualitative review, numeric availability, evidence and legacy scope distinct", async () => {
  const app = await testApp();
  const now = new Date().toISOString();
  const run = {
    id: "website-ui-case",
    url: "https://example.com/",
    status: "partial",
    createdAt: now,
    finishedAt: now,
    providers: {
      pagespeed: "available",
      twinly: "available",
      gemini: "available",
    },
    results: [],
    findings: [],
    errors: [],
    manifest: {
      versions: { schema: "website-evaluation-v2" },
      checkpoints: [{ id: "state-1", logicalUrl: "https://example.com/" }],
    },
    sources: {
      lighthouse: {
        status: "available",
        strategy: "mobile",
        finalUrl: "https://example.com/",
        lighthouseVersion: "recorded-test-version",
        categories: { "best-practices": { score: 75 } },
        audits: {},
        warnings: ["Recorded test warning"],
      },
      design: {
        status: "available",
        model: "gemma-4-26b-a4b-it",
        summary: "The primary navigation is clear.",
        observations: [
          {
            category: "design",
            title: "Clear navigation",
            observation: "The main choices are visible.",
            evidenceIds: ["lighthouse-report"],
          },
        ],
        recommendations: [
          {
            category: "design",
            title: "Clarify the next step",
            recommendation: "Use a descriptive action label.",
            priority: "medium",
            evidenceIds: ["lighthouse-report"],
          },
        ],
        limitations: ["One supplied state was reviewed."],
      },
    },
    journey: {
      goal: "Reach service information",
      safeEndpoint: "Service details without submission",
      status: "partial",
      stop: "Provider stopped before all outcomes were verified.",
      assertions: [
        {
          id: "destination",
          label: "Service details are visible",
          status: "passed",
          reason: "Visible heading observed",
          evidenceIds: [],
        },
        {
          id: "contact",
          label: "Contact form is visible",
          status: "not_tested",
          reason: "Not reached",
          evidenceIds: [],
        },
      ],
    },
    summary: {
      score: 77,
      provisional: true,
      numericAvailable: 3,
      numericTotal: 4,
      conclusive: 1,
      eligible: 2,
      journeyCoverage: 50,
      reportPartial: true,
      categories: [
        {
          id: "accessibility",
          name: "Accessibility",
          score: 80,
          source: "Lighthouse",
        },
        { id: "seo", name: "SEO", score: 90, source: "Lighthouse" },
        {
          id: "performance",
          name: "Performance",
          score: 60,
          source: "Lighthouse",
        },
        {
          id: "functionality",
          name: "Functionality",
          score: null,
          source: "Playwright",
          reason: "Selected journey unresolved",
        },
      ],
    },
  };
  await app.store.save(run);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${app.origin}/#run/${run.id}`);
    await page.waitForSelector('[data-category="design"]');
    assert.deepEqual(await page.locator("#categories h3").allTextContents(), [
      "Accessibility",
      "Design & UX",
      "SEO",
      "Performance",
      "Functionality",
    ]);
    assert.equal(
      await page.locator("#overall-coverage").textContent(),
      "3 of 4",
    );
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /Qualitative review/,
    );
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /Gemma4/,
    );
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /gemma-4-26b-a4b-it/,
    );
    assert.doesNotMatch(
      await page.locator('[data-category="design"]').textContent(),
      /\/100|Not scored|N\/A/,
    );
    assert.equal(await page.locator("#retest-form").isVisible(), false);
    assert.match(
      await page.locator("#conclusive").textContent(),
      /1 of 2 planned journey outcomes verified/,
    );
    assert.match(
      await page.locator("#journey-result").textContent(),
      /Not tested/,
    );
    await page.locator("#source-diagnostics > summary").press("Enter");
    assert.match(
      await page.locator("#source-diagnostic-details").textContent(),
      /Best Practices: 75\/100/,
    );
    await page
      .locator("#recommendations [data-evidence]")
      .first()
      .press("Enter");
    await page.waitForSelector("#finding-dialog[open]");
    assert.match(
      await page.locator("#finding-detail").textContent(),
      /Source record: lighthouse-report/,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(":focus").getAttribute("data-evidence"),
      "lighthouse-report",
    );
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/website-dashboard.png",
      fullPage: true,
    });
    await page.evaluate(axe.source);
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const scan = await page.evaluate(() => axe.run());
      assert.deepEqual(
        scan.violations.map((v) => v.id),
        [],
        `v2 report axe at ${width}`,
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
      "200% text at 320px",
    );
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "100%"),
    );
    run.sources.design = {
      model: "gemma-4-26b-a4b-it",
      status: "unavailable",
      reason: "Review provider unavailable",
    };
    run.summary.score = null;
    run.summary.numericAvailable = 0;
    run.summary.categories = run.summary.categories.map((c) => ({
      ...c,
      score: null,
    }));
    await app.store.save(run);
    await page.reload();
    await page.waitForFunction(
      () =>
        document.getElementById("overall-score").textContent ===
        "No score available",
    );
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /Design review unavailable/,
    );
    assert.equal(await page.locator("#categories .category").count(), 5);
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /Gemma4/,
    );
    run.sources.design = {
      status: "available",
      model: "gemini-2.5-flash",
      summary: "Retained Gemini review",
      observations: [],
      recommendations: [],
    };
    await app.store.save(run);
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-category="design"]')
        ?.textContent.includes("Retained Gemini review"),
    );
    assert.match(
      await page.locator('[data-category="design"]').textContent(),
      /Gemini · captured browser states/,
    );
    assert.doesNotMatch(
      await page.locator('[data-category="design"]').textContent(),
      /Gemma4/,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await app.close();
  }
});
