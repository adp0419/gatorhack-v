# Website health scoring and comparison

Owner of numerical policy. New evaluations implement `website-health-v2` in `src/health-scoring.js`. Legacy `equal-categories-v1` behavior is preserved in [the archived scoring policy](history/accessibility-v1-scoring.md). Live source acceptance is tracked separately in [status.md](status.md).

## Category sources

| Category | Numeric source | Included in overall score? |
|---|---|---|
| Accessibility | Lighthouse accessibility category score | Yes |
| Design & UX | Qualitative Gemma 4 findings only, as requested by the user | No |
| SEO | Lighthouse SEO category score | Yes |
| Performance | Lighthouse performance category score | Yes |
| Functionality | Independently verified outcomes for the one selected journey | Yes |

There are five report categories and four potential numeric scores. Display Design & UX as **Qualitative review**, never 0, 100, N/A, or a missing numeric category. Its review can separately be pending, available, or unavailable. Best Practices diagnostics have no additional numeric weight. Supplemental keyboard/axe/reflow findings do not silently alter Lighthouse scores.

## Exact calculation

Default weights are equal among the four numeric categories: 25% each when all are available. This is an explainable product index, not a calibrated prediction of commercial success.

```text
accessibility = 100 * lighthouse.categories.accessibility.score
seo           = 100 * lighthouse.categories.seo.score
performance   = 100 * lighthouse.categories.performance.score

P = passed journey assertions
F = failed journey assertions
U = review + not_tested journey assertions
A = positively established not_applicable journey assertions

functionality          = 100 * P / (P + F)     if P + F > 0; otherwise null
journey_check_coverage = 100 * (P + F) / (P + F + U)
                                                if denominator > 0; otherwise N/A

overall_health = mean(available numeric category scores)
                                                if at least one exists; otherwise null
score_availability = number of available numeric categories / 4
```

The provider object name is `lighthouseResult` in PageSpeed Insights responses; `lighthouse` above denotes that extracted object. Accept only finite category values in [0, 1]. Preserve valid zero scores. Null, absent, nonnumeric, errored, or malformed source values remain unavailable; never coerce them to 0 or 100. Manual/informative/N/A/error Lighthouse audits are not scored locally as passes. Use the provider category scores, not an invented equal average of audit rows.

Compute at full precision and round displayed numbers to whole points only at the end. Count each frozen journey assertion once, regardless of repeated clicks, observed nodes, or retries. Exact assertions and plan-freezing rules belong to [checks.md](checks.md).

## Completeness and uncertainty

- If any numeric category is unavailable or any journey assertion remains unresolved, label the composite **Provisional** and show which sources are missing. Partial evidence can yield 100; that never establishes a completed journey.
- Show **3 of 4 numeric categories scored**, plus journey assertion coverage and the journey's separate outcome. These are scope disclosures, not a percentage of the website tested or an estimate of correctness.
- If Gemma 4 is unavailable, measured category scores remain valid; show **Design review/recommendations unavailable** and label the report partial even when all numeric scores exist. Numeric completeness and report completeness are separate.
- If no numeric evidence exists, show **No score available**. Retain observed findings and source errors.
- A category can be unavailable because its provider failed. That is not N/A. Design & UX intentionally has no number.
- If no safe journey can be selected, Functionality is unavailable. If every planned journey assertion is proven N/A, retain the plan and explain why the journey was unsuitable; do not award 100 or quietly reduce the four-category denominator.
- Confirmed blockers remain visible regardless of score. Severity, issue count, Gemma 4 recommendations, and Best Practices findings do not apply additional deductions or score caps.
- Preserve Lighthouse warnings and run configuration. An available source score with warnings can be shown with limitations; fatal source errors must not appear as successful measurements.

Call the result **Website health score — tested scope**. Explain that it combines one page's automated scores and one journey's conclusive checks. It is not percent accessible, full-site quality, SEO ranking potential, conversion probability, or comprehensive functional correctness.

## Required numerical examples

| Inputs | Expected display |
|---|---|
| Accessibility 80, SEO 90, Performance 60, Functionality 100 | Overall 83 (82.5 before rounding); 4/4 numeric scores |
| Same values; Gemma 4 qualitative critique is severe | Same overall 83; critique shown separately |
| Functionality unavailable; other values 80, 90, 60 | Overall 77 Provisional; 3/4 numeric scores |
| Journey: 2 pass, 1 fail, 1 unresolved | Functionality 67, assertion coverage 75%; partial journey |
| Journey: 1 pass, 2 unresolved | Functionality 100 Provisional, assertion coverage 33%; no journey-completion claim |
| Valid Lighthouse Performance 0 | Preserve 0 and include it in the average |
| All numeric sources unavailable | No score available; 0/4 numeric scores |
| All numeric scores present; Gemma 4 unavailable | Numeric result retained; report partial, qualitative review unavailable |

## Versions and comparisons

Persist requested/final URLs, source identity, Lighthouse version and configuration/strategy, timestamps, schema and scoring versions, Twinly journey goal and frozen assertions, viewports, guard/authorization mode, prompt/model versions, and evidence references. PageSpeed and Twinly may observe different page/device states; report those differences rather than implying identical execution conditions.

Never convert an accessibility-v1 report into a website-health-v2 report or show a cross-version overall delta. Keep its original labels, five accessibility subcategory scores, formula, and evidence. Preserve legacy comparison tests and behavior.

New v2 comparison UI is deferred. When added, compare like sources/configurations and the same logical journey assertions; changed models/prompts, device strategy, missing measurements, failed reconstruction, or changed scope require explicit differences. Lighthouse performance varies between runs; a small score movement alone does not verify a fix. A finding is resolved only after positive retest evidence, not because its target disappeared or Gemma 4 stopped mentioning it.
