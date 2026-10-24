# Archived accessibility MVP — checks

Historical snapshot from 2026-10-23. This describes the accessibility-only implementation before the website evaluation pivot. It is not the current product contract. See [current status](../status.md) and [current MVP](../mvp.md).

# Check registry and evidence

Owner of test scope, verdicts, and WCAG references. Initial checklist version: `accessbench-v1`. This is a proposed implementable baseline, not a complete WCAG evaluation.

## Units and verdicts

A checkpoint is a selected page/UI state with a logical ID, actual URL, setup history, relevant DOM/control identities, and screenshot. Keep at most three audited checkpoints, including the initial state. Intermediate action frames are evidence, not automatically additional audited checkpoints.

Each registered check has one result per checkpoint. Per-element observations attach to that result; they do not create more scoring units. Reflow measurements are variants of a checkpoint, not additional checkpoint slots.

| Status | Meaning |
|---|---|
| `passed` | All specified observations within the stated sample conclusively satisfy the assertion |
| `failed` | Deterministic evidence conclusively falsifies the scoped assertion |
| `review` | Observed evidence is ambiguous or the assertion cannot be conclusively evaluated |
| `not_tested` | Execution skipped, blocked, unsupported, or timed out |
| `not_applicable` | Applicability was actually assessed and the assertion genuinely does not apply |

Preserve incomplete observations even if another observation establishes an aggregate failure. Passing a scoped sample says nothing about unsampled controls or other WCAG requirements.

## Scored checklist

All rows below have equal weight within their category. Each row is deliberately narrower than the referenced WCAG criterion.

| ID | Category | Assertion and boundary | Related WCAG |
|---|---|---|---|
| K01 | Keyboard | Selected pointer-interaction targets can be reached through an established keyboard path from the equivalent initial state. An exhausted search alone is `review`. | 2.1.1 |
| K02 | Keyboard | Keyboard activation of selected targets produces the expected safe state change. Use appropriate keys for the control; unresolved widget behavior is `review`. | 2.1.1 |
| F01 | Forms | Supported inputs expose programmatic accessible names; retain actual name evidence. This alone does not establish visible-label/instruction quality. | 1.3.1, 4.1.2 |
| F02 | Forms | In an authorized validation test, an observed error identifies the invalid field and problem in text. Unsupported validation behavior is `not_tested`; unclear meaning is `review`. | 3.3.1 |
| F03 | Forms | The observed validation error has an appropriate programmatic field/group relationship where that relationship is required. Missing `aria-describedby` alone is not proof of failure. | 1.3.1 |
| C01 | Contrast | axe conclusively evaluates supported visible text against applicable AA thresholds and exceptions. Preserve measured colors/ratio when available. | 1.4.3 |
| S01 | Semantics | Supported buttons and links have accessible names. Input names belong to F01, avoiding duplicate scoring of the same input-label rule. | 4.1.2; 2.4.4 where relevant |
| S02 | Semantics | Supported images meet programmatically testable text-alternative requirements. Nonempty alt text is not automatically appropriate; decorative treatment may need review. | 1.1.1 |
| S03 | Semantics | Supported ARIA attributes, required roles, and relationships satisfy the frozen axe rule subset. | 1.3.1, 4.1.2 |
| R01 | Reflow | At 320 CSS-pixel width, investigated content reflows without loss or non-exempt two-dimensional scrolling. Raw overflow is only a candidate finding. | 1.4.10 |
| R02 | Reflow | Selected important controls remain available and operable at narrow width, including a legitimate responsive replacement. Hidden desktop controls alone are not failures. | 1.4.10 |

Suggested viewports: desktop `1280 × 800`, narrow `320 × 800`, CSS pixels, device scale 1. Record these as versioned configuration. Do not implement text resizing using CSS zoom and call it a verified browser/text-resize test.

## axe adapter

