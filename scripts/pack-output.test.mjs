import { describe, it, expect } from 'vitest';
import { parsePackOutput } from './pack-output.mjs';

/**
 * Fixtures pinning the real `npm pack --json` shapes.
 *
 * These exist because this function failed v0.1.1's first release attempt, and
 * because verifying it by *running* npm only proves whatever npm the machine
 * happens to have. The shapes below were captured from actual npm binaries
 * (10.8.2 and 11.5.1 emit the array form; 12.0.2 emits the keyed form), so a
 * future change to any of them fails here deterministically rather than live,
 * during a release, after a tag has been cut.
 */

const FILES = [
  { path: 'LICENSE', size: 1067, mode: 420 },
  { path: 'dist/core.js', size: 900, mode: 420 },
];

/** npm 10.8.2 and 11.5.1 */
const ARRAY_SHAPE = JSON.stringify([
  { id: '@liminis/diagrams@0.1.1', name: '@liminis/diagrams', files: FILES, unpackedSize: 148036 },
]);

/** npm 12.0.2 */
const KEYED_SHAPE = JSON.stringify({
  '@liminis/diagrams': {
    id: '@liminis/diagrams@0.1.1',
    name: '@liminis/diagrams',
    files: FILES,
    unpackedSize: 148036,
  },
});

/** Defensive: a future major that drops the wrapper entirely. */
const BARE_SHAPE = JSON.stringify({ name: '@liminis/diagrams', files: FILES });

describe('parsePackOutput', () => {
  it('reads the npm 10 / 11 top-level array shape', () => {
    expect(parsePackOutput(ARRAY_SHAPE).files.map((f) => f.path)).toEqual([
      'LICENSE',
      'dist/core.js',
    ]);
  });

  it('reads the npm 12 package-keyed shape', () => {
    // The shape that broke the v0.1.1 release.
    expect(parsePackOutput(KEYED_SHAPE).files.map((f) => f.path)).toEqual([
      'LICENSE',
      'dist/core.js',
    ]);
  });

  it('reads an unwrapped object', () => {
    expect(parsePackOutput(BARE_SHAPE).files).toHaveLength(2);
  });

  it('skips a warning preamble that itself contains a bracket', () => {
    // The naive "first [ or { begins the JSON" heuristic slices mid-preamble
    // here and hands JSON.parse a fragment.
    const raw = `npm warn EBADENGINE Unsupported engine { package: 'x' }\n${ARRAY_SHAPE}`;
    expect(parsePackOutput(raw).files).toHaveLength(2);
  });

  it('skips ANSI escape sequences, which contain a bracket by construction', () => {
    const raw = `\x1b[33mnpm notice packing\x1b[0m\n${KEYED_SHAPE}`;
    expect(parsePackOutput(raw).files).toHaveLength(2);
  });

  it('names the npm version when there is no JSON at all', () => {
    expect(() => parsePackOutput('command not found', '12.0.2')).toThrow(/npm 12\.0\.2/);
  });

  it('names the npm version when the shape is unrecognised', () => {
    expect(() => parsePackOutput(JSON.stringify({ nope: true }), '13.0.0')).toThrow(
      /npm 13\.0\.0/,
    );
  });

  it('includes the returned keys in the unrecognised-shape error', () => {
    expect(() => parsePackOutput(JSON.stringify({ alpha: 1, beta: 2 }))).toThrow(/alpha, beta/);
  });

  it('refuses to guess when several entries look like tarballs', () => {
    // Ambiguous rather than merely unknown — guessing would silently verify the
    // wrong package.
    const two = JSON.stringify({ a: { files: FILES }, b: { files: FILES } });
    expect(() => parsePackOutput(two, '12.0.2')).toThrow(/2 tarball entries/);
  });

  it('does not treat a values entry lacking files as a tarball', () => {
    const raw = JSON.stringify({ meta: { note: 'no files here' } });
    expect(() => parsePackOutput(raw)).toThrow(/unrecognised shape/);
  });
});
