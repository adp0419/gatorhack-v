import { chromium } from "playwright";
import { VIEWPORTS } from "./config.js";
import {
  createNetworkProxy,
  validateAction,
  fixturePath,
  parseTarget,
  resolvePublic,
  responseNavigationOrigin,
} from "./policy.js";

const navigators = new WeakMap();
const pendingNavigations = new WeakMap();
export async function navigatePage(page, url, options) {
  const navigate = navigators.get(page);
  return navigate ? navigate(url, options) : page.goto(url, options);
}

export async function openBrowser({ origin, fixtureOrigin, signal }) {
  if (signal?.aborted) throw signal.reason;
  const proxy = await createNetworkProxy(fixtureOrigin);
  const restrictions = [];
  let navigationOrigin = origin;
  const cachedNavigations = new WeakMap();
  const restricted = (
    kind,
    url,
    reason = "Outside the audit scope",
    resourceType = "document",
  ) => {
    if (restrictions.length < 100) {
      let destination;
      try {
        const parsed = new URL(url);
        destination = parsed.origin + parsed.pathname;
      } catch {
        destination = "unsupported URL";
      }
      restrictions.push({
        kind,
        destination,
        reason,
        resourceType,
        affectedChecks:
          "Checks cover only loaded content; embedded documents and blocked resources are not audited.",
        timestamp: new Date().toISOString(),
      });
    }
  };
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: { server: proxy.url, bypass: "<-loopback>" },
      args: [
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    const context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    async function verifyNavigation(input, initial) {
      const target = new URL(input);
      if (!initial && target.origin !== navigationOrigin)
        throw new Error("Navigation is outside the validated landing origin");
      if (target.origin === fixtureOrigin) {
        if (target.username || target.password || !fixturePath(target.pathname))
          throw new Error("Local path is outside the authorized fixture");
      } else {
        if (origin === fixtureOrigin) throw new Error("Fixture escape");
        parseTarget(target.href);
        await resolvePublic(target.hostname);
      }
      return target;
    }
    async function navigate(p, input, options = {}, initial = false) {
      let current = new URL(input),
        response;
      const seen = new Set();
      try {
        for (let hops = 0; ; hops++) {
          await verifyNavigation(current.href, initial);
          if (hops >= 10 || seen.has(current.href))
            throw new Error("Redirect loop or limit exceeded");
          seen.add(current.href);
          response = await context.request.get(current.href, {
            maxRedirects: 0,
            timeout: 15000,
          });
          const location = response.headers()["location"];
          if (response.status() >= 300 && response.status() < 400 && location) {
            const next = new URL(location, current);
            await response.dispose();
            response = undefined;
            current = next;
            continue;
          }
          if (response.status() >= 400)
            throw new Error(
              `The page could not be loaded (HTTP ${response.status()}).`,
            );
          break;
        }
        if (initial)
          navigationOrigin = responseNavigationOrigin(
            navigationOrigin,
            current.href,
            response.status(),
            true,
          );
        const fetchUrl = new URL(current);
        fetchUrl.hash = "";
        cachedNavigations.set(p, { url: fetchUrl.href, response });
        // Fulfill the already validated final response at its actual URL. No
        // browser redirect can race ahead of scope validation or be fetched twice.
        return await p.goto(current.href, {
          waitUntil: "domcontentloaded",
          ...options,
        });
      } catch (error) {
        restricted(
          "Blocked navigation or request",
          current.href,
          /landing origin|Fixture escape|Local path|Redirect loop|HTTP \d/.test(
            error.message,
          )
            ? error.message
            : "Navigation response could not be fetched or validated",
          "document",
        );
        throw error;
      } finally {
        cachedNavigations.delete(p);
        await response?.dispose();
      }
    }
    await context.route("**/*", async (route) => {
      const request = route.request();
      try {
        const url = new URL(request.url());
        const local = fixtureOrigin && url.origin === fixtureOrigin;
        const navigation = request.isNavigationRequest();
        if (
          url.username ||
          url.password ||
          !["http:", "https:"].includes(url.protocol) ||
          !["GET", "HEAD"].includes(request.method()) ||
          (local && !fixturePath(url.pathname)) ||
          (navigation && url.origin !== navigationOrigin)
        ) {
          restricted(
            `Blocked ${request.method()} ${request.resourceType()}`,
            request.url(),
            !["GET", "HEAD"].includes(request.method())
              ? "Mutating requests are blocked on public sites"
              : local && !fixturePath(url.pathname)
                ? "Local path is outside the authorized fixture"
                : "Navigation is outside the validated landing origin or uses an unsupported URL",
            request.resourceType(),
          );
          return route.abort("blockedbyclient");
        }
        if (!navigation) return route.continue();
        const frame = request.frame(),
          p = frame.page();
        const cached = cachedNavigations.get(p);
        if (frame === p.mainFrame() && cached?.url === url.href) {
          await route.fulfill({ response: cached.response });
          return;
        }
        const response = await route.fetch({ maxRedirects: 0, timeout: 15000 });
        try {
          const location = response.headers()["location"];
          if (response.status() >= 300 && response.status() < 400 && location) {
            const next = await verifyNavigation(
              new URL(location, url).href,
              false,
            );
            if (frame !== p.mainFrame())
              throw new Error(
                "Embedded document redirect requires separate review",
              );
            await route.abort("aborted");
            // Pointer-triggered redirects also go through the same bounded
            // resolver. settlePage waits for this real navigation before capture.
            const pending = navigate(p, next.href).then(
              () => null,
              (error) => error,
            );
            pendingNavigations.set(p, pending);
            return;
          }
          await route.fulfill({ response });
        } finally {
          await response.dispose();
        }
      } catch (error) {
        restricted(
          "Blocked navigation or request",
          request.url(),
          /landing origin|Fixture escape|Local path|Embedded document/.test(
            error.message,
          )
            ? error.message
            : "Navigation response could not be fetched or validated",
          request.resourceType(),
        );
        await route.abort("blockedbyclient").catch(() => {});
      }
    });
    await context.routeWebSocket("**/*", (ws) => {
      restricted(
        "Blocked WebSocket",
        ws.url(),
        "Persistent bidirectional connections are outside non-submitting checks",
        "websocket",
      );
      ws.close();
    });
    await context.addInitScript(() => {
      Object.defineProperty(window, "__abSelector", {
        value: (element) => {
          const uniqueId = (node) =>
            node.id &&
            document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1;
          const parts = [];
          for (let node = element; node; node = node.parentElement) {
            if (uniqueId(node)) {
              parts.unshift(`#${CSS.escape(node.id)}`);
              return parts.join(" > ");
            }
            if (node === document.body || node === document.documentElement) {
              parts.unshift(node.tagName.toLowerCase());
              return parts.join(" > ");
            }
            const siblings = [...node.parentElement.children].filter(
              (s) => s.tagName === node.tagName,
            );
            parts.unshift(
              `${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`,
            );
          }
          return parts.join(" > ");
        },
      });
      const listeners = new WeakMap(),
        original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, ...args) {
        const types = listeners.get(this) || [];
        types.push(type);
        listeners.set(this, types);
        return original.call(this, type, ...args);
      };
      Object.defineProperty(window, "__abListeners", {
        value: (target) => listeners.get(target) || [],
      });
      // Defense in depth: block implicit and programmatic form submissions.
      original.call(
        document,
        "submit",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true,
      );
      HTMLFormElement.prototype.submit = function () {};
      HTMLFormElement.prototype.requestSubmit = function () {};
    });
    context.on("page", (p) => {
      navigators.set(p, (url, options) => navigate(p, url, options));
      p.setDefaultTimeout(5000);
      p.setDefaultNavigationTimeout(15000);
      p.on("dialog", (d) => d.dismiss());
      p.on("download", (d) => d.cancel());
      p.on("popup", (popup) => {
        restricted(
          "Closed popup",
          popup.url(),
          "Exploration is confined to one audit page",
          "popup",
        );
        popup.close();
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(15000);
    const close = async () => {
      await browser.close().catch(() => {});
      await proxy.close();
    };
    signal?.addEventListener(
      "abort",
      () => {
        void browser.close();
      },
      { once: true },
    );
    const navigateStart = async (url) => {
      if (new URL(url).origin !== origin)
        throw new Error("Start origin mismatch");
      await navigate(page, url, {}, true);
      await settlePage(page, true);
      return page.url();
    };
    return { browser, context, page, close, restrictions, navigateStart };
  } catch (error) {
    await browser?.close();
    await proxy.close();
    throw error;
  }
}

export async function state(page) {
  return evaluateStable(page, () => {
    const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(e).visibility !== "hidden"
      );
    };
    const anchors = [...document.querySelectorAll("[id]")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return visible(e) && r.top >= -2 && r.top < innerHeight;
      })
      .slice(0, 200);
    return {
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 14000),
      heading: clean(document.querySelector("h1")?.textContent),
      scroll: { x: scrollX, y: scrollY },
      visibleAnchors: anchors.map((e) => e.id),
      anchorEvidence: anchors.map((e) => ({
        id: e.id,
        text: clean(e.textContent).slice(0, 500),
      })),
      dialogs: [
        ...document.querySelectorAll(
          "dialog[open],[role=dialog],[aria-modal=true]",
        ),
      ]
        .filter(visible)
        .map((e) => window.__abSelector(e)),
      expanded: [
        ...document.querySelectorAll("[aria-expanded],[open],dialog"),
      ].map((e) => [
        e.id,
        e.getAttribute("aria-expanded"),
        e.hasAttribute("open"),
      ]),
    };
  });
}
// Focus traversal can scroll automatically. Compare content/widgets separately
// and verify an intended anchor destination explicitly for scroll interactions.
export const stateKey = (s) =>
  JSON.stringify({ url: s.url, text: s.text, expanded: s.expanded });
