import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import C4Playground from './C4Playground';

/**
 * The playground had no tests at all while it lived as five copies in five
 * documentation sites — every behaviour here was verified by driving a browser
 * by hand. Moving it into the package is what makes them possible, so they are
 * the first thing to add.
 *
 * jsdom reports every element as 0×0 and implements no ResizeObserver, so both
 * are supplied: the fit calculation is arithmetic over measurements, and the
 * measurements are the part jsdom cannot provide.
 */

const SOURCE = 'Person(u, "You")\nSystem(a, "App")\nRel(u, a, "Uses")';

/** Pretend the pane is `paneWidth` wide and the diagram `diagramWidth` units. */
function measureAs(paneWidth: number, paneHeight: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return this.classList?.contains('c4-playground__canvas') ? paneWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return this.classList?.contains('c4-playground__canvas') ? paneHeight : 0;
    },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  measureAs(0, 0);
});

/** Render fresh at a given pane size. Measurements must be in place first: the
 *  fit is computed in a layout effect, before anything is returned here. */
function renderAt(paneWidth: number, paneHeight = 10_000, props = {}) {
  cleanup();
  measureAs(paneWidth, paneHeight);
  const { container } = render(<C4Playground source={SOURCE} {...props} />);
  const svg = container.querySelector('svg')!;
  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return {
    container,
    naturalWidth: svg.viewBox.baseVal.width,
    scale: Number(svg.getAttribute('width')) / svg.viewBox.baseVal.width,
    readout: button('Zoom to fit').textContent,
    zoomOut: button('Zoom out'),
    fitButton: button('Zoom to fit'),
  };
}

describe('C4Playground zoom', () => {
  it('opens at the fitted scale, reported as 100%', () => {
    const { naturalWidth } = renderAt(10_000);
    // A pane half the diagram's width fits at half scale — and still reads
    // 100%, because 100% means "the whole diagram", not one unit per pixel.
    const half = renderAt(naturalWidth / 2);
    expect(half.scale).toBeCloseTo(0.5, 2);
    expect(half.readout).toBe('100%');
  });

  it('reports 100% at two different scales, which is the point', () => {
    const { naturalWidth } = renderAt(10_000);
    const cramped = renderAt(naturalWidth / 2);
    const roomy = renderAt(naturalWidth);
    expect(cramped.scale).toBeLessThan(roomy.scale);
    // Expanding a diagram into a bigger pane is not a zoom: both views show all
    // of it, so the number must not move.
    expect(cramped.readout).toBe(roomy.readout);
  });

  it('never scales a small diagram up to fill the pane', () => {
    const { naturalWidth } = renderAt(10_000);
    // Fitting is about seeing all of it, not filling space.
    expect(renderAt(naturalWidth * 4).scale).toBeLessThanOrEqual(1);
  });

  it('cannot zoom out below the fitted view', () => {
    // Once the whole diagram is visible, smaller only buys whitespace.
    expect(renderAt(200).zoomOut.disabled).toBe(true);
  });

  it('offers no reset while already fitted', () => {
    expect(renderAt(200).fitButton.disabled).toBe(true);
  });
});

describe('C4Playground fence meta', () => {
  it('static means static: no drag control at all', () => {
    const { container } = renderAt(800, 600, { readOnly: true, editable: false });
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.textContent).not.toContain('Drag to reposition');
  });

  it('readOnly hides the source pane', () => {
    const { container } = renderAt(800, 600, { readOnly: true });
    expect(container.querySelector('.c4-playground__source')).toBeNull();
  });

  it('shows the source pane otherwise', () => {
    const { container } = renderAt(800, 600);
    expect(container.querySelector('.c4-playground__source')).not.toBeNull();
  });
});

describe('C4Playground theming', () => {
  it('takes isDarkMode as a prop rather than detecting it', () => {
    // The package has no idea how a host decides what "dark" means; the
    // renderer already takes a prop for exactly this reason. Nothing here
    // consults document.documentElement.
    const { container } = renderAt(800, 600, { isDarkMode: true });
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
