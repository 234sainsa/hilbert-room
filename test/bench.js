// Rough speed check: time per gate and per run at several register sizes.
// Numbers depend on the machine and browser; they are for orders of magnitude.

import { Circuit, StateVector, applyGate, run, createSeededRng } from '../src/index.js';

function time(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function benchSize(n) {
  const state = new StateVector(n);
  const reps = Math.max(1, Math.round(2 ** 20 / 2 ** n) * 4);
  const h = time(() => {
    for (let k = 0; k < reps; k++) applyGate(state, 'h', [k % n]);
  }) / reps;
  const cx = time(() => {
    for (let k = 0; k < reps; k++) applyGate(state, 'cx', [k % n, (k + 1) % n]);
  }) / reps;

  // Layered circuit: H on every qubit, then a CX chain, measured at the end.
  const c = new Circuit(n);
  for (let q = 0; q < n; q++) c.h(q);
  for (let q = 1; q < n; q++) c.cx(q - 1, q);
  c.measureAll();
  const runMs = time(() => run(c, { shots: 1000, rng: createSeededRng(1), memory: false }));

  const mib = (2 ** n * 16) / 2 ** 20;
  return `${String(n).padStart(2)} qubits  state ${mib.toFixed(mib < 1 ? 3 : 0).padStart(6)} MiB  `
    + `H ${h.toFixed(3).padStart(8)} ms  CX ${cx.toFixed(3).padStart(8)} ms  `
    + `run(${2 * n - 1} gates, 1000 shots) ${runMs.toFixed(1).padStart(8)} ms`;
}

const out = document.getElementById('results');
const lines = [navigator.userAgent, ''];
// Synchronous on purpose: the page is finished when the load event fires,
// so a headless browser can dump it without a time budget.
for (const n of [10, 16, 20, 22]) lines.push(benchSize(n));

// Gate noise forces one full simulation per shot (trajectory path).
for (const n of [10, 14]) {
  const c = new Circuit(n);
  for (let q = 0; q < n; q++) c.h(q);
  for (let q = 1; q < n; q++) c.cx(q - 1, q);
  c.measureAll();
  const ms = time(() => run(c, {
    shots: 1000, rng: createSeededRng(1), memory: false, noise: { depolarizing1: 0.001, depolarizing2: 0.01 },
  }));
  lines.push(`${String(n).padStart(2)} qubits  noisy run(${2 * n - 1} gates, 1000 shots, per-shot simulation) ${ms.toFixed(1)} ms`);
}
lines.push('', 'DONE');
out.textContent = lines.join('\n');
out.dataset.status = 'done';
