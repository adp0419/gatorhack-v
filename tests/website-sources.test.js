import test from "node:test";
import assert from "node:assert/strict";
import {
  measurePage,
  normalizeLighthouse,
  parseDesignReview,
  reviewWebsite,
} from "../src/website-sources.js";

const url = "https://example.com/";
const report = () => ({
  lighthouseResult: {
    requestedUrl: url,
    finalUrl: url,
    lighthouseVersion: "13.0.0",
    fetchTime: "2026-10-23T12:00:00Z",
    configSettings: { formFactor: "mobile" },
    categories: Object.fromEntries(
      ["accessibility", "seo", "performance", "best-practices"].map((id) => [
        id,
        { id, score: 0.8, auditRefs: [{ id: "manual-check", weight: 0 }] },
      ]),
    ),
    audits: {
      "manual-check": {
        title: "Check manually",
        score: null,
        scoreDisplayMode: "manual",
      },
      "total-blocking-time": {
        title: "Total Blocking Time",
        numericValue: 123,
        numericUnit: "millisecond",
        scoreDisplayMode: "numeric",
        score: 0.9,
      },
      "error-check": {
        score: null,
        scoreDisplayMode: "error",
        errorMessage: "Unavailable",
      },
    },
    runWarnings: ["Timing may vary"],
  },
});
const lookup = async () => [{ address: "93.184.215.14", family: 4 }];
const response = (value) => ({ ok: true, json: async () => value });
const review = () => ({
  summary: "The primary action is visible in the captured desktop state.",
  observations: [
    {
      category: "design",
      title: "Clear next step",
      observation: "The heading and primary link form a clear hierarchy.",
      evidenceIds: ["frame-1"],
    },
  ],
  recommendations: [
    {
      category: "design",
      title: "Review link wording",
      recommendation: "Consider naming the destination in the link label.",
      evidenceIds: ["frame-1"],
      priority: "low",
    },
  ],
  limitations: ["No mobile interaction was assessed."],
});
const gemini = (value = review()) => ({
  candidates: [
    {
      finishReason: "STOP",
      content: { parts: [{ text: JSON.stringify(value) }] },
    },
  ],
});

test("PageSpeed explicitly requests all four categories and mobile, without a body", async () => {
  let request;
  const measured = await measurePage({
    url,
    apiKey: "private-key",
    lookup,
    fetchImpl: async (endpoint, options) => {
      request = { endpoint, options };
      return response(report());
    },
  });
  assert.deepEqual(request.endpoint.searchParams.getAll("category").sort(), [
    "accessibility",
    "best-practices",
    "performance",
    "seo",
  ]);
  assert.equal(request.endpoint.searchParams.get("strategy"), "mobile");
  assert.equal(request.endpoint.searchParams.get("url"), url);
  assert.equal(request.options.body, undefined);
  assert.equal(measured.categories.accessibility.score, 80);
  assert.equal(measured.raw.lighthouseResult.lighthouseVersion, "13.0.0");
});

test("Lighthouse preserves zero, precision, warnings and audit display modes", () => {
  const raw = report();
  raw.lighthouseResult.categories.performance.score = 0;
  raw.lighthouseResult.categories.seo.score = 0.87654;
  const normalized = normalizeLighthouse(raw, url);
  assert.equal(normalized.status, "available");
  assert.equal(normalized.categories.performance.score, 0);
  assert.equal(normalized.categories.seo.score, 87.654);
  assert.deepEqual(normalized.warnings, ["Timing may vary"]);
  assert.equal(normalized.audits["manual-check"].scoreDisplayMode, "manual");
  assert.equal(normalized.audits["manual-check"].score, null);
  assert.equal(normalized.audits["error-check"].scoreDisplayMode, "error");
  assert.equal(
    normalized.audits["total-blocking-time"].numericUnit,
    "millisecond",
  );
  assert.equal(normalized.audits["total-blocking-time"].numericValue, 123);
});

test("missing, null, nonfinite, nonnumeric and out-of-range category values stay unavailable", () => {
  for (const value of [null, undefined, "0.9", NaN, Infinity, -0.1, 1.1]) {
    const raw = report();
    raw.lighthouseResult.categories.performance.score = value;
    const normalized = normalizeLighthouse(raw, url);
    assert.equal(normalized.categories.performance.score, null);
    assert.match(
      normalized.categories.performance.reason,
      /valid category score/,
    );
    assert.equal(normalized.categories.accessibility.score, 80);
  }
});

