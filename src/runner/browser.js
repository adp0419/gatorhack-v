// Isolated browser contexts with the network and navigation guard applied.
import { chromium } from 'playwright';
import { requestAllowed } from './url-guard.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function launchBrowser() {
  return chromium.launch({ headless: true });
}

// `target` is the validated result of validateTarget(). `log` receives
// guard decisions so the report can list resulting limitations.
export async function newAuditContext(browser, { target, viewport, log = () => {} }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    acceptDownloads: false,
    serviceWorkers: 'block',
    locale: 'en-US',
  });
  const authorized = Boolean(target.authorization);

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!(await requestAllowed(url, target.authorization))) {
      log({ kind: 'network_blocked', url });
      return route.abort('blockedbyclient');
    }
    // Public sites: abort mutating requests; authorized fixtures run their own
    // client-side validation without real submissions.
    if (!authorized && !SAFE_METHODS.has(request.method())) {
      log({ kind: 'mutating_request_aborted', method: request.method(), url });
      return route.abort('blockedbyclient');
    }
    if (request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame()) {
      let origin = null;
      try {
        origin = new URL(url).origin;
      } catch {}
      if (origin !== target.origin) {
        log({ kind: 'navigation_blocked', url });
        return route.abort('blockedbyclient');
      }
    }
    return route.continue();
  });

  context.on('page', async (page) => {
    // Popups and new tabs escape the audit context; close them.
    if (await page.opener()) {
      log({ kind: 'popup_closed', url: page.url() });
      await page.close().catch(() => {});
    }
  });
  return context;
}

export async function settle(page, ms = 500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
