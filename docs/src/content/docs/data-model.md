---
title: "Data model"
description: "What a parsed diagram and a layout result actually contain."
---

This is the centerpiece of this documentation: the shapes a tool builder actually
writes code against. Everything here is exported from `@liminis/diagrams/core`
(re-exported from `@liminis/diagrams`). Source of truth: `src/core/types.ts`.

## Pipeline shape

```
source string --[parseC4]--> C4Diagram --[layoutC4Diagram]--> LayoutResult
```

`parseC4` never lays anything out — a `C4Diagram` has no coordinates. `layoutC4Diagram`
never re-parses — it only positions what it's given. The two steps are independent; you
can call `layoutC4Diagram` repeatedly (e.g., on every drag) against the same
`C4Diagram` without re-parsing.

## `C4Diagram`

```ts
interface C4Diagram {
  elements: C4Element[];        // flat list — every element, nesting via .parent
  relationships: C4Relationship[];
  direction?: C4Direction;      // 'down' | 'right' | 'up' | 'left', from LAYOUT_* — see dsl-reference.md
}
```

`elements` is **flat**, not a tree — every element parsed anywhere in the source,
top-level or nested, is in this one array. Nesting is represented separately (next
section). This means "all elements" is just `diagram.elements`; you don't need to walk a
tree to enumerate them.

## `C4Element`

```ts
interface C4Element {
  type: C4ElementType;      // 'system' | 'container' | 'component' | 'person'
  id: string;                // from the macro's alias argument — unique within THIS diagram only
  name: string;               // from the macro's "label" argument
  properties: C4Properties;
  children: C4Element[];      // derived convenience view, see below
  parent?: string;            // the PRIMITIVE: this element's parent id, if nested
}

interface C4Properties {
  tech?: string;
  description?: string;
  external?: boolean;         // true for _Ext macros
  shape?: C4Shape;             // 'rectangle' | 'cylinder' | 'queue'
  direction?: C4Direction;     // layout direction for this element's own children
  style?: C4Style;             // 'boundary' — set on boundary/deployment-node macros
}
```

### How nesting is represented: `parent` is the primitive, `children` is derived

`parent` is a string reference to another element's `id` (or `undefined` for a
top-level element) — it's set once, while parsing, and it's the actual source of truth
for "what contains what." `children` is populated by the parser as a convenience: after
parsing everything inside a boundary's `{ ... }`, the parser scans the elements it just
parsed and copies every one whose `.parent` equals this element's `id` into
`this.children`. The two are redundant views of the same relationship — `children` exists
so consumers don't have to reconstruct the tree themselves by scanning the flat
`elements` array and matching on `parent`, but if you're ever unsure which one to trust,
`parent` is the one the parser actually assigns first.

Because `elements` is flat, a nested element like a `Container` inside a
`System_Boundary` appears **twice** in `diagram.elements` in one sense — once as itself
with `parent` set, and again inside its parent's `.children` array (same object
reference, not a copy). It does not appear twice in the flat array itself; `elements`
has exactly one entry per parsed macro. `LayoutResult.nodes` (below), by contrast, is
flattened by the layout step and does list every node exactly once as a top-level array
entry, in addition to nesting them under `.children`.

## `C4Relationship`

```ts
interface C4Relationship {
  sourceId: string;   // C4Element.id this relationship starts from
  targetId: string;   // C4Element.id this relationship points to
  label: string;       // "label" or "label [technology]" if a technology arg was given
}
```

Flat, unordered, no nesting concept — a `Rel` always connects two element IDs regardless
of how deeply either is nested.

## `LayoutResult`

```ts
interface LayoutResult {
  nodes: LayoutNode[];   // every node, flattened — see note below
  edges: LayoutEdge[];
  width: number;          // total diagram width in SVG user units
  height: number;
  viewBoxX: number;       // SVG viewBox origin X — see "viewBoxX/viewBoxY" below
  viewBoxY: number;
}
```

