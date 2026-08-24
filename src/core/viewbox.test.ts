import { describe, it, expect } from 'vitest';
import { parseC4 } from './parser';
import { layoutC4Diagram } from './layout';

/**
 * The viewBox has to contain the diagram.
 *
 * It reads as an obvious property, and it did not hold: the auto-layout path
 * reported `viewBoxX: 0` while the cross-boundary alignment pass placed
 * elements at negative x. A viewBox is a window, not a canvas, so everything
 * left of it was clipped and no amount of scrolling could reach it — the
 * failure looked like a diagram with its left edge sliced off.
 *
 * data-model.md asserted the premise that allowed it ("dagre never produces
 * negative coordinates"), so the documentation agreed with the bug.
 */
const bounds = (source: string) => {
  const { diagram, errors } = parseC4(source);
  expect(errors).toEqual([]);
  const layout = layoutC4Diagram(diagram!);
  const minX = Math.min(...layout.nodes.map((n) => n.x));
  const minY = Math.min(...layout.nodes.map((n) => n.y));
  const maxX = Math.max(...layout.nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...layout.nodes.map((n) => n.y + n.height));
  return { layout, minX, minY, maxX, maxY };
};

describe('the viewBox contains the diagram', () => {
  // The minimal reproduction: an element outside a boundary, related to one
  // inside it. Anything simpler lays out entirely in positive space and would
  // have passed against the broken code.
  const ACROSS_A_BOUNDARY = `Person(u, "You")
System_Boundary(b, "Boundary") {
  Container(c, "Inner", "Rust", "does the work")
}
Rel(u, c, "Uses")`;

  it('covers content the boundary alignment pushed left of the origin', () => {
    const { layout, minX } = bounds(ACROSS_A_BOUNDARY);
    expect(minX).toBeLessThan(0); // guards the reproduction itself
    expect(layout.viewBoxX).toBeLessThanOrEqual(minX);
  });

  it('covers every node on all four sides', () => {
    for (const source of [
      ACROSS_A_BOUNDARY,
      `Person(u, "You")
System_Ext(x, "Client", "yours")
System_Boundary(b, "Boundary") {
  Container(c, "Inner", "Rust", "does the work")
}
System_Ext(y, "Provider", "theirs")
Rel(u, x, "Asks")
Rel(x, c, "Calls")
Rel(c, y, "Prompts")`,
    ]) {
      const { layout, minX, minY, maxX, maxY } = bounds(source);
      expect(layout.viewBoxX).toBeLessThanOrEqual(minX);
      expect(layout.viewBoxY).toBeLessThanOrEqual(minY);
      expect(layout.viewBoxX + layout.width).toBeGreaterThanOrEqual(maxX);
      expect(layout.viewBoxY + layout.height).toBeGreaterThanOrEqual(maxY);
    }
  });

  it('leaves a diagram that was already correct exactly as it was', () => {
    // Nothing here comes within BOUNDARY_PADDING of the origin, so the fix must
    // be a no-op: same origin, same dimensions as before it existed.
    const { layout, minX, minY } = bounds(`Person(u, "You")
System(a, "App", "does things")
Rel(u, a, "Uses")`);
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(layout.viewBoxX).toBe(0);
    expect(layout.viewBoxY).toBe(0);
  });

  it('holds on the manual path too, which is where it always held', () => {
    const { diagram } = parseC4(`Person(u, "You")\nSystem(a, "App")\nRel(u, a, "Uses")`);
    const layout = layoutC4Diagram(diagram!, undefined, { u: { x: -140, y: -90 } });
    const minX = Math.min(...layout.nodes.map((n) => n.x));
    expect(minX).toBe(-140);
    expect(layout.viewBoxX).toBeLessThanOrEqual(-140);
    // The stored position is untouched — the viewBox compensates, not the node.
    expect(layout.nodes.find((n) => n.id === 'u')?.x).toBe(-140);
  });
});
