// Curated rule-to-remedy templates. Explanations come from evidence and these
// templates, not from a generative model (architecture.md "OpenAI Decisions").
// Code snippets are illustrative; AccessBench does not see or edit site source.

export const REMEDIES = {
  K01: {
    text: 'Make the control reachable with Tab. Use a native element for the job (a link that navigates is an <a href>, an action is a <button>) instead of adding click handlers to a generic element.',
    snippet: '<!-- before -->\n<span onclick="location.href=\'/contact\'">Contact</span>\n<!-- after -->\n<a href="/contact">Contact</a>',
  },
  K02: {
    text: 'Make keyboard activation do what a pointer click does. Native links activate with Enter and buttons with Enter and Space; custom widgets need equivalent key handlers.',
    snippet: '<button type="button" aria-expanded="false" aria-controls="menu">Menu</button>',
  },
  F01: {
    text: 'Give every input a programmatic name, normally a visible <label for> that matches the input id. Nearby text that is not a label is not announced with the field.',
    snippet: '<label for="email">Email</label>\n<input id="email" name="email" type="email" autocomplete="email">',
  },
  F02: {
    text: 'When validation fails, show a text message that names the field and says how to fix it, for example "Email: enter an address like name@example.com".',
    snippet: '<p id="email-error">Email: enter an address like name@example.com.</p>',
  },
  F03: {
    text: 'Connect the error message to its field so assistive technology announces it with the field, for example with aria-describedby and aria-invalid.',
    snippet: '<input id="email" aria-describedby="email-error" aria-invalid="true">\n<p id="email-error">Email: enter an address like name@example.com.</p>',
  },
  C01: {
    text: 'Raise the contrast between text and its background to at least 4.5:1 (3:1 for large text). Darken the text or lighten the background.',
    snippet: '/* before */ color: #b8b8b8;  /* about 2:1 on white */\n/* after  */ color: #4b5563;  /* about 7.6:1 on white */',
  },
  S01: {
    text: 'Give every button and link an accessible name. Icon-only controls need an aria-label or visually hidden text that says what they do.',
    snippet: '<button type="button" aria-label="Search">\n  <svg aria-hidden="true" focusable="false">…</svg>\n</button>',
  },
  S02: {
    text: 'Give meaningful images a text alternative that conveys their purpose. Decorative images should use alt="" so they are skipped.',
    snippet: '<img src="hero.svg" alt="Illustration of a green bicycle">',
  },
  S03: {
    text: 'Use only valid ARIA roles and attributes, include required attributes and owned elements, and prefer native HTML where it exists.',
    snippet: '<!-- role="tab" requires a parent with role="tablist" -->',
  },
  R01: {
    text: 'Let content reflow at 320 CSS pixels: avoid fixed widths on text containers; use max-width: 100%, flexible layouts, and wrapping.',
    snippet: '/* before */ .promo { width: 900px; }\n/* after  */ .promo { max-width: 100%; }',
  },
  R02: {
    text: 'Keep important controls available at narrow widths, either in place or through a responsive menu that is itself operable.',
    snippet: '',
  },
};

// Rule-based default impact, used for ordering when triage is unavailable.
export const DEFAULT_IMPACT = {
  K01: 'high', K02: 'high', F01: 'high', F02: 'moderate', F03: 'moderate',
  C01: 'moderate', S01: 'high', S02: 'moderate', S03: 'moderate', R01: 'moderate', R02: 'moderate',
};
