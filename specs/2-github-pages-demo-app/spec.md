# Feature Specification: GitHub Pages Demo App

**Feature Branch**: `fabrik/issue-2`
**Created**: 2026-08-22
**Status**: Specified
**Input**: User description: "GitHub Pages demo app — a small Vite + React app in `demo/` that lets anyone see a C4 diagram render without installing the library, deployed to GitHub Pages."

## Background

The project has no way to see a C4 diagram without installing it. A live demo is the single most useful thing for anyone evaluating the library, and it doubles as a working reference for the interactive renderer's controlled-component API. The demo will also be linked from the V3RV homepage, so it is public-facing product surface, not just an internal showcase.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate the library via a live, editable demo (Priority: P1)

A prospective user visits the published demo URL without installing anything, immediately sees a rendered C4 diagram, edits the PlantUML source to see it update live, drags nodes to see the layout diverge from a static PlantUML-server round-trip, and resets back to automatic layout.

**Why this priority**: This is the single most useful artifact for anyone evaluating the library — without it, a visitor has to install the package to see anything at all.

**Independent Test**: Load https://v3rv.com/liminis-diagrams/ with no prior state; confirm a diagram renders immediately, then edit the source, drag a node, toggle dark mode, switch presets, and click reset — each interaction's visible effect can be checked independently of the others.

**Acceptance Scenarios**:

1. **Given** a first-time visitor with no cached state, **When** they load https://v3rv.com/liminis-diagrams/, **Then** a diagram renders on first paint without any interaction.
2. **Given** the demo is loaded with a valid preset, **When** the visitor edits the source textarea, **Then** the diagram re-renders to reflect the new source.
3. **Given** the visitor introduces a syntax error into the source, **When** the diagram would otherwise re-render, **Then** a legible error message is shown (via `C4ErrorDisplay`) in place of the diagram, not a blank pane.
4. **Given** edit mode is on (the default), **When** the visitor drags a node, **Then** the node moves to the new position and its edges re-route to follow it.
5. **Given** one or more nodes have been manually repositioned, **When** the visitor clicks "Reset layout", **Then** all nodes return to their dagre-computed automatic positions.
6. **Given** the diagram is rendered in light mode, **When** the visitor toggles dark mode, **Then** the diagram's own rendering (not just surrounding page chrome) visibly changes.
7. **Given** the preset dropdown, **When** the visitor selects a preset (plain context / nested boundaries / `Db`/`Queue` shapes / external `_Ext` elements), **Then** the corresponding example loads and renders.

---

### Edge Cases

