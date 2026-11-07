import { test, assert, assertClose, note } from './harness.js';
import { Matrix, GATE_NAMES, gateInfo, gateMatrix, applyGate, createSeededRng } from '../src/index.js';
import { randomState, embed, multiply, stateDiff } from './helpers.js';

const R = Math.SQRT1_2;
const EPS = 1e-12;

function paramsFor(name, rng) {
  return Array.from({ length: gateInfo(name).params }, () => (rng() * 2 - 1) * 2 * Math.PI);
}

test('every gate matrix is unitary', () => {
  const rng = createSeededRng(1);
  for (const name of GATE_NAMES) {
    for (let k = 0; k < 5; k++) {
      assert(gateMatrix(name, paramsFor(name, rng)).isUnitary(EPS), `${name} is not unitary`);
    }
  }
  note(`${GATE_NAMES.length} gates`);
});

test('single-qubit gates have the standard matrices', () => {
  const expected = {
    h: [[R, R], [R, -R]],
    x: [[0, 1], [1, 0]],
    y: [[0, [0, -1]], [[0, 1], 0]],
    z: [[1, 0], [0, -1]],
    s: [[1, 0], [0, [0, 1]]],
    sdg: [[1, 0], [0, [0, -1]]],
    t: [[1, 0], [0, [R, R]]],
    tdg: [[1, 0], [0, [R, -R]]],
  };
  for (const [name, rows] of Object.entries(expected)) {
    assert(gateMatrix(name).maxDiff(Matrix.fromRows(rows)) < EPS, `${name} matrix`);
  }
});

test('rotation gates match exp(-i θ P / 2)', () => {
  const pi = Math.PI;
  // rx(pi) = -iX, ry(pi) = -iY, rz(pi) = -iZ
  assert(gateMatrix('rx', [pi]).maxDiff(Matrix.fromRows([[0, [0, -1]], [[0, -1], 0]])) < EPS, 'rx(pi)');
  assert(gateMatrix('ry', [pi]).maxDiff(Matrix.fromRows([[0, -1], [1, 0]])) < EPS, 'ry(pi)');
  assert(gateMatrix('rz', [pi]).maxDiff(Matrix.fromRows([[[0, -1], 0], [0, [0, 1]]])) < EPS, 'rz(pi)');
  // ry(pi/2) = [[c, -s], [s, c]] with c = s = 1/√2
  assert(gateMatrix('ry', [pi / 2]).maxDiff(Matrix.fromRows([[R, -R], [R, R]])) < EPS, 'ry(pi/2)');
  // rz(pi/2) = diag(e^{-iπ/4}, e^{iπ/4})
  assert(gateMatrix('rz', [pi / 2]).maxDiff(Matrix.fromRows([[[R, -R], 0], [0, [R, R]]])) < EPS, 'rz(pi/2)');
  // rotations by 0 are the identity
  for (const g of ['rx', 'ry', 'rz']) assert(gateMatrix(g, [0]).maxDiff(Matrix.identity(2)) < EPS, `${g}(0)`);
});

test('gate identities: HH = I, SS = Z, TT = S, S·Sdg = I, T·Tdg = I', () => {
  const m = (n) => gateMatrix(n);
  assert(m('h').multiply(m('h')).maxDiff(Matrix.identity(2)) < EPS, 'HH');
  assert(m('s').multiply(m('s')).maxDiff(m('z')) < EPS, 'SS');
  assert(m('t').multiply(m('t')).maxDiff(m('s')) < EPS, 'TT');
  assert(m('s').multiply(m('sdg')).maxDiff(Matrix.identity(2)) < EPS, 'S Sdg');
  assert(m('t').multiply(m('tdg')).maxDiff(Matrix.identity(2)) < EPS, 'T Tdg');
});

test('two-qubit gate matrices (little-endian, first qubit is bit 0)', () => {
  // cx with control = qubit 0: |q1 q0⟩ = |01⟩ ↔ |11⟩
  const cx = Matrix.fromRows([[1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0], [0, 1, 0, 0]]);
  const cz = Matrix.fromRows([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, -1]]);
  const swap = Matrix.fromRows([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]]);
  assert(gateMatrix('cx').maxDiff(cx) < EPS, 'cx');
  assert(gateMatrix('cz').maxDiff(cz) < EPS, 'cz');
  assert(gateMatrix('swap').maxDiff(swap) < EPS, 'swap');
});

test('state-vector kernels agree with the full matrix on every qubit choice', () => {
  const rng = createSeededRng('kernels');
  const n = 3;
  let checks = 0;
  for (const name of GATE_NAMES) {
    const arity = gateInfo(name).qubits;
    const choices = [];
    for (let a = 0; a < n; a++) {
      if (arity === 1) choices.push([a]);
      else for (let b = 0; b < n; b++) if (a !== b) choices.push([a, b]);
    }
    for (const qubits of choices) {
      const params = paramsFor(name, rng);
      const start = randomState(n, rng);
      const fast = applyGate(start.clone(), name, qubits, params);
      const slow = multiply(embed(name, params, qubits, n), start);
      assert(stateDiff(fast, slow) < 1e-12, `${name} on ${qubits}`);
      checks++;
    }
  }
  note(`${checks} gate placements on random 3-qubit states`);
});
