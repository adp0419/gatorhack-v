export const VERSIONS = Object.freeze({
  schema: "accessbench-v1",
  scoring: "equal-categories-v1",
  prompt: "explore-v2",
});
export const WEBSITE_VERSIONS = Object.freeze({
  schema: "website-evaluation-v2",
  scoring: "website-health-v2",
  prompt: "website-review-v3",
});
export const VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 800 },
  narrow: { width: 320, height: 800 },
});
export const BUDGETS = Object.freeze({
  calls: 12,
  rejectedActions: 3,
  explorationMs: 180_000,
  requestMs: 30_000,
  totalMs: 300_000,
  checkpoints: 3,
  keyboardKeys: 40,
  keyboardProbeMs: 45_000,
  stateChecksMs: 90_000,
});
export const terminal = (status) =>
  ["completed", "partial", "failed", "canceled"].includes(status);
export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  dataDir: process.env.ACCESSBENCH_DATA_DIR || ".accessbench",
  publicTargets: process.env.AUDIT_PUBLIC_TARGETS !== "false",
  allowedOrigins: (process.env.AUDIT_ALLOWED_ORIGINS || "https://example.com")
    .split(",")
    .map((s) => s.trim()),
  demoToken: process.env.ACCESSBENCH_DEMO_TOKEN,
  twinlyUrl: (
    process.env.TWINLY_URL ||
    "https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1"
  ).replace(/\/$/, ""),
  twinlyKey: process.env.TWINLY_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  pagespeedKey: process.env.PAGESPEED_API_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it",
};
