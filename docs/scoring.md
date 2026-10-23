# Scoring and comparison

Owner of all numerical rules. Score model version: `equal-categories-v1`. Inputs are the fixed check/state results in [checks.md](checks.md).

## Meaning

The **AccessBench score** summarizes conclusive results for the declared test plan. It is not a percentage of WCAG met, a percentage of site accessibility, or a ranking calibrated across unrelated sites.

Five categories have equal weight when scored. Check/state units within each category also have equal weight. Severity, affected-node count, and Decisions output do not change points. Confirmed blockers remain prominent beside the score; there is no blocker cap.

## Exact calculation

For category `c`, count registered check/state units:

```text
P_c = passed
F_c = failed
U_c = review + not_tested
A_c = not_applicable
D_c = P_c + F_c
E_c = D_c + U_c

category_score_c = 100 * P_c / D_c         if D_c > 0; otherwise null
category_coverage_c = 100 * D_c / E_c      if E_c > 0; otherwise N/A

overall_score = mean(non-null category scores)
overall_coverage = mean(category coverage for categories with E_c > 0)
```

This macro-average keeps category coverage aligned with equal category scoring. Also show the unweighted counts `sum(D_c) / sum(E_c)` as **conclusive planned checks**, not as a second conflicting coverage percentage.

Compute with full precision; round displayed scores and coverage to whole numbers at the end. Do not average rounded category scores.

## Missing evidence and applicability

- If every planned unit in a category is conclusively N/A, display **Not applicable** and exclude it from both overall calculations.
- If a category has applicable/unresolved units but no conclusive result, display **Not scored** and its coverage, normally 0%. Exclude its null score from the provisional score, while retaining it in coverage.
- If no category has conclusive results, show **No score yet**. Never convert null to 0 or 100.
- With four scored categories and one genuine N/A category, each scored category contributes 25%. With all five scored, each contributes 20%.
- A result is **Provisional** if any planned check is `review`/`not_tested`, applicability remains unknown, planned checkpoint reconstruction failed, or exploration did not finish normally.
- A complete result means completion of this bounded plan only. Avoid calling it a complete accessibility evaluation.
- No arbitrary minimum-coverage threshold suppresses a score supported by some conclusive evidence. Low-coverage scores always carry their provisional label and denominator.

## Freeze the plan

Record a manifest containing checklist/scoring/prompt versions, runtime versions, viewports, navigation policy, budgets, selected checkpoint IDs and setup goals, sampled targets, and authorization mode.

The maximum is three audited states, not three mandatory states. Normal exploration may discover fewer suitable states. Finalize the selected checkpoint plan and report that scope. During discovery, show coverage as pending or explicitly partial rather than claiming a final denominator.

Once a checkpoint/check is planned, do not remove it because execution failed. Preserve unknown applicability as unresolved. Discovery failure must mark the audit provisional even if checks on the initial checkpoint all completed. Coverage describes planned checks; separately show exploration completion and `audited / planned` checkpoints.

## Worked examples

| Situation | Result |
|---|---|
| Scores 50, 100, 100, 100, 100; complete plan | Overall 90; show any confirmed blocker separately |
| Forms genuinely N/A; remaining scores 50, 100, 100, 100 | Overall 88 (87.5 before rounding) |
| Keyboard untested; other four scores 100 with full coverage | Overall 100 **Provisional**, coverage 80%, keyboard **Not scored** |
| Category: 1 pass, 1 fail, 2 unresolved | Category score 50; coverage 50% |
| All applicable checks unresolved | No overall score; coverage 0% |
| A check fails on one node versus twenty nodes | Same scoring contribution; report different affected counts |

Use these as required test cases. Add no-applicable-evidence, mixed axe results, unknown applicability, and missing-checkpoint cases.

## Comparable retests

Retest the baseline manifest, with the same logical checkpoints, sample, budgets, methods, and viewports. Twinly still drives navigation using the stored checkpoint goals; a second unconstrained exploration is a fresh audit, not an equivalent retest.

Match findings by check ID, logical checkpoint ID, and stable target identity. Keep actual URLs and variants; an explicitly versioned fixture mapping may identify broken/fixed variants as the same logical route. Do not broadly strip URL differences or rely only on coordinates and list indices.

Report `resolved` only when the previously failing assertion/target is positively retested and passes, or an intentionally removed feature is explicitly verified with equivalent functionality assessed. Disappearance, timeout, changed selectors, N/A, or missing evidence alone yields **Unverified**, not a verified fix.

An unchanged failure is **Persistent**. A newly confirmed failure is **New**. Show unmatched results and scope differences explicitly. Show a score delta only for matching manifests and successfully reconstructed scope; otherwise show side-by-side reports labeled **Not directly comparable**.