- Pin the package/browser versions. Freeze an explicit rule-ID allowlist and check mapping in code before scoring fixtures.
- Start with form label/name rules for F01, `color-contrast` for C01, button/link-name rules for S01, image-alt rules for S02, and a documented supported ARIA-validity subset for S03. Verify IDs against the pinned release rather than guessing availability.
- Additional axe findings can be shown as advisory evidence; they do not silently expand the scored registry.
- Per check/state: any decisive mapped violation yields `failed`; otherwise unresolved mapped results yield `review`; otherwise applicable mapped passes yield `passed`; only conclusively inapplicable results yield `not_applicable`.
- If the engine did not run or the mapping is unsupported, use `not_tested`. An empty violations array alone does not establish a pass.
- Store raw rule IDs and affected nodes. Escape HTML excerpts in the interface.

## Keyboard evidence

1. Capture the source checkpoint, selected control identity, pointer action, and resulting state.
2. Restore an equivalent source state in an isolated probe context. Setup may use prior recorded actions, but the measured interaction begins from an explicit reset and uses keyboard input only.
3. Record every key and focused element. Probe recognized paths with Tab/Shift+Tab and appropriate activation/widget keys; default traversal budget is 40 key actions per target.
4. Compare observable state outcomes, not just screenshots or the agent's declaration of success. Anchor scrolling records before/after coordinates, the intended destination ID, its visibility and text. A scroll outcome passes only when keyboard/narrow operation reaches that same visible destination with matching content. Reset matching requires the same URL, heading, widget/dialog states and target tag/name/role/href/controls/tab index; unrelated clocks or rotating hero text do not invalidate that source. Non-scroll outcome uncertainty remains review.
5. Repeat a suspected failure from a reset state. Confirm only when DOM/event/state evidence supports the missing keyboard operation and recognized alternative paths have been considered. Public-site uncertainty remains `review`.

Repeated focus is not automatically a trap. A dialog may intentionally contain focus. Positive `tabindex` or a non-native element is not by itself proof that the selected task is impossible.

Focus indicators, suspected traps, heading quality, visible form-instruction quality, alt-text meaning, complex contrast backgrounds, and ambiguous clipping are review/advisory observations in v1. They cannot change numerical scores through AI judgment.

## Forms and reflow boundaries

Assess validation applicability using visible, enabled, editable fields in the selected state; hidden, read-only, disabled and button-only controls alone justify N/A, with the field inventory retained. A dialog opened later is a separate selected state. Active form testing requires a server-configured authorized origin and fixture/test recipe, including expected client-side behavior. A URL entered by a visitor does not grant that authorization. Public sites get static checks; applicable F02/F03 remain `not_tested` when active behavior is unknown. Verified absence of relevant form controls or verified inapplicability of a validation check may justify N/A. Absence of currently displayed errors and lack of authorization do not.

Use controlled invalid input that does not create real submissions. Inspect label/name, invalid state, error text, and recognized error relationships. Do not require one particular ARIA technique when another valid relationship exists.

Freeze up to 60 desktop text/control targets and relocate those same targets at narrow width rather than independently selecting the first 60 again. Accept a responsive content replacement only when its tag and normalized text match uniquely; preserve missing/hidden/changed-target reasons in observations and report wording. This is a bounded content sample, not full DOM equivalence. For reflow, combine narrow screenshots, scroll geometry, hit testing, control operation, and relevant layout metadata. Tables/maps and other justified two-dimensional content require exception handling. A blank screenshot, hidden responsive control, overflow measurement, or AI classification alone cannot confirm a reflow failure. A successful geometric probe alone cannot establish that all content is preserved; narrow the assertion or use `review`.

## Evidence contract

Every result records check/version, checkpoint, status, sample boundaries, reason, method/version, viewport, timestamp, and evidence IDs. A finding also contains target identity, expected/observed behavior, affected instances, WCAG reference, and reproduction steps.

Keep deterministic verification separate from estimated impact. AI probabilities are estimates, not measured auditor accuracy or human agreement. Confirmation requires assertion evidence or explicitly recorded human verification.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).
- [Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), and [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html).
- [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow and exceptions](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), and [distinct text-resizing requirement](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
