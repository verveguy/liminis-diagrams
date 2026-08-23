import { describe, it, expect } from 'vitest';
import { svgNumber } from './precision';

describe('svgNumber', () => {
  it('rounds to three decimal places', () => {
    expect(svgNumber(-9.005931656396022)).toBe(-9.006);
    expect(svgNumber(-9.005931656396024)).toBe(-9.006);
  });

  it('agrees across the one-ULP difference platforms actually produce', () => {
    // The two values macOS and Linux returned for the same atan2 call. The
    // point of rounding is that these stop being different bytes in the SVG.
    expect(svgNumber(-9.005931656396022)).toBe(svgNumber(-9.005931656396024));
  });

  it('leaves short decimals alone rather than padding them', () => {
    expect(String(svgNumber(1.5))).toBe('1.5');
    expect(String(svgNumber(12))).toBe('12');
  });

  it('normalises negative zero, which serialises differently from zero', () => {
    expect(String(svgNumber(-0.0001))).toBe('0');
  });

  it('keeps precision that is still meaningful at diagram scale', () => {
    expect(svgNumber(706.1234)).toBe(706.123);
  });
});
