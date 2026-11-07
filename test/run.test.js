import { test, assert, assertEqual, assertClose, assertThrows, note } from './harness.js';
import { Circuit, run, probabilities, createSeededRng, createCryptoRng } from '../src/index.js';
import { correlation } from './helpers.js';

const SHOTS = 20000;

/** Allowed deviation of a sampled frequency: 5 standard deviations. */
function band(p, shots) {
  return 5 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / shots) + 1e-9;
}

test('Bell state gives only 00 and 11, about half each', () => {
  const bell = new Circuit(2).h(0).cx(0, 1).measureAll();
  const { counts, memory, shots } = run(bell, { shots: SHOTS, rng: createSeededRng(7) });
  assertEqual(Object.keys(counts).sort(), ['00', '11']);
  assertEqual(memory.length, shots);
  assertClose(counts['00'] / SHOTS, 0.5, band(0.5, SHOTS), 'P(00)');
  note(`00=${counts['00']}, 11=${counts['11']}`);
});

test('5-qubit GHZ state gives only 00000 and 11111', () => {
  const ghz = new Circuit(5).h(0);
  for (let q = 1; q < 5; q++) ghz.cx(q - 1, q);
  ghz.measureAll();
  const { counts } = run(ghz, { shots: SHOTS, rng: createSeededRng(8) });
  assertEqual(Object.keys(counts).sort(), ['00000', '11111']);
  assertClose(counts['11111'] / SHOTS, 0.5, band(0.5, SHOTS), 'P(11111)');
  note(`00000=${counts['00000']}, 11111=${counts['11111']}`);
});

test('RY(θ): P(1) = sin²(θ/2) within 5σ', () => {
  const rng = createSeededRng(9);
  const report = [];
  for (const theta of [0, 0.3, Math.PI / 3, Math.PI / 2, 2, Math.PI - 0.1, Math.PI]) {
    const p = Math.sin(theta / 2) ** 2;
    const { counts } = run(new Circuit(1).ry(theta, 0).measure(0), { shots: SHOTS, rng });
    const freq = (counts['1'] ?? 0) / SHOTS;
    assertClose(freq, p, band(p, SHOTS), `θ=${theta}`);
    report.push(`θ=${theta.toFixed(3)}: ${freq.toFixed(4)} vs ${p.toFixed(4)}`);
  }
  note(report.join(', '));
});

test('bit order of results: x on qubit 0 of 3 reads 001', () => {
  const { counts } = run(new Circuit(3).x(0).measureAll(), { shots: 10, rng: createSeededRng(1) });
  assertEqual(counts, { '001': 10 });
  const swapped = run(new Circuit(2).x(0).measure([0, 1], [1, 0]), { shots: 3, rng: createSeededRng(1) });
  assertEqual(swapped.counts, { 10: 3 }, 'qubit 0 into clbit 1');
});

function chshAngles() {
  return { a: 0, a2: Math.PI / 2, b: Math.PI / 4, b2: -Math.PI / 4 };
}

/** Bell pair, then measure qubit 0 along angle x and qubit 1 along y (in the X-Z plane). */
function chshCircuit(x, y) {
  return new Circuit(2).h(0).cx(0, 1).ry(-x, 0).ry(-y, 1).measureAll();
}

function exactCorrelation(circuit) {
  const p = probabilities(circuit);
  return p[0] - p[1] - p[2] + p[3];
}

test('CHSH: S ≈ 2√2, above the classical bound of 2', () => {
  const { a, a2, b, b2 } = chshAngles();
  const pairs = [[a, b, 1], [a, b2, 1], [a2, b, 1], [a2, b2, -1]];
  const exact = pairs.reduce((s, [x, y, sign]) => s + sign * exactCorrelation(chshCircuit(x, y)), 0);
  assertClose(exact, 2 * Math.SQRT2, 1e-12, 'exact S');

  const rng = createSeededRng('chsh');
  const sampled = pairs.reduce((s, [x, y, sign]) => {
    const { counts } = run(chshCircuit(x, y), { shots: SHOTS, rng });
    return s + sign * correlation(counts);
  }, 0);
  // Each correlation has standard deviation ≤ 1/√shots; four of them add up.
  assertClose(sampled, 2 * Math.SQRT2, 5 * 2 / Math.sqrt(SHOTS), 'sampled S');
  assert(sampled > 2, 'sampled S beats the classical bound');
  note(`exact S=${exact.toFixed(6)}, sampled S=${sampled.toFixed(4)} (${SHOTS} shots per setting)`);
});

