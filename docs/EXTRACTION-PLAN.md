# Extracting the C4 subsystem from `liminis-editor`

**Status:** proposal, not yet executed
**Date:** 2026-08-22
**Decisions taken:** new repo as source of truth (editor becomes a consumer); two packages (core + react).
**Baseline read:** `liminis-editor` @ `origin/main` = `be88da1` (0.3.0). `git diff HEAD origin/main -- src/app/editor/c4` is empty — the subsystem is unchanged across the 13 commits the local checkout was behind, so this plan is written against current code.

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

## 2. Target shape

Two packages in one repo (`liminis-diagrams`), pnpm workspace:

```
liminis-diagrams/
  packages/
    c4-core/     @liminis/c4-core   — no React, no DOM
    c4-react/    @liminis/c4-react  — renderer + interaction
```

### `@liminis/c4-core`

| From | Lines | Notes |
|---|---|---|
| `c4/types.ts` | 254 | model, layout types, type guards, `ManualLayout` |
| `c4/parser.ts` | 480 | C4-PlantUML macro parser, `parseC4` / `validateC4` |
| `c4/layout.ts` | 1066 | `layoutC4Diagram`, dagre + manual-position override |
| `c4/edge-clipping.ts` | 167 | `estimateLabelSize`, `buildClippedEdgePaths` |
| `c4/parser.test.ts`, `layout.test.ts` | 1092 | move as-is |

Only runtime dependency: `@dagrejs/dagre`. Runs in Node, a worker, or CI with nothing
else installed. **This is the package the wiki tooling is built on.**

### `@liminis/c4-react`

| From | Lines | Notes |
|---|---|---|
| `c4/renderer.tsx` | 1144 | `C4Renderer`, `C4RendererContent`, `C4ErrorDisplay`, `computeLegendInfo` |
| `c4/C4InteractiveRenderer.tsx` | 485 | drag-enabled controlled wrapper |
| `c4/hooks/useC4DiagramDrag.ts` | 168 | window-level listeners, `getScreenCTM` |
| `c4/render-to-string.ts` | 47 | see wrinkle below |
| `c4/renderer.test.tsx`, `integration.test.ts` | 819 | integration test loses its markdown imports — see §5 |
| *(candidate)* `nodes/DiagramContextMenu.tsx` | 212 | already Lexical-free; only imports React + `diagram-context-menu` |

Peers: `react`, `react-dom`. Depends on `@liminis/c4-core`.

### The `render-to-string` wrinkle

`renderC4DiagramToSVG()` is *DOM*-free but not *React*-free — it does
`renderToStaticMarkup(createElement(C4Renderer, …))`. So it cannot sit in `c4-core`
as written, even though headless consumers (CI rendering SVGs for a git wiki) want
exactly it.

**Recommendation:** ship it from `@liminis/c4-react/server`. `react` +
`react-dom` in a Node CLI is a ~1 MB install, not a real cost, and the alternative
duplicates 1,144 lines of SVG emission.

**Deferred option, worth writing down:** a React-free SVG serializer in `c4-core`
that walks `LayoutResult` directly. That would make `c4-core` the complete
parse→layout→SVG path with dagre as its only dependency, which is the right shape
for a git-backed wiki that renders on commit. It is new work and a second
implementation to keep in sync with `renderer.tsx`; don't do it during the
extraction.

---

## 3. Move mechanics

Preserve history — the layout engine in particular has non-obvious commits behind it.

```bash
git clone <liminis-editor> /tmp/c4-extract && cd /tmp/c4-extract
git filter-repo --path src/app/editor/c4/ --path-rename src/app/editor/c4/:packages/
# then split packages/ into c4-core/src and c4-react/src by hand in one commit
```

Then in `liminis-diagrams`: `git init`, pull the filtered history in as the root, and
add the workspace scaffolding on top. Result: `git log --follow packages/c4-core/src/layout.ts`
reaches back into the editor's history.

Import rewrites needed after the move (small, mechanical):

- `c4-react` files: `./types` `./layout` `./parser` → `@liminis/c4-core`
- `./renderer`, `./C4InteractiveRenderer`, `./hooks/…`, `./edge-clipping` → unchanged within their package
- `layout.ts:1066` re-exports layout types; keep that re-export so consumers have one import site

