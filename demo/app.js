// Demo page controller: keeps the list of operations, rebuilds the
// circuit from it, runs it with the library and hands data to view.js.

import {
  Circuit, GATE_NAMES, gateInfo, run, statevector, toQasm3, drawCircuit, formatAngle,
  createCryptoRng, createSeededRng,
} from '../src/index.js';
import { renderOps, renderHistogram, renderState } from './view.js';

const MAX_DEMO_QUBITS = 12;   // keeps the state table and the page responsive
const MAX_STATE_ROWS = 64;

const $ = (id) => document.getElementById(id);

const model = { numQubits: 2, ops: [] }; // ops: {name, qubits, params}

/** Parse "0.3", "pi", "-pi/2", "3*pi/4", "2pi" into radians. */
function parseAngle(text) {
  const t = text.trim().toLowerCase().replace(/\s+/g, '').replace(/π/g, 'pi');
  const number = Number(t);
  if (t !== '' && Number.isFinite(number)) return number;
  const m = /^([+-])?(\d*\.?\d*)\*?pi(?:\/(\d*\.?\d+))?$/.exec(t);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  const factor = m[2] === '' ? 1 : Number(m[2]);
  const divisor = m[3] === undefined ? 1 : Number(m[3]);
  return (sign * factor * Math.PI) / divisor;
}

function buildCircuit() {
  const c = new Circuit(model.numQubits);
  for (const op of model.ops) {
    if (op.name === 'measure') c.measure(op.qubits[0], op.qubits[0]);
    else c.append(op.name, op.qubits, op.params);
  }
  return c;
}

function describe(op) {
  const qubits = op.qubits.map((q) => `q${q}`).join(', ');
  if (op.name === 'measure') return `measure ${qubits} into c${op.qubits[0]}`;
  const params = op.params.length ? `(${op.params.map(formatAngle).join(', ')})` : '';
  return `${op.name}${params} ${qubits}`;
}

function arityOf(name) {
  return name === 'measure' ? 1 : gateInfo(name).qubits;
}

function paramCountOf(name) {
  return name === 'measure' ? 0 : gateInfo(name).params;
}

function fillQubitSelect(select) {
  const previous = Number(select.value);
  select.replaceChildren();
  for (let q = 0; q < model.numQubits; q++) select.append(new Option(`q${q}`, String(q)));
  if (previous < model.numQubits) select.value = String(previous);
}

function updateForm() {
  const name = $('gate-name').value;
  const two = arityOf(name) === 2;
  $('second-label').hidden = !two;
  $('angle-label').hidden = paramCountOf(name) === 0;
  const info = name === 'cx' ? ['Control qubit', 'Target qubit'] : ['Qubit', 'Second qubit'];
  $('first-label').firstChild.textContent = `${info[0]} `;
  $('second-label').firstChild.textContent = `${info[1]} `;
  if (two && $('gate-q1').value === $('gate-q2').value && model.numQubits > 1) {
    $('gate-q2').value = String((Number($('gate-q1').value) + 1) % model.numQubits);
  }
}

function refreshCircuit() {
  const circuit = buildCircuit();
  $('diagram').textContent = drawCircuit(circuit);
  $('qasm').textContent = toQasm3(circuit);
  renderOps($('ops'), $('ops-empty'), model.ops.map(describe), (i) => {
    model.ops.splice(i, 1);
    refreshCircuit();
  });
  if (circuit.measurementsAreTerminal()) {
    const entries = statevector(circuit).entries(1e-12);
    const shown = entries.slice(0, MAX_STATE_ROWS);
    const more = entries.length > shown.length ? `Showing ${shown.length} of ${entries.length} basis states.` : undefined;
    renderState($('state'), shown, more);
  } else {
    renderState($('state'), null, 'A gate follows a measurement on the same qubit, so there is no single final state to show. Run shots instead.');
  }
}

function setQubits(n) {
  const before = model.ops.length;
  model.numQubits = n;
  model.ops = model.ops.filter((op) => op.qubits.every((q) => q < n));
  fillQubitSelect($('gate-q1'));
  fillQubitSelect($('gate-q2'));
  updateForm();
  refreshCircuit();
  const dropped = before - model.ops.length;
  $('run-status').textContent = dropped ? `Removed ${dropped} operation(s) that used qubits beyond q${n - 1}.` : '';
}

const PRESETS = {
  bell: () => ({ n: 2, ops: [['h', [0]], ['cx', [0, 1]]] }),
  ghz: () => ({ n: 3, ops: [['h', [0]], ['cx', [0, 1]], ['cx', [1, 2]]] }),
  uniform: () => ({ n: 3, ops: [['h', [0]], ['h', [1]], ['h', [2]]] }),
  ry: () => ({ n: 1, ops: [['ry', [0], [Math.PI / 3]]] }),
};