test('same seed gives the same shots; different seeds differ', () => {
  const c = new Circuit(3).h(0).h(1).h(2).measureAll();
  const one = run(c, { shots: 200, rng: createSeededRng(42) });
  const two = run(c, { shots: 200, rng: createSeededRng(42) });
  const other = run(c, { shots: 200, rng: createSeededRng(43) });
  assertEqual(one.memory, two.memory);
  assert(one.memory.join() !== other.memory.join(), 'seed 43 differs from 42');
  const mid = new Circuit(2).h(0).measure(0).cx(0, 1).h(0).measure([0, 1]);
  assertEqual(run(mid, { shots: 50, rng: createSeededRng('m') }).memory,
    run(mid, { shots: 50, rng: createSeededRng('m') }).memory, 'trajectory path too');
});

test('mid-circuit measurement collapses before later gates', () => {
  // Measure q0, copy it into q1, then scramble q0: c1 must equal c0's first value.
  const c = new Circuit(2, 3).h(0).measure(0, 0).cx(0, 1).h(0).measure(1, 1).measure(0, 2);
  const { counts } = run(c, { shots: 4000, rng: createSeededRng(5) });
  for (const bits of Object.keys(counts)) assertEqual(bits[1], bits[2], `c1 = c0 in ${bits}`);
  assertEqual(Object.keys(counts).length, 4, 'q0 is random again after the second H');
});

test('readout noise flips bits at the given rates', () => {
  const p01 = 0.1;
  const p10 = 0.2;
  const zero = run(new Circuit(1).measure(0), { shots: SHOTS, rng: createSeededRng(11), noise: { readout: { p01, p10 } } });
  const one = run(new Circuit(1).x(0).measure(0), { shots: SHOTS, rng: createSeededRng(12), noise: { readout: { p01, p10 } } });
  assertClose((zero.counts['1'] ?? 0) / SHOTS, p01, band(p01, SHOTS), 'P(read 1 | 0)');
  assertClose((one.counts['0'] ?? 0) / SHOTS, p10, band(p10, SHOTS), 'P(read 0 | 1)');
  note(`P(1|0)=${(zero.counts['1'] / SHOTS).toFixed(4)}, P(0|1)=${(one.counts['0'] / SHOTS).toFixed(4)}`);
});

test('depolarizing noise: X with p = 0.2 reads 0 with probability p/2', () => {
  const p = 0.2;
  const { counts } = run(new Circuit(1).x(0).measure(0), { shots: SHOTS, rng: createSeededRng(13), noise: { depolarizing1: p } });
  assertClose((counts['0'] ?? 0) / SHOTS, p / 2, band(p / 2, SHOTS), 'P(0)');
  const bell = run(new Circuit(2).h(0).cx(0, 1).measureAll(), { shots: SHOTS, rng: createSeededRng(14), noise: { depolarizing2: 0.3 } });
  const wrong = ((bell.counts['01'] ?? 0) + (bell.counts['10'] ?? 0)) / SHOTS;
  // 8 of the 16 two-qubit Paulis flip exactly one of the two bits.
  assertClose(wrong, 0.3 * 8 / 16, band(0.15, SHOTS), 'Bell errors');
  note(`P(0)=${((counts['0'] ?? 0) / SHOTS).toFixed(4)}, Bell odd parity=${wrong.toFixed(4)}`);
});

test('noise model and options are validated', () => {
  const c = new Circuit(1).measure(0);
  assertThrows(() => run(c, { noise: { readout: 2 } }), 'readout > 1');
  assertThrows(() => run(c, { noise: { depolarizing1: -0.1 } }), 'negative p');
  assertThrows(() => run(c, { shots: 0 }), 'zero shots');
  assertThrows(() => run(new Circuit(1).h(0)), 'no measurements');
  assertThrows(() => createSeededRng({}), 'bad seed');
});

test('default crypto source works and is roughly uniform', () => {
  const rng = createCryptoRng();
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const r = rng();
    assert(r >= 0 && r < 1, 'in [0, 1)');
    sum += r;
  }
  // Mean of U(0,1) has standard deviation 1/√(12n).
  assertClose(sum / n, 0.5, 6 / Math.sqrt(12 * n), 'mean');
  const { counts } = run(new Circuit(1).h(0).measure(0), { shots: 1000 });
  assertEqual((counts['0'] ?? 0) + (counts['1'] ?? 0), 1000);
});
