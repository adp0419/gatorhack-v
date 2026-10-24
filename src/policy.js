import dns from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import ipaddr from "ipaddr.js";

export function isPublicAddress(address) {
  try {
    const parsed = ipaddr.process(address.replace(/^\[|\]$/g, ""));
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function parseTarget(input) {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error(
      "Use a public HTTP(S) URL on a standard port, without credentials.",
    );
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local")
  )
    throw new Error("Private targets are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host))
    throw new Error("Private addresses are not allowed.");
  return url;
}
export async function resolvePublic(hostname, lookup = dns.lookup) {
  const host = hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(
      "The website address could not be resolved. Check the URL and try again.",
    );
  }
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error(
      "Destination resolved to a private or unsupported address.",
    );
  return addresses[0];
}
export const fixturePath = (path) =>
  /^\/fixtures\/(broken|fixed|negative)\/?$/.test(path);
export async function validateStart(
  input,
  {
    allowedOrigins = [],
    fixtureOrigin,
    publicTargets = false,
    lookup = dns.lookup,
  },
) {
  const candidate = new URL(input);
  if (
    candidate.origin === fixtureOrigin &&
    fixturePath(candidate.pathname) &&
    !candidate.search &&
    !candidate.username &&
    !candidate.password
  )
    return candidate;
  const url = parseTarget(input);
  if (!publicTargets && !allowedOrigins.includes(url.origin))
    throw new Error("This build audits configured demo origins only.");
  await resolvePublic(url.hostname, lookup);
  return url;
}

// Chromium uses this proxy for all network access. Connections are made to the
// validated IP, never a second hostname lookup. Context routing adds origin and
// method restrictions; this boundary also covers subresources and redirects.
export async function createNetworkProxy(fixtureOrigin) {
  const fixture = fixtureOrigin ? new URL(fixtureOrigin) : null;
  const sockets = new Set();
  const track = (socket) => {
    if (!sockets.has(socket)) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    }
    return socket;
  };
  async function destination(host, port) {
    if (
      fixture &&
      host === fixture.hostname &&
      Number(port) === Number(fixture.port)
    )
      return { address: fixture.hostname, family: 4 };
    if (![80, 443].includes(Number(port))) throw new Error("Blocked port");
    return resolvePublic(host);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url);
      if (url.protocol !== "http:" || url.username || url.password)
        throw new Error("Blocked protocol");
      if (
        fixture &&
        url.origin === fixture.origin &&
        !fixturePath(url.pathname)
      )
        throw new Error("Blocked local path");
      const address = await destination(url.hostname, Number(url.port || 80));
      const headers = { ...req.headers, host: url.host };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = http.request(
        {
          hostname: address.address,
          family: address.family,
          port: url.port || 80,
          path: url.pathname + url.search,
          method: req.method,
          headers,
          timeout: 15000,
        },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("socket", track);
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      upstream.on("timeout", () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      res.writeHead(403);
      res.end("Blocked by audit network policy");
    }
  });
  server.on("connection", track);
  server.on("connect", async (req, client, head) => {
    try {
      const target = new URL(`https://${req.url}`);
      if (
        target.username ||
        target.password ||
        (target.port && !["80", "443", fixture?.port].includes(target.port))
      )
        throw new Error("Blocked tunnel");
      const port = Number(target.port || 443);
      const address = await destination(target.hostname, port);
      const remote = track(
        net.connect(
          { host: address.address, port, family: address.family },
          () => {
            client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            if (head.length) remote.write(head);
            remote.pipe(client);
            client.pipe(remote);
          },
        ),
      );
      remote.setTimeout(30_000, () => remote.destroy());
      remote.on("error", () => client.destroy());
      client.on("error", () => remote.destroy());
      client.on("close", () => remote.destroy());
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}

const allowedKeys = {
  tab: "Tab",
  "shift+tab": "Shift+Tab",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  space: "Space",
  arrowdown: "ArrowDown",
  arrowup: "ArrowUp",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  home: "Home",
  end: "End",
};
export function validateAction(action, viewport) {
  if (
    !action ||
    typeof action !== "object" ||
    ![
      "click",
      "double_click",
      "type",
      "key",
      "scroll",
      "wait",
      "done",
      "fail",
    ].includes(action.type) ||
    typeof action.reason !== "string" ||
    typeof action.commits !== "boolean"
  )
    throw new Error("Malformed or unsupported action");
  if (action.commits)
    throw new Error("Committing actions are outside this audit");
  const output = { ...action };
  if (["click", "double_click", "scroll"].includes(action.type)) {
    if (
      ![action.x, action.y].every(
        (n) => Number.isFinite(n) && n >= 0 && n <= 1000,
      )
    )
      throw new Error("Invalid normalized coordinates");
    output.css = {
      x: Math.min(
        viewport.width - 1,
        Math.floor((action.x * viewport.width) / 1000),
      ),
      y: Math.min(
        viewport.height - 1,
        Math.floor((action.y * viewport.height) / 1000),
      ),
    };
  }
  if (action.type === "key") {
    output.key = allowedKeys[String(action.keys).toLowerCase()];
    if (!output.key) throw new Error("Unsupported or browser-level key");
  }
  if (
    action.type === "type" &&
    (typeof action.text !== "string" ||
      action.text.length > 200 ||
      /[\r\n\t]/.test(action.text))
  )
    throw new Error("Unsafe typing action");
  if (
    action.type === "scroll" &&
    (!["up", "down", "left", "right"].includes(action.direction) ||
      !Number.isFinite(action.amount) ||
      action.amount < 1 ||
      action.amount > 20)
  )
    throw new Error("Invalid scroll");
  if (
    action.type === "wait" &&
    (!Number.isFinite(action.seconds) ||
      action.seconds < 0.2 ||
      action.seconds > 10)
  )
    throw new Error("Invalid wait");
  return output;
}
