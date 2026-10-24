export const CATEGORIES = {
  keyboard: "Keyboard operation",
  forms: "Forms and validation",
  contrast: "Text contrast",
  semantics: "Structure and semantics",
  reflow: "Zoom and reflow",
};
export const REGISTRY = [
  [
    "K01",
    "keyboard",
    "Selected controls are keyboard reachable",
    ["2.1.1"],
    [],
    "Use a native button or link and preserve an equivalent keyboard path.",
  ],
  [
    "K02",
    "keyboard",
    "Selected controls respond to keyboard activation",
    ["2.1.1"],
    [],
    "Use native activation behavior, or implement the appropriate keyboard interaction.",
  ],
  [
    "F01",
    "forms",
    "Inputs expose accessible names",
    ["1.3.1", "4.1.2"],
    ["label", "select-name", "aria-input-field-name"],
    "Associate each input with a visible label using for/id or a valid accessible name.",
  ],
  [
    "F02",
    "forms",
    "Validation identifies the field and problem in text",
    ["3.3.1"],
    [],
    "Identify the field and the invalid value in a visible error message.",
  ],
  [
    "F03",
    "forms",
    "Validation errors have a programmatic relationship",
    ["1.3.1"],
    [],
    "Associate error text with its field or group using a supported relationship.",
  ],
  [
    "C01",
    "contrast",
    "Supported text meets AA contrast thresholds",
    ["1.4.3"],
    ["color-contrast"],
    "Increase foreground/background contrast to 4.5:1 for normal text or 3:1 for large text.",
  ],
  [
    "S01",
    "semantics",
    "Buttons and links expose accessible names",
    ["4.1.2", "2.4.4"],
    ["button-name", "link-name", "aria-command-name", "input-button-name"],
    "Give each control an accessible name that describes its action.",
  ],
  [
    "S02",
    "semantics",
    "Images expose testable text alternatives",
    ["1.1.1"],
    ["image-alt", "input-image-alt"],
    "Provide a meaningful alternative for informative images; use empty alt for decorative images.",
  ],
  [
    "S03",
    "semantics",
    "Supported ARIA roles and relationships are valid",
    ["1.3.1", "4.1.2"],
    [
      "aria-allowed-attr",
      "aria-valid-attr",
      "aria-valid-attr-value",
      "aria-required-attr",
      "aria-required-children",
      "aria-required-parent",
      "aria-roles",
    ],
    "Use valid ARIA roles, values, required attributes, and relationships; prefer native HTML.",
  ],
  [
    "R01",
    "reflow",
    "Investigated content reflows at 320 CSS pixels",
    ["1.4.10"],
    [],
    "Allow content to wrap and remove fixed widths or clipping that hide essential content.",
  ],
  [
    "R02",
    "reflow",
    "Selected controls remain available at 320 CSS pixels",
    ["1.4.10"],
    [],
    "Keep important controls available, or provide an operable responsive replacement.",
  ],
].map(([id, category, title, wcag, rules, remedy]) => ({
  id,
  category,
  title,
  wcag,
  rules,
  remedy,
}));
export function aggregateAxe(raw, rules) {
  if (
    !raw ||
    !rules.length ||
    !rules.every((id) =>
      [
        ...(raw.violations || []),
        ...(raw.passes || []),
        ...(raw.incomplete || []),
        ...(raw.inapplicable || []),
      ].some((r) => r.id === id),
    )
  )
    return "not_tested";
  if (raw.violations.some((r) => rules.includes(r.id))) return "failed";
  if (raw.incomplete.some((r) => rules.includes(r.id))) return "review";
  if (raw.passes.some((r) => rules.includes(r.id))) return "passed";
  return "not_applicable";
}
