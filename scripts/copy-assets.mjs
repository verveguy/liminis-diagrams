#!/usr/bin/env node
/**
 * Copy non-TypeScript assets into dist/.
 *
 * `tsc` emits only what it compiles, so a stylesheet sitting beside a component
 * is invisible to the build and simply would not ship — the export map would
 * point at a file that never existed, and the failure would appear as a
 * bare-looking playground in someone else's site rather than as a build error
 * here. verify-package.mjs asserts the result is in the tarball.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** [from, to], both relative to the package root. */
const ASSETS = [['src/playground/playground.css', 'dist/playground/playground.css']];

for (const [from, to] of ASSETS) {
  const target = join(ROOT, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(ROOT, from), target);
  console.log(`${from} -> ${to}`);
}