export function sourceStateMatches(snapshot, expected) {
  if (snapshot.heading === undefined || expected.heading === undefined)
    return stateKey(snapshot) === stateKey(expected);
  return (
    snapshot.url === expected.url &&
    snapshot.heading === expected.heading &&
    JSON.stringify(snapshot.expanded) === JSON.stringify(expected.expanded) &&
    JSON.stringify(snapshot.dialogs || []) ===
      JSON.stringify(expected.dialogs || [])
  );
}
export function interactionMatches(snapshot, selection) {
  if (!selection.scrollTarget)
    return stateKey(snapshot) === stateKey(selection.after);
  const expected = selection.after.anchorEvidence?.find(
    (e) => e.id === selection.scrollTarget,
  );
  const observed = snapshot.anchorEvidence?.find(
    (e) => e.id === selection.scrollTarget,
  );
  return (
    sourceStateMatches(snapshot, selection.after) &&
    snapshot.visibleAnchors?.includes(selection.scrollTarget) &&
    (!expected || observed?.text === expected.text)
  );
}

export async function inspectAt(page, point) {
  return evaluateStable(
    page,
    ({ x, y, focused }) => {
      let e = focused
        ? document.activeElement
        : document.elementFromPoint(x, y);
      e =
        e?.closest(
          "a,button,input,select,textarea,[role],[onclick],[tabindex]",
        ) || e;
      if (!e) return null;
      const selector = window.__abSelector(e);
      const uniqueId =
        e.id && document.querySelectorAll(`#${CSS.escape(e.id)}`).length === 1;
      const ancestry = [];
      for (let p = e; p; p = p.parentElement) ancestry.push(p);
      const click = ancestry.some(
        (p) => p.onclick || (window.__abListeners?.(p) || []).includes("click"),
      );
      const keyboard = [...ancestry, document, window].some(
        (p) =>
          p.onkeydown ||
          p.onkeyup ||
          (window.__abListeners?.(p) || []).some((t) =>
            ["keydown", "keyup", "keypress"].includes(t),
          ),
      );
      const controls = e.getAttribute("aria-controls");
      const alternativePath =
        !!e.accessKey ||
        !!e.closest("label") ||
        !!document.querySelector("[accesskey]") ||
        !!(
          controls &&
          [...document.querySelectorAll("button,a,[tabindex]")].some(
            (other) =>
              other !== e &&
              other.tabIndex >= 0 &&
              other.getAttribute("aria-controls") === controls,
          )
        );
      return {
        selector,
        identity: uniqueId ? `id:${e.id}` : selector,
        tag: e.tagName,
        role: e.getAttribute("role"),
        name: (
          e.getAttribute("aria-label") ||
          e.innerText ||
          e.getAttribute("alt") ||
          ""
        ).slice(0, 200),
        type: e.getAttribute("type"),
        href: e.getAttribute("href"),
        controls,
        inForm: !!e.closest("form"),
        tabIndex: e.tabIndex,
        clickListener: click,
        keyboardListener: keyboard,
        alternativePath,
        html: e.outerHTML.slice(0, 1500),
      };
    },
    point,
  );
}
const dangerous =
  /\b(delete|remove|purchase|buy|checkout|pay|send|submit|sign[ -]?(in|out|up)|log[ -]?(in|out)|register|unsubscribe|book|confirm|accept|save)\b/i;
