// Gate definitions. Matrices follow the OpenQASM 3 standard library
// (stdgates.inc) and Qiskit, including their global phases.

import { Matrix } from './complex.js';

const R = Math.SQRT1_2;

/**
 * kind:
 *   'single'     — a 2×2 matrix on one qubit
 *   'controlled' — `base` (a single-qubit gate) on qubits[1], controlled by qubits[0]
 *   'swap'       — exchange qubits[0] and qubits[1]
 */
const DEFINITIONS = {
  h: { kind: 'single', qubits: 1, params: 0, matrix: () => [[R, R], [R, -R]] },
  x: { kind: 'single', qubits: 1, params: 0, matrix: () => [[0, 1], [1, 0]] },
  y: { kind: 'single', qubits: 1, params: 0, matrix: () => [[0, [0, -1]], [[0, 1], 0]] },
  z: { kind: 'single', qubits: 1, params: 0, matrix: () => [[1, 0], [0, -1]] },
  s: { kind: 'single', qubits: 1, params: 0, matrix: () => [[1, 0], [0, [0, 1]]] },
  sdg: { kind: 'single', qubits: 1, params: 0, matrix: () => [[1, 0], [0, [0, -1]]] },
  t: { kind: 'single', qubits: 1, params: 0, matrix: () => [[1, 0], [0, [R, R]]] },
  tdg: { kind: 'single', qubits: 1, params: 0, matrix: () => [[1, 0], [0, [R, -R]]] },
  rx: {
    kind: 'single', qubits: 1, params: 1,
    matrix: ([theta]) => {
      const c = Math.cos(theta / 2);
      const s = Math.sin(theta / 2);
      return [[c, [0, -s]], [[0, -s], c]];
    },
  },
  ry: {
    kind: 'single', qubits: 1, params: 1,
    matrix: ([theta]) => {
      const c = Math.cos(theta / 2);
      const s = Math.sin(theta / 2);
      return [[c, -s], [s, c]];
    },
  },
  rz: {
    kind: 'single', qubits: 1, params: 1,
    matrix: ([theta]) => {
      const c = Math.cos(theta / 2);
      const s = Math.sin(theta / 2);
      return [[[c, -s], 0], [0, [c, s]]];
    },
  },
  cx: { kind: 'controlled', qubits: 2, params: 0, base: 'x' },
  cz: { kind: 'controlled', qubits: 2, params: 0, base: 'z' },
  swap: { kind: 'swap', qubits: 2, params: 0 },
};

/** Names of every supported gate (measurement is not a gate). */
export const GATE_NAMES = Object.freeze(Object.keys(DEFINITIONS));

/** @returns {{kind: string, qubits: number, params: number, base?: string}} */
export function gateInfo(name) {
  const def = DEFINITIONS[name];
  if (!def) throw new Error(`Unknown gate "${name}"`);
  return { kind: def.kind, qubits: def.qubits, params: def.params, base: def.base };
}

export function isGate(name) {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, name);
}

/** 2×2 matrix of a single-qubit gate. */
export function singleQubitMatrix(name, params = []) {
  const def = DEFINITIONS[name];
  if (!def || def.kind !== 'single') throw new Error(`"${name}" is not a single-qubit gate`);
  return Matrix.fromRows(def.matrix(params));
}

/**
 * Full unitary of a gate on its own qubits, little-endian: for a two-qubit
 * gate on qubits [a, b], `a` is bit 0 of the row/column index.
 */
export function gateMatrix(name, params = []) {
  const def = DEFINITIONS[name];
  if (!def) throw new Error(`Unknown gate "${name}"`);
  if (def.kind === 'single') return singleQubitMatrix(name, params);
  if (def.kind === 'swap') {
    return Matrix.fromRows([
      [1, 0, 0, 0],
      [0, 0, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 1],
    ]);
  }
  // Controlled: control is qubit 0 (low bit), target is qubit 1 (high bit).
  const u = singleQubitMatrix(def.base);
  const m = Matrix.identity(4);
  const rows = [1, 3]; // indices with the control bit set: target 0 → 1, target 1 → 3
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const k = rows[r] * 4 + rows[c];
      const [re, im] = u.get(r, c);
      m.re[k] = re;
      m.im[k] = im;
    }
  }
  return m;
}

/**
 * Apply one gate to a state vector.
 * @param {import('./state.js').StateVector} state
 */
export function applyGate(state, name, qubits, params = []) {
  const def = DEFINITIONS[name];
  if (!def) throw new Error(`Unknown gate "${name}"`);
  if (def.kind === 'single') {
    state.apply1(qubits[0], flatMatrix(name, params));
  } else if (def.kind === 'controlled') {
    state.applyControlled1(qubits[0], qubits[1], flatMatrix(def.base, []));
  } else {
    state.swap(qubits[0], qubits[1]);
  }
  return state;
}

// Fixed gates are converted once; parameterised ones on every call.
const flatCache = new Map();

function flatMatrix(name, params) {
  if (DEFINITIONS[name].params > 0) return singleQubitMatrix(name, params).toFlat2();
  let flat = flatCache.get(name);
  if (!flat) {
    flat = singleQubitMatrix(name).toFlat2();
    flatCache.set(name, flat);
  }
  return flat;
}