function loadPreset(key) {
  const { n, ops } = PRESETS[key]();
  model.ops = [];
  $('num-qubits').value = String(n);
  setQubits(n);
  model.ops = ops.map(([name, qubits, params = []]) => ({ name, qubits, params }));
  for (let q = 0; q < n; q++) model.ops.push({ name: 'measure', qubits: [q], params: [] });
  refreshCircuit();
  $('run-status').textContent = `Loaded example with ${n} qubit(s).`;
}

function addGate(event) {
  event.preventDefault();
  const name = $('gate-name').value;
  const qubits = [Number($('gate-q1').value)];
  if (arityOf(name) === 2) qubits.push(Number($('gate-q2').value));
  const params = [];
  if (paramCountOf(name) > 0) {
    const theta = parseAngle($('gate-angle').value);
    if (!Number.isFinite(theta)) {
      $('form-error').textContent = 'The angle must be a number or a multiple of pi, such as 0.3, pi/2 or -3*pi/4.';
      return;
    }
    params.push(theta);
  }
  try {
    if (name !== 'measure') new Circuit(model.numQubits).append(name, qubits, params); // validation only
  } catch (err) {
    $('form-error').textContent = err.message;
    return;
  }
  $('form-error').textContent = '';
  model.ops.push({ name, qubits, params });
  refreshCircuit();
}

function readPercent(id) {
  const v = Number($(id).value);
  if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error('Noise percentages must be between 0 and 100.');
  return v / 100;
}

function runShots() {
  const status = $('run-status');
  try {
    let circuit = buildCircuit();
    let added = '';
    if (!circuit.hasMeasurements()) {
      circuit = circuit.measureAll();
      added = ' No measurements were in the circuit, so every qubit was measured at the end.';
    }
    const shots = Number($('shots').value);
    if (!Number.isInteger(shots) || shots < 1 || shots > 100000) throw new Error('Shots must be a whole number from 1 to 100000.');
    const seeded = document.querySelector('input[name="rng"]:checked').value === 'seeded';
    const rng = seeded ? createSeededRng($('seed').value) : createCryptoRng();
    const noise = {
      readout: readPercent('noise-readout'),
      depolarizing1: readPercent('noise-dep1'),
      depolarizing2: readPercent('noise-dep2'),
    };
    const started = performance.now();
    const result = run(circuit, { shots, rng, noise, memory: false });
    const ms = performance.now() - started;
    const rows = Object.entries(result.counts)
      .map(([bitstring, count]) => ({ bitstring, count }))
      .sort((a, b) => (a.bitstring < b.bitstring ? -1 : 1));
    renderHistogram($('histogram'), rows, shots);
    const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 8)
      .map((r) => `${r.bitstring}: ${r.count}`).join(', ');
    const source = seeded ? `seeded generator, seed "${$('seed').value}"` : 'crypto.getRandomValues';
    status.textContent = `Simulated ${shots} shots in ${ms.toFixed(0)} ms using ${source}. `
      + `${rows.length} distinct outcome(s). Most frequent: ${top}.${added}`;
  } catch (err) {
    status.textContent = `Could not run: ${err.message}`;
  }
}

async function copyQasm() {
  try {
    await navigator.clipboard.writeText($('qasm').textContent);
    $('copy-status').textContent = 'Copied.';
  } catch {
    $('copy-status').textContent = 'Copy failed; select the text above instead.';
  }
}

function init() {
  for (let n = 1; n <= MAX_DEMO_QUBITS; n++) $('num-qubits').append(new Option(String(n), String(n)));
  $('num-qubits').value = String(model.numQubits);
  for (const name of [...GATE_NAMES, 'measure']) $('gate-name').append(new Option(name, name));
  fillQubitSelect($('gate-q1'));
  fillQubitSelect($('gate-q2'));

  $('num-qubits').addEventListener('change', (e) => setQubits(Number(e.target.value)));
  $('gate-name').addEventListener('change', updateForm);
  $('gate-q1').addEventListener('change', updateForm);
  $('gate-form').addEventListener('submit', addGate);
  $('undo').addEventListener('click', () => { model.ops.pop(); refreshCircuit(); });
  $('clear').addEventListener('click', () => { model.ops = []; refreshCircuit(); });
  $('run').addEventListener('click', runShots);
  $('copy-qasm').addEventListener('click', copyQasm);
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => loadPreset(b.dataset.preset)));

  updateForm();
  loadPreset('bell');
  renderHistogram($('histogram'), [], 0);
  $('run-status').textContent = '';
}

init();
