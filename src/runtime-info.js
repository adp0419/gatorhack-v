import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function codeFingerprint() {
  const hash = createHash("sha256");
  for (const directory of ["src", "public"]) {
    const visit = (folder) => {
      for (const entry of readdirSync(folder, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name),
      )) {
        const filename = path.join(folder, entry.name);
        if (entry.isDirectory()) visit(filename);
        else if (/\.(js|html|css)$/.test(entry.name)) {
          hash.update(path.relative(root, filename));
          hash.update(readFileSync(filename));
        }
      }
    };
    visit(path.join(root, directory));
  }
  hash.update(readFileSync(path.join(root, "package-lock.json")));
  return hash.digest("hex").slice(0, 12);
}
let revision = "local";
try {
  revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
const startup = Object.freeze({
  instanceId: randomUUID(),
  startedAt: new Date().toISOString(),
  revision,
  fingerprint: codeFingerprint(),
});
export function runtimeInfo() {
  return { ...startup, stale: startup.fingerprint !== codeFingerprint() };
}
