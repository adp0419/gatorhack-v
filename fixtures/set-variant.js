// Switch the fixture between its broken and fixed variants (same URLs).
import { setVariant, VARIANTS } from './variant.js';

const value = process.argv[2];
if (!VARIANTS.includes(value)) {
  console.error('Usage: node fixtures/set-variant.js broken|fixed');
  process.exit(1);
}
setVariant(value);
console.log(`Fixture variant set to "${value}". Reload the fixture site to see it.`);
