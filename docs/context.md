# Access Bench — Project Specification

> **Version:** 1.0 — Gator Hack '26, 48-hour MVP  
> **Status:** Build-ready product and engineering plan  
> **Stack:** Node.js, Express, vanilla HTML/CSS/JavaScript, Playwright, axe-core, Twinly Computer API, OpenAI Decisions API  
> **Working tagline:** **Don't just find accessibility issues. Show where a user gets stuck.**

---

## 1. Executive decision
a
**Build a small, accessible web application that audits a limited set of website states, attempts one real user task, identifies accessibility barriers, and provides evidence that a developer can reproduce and retest.**

AccessBench is **not** another generic axe-core wrapper, a WCAG certification service, a screen-reader simulator, or a general-purpose autonomous crawler. Its distinctive feature is **Goal-Based Barrier Replay**:

1. The auditor enters a URL and a simple goal (for example, “Find and open the contact form”).
2. Twinly's `computer/next-action` model guides an exploratory interaction in a browser **controlled and recorded by our Playwright code**.
3. Playwright runs five bounded accessibility test groups against the relevant page states.
4. OpenAI Decisions evaluates *ambiguous, evidence-backed findings* for likely user impact and review priority.
5. Our application presents **the observed failure, relevant visual and textual evidence, reproduction instructions, and a retest result**.

**The hackathon demo succeeds if:** a seeded defect prevents a keyboard-only task, Sheriff records why, and the identical test passes after that defect is fixed. Everything else supports that story.

### One-sentence pitch

**Screenshot Sheriff helps developers see the exact moments where a website becomes unusable—and check whether a fix actually removes the barrier.**

### Core user

A solo web developer, student team, or small product team that needs actionable accessibility feedback but does not have a dedicated accessibility testing specialist.

### Problem

Automated accessibility scans identify many rules-based violations, but developers often struggle to prioritize issues and understand their effect on actual workflows. A pass on automated checks also does not prove that a website is accessible. Sheriff connects **rule findings** to **an observable user task** and explains the limits of what has been tested.

### Nonnegotiable design principles

- **Evidence before AI judgment.** Never invent a finding because a model suggests one.
- **Task completion over cosmetic scoring.** A keyboard-blocked purchase matters more than a pretty dashboard number.
- **Accessibility of our own product.** The app must be usable with keyboard alone and expose all important information as text.
- **Honest test coverage.** “Not tested,” “needs review,” and “not applicable” are separate states, not passes.
- **Small, repeatable scope.** One reliable journey and five test groups are better than shallow scanning of fifty pages.
- **No irreversible third-party actions.** Exploration defaults to read-only; no purchase, deletion, production submission, or email send.

---

## 2. Product boundaries: what ships in 48 hours

### Must ship (P0)

1. Start a scan with a valid, permitted URL; optionally choose from a small set of predefined task goals.
2. Scan the landing page plus **up to two same-origin pages/states** discovered during exploration (maximum three page states total for MVP).
3. Run all **five accessibility test groups** on applicable states, clearly distinguishing pass/fail/needs review/not applicable/not tested.
4. Integrate `@axe-core/playwright` for deterministic rules-based findings.
5. Integrate **at least one live Twinly `POST /v1/computer/next-action` exploration**, with our backend executing and recording the permitted actions in Playwright.
6. Integrate **one live OpenAI Decisions evaluation** of a candidate finding, with graceful fallback if unavailable.
7. Show an audit overview with score, tested-state count, coverage, blockers, and an ordered list of findings.
8. Show one finding-detail page with screenshot, highlighted target when reliably located, text evidence, reproduction steps, and suggested remedy.
9. Retest the same site/state after a fix and show **before/after status for matching findings**.
10. Make Sheriff itself keyboard-operable, readable at narrow widths, and usable without color-only signals.
11. Provide a **seeded broken demo site** and a **corrected version** so the presentation is reproducible.

### Should ship if P0 is reliable (P1)

- Scan history persisted locally in JSON files.
- Download JSON report and print-friendly HTML report.
- Stream scan events to the UI via Server-Sent Events (SSE); fall back to polling.
- Filters for test group and severity.
- Short “Impact Mode” that groups findings by user goal rather than rule name.
- One-click copy of a Playwright reproduction snippet for deterministic findings.
- Show Twinly's recorded action trail beside a keyboard-only reproduction trail.

### Explicitly out of scope (P2 / post-hackathon)

- Full WCAG 2.2 conformance determination or certification.
- Accurate emulation of a screen reader, blindness, motor disability, or an individual's lived experience.
- Authenticated pages, CAPTCHA handling, payments, production form submissions, and login credentials.
- Crawling entire domains, scheduled monitoring, team accounts, cloud billing, GitHub PR generation.
- Automatically editing arbitrary production sites.
- Cross-browser/browser-assistive-technology matrix testing.
- Detailed legal compliance claims, ADA compliance guarantees, or guarantees that a site is fully usable.
- A React rewrite, custom design system, or complex charts.

### Definition of “working”

A demo with recorded/sample outputs alone **does not** satisfy completion. Live Playwright checks, a real Decisions request, and at least one actual Twinly computer-action call must be demonstrated. A seeded offline replay may exist as an explicitly labeled fallback, not disguised as a live integration.

---

## 3. The five accessibility tests

**Test unit:** a *page state*, defined by URL, viewport, and any relevant UI state (e.g., checkout open or error message visible). These are focused tests, **not five claims that cover all WCAG requirements**.

Each test group stores: `status` (`passed | failed | review | not_applicable | not_tested`), applicable assertions, positive evidence, failures, affected selectors, screenshot references, and relevant WCAG 2.2 criteria. Where a check cannot be conclusively automated, it is `review` rather than automatically failed or passed.

### Test 1 — Keyboard navigation and operation

**Question:** Can a user reach and operate the task's important controls without using a mouse?

**Checks** (local assertion weights shown in parentheses):

1. **Target reachability (5):** Starting at a known initial focus, can Tab/Shift+Tab reach the identified task control within a bounded traversal? Compare against the target selected in the pointer-guided task. A failed match may need review if the control has a legitimate alternate keyboard path.
2. **Keyboard activation (5):** For a reachable target, does Enter or Space activate it as appropriate, and does the expected non-destructive state change occur?
3. **No keyboard trap (4):** Can focus leave menus, dialogs, and controls via standard methods? Check a bounded forward/backward traversal; do not assume every repeated focus location proves a trap.
4. **Visible focus (2):** Capture focused-element screenshots and run an explicit focus-indicator probe where supported. Ambiguous visual evidence is marked for review.

