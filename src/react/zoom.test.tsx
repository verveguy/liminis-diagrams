import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { C4InteractiveRenderer } from './C4InteractiveRenderer';
import { parseC4 } from '../core/parser';

/**
 * Zoom scales the rendered size and leaves the viewBox alone.
 *
 * That asymmetry is the whole design, not an implementation detail:
 *
 *   - `getScreenCTM()` carries the ratio between the viewBox and the rendered
 *     size, so dragging keeps landing nodes under the pointer at any zoom with
 *     no arithmetic in the drag code. Change the viewBox instead and the ratio
 *     stays 1:1 while the content moves — dragging would still work, but zoom
 *     would pan rather than magnify.
 *   - The element genuinely gets bigger, so a scrolling container scrolls it. A
 *     CSS transform would paint it larger while it still reported its old size,
 *     and the overflow could not be reached — which is the bug this exists to
 *     avoid, and one the applet already shipped once in another form.
 */
const diagram = () =>
  parseC4(`Person(u, "You")\nSystem(a, "App", "does things")\nRel(u, a, "Uses")`).diagram!;

const renderAt = (zoom?: number) => {
  const { container } = render(
    <C4InteractiveRenderer
      diagram={diagram()}
      isDarkMode={false}
      isEditMode={false}
      manualPositions={{}}
      onPositionChange={() => {}}
      {...(zoom === undefined ? {} : { zoom })}
    />,
  );
  const svg = container.querySelector('svg')!;
  return {
    width: Number(svg.getAttribute('width')),
    height: Number(svg.getAttribute('height')),
    viewBox: svg.getAttribute('viewBox')!,
  };
};

describe('zoom', () => {
  it('defaults to actual size, so an existing host is unaffected', () => {
    expect(renderAt()).toEqual(renderAt(1));
  });

  it('scales the rendered size', () => {
    const actual = renderAt(1);
    const doubled = renderAt(2);
    expect(doubled.width).toBeCloseTo(actual.width * 2);
    expect(doubled.height).toBeCloseTo(actual.height * 2);
  });

  it('leaves the viewBox untouched at every zoom', () => {
    const { viewBox } = renderAt(1);
    for (const z of [0.5, 1.5, 2, 4]) {
      expect(renderAt(z).viewBox).toBe(viewBox);
    }
  });

  it('scales down as well as up', () => {
    const actual = renderAt(1);
    expect(renderAt(0.5).width).toBeCloseTo(actual.width / 2);
  });
});
