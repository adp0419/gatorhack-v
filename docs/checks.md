# Evaluation checks and evidence

Owner of evaluation scope, verdicts, journey verification, and evidence. New evaluation schema family: `website-evaluation-v2`. Numerical rules belong to [scoring.md](scoring.md). The existing eleven-check accessibility registry is preserved in [the v1 archive](history/accessibility-v1-checks.md) for old results and supporting probes. The initial implementation chooses one visible same-origin destination or explicit reveal control and freezes three outcome units; broader multi-hop goal discovery remains limited.

## Five category contracts

| Category | MVP evaluation | Boundary |
|---|---|---|
| Accessibility | Entry-page Lighthouse accessibility results; available selected-interaction keyboard, naming, and reflow evidence as supporting findings | Automated subset; no WCAG certification or full screen-reader claim |
| Design & UX | Gemma 4 reviews captured states for clarity, navigation, hierarchy, readability, consistency, and visible friction | Qualitative opinion grounded in supplied evidence; no numeric score or user-study claim |
| SEO | Entry-page Lighthouse SEO results, retaining audit IDs and observations | Technical page checks; no ranking, keyword, backlink, or full-indexing assessment |
| Performance | Entry-page Lighthouse performance category and returned lab metrics/diagnostics | One configured page-load run; no blanket real-user responsiveness claim |
| Functionality | One Twinly-selected journey, with safe observable outcomes verified by Playwright | Selected journey only; no claim to test every control or complete production transactions |

Best Practices is supporting Lighthouse evidence. Keep its source score/audit details in the report's diagnostic section, without treating it as a sixth category or as proof that customer journeys work. Link findings to their source audit/result. Group duplicate observations by category, audit/assertion, and target while preserving provenance; multiple detectors do not create extra score deductions.

## Lighthouse scope

Request accessibility, SEO, performance, and best-practices explicitly for the validated entry/landing URL. Default strategy: **mobile**, one run per evaluation. Twinly's existing desktop viewport remains separately labeled; mobile Lighthouse does not establish that the desktop journey works on mobile. Mandatory paired mobile/desktop runs are deferred.

Retain requested/final URL, strategy, fetch time, Lighthouse version/configuration, source scores, audits, warnings, and runtime errors. If the provider lands outside the validated scope, retain the discrepancy as a limitation and do not merge that page's scores into the evaluation. A Lighthouse scan measures its own page load, not Twinly's later menu/dialog states.

Expose available metrics such as LCP, CLS, FCP, Speed Index, and Total Blocking Time using their actual returned IDs/units. Do not rename Total Blocking Time as INP or present lab metrics as field data. Real-user Core Web Vitals/CrUX are deferred; no MVP dependency on their availability.

Provider manual/informative/inapplicable/error audits remain distinguishable. An empty violations list or a successful HTTP response alone never establishes full accessibility, SEO effectiveness, or successful page measurement.

## One automatic customer journey

1. Inspect the initial page. Twinly chooses a relevant, safe objective from observed content: for example, finding a service and reaching its contact form, locating pricing, or navigating to a product detail page.
2. Persist the goal, why it is relevant, the observable safe endpoint, and a bounded plan of normally 3–5 assertion units before executing the journey. Site-derived plans must pass server-side validation and must not include submissions. The initial inspection is part of this one journey, not an extra exploration pass.
3. Use at most three selected states including the initial page. Intermediate screenshots/actions do not create more scored states. The number of outcomes is independent of the state limit; a state can support several outcomes.
4. Twinly chooses each action. The executor records what actually happened. Playwright checks stable URL, visible content/control state, and safe interaction effects against the planned outcomes.
5. Stop at the safe endpoint, policy boundary, provider stop, cancellation, or budget. Keep the one selected goal even if it fails. Recovery within the same goal is permitted; do not choose an easier second journey or delete failed assertions to improve the score.

For an informational page with little interaction, allow a smaller honest plan with at least one explicit assertion; show its reduced scope. If no useful safe objective can be selected, report journey unavailable and retain other sources.

Example inquiry journey: verify that the service navigation is available, that the chosen service page loads with expected content, and that its inquiry form can be reached with visible named fields. Expected outcomes must be specific enough to reject an error page or unrelated URL. This proves reaching the form, not sending a message or receiving backend delivery. Unexpected new assertions may be advisory in this run or require a new versioned plan; never silently change the scored denominator after observing failure.

