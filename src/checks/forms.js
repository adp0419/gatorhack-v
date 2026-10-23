// F02/F03 active validation. Runs only for server-configured authorized
// origins with a recipe; public sites keep these checks not_tested when form
// controls exist (docs/checks.md "Forms and reflow boundaries").
import { inPage } from '../runner/dom-helpers.js';
import { settle } from '../runner/browser.js';
import { restoreCheckpoint } from '../runner/restore.js';
import { makeResult } from './registry.js';

export async function hasFormControls(page) {
  return inPage(page, (H) =>
    [...document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea')].some(H.isVisible),
  );
}

function visibleTexts() {
  return (H) => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const text = H.clean(n.textContent);
      if (!text || !n.parentElement || !H.isVisible(n.parentElement)) continue;
      out.push({ text, selector: H.selector(n.parentElement) });
    }
    return out;
  };
}

export async function runFormRecipe({ context, checkpoint, startUrl, recipe, recorder }) {
  const page = await context.newPage();
  try {
    const restored = await restoreCheckpoint(page, checkpoint, startUrl);
    if (!restored.ok) return { status: 'not_tested', reason: 'Could not restore the form state.' };
    const before = new Set((await inPage(page, visibleTexts())).map((t) => t.text));
    const fields = [];
    for (const item of recipe.invalid) {
      const field = page.locator(item.field).first();
      if (!(await field.count())) return { status: 'not_tested', reason: `Recipe field ${item.field} was not found.` };
      await field.fill(item.value);
      fields.push(item);
    }
    await page.locator(recipe.submit).first().click();
    await settle(page, 600);
    const evidenceId = (await recorder.frame(page, { phase: 'checks', actor: 'probe', caption: 'Form after submitting deliberately invalid input (no real submission)', viewport: page.viewportSize() })).evidenceId;
    const after = await inPage(page, visibleTexts());
    const newTexts = after.filter((t) => !before.has(t.text));
    const details = [];
    for (const item of fields) {
      const info = await inPage(
        page,
        (H, arg) => {
          const field = document.querySelector(arg.field);
          const name = H.name(field);
          const refs = `${field.getAttribute('aria-describedby') || ''} ${field.getAttribute('aria-errormessage') || ''}`.split(/\s+/).filter(Boolean);
          const described = refs.map((id) => document.getElementById(id)).filter(Boolean);
          const describedText = described.map((n) => H.clean(n.textContent)).filter(Boolean);
          const labelText = field.labels ? [...field.labels].map((l) => H.clean(l.textContent)).join(' ') : '';
          return { name, labelText, invalid: field.getAttribute('aria-invalid') === 'true', describedText, describedVisible: described.some(H.isVisible) };
        },
        item,
      );
      const errorTexts = newTexts.map((t) => t.text);
      const nameWord = (info.name || '').toLowerCase();
      const mentionsField = !!nameWord && errorTexts.some((t) => t.toLowerCase().includes(nameWord));
      const associated = info.describedVisible && info.describedText.length > 0;
      let f02;
      let f03;
      if (!errorTexts.length) {
        f02 = 'review';
        f03 = 'review';
      } else {
        f02 = mentionsField ? 'passed' : associated ? 'review' : 'failed';
        f03 = associated ? 'passed' : mentionsField ? 'review' : 'failed';
      }
      details.push({ field: item.field, value: item.value, accessibleName: info.name, ariaInvalid: info.invalid, errorTexts, describedBy: info.describedText, mentionsField, associated, f02, f03 });
    }
    return { details, evidenceId };
  } catch (err) {
    return { status: 'not_tested', reason: `Form probe error: ${err.message}` };
  } finally {
    await page.close().catch(() => {});
  }
}

function worst(list) {
  const order = ['failed', 'review', 'passed'];
  return order.find((s) => list.includes(s)) || 'not_tested';
}

export function formResults(checkpoint, { hasControls, recipeOutcome, authorized }) {
  if (!hasControls) {
    const reason = 'No form fields were present in this state.';
    return [makeResult('F02', checkpoint, 'not_applicable', reason), makeResult('F03', checkpoint, 'not_applicable', reason)];
  }
  if (!recipeOutcome) {
    const reason = authorized
      ? 'This authorized target has no validation recipe for this state.'
      : 'Error behavior is only tested on authorized test sites; public forms are never submitted.';
    return [makeResult('F02', checkpoint, 'not_tested', reason), makeResult('F03', checkpoint, 'not_tested', reason)];
  }
  if (!recipeOutcome.details) {
    return [makeResult('F02', checkpoint, 'not_tested', recipeOutcome.reason), makeResult('F03', checkpoint, 'not_tested', recipeOutcome.reason)];
  }
  const d = recipeOutcome.details;
  const common = { method: 'authorized invalid-input recipe (client-side only)', evidenceIds: [recipeOutcome.evidenceId], targets: d };
  const f02 = worst(d.map((x) => x.f02));
  const f03 = worst(d.map((x) => x.f03));
  return [
    makeResult('F02', checkpoint, f02, {
      passed: 'The error message names the invalid field and the problem.',
      failed: 'An error appeared but it does not name the invalid field and is not associated with it.',
      review: 'The error behavior could not be conclusively evaluated.',
    }[f02], common),
    makeResult('F03', checkpoint, f03, {
      passed: 'The error message is referenced from the field (aria-describedby/aria-errormessage).',
      failed: 'The error message has no programmatic relationship to the field and does not name it.',
      review: 'The error names the field but no recognized programmatic relationship was found; another valid technique may be in use.',
    }[f03], common),
  ];
}