Tooling to mirror from the editor (it is already correct, don't reinvent):
`tsc -p tsconfig.build.json` + `tsc-alias`, vitest with `happy-dom` for the react
package and node env for core, the eslint flat config, and
`scripts/guard-publish.mjs` (the `LIMINIS_ALLOW_PUBLISH=1` guard) — publishing
should stay deliberate here for the same reason it is there.

`engines: node >= 22`, `packageManager: pnpm@10.33.0`, `type: module` — match the editor.

---

## 4. Editor-side change (a second PR, after `@liminis/c4-*` publishes)

1. Delete `src/app/editor/c4/`.
2. Add deps `@liminis/c4-core`, `@liminis/c4-react`.
3. Rewrite five import sites: `nodes/C4Component.tsx`, `nodes/C4Node.tsx`,
   `mapper/mdastToLexical.ts`, `index.ts`, `headless.ts`.
4. `headless.ts` keeps its exact export list — it becomes a re-export of the packages
   rather than of local files, so **`@liminis/editor`'s public API does not change**.
   No major bump needed on that account.
5. Move the four `*-layer` class rules out of `styles.css` into `c4-react`, or keep
   them in the editor and document that `c4-react` consumers must supply them. Prefer
   moving: a standalone consumer shouldn't need the editor's stylesheet.

**Local dev:** `pnpm link` / a workspace override in `liminis-project.code-workspace`
so editor work against unreleased C4 changes doesn't require a publish round-trip.
This is the one real cost of the "editor consumes it" decision; set it up on day one
or the seam will be painful within a week.

**Ordering constraint:** do not delete from the editor until `@liminis/c4-*` has a
published version the editor can resolve. Until then the extraction is additive and
risk-free.

---

## 5. Tests

- `parser.test.ts` (509), `layout.test.ts` (583) → `c4-core`, unchanged.
- `renderer.test.tsx` (546) → `c4-react`, unchanged (`@testing-library/react` + happy-dom).
- `integration.test.ts` (273) is the only casualty: it imports `markdown/parse` and
  `markdown/stringify` to prove the fence round-trips. **Split it.** The half that
  asserts parse→layout→render stays in `c4-react`; the half that asserts markdown
  round-tripping is an *editor* concern and should be left in `liminis-editor` as a
  test against the new package dependency. Do not delete it — it is the only thing
  currently guarding the `@layout` meta contract end to end.

---

## 6. What the extraction does *not* give you

Worth being explicit, because these are the actual work of the wiki suite and none of
them come for free:

**a. No editing affordance.** `C4Component.tsx` owns the textarea overlay,
click-to-edit, the layout-mode toolbar, `RotateCcw` reset, and dark-mode detection —
all Lexical-bound, all staying behind. `c4-react` gives you *render* and *drag*. A
standalone tool needs its own "edit the source text" surface.

**b. Element IDs are fence-local.** `C4Element.id` is unique within one diagram and
means nothing across two. Linked diagrams need a stable cross-file identity —
whether that's `file#id`, a frontmatter-declared namespace, or a URN — and that
decision belongs to the wiki layer, not to `c4-core`. It probably wants a new
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

| # | Step | Blocks on |
|---|---|---|
| 1 | Scaffold `liminis-diagrams` workspace, mirror editor tooling | — |
| 2 | `filter-repo` move, split into two packages, fix imports, green tests | 1 |
| 3 | Decide the `styles.css` layer-class question | 2 |
| 4 | Publish `0.1.0` of both packages (guarded) | 2 |
| 5 | Editor PR: delete local copy, consume packages, split `integration.test.ts` | 4 |
| 6 | Wiki layer design — §6b/6c/6d | 2 (not 5) |

Steps 1–4 are mechanical and low-risk. Step 5 is the only one that can regress a
shipping product. Step 6 is the real design work and can start as soon as the
packages exist.

---

## 8. Open questions

1. **Repo name vs package names.** Repo is `liminis-diagrams` (plural, generic) but
   the packages are `@liminis/c4-*`. If the suite is ever to host non-C4 notations,
   the repo name is right and the package names are right. If it is C4-only forever,
   consider `liminis-c4`. Naming now is cheaper than renaming later.
2. **Does the mermaid path come too?** The editor also carries `mermaid` for other
   diagram fences. Out of scope here, but a "diagram wiki" will be asked for it.
3. **Is `DiagramContextMenu` in scope?** It is Lexical-free and useful (copy-to-clipboard),
   but it also pulls `lucide-react`. Recommend: move it, accept the icon dep in
   `c4-react`, since a standalone tool wants a context menu anyway.
4. **License.** Editor is MIT. Assume the same unless you intend otherwise.