**Tools:** Playwright `page.keyboard`, `document.activeElement`, element bounding boxes, screenshots; Twinly supplies the initial task path/target.  
**Evidence:** ordered focused-element sequence, target selector/accessible name, action attempted, before/after screenshot, expected versus observed state.  
**Example:** `Confirm` visually works by click, but a `<div onclick>` without keyboard semantics cannot be reached or activated.  
**Relevant WCAG:** 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.7 Focus Visible.

**Safety/accuracy:** Keyboard-only testing is **real keyboard input** through Playwright. Twinly itself is **not** claimed to represent a keyboard-only user. A navigation timeout alone is not proof of a WCAG violation; rerun and confirm before assigning “confirmed blocker.”

### Test 2 — Forms, labels, and error recovery

**Question:** Can a user understand what to enter and recover when something goes wrong?

**Checks:**

1. **Inputs have programmatic labels (3):** Evaluate supported form fields and their accessible names with axe-core and DOM inspection.
2. **Detected validation errors are described in text (4):** In the seeded demo environment, trigger deliberately invalid test data and check for a meaningful textual error identifying the field.
3. **Error-to-field relationship (3):** Where applicable, inspect whether the error is associated with the affected field via accessible descriptions/relationships and whether the user can identify what needs correction.

**Tools:** axe-core, Playwright DOM inspection and controlled demo-form interaction.  
**Evidence:** label/description metadata, invalid-state screenshot, exact error text, affected field.  
**Example:** “Something went wrong” appears without indicating which input failed.  
**Relevant WCAG:** 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion.

**Safety/accuracy:** **Never automatically submit real external forms.** Active invalid-form tests are restricted to our sandbox demo site or an explicitly configured authorized staging domain. On other sites, perform non-submitting static checks; record active error behavior as `not_tested`. If no forms exist, the group is `not_applicable`, not `passed`.

### Test 3 — Text color contrast

**Question:** Is ordinary visible text sufficiently distinguishable from its background in supported cases?

**Checks:**

1. **Text contrast (4):** Run axe-core contrast rules. Use the WCAG 2.2 AA reference thresholds of **4.5:1** for ordinary text and **3:1** for large text, accounting for documented exceptions.
2. **Uncertain contrast cases (review only):** Images, gradients, transparency, unusual overlays, or complex backgrounds may be indeterminate. Preserve as manual review instead of guessing based on screenshot appearance.

**Tools:** axe-core contrast evaluation, relevant computed styles and screenshot location.  
**Evidence:** foreground/background measurements when supplied by the testing engine, affected text, element selector, screenshot.  
**Example:** low-contrast instructional text in a sign-up form.  
**Relevant WCAG:** 1.4.3 Contrast (Minimum). Non-text contrast (1.4.11) can be listed as **manual review**, but is **not fully automated or scored** in this MVP.

**Safety/accuracy:** Never claim every visible color combination was tested. Avoid inventing a contrast ratio if the engine could not calculate one.

### Test 4 — Accessible names and semantic structure

**Question:** Does the page communicate the purpose and structure of its controls to assistive technology?

**Checks:**

1. **Actionable controls have accessible names (4):** Buttons, links, icon controls, and form controls have supported roles and informative names.
2. **Informative images have appropriate text alternatives (3):** Identify missing alternatives where programmatically determinable; whether supplied alt text is *good* may require human review.
3. **Role/state/relationship validity (3):** Run supported axe-core checks for invalid ARIA, broken relationships, and structural semantics.

**Tools:** axe-core and DOM/accessibility metadata.  
**Evidence:** element HTML excerpt (escaped in the dashboard), accessible role/name, rule ID, relevant screenshot.  
**Example:** an icon-only search button has no accessible name.  
**Relevant WCAG:** 1.1.1 Non-text Content, 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value.

**Accuracy:** “Unusual heading order” may be an advisory note; it is not automatically scored as a WCAG failure without a defensible criterion and evidence. A missing image `alt` attribute is detectable; the appropriateness of a nonempty `alt` value often is not.

### Test 5 — Narrow-screen reflow and content visibility

**Question:** Does the important page content remain usable in a constrained-width view?

**Checks:**

1. **Reflow at 320 CSS-pixel width (4):** In a standard vertical-scrolling layout, flag unexpected page-level horizontal overflow. Recognize that some genuinely two-dimensional content is exempt and may require review.
2. **Important controls remain visible and operable (4):** Check whether task-relevant controls are clipped, obscured by fixed elements, or no longer reachable in the viewport.
3. **Readability/overlap probe (3):** Detect demonstrable overlap or truncation where layout geometry permits; mark ambiguous findings for manual review.

**Tools:** Playwright viewport `320 × 800` CSS pixels, scroll width checks, bounding boxes, computed styles, screenshot comparisons.  
**Evidence:** desktop and narrow screenshots, overflow measurement, affected element bounding boxes, selected control state.  
**Example:** at 320 px, the “Submit” button is obscured by a fixed footer.  
**Relevant WCAG:** 1.4.10 Reflow. The distinct **200% text resize criterion (1.4.4)** is *not* considered comprehensively tested by simply shrinking a viewport; browser zoom/text scaling can be added later.

**Safety/accuracy:** A page's `scrollWidth > clientWidth` is a **lead, not automatic proof** of an accessibility violation. Investigate the element, layout context, and two-dimensional-content exceptions.

### Unified test-status rules

| Status | Meaning | Affects numerical score? |
|---|---|---|
| `passed` | A specified applicable assertion was conclusively exercised and met | Yes, positive |
| `failed` | A specified applicable assertion was conclusively exercised and not met | Yes, negative |
| `review` | Suspicious or ambiguous; needs a person or more instrumentation | No; reduces determinacy/coverage |
| `not_applicable` | The assertion genuinely does not apply (e.g., no form) | Excluded from denominator; disclosed |
| `not_tested` | Applicable, but execution skipped, blocked, or timed out | No; reduces determinacy/coverage |

