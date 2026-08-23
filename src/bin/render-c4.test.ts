/**
 * Unit tests for the CLI's argument handling. The rendering itself is
 * `renderC4DiagramToSVG`, already covered under `src/core` and
 * `src/server` — these only exercise `parseArgs`/`outputPathFor`/
 * `validateStdinCombination`/`renderFiles`, the logic that's actually
 * specific to this file.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, outputPathFor, validateStdinCombination, renderFiles } from './render-c4';

describe('parseArgs', () => {
  it('collects positional args as files', () => {
    const options = parseArgs(['a.puml', 'b.puml']);
    expect(options).toEqual({ files: ['a.puml', 'b.puml'], fromMarkdown: false, dark: false, check: false, stdin: false });
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
  const base = { files: [], fromMarkdown: false, dark: false, check: false, stdin: false };

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

describe('validateStdinCombination', () => {
  const base = { files: [], fromMarkdown: false, dark: false, check: false, stdin: false };

  it('allows --stdin on its own', () => {
    expect(validateStdinCombination({ ...base, stdin: true })).toBeNull();
  });

  it('rejects --stdin combined with --check, -o/--out, --out-dir, or file arguments', () => {
    expect(validateStdinCombination({ ...base, stdin: true, check: true })).not.toBeNull();
    expect(validateStdinCombination({ ...base, stdin: true, out: 'out.svg' })).not.toBeNull();
    expect(validateStdinCombination({ ...base, stdin: true, outDir: 'dist' })).not.toBeNull();
    expect(validateStdinCombination({ ...base, stdin: true, files: ['a.puml'] })).not.toBeNull();
  });
});

describe('renderFiles', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('reports a missing input file as a per-file failure instead of throwing', () => {
    dir = mkdtempSync(join(tmpdir(), 'render-c4-test-'));
    const missing = join(dir, 'does-not-exist.puml');

    expect(() => renderFiles({ files: [missing], fromMarkdown: false, dark: false, check: false, stdin: false })).not.toThrow();
    expect(renderFiles({ files: [missing], fromMarkdown: false, dark: false, check: false, stdin: false })).toBe(2);
  });

  it('continues past a missing file and still renders the rest of the batch', () => {
    dir = mkdtempSync(join(tmpdir(), 'render-c4-test-'));
    const missing = join(dir, 'does-not-exist.puml');
    const valid = join(dir, 'valid.puml');
    writeFileSync(valid, 'Person(user, "User", "End user")');

    const exitCode = renderFiles({ files: [missing, valid], fromMarkdown: false, dark: false, check: false, stdin: false });

    expect(exitCode).toBe(2); // the missing file still counts as a failure
    const outPath = join(dir, 'valid.svg');
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, 'utf-8')).toContain('<svg');
  });

  it('--check with zero files is a valid, empty batch — not an error', () => {
    expect(renderFiles({ files: [], fromMarkdown: false, dark: false, check: true, stdin: false })).toBe(0);
  });
});
