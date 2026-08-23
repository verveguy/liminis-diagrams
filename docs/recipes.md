# Recipes

Three complete, runnable integrations. Each was executed against this package's current
`src/` and the output shown is what it actually produced — see the individual notes for
how.

## Recipe 1: headless rendering in a CLI/CI job

Parse, lay out, and emit SVG in one call — no browser, no jsdom, DOM-free (though it does
need `react`/`react-dom` installed; see [`architecture.md`](./architecture.md#why-isnt-server-part-of-core)
for why).

```ts
import { renderC4DiagramToSVG } from '@liminis/diagrams/server';

const source = `
Person(user, "User", "End user")
System(app, "App", "Main app")
Rel(user, app, "Uses", "HTTPS")
`;

const { svg, errors } = renderC4DiagramToSVG(source, /* isDarkMode */ false);

if (errors.length > 0) {
  console.error(errors);
  process.exit(1);
}

console.log(svg);
```

**Verified output** (`errors` is `[]`; `svg` is 1762 characters):

```html
<svg width="320" height="394" viewBox="0 0 320 394" xmlns="http://www.w3.org/2000/svg" data-diagram="c4" style="font-family:system-ui, -apple-system, sans-serif"><g class="boundaries-layer"></g><g class="nodes-layer"><g><circle cx="160" cy="66" r="14" fill="#006b2d" stroke="#004b1e" stroke-width="1...
```

If `parseC4` or `validateC4` fail internally, `renderC4DiagramToSVG` returns `{ svg: '',
errors }` rather than throwing — always check `errors` before using `svg`.

## Recipe 2: embedding `C4InteractiveRenderer` in a non-editor host

`C4InteractiveRenderer` is a **controlled component**: it takes `manualPositions` in
as a prop and calls `onPositionChange` out during/after a drag. It holds no persisted
state of its own — the host owns `manualPositions` and decides what to do when the
callback fires (nothing, `useState`, write to disk, debounce a network call, etc.).

```tsx
import { useState } from 'react';
import { parseC4 } from '@liminis/diagrams/core';
import { C4InteractiveRenderer } from '@liminis/diagrams/react';

function DiagramHost({ source }: { source: string }) {
  const { diagram } = parseC4(source);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  if (!diagram) return null;

  return (
    <C4InteractiveRenderer
      diagram={diagram}
      isDarkMode={false}
      isEditMode={true}
      manualPositions={positions}
      onPositionChange={setPositions}
    />
  );
}
```

With `manualPositions={{}}` (nothing set yet), the renderer lays the diagram out with
dagre and lets you drag any node; each drag calls `onPositionChange` with the *complete*
new positions map (not just the moved node — the first drag also seeds every other
node's current auto-layout position into the map, so `manualPositions` after any drag is
enough on its own to reproduce the layout without dagre).

**Verified**: rendering `DiagramHost` with `isEditMode={true}` produces one draggable
hit area (an `SVGRectElement` with `data-node-id`) per top-level and nested node — for a
two-element diagram (`user`, `app`), `container.querySelectorAll('[data-node-id]')`
returns exactly `['user', 'app']`. Passing `manualPositions={{ user: { x: 500, y: 500 },
app: { x: 900, y: 500 } }}` and re-rendering places `user`'s hit area at exactly `x="500"
y="500"` in the rendered SVG — confirming positions flow from the host's state straight
through to what's drawn, with no intermediate transformation.

## Recipe 3: position persistence — the host's choice

This package never writes anything to disk, a database, or anywhere else. `manualPositions`
is a plain `Record<string, { x: number; y: number }>` — how you store it is entirely up
to you. The simplest possible approach is to serialize it as JSON:

```ts
const positions = { user: { x: 10, y: 20 }, app: { x: 300, y: 20 } };
const stored = JSON.stringify(positions);
// stored: '{"user":{"x":10,"y":20},"app":{"x":300,"y":20}}'

// ...later, from wherever you stored `stored`...
const restored: Record<string, { x: number; y: number }> = JSON.parse(stored);
// restored deep-equals positions — verified round-trip
```

Pass `restored` back in as `manualPositions` (Recipe 2) or as the third argument to
`layoutC4Diagram` (Recipe 1's lower-level building block) to render with the saved
layout instead of dagre's auto-layout.

### One worked example: how `@liminis/editor` does it

**This is `@liminis/editor`'s own decision, not something `@liminis/diagrams` does or
requires.** It's included here as one concrete answer to "where would I actually put
this," not as this package's behavior.

`@liminis/editor` stores positions in the **meta string of the markdown code fence**
that holds the C4 source — the same place a fenced code block's language tag lives,
as the text following the language on the fence's opening line (e.g. the part after
`c4 ` in an opening fence tagged `c4`). On write, if there are any manual positions, it
serializes them as `@layout ` followed by JSON:

```ts
// verveguy/liminis-editor, src/app/mapper/lexicalToMdast.ts — convertC4Node()
const manualLayout = node.getManualLayout();       // { positions: {...} } | undefined
const meta = manualLayout && Object.keys(manualLayout.positions).length > 0
  ? '@layout ' + JSON.stringify(manualLayout)
  : undefined;
```

producing a fence meta string like:

```
@layout {"positions":{"user":{"x":10,"y":20},"app":{"x":300,"y":20}}}
```

On read, `src/app/mapper/mdastToLexical.ts`'s `extractC4LayoutFromMeta` looks for the
`@layout ` prefix, `JSON.parse`s the rest, and validates every position has finite
numeric `x`/`y` before trusting it — falling back to `undefined` (auto-layout) on
anything malformed:

```ts
function extractC4LayoutFromMeta(meta: string | null | undefined): ManualLayout | undefined {
  if (!meta?.startsWith('@layout ')) return undefined;
  try {
    const raw = JSON.parse(meta.slice('@layout '.length));
    // ...validates raw.positions[key].x/.y are finite numbers...
    return raw as ManualLayout;
  } catch {
    return undefined;
  }
}
```

**Verified**: the round-trip `'@layout ' + JSON.stringify({ positions }) →
meta.slice('@layout '.length) → JSON.parse(...)` reproduces the original `positions`
object exactly, for the example above.

The advantage of this approach, specific to `@liminis/editor`'s context: it keeps a
hand-arranged diagram's positions in the same plain-text, line-diffable markdown file as
the diagram source, with no sidecar file and no binary blob. If your host isn't a
markdown editor, this is not the right storage format for you — pick whatever fits your
host (a database column, a separate JSON file next to the source, a CRDT document,
whatever). The only contract this package cares about is the shape:
`Record<string, { x: number; y: number }>`.