**Important:** axe-core reports `violations`, `passes`, `incomplete`, and `inapplicable`; map these responsibly. One axe `violation` may contain multiple affected nodes. Preserve individual instances without counting duplicate rules repeatedly in the score.

---

## 4. The innovation: Goal-Based Barrier Replay

### Why it is different from an axe-only scanner

An axe-only scan can say: “button-name: element has no accessible name.” Sheriff tries to show **why a meaningful user journey breaks** and whether the exact failure disappears after a fix.

### Minimum viable interaction loop

```text
User: “Find and open the contact form”
           |
           v
Playwright opens permitted page, captures screenshot + visible controls
           |
           v
Twinly /computer/next-action chooses next exploratory action
           |
           v
Our guard validates and executes safe action in Playwright
           |
           v
Our recorder stores action, screenshot, URL, DOM target, result
           |
           v
Repeat (at most 12 actions), or stop on done / fail / timeout
           |
           v
Keyboard-only probe attempts same task-relevant target/state
           |
           v
Deterministic checks + axe-core + Decisions triage
           |
           v
Evidence-led issue report and before/after retest
```

### Twinly implementation details

Use the **cloud** `POST /v1/computer/next-action` endpoint, not the Mac `POST /v1/tasks` endpoint, for the primary scan. Official docs state that the computer endpoint **suggests a single next action but does not click the user's computer**; our code owns screenshots and execution. This is ideal for test reproducibility.

- Request: `goal`, JPEG or PNG `screenshot` (max 4 MB), optional `previous_screenshot`, prior `steps`, and visible `elements` with roles/names/positions in Twinly's 0–1000 coordinate space.
- Response: one action (`click`, `key`, `type`, `scroll`, `wait`, `done`, or `fail`, etc.), plus `reason` and `commits`.
- Convert normalized coordinates to Playwright viewport coordinates; store both, plus any matched DOM target.
- Use the returned `commits` flag as a **minimum** safety signal; independently veto unsafe actions even if `commits` is false or missing.
- Max 12 actions, max 90 seconds per demo journey, same-origin navigation only, and no unapproved submissions.
- On unsupported or inconsistent actions, stop with `needs_review`; do not silently fabricate successful navigation.
- Supply the model only allowed goals and site content as *data*, not trusted instructions from the audited page.

**Contingency:** If Twinly fails or exceeds budget, core rules-based scans still complete. Display “Agent journey unavailable” and **do not claim the live agent test passed**. For an on-stage backup, use a separately labeled prerecorded trace.

### Keyboard replay strategy, realistically scoped

Do **not** promise arbitrary cross-site semantic replay in 48 hours. Instead:

1. Identify one task-relevant target (prefer an element with a stable role/name; otherwise locate by DOM element at the Twinly click coordinates).
2. Start in a fresh browser context at the same approved page/state.
3. Traverse via keyboard only, collecting `document.activeElement` and focus screenshots up to an explicit safety limit.
4. Determine whether the target can be focused and activated; if so, compare the resulting state against the expected safe state.
5. Re-run a suspected failure once; label a true task blocker only if evidence consistently supports it.
6. If state reconstruction or element identity is ambiguous, classify the outcome as `review` rather than `failed`.

In the controlled demo site, this path should be fully reproducible. On arbitrary public websites, it is deliberately best-effort.

### Finding severity versus verification status

Treat these as **different properties**:

- **Verification:** `confirmed`, `suspected`, `needs_review`, `resolved_after_retest`.
- **Impact:** `critical`, `high`, `moderate`, `low`.

A model's high confidence does **not** turn a suspected violation into a confirmed one. Confirmation comes from deterministic evidence or explicit human verification.

---

## 5. Accessibility benchmark score — exact rules

### What the score measures

The headline is the **Sheriff Tested Accessibility Score (0–100)** for **the limited audited states and supported checks**. It is a product-defined benchmark, **not** a WCAG conformance percentage or a probability that a site is accessible.

We must show the score next to its **test coverage**, page-state count, audit date, and any confirmed task blockers. The score is primarily for **before/after comparisons on the same scenarios and test versions**, not for definitive ranking of unrelated websites.

### Test-group weights

| Test group | Site-score weight |
|---|---:|
| 1. Keyboard navigation | **30%** |
| 2. Forms and errors | **20%** |
| 3. Contrast | **15%** |
| 4. Names and semantics | **20%** |
| 5. Reflow and visibility | **15%** |
| **Total** | **100%** |

**Why these weights?** Keyboard barriers and forms can prevent core tasks. Semantics affect interaction with assistive technology. Contrast and reflow matter substantially, but the audit's primary value is task usability. **These are product choices, not weights prescribed by WCAG**, and should be revised after validation with accessibility specialists.

### Per-group scoring

For each page state and applicable assertion, assign the **fixed local assertion weight** listed in Section 3. Count an assertion once per state, even if it finds several instances; keep instances in the report.

- `passed` earns its full local weight.
- `failed` earns zero.
- `review` and `not_tested` earn neither points nor an automatic fail; they are removed from the **determinate denominator** but remain in coverage.
- `not_applicable` is excluded from both scoring and coverage denominators.

For category **c**:

```text
category_score_c = 100 × (Σ local_weight of PASS assertions)
                             / (Σ local_weight of PASS or FAIL assertions)
```

If a group has no conclusive applicable assertions, its category score is **unavailable**, not 100.

### Site score calculation

For groups with a category score:

```text
raw_score = Σ(category_weight_c × category_score_c)
            / Σ(category_weight_c for scored groups)

reported_score = round(raw_score)
```

The denominator renormalizes away **truly not-applicable** groups (for example, form testing on a site with no forms). If a normally applicable group was skipped or is unresolved, the score can only be called **provisional**; the missing evidence remains visible.

### Confirmed critical-blocker rule

If a **critical task-blocking accessibility defect is confirmed twice** with the same test method and a successful pointer baseline, cap the displayed score at **59/100**:

```text
if confirmed_critical_blocker:
    reported_score = min(round(raw_score), 59)
```

A “critical blocker” means the selected essential task **cannot be completed through the tested accessible interaction path** and no viable alternative was found in the bounded test. Never apply the cap based on an LLM prediction alone. Display the raw score alongside the capped score and explain the cap.

