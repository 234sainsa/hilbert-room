import { test, assert, assertEqual, assertClose, assertThrows } from './harness.js';
import { Circuit, StateVector, statevector, indexToBitstring, MAX_QUBITS } from '../src/index.js';

test('state vector starts in |0…0⟩ and keeps its norm', () => {
  const s = new StateVector(4);
  assertEqual(s.amplitude(0), [1, 0]);
  assertClose(s.norm2(), 1, 1e-15);
  const c = new Circuit(4).h(0).ry(0.7, 1).cx(0, 2).rz(1.1, 3).swap(1, 3).t(2);
  assertClose(statevector(c).norm2(), 1, 1e-12, 'norm after gates');
});

test('measurement collapses the state', () => {
  const s = statevector(new Circuit(2).h(0).cx(0, 1));
  const outcome = s.measure(0, 0.9); // p(1) = 0.5, so r = 0.9 gives 0
  assertEqual(outcome, 0);
  assertClose(s.probabilityOfOne(1), 0, 1e-12, 'partner qubit follows');
  assertClose(s.norm2(), 1, 1e-12, 'renormalised');
});

test('bit order: qubit 0 is the rightmost character', () => {
  assertEqual(indexToBitstring(1, 3), '001');
  const entries = statevector(new Circuit(3).x(0)).entries();
  assertEqual(entries.map((e) => e.bitstring), ['001']);
});

test('circuit builder validates its input', () => {
  assertThrows(() => new Circuit(0), 'zero qubits');
  assertThrows(() => new Circuit(MAX_QUBITS + 1), 'too many qubits');
  assertThrows(() => new Circuit(2).h(2), 'qubit out of range');
  assertThrows(() => new Circuit(2).cx(1, 1), 'same qubit twice');
  assertThrows(() => new Circuit(2).ry(NaN, 0), 'NaN angle');
  assertThrows(() => new Circuit(2).append('ccx', [0, 1]), 'unknown gate');
  assertThrows(() => new Circuit(2, 1).measure(0, 1), 'clbit out of range');
  assertThrows(() => new Circuit(2, 1).measureAll(), 'not enough clbits');
});

test('builder records operations in order and chains', () => {
  const c = new Circuit(2).h(0).cx(0, 1).rz(0.5, 1).measure([0, 1], [1, 0]);
  assertEqual(c.operations.map((op) => op.name), ['h', 'cx', 'rz', 'measure', 'measure']);
  assertEqual(c.operations[3].clbits, [1]);
  assertEqual(c.operations[2].params, [0.5]);
  const copy = c.clone();
  copy.x(0);
  assertEqual(c.operations.length, 5, 'clone is independent');
});

test('terminal-measurement detection', () => {
  assert(new Circuit(2).h(0).measureAll().measurementsAreTerminal(), 'all at end');
  assert(new Circuit(2).measure(1).h(0).measurementsAreTerminal(), 'gate on another qubit');
  assert(!new Circuit(2).measure(0).h(0).measurementsAreTerminal(), 'gate after measure');
  assertThrows(() => statevector(new Circuit(1).measure(0).h(0)), 'statevector refuses mid-circuit measurement');
});
