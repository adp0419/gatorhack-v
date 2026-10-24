// Website health is an index of the measured scope, never an AI judgment.
const validScore = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;
const passed = (status) => ["passed", "pass"].includes(status);
const failed = (status) => ["failed", "fail"].includes(status);

export function scoreWebsite({ lighthouse, journey, design } = {}) {
  // A frozen assertion is one unit, even when several attempts observed it.
  const assertions = new Map();
  for (const assertion of journey?.assertions || []) {
    if (typeof assertion.id === "string" && !assertions.has(assertion.id))
      assertions.set(assertion.id, assertion);
  }
  const planned = [...assertions.values()];
  const eligibleAssertions = planned.filter(
    (assertion) => assertion.status !== "not_applicable",
  );
  const passCount = eligibleAssertions.filter((a) => passed(a.status)).length;
  const failCount = eligibleAssertions.filter((a) => failed(a.status)).length;
  const conclusive = passCount + failCount;
  const eligible = eligibleAssertions.length;
  const journeyCoverage = eligible ? (100 * conclusive) / eligible : null;
  const functionality = conclusive ? (100 * passCount) / conclusive : null;
  const categories = [
    ["accessibility", "Accessibility"],
    ["seo", "SEO"],
    ["performance", "Performance"],
  ].map(([id, name]) => {
    const source = lighthouse?.categories?.[id];
    const available =
      lighthouse?.status === "available" && validScore(source?.score);
    return {
      id,
      name,
      score: available ? source.score : null,
      source: "Google PageSpeed Insights / Lighthouse",
      reason: available
        ? null
        : source?.reason ||
          lighthouse?.reason ||
          "Page measurement unavailable.",
    };
  });
  categories.push({
    id: "functionality",
    name: "Functionality",
    score: functionality,
    source: "Playwright-verified customer journey",
    reason:
      functionality === null
        ? journey?.reason || "No conclusive outcomes in the selected journey."
        : null,
  });
  const measured = categories.filter((category) => category.score !== null);
  const score = measured.length
    ? measured.reduce((total, category) => total + category.score, 0) /
      measured.length
    : null;
  const provisional = measured.length < 4 || conclusive < eligible;
  return {
    score,
    provisional,
    categories,
    numericAvailable: measured.length,
    numericTotal: 4,
    journeyCoverage,
    conclusive,
    eligible,
    reportPartial:
      provisional ||
      design?.status !== "available" ||
      journey?.status !== "completed",
  };
}
