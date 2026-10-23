// In-page helpers. `helpersFactory` is serialized and evaluated inside the
// audited page through `inPage`, so it must stay self-contained. Using a string
// expression (CDP Runtime.evaluate) keeps it working under strict page CSP.

export function helpersFactory() {
  const NATIVE_FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [contenteditable=""], [contenteditable="true"]';
  const INTERACTIVE = `${NATIVE_FOCUSABLE}, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [onclick], [tabindex]`;

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  }

  function isNativelyFocusable(el) {
    if (el.matches('a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe')) return !el.disabled;
    return el.isContentEditable;
  }

  function isFocusable(el) {
    if (el.hasAttribute('tabindex')) return Number(el.getAttribute('tabindex')) >= 0 || isNativelyFocusable(el);
    return isNativelyFocusable(el);
  }

  function role(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'button' || (tag === 'input' && ['button', 'submit', 'reset', 'image'].includes(el.type))) return 'button';
    if (tag === 'input') return ({ checkbox: 'checkbox', radio: 'radio', range: 'slider' })[el.type] || 'textbox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'img') return 'img';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'nav') return 'navigation';
    if (tag === 'summary') return 'button';
    return 'generic';
  }

  function clean(text) {
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // Approximate accessible name: aria-labelledby, aria-label, associated label,
  // alt/title, then text content. Used for identity and display, not for
  // verdicts (axe owns name-based assertions).
  function name(el) {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const t = labelledby.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.textContent).join(' ');
      if (clean(t)) return clean(t);
    }
    if (clean(el.getAttribute('aria-label'))) return clean(el.getAttribute('aria-label'));
    if (el.labels && el.labels.length) return clean([...el.labels].map((l) => l.textContent).join(' '));
    if (el.tagName === 'IMG') return clean(el.getAttribute('alt'));
    if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) return clean(el.value);
    const text = clean(el.innerText || el.textContent);
    if (text) return text;
    return clean(el.getAttribute('title'));
  }

  function selector(el) {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll(`#${el.id}`).length === 1) return `#${el.id}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement && parts.length < 6) {
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id) && document.querySelectorAll(`#${node.id}`).length === 1) {
        parts.unshift(`#${node.id}`);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const same = [...parent.children].filter((c) => c.tagName === node.tagName);
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  function hasPointerAffordance(el) {
    return el.hasAttribute('onclick') || getComputedStyle(el).cursor === 'pointer';
  }

  function landmark(el) {
    const lm = el.closest('nav, header, main, footer, aside, [role="navigation"], [role="banner"], [role="main"], [role="contentinfo"], dialog, [role="dialog"]');
    if (!lm) return null;
    return lm.getAttribute('role') || lm.tagName.toLowerCase();
  }

  function describe(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      role: role(el),
      name: name(el),
      selector: selector(el),
      focusable: isFocusable(el),
      nativeInteractive: el.matches('a[href], button, input, select, textarea, summary'),
      pointerAffordance: hasPointerAffordance(el),
      href: el.getAttribute('href') || null,
      landmark: landmark(el),
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      identity: `${landmark(el) || 'page'}|${role(el)}|${name(el).toLowerCase()}`,
    };
  }

  // The most specific interactive ancestor at a point, or the raw element.
  function interactiveAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    return hit.closest(INTERACTIVE) || hit.closest('[style*="cursor"]') || hit;
  }

  function stateSignature() {
    const h1 = document.querySelector('h1');
    const dialogs = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')].filter(isVisible);
    const expanded = [...document.querySelectorAll('[aria-expanded="true"]')].filter(isVisible).map((e) => name(e)).sort();
    return {
      path: location.pathname,
      title: clean(document.title),
      h1: h1 ? clean(h1.textContent) : '',
      dialogs: dialogs.map((d) => name(d) || 'dialog'),
      expanded,
    };
  }

  function visibleElements(limit) {
    const out = [];
    const w = innerWidth;
    const h = innerHeight;
    const seen = new Set();
    const candidates = [...document.querySelectorAll(INTERACTIVE)];
    for (const el of document.querySelectorAll('body *')) {
      if (candidates.length > 1500) break;
      if (!el.matches(INTERACTIVE) && getComputedStyle(el).cursor === 'pointer' && !el.parentElement.closest(INTERACTIVE)) candidates.push(el);
    }
    for (const el of candidates) {
      if (out.length >= limit || seen.has(el) || !isVisible(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (cx < 0 || cy < 0 || cx > w || cy > h) continue;
      out.push({
        id: out.length + 1,
        role: role(el),
        label: name(el) || el.getAttribute('placeholder') || '',
        x: Math.round((cx / w) * 1000),
        y: Math.round((cy / h) * 1000),
      });
    }
    return out;
  }

  return { isVisible, isFocusable, role, name, selector, describe, interactiveAt, stateSignature, visibleElements, clean };
}

// Run `fn(H, arg)` in the page with fresh helpers.
export function inPage(page, fn, arg) {
  return page.evaluate(`(${fn.toString()})((${helpersFactory.toString()})(), ${JSON.stringify(arg ?? null)})`);
}

export function signatureKey(sig) {
  return JSON.stringify([sig.path, sig.h1, sig.dialogs, sig.expanded]);
}

export function logicalCheckpointId(sig) {
  const slug = (sig.path === '/' ? 'home' : sig.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')).toLowerCase().slice(0, 40) || 'page';
  let hash = 0;
  for (const ch of signatureKey(sig)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `cp-${slug}-${hash.toString(36).slice(0, 5)}`;
}
