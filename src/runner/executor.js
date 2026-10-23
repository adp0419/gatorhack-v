// Translates Twinly actions into Playwright input after an independent safety
// review. A model's `commits: false` is never treated as authorization.
import { inPage } from './dom-helpers.js';

const KEY_MAP = {
  return: 'Enter', enter: 'Enter', tab: 'Tab', 'shift+tab': 'Shift+Tab', escape: 'Escape', esc: 'Escape',
  space: ' ', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
};

const SENSITIVE_TEXT = [/\b(?:\d[ -]?){13,19}\b/, /\b\d{3}-\d{2}-\d{4}\b/];

// Normalized 0-1000 grid -> CSS pixels. Screenshots are viewport captures at
// device scale 1, so screenshot pixels and CSS pixels share the same space.
export function toCssPoint(x, y, viewport) {
  const clamp = (v, max) => Math.min(Math.max(Math.round(v), 0), max - 1);
  return { x: clamp((x / 1000) * viewport.width, viewport.width), y: clamp((y / 1000) * viewport.height, viewport.height) };
}

export function mapKey(keys) {
  if (typeof keys !== 'string') return null;
  return KEY_MAP[keys.trim().toLowerCase()] || null;
}

// Pure policy decision given the action and in-page facts about its target.
export function reviewAction(action, facts = {}) {
  if (action.commits === true) return { allowed: false, stop: true, reason: 'Twinly marked this action as committing; exploration stops.' };
  switch (action.type) {
    case 'click':
    case 'double_click': {
      const t = facts.target;
      if (!t) return { allowed: false, reason: 'Nothing is at the requested point.' };
      if (t.submits) return { allowed: false, reason: 'The target submits a form; submissions are not permitted.' };
      if (t.download) return { allowed: false, reason: 'The target starts a download.' };
      if (t.crossOrigin) return { allowed: false, reason: 'The target navigates to a different site.' };
      if (t.sensitive) return { allowed: false, reason: 'The target is an account, purchase, or destructive control.' };
      return { allowed: true };
    }
    case 'type': {
      if (facts.focusedSensitive) return { allowed: false, reason: 'The focused field takes a password or payment/identity value.' };
      if (typeof action.text !== 'string' || action.text.length > 200) return { allowed: false, reason: 'Typed text is missing or too long.' };
      if (SENSITIVE_TEXT.some((re) => re.test(action.text))) return { allowed: false, reason: 'Typed text looks like a card or identity number.' };
      return { allowed: true };
    }
    case 'key': {
      const key = mapKey(action.keys);
      if (!key) return { allowed: false, reason: `Key "${action.keys}" is not on the allowed list.` };
      if (key === 'Enter' && facts.focusedInForm) return { allowed: false, reason: 'Enter inside a form can submit it implicitly.' };
      return { allowed: true };
    }
    case 'scroll':
    case 'wait':
      return { allowed: true };
    default:
      return { allowed: false, reason: `Action type "${action.type}" is not executable.` };
  }
}

export async function gatherFacts(page, action, point, startOrigin) {
  return inPage(
    page,
    (H, arg) => {
      const facts = {};
      const active = document.activeElement;
      const sensitiveField = (el) =>
        !!el && (el.type === 'password' || /cc-|one-time-code/.test(el.autocomplete || '') || /pass|card|cvv|cvc|ssn|social/i.test(`${el.name} ${el.id}`));
      facts.focusedSensitive = sensitiveField(active);
      facts.focusedInForm = !!(active && active.closest && active.closest('form') && active !== document.body);
      if (arg.point) {
        const el = H.interactiveAt(arg.point.x, arg.point.y);
        if (el) {
          const d = H.describe(el);
          const link = el.closest('a[href]');
          let crossOrigin = false;
          if (link) {
            try {
              crossOrigin = new URL(link.href, location.href).origin !== arg.startOrigin;
            } catch {}
          }
          const btn = el.closest('button, input');
          const submits = !!btn && !!btn.form && (btn.type === 'submit' || btn.type === 'image');
          const text = `${d.name} ${el.getAttribute('href') || ''}`.toLowerCase();
          facts.target = {
            ...d,
            submits,
            download: !!(link && link.hasAttribute('download')),
            crossOrigin,
            sensitive: /\b(log ?in|sign ?in|sign ?up|log ?out|checkout|buy|purchase|pay|delete|remove|unsubscribe|register)\b/.test(text),
          };
        }
      }
      return facts;
    },
    { point, startOrigin },
  );
}

export async function execute(page, action, viewport) {
  switch (action.type) {
    case 'click': {
      const p = toCssPoint(action.x, action.y, viewport);
      await page.mouse.click(p.x, p.y);
      return { cssPoint: p };
    }
    case 'double_click': {
      const p = toCssPoint(action.x, action.y, viewport);
      await page.mouse.dblclick(p.x, p.y);
      return { cssPoint: p };
    }
    case 'type':
      await page.keyboard.type(action.text, { delay: 10 });
      return {};
    case 'key':
      await page.keyboard.press(mapKey(action.keys));
      return {};
    case 'scroll': {
      const p = Number.isFinite(action.x) ? toCssPoint(action.x, action.y, viewport) : { x: viewport.width / 2, y: viewport.height / 2 };
      const amount = Math.min(Math.max(Number(action.amount) || 3, 1), 20) * 100;
      const dir = action.direction || 'down';
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(dir === 'left' ? -amount : dir === 'right' ? amount : 0, dir === 'up' ? -amount : dir === 'down' ? amount : 0);
      return { cssPoint: p };
    }
    case 'wait':
      await page.waitForTimeout(Math.min(Math.max(Number(action.seconds) || 1, 0.2), 10) * 1000);
      return {};
    default:
      throw new Error(`cannot execute ${action.type}`);
  }
}
