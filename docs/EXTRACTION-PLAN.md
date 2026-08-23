# Extracting the C4 subsystem from `liminis-editor`

**Status:** steps 1–3 done (see §7). Package builds, 106 tests green.
**Date:** 2026-08-22
**Decisions taken:** new repo as source of truth (editor becomes a consumer); one package,
`@liminis/diagrams`, with `./core` / `./react` / `./server` subpath exports.
**Baseline:** `liminis-editor` @ `origin/main` = `be88da1` (0.3.0); C4 unchanged there since
`0ac8c67`. History source: `verveguy/liminis` @ `03d789b` (2026-05-24), verified
byte-identical to the editor's copy.

---

## 1. Why this is cheap

The C4 subsystem is already a library that happens to live inside an editor.

**Outbound coupling to the rest of `liminis-editor`: none.** Every non-relative import
under `src/app/editor/c4/` is `@dagrejs/dagre`, `react`, or `react-dom/server`. The two
exceptions are in `integration.test.ts`, which imports `markdown/parse` and
`markdown/stringify` — a round-trip test of the *editor's* pipeline, not of C4.

**No Lexical anywhere in the directory.** No `zustand`, no editor stores, no
`@liminis/editor` types. The interactive renderer is a controlled component:

```ts
{ diagram, isDarkMode, isEditMode, manualPositions, onPositionChange }
```

**CSS coupling is four strings.** `nodes-layer`, `edges-layer`, `boundaries-layer`,
`legend-layer`. Everything else is inline SVG attributes. Of ~2,300 lines of
`styles.css`, 18 lines mention c4.

**Inbound, the editor touches C4 at four points**, all of which stay behind:

| Site | What it does |
|---|---|
| `nodes/C4Node.tsx` (161 L) | Lexical `DecoratorNode` — serialization, `getManualLayout()` |
| `nodes/C4Component.tsx` (476 L) | Lexical glue: textarea overlay, toolbar, dark-mode detection, selection commands |
| `mapper/mdastToLexical.ts` | `isC4PlantUML()` sniffing + `extractC4LayoutFromMeta()` |
| `index.ts` / `headless.ts` | Re-exports |

`headless.ts` already documents and enforces a DOM-free C4 surface, so the boundary
this plan formalises is one the editor has been maintaining by hand already.

---

## 2. Shape (as built)

One package, `@liminis/diagrams`, subpath exports:

| Entry | React | Contents |
|---|---|---|
| `.` | no | re-export of `./core` |
| `./core` | no | `types.ts`, `parser.ts`, `layout.ts`, `edge-clipping.ts` — `@dagrejs/dagre` only |
| `./react` | yes | `renderer.tsx`, `C4InteractiveRenderer.tsx`, `hooks/useC4DiagramDrag.ts` |
| `./server` | yes | `render-to-string.ts` |

`react`/`react-dom` are **optional** peers: `npm i @liminis/diagrams` installs dagre and
nothing else, and `./core` runs with no React on disk. The cost is that misusing `./react`
fails at runtime rather than at install time.

**Why one package and not two.** The whole argument for enforcing the split in the
dependency graph is "a headless CI renderer should install dagre and nothing else" — but
`renderC4DiagramToSVG` is DOM-free and *not* React-free (`renderToStaticMarkup` +
`createElement`), so the only parse→layout→**SVG** path that exists today needs React
however it is packaged. Two packages would sell a guarantee the actual use case cannot
cash in. Optional peers deliver the practical outcome with one version number.

**Verified, not asserted.** `dist/core.js` reaches 5 modules with `@dagrejs/dagre` as its
only bare import. The structure-preserving `tsc` emit (no bundler) is what keeps that
true — no chunker can hoist `react/jsx-runtime` into `core`.

**Deferred: a React-free SVG serializer in `./core`**, walking `LayoutResult` directly.
That would make `./core` the complete parse→SVG path with dagre as its only dependency —
the right shape for a wiki that renders on commit. It is ~1,100 lines of new code and a
second implementation to keep in sync with `renderer.tsx`. Not during the extraction.
If it lands, the honest move is for `./core` to drop its optional peers, **not** a new
package — splitting later would break consumers.

## 3. Move mechanics (done — and the history nearly went missing)

**`liminis-editor` was the wrong source.** Its root commit `472c8ad` (2026-08-03) is an
empty scaffold; the very next commit imports the entire editor tree as new files. It has
no pre-08-03 history *at all* — not for C4, not for anything. `git log --follow` on any
C4 file terminates at that import. This is a fact about `liminis-editor` worth knowing
beyond this extraction.