This prevents a large number of minor passes from masking a verified unusable primary journey.

### Coverage and score eligibility

```text
coverage = (Σ local assertion weights conclusively PASS or FAIL)
           / (Σ local assertion weights of all applicable planned assertions)
           × 100
```

- `review` and `not_tested` lower coverage.
- `not_applicable` does not lower coverage.
- A score is labeled **“Provisional”** if coverage is below **80%**, if an applicable category lacks conclusive evidence, or if active task replay was incomplete.
- If coverage is below **50%**, or **fewer than three test groups** have conclusive evidence, show **“Insufficient evidence — no overall score”**. Display category results, however.
- Do **not** award a perfect score because no violations were found if relevant tests didn't run.
- Report `audited_states / planned_states`, and only compare two numeric scores if scenario configuration and test version match.

Coverage is a measure of **our planned test execution**, not “80% of WCAG was tested.”

### Worked scoring example (illustrative)

| Group | Score | Weight | Contribution |
|---|---:|---:|---:|
| Keyboard | 60 | 0.30 | 18.0 |
| Forms | 80 | 0.20 | 16.0 |
| Contrast | 50 | 0.15 | 7.5 |
| Semantics | 75 | 0.20 | 15.0 |
| Reflow | 100 | 0.15 | 15.0 |
| **Raw site score** |  |  | **71.5 → 72** |

If the scan also **confirmed a critical keyboard blocker twice**, the displayed score becomes **59** (capped; raw **72**). If the evidence is merely suspicious, the score remains **72 provisional**, and the finding is flagged for review instead of invoking the cap.

### Severity and issue ordering

Do not calculate score by simply subtracting 10 points per issue. That rewards huge pages differently and double-counts repeated elements.

Order findings using a deterministic priority tuple:

1. Confirmed task blocker before non-blocker.
2. Confirmed finding before suspected finding.
3. Impact band: critical > high > moderate > low.
4. Number of affected tested states (descending).
5. Stable rule/element identifier.

**Decisions helps assess impact where ambiguous**, but **cannot directly increase/decrease the benchmark score**. Hard assertions and their weights do that.

### Score UI wording

Good: **“59/100 — Tested Accessibility Score · 84% test coverage · 3 page states · 1 confirmed blocker.”**  
Avoid: **“59% accessible,” “WCAG score 59,” “WCAG AA passed,” “screen-reader compatible.”**

---

## 6. OpenAI Decisions API integration

### Role

Decisions is an **evidence triage and prioritization service**, not our accessibility rule engine and not a generative report writer. Use it only after deterministic checks have produced candidate findings, element metadata, and context.

Official API: `POST https://api.openai.com/v1/decisions` with `model: "gpt-6-luna"`. It supports `predicate`, `choice`, and `score` questions, and up to 400 questions per call. Avoid large, expensive image payloads when structured text evidence is sufficient.

### Concrete usage for each candidate finding

Shared `input` includes rule ID, task goal, visible element text, observed actions, expected/actual states, selector, and—only where it adds value—a screenshot crop. Ask:

1. **Predicate** `likely_user_barrier`: “Does the supplied *observed evidence*, rather than speculation, support a meaningful user barrier?”
2. **Choice** `primary_impact`: choose from `keyboard`, `form`, `contrast`, `semantics`, `reflow`, `unclear`.
3. **Score** `impact_level`: ordered levels `low`, `moderate`, `high`, `critical`, with behavioral definitions (cosmetic/advisory, friction, significant impediment, no available tested path to essential task).
4. **Predicate** `needs_manual_review`: “Is the evidence ambiguous enough to require a human reviewer?”

Example *shape* (simplified; see current docs before implementation):

```js
const decision = await openai.decisions.create({
  model: "gpt-6-luna",
  input: JSON.stringify({
    goal: "Open the contact form",
    rule: "keyboard-target-unreachable",
    expected: "Contact form can be opened using keyboard",
    observed: "Target never received focus in 30 Tab presses; pointer click opened form",
    evidence: { selector: "#contact-launcher", attempts: 2 }
  }),
  questions: [
    {
      type: "predicate",
      name: "likely_user_barrier",
      instructions: "Does the OBSERVED evidence support a meaningful user barrier?"
    },
    {
      type: "choice",
      name: "primary_impact",
      instructions: "Which single test category best fits the finding?",
      choices: [
        { value: "keyboard", description: "Keyboard reachability or operation" },
        { value: "form", description: "Field labels, instructions or errors" },
        { value: "contrast", description: "Text visibility or contrast" },
        { value: "semantics", description: "Names, roles and accessible relationships" },
        { value: "reflow", description: "Layout reflow or obscured controls" },
        { value: "unclear", description: "Insufficient evidence to categorize" }
      ]
    },
    {
      type: "score",
      name: "impact_level",
      instructions: "Rate likely impact on the stated task using observed evidence.",
      levels: [
        { label: "Low", description: "Minor or advisory impact" },
        { label: "Moderate", description: "Adds friction but task remains workable" },
        { label: "High", description: "Severely impedes task; workaround may exist" },
        { label: "Critical", description: "Essential task blocked on tested path" }
      ]
    }
  ]
});
```

### Guardrails

- A model `predicate` probability is an **estimate**, not a calibrated fact. Do not set a final confidence threshold without labeled examples.
- Choice/score confidence is not proof of WCAG failure; a `score` can be a **probability-weighted average of level indices**, not necessarily an integer.
- Never allow Decisions to overwrite deterministic `passed`/`failed` results.
- With insufficient evidence, show “Needs review”; if the API fails, fall back to rule-based priority.
- For hackathon reliability: **one batched Decisions call per completed scan** or per small group of unique findings, not one call per DOM element.
- Store the decision type, outputs, model version, and which evidence the assessment was based on.
- Suggested fix text for the MVP comes from a **curated rule-to-remedy mapping**. Decisions is not a free-text explanation generator. A separate LLM can be added later, but is not required.

---

## 7. UI/UX: minimal, calm, accessible

**Technical decision:** Node.js + Express serves ordinary HTML pages, with vanilla ES modules for small enhancements. Use real links and full page navigation instead of a client-side SPA/router.

### Visual language

