import { test, assertEqual, assertThrows } from './harness.js';
import { Circuit, toQasm3, formatAngle, drawCircuit } from '../src/index.js';

test('OpenQASM 3: Bell circuit', () => {
  const qasm = toQasm3(new Circuit(2).h(0).cx(0, 1).measureAll());
  assertEqual(qasm, [
    'OPENQASM 3.0;',
    'include "stdgates.inc";',
    'qubit[2] q;',
    'bit[2] c;',
    'h q[0];',
    'cx q[0], q[1];',
    'c[0] = measure q[0];',
    'c[1] = measure q[1];',
    '',
  ].join('\n'));
});

test('OpenQASM 3: every gate, angles and register options', () => {
  const c = new Circuit(3, 1)
    .h(0).x(1).y(2).z(0).s(1).sdg(2).t(0).tdg(1)
    .rx(Math.PI / 2, 0).ry(-3 * Math.PI / 4, 1).rz(0.3, 2)
    .cx(2, 0).cz(0, 1).swap(1, 2)
    .measure(2, 0);
  assertEqual(toQasm3(c, { qubitName: 'qr', bitName: 'out' }), [
    'OPENQASM 3.0;',
    'include "stdgates.inc";',
    'qubit[3] qr;',
    'bit[1] out;',
    'h qr[0];',
    'x qr[1];',
    'y qr[2];',
    'z qr[0];',
    's qr[1];',
    'sdg qr[2];',
    't qr[0];',
    'tdg qr[1];',
    'rx(pi/2) qr[0];',
    'ry(-3*pi/4) qr[1];',
    'rz(0.3) qr[2];',
    'cx qr[2], qr[0];',
    'cz qr[0], qr[1];',
    'swap qr[1], qr[2];',
    'out[0] = measure qr[2];',
    '',
  ].join('\n'));
  assertEqual(toQasm3(new Circuit(1).h(0).measure(0), { measurements: false }),
    'OPENQASM 3.0;\ninclude "stdgates.inc";\nqubit[1] q;\nh q[0];\n', 'without measurements');
  assertThrows(() => toQasm3(c, { qubitName: '1q' }), 'bad identifier');
  assertThrows(() => toQasm3(c, { qubitName: 'r', bitName: 'r' }), 'same register names');
});

test('angle formatting', () => {
  assertEqual(formatAngle(0), '0');
  assertEqual(formatAngle(Math.PI), 'pi');
  assertEqual(formatAngle(-Math.PI / 2), '-pi/2');
  assertEqual(formatAngle(2 * Math.PI / 3), '2*pi/3');
  assertEqual(formatAngle(1), '1.0');
  assertEqual(formatAngle(1.25), '1.25');
  assertEqual(formatAngle(1e-20), '1e-20');
});

test('text diagram of a Bell circuit', () => {
  const text = drawCircuit(new Circuit(2).h(0).cx(0, 1).measureAll());
  assertEqual(text, [
    'q0: ──H──●──M→c0──',
    '         │',
    'q1: ─────⊕──M→c1──',
  ].join('\n'));
});