test("fatal runtime errors and URL mismatches prevent merging scores", () => {
  for (const change of [
    (raw) => {
      raw.lighthouseResult.runtimeError = {
        code: "NO_FCP",
        message: "No first paint",
      };
    },
    (raw) => {
      raw.lighthouseResult.finalUrl = "https://other.example/";
    },
    (raw) => {
      raw.lighthouseResult.finalUrl = "http://127.0.0.1/";
    },
    (raw) => {
      raw.lighthouseResult.requestedUrl = "https://other.example/";
    },
    (raw) => {
      delete raw.lighthouseResult.finalUrl;
    },
  ]) {
    const raw = report();
    change(raw);
    const normalized = normalizeLighthouse(raw, url);
    assert.equal(normalized.status, "unavailable");
    assert.ok(
      Object.values(normalized.categories).every(
        (category) => category.score === null,
      ),
    );
  }
  const raw = report();
  raw.lighthouseResult.runtimeError = { code: "NO_ERROR" };
  assert.equal(normalizeLighthouse(raw, url).status, "available");
});

test("PageSpeed never sends private, unresolved, or sensitive URLs", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(report());
  };
  for (const target of [
    "http://127.0.0.1/",
    "https://user:password@example.com/",
    "https://example.com/?access_token=secret",
  ]) {
    await assert.rejects(measurePage({ url: target, fetchImpl, lookup }));
  }
  await assert.rejects(
    measurePage({
      url,
      fetchImpl,
      lookup: async () => [{ address: "10.1.2.3", family: 4 }],
    }),
  );
  assert.equal(calls, 0);
});

test("provider HTTP and transport failures expose no credential or echoed body", async () => {
  await assert.rejects(
    measurePage({
      url,
      apiKey: "secret-key",
      lookup,
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: "secret-key" }),
      }),
    }),
    (error) => error.message === "PageSpeed returned HTTP 429.",
  );
  await assert.rejects(
    measurePage({
      url,
      lookup,
      fetchImpl: async () => {
        throw new Error("private-key in fetch URL");
      },
    }),
    (error) => error.message === "PageSpeed request failed.",
  );
});

test("Gemini validates evidence links and never accepts a design score or invented source mutation", () => {
  assert.deepEqual(parseDesignReview(gemini(), ["frame-1"]), review());
  for (const mutate of [
    (value) => {
      value.score = 100;
    },
    (value) => {
      value.observations[0].evidenceIds = ["frame-invented"];
    },
    (value) => {
      value.observations[0].evidenceIds = [];
    },
    (value) => {
      value.recommendations[0].category = "best-practices";
    },
    (value) => {
      value.recommendations[0].priority = "guaranteed";
    },
    (value) => {
      value.observations[0].status = "failed";
    },
    (value) => {
      value.summary = "x".repeat(2001);
    },
  ]) {
    const value = review();
    mutate(value);
    assert.throws(
      () => parseDesignReview(gemini(value), ["frame-1"]),
      /invalid fields|unknown evidence/,
    );
  }
});

test("refused, truncated, invalid JSON or unsupported Gemini content stays unavailable", () => {
  assert.throws(
    () => parseDesignReview({ promptFeedback: { blockReason: "SAFETY" } }, []),
    /refused/,
  );
  const truncated = gemini();
  truncated.candidates[0].finishReason = "MAX_TOKENS";
  assert.throws(() => parseDesignReview(truncated, ["frame-1"]), /incomplete/);
  const invalid = gemini();
  invalid.candidates[0].content.parts[0].text = "not JSON";
  assert.throws(() => parseDesignReview(invalid, []), /not valid JSON/);
  const tool = gemini();
  tool.candidates[0].content.parts = [
    { functionCall: { name: "changeScore" } },
  ];
  assert.throws(() => parseDesignReview(tool, []), /unsupported/);
});