- Background: near-white; text: near-black; one restrained blue or teal accent.
- Default font: system sans-serif at 16px or larger; comfortably spaced line height (about 1.5).
- Single content column capped near 960px. Finding details use two columns only on larger screens; stack on mobile.
- No animation-based score gauges, excessive cards, gradients, decorative graphs, or visual noise.
- Use a plain text score, count summaries, subtle dividers, and obvious primary actions.
- Errors and risk are conveyed by **icon/label/text**, never color alone.
- Screenshot overlays complement textual descriptions; all issues remain understandable without images.

### Information architecture (four pages)

#### Page A — Home / New Audit (`/`)

**One purpose:** start an audit.

```text
Screenshot Sheriff                         [History]

Find the accessibility barriers that block real tasks.

Website URL
[ https://example.com                             ]

Goal (optional; choose one)
(•) Find and open the contact form
( ) Find a primary call-to-action
( ) Scan this page only

[ Start accessibility audit ]

Five checks: Keyboard · Forms · Contrast · Semantics · Reflow
Read what our audit can and cannot verify.
```

- One clear `<h1>`, one labeled URL input with example/validation help.
- Accessible radios for goal templates; don't require freeform user prompt design.
- One submit button; prevent repeated submissions while pending.
- A short notice: “Only scan websites you own or have permission to test. Do not enter credentials.”

#### Page B — Results (`/audit/:id`)

**One purpose:** understand the outcome and prioritize next steps.

```text
Screenshot Sheriff > Audit results

example.com                                [Retest] [Print]

59 / 100   Tested accessibility score
84% check coverage · 3 page states · 1 confirmed blocker
Not a WCAG compliance certificate

[Keyboard: Failed] [Forms: Passed] [Contrast: Review]
[Semantics: Failed] [Reflow: Passed]

Findings (4)                   Filter: [All categories v]
1. CRITICAL — Contact button not keyboard-reachable
2. HIGH     — Search control has no accessible name
3. MODERATE — Text contrast below supported threshold
4. REVIEW   — Small-screen overflow may be intentional
```

- The five tests use a **semantic `<ul>` or a simple table**, not clickable decorative gauges.
- Group status and percentage are distinct: a group may have failures yet retain partial points.
- Progress appears as concise status text (`Preparing browser`, `Running checks`, `Evaluating findings`, `Complete`) announced in one `aria-live="polite"` region, with updates throttled to meaningful milestones.
- `Retest` always creates a **new audit**, preserving old evidence.

#### Page C — Issue detail (`/audit/:id/issues/:issueId`)

**One purpose:** reproduce and fix one issue.

```text
← Back to audit

Critical · Confirmed by repeatable test
Contact button is not reachable with Tab
Affected page: /contact
Related criterion: WCAG 2.1.1

What we observed
Pointer activation opened the form; repeated keyboard traversal
never focused the same control.

[Screenshot with element highlighted]  (optional)

Steps to reproduce
1. Load /contact and place focus at start of document.
2. Press Tab through the recorded focus sequence.
3. Observe that the Contact control is skipped.
4. Click it with a pointer; form opens.

Suggested fix
Use a native <button> with a label and keyboard behavior.

Verification
[Retest this audit]     [Copy steps]
```

- Show escaped DOM snippets in `<code>` (never render target HTML as markup).
- Screenshot always has alt text/caption; any highlighted coordinates have equivalent text and a target selector.
- Textual reproduction steps are primary. Video recording is optional, not required.
- The “confirmed” badge depends on evidence status, not Decisions confidence.

#### Page D — Audit history (`/history`)

**One purpose:** see previous scans and compare compatible runs.

- Plain accessible table: audited domain, created time, tested states, score status, blockers, link.
- Two saved scans of the **same URL, goal, viewport, and test-plan version** can display a before/after comparison.
- Without compatible settings, show both reports independently; don't claim improvement from incomparable scans.

### UI accessibility checklist (must pass for our own app)

- Semantic `<header>`, `<nav>`, `<main>`, `<footer>` and consistent heading hierarchy.
- Visible “Skip to main content” link.
- Native `<button>`, `<a>`, `<label>`, `<input>`, `<fieldset>`, `<legend>`, `<table>` where appropriate.
- Full keyboard navigation; meaningful and visibly styled `:focus-visible` indicators.
- Form errors in text, programmatically associated (`aria-describedby`, etc.).
- No keyboard traps in screenshot viewer or filters; no custom modal required for MVP.
- Dynamic status announced politely and sparingly; no focus stolen when scan progress updates.
- Text and controls remain readable at narrow viewport; honor `prefers-reduced-motion`.
- No auto-advancing carousels or charts that rely on color to communicate data.
- Test **our application itself** with axe-core, keyboard traversal, and the Sheriff scanning pipeline.

---

## 8. Backend architecture and components

```text
Browser (HTML + CSS + vanilla JS)
   |   POST scan / GET report / SSE progress
   v
Node.js + Express API
   |
   +-- Scan Coordinator (limits, status, state snapshots)
   |
   +-- Playwright Runner (isolated Chromium context)
   |      +-- axe-core checks
   |      +-- keyboard, form, focus, reflow probes
   |      +-- screenshots, target metadata, focus trace
   |      +-- constrained execution of Twinly's proposed actions
   |
   +-- Twinly Adapter (/v1/computer/next-action)
   |
   +-- Decisions Adapter (/v1/decisions)
   |
   +-- Findings Engine (deduplicate, classify, evidence, compare)
   |
   +-- Scoring Engine (pure deterministic function)
   |
   +-- Local Audit Store (JSON + screenshots + trace)
```

### Division of responsibilities

| Component | Owns | Does **not** own |
|---|---|---|
| Twinly | Suggests navigation actions from screenshots and goal | Keyboard disability simulation; final scores; direct control of our browser |
| Playwright + axe-core | Actual browser execution and measurable rule checks | Free-form user impact judgments |
| OpenAI Decisions | Evidence-based categorization / impact triage | WCAG certification; hard pass/fail; report prose |
| Our application | Safety, state, assertions, score, replay, comparisons, UI | Making unverified promises about accessibility |