export async function execute(page, proposed) {
  const action = validateAction(proposed, page.viewportSize());
  const before = await state(page);
  let target = action.css ? await inspectAt(page, action.css) : null;
  if (["click", "double_click"].includes(action.type)) {
    if (
      !target ||
      dangerous.test(`${target.name} ${target.href || ""}`) ||
      (target.inForm &&
        (target.tag === "BUTTON" ||
          (target.tag === "INPUT" &&
            ["submit", "image", "button", "reset"].includes(target.type)))) ||
      ["file", "password"].includes(target.type)
    )
      throw new Error(
        "Potential submission, account action, or unsafe control blocked",
      );
    if (target.href) {
      const next = new URL(target.href, page.url());
      if (
        !["http:", "https:"].includes(next.protocol) ||
        next.origin !== new URL(page.url()).origin ||
        next.search
      )
        throw new Error("Unsafe navigation blocked");
    }
  }
  if (action.type === "key" && ["Enter", "Space"].includes(action.key)) {
    target = await inspectAt(page, { focused: true });
    if (
      !target ||
      target.inForm ||
      dangerous.test(`${target.name} ${target.href || ""}`) ||
      (!["BUTTON", "A", "SUMMARY"].includes(target.tag) &&
        target.role !== "button")
    )
      throw new Error(
        "Implicit submission or unknown keyboard activation blocked",
      );
    if (target.href) {
      const u = new URL(target.href, page.url());
      if (u.origin !== new URL(page.url()).origin || u.search)
        throw new Error("Unsafe keyboard navigation blocked");
    }
  }
  if (action.type === "key" && ["/", "?"].includes(action.key)) {
    const editing = await page.evaluate(() => {
      const e = document.activeElement;
      return !!e?.closest(
        "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]",
      );
    });
    if (editing)
      throw new Error("Site shortcuts are blocked while editing a field");
  }
  if (action.type === "type") {
    const safe = await page.evaluate(() => {
      const e = document.activeElement;
      return (
        e?.tagName === "INPUT" &&
        ["text", "search"].includes(e.type) &&
        !e.closest("form") &&
        !/password|email|phone|card|ssn/i.test(`${e.name} ${e.id}`)
      );
    });
    if (!safe)
      throw new Error(
        "Typing is limited to non-sensitive search/text controls outside forms",
      );
  }
  if (action.type === "click")
    await page.mouse.click(action.css.x, action.css.y);
  if (action.type === "double_click")
    await page.mouse.dblclick(action.css.x, action.css.y);
  if (action.type === "type") await page.keyboard.insertText(action.text);
  if (action.type === "key") await page.keyboard.press(action.key);
  if (action.type === "scroll") {
    await page.mouse.move(action.css.x, action.css.y);
    await page.mouse.wheel(
      (action.direction === "right"
        ? 1
        : action.direction === "left"
          ? -1
          : 0) *
        action.amount *
        100,
      (action.direction === "down" ? 1 : action.direction === "up" ? -1 : 0) *
        action.amount *
        100,
    );
  }
  if (action.type === "wait") await page.waitForTimeout(action.seconds * 1000);
  await settlePage(page, page.url() !== before.url);
  const after = await state(page);
  let scrollTarget;
  if (["click", "double_click"].includes(action.type) && target?.href) {
    const destination = new URL(target.href, before.url);
    let anchor;
    try {
      anchor = decodeURIComponent(destination.hash.slice(1));
    } catch {
      anchor = "";
    }
    if (
      anchor &&
      destination.origin === new URL(before.url).origin &&
      destination.pathname === new URL(before.url).pathname &&
      after.visibleAnchors.includes(anchor) &&
      Math.hypot(
        after.scroll.x - before.scroll.x,
        after.scroll.y - before.scroll.y,
      ) > 2
    )
      scrollTarget = anchor;
  }
  return {
    scrollTarget,
    action,
    target,
    before,
    after,
    changed: stateKey(before) !== stateKey(after) || !!scrollTarget,
    screenshot: { ...page.viewportSize(), deviceScaleFactor: 1 },
  };
}