test("Gemini sends actual inline screenshots and a structured schema, without browser tools", async () => {
  let request;
  const result = await reviewWebsite({
    apiKey: "private-key",
    model: "gemini-test",
    screenshots: [
      { id: "frame-1", data: "YWJj", viewport: { width: 1280, height: 800 } },
    ],
    fetchImpl: async (endpoint, options) => {
      request = { endpoint, options };
      return response(gemini());
    },
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.options.headers["x-goog-api-key"], "private-key");
  assert.equal(body.contents[0].parts[2].inlineData.data, "YWJj");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(
    body.generationConfig.responseJsonSchema.additionalProperties,
    false,
  );
  assert.equal(body.tools, undefined);
  assert.equal(result.status, "available");
  assert.equal(result.model, "gemini-test");
  assert.equal(result.score, undefined);
});

test("invalid Gemini output keeps raw artifact for private diagnostic persistence", async () => {
  const raw = gemini();
  raw.candidates[0].finishReason = "SAFETY";
  await assert.rejects(
    reviewWebsite({
      apiKey: "key",
      model: "gemini-test",
      screenshots: [{ id: "frame-1", data: "YWJj" }],
      fetchImpl: async () => response(raw),
    }),
    (error) => error.raw === raw && /refused/.test(error.message),
  );
});

test("large source artifacts yield a bounded Gemini evidence summary with metrics and independent verdicts", async () => {
  const measurements = normalizeLighthouse(report(), url);
  for (let index = 0; index < 500; index++)
    measurements.audits[`audit-${index}`] = {
      title: "A measured diagnostic",
      score: 0,
      scoreDisplayMode: "binary",
      description: "x".repeat(10000),
      details: { items: Array(20).fill("x".repeat(1000)) },
    };
  let context;
  await reviewWebsite({
    apiKey: "key",
    model: "gemini-test",
    measurements,
    screenshots: [{ id: "frame-1", data: "YWJj" }],
    evidence: [{ id: "frame-1", text: "Site text ".repeat(2000) }],
    journey: {
      id: "one",
      status: "partial",
      goal: "Locate pricing",
      assertions: [
        {
          id: "assertion-1",
          status: "review",
          reason: "Ambiguous",
          evidenceIds: ["frame-1"],
        },
      ],
      steps: Array(12).fill({
        action: { type: "click" },
        after: { text: "x".repeat(50000) },
      }),
    },
    fetchImpl: async (_endpoint, options) => {
      const body = JSON.parse(options.body);
      context = JSON.parse(
        body.contents[0].parts[0].text.split("\n").slice(1).join("\n"),
      );
      return response(gemini());
    },
  });
  assert.equal(context.measurements.diagnostics.length, 30);
  assert.equal(context.measurements.metrics[0].id, "total-blocking-time");
  assert.equal(context.measurements.metrics[0].numericValue, 123);
  assert.equal(context.journey.assertions[0].status, "review");
  assert.equal(context.journey.steps[0].after.text.length, 600);
  assert.equal(context.evidence[0].text.length, 1200);
  assert.ok(JSON.stringify(context).length < 50000);
  assert.equal(Object.keys(measurements.audits).length, 503);
});

test("HTTP error artifacts preserve useful response information with credentials redacted before truncation", async () => {
  const secret = "k".repeat(4000);
  await assert.rejects(
    measurePage({
      url,
      apiKey: secret,
      lookup,
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 403,
            message: `Invalid key ${secret}`,
            status: "PERMISSION_DENIED",
            apiKey: secret,
          },
        }),
      }),
    }),
    (error) => {
      assert.equal(error.raw.httpStatus, 403);
      assert.equal(error.raw.response.error.code, 403);
      assert.equal(error.raw.response.error.status, "PERMISSION_DENIED");
      assert.equal(error.raw.response.error.message, "Invalid key [redacted]");
      assert.equal(error.raw.response.error.apiKey, "[redacted]");
      return true;
    },
  );
});

test("supported Gemma 4 models use screenshot input and validated plain JSON without assumed native schema support", async () => {
  for (const model of ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]) {
    let request;
    const raw = gemini();
    raw.modelVersion = model;
    const result = await reviewWebsite({
      apiKey: "private-key",
      model,
      screenshots: [
        { id: "frame-1", data: "YWJj", viewport: { width: 1280, height: 800 } },
      ],
      fetchImpl: async (endpoint, options) => {
        request = { endpoint, options };
        return response(raw);
      },
    });
    const body = JSON.parse(request.options.body);
    assert.equal(
      request.endpoint,
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    );
    assert.equal(body.contents[0].parts[2].inlineData.data, "YWJj");
    assert.equal(body.generationConfig.responseMimeType, undefined);
    assert.equal(body.generationConfig.responseJsonSchema, undefined);
    assert.deepEqual(body.generationConfig.thinkingConfig, {
      thinkingLevel: "minimal",
    });
    assert.equal(body.tools, undefined);
    assert.match(
      body.systemInstruction.parts[0].text,
      /exactly one JSON object/,
    );
    assert.match(
      body.systemInstruction.parts[0].text,
      /"additionalProperties":false/,
    );
    assert.match(body.systemInstruction.parts[0].text, /"evidenceIds"/);
    assert.equal(result.status, "available");
    assert.equal(result.model, model);
    assert.equal(result.modelVersion, model);
    assert.equal(result.outputMode, "validated-json");
    assert.equal(result.promptVersion, "website-review-v3");
    assert.equal(result.score, undefined);
  }
});