`nodes` is the flattened output of layout: **every** node — top-level and nested — is a
direct entry in this array (unlike `C4Diagram.elements`, which only has nesting via
`.parent`/`.children`, `LayoutResult.nodes` lists every node once at the top level *and*
again under its parent's `.children`, both pointing at the same object). If you just
want to draw every node, iterate `layout.nodes` directly — you don't need to recurse
into `.children` to find anything you don't already have.

## `LayoutNode`

```ts
interface LayoutNode {
  id: string;                 // same as C4Element.id
  x: number;                   // left edge, in SVG user units
  y: number;                   // top edge
  width: number;
  height: number;
  element: C4Element;          // back-reference to the source element
  children?: LayoutNode[];     // nested layout nodes, positioned in the SAME coordinate space as this node (not relative to it)
}
```

`x`/`y` are absolute — a child's `x`/`y` are already offset to be correct in the same
coordinate space as its parent and everything else in the diagram; you do not need to
add the parent's `x`/`y` to a child's to get its true position.

## `LayoutEdge`

```ts
interface LayoutEdge {
  source: string;    // LayoutNode.id
  target: string;
  points: Point[];    // [sourcePoint, targetPoint] — where the edge crosses each node's boundary
  label: string;
}
```

## `Point`

```ts
interface Point {
  x: number;
  y: number;
}
```

## `viewBoxX` / `viewBoxY` — the auto-layout vs. manual-layout asymmetry

These exist for one reason: dragging a node past the diagram's current top or left edge
produces **negative coordinates**. Rather than shifting every node's `x`/`y` to keep
everything non-negative (which would desynchronize the coordinates you render from the
coordinates you'd persist as "the manual position"), the layout step instead moves the
SVG `viewBox` origin to cover the negative space, leaving every node's stored `x`/`y`
untouched.

This only ever happens on the **manual-position path** — when you pass non-empty
`manualPositions` to `layoutC4Diagram`. The **auto-layout path** (dagre, no manual
positions) always returns `viewBoxX: 0, viewBoxY: 0` — dagre never produces negative
coordinates, so there's nothing to compensate for. It is easy to write rendering code
that assumes `viewBoxX`/`viewBoxY` are always `0` because that's true in every
auto-layout diagram you test against, then have it break the first time a user drags a
node above/left of the origin. Always read `viewBoxX`/`viewBoxY` from the `LayoutResult`
and use them in your `<svg viewBox="...">`, rather than assuming `0 0`.

**Verified**, both paths, same diagram:

```ts
const { diagram } = parseC4(`Person(user, "User")\nSystem(app, "App")\nRel(user, app, "Uses")`);

layoutC4Diagram(diagram);
// viewBoxX: 0, viewBoxY: 0   (auto layout — always zero)

layoutC4Diagram(diagram, undefined, { user: { x: -100, y: -50 }, app: { x: 200, y: 200 } });
// viewBoxX: -140, viewBoxY: -90   (manual layout, negative position dragged in)
// nodes: [{ id: 'user', x: -100, y: -50 }, { id: 'app', x: 200, y: 200 }]
//   ^ note: user.x/y are exactly what was passed in, untouched — only viewBoxX/Y compensate
```

## Worked example: parse → layout, real output

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
```

`errors` is `[]` and `diagram` is non-null — but its type is `C4Diagram | null` (`null` only
on unrecoverable parse failure), so code passing it on to `layoutC4Diagram` needs to narrow
it first. `diagram.elements` has 4 entries (`user`, `app`, `fe`, `db`); `app`'s `children`
array contains the same `fe`/`db` objects that also appear as top-level entries in
`diagram.elements`. `diagram.relationships` is:

```json
[
  { "sourceId": "user", "targetId": "fe", "label": "Uses [HTTPS]" },
  { "sourceId": "fe",   "targetId": "db", "label": "Reads/writes [SQL]" }
]
```

```ts
if (!diagram) {
  throw new Error(`parse failed: ${JSON.stringify(errors)}`);
}

const layout = layoutC4Diagram(diagram);
```

produces (trimmed to the shape-relevant fields):

```json
{
  "nodes": [
    { "id": "user", "x": -10, "y": 123, "width": 120, "height": 120, "children": [] },
    { "id": "app",  "x": 190, "y": 40,  "width": 320, "height": 461,
      "children": [
        { "id": "fe", "x": 230, "y": 135, "width": 240, "height": 96 },
        { "id": "db", "x": 230, "y": 331, "width": 240, "height": 130 }
      ]
    },
    { "id": "fe", "x": 230, "y": 135, "width": 240, "height": 96 },
    { "id": "db", "x": 230, "y": 331, "width": 240, "height": 130 }
  ],
  "edges": [
    { "source": "user", "target": "fe", "label": "Uses [HTTPS]",
      "points": [{ "x": 110, "y": 183 }, { "x": 230, "y": 183 }] },
    { "source": "fe", "target": "db", "label": "Reads/writes [SQL]",
      "points": [{ "x": 350, "y": 231 }, { "x": 350, "y": 331 }] }
  ],
  "width": 550,
  "height": 541,
  "viewBoxX": 0,
  "viewBoxY": 0
}
```

Note `fe` and `db` each appear twice in `nodes` — once as a top-level array entry, once
inside `app.children` — both referring to the same position (`x: 230, y: 135` for `fe`
in both places), confirming child coordinates are already absolute, not relative to
`app`.
