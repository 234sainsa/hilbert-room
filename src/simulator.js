// Running circuits: exact final states and sampled measurement shots.

import { applyGate } from './gates.js';
import { StateVector } from './state.js';
import { createCryptoRng } from './rng.js';
import {
  normalizeNoise, hasGateNoise, hasReadoutNoise, applyGateNoise, applyReadoutNoise,
} from './noise.js';

/**
 * Final state of the circuit's gates, ignoring measurements. Only allowed
 * when every measurement is at the end, so the result is well defined.
 * @param {import('./circuit.js').Circuit} circuit
 * @returns {StateVector}
 */
export function statevector(circuit) {
  if (!circuit.measurementsAreTerminal()) {
    throw new Error('statevector: the circuit uses a qubit after measuring it; use run() instead');
  }
  const state = new StateVector(circuit.numQubits);
  for (const op of circuit.operations) {
    if (op.name !== 'measure') applyGate(state, op.name, op.qubits, op.params);
  }
  return state;
}

/** Probability of every basis state of the final state (see `statevector`). */
export function probabilities(circuit) {
  return statevector(circuit).probabilities();
}

/**
 * @typedef {object} RunOptions
 * @property {number} [shots=1024]
 * @property {() => number} [rng]  uniform [0, 1); defaults to crypto.getRandomValues
 * @property {import('./noise.js').NoiseModel} [noise]
 * @property {boolean} [memory=true]  keep the bitstring of every shot
 */

/**
 * @typedef {object} RunResult
 * @property {number} shots
 * @property {Record<string, number>} counts  bitstring → number of shots
 * @property {string[]} memory  one bitstring per shot (empty if memory: false)
 */

/**
 * Sample the circuit `shots` times. Bitstrings have one character per
 * classical bit, classical bit 0 on the right (Qiskit order). Classical bits
 * that no measurement writes read 0.
 * @param {import('./circuit.js').Circuit} circuit
 * @param {RunOptions} [options]
 * @returns {RunResult}
 */
export function run(circuit, options = {}) {
  const shots = options.shots ?? 1024;
  if (!Number.isInteger(shots) || shots < 1) throw new RangeError('run: shots must be a positive integer');
  if (!circuit.hasMeasurements()) throw new Error('run: the circuit has no measurements');
  const rng = options.rng ?? createCryptoRng();
  if (typeof rng !== 'function') throw new TypeError('run: rng must be a function returning a number in [0, 1)');
  const model = normalizeNoise(options.noise);
  const keepMemory = options.memory ?? true;

  const sampler = !hasGateNoise(model) && circuit.measurementsAreTerminal()
    ? finalStateSampler(circuit, model, rng)
    : trajectorySampler(circuit, model, rng);

  const counts = {};
  const memory = [];
  const bits = new Uint8Array(circuit.numClbits);
  for (let shot = 0; shot < shots; shot++) {
    bits.fill(0);
    sampler(bits);
    const key = bitsToString(bits);
    counts[key] = (counts[key] ?? 0) + 1;
    if (keepMemory) memory.push(key);
  }
  return { shots, counts, memory };
}

/** Classical bits → bitstring with bit 0 on the right. */
function bitsToString(bits) {
  let s = '';
  for (let i = bits.length - 1; i >= 0; i--) s += bits[i] ? '1' : '0';
  return s;
}

/**
 * Fast path: simulate once, then draw each shot from the final
 * distribution. Valid when there is no gate noise and no gate follows a
 * measurement on the same qubit.
 */
function finalStateSampler(circuit, model, rng) {
  const probs = statevector(circuit).probabilities();
  const cumulative = new Float64Array(probs.length);
  let total = 0;
  for (let i = 0; i < probs.length; i++) {
    total += probs[i];
    cumulative[i] = total;
  }
  const measures = circuit.operations.filter((op) => op.name === 'measure');
  const readout = hasReadoutNoise(model);
  return (bits) => {
    const index = searchCumulative(cumulative, rng() * total);
    for (const op of measures) {
      let bit = (index >>> op.qubits[0]) & 1;
      if (readout) bit = applyReadoutNoise(bit, model, rng);
      bits[op.clbits[0]] = bit;
    }
  };
}

/** First index whose cumulative probability exceeds `r`. */
function searchCumulative(cumulative, r) {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumulative[mid] > r) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * General path: replay the circuit for every shot, collapsing the state at
 * each measurement and drawing gate errors. Without gate noise the part
 * before the first measurement is simulated once and copied.
 */
function trajectorySampler(circuit, model, rng) {
  const ops = circuit.operations;
  const gateNoise = hasGateNoise(model);
  let start = 0;
  let prefix = null;
  if (!gateNoise) {
    prefix = new StateVector(circuit.numQubits);
    while (start < ops.length && ops[start].name !== 'measure') {
      applyGate(prefix, ops[start].name, ops[start].qubits, ops[start].params);
      start++;
    }
  }
  const state = new StateVector(circuit.numQubits);
  return (bits) => {
    if (prefix) state.copyFrom(prefix);
    else state.reset();
    for (let k = start; k < ops.length; k++) {
      const op = ops[k];
      if (op.name === 'measure') {
        const bit = state.measure(op.qubits[0], rng());
        bits[op.clbits[0]] = applyReadoutNoise(bit, model, rng);
      } else {
        applyGate(state, op.name, op.qubits, op.params);
        if (gateNoise) applyGateNoise(state, op.qubits, model, rng);
      }
    }
  };
}