test("Gemma plain output is refused unless strict JSON structure and known evidence validate", async () => {
  const replies = [
    gemini({ ...review(), score: 100 }),
    gemini({
      ...review(),
      observations: [
        { ...review().observations[0], evidenceIds: ["made-up-frame"] },
      ],
    }),
  ];
  const fenced = gemini();
  fenced.candidates[0].content.parts[0].text = `\`\`\`json\n${JSON.stringify(review())}\n\`\`\``;
  replies.push(fenced);
  for (const raw of replies) {
    await assert.rejects(
      reviewWebsite({
        apiKey: "key",
        model: "gemma-4-26b-a4b-it",
        screenshots: [{ id: "frame-1", data: "YWJj" }],
        fetchImpl: async () => response(raw),
      }),
      (error) =>
        error.raw === raw &&
        /invalid fields|unknown evidence|not valid JSON/.test(error.message),
    );
  }
});

test("unsupported Gemma families cannot accidentally receive Gemini schema parameters", async () => {
  let calls = 0;
  await assert.rejects(
    reviewWebsite({
      apiKey: "key",
      model: "gemma-3-27b-it",
      screenshots: [{ id: "frame-1", data: "YWJj" }],
      fetchImpl: async () => {
        calls++;
        return response(gemini());
      },
    }),
    /supported Gemma 4 or Gemini/,
  );
  assert.equal(calls, 0);
});

test("empty and nonempty thought parts are ignored; only final nonthought text can validate", () => {
  const raw = gemini();
  const maliciousThought = {
    ...review(),
    score: 100,
    observations: [{ ...review().observations[0], evidenceIds: ["invented"] }],
  };
  raw.candidates[0].content.parts.unshift({
    thought: true,
    text: JSON.stringify(maliciousThought),
  });
  raw.candidates[0].content.parts.unshift({ thought: true, text: "" });
  raw.candidates[0].content.parts.unshift({
    thought: true,
    thoughtSignature: "opaque-metadata",
  });
  assert.deepEqual(parseDesignReview(raw, ["frame-1"]), review());
  raw.candidates[0].content.parts = [
    { thought: true, text: JSON.stringify(review()) },
  ];
  assert.throws(
    () => parseDesignReview(raw, ["frame-1"]),
    /no final review text/,
  );
  raw.candidates[0].content.parts = [
    { thought: true, text: JSON.stringify(review()) },
    { text: "" },
  ];
  assert.throws(
    () => parseDesignReview(raw, ["frame-1"]),
    /no final review text/,
  );
  raw.candidates[0].content.parts = [
    { thought: true, functionCall: { name: "changeScore" } },
    { text: JSON.stringify(review()) },
  ];
  assert.throws(
    () => parseDesignReview(raw, ["frame-1"]),
    /unsupported review content/,
  );
});

test("a schema echo is rejected even when preceded by legitimate thought metadata", () => {
  const raw = gemini({
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
    additionalProperties: false,
  });
  raw.candidates[0].content.parts.unshift({ thought: true, text: "" });
  assert.throws(() => parseDesignReview(raw, ["frame-1"]), /invalid fields/);
});

test("Gemma receives a final task to populate real review values rather than echo validation schema", async () => {
  await reviewWebsite({
    apiKey: "key",
    model: "gemma-4-26b-a4b-it",
    screenshots: [{ id: "frame-1", data: "YWJj" }],
    fetchImpl: async (_endpoint, options) => {
      const body = JSON.parse(options.body);
      assert.match(
        body.systemInstruction.parts[0].text,
        /Generate actual populated review VALUES/,
      );
      assert.match(
        body.systemInstruction.parts[0].text,
        /Do not return a JSON schema/,
      );
      const finalTask = body.contents[0].parts.at(-1).text;
      assert.match(finalTask, /inspect the actual evidence/);
      assert.match(finalTask, /"summary":/);
      assert.match(finalTask, /"observations":/);
      assert.match(
        finalTask,
        /Do not reproduce the validation schema or these placeholders/,
      );
      return response(gemini());
    },
  });
});
