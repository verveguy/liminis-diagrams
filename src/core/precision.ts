/**
 * Numeric precision at the boundary where geometry becomes SVG.
 */

/**
 * Decimal places kept when a computed number reaches the SVG.
 *
 * This is not cosmetic. IEEE 754 does not require `sin`, `cos` or `atan2` to be
 * correctly rounded, so a platform's libm may return a result one unit in the
 * last place away from another's. macOS and Linux disagree in exactly that way,
 * and the disagreement reaches the output: an edge-label rotation came out as
 * `-9.005931656396022` on one and `-9.005931656396024` on the other. Identical
 * input, identical library version, different bytes.
 *
 * That matters because rendered SVGs get committed and checked for drift in CI.
 * A check that fails depending on who ran it is worse than no check — it trains
 * people to ignore it. Rounding at the boundary makes the output a function of
 * the input alone.
 *
 * Three places is far below anything visible: at this diagram's scale a
 * thousandth of a unit is a thousandth of a pixel, and a thousandth of a degree
 * moves the end of a 200px label by 0.0035px.
 */
const SVG_PRECISION = 3;

/** Round for emission into SVG, without leaving `1.500` where `1.5` will do. */
export function svgNumber(value: number): number {
  const factor = 10 ** SVG_PRECISION;
  // `+0` rather than the bare result: -0 serialises as "-0", which differs from
  // "0" bytewise while being the same number.
  return Math.round(value * factor) / factor + 0;
}