## Verdicts and journey outcomes

| Assertion status | Meaning |
|---|---|
| `passed` | Independent observations positively satisfy the expected safe outcome |
| `failed` | Reproducible browser evidence contradicts the expected outcome |
| `review` | Ambiguous evidence or uncertain target/state equivalence |
| `not_tested` | Skipped, blocked, unsupported, timed out, or provider/executor stopped |
| `not_applicable` | Applicability was actually assessed and positively ruled out |

Report journey outcome separately from assertion scores:

- **Completed:** safe endpoint and all applicable required assertions positively verified.
- **Blocked:** a reproducible website defect prevents the selected safe objective; retain the observed failure and affected assertion.
- **Partial:** some work is unverified, canceled, blocked by policy, or stopped by infrastructure/provider failure. Identify the cause. A policy stop is not a confirmed website defect.
- **Unavailable:** no usable plan or journey evidence could be established. Preserve initial observations if available.

A click being dispatched, a Twinly `done` action, or Gemma 4's explanation is not proof of an achieved outcome. A timeout alone is not a functional defect or keyboard barrier. HTTP error responses, console messages, and failed requests need relevance to an observed expected outcome before being labeled customer blockers. Reproduce suspected defects from an equivalent source state when possible; otherwise retain review status.

## Gemma 4 qualitative assessment

Supply actual screenshots from selected states, URL/viewport/state metadata, a bounded DOM/text summary, Lighthouse observations, and the verified journey log. Request concise evidence-linked observations under these review dimensions:

- Purpose, primary action, and next-step clarity.
- Navigation labels, orientation, and discoverability.
- Visual hierarchy, readability, and spacing.
- Consistency and visible state/feedback clarity.
- Observed journey friction and concrete opportunities for improvement.

The report includes a plain-language summary, qualitative findings, and prioritized recommendations with relevant evidence IDs and suggested remedies. Suggested business impact is a hypothesis, never measured conversion uplift. Do not infer hidden states, backend success, mobile usability, or user preferences from a screenshot. If a dimension lacks evidence, say it was not assessed. No numeric score, confidence badge, or inferred pass/fail is required for design.

Validate structured output, category names, bounded text, and evidence references. Unknown IDs, unsupported claims, refusal, invalid JSON, and provider failure must not become validated findings. Keep measured facts in their original records; AI cannot edit source values or promote ambiguous functional/accessibility evidence to confirmed failure.

## Supporting accessibility probes

Reuse the existing pinned axe mapping and selected-control keyboard checks where applicable to the journey. Record actual pointer outcomes, reset source state, keys/focus, and equivalent keyboard outcomes. A keyboard discrepancy needs independent evidence; exhausted search alone is review. Do not require the whole legacy suite as a release gate for every new run.

Keep existing 320 CSS-pixel reflow evidence scoped to frozen content/control samples. Responsive replacements and two-dimensional content exceptions need explicit handling; overflow alone is not a confirmed failure. Dedicated 200% text resizing of audited websites remains deferred.

Public forms receive static, non-submitting checks. Existing server-authorized, client-only fixture recipes can test validation; visiting a public URL never grants this authorization. No error currently being visible is not proof that validation works. Supplemental assertions retain their own coverage but have no extra weight in the four-category health formula.

## Evidence contract

Every result records source, method/version, actual URL, timestamp, viewport/device strategy, state/target identity where applicable, expected/observed outcome, verdict/availability, limitations, and evidence IDs. Recommendations also record AI model/prompt version and evidence links. Add WCAG references only where relevant to the accessibility assertion.

Keep raw source artifacts and actual before/after screenshots, proposed versus executed actions, actor/phase labels, and reproduction steps. Audited text/HTML is untrusted and escaped. Store frames privately. Do not invent screenshots for Lighthouse or represent Twinly frames as Google's browser session.

## Official references

- [PageSpeed Insights API parameters and response](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed) and [lab versus field data](https://developers.google.com/speed/docs/insights/v5/about).
- [Gemma 4 on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) and [Gemma image understanding](https://ai.google.dev/gemma/docs/capabilities/vision/image). Gemma output is requested as JSON and validated by the application; Gemini native structured-output support is not assumed for Gemma.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).
