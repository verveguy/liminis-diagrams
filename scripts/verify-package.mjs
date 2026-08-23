#!/usr/bin/env node
/**
 * Verify the package as a *shipped artifact*, not as a source tree.
 *
 * Every check here exists because something got through the checks we already
 * had. `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` were all
 * green for each of the following:
 *
 *   - **0.1.0's first release attempt failed at the registry** because
 *     `package.json` had no `repository` field. npm matches it against the
 *     GitHub Actions OIDC claim when publishing with `--provenance`, so the
 *     publish was rejected (E422) *after* the release tag had been cut and had
 *     to be deleted again. Nothing in the source tree could have told us.
 *   - **`npm install @liminis/diagrams` silently installed an empty 0.0.0
 *     stub** on Node 20 for the first hour after 0.1.0 shipped. 0.1.0 declares
 *     `engines: node >=22` and the stub declared none, so npm's resolver
 *     preferred the engine-compatible version and said nothing. The tarball was
 *     perfect; the thing people actually typed was broken.
 *
 * The lesson both share: the artifact and the source tree are different things,
 * and only the artifact is what a consumer gets. So this script packs, unpacks,
 * installs and imports rather than reading `src/`.
 *
 * Usage:
 *     pnpm verify:package
 *
 * Exits non-zero on the first failure, with the reason.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const EXPECTED_REPO = 'github.com/verveguy/liminis-diagrams'
const ENTRY_POINTS = ['.', './core', './react', './server']
/** Entries that must work with no React installed. */
const REACT_FREE_ENTRIES = ['.', './core']

let failures = 0
const pass = (msg) => console.log(`  [32mok[0m    ${msg}`)
const fail = (msg, detail) => {
  failures++
  console.log(`  [31mFAIL[0m  ${msg}`)
  if (detail) console.log(`        ${String(detail).split('\n').join('\n        ')}`)
}
const step = (msg) => console.log(`\n[1m${msg}[0m`)

function run(cmd, args, cwd, opts = {}) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

// ---------------------------------------------------------------------------
step('Manifest — the fields the registry checks, not the ones tsc checks')

// The #6 failure. Provenance matches this against the OIDC claim; a missing or
// mismatched value fails at the registry, after the tag exists.
const repoUrl = manifest.repository?.url ?? ''
if (!repoUrl) {
  fail('repository.url is present', 'npm --provenance cannot publish without it (E422)')
} else if (!repoUrl.includes(EXPECTED_REPO)) {
  fail('repository.url points at this repository', `got ${repoUrl}, expected it to contain ${EXPECTED_REPO}`)
} else if (!repoUrl.startsWith('git+https://')) {
  // The SSH form does not match the OIDC claim.
  fail('repository.url uses the git+https:// scheme', `got ${repoUrl}`)
} else {
  pass(`repository.url ${repoUrl}`)
}

// Optional peers are what let ./core install without React. If they ever became
// hard dependencies or lost `optional`, the package's central claim would break
// silently for every consumer.
const peerMeta = manifest.peerDependenciesMeta ?? {}
for (const peer of ['react', 'react-dom']) {
  if (manifest.dependencies?.[peer]) {
    fail(`${peer} is not a hard dependency`, 'it must stay an optional peer or ./core stops being React-free')
  } else if (peerMeta[peer]?.optional !== true) {
    fail(`${peer} is declared an OPTIONAL peer`, `peerDependenciesMeta.${peer}.optional is not true`)
  } else {
    pass(`${peer} is an optional peer`)
  }
}

const runtimeDeps = Object.keys(manifest.dependencies ?? {})
if (runtimeDeps.length === 1 && runtimeDeps[0] === '@dagrejs/dagre') {
  pass('the only runtime dependency is @dagrejs/dagre')
} else {
  fail('runtime dependencies are exactly [@dagrejs/dagre]', `got ${JSON.stringify(runtimeDeps)}`)
}