export async function visibleElements(page) {
  return evaluateStable(page, () =>
    [
      ...document.querySelectorAll(
        "a,button,input,select,[role=button],[onclick],[tabindex]",
      ),
    ]
      .flatMap((e, id) => {
        const r = e.getBoundingClientRect();
        return r.width &&
          r.height &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth
          ? [
              {
                id,
                role: e.getAttribute("role") || e.tagName.toLowerCase(),
                label: (
                  e.getAttribute("aria-label") ||
                  e.textContent ||
                  e.getAttribute("placeholder") ||
                  ""
                )
                  .trim()
                  .slice(0, 100),
                x: Math.round(((r.x + r.width / 2) / innerWidth) * 1000),
                y: Math.round(((r.y + r.height / 2) / innerHeight) * 1000),
              },
            ]
          : [];
      })
      .slice(0, 100),
  );
}

// Avoid networkidle: analytics and long polling may never become idle.
export async function settlePage(page, navigated = false) {
  if (navigated)
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(navigated ? 500 : 250);
  const pending = pendingNavigations.get(page);
  if (pending) {
    const error = await pending;
    if (pendingNavigations.get(page) === pending)
      pendingNavigations.delete(page);
    if (error) throw error;
  }
  // Smooth anchor scrolling must settle before recording its destination.
  let previous = await evaluateStable(page, () => [scrollX, scrollY]);
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(80);
    const current = await evaluateStable(page, () => [scrollX, scrollY]);
    if (
      Math.abs(current[0] - previous[0]) < 1 &&
      Math.abs(current[1] - previous[1]) < 1
    )
      break;
    previous = current;
  }
}

// A navigation can replace the execution context between a click and capture.
// Retry only that transient browser error; other failures remain visible.
async function evaluateStable(page, fn, argument) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(fn, argument);
    } catch (error) {
      if (
        attempt >= 2 ||
        !/Execution context was destroyed|Cannot find context/.test(
          error.message,
        )
      )
        throw error;
      await page
        .waitForLoadState("domcontentloaded", { timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}
