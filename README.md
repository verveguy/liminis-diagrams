# @liminis/diagrams

C4 architecture diagrams: parse [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML)
macro syntax, lay it out with dagre, render it to SVG — with optional drag-to-position
editing.

Extracted from [`@liminis/editor`](https://github.com/verveguy/liminis-editor), where it
renders ` ```c4 ` fenced code blocks. Nothing here is bound to that editor.

## Install

```bash
npm install @liminis/diagrams
```

`react` and `react-dom` are **optional** peers. Installing the package gets you
`@dagrejs/dagre` and nothing else, so `@liminis/diagrams/core` works in a CLI or CI job
with no React on disk. Install the peers if you use `/react` or `/server` — see
[`docs/architecture.md`](docs/architecture.md) for why the split exists and which entry
point to pick.

## Not sure this package does what you're assuming?

Read [Limitations](docs/README.md#limitations--read-this-first) before you build
against this package. In short: no editing UI, no persistence, element IDs aren't
stable across diagrams, no cross-diagram links.

## Parse and lay out

```ts
import { parseC4, layoutC4Diagram } from '@liminis/diagrams/core';

const { diagram, errors } = parseC4(`
Person(user, "User", "End user")

System_Boundary(app, "My App") {
  Container(fe, "Frontend", "React")
  ContainerDb(db, "Database", "PostgreSQL", "Stores data")
}

Rel(user, fe, "Uses", "HTTPS")
Rel(fe, db, "Reads/writes", "SQL")
`);

if (!diagram) {
  throw new Error(`parse failed: ${JSON.stringify(errors)}`);
}

const layout = layoutC4Diagram(diagram);  // nodes, routed edges, width, height
```

## Render to SVG

```ts
import { renderC4DiagramToSVG } from '@liminis/diagrams/server';

const { svg, errors } = renderC4DiagramToSVG(source, /* isDarkMode */ false);
```

## Render in React, with dragging

`C4InteractiveRenderer` is **controlled**: it takes positions in and calls back with new
ones. Persisting them is the host's job.

```tsx
import { C4InteractiveRenderer } from '@liminis/diagrams/react';

<C4InteractiveRenderer
  diagram={diagram}
  isDarkMode={false}
  isEditMode={true}
  manualPositions={positions}
  onPositionChange={setPositions}
/>
```

Pass `manualPositions` to `layoutC4Diagram` to bypass dagre for the elements you have
positions for. Persisting them is entirely your call — see
[Recipe 3](docs/recipes.md#recipe-3-position-persistence--the-hosts-choice) for a worked
example (including how `@liminis/editor` does it) and why this package itself never
writes them anywhere.

## Supported syntax

`Person`, `System`, `Container`, `Component` and their `_Ext` / `Db` / `Queue` variants,
plus `Deployment_Node`, `Node`, and `InfrastructureNode` variants; boundary macros;
`Rel` (with directional variants) and `BiRel`. See
[`docs/dsl-reference.md`](docs/dsl-reference.md) for the full macro table and exactly
which directives (`@startuml`, `!include`, `SHOW_LEGEND()`, `LAYOUT_*`, …) are applied
versus silently stripped.

## Documentation

Building a tool on top of this package? [`docs/`](docs/README.md) covers the
entry-point boundary, the full DSL reference, the data model, and runnable recipes for
headless rendering, embedding the interactive renderer, and position persistence.

## Provenance

The commit history predates this repository: it was recovered from
`verveguy/liminis` (`liminis-app/src/editor/app/editor/c4/`, later
`packages/editor/src/app/editor/c4/`) and carries development from 2026-03-18 onward.
`git log --follow` works across the move. See `docs/EXTRACTION-PLAN.md`.

## License

MIT
