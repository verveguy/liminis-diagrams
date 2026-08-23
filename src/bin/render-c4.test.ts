/**
 * Unit tests for the CLI's argument handling. The rendering itself is
 * `renderC4DiagramToSVG`, already covered under `src/core` and
 * `src/server` — these only exercise `parseArgs`/`outputPathFor`, the logic
 * that's actually specific to this file.
 */
import { describe, it, expect } from 'vitest';
import { parseArgs, outputPathFor } from './render-c4';

describe('parseArgs', () => {
  it('collects positional args as files', () => {
    const options = parseArgs(['a.puml', 'b.puml']);
    expect(options).toEqual({ files: ['a.puml', 'b.puml'], dark: false, check: false, stdin: false });
  });

  it('parses --dark, --check, --stdin as flags', () => {
    const options = parseArgs(['--dark', '--check', '--stdin']);
    expect(options).toMatchObject({ dark: true, check: true, stdin: true });
  });

  it('parses -o/--out and --out-dir with their following value', () => {
    expect(parseArgs(['a.puml', '-o', 'out.svg'])).toMatchObject({ out: 'out.svg' });
    expect(parseArgs(['a.puml', '--out', 'out.svg'])).toMatchObject({ out: 'out.svg' });
    expect(parseArgs(['a.puml', '--out-dir', 'dist'])).toMatchObject({ outDir: 'dist' });
  });

  it('returns null for -h/--help', () => {
    expect(parseArgs(['-h'])).toBeNull();
    expect(parseArgs(['--help'])).toBeNull();
  });
});

describe('outputPathFor', () => {
  const base = { files: [], dark: false, check: false, stdin: false };

  it('replaces the extension with .svg next to the input by default', () => {
    expect(outputPathFor('docs/architecture.puml', base)).toBe('docs/architecture.svg');
  });

  it('honors --out verbatim', () => {
    expect(outputPathFor('docs/architecture.puml', { ...base, out: 'custom.svg' })).toBe('custom.svg');
  });

  it('writes into --out-dir, preserving only the basename', () => {
    expect(outputPathFor('docs/architecture.puml', { ...base, outDir: 'rendered' })).toBe(
      'rendered/architecture.svg',
    );
  });
});
