#!/usr/bin/env node
/**
 * Build the demo and stage it at docs/public/demo, the same place the Pages
 * workflow puts it.
 *
 * The docs site links to /demo/, but the demo is a separate Vite app that
 * nothing in the Astro build knows about — CI builds it and copies it in. That
 * left a fresh checkout with a dead link on the docs homepage: `astro dev`
 * served a 404 for a page that exists in production. Same assembly, one
 * command, so the local site and the deployed one have the same shape:
 *
 *     pnpm demo && pnpm dev
 *
 * The staged copy is gitignored — it is a build output, not a source file.
 */

import { execFileSync } from 'node:child_process'
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS = dirname(dirname(fileURLToPath(import.meta.url)))
const DEMO = join(dirname(DOCS), 'demo')
const TARGET = join(DOCS, 'public/demo')

const run = (...args) => execFileSync('pnpm', args, { cwd: DEMO, stdio: 'inherit' })

if (!existsSync(join(DEMO, 'node_modules'))) run('install', '--frozen-lockfile')
run('build')

rmSync(TARGET, { recursive: true, force: true })
mkdirSync(dirname(TARGET), { recursive: true })
cpSync(join(DEMO, 'dist'), TARGET, { recursive: true })

console.log(`Demo staged at ${TARGET} — it will be served at /liminis-diagrams/demo/`)
