import { chromium } from "playwright";
import { VIEWPORTS } from "./config.js";
import {
  createNetworkProxy,
  validateAction,
  fixturePath,
  parseTarget,
  resolvePublic,
} from "./policy.js";

export async function openBrowser({ origin, fixtureOrigin, signal }) {
  if (signal?.aborted) throw signal.reason;
  const proxy = await createNetworkProxy(fixtureOrigin);
  const restrictions = [];
  let navigationOrigin = origin;
  let startRequestUrl;
  const startDestinations = new Set();
  const restricted = (kind, url) => {
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
    await context.route("**/*", async (route) => {
      const request = route.request();
      try {
        const url = new URL(request.url());
        const local = fixtureOrigin && url.origin === fixtureOrigin;
        // Only the HTTP redirect chain of the explicit start request may change
        // origin. Subsequent exploration stays on the actual landing origin.
        let initialRedirect = false;
        if (
          startRequestUrl &&
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          let root = request;
          while (root.redirectedFrom()) root = root.redirectedFrom();
          initialRedirect =
            root.url() === startRequestUrl ||
            startDestinations.has(request.url());
          if (initialRedirect && url.origin !== origin) {
            if (origin === fixtureOrigin) throw new Error("Fixture escape");
            parseTarget(url.href);
            await resolvePublic(url.hostname);
          }
        }
        if (
          !["http:", "https:"].includes(url.protocol) ||
          !["GET", "HEAD"].includes(request.method()) ||
          (local && !fixturePath(url.pathname)) ||
          (request.isNavigationRequest() &&
            url.origin !== navigationOrigin &&
            !initialRedirect)
        ) {
          restricted(
            `Blocked ${request.method()} ${request.resourceType()}`,
            request.url(),
          );
          return route.abort("blockedbyclient");
        }
        if (request.isNavigationRequest()) {
          // Do not let Chromium follow an unchecked redirect after continue().
          // Fulfilled redirect responses produce a fresh intercepted navigation.
          const response = await route.fetch({
            maxRedirects: 0,
            timeout: 15000,
          });
          const location = response.headers()["location"];
          if (response.status() >= 300 && response.status() < 400 && location) {
            const next = new URL(location, url);
            next.hash = "";
            if (next.origin !== navigationOrigin) {
              if (!initialRedirect || origin === fixtureOrigin)
                throw new Error("Cross-origin redirect blocked");
              parseTarget(next.href);
              await resolvePublic(next.hostname);
            }
            if (initialRedirect) startDestinations.add(next.href);
          }
          await route.fulfill({ response });
        } else await route.continue();
      } catch {
        restricted("Blocked navigation or request", request.url());
        await route.abort("blockedbyclient");
      }
    });
    await context.routeWebSocket("**/*", (ws) => {
      restricted("Blocked WebSocket", ws.url());
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
      p.setDefaultTimeout(5000);
      p.setDefaultNavigationTimeout(15000);
      p.on("dialog", (d) => d.dismiss());
      p.on("download", (d) => d.cancel());
      p.on("popup", (popup) => {
        restricted("Closed popup", popup.url());
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
      startRequestUrl = new URL(url).href;
      startDestinations.add(startRequestUrl);
      try {
        const response = await page.goto(startRequestUrl, {
          waitUntil: "domcontentloaded",
        });
        if (!response || response.status() >= 400)
          throw new Error(
            `The page could not be loaded (HTTP ${response?.status() || "no response"}).`,
          );
        navigationOrigin = new URL(page.url()).origin;
        await settlePage(page, true);
        return page.url();
      } finally {
        startRequestUrl = undefined;
        startDestinations.clear();
      }
    };
    return { browser, context, page, close, restrictions, navigateStart };
  } catch (error) {
    await browser?.close();
    await proxy.close();
    throw error;
  }
}

export async function state(page) {
  return evaluateStable(page, () => ({
    url: location.href,
    text: (document.body?.innerText || "").slice(0, 14000),
    expanded: [
      ...document.querySelectorAll("[aria-expanded],[open],dialog"),
    ].map((e) => [
      e.id,
      e.getAttribute("aria-expanded"),
      e.hasAttribute("open"),
    ]),
  }));
}
export const stateKey = (s) => JSON.stringify(s);

export async function inspectAt(page, point) {
  return evaluateStable(
    page,
    ({ x, y }) => {
      let e = document.elementFromPoint(x, y);
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
    const box = await page.locator(":focus").boundingBox();
    target = box
      ? await inspectAt(page, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        })
      : null;
    if (
      !target ||
      target.inForm ||
      dangerous.test(`${target.name} ${target.href || ""}`) ||
      !["BUTTON", "A", "SUMMARY"].includes(target.tag)
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
  return {
    action,
    target,
    before,
    after,
    changed: stateKey(before) !== stateKey(after),
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
