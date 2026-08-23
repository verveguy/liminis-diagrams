import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { C4InteractiveRenderer } from './C4InteractiveRenderer';
import { parseC4 } from '../core/parser';

/**
 * Drag interaction tests.
 *
 * These exist because the drag path had no coverage at all: it was written
 * mouse-only (`onMouseDown` plus `mousemove`/`mouseup` on `window`), shipped in
 * 0.1.0, and did not work on any touch device — iPadOS and mobile Safari
 * synthesize `mousedown`/`click` after a gesture resolves but never emit the
 * `mousemove` stream a drag needs. The entire event model was then replaced with
 * pointer events and all 106 existing tests still passed, which is what a
 * complete absence of coverage looks like.
 *
 * So these tests drive the component the way a *touch* device does — pointer
 * events only — and would fail against the mouse-only implementation.
 *
 * happy-dom implements no SVG geometry, so `getScreenCTM` and `createSVGPoint`
 * are stubbed with an identity transform: screen pixels map 1:1 to SVG units.
 * That means these tests exercise the drag pipeline, not the coordinate maths —
 * a bug in the real CTM handling would not be caught here.
 */

const SOURCE = `Person(user, "User", "End user")
System(app, "App", "Does the thing")
Rel(user, app, "Uses", "HTTPS")`;

function stubSvgGeometry() {
  const proto = window.SVGSVGElement?.prototype as unknown as Record<string, unknown>;
  if (!proto) return;
  proto.createSVGPoint = function createSVGPoint() {
    return {
      x: 0,
      y: 0,
      matrixTransform(m: { e?: number; f?: number }) {
        return { x: this.x - (m?.e ?? 0), y: this.y - (m?.f ?? 0) };
      },
    };
  };
  proto.getScreenCTM = function getScreenCTM() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } };
  };
}

function renderDiagram(overrides: Record<string, unknown> = {}) {
  const parsed = parseC4(SOURCE);
  expect(parsed.errors).toHaveLength(0);
  const onPositionChange = vi.fn();
  const utils = render(
    <C4InteractiveRenderer
      diagram={parsed.diagram!}
      isDarkMode={false}
      isEditMode
      manualPositions={{}}
      onPositionChange={onPositionChange}
      {...overrides}
    />,
  );
  return { ...utils, onPositionChange };
}

/** The transparent rects that receive the drag gesture. */
const hitAreas = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGRectElement>('[data-node-id]'));

beforeEach(stubSvgGeometry);

describe('C4InteractiveRenderer drag', () => {
  it('renders hit areas for every node in edit mode', () => {
    const { container } = renderDiagram();
    expect(hitAreas(container).length).toBeGreaterThan(0);
  });

  it('declares touch-action: none on the hit areas', () => {
    // Without this the browser claims the gesture for panning before any
    // pointermove arrives, which is half of why touch drag did not work.
    const { container } = renderDiagram();
    for (const area of hitAreas(container)) {
      expect(area.style.touchAction).toBe('none');
    }
  });

  it('moves a node on a pointer drag', () => {
    const { container, onPositionChange } = renderDiagram();
    const area = hitAreas(container)[0];
    const nodeId = area.getAttribute('data-node-id')!;
    const startX = Number(area.getAttribute('x'));
    const startY = Number(area.getAttribute('y'));

    fireEvent.pointerDown(area, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 160, clientY: 140 });
    fireEvent.pointerUp(window, { clientX: 160, clientY: 140 });

    expect(onPositionChange).toHaveBeenCalled();
    const positions = onPositionChange.mock.calls.at(-1)![0] as Record<
      string,
      { x: number; y: number }
    >;
    expect(positions[nodeId]).toBeDefined();
    // Identity CTM, so a +60/+40 screen delta is a +60/+40 SVG delta.
    expect(positions[nodeId].x).toBeCloseTo(startX + 60, 0);
    expect(positions[nodeId].y).toBeCloseTo(startY + 40, 0);
  });

  it('ends the drag on pointercancel rather than leaving it stuck', () => {
    // The browser fires pointercancel when it takes a touch over as a scroll or
    // system gesture. There is no pointerup in that case, so without handling it
    // the node stays attached to the finger.
    const { container, onPositionChange } = renderDiagram();
    const area = hitAreas(container)[0];

    fireEvent.pointerDown(area, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 150 });
    fireEvent.pointerCancel(window);

    const callsAfterCancel = onPositionChange.mock.calls.length;
    // Further movement must not move anything: the drag is over.
    fireEvent.pointerMove(window, { clientX: 400, clientY: 400 });
    expect(onPositionChange.mock.calls.length).toBe(callsAfterCancel);
  });

  it('does not drag when edit mode is off', () => {
    const { container, onPositionChange } = renderDiagram({ isEditMode: false });
    const areas = hitAreas(container);
    if (areas.length) {
      fireEvent.pointerDown(areas[0], { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
      fireEvent.pointerUp(window, { clientX: 200, clientY: 200 });
    }
    expect(onPositionChange).not.toHaveBeenCalled();
  });
});
