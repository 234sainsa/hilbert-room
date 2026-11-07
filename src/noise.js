// Simple noise model for dry runs that look more like hardware results.
// Depolarizing noise is simulated by Monte Carlo trajectories: after each
// gate, with probability p a uniformly random Pauli (identity included) is
// applied to the gate's qubits, which on average gives
// ρ → (1 − p) ρ + p I/d (the same definition as Qiskit's depolarizing_error).

import { applyGate } from './gates.js';

/**
 * @typedef {object} NoiseModel
 * @property {number} [depolarizing1]  p for each single-qubit gate
 * @property {number} [depolarizing2]  p for each two-qubit gate
 * @property {number|{p01?: number, p10?: number}} [readout]
 *   readout flip probability; a number applies to both directions,
 *   p01 = P(read 1 | true 0), p10 = P(read 0 | true 1)
 */

function checkProbability(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`noise: ${label} must be a number from 0 to 1`);
  }
  return value;
}

/**
 * Validate a noise model and fill in zeros.
 * @param {NoiseModel|undefined|null} noise
 * @returns {{depolarizing1: number, depolarizing2: number, p01: number, p10: number}}
 */
export function normalizeNoise(noise) {
  const n = noise ?? {};
  const depolarizing1 = checkProbability(n.depolarizing1 ?? 0, 'depolarizing1');
  const depolarizing2 = checkProbability(n.depolarizing2 ?? 0, 'depolarizing2');
  let p01 = 0;
  let p10 = 0;
  if (typeof n.readout === 'number') {
    p01 = p10 = checkProbability(n.readout, 'readout');
  } else if (n.readout) {
    p01 = checkProbability(n.readout.p01 ?? 0, 'readout.p01');
    p10 = checkProbability(n.readout.p10 ?? 0, 'readout.p10');
  }
  return { depolarizing1, depolarizing2, p01, p10 };
}

export function hasGateNoise(model) {
  return model.depolarizing1 > 0 || model.depolarizing2 > 0;
}

export function hasReadoutNoise(model) {
  return model.p01 > 0 || model.p10 > 0;
}

const PAULIS = [null, 'x', 'y', 'z'];

/** After a gate on `qubits`, maybe apply a random Pauli error. */
export function applyGateNoise(state, qubits, model, rng) {
  const p = qubits.length === 1 ? model.depolarizing1 : model.depolarizing2;
  if (p <= 0 || rng() >= p) return;
  for (const q of qubits) {
    const pauli = PAULIS[Math.floor(rng() * 4)];
    if (pauli) applyGate(state, pauli, [q]);
  }
}

/** Return the bit that is read out, possibly flipped. */
export function applyReadoutNoise(bit, model, rng) {
  const p = bit ? model.p10 : model.p01;
  if (p > 0 && rng() < p) return bit ^ 1;
  return bit;
}
