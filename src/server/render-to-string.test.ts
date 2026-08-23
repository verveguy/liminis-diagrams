import { describe, it, expect } from 'vitest';
import { renderC4DiagramToSVG } from './render-to-string';

/**
 * A diagram whose relationship runs at an angle, so the edge label is rotated
 * and the rotation goes through `Math.atan2`. A straight horizontal or vertical
 * edge would not exercise the path this guards.
 */
const ANGLED = `
System(a, "A", "first")
System(b, "B", "second")
Container(c, "C", "Tech", "third")
Rel(a, b, "calls")
Rel(a, c, "reads")
Rel(c, b, "writes")
`;

describe('renderC4DiagramToSVG determinism', () => {
  it('emits no number carrying raw double precision', () => {
    // The real defect this catches is platform drift: IEEE 754 does not require
    // sin/cos/atan2 to be correctly rounded, so an unrounded result differs by
    // one ULP between macOS and Linux and the committed SVG stops matching in
    // CI depending on who rendered it. Long decimals in the output are the
    // symptom, and are cheap to assert on.
    //
    // The threshold is seven places rather than three because the renderer does
    // arithmetic on already-rounded geometry — halving a 3-decimal width for a
    // centre line legitimately yields four. That arithmetic is deterministic;
    // only the transcendental functions are not. A raw double reaching the
    // output carries twelve to sixteen places, so seven separates the two
    // without failing on honest values.
    const { svg, errors } = renderC4DiagramToSVG(ANGLED);
    expect(errors).toEqual([]);

    const overlyPrecise = [...svg.matchAll(/-?\d+\.(\d{7,})/g)].map((m) => m[0]);
    expect(overlyPrecise).toEqual([]);
  });

  it('renders byte-identically when called twice', () => {
    const first = renderC4DiagramToSVG(ANGLED).svg;
    const second = renderC4DiagramToSVG(ANGLED).svg;
    expect(first).toBe(second);
  });

  it('rounds manually positioned diagrams too', () => {
    // A separate layout path — `layoutWithManualPositions` rather than dagre —
    // taken by the drag renderer and by this function's own `manualPositions`
    // argument. It returned its geometry unrounded at first, which left the
    // platform drift in place for exactly the diagrams someone had arranged by
    // hand. Deliberately awkward coordinates, so nothing rounds by luck.
    const positions = {
      a: { x: 10.123456789, y: 20.987654321 },
      b: { x: 300.111111111, y: 220.999999999 },
      c: { x: -40.555555555, y: 130.333333333 },
    };
    const { svg, errors } = renderC4DiagramToSVG(ANGLED, false, positions);
    expect(errors).toEqual([]);

    const overlyPrecise = [...svg.matchAll(/-?\d+\.(\d{7,})/g)].map((m) => m[0]);
    expect(overlyPrecise).toEqual([]);
  });
});
