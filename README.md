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
with no React on disk. Install the peers if you use `/react` or `/server`.

## Entry points

| Import | Needs React | What it gives you |
|---|---|---|
| `@liminis/diagrams` | no | re-export of `/core` |
| `@liminis/diagrams/core` | no | `parseC4`, `validateC4`, `layoutC4Diagram`, types |
| `@liminis/diagrams/react` | yes | `C4Renderer`, `C4InteractiveRenderer`, `useC4DiagramDrag` |
| `@liminis/diagrams/server` | yes | `renderC4DiagramToSVG` — source to SVG in one call |

`/server` is DOM-free but not React-free: it drives the renderer through
`react-dom/server`. That is the only reason it is not part of `/core`.

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
positions for. `@liminis/editor` persists them in the code fence's meta string as
`@layout {"positions":{…}}`, which keeps a hand-arranged diagram in plain, diffable text.

## Supported syntax

`Person`, `System`, `Container`, `Component` and their `_Ext` / `Db` / `Queue` variants;
`System_Boundary`, `Container_Boundary`, `Enterprise_Boundary`, `Boundary`; `Rel` (with
directional variants) and `BiRel`. `@startuml`/`@enduml`, `!include`, `SHOW_LEGEND()` and
`LAYOUT_*` directives are recognised and stripped.

## Provenance

The commit history predates this repository: it was recovered from
`verveguy/liminis` (`liminis-app/src/editor/app/editor/c4/`, later
`packages/editor/src/app/editor/c4/`) and carries development from 2026-03-18 onward.
`git log --follow` works across the move. See `docs/EXTRACTION-PLAN.md`.

## License

MIT