- Rapid typing/edits should not lag, drop keystrokes, or crash the app; a transient invalid-syntax state while typing should resolve to a normal render once the source becomes valid again.
- Resetting layout while a drag is in progress should not leave the diagram in an inconsistent state.
- Switching presets should produce a well-defined outcome for any previously-set manual positions (e.g., each preset starts from its own automatic layout) rather than carrying over unrelated positions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The demo (`demo/`) MUST provide two panes: a textarea holding C4-PlantUML source on the left and the rendered diagram on the right, re-rendering as the user types.
- **FR-002**: The demo MUST have its own `demo/package.json` declaring `@liminis/diagrams` as a registry dependency with a semver range (e.g. `^0.1.0`), importing from `@liminis/diagrams/react` and `@liminis/diagrams/core`. No import anywhere in `demo/` may reach into `../src` or any relative path into the package source — this supersedes the original "import from source" instruction.
- **FR-003**: The demo MUST provide an edit-mode toggle that enables node dragging, on by default, since this is the feature that distinguishes the library from a PlantUML-server round-trip.
- **FR-004**: The demo MUST provide a dark-mode toggle wired to the renderer's `isDarkMode` prop, and toggling it must visibly change the diagram's own rendering, not just surrounding page chrome.
- **FR-005**: The demo MUST provide a "Reset layout" control that clears manual positions, returning the diagram to dagre's automatic layout.
- **FR-006**: Parse errors in the source MUST be shown via `C4ErrorDisplay` (a legible message) rather than a blank pane.
- **FR-007**: The demo MUST offer three or four preset examples selectable from a dropdown, covering: a plain context diagram, nested boundaries, `Db`/`Queue` shapes, and external (`_Ext`) elements.
- **FR-008**: The demo owns the controlled-component state for `C4InteractiveRenderer` (`manualPositions` in, `onPositionChange` out) itself, in memory for the session only. The library does not persist positions; any persistence behavior is the demo's own implementation choice, not a library feature.
- **FR-009**: User-facing copy anywhere in the demo (including any label near the edit-mode toggle) MUST NOT claim or imply that the library saves or persists layout positions. Phrasing such as "your layout is saved" or "positions persist" is prohibited. If the demo's in-memory-only behavior is mentioned, it must be stated plainly (e.g., "this demo keeps positions in memory only").
- **FR-010**: If the demo mentions position persistence elsewhere as a point of contrast (e.g., how `@liminis/editor` writes positions into a code fence's meta string), it must attribute that behavior to the editor's own design, not to this package.
- **FR-011**: Deployment MUST be via `.github/workflows/pages.yml`, triggered on push to `main`, and MUST build the demo from a clean install so that a broken publish breaks the CI build.
- **FR-012**: The Vite config MUST set `base: '/liminis-diagrams/'`.
- **FR-013**: GitHub Pages MUST be configured to deploy from GitHub Actions. Pages is already enabled on the repository with `build_type: workflow`; no repository settings changes are expected beyond adding the workflow file.
- **FR-014**: The deployed demo MUST be reachable at **https://v3rv.com/liminis-diagrams/** — this repository serves Pages through an account-wide custom domain, not `https://verveguy.github.io/liminis-diagrams/`.
- **FR-015**: The demo MUST be excluded from the published npm package (`files: ["dist"]`); confirmed via `npm pack --dry-run` showing no `demo/` files in the tarball.
- **FR-016**: No `pnpm-workspace.yaml` may be added to the repository. `demo/pnpm-lock.yaml` MUST show a registry resolution for `@liminis/diagrams`, not a `link:` entry, confirming a real install rather than workspace linking.
- **FR-017**: `pnpm build`, `pnpm test`, and `pnpm typecheck` MUST still pass at the repo root.

### Key Entities *(if applicable)*

- **Preset example**: A named C4-PlantUML source snippet selectable from the dropdown; each covers one of the required scenarios (plain context, nested boundaries, `Db`/`Queue`, external `_Ext`).
- **Demo position state**: The in-memory `manualPositions` map the demo owns and feeds into `C4InteractiveRenderer`, updated via `onPositionChange` and cleared by "Reset layout".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor to https://v3rv.com/liminis-diagrams/ sees a rendered diagram with no interaction required.
- **SC-002**: Editing the source pane re-renders the diagram; introducing a syntax error displays a legible error message instead of a blank pane.
- **SC-003**: Dragging a node in edit mode moves it and visibly re-routes its connected edges.
- **SC-004**: Activating "Reset layout" returns all nodes to their automatic (dagre) positions.
- **SC-005**: Toggling dark mode visibly changes the diagram's rendering, not only the surrounding page chrome.
- **SC-006**: `npm pack --dry-run` on the root package shows zero files under `demo/` in the tarball.
- **SC-007**: `demo/pnpm-lock.yaml` records a registry resolution (not `link:`) for `@liminis/diagrams`.
- **SC-008**: The Pages workflow build fails if the published package's entry points fail to resolve, since the demo installs `@liminis/diagrams` from the registry on every build.

## Assumptions

- This issue is blocked by #3 (publish `@liminis/diagrams` 0.1.0 to npm) and cannot start until the package is actually on the registry; the dependency chain is #1 → #3 → #2.
- The account-wide custom domain `v3rv.com` already has a valid certificate covering all project pages (verified: `https://v3rv.com/liminis-editor/` and `https://v3rv.com/liminis-context-graph/` return 200; `https://v3rv.com/liminis-diagrams/` currently 404, expected until this demo is deployed).
- The renderer is inline-styled and needs no stylesheet from this package; the four `*-layer` class names it emits are group selectors only, not styling hooks the demo needs to fill in.
- The demo intentionally lags `src/`: a change to `src/` is invisible to the demo until a release, and each release needs a version bump in `demo/package.json`. This is an accepted trade-off of consuming the registry package rather than the workspace source.
- `verveguy/liminis-editor`'s `examples/external-consumer/` fixture (driven by `scripts/verify-package.mjs`, installing the packed tarball with `--ignore-workspace`) is the precedent this demo's registry-consumption approach follows, one step further, by consuming the published registry artifact rather than a local pack.

## Out of Scope *(optional)*

- Server-side rendering, persistence, sharing/permalinks, URL-encoded diagram state.
- Any change to `src/` beyond what is strictly needed to support the demo — if the demo reveals an API gap, note it in a comment rather than redesigning the API here. (Note: since the demo now consumes the published package rather than `../src`, this mainly applies to gaps discovered against the published package's public API.)
- Styling beyond what makes it legible; this is a demo, not a product.
- Adding a `pnpm-workspace.yaml` to the repository, or resolving `@liminis/diagrams` via a local symlink instead of a registry install.

## Source References *(optional)*

- `verveguy/liminis-editor` `examples/external-consumer/` and `scripts/verify-package.mjs` — precedent for verifying a package installs correctly from a packed/published artifact rather than a workspace link.
