// Freeze the desktop sample instead of comparing two independent first-N lists.
export async function layout(page, sample) {
  return page.evaluate((sample) => {
    const visible = (e) => {
      const s = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return (
        !!r.width &&
        !!r.height &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };
    const text = (e) =>
      (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 250);
    const candidates = [
      ...document.querySelectorAll(
        "h1,h2,h3,p,a,button,input,label,li,[onclick],[role=button],[tabindex]",
      ),
    ].filter(visible);
    const selected = sample
      ? sample.map((n) => {
          const matches = [...document.querySelectorAll(n.selector)];
          let e =
            matches.length === 1 && visible(matches[0]) ? matches[0] : null;
          let replacement = false;
          if (!e) {
            // Never claim equivalence from geometry or duplicated labels alone.
            const alternatives = n.text
              ? candidates.filter(
                  (e) => e.tagName === n.tag && text(e) === n.text,
                )
              : [];
            if (alternatives.length === 1) {
              e = alternatives[0];
              replacement = true;
            }
          }
          return { e, original: n, replacement };
        })
      : candidates.slice(0, 60).map((e) => ({ e }));
    const nodes = selected.map(({ e, original, replacement }) => {
      if (!e)
        return {
          ...original,
          matched: false,
          reason: "Missing or hidden; no unique responsive equivalent",
          clipped: false,
        };
      const selector = window.__abSelector(e),
        r = e.getBoundingClientRect();
      const currentText = text(e);
      let clipped = false;
      const clips = [];
      for (
        let p = e.parentElement;
        p && p !== document.body;
        p = p.parentElement
      ) {
        const style = getComputedStyle(p),
          b = p.getBoundingClientRect();
        if (
          ["hidden", "clip"].includes(style.overflowX) &&
          (r.right > b.right + 2 || r.left < b.left - 2)
        ) {
          clipped = true;
          clips.push({
            tag: p.tagName,
            overflow: style.overflowX,
            bounds: { left: b.left, right: b.right },
          });
        }
      }
      const hit = document.elementFromPoint(
        Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)),
        Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2)),
      );
      const ownTarget =
        e.id && document.querySelectorAll(`#${CSS.escape(e.id)}`).length === 1
          ? `id:${e.id}`
          : selector;
      return {
        target: original?.target || ownTarget,
        selector: original?.selector || selector,
        actualSelector: selector,
        replacement: !!replacement,
        matched:
          !original ||
          (e.tagName === original.tag && currentText === original.text),
        reason:
          original && currentText !== original.text
            ? "Text changed at narrow width"
            : null,
        text: currentText,
        tag: e.tagName,
        clipped,
        clips,
        table: !!e.closest("table,[role=table],svg,canvas"),
        bounds: { left: r.left, right: r.right, width: r.width },
        hit: e === hit || e.contains(hit),
        outside: r.left >= innerWidth || r.right <= 0,
      };
    });
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      nodes,
    };
  }, sample);
}
export function compareLayouts(desktop, narrow) {
  const unmatched = desktop.nodes.flatMap((node) => {
    const match = narrow.nodes.find((n) => n.target === node.target);
    return match?.matched
      ? []
      : [
          {
            target: node.target,
            text: node.text,
            reason: match?.reason || "Target not observed",
          },
        ];
  });
  return { comparable: unmatched.length === 0, unmatched };
}
