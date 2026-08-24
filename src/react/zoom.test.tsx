import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { C4InteractiveRenderer } from './C4InteractiveRenderer';
import { normaliseZoom } from './renderer';
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

  // `width`/`height` are attributes on a public entry point: whatever a host
  // passes reaches the DOM. NaN is the realistic one — an uninitialised state
  // variable, or a division that went wrong — and it renders nothing at all,
  // with no error to explain why.
  describe('a bad factor cannot produce an invalid SVG', () => {
    for (const bad of [0, -1, -0.5, NaN, Infinity, -Infinity]) {
      it(`falls back to actual size for ${String(bad)}`, () => {
        expect(normaliseZoom(bad)).toBe(1);
        expect(renderAt(bad)).toEqual(renderAt(1));
      });
    }

    it('clamps rather than asking a browser to lay out a mile of SVG', () => {
      expect(normaliseZoom(1e6)).toBe(50);
      expect(normaliseZoom(1e-6)).toBe(0.05);
    });

    it('leaves ordinary factors exactly as given', () => {
      for (const good of [0.05, 0.5, 1, 2.5, 50]) {
        expect(normaliseZoom(good)).toBe(good);
      }
    });
  });
});
