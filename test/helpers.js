// Reference implementations used only by the tests: build the full
// 2^n × 2^n matrix of a gate and multiply it with a state the slow way.

import { Matrix, StateVector, gateMatrix } from '../src/index.js';

/** Random normalised state from a seeded source. */
export function randomState(numQubits, rng) {
  const s = new StateVector(numQubits);
  let norm = 0;
  for (let i = 0; i < s.size; i++) {
    s.re[i] = rng() * 2 - 1;
    s.im[i] = rng() * 2 - 1;
    norm += s.re[i] * s.re[i] + s.im[i] * s.im[i];
  }
  const k = 1 / Math.sqrt(norm);
  for (let i = 0; i < s.size; i++) {
    s.re[i] *= k;
    s.im[i] *= k;
  }
  return s;
}

/**
 * Full matrix of a gate acting on `qubits` of an n-qubit register,
 * little-endian (qubits[0] is bit 0 of the gate's own matrix).
 */
export function embed(name, params, qubits, numQubits) {
  const g = gateMatrix(name, params);
  const size = 2 ** numQubits;
  const full = new Matrix(size);
  const mask = qubits.reduce((m, q) => m | (1 << q), 0);
  const local = (i) => qubits.reduce((acc, q, k) => acc | (((i >> q) & 1) << k), 0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r & ~mask) !== (c & ~mask)) continue;
      const [re, im] = g.get(local(r), local(c));
      full.re[r * size + c] = re;
      full.im[r * size + c] = im;
    }
  }
  return full;
}

/** Matrix × state, returned as a new StateVector. */
export function multiply(matrix, state) {
  const out = new StateVector(state.numQubits);
  const n = state.size;
  for (let r = 0; r < n; r++) {
    let sr = 0;
    let si = 0;
    for (let c = 0; c < n; c++) {
      const ar = matrix.re[r * n + c];
      const ai = matrix.im[r * n + c];
      sr += ar * state.re[c] - ai * state.im[c];
      si += ar * state.im[c] + ai * state.re[c];
    }
    out.re[r] = sr;
    out.im[r] = si;
  }
  return out;
}

/** Largest amplitude difference between two states. */
export function stateDiff(a, b) {
  let d = 0;
  for (let i = 0; i < a.size; i++) d = Math.max(d, Math.hypot(a.re[i] - b.re[i], a.im[i] - b.im[i]));
  return d;
}

/** Expected value of the product of ±1 outcomes from two-qubit counts. */
export function correlation(counts) {
  let total = 0;
  let sum = 0;
  for (const [bits, n] of Object.entries(counts)) {
    const parity = bits.split('').filter((b) => b === '1').length % 2;
    sum += parity ? -n : n;
    total += n;
  }
  return sum / total;
}