**`liminis` kept it.** Every reflog entry there is a fast-forward — the repo was never
rewritten. The C4 code lived at `liminis-app/src/editor/app/editor/c4/`, moved to
`packages/editor/src/app/editor/c4/` in the same 2026-08-03 relocation, and was deleted
when liminis switched to consuming `@liminis/editor` from npm.

**Verification before building on it:** the 12 files at the historical tip `03d789b`
(2026-05-24) are byte-identical to `liminis-editor`'s current `origin/main`. The C4 code
has not changed since May, so the recovered history is both complete and current.

What was run:

```bash
git clone --no-local <liminis> c4-history && cd c4-history
git filter-repo \
  --path liminis-app/src/editor/app/editor/c4/ \
  --path packages/editor/src/app/editor/c4/ \
  --path-rename liminis-app/src/editor/app/editor/c4/:src/ \
  --path-rename packages/editor/src/app/editor/c4/:src/
git branch -f extract 35362b2^     # last commit before the delete
```

Result: **101 commits**, 2026-03-18 → 2026-05-24. The restructure into
`core/`/`react/`/`server/` was done with `git mv` so every move recorded as `R100`;
`git log --follow src/core/layout.ts` returns **37 commits back to 2026-03-16**.

Import rewrites were mechanical: `./types`|`./layout`|`./parser`|`./edge-clipping` →
`../core/…` in `react/` and `server/`; `./renderer` → `../react/renderer` in `server/`.

Tooling mirrored from the editor rather than reinvented: `tsc -p tsconfig.build.json` +
`tsc-alias`, vitest + happy-dom, its eslint flat config, and `scripts/guard-publish.mjs`
(the `LIMINIS_ALLOW_PUBLISH=1` guard — publishing stays deliberate here for the same
reason it is there).

### One change to the moved code

`renderer.tsx` and `C4InteractiveRenderer.tsx` now `import type { JSX } from 'react'`.
React 19 removed the global `JSX` namespace; `liminis-editor` papers over that with an
ambient `declare global` shim (`src/ambient/jsx.d.ts`). **A published package cannot do
that** — the shim would either pollute every consumer's global scope or not ship at all,
leaving the emitted `.d.ts` referencing an unresolvable `JSX.Element`. Seventeen call
sites, fixed with two imports.

## 4. Editor-side change (a second PR, after `@liminis/diagrams` publishes)

1. Delete `src/app/editor/c4/`.
2. Add deps `@liminis/diagrams`.
3. Rewrite five import sites: `nodes/C4Component.tsx`, `nodes/C4Node.tsx`,
   `mapper/mdastToLexical.ts`, `index.ts`, `headless.ts`.
4. `headless.ts` keeps its exact export list — it becomes a re-export of the packages
   rather than of local files, so **`@liminis/editor`'s public API does not change**.
   No major bump needed on that account.
5. Move the four `*-layer` class rules out of `styles.css` into `./react`, or keep
   them in the editor and document that `./react` consumers must supply them. Prefer
   moving: a standalone consumer shouldn't need the editor's stylesheet.

**Local dev:** `pnpm link` / a workspace override in `liminis-project.code-workspace`
so editor work against unreleased C4 changes doesn't require a publish round-trip.
This is the one real cost of the "editor consumes it" decision; set it up on day one
or the seam will be painful within a week.

**Ordering constraint:** do not delete from the editor until `@liminis/diagrams` has a
published version the editor can resolve. Until then the extraction is additive and
risk-free.

---

## 5. Tests (done)

106 pass. `parser.test.ts` (45) and `layout.test.ts` (28) moved to `core/` unchanged;
`renderer.test.tsx` (29) moved to `react/` unchanged.

`integration.test.ts` was the only file that straddled the seam — it imported
`markdown/parse` and `markdown/stringify`. It was **split, not dropped**: the portable
parse-and-lay-out half is now `src/core/pipeline.test.ts` (4 tests), rewritten to take
fence *contents* rather than markdown.

> **Editor-side obligation.** The markdown round-trip half (6 tests) and the slash-menu
> test stay in `liminis-editor` and **must not be deleted** during the migration. That
> file is the only end-to-end guard on the `@layout` fence-meta contract; this package
> cannot test it, because it never sees a fence.

## 6. What the extraction does *not* give you

Worth being explicit, because these are the actual work of the wiki suite and none of
them come for free:

**a. No editing affordance.** `C4Component.tsx` owns the textarea overlay,
click-to-edit, the layout-mode toolbar, `RotateCcw` reset, and dark-mode detection —
all Lexical-bound, all staying behind. `./react` gives you *render* and *drag*. A
standalone tool needs its own "edit the source text" surface.