### Express routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | New audit form |
| `GET` | `/history` | Audit history |
| `GET` | `/audit/:id` | Results page |
| `GET` | `/audit/:id/issues/:issueId` | Finding page |
| `POST` | `/api/audits` | Create a scan with URL and goal template |
| `GET` | `/api/audits/:id` | Complete status/report JSON |
| `GET` | `/api/audits/:id/events` | SSE progress events |
| `POST` | `/api/audits/:id/retest` | New compatible run |
| `GET` | `/api/audits/:id/export` | JSON export |
| `GET` | `/assets/audits/:id/:file` | Serve sanitized, permitted evidence assets |

Keep API keys on the server. Do not expose raw target HTML in the frontend or execute it in our app's origin.

### File structure

```text
screenshot-sheriff/
├── package.json
├── .env.example
├── README.md
├── project.md
├── server.js
├── src/
│   ├── scanCoordinator.js
│   ├── urlGuard.js
│   ├── playwrightRunner.js
│   ├── twinlyAdapter.js
│   ├── safeActionExecutor.js
│   ├── tests/
│   │   ├── keyboard.js
│   │   ├── forms.js
│   │   ├── contrast.js
│   │   ├── semantics.js
│   │   └── reflow.js
│   ├── decisionsAdapter.js
│   ├── findingsEngine.js
│   ├── scoring.js
│   ├── reportStore.js
│   └── compareReports.js
├── views/
│   ├── home.html
│   ├── audit.html
│   ├── issue.html
│   └── history.html
├── public/
│   ├── styles.css
│   └── js/
│       ├── newAudit.js
│       ├── results.js
│       └── issue.js
├── data/audits/                  # gitignored
├── demo-site/
│   ├── broken/                   # instrumented intentional defects
│   └── fixed/                    # same pages, repaired markup
└── tests/
    ├── scoring.test.js
    ├── audit-fixtures.test.js
    └── app-accessibility.test.js
```

### Data model (minimal JSON)

```json
{
  "auditId": "uuid",
  "createdAt": "2026-10-23T20:00:00Z",
  "url": "https://demo.example/contact",
  "goalId": "open_contact_form",
  "testPlanVersion": "1.0",
  "status": "complete",
  "auditedStates": [{"id": "state-1", "url": "/contact", "viewport": "1280x800"}],
  "testGroups": {
    "keyboard": {"status": "failed", "score": 60, "coverage": 100},
    "forms": {"status": "passed", "score": 100, "coverage": 100},
    "contrast": {"status": "review", "score": null, "coverage": 50},
    "semantics": {"status": "failed", "score": 75, "coverage": 100},
    "reflow": {"status": "passed", "score": 100, "coverage": 100}
  },
  "summary": {
    "rawScore": 80,
    "reportedScore": 59,
    "scoreLabel": "Provisional",
    "coveragePercent": 78,
    "confirmedCriticalBlockers": 1
  },
  "findings": [
    {
      "id": "finding-1",
      "testGroup": "keyboard",
      "ruleId": "keyboard-target-unreachable",
      "wcag": ["2.1.1"],
      "selector": "#contact-launcher",
      "stateId": "state-1",
      "verification": "confirmed",
      "impact": "critical",
      "description": "Contact action was not keyboard-reachable in two repeat trials.",
      "evidence": {"screenshot": "state-1-contact.jpg", "focusTrace": "focus-1.json"},
      "suggestedFixId": "native-button"
    }
  ]
}
```

**Implementation note:** With the listed available group scores, the renormalized raw score is 80 before the critical-blocker cap. The 78% coverage is an illustrative separate execution metric. Actual values must be calculated by `scoring.js`, never hand-entered. Store a separate record for each check outcome; the view above is an abbreviated shape.

### Data persistence

For the hackathon use local JSON files and image files, with unique filenames, atomic writes, a maximum audit count, and a simple local cleanup policy. A database is unnecessary for a single-machine demo. Never commit audit artifacts or secrets to Git.

---

## 9. Execution sequence and failure handling

### Lifecycle

```text
created → validating → scanning_static → exploring_with_twinly
        → testing_keyboard_and_reflow → triaging_with_decisions
        → scoring → complete
```

An individual phase can be `skipped`, `review`, or `failed`. A failed Twinly or Decisions phase **does not invalidate deterministic evidence** from Playwright.

### Scan request handling

1. Validate URL and require user confirmation of authorization.
2. Create a new audit ID; mark `created`.
3. Open a fresh isolated Chromium context with a fixed viewport and default nonauthenticated profile.
4. Run axe-core on the starting state; capture page metadata and screenshot.
5. If a supported goal was chosen, perform capped Twinly-guided exploration, recording every safe step and observed result.
6. Run keyboard and controlled form tests on supported states; run reflow at 320 CSS px; collect semantic and contrast results.
7. Normalize/deduplicate findings by `{testGroup, ruleId, canonical selector, state}`. Preserve multiple affected elements as child instances.
8. Submit a **small, bounded set of evidence-backed candidates** to Decisions for triage.
9. Compute deterministic benchmark score, coverage, and blocker cap.
10. Persist report and show results with all unavailable/limited phases disclosed.

### Errors and UX copy

| Problem | UI outcome |
|---|---|
| URL invalid or blocked by network guard | “We can't scan that address. Use an authorized public HTTP(S) site.” |
| Page times out | “Page did not finish loading. Partial checks may be available.” |
| Unsupported login/CAPTCHA | “This workflow needs authentication or a human step; not tested.” |
| Twinly unavailable | “Automated task exploration unavailable. Rule-based checks are still shown.” |
| Decisions unavailable | “AI prioritization unavailable. Showing rule-based findings.” |
| Could not reproduce | “Potential issue — manual review needed,” never “confirmed.” |
| Browser crashes | Mark remaining assertions not tested and save partial evidence |
| Scan canceled | Persist `canceled` and all previously collected evidence; no bogus score |

---

## 10. Security, consent, and privacy

A public URL scanner is a powerful network client. **Do not ship arbitrary unauthenticated server-side browsing to the public internet without SSRF and abuse protection.**

### Minimum MVP protections

