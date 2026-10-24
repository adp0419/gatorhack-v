// Shared read/write of the fixture variant (broken | fixed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const variantFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.variant');

export const VARIANTS = ['broken', 'fixed'];

export function getVariant() {
  try {
    return fs.readFileSync(variantFile, 'utf8').trim() === 'fixed' ? 'fixed' : 'broken';
  } catch {
    return 'broken';
  }
}

export function setVariant(value) {
  if (!VARIANTS.includes(value)) throw new Error(`variant must be one of ${VARIANTS.join(', ')}`);
  fs.writeFileSync(variantFile, `${value}\n`);
  return value;
}