for (const entry of ENTRY_POINTS) {
  if (manifest.exports?.[entry]) pass(`exports declares ${entry}`)
  else fail(`exports declares ${entry}`, 'entry point missing from the exports map')
}

// ---------------------------------------------------------------------------
step('Tarball — what actually ships')

run('pnpm', ['run', 'build'], ROOT)
const packJson = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], ROOT)
const packed = JSON.parse(packJson)[0]
const files = packed.files.map((f) => f.path)

const leaked = files.filter(
  (f) =>
    f.startsWith('src/') ||
    f.startsWith('specs/') ||
    f.startsWith('demo/') ||
    f.startsWith('docs/') ||
    (f.endsWith('.ts') && !f.endsWith('.d.ts')),
)
if (leaked.length) fail('no source, specs, docs or demo in the tarball', leaked.join('\n'))
else pass(`tarball is ${files.length} files, dist/README/LICENSE/package.json only`)

for (const entry of ENTRY_POINTS) {
  const base = entry === '.' ? 'index' : entry.slice(2)
  for (const ext of ['js', 'd.ts']) {
    const want = `dist/${base}.${ext}`
    if (files.includes(want)) pass(`emitted ${want}`)
    else fail(`emitted ${want}`, 'entry point declared in exports but not present in the tarball')
  }
}

// ---------------------------------------------------------------------------
step('Real install — the tarball, not the source tree')

const tgz = join(ROOT, run('npm', ['pack', '--ignore-scripts'], ROOT).trim())
const scratch = mkdtempSync(join(tmpdir(), 'liminis-diagrams-verify-'))
try {
  writeFileSync(
    join(scratch, 'package.json'),
    JSON.stringify({ name: 'verify-consumer', version: '1.0.0', type: 'module', private: true }),
  )
  // --omit=peer is the point: this consumer has no React on disk at all.
  run('npm', ['install', '--silent', '--omit=peer', tgz], scratch)

  const installed = join(scratch, 'node_modules', '@liminis', 'diagrams')
  if (!existsSync(installed)) {
    fail('the tarball installs', 'package missing from node_modules')
  } else {
    const got = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version
    if (got === manifest.version) pass(`installs as ${got}`)
    else fail('installed version matches the manifest', `installed ${got}, manifest says ${manifest.version}`)
  }

  const reactOnDisk = ['react', 'react-dom'].filter((p) =>
    existsSync(join(scratch, 'node_modules', p)),
  )
  if (reactOnDisk.length) {
    fail('no React on disk in a peer-omitted install', `found ${reactOnDisk.join(', ')}`)
  } else {
    pass('no react or react-dom on disk')
  }

  // The central claim: these entries must work with React absent. Importing is
  // the only honest proof -- a static import graph check would not catch a
  // transitive require.
  for (const entry of REACT_FREE_ENTRIES) {
    const spec = entry === '.' ? '@liminis/diagrams' : `@liminis/diagrams/${entry.slice(2)}`
    try {
      const out = run(
        'node',
        [
          '--input-type=module',
          '-e',
          `import { parseC4, layoutC4Diagram } from '${spec}';
           const p = parseC4('Person(u,"U")\\nSystem(a,"A")\\nRel(u,a,"Uses")');
           if (p.errors.length) throw new Error('parse errors: ' + JSON.stringify(p.errors));
           const l = layoutC4Diagram(p.diagram);
           if (l.nodes.length !== 2 || l.edges.length !== 1) throw new Error('unexpected layout');
           console.log('ok');`,
        ],
        scratch,
      )
      if (out.includes('ok')) pass(`${spec} parses and lays out with no React installed`)
      else fail(`${spec} works with no React installed`, out)
    } catch (err) {
      fail(`${spec} works with no React installed`, err.stderr || err.message)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
  rmSync(tgz, { force: true })
}

// ---------------------------------------------------------------------------
console.log()
if (failures) {
  console.log(`[31m${failures} check(s) failed.[0m`)
  process.exit(1)
}
console.log('[32mAll package checks passed.[0m')