- Show explicit permission requirement: scan only owned or authorized websites.
- Accept `http:`/`https:` only. Reject `file:`, `data:`, `javascript:`, `ftp:`, loopback, link-local, private IP ranges, internal hostnames, and local network targets **for public scans**.
- Validate DNS results before navigation; revalidate on redirects and on important subrequests; mitigate DNS rebinding. Do not rely on a single string check.
- **Developer-only exception:** explicit allowlist for `localhost` demo fixtures; never expose that exception to arbitrary hosted users.
- Limit to same-origin page navigation, maximum three states, request/action/time budgets, and one active scan per process in demo mode.
- Intercept any `commits: true` Twinly action and block until appropriate human approval; separately block form submissions, uploads, delete actions, payment/checkout, messages, and account changes even when `commits` is false.
- Prefer read-only tasks and disposable demo data. Disable downloads and arbitrary external script execution in our own report UI.
- Isolate browser contexts with no shared cookies, credentials, extensions, or personal storage. Apply resource caps/timeouts.
- Treat page content and Twinly action text as untrusted. Do not let a malicious page redefine scan permissions or instruction hierarchy.
- Keep API tokens in `.env`; do not log or expose them to frontend code.
- Store only needed evidence; redact or avoid collecting form contents, query parameters with tokens, session IDs, and personal information.
- Escape all external text/HTML before rendering. Apply restrictive CSP and safe static asset routes.
- Keep local artifacts for a short demo retention period (e.g., 24 hours) with manual delete; communicate this to the user.

**Production note:** the security requirements above are a checklist and must be validated, not treated as solved by listing them. If secure arbitrary-site scanning cannot be completed in 48 hours, **restrict the MVP to explicitly approved domains** including the demo fixture.

---

## 11. Benchmarks and validation (separate from the site score)

### A. Product-quality benchmark — prove Sheriff works

Maintain a test fixture with **five seeded, known defects**, one per test group, and a corrected version with identical workflows:

| Fixture defect | Expected reproducible evidence | Fixed variant |
|---|---|---|
| Keyboard-inaccessible custom button | Keyboard path cannot activate; pointer baseline can | Native `<button>` with visible focus |
| Unlabeled input / unhelpful error | Form rule fails; error evidence where safe | Explicit label and useful field-linked error |
| Low-contrast instruction text | Supported axe color-contrast finding | Colors meet relevant threshold |
| Icon button missing accessible name | axe name/role failure | Descriptive accessible name |
| Narrow-screen fixed footer hides control | Viewport 320 px shows control obscured | Responsive layout keeps it reachable |

**Metrics recorded on test fixtures:**

- **Defect recall** = seeded defects correctly identified / total seeded defects.
- **Finding precision** = verified correct findings / all findings labeled confirmed (human-checked fixture labels).
- **Reproduction rate** = confirmed task failures reproducible on rerun / confirmed task failures attempted.
- **Fix-verification rate** = previously failing checks that pass on fixed fixture / repaired checks expected to pass.
- **Median scan time** and **Decisions/Twinly API call counts**.

**Demo objective, not claimed result:** correctly identify at least 4 of 5 seeded defects, reproduce the keyboard blocker, and show that blocker resolved on the fixed site. Report actual results, including misses and false positives.

### B. Frontend speed claim — vanilla JS versus React (optional)

Our reason for vanilla JS is **simplicity and maintainability in 48 hours**, not an assumed universal speed advantage. If we want to state “X% faster than React,” benchmark equivalent versions of **the same page**, same content and features, under matching conditions.

**Protocol:**

1. Build minimal functionally equivalent results pages in vanilla JS and React; use the same fonts/assets and backend data.
2. Test production builds on the same machine/browser, fixed viewport/network/CPU settings, warm/cold conditions separately.
3. Collect at least 5 comparable runs per page; report **medians**.
4. Measure **Largest Contentful Paint (LCP)**, **Total Blocking Time (TBT)**, and transferred JavaScript bytes; optionally use Lighthouse for repeatability.
5. Calculate percentage improvement **for a specifically named metric**:

```text
LCP_reduction_percent = ((React_LCP_ms - Vanilla_LCP_ms)
                         / React_LCP_ms) × 100
```

6. If React is faster or the difference is within measurement noise, say so. Never fabricate a percent.

**Acceptable pitch:** “On our equivalent results page, vanilla JS reduced median LCP by X% under our test conditions.”  
**Unacceptable pitch:** “Vanilla JS is X% faster than React” or “Vanilla JS is accessible by default.”

### C. Auditing ourselves

Run Sheriff's five supported checks against the Sheriff's own public pages. Add a footer link to a self-audit report **only when it actually exists**. Publish detected issues and incomplete tests rather than pretending to have a perfect score.

---

## 12. Demo script (90–120 seconds)

**0–15 seconds — The problem.** “A scanner can find missing labels. But what if the main task itself is impossible with a keyboard?” Open the deliberately broken demo site.

**15–35 seconds — Live exploration.** Enter the demo URL into Sheriff. Choose “Open the contact form.” Show Playwright screenshot, Twinly-chosen exploratory actions, and the status text changing as evidence is collected.

**35–55 seconds — The result.** Display the score and five test-group statuses. Select the critical keyboard finding. Show that pointer activation succeeded but keyboard traversal/activation did not, including the recorded focus sequence and screenshot.

**55–80 seconds — Show the fix.** Switch to the preprepared corrected version of the **same demo**, emphasizing the semantic HTML change, not a magical AI code fix.

**80–105 seconds — Retest.** Run the same scenario and show the keyboard assertion pass and corresponding finding resolved. Show the comparable before/after record and updated score/coverage.

**105–120 seconds — Impact.** “We do not certify accessibility. We make failures reproducible and fixes verifiable so developers can remove real barriers.”

**Backup:** Store a clearly labeled prerecorded action trace for presentation reliability; do not present it as a live Twinly call. Have a separate static report ready only if APIs or network are down.

---

## 13. 48-hour execution plan

Assumption: a small hackathon team working in parallel. Time blocks are **elapsed time**, not individual person-hours. Establish API access before the event if permitted.

| Window | Main work | Exit gate |
|---|---|---|
| 0–4 h | Initialize Node/Express + vanilla pages; `.env`; demo broken/fixed fixture | Home loads and launch form validates |
| 4–10 h | Playwright baseline and axe-core; screenshots; scan storage | Two seeded rule violations appear with evidence |
| 10–16 h | Keyboard task probe and reflow probe | Broken keyboard control fails, fixed passes |
| 16–22 h | Integrate Twinly `/computer/next-action` with action guard/trace | Live safe click/step recorded from real API |
| 22–28 h | Decisions triage; scoring and coverage logic with unit tests | Real response stored; score deterministic offline |
| 28–35 h | Results and issue-detail UI; focus trace and textual replay | User can navigate end-to-end by keyboard |
| 35–40 h | Retest comparison and history; complete five test groups | All groups run or honestly display skipped status |
| 40–44 h | Self-audit, security review, regression tests | No critical defects in Sheriff's core journey |
| 44–48 h | Performance measurements if time, rehearsal, contingency assets | Live demo succeeds twice in a row |

