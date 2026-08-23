#!/usr/bin/env node
/**
 * Render every ```c4 fence in the docs to an SVG, and keep an <img> beside the
 * fence pointing at it.
 *
 * This is the GitHub half of the single-source-of-truth idea. On the docs site a
 * remark plugin swaps the fence for a live island and strips the <img>; on
 * github.com there is no build step, so the committed SVG is what a reader sees.
 * Same file, two renderings, one source.
 *
 * The rendering is done by `@liminis/diagrams/server` — the package's own
 * published entry point. Two things follow from that which are worth having:
 * the docs build exercises `/server` on every commit, which nothing else in CI
 * does, and the images cannot drift from what the library actually produces,
 * because they are produced by it.
 *
 *     node scripts/render-diagrams.mjs           write SVGs and update <img> tags
 *     node scripts/render-diagrams.mjs --check   fail if anything is out of date
 *
 * `--check` is what CI runs: a committed SVG that no longer matches its fence is
 * a stale picture on GitHub, and stale documentation is worse than none.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderC4DiagramToSVG } from '@liminis/diagrams/server'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DOCS = join(ROOT, 'src/content/docs')
const OUT_DIR = join(DOCS, 'diagrams')
const OUT_REL = './diagrams'

const CHECK = process.argv.includes('--check')

// The <img> is identified by its src rather than by a marker comment. MDX does
// not permit HTML comments at all -- `<!-- … -->` is a syntax error there, which
// is how the first attempt broke the site. A self-closing <img /> is valid in
// both MDX and GitHub-flavoured markdown, so it needs no marker.
const IMG = new RegExp(`\\n?<img src="${OUT_REL}/[^"]+"[^>]*/>`, 'g')

/** ```c4 [meta]\n …source… \n``` */
const FENCE = /^```c4([^\n]*)\n([\s\S]*?)\n```$/gm

let wrote = 0
let stale = []

const pages = readdirSync(DOCS).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
const expected = new Set()

for (const page of pages) {
  const path = join(DOCS, page)
  const original = readFileSync(path, 'utf8')

  // Start from a copy with any previously generated blocks removed, so the
  // markers never accumulate and the diff is stable across runs.
  const cleaned = original.replace(IMG, '')

  let index = 0
  let out = ''
  let last = 0

  for (const match of cleaned.matchAll(FENCE)) {
    index += 1
    const source = match[2]
    const meta = match[1] || ''

    // Some fences are invalid on purpose — a page documenting parse errors needs
    // one. Marked with `invalid`, they are skipped rather than failing the run,
    // and get no image, since there is nothing to render.
    if (/\binvalid\b/.test(meta)) continue
    const name = `${basename(page).replace(/\.mdx?$/, '')}-${index}.svg`
    expected.add(name)

    const { svg, errors } = renderC4DiagramToSVG(source, false)
    if (errors.length) {
      console.error(`FAILED  ${page} diagram ${index}: ${errors.map((e) => e.message).join('; ')}`)
      process.exitCode = 1
      continue
    }

    const target = join(OUT_DIR, name)
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null
    if (current !== svg) {
      if (CHECK) stale.push(`${OUT_REL}/${name}`)
      else {
        mkdirSync(OUT_DIR, { recursive: true })
        writeFileSync(target, svg)
        wrote += 1
      }
    }

    // The <img> goes immediately after the fence. GitHub shows both: the source
    // and the picture. Alt text names the page rather than describing the
    // diagram, because a generated description would be worse than none.
    const end = match.index + match[0].length
    out += cleaned.slice(last, end)
    out += `\n<img src="${OUT_REL}/${name}" alt="Diagram ${index} from ${page}" />`
    last = end
  }
  out += cleaned.slice(last)

  if (out !== original) {
    if (CHECK) stale.push(page)
    else {
      writeFileSync(path, out)
      wrote += 1
    }
  }
}

// Remove SVGs whose fence is gone, so deleting a diagram does not leave an
// orphan committed forever.
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.svg') && !expected.has(f)) {
      if (CHECK) stale.push(`${OUT_REL}/${f} (orphaned)`)
      else {
        rmSync(join(OUT_DIR, f))
        wrote += 1
      }
    }
  }
}

if (CHECK) {
  if (stale.length) {
    console.error('Diagrams are out of date. Run `pnpm diagrams` and commit the result:')
    for (const s of stale) console.error(`  ${s}`)
    process.exit(1)
  }
  console.log(`All ${expected.size} diagram(s) up to date.`)
} else {
  console.log(`${expected.size} diagram(s); ${wrote} file(s) written.`)
}
