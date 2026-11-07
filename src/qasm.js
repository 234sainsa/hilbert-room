// Export to OpenQASM 3 (https://openqasm.com). Every supported gate is in
// the standard library "stdgates.inc" under the same name, so the output
// can be sent unchanged to services that accept OpenQASM 3.

import { gateInfo } from './gates.js';
import { formatAngle } from './angle.js';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * @param {import('./circuit.js').Circuit} circuit
 * @param {object} [options]
 * @param {string} [options.qubitName='q']
 * @param {string} [options.bitName='c']
 * @param {boolean} [options.measurements=true]  include measurements
 * @returns {string}
 */
export function toQasm3(circuit, options = {}) {
  const qubitName = options.qubitName ?? 'q';
  const bitName = options.bitName ?? 'c';
  const withMeasurements = options.measurements ?? true;
  for (const name of [qubitName, bitName]) {
    if (!IDENTIFIER.test(name)) throw new Error(`toQasm3: "${name}" is not a valid identifier`);
  }
  if (qubitName === bitName) throw new Error('toQasm3: qubit and bit registers need different names');

  const lines = ['OPENQASM 3.0;', 'include "stdgates.inc";', `qubit[${circuit.numQubits}] ${qubitName};`];
  const declareBits = withMeasurements && circuit.numClbits > 0;
  if (declareBits) lines.push(`bit[${circuit.numClbits}] ${bitName};`);

  for (const op of circuit.operations) {
    const qubits = op.qubits.map((q) => `${qubitName}[${q}]`).join(', ');
    if (op.name === 'measure') {
      if (withMeasurements) lines.push(`${bitName}[${op.clbits[0]}] = measure ${qubits};`);
      continue;
    }
    gateInfo(op.name); // throws on unknown gates
    const params = op.params.length ? `(${op.params.map(formatAngle).join(', ')})` : '';
    lines.push(`${op.name}${params} ${qubits};`);
  }
  return `${lines.join('\n')}\n`;
}