### Priority cuts when behind

1. Cut print/export.
2. Cut audit history (retain two known reports for before/after).
3. Cut filters and Impact Mode.
4. Cut multiple goal templates (keep one).
5. Keep **five test groups, live Twinly, live Decisions, the score with coverage, one failure replay, and a fix/retest**. Those are the core product.

If even P0 cannot be completed, show the feature as incomplete; never represent simulated results as real tests.

---

## 14. Verification and acceptance criteria

### Product acceptance

- [ ] User can enter an authorized site URL and select one supported goal.
- [ ] Scan provides meaningful progress, completes, or exits with an honest partial result.
- [ ] Five test-group sections are visible with correct pass/fail/review/N/A/not-tested distinctions.
- [ ] At least one seeded defect in each group produces expected evidence where testable.
- [ ] At least one real Twinly next-action is applied through **our Playwright executor** and recorded; unsafe action is blocked.
- [ ] At least one real Decisions call returns a named predicate/choice/score used for triage without overriding hard rule results.
- [ ] Results include exact scenario, viewport, tested states, and test-plan version.
- [ ] Score computation has unit tests for all-pass, blocker-cap, missing form, incomplete scan, no evidence, and same-scenario retest.
- [ ] A confirmed keyboard barrier is independently reproducible; fixing the demo target resolves the matching failure.
- [ ] Evidence route shows screenshot **and** equivalent textual reproduction instructions.
- [ ] No unexplained “100% accessible” or “WCAG compliant” message appears anywhere.

### Accessibility acceptance for Sheriff itself

- [ ] All pages are navigable and functional with keyboard only.
- [ ] Skip link works and focus is clearly visible.
- [ ] Inputs have names, instructions, and error descriptions.
- [ ] Progress is announced without constant distracting updates.
- [ ] Every chart-like indicator has a text/table equivalent; color is not the sole channel.
- [ ] At 320 CSS px, app functionality remains available without unexpected page-level horizontal scrolling.
- [ ] Reduced-motion setting respected.
- [ ] axe-core checks on our app have no known critical/serious violations in the tested states; any remaining manual/unknown issues disclosed.

### Engineering acceptance

- [ ] Secrets are not checked into version control or sent to browsers.
- [ ] Untrusted HTML is escaped and remote URLs obey an allowlist/network guard.
- [ ] Timeout, refusal, unavailable service, and incomplete tests show honest status.
- [ ] The demo remains usable when Decisions or Twinly is down, with clear phase labels.
- [ ] Repo has a one-command setup/run instruction and seeded demo fixture.
- [ ] Successful live scenario is rehearsed twice with the same output semantics.

---

## 15. Self-review: objections and decisions

This specification is the result of explicitly rejecting tempting but unworkable features.

| Hard question | Final decision |
|---|---|
| Aren't we just wrapping axe-core? | No: the differentiator is an actual task trace, keyboard-constrained probe, evidence replay, and fix verification. axe-core remains the trustworthy rule engine. |
| Can Twinly emulate a person with a disability? | No. Twinly selects an exploratory path; Playwright enforces real keyboard constraints. Never equate an agent with a user's lived experience. |
| Can we truly audit *any* site in 48 hours? | No. Limit the MVP to public, authorized, bounded states and a fully instrumented demo. |
| Is an overall “accessibility score” scientifically defensible? | Only as an explicitly limited internal benchmark with disclosed weights, coverage, and scope. Not a conformance statement. |
| Could a perfect score hide an inaccessible checkout? | Use the deterministic critical-blocker cap; do not let minor passes mask essential-task failure. |
| Can the AI decide if a violation is real? | It can prioritize ambiguous evidence. It cannot replace deterministic checks or human validation. |
| Will five tests cover WCAG 2.2? | No. They are five narrow categories inspired by relevant criteria; report their limits. |
| Does vanilla JS automatically improve accessibility? | No. Semantic HTML, native controls, and real testing do. Vanilla JS is chosen to keep the product small. |
| Does React necessarily make a page slower? | No. Only a controlled benchmark of equivalent pages justifies a specific speed claim. |
| Can we fix any site automatically? | No. Show a curated, realistic code remedy and independently retest a developer-applied fix. |
| What happens when the agent cannot navigate? | Partial audit, explicit missing coverage, no fake replay and no fabricated score. |
| What is the biggest source of misleading findings? | Treating ambiguous visual/DOM heuristics as confirmed WCAG failures. Preserve a `review` state and require reproduction. |
| What is the biggest security risk? | Server-side URL browsing and unsafe automation. Use a strict allowlist for hackathon demo if complete SSRF protection isn't ready. |
| What makes the judges remember it? | The same button fails with keyboard, a real recorded trace explains why, the developer fixes it, and the identical test passes. |

### Final product thesis

**Most accessibility tools answer “What rule might be wrong?” Screenshot Sheriff also asks “What task did this prevent, how do we reproduce it, and did the fix actually work?”**

A simple app, honest tests, and one visible before/after transformation are the winning scope.

---

## 16. Official implementation references

Checked for this specification on **October 23, 2026**:

1. [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/) — criteria and conformance limitations.
2. [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) — integration with `@axe-core/playwright` and automated-test limitations.
3. [Twinly Developer API](https://www.twinly.tech/docs/developer-api) — computer next-action request/response, bounded action loop, coordinate system, scopes, and API-key handling.
4. [OpenAI Decisions API guide](https://developers.openai.com/api/docs/guides/decisions) — predicate/choice/score judgments, model support, batched questions, and interpretation.
5. [OpenAI Decisions API reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) — request fields and answer shapes.

> **Last principle:** A smaller honest accessibility tool with reproducible evidence is more useful—and more convincing—than a flashy dashboard claiming to certify what it has never tested.
