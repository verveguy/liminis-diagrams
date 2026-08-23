#!/usr/bin/env node
/**
 * `render-c4` — render C4-PlantUML source files to SVG on disk.
 *
 * This is the CLI form of `renderC4DiagramToSVG` (`@liminis/diagrams/server`),
 * meant for pre-rendering diagrams in CI so that a plain `![Diagram](x.svg)` in
 * a markdown file is enough for GitHub (or any other markdown renderer) to show
 * it — no live rendering service, no image-provider proxy, nothing to host.
 * See docs/github-integration.md for the recipe this exists for.
 *
 * No dependency is added for argument parsing: flags are hand-rolled to match
 * the style of the other scripts in this repo (guard-publish.mjs,
 * verify-package.mjs), and the surface here is small enough not to need one.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderC4DiagramToSVG } from '../server/render-to-string';

export interface Options {
  files: string[];
  dark: boolean;
  out?: string;
  outDir?: string;
  check: boolean;
  stdin: boolean;
}

function printUsage(): void {
  console.log(`Usage: render-c4 [options] <files...>

Render C4-PlantUML source files to SVG.

Options:
  --dark             Render in dark mode
  -o, --out <file>   Output path (only valid with exactly one input file)
  --out-dir <dir>    Write outputs here, preserving basenames (.svg extension)
  --check            Validate only — write nothing, exit non-zero on any error
  --stdin            Read source from stdin, write SVG to stdout
  -h, --help         Show this help
`);
}

export function parseArgs(argv: string[]): Options | null {
  const options: Options = { files: [], dark: false, check: false, stdin: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        return null;
      case '--dark':
        options.dark = true;
        break;
      case '--check':
        options.check = true;
        break;
      case '--stdin':
        options.stdin = true;
        break;
      case '-o':
      case '--out':
        options.out = argv[++i];
        break;
      case '--out-dir':
        options.outDir = argv[++i];
        break;
      default:
        options.files.push(arg);
    }
  }

  return options;
}

export function outputPathFor(inputPath: string, options: Options): string {
  if (options.out) return options.out;
  const svgName = `${basename(inputPath, extname(inputPath))}.svg`;
  return options.outDir ? join(options.outDir, svgName) : join(dirname(inputPath), svgName);
}

function renderStdin(dark: boolean): void {
  const chunks: Buffer[] = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    const source = Buffer.concat(chunks).toString('utf-8');
    const { svg, errors } = renderC4DiagramToSVG(source, dark);
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`<stdin>:${error.line}:${error.column}: ${error.message}`);
      }
      process.exitCode = 2;
      return;
    }
    process.stdout.write(svg);
  });
}

function renderFiles(options: Options): number {
  if (options.out && options.files.length > 1) {
    console.error('render-c4: -o/--out only applies with a single input file');
    return 1;
  }

  let failures = 0;

  for (const inputPath of options.files) {
    const source = readFileSync(inputPath, 'utf-8');
    const { svg, errors } = renderC4DiagramToSVG(source, options.dark);

    if (errors.length > 0) {
      failures++;
      for (const error of errors) {
        console.error(`${inputPath}:${error.line}:${error.column}: ${error.message}`);
      }
      continue;
    }

    if (options.check) continue;

    const outPath = outputPathFor(inputPath, options);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, svg);
    console.log(`${inputPath} -> ${outPath}`);
  }

  return failures > 0 ? 2 : 0;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (!options || (options.files.length === 0 && !options.stdin)) {
    printUsage();
    process.exitCode = options ? 1 : 0;
    return;
  }

  if (options.stdin) {
    renderStdin(options.dark);
  } else {
    process.exitCode = renderFiles(options);
  }
}

// Only run when executed directly (`node render-c4.js`), not when imported —
// e.g. by the test file below, which exercises `parseArgs`/`outputPathFor` in
// isolation without wanting a real CLI invocation as a side effect of import.
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
