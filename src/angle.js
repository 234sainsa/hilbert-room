// Angle formatting shared by the OpenQASM writer and the text diagram.

// Denominators tried when writing an angle as a multiple of pi.
const PI_DENOMINATORS = [1, 2, 3, 4, 6, 8, 12, 16, 32, 64];

/**
 * Write an angle in radians as an OpenQASM expression: a multiple of pi
 * ("pi/2", "-3*pi/4") when it is one to within rounding, otherwise a float
 * literal with enough digits to round-trip.
 */
export function formatAngle(theta) {
  if (!Number.isFinite(theta)) throw new RangeError('formatAngle: angle must be finite');
  if (theta === 0) return '0';
  for (const d of PI_DENOMINATORS) {
    const k = Math.round((theta * d) / Math.PI);
    if (k !== 0 && Math.abs(theta - (k * Math.PI) / d) <= 1e-12 * Math.max(1, Math.abs(theta))) {
      const sign = k < 0 ? '-' : '';
      const n = Math.abs(k);
      const num = n === 1 ? 'pi' : `${n}*pi`;
      return d === 1 ? `${sign}${num}` : `${sign}${num}/${d}`;
    }
  }
  return floatLiteral(theta);
}

/** JavaScript number → OpenQASM float literal (always has a dot or exponent). */
function floatLiteral(x) {
  const text = String(x);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}
