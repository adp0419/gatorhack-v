// Switch the fixture between its broken and fixed variants (same URLs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const value = process.argv[2];
if (!['broken', 'fixed'].includes(value)) {
  console.error('Usage: node fixtures/set-variant.js broken|fixed');
  process.exit(1);
}
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.variant'), `${value}\n`);
console.log(`Fixture variant set to "${value}". Reload the fixture site to see it.`);
