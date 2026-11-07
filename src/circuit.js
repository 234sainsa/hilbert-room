// Circuit builder: an ordered list of operations on numbered qubits and
// classical bits. Building does no simulation.

import { gateInfo, isGate } from './gates.js';
import { MAX_QUBITS } from './state.js';

/**
 * @typedef {object} Operation
 * @property {string} name      gate name, or 'measure'
 * @property {number[]} qubits
 * @property {number[]} params  angles in radians
 * @property {number[]} clbits  classical bit written by a measurement
 */

export class Circuit {
  /**
   * @param {number} numQubits
   * @param {number} [numClbits]  defaults to `numQubits`
   */
  constructor(numQubits, numClbits = numQubits) {
    if (!Number.isInteger(numQubits) || numQubits < 1 || numQubits > MAX_QUBITS) {
      throw new RangeError(`Circuit: number of qubits must be an integer from 1 to ${MAX_QUBITS}`);
    }
    if (!Number.isInteger(numClbits) || numClbits < 0) {
      throw new RangeError('Circuit: number of classical bits must be a non-negative integer');
    }
    this.numQubits = numQubits;
    this.numClbits = numClbits;
    /** @type {Operation[]} */
    this.operations = [];
  }

  /** Add any supported gate by name. */
  append(name, qubits, params = []) {
    if (!isGate(name)) throw new Error(`Circuit: unknown gate "${name}"`);
    const info = gateInfo(name);
    if (!Array.isArray(qubits) || qubits.length !== info.qubits) {
      throw new Error(`Circuit: ${name} acts on ${info.qubits} qubit(s)`);
    }
    if (!Array.isArray(params) || params.length !== info.params) {
      throw new Error(`Circuit: ${name} takes ${info.params} parameter(s)`);
    }
    qubits.forEach((q) => this.#checkQubit(q));
    if (new Set(qubits).size !== qubits.length) throw new Error(`Circuit: ${name} needs distinct qubits`);
    params.forEach((p) => {
      if (typeof p !== 'number' || !Number.isFinite(p)) throw new Error(`Circuit: ${name} parameter must be a finite number`);
    });
    this.operations.push({ name, qubits: [...qubits], params: [...params], clbits: [] });
    return this;
  }

  h(q) { return this.append('h', [q]); }
  x(q) { return this.append('x', [q]); }
  y(q) { return this.append('y', [q]); }
  z(q) { return this.append('z', [q]); }
  s(q) { return this.append('s', [q]); }
  sdg(q) { return this.append('sdg', [q]); }
  t(q) { return this.append('t', [q]); }
  tdg(q) { return this.append('tdg', [q]); }
  rx(theta, q) { return this.append('rx', [q], [theta]); }
  ry(theta, q) { return this.append('ry', [q], [theta]); }
  rz(theta, q) { return this.append('rz', [q], [theta]); }
  cx(control, target) { return this.append('cx', [control, target]); }
  cz(a, b) { return this.append('cz', [a, b]); }
  swap(a, b) { return this.append('swap', [a, b]); }

  /**
   * Measure qubit(s) in the Z basis into classical bit(s).
   * `measure(0)` writes clbit 0; `measure([0, 1], [1, 0])` pairs them up.
   */
  measure(qubits, clbits = qubits) {
    const qs = Array.isArray(qubits) ? qubits : [qubits];
    const cs = Array.isArray(clbits) ? clbits : [clbits];
    if (qs.length !== cs.length) throw new Error('Circuit: measure needs as many classical bits as qubits');
    qs.forEach((q, i) => {
      this.#checkQubit(q);
      this.#checkClbit(cs[i]);
      this.operations.push({ name: 'measure', qubits: [q], params: [], clbits: [cs[i]] });
    });
    return this;
  }

  /** Measure qubit k into classical bit k for every qubit. */
  measureAll() {
    if (this.numClbits < this.numQubits) {
      throw new Error('Circuit: measureAll needs at least as many classical bits as qubits');
    }
    const all = Array.from({ length: this.numQubits }, (_, i) => i);
    return this.measure(all, all);
  }

  /** True if some operation is a measurement. */
  hasMeasurements() {
    return this.operations.some((op) => op.name === 'measure');
  }

  /**
   * True if no gate touches a qubit after that qubit was measured, so all
   * measurements can be sampled from one final state.
   */
  measurementsAreTerminal() {
    const measured = new Set();
    for (const op of this.operations) {
      if (op.name === 'measure') {
        measured.add(op.qubits[0]);
      } else if (op.qubits.some((q) => measured.has(q))) {
        return false;
      }
    }
    return true;
  }

  clone() {
    const c = new Circuit(this.numQubits, this.numClbits);
    c.operations = this.operations.map((op) => ({
      name: op.name, qubits: [...op.qubits], params: [...op.params], clbits: [...op.clbits],
    }));
    return c;
  }

  #checkQubit(q) {
    if (!Number.isInteger(q) || q < 0 || q >= this.numQubits) {
      throw new RangeError(`Circuit: qubit ${q} is out of range 0..${this.numQubits - 1}`);
    }
  }

  #checkClbit(c) {
    if (!Number.isInteger(c) || c < 0 || c >= this.numClbits) {
      throw new RangeError(`Circuit: classical bit ${c} is out of range 0..${this.numClbits - 1}`);
    }
  }
}
