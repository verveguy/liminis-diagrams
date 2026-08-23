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
  it('emits no number carrying more than three decimal places', () => {
    // The real defect this catches is platform drift: IEEE 754 does not require
    // sin/cos/atan2 to be correctly rounded, so an unrounded result differs by
    // one ULP between macOS and Linux and the committed SVG stops matching in
    // CI depending on who rendered it. Long decimals in the output are the
    // symptom, and are cheap to assert on.
    const { svg, errors } = renderC4DiagramToSVG(ANGLED);
    expect(errors).toEqual([]);

    const overlyPrecise = [...svg.matchAll(/-?\d+\.(\d{4,})/g)].map((m) => m[0]);
    expect(overlyPrecise).toEqual([]);
  });

  it('renders byte-identically when called twice', () => {
    const first = renderC4DiagramToSVG(ANGLED).svg;
    const second = renderC4DiagramToSVG(ANGLED).svg;
    expect(first).toBe(second);
  });
});
