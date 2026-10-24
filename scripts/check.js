import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
for (const dir of ["src", "public", "scripts", "tests"])
  for (const f of await readdir(dir, { recursive: true }))
    if (f.endsWith(".js"))
      execFileSync(process.execPath, ["--check", path.join(dir, f)], {
        stdio: "inherit",
      });
let links = 0;
for (const file of [
  "README.md",
  "AGENTS.md",
  ...(await readdir("docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
]) {
  const text = await readFile(file, "utf8");
  if ((text.match(/^```/gm) || []).length % 2)
    throw new Error(`Unbalanced fences: ${file}`);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^https?:/.test(target)) continue;
    await readFile(path.resolve(path.dirname(file), target));
    links++;
  }
}
console.log(`JavaScript syntax and ${links} local Markdown links checked.`);