**b. Element IDs are fence-local.** `C4Element.id` is unique within one diagram and
means nothing across two. Linked diagrams need a stable cross-file identity —
whether that's `file#id`, a frontmatter-declared namespace, or a URN — and that
decision belongs to the wiki layer, not to `./core`. It probably wants a new
`resolveRefs`-style pass over multiple parsed diagrams.

**c. No link syntax.** The parser strips `!include` and ignores unknown macros. There
is no `Rel` that crosses files, and no notion of "this container is detailed in
another diagram" — which is precisely the C4 zoom-level relationship a wiki wants.
Adding it means extending the parser (or a sidecar in fence meta / frontmatter).

**d. No document graph, no git layer.** Unsurprising, but it's the bulk of the suite.

The format is already the right substrate: a ```` ```c4 ```` fence holding
C4-PlantUML macros, with manual positions in the fence **meta** as
`@layout {"positions":{…}}`. Plain text, line-diffable, no sidecar files, no binary.
And `liminis-editor` already depends on `micromark-extension-wiki-link`, so
`[[other-diagram]]` has a parser in the family already.

---

## 7. Sequence

| # | Step | Status |
|---|---|---|
| 1 | Scaffold workspace, mirror editor tooling | **done** |
| 2 | Recover history, restructure, fix imports, green tests | **done** — 101 commits, 106 tests |
| 3 | `styles.css` layer-class question | **done** — see below |
| 4 | Create the public GitHub repo, board it on project 5, push | **done** |
| 5 | CI + release workflows | diagrams#1 — **done** |
| 6 | Publish `0.1.0` (guarded) | diagrams#3 — **done**, [v0.1.0](https://github.com/verveguy/liminis-diagrams/releases/tag/v0.1.0) |
| 7 | GitHub Pages demo app | diagrams#2 — blocked by #3 |
| 8 | Editor PR: consume the package, keep the round-trip tests | editor#100 — blocked by #3 |
| 9 | Wiki layer — §6b/6c/6d | not yet filed; can start any time |

Live at https://github.com/verveguy/liminis-diagrams. The demo will serve from
**https://v3rv.com/liminis-diagrams/** — this account's Pages sites are served through an
account-wide custom domain configured on the user site, so project pages are
`v3rv.com/<repo>/`, not `verveguy.github.io/<repo>/`. Each project repo reports
`https_enforced: false` with `cname: null` because the domain is inherited; that flag
governs the http→https *redirect* only, not whether https works. It does — verified 200 on
the sibling repos. Always link the `https://` form.

**The demo builds against the published npm package, not `../src`** (Brett's call). That
is why #2 sits behind #6 rather than running in parallel: it makes the demo a continuous
consumer-integration test, so a broken `exports` map or a mis-specified `files` breaks the
demo build instead of surfacing months later in someone else's project. The cost is that
the demo lags the source by a release. Load-bearing detail: **this repo must not gain a
`pnpm-workspace.yaml`**, or pnpm will resolve `@liminis/diagrams` to local source through a
symlink and the guarantee evaporates silently.

On step 3: the four `*-layer` class names are only ever used as SVG group selectors and
carry no styling this package depends on — the editor's 18 c4 lines in `styles.css` style
the *editor's* wrapper, not the diagram. Nothing needed to move. A consumer needs no
stylesheet; the renderer is inline-styled.

Steps 5–8 are Fabrik work. The board (`verveguy` project 5) is multi-repo — `repo:` is
unset in `.fabrik/config.yaml` — so issues in `liminis-diagrams` and `liminis-editor`
run on the one board. Step 7 **must** carry a `blocked_by` edge to step 6, wired via the
dependencies API *before* the issue reaches Specify: an Implement worker that starts
before `@liminis/diagrams` resolves from npm will fail on install and burn its retries.

## 8. Open questions

1. **Repo name vs package names.** Repo is `liminis-diagrams` (plural, generic) but
   the packages are `@liminis/diagrams`. If the suite is ever to host non-C4 notations,
   the repo name is right and the package names are right. If it is C4-only forever,
   consider `liminis-c4`. Naming now is cheaper than renaming later.
2. **Does the mermaid path come too?** The editor also carries `mermaid` for other
   diagram fences. Out of scope here, but a "diagram wiki" will be asked for it.
3. **Is `DiagramContextMenu` in scope?** It is Lexical-free and useful (copy-to-clipboard),
   but it also pulls `lucide-react`. Recommend: move it, accept the icon dep in
   `./react`, since a standalone tool wants a context menu anyway.
4. **License.** MIT, carried from the editor. Say so if you intend otherwise.
5. **Local dev link.** Not yet set up. Once the editor consumes the package, a workspace
   link is needed or every C4 change becomes a publish round-trip. This is the one real
   ongoing cost of the "editor consumes it" decision.
