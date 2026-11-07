// Plain-text circuit diagram. Qubit 0 is the top line. Returns a string so
// it can be shown in a <pre>, a console or a test without any DOM.

import { formatAngle } from './angle.js';

/** Label drawn on each qubit an operation touches, in the order of op.qubits. */
function labelsFor(op) {
  switch (op.name) {
    case 'cx': return ['●', '⊕'];
    case 'cz': return ['●', '●'];
    case 'swap': return ['×', '×'];
    case 'measure': return [`M→c${op.clbits[0]}`];
    default: {
      const name = op.name.toUpperCase();
      const params = op.params.length ? `(${op.params.map(formatAngle).join(',')})` : '';
      return [name + params];
    }
  }
}

/** Put each operation in the first column free across its whole span. */
function layout(circuit) {
  const nextFree = new Array(circuit.numQubits).fill(0);
  const columns = [];
  for (const op of circuit.operations) {
    const lo = Math.min(...op.qubits);
    const hi = Math.max(...op.qubits);
    let col = 0;
    for (let q = lo; q <= hi; q++) col = Math.max(col, nextFree[q]);
    for (let q = lo; q <= hi; q++) nextFree[q] = col + 1;
    if (!columns[col]) columns[col] = [];
    columns[col].push({ op, lo, hi, labels: labelsFor(op) });
  }
  return columns;
}

function center(text, width, fill) {
  const chars = Array.from(text);
  const left = Math.floor((width - chars.length) / 2);
  const right = width - chars.length - left;
  return fill.repeat(left) + text + fill.repeat(right);
}

/**
 * @param {import('./circuit.js').Circuit} circuit
 * @returns {string}
 */
export function drawCircuit(circuit) {
  const n = circuit.numQubits;
  const names = Array.from({ length: n }, (_, q) => `q${q}: `);
  const nameWidth = Math.max(...names.map((s) => s.length));
  const wires = names.map((s) => s.padStart(nameWidth, ' ') + '─');
  const gaps = Array.from({ length: n - 1 }, () => ' '.repeat(nameWidth + 1));

  for (const entries of layout(circuit)) {
    const labelWidth = Math.max(...entries.flatMap((e) => e.labels.map((l) => Array.from(l).length)));
    const width = labelWidth + 2;
    const mid = Math.floor((width - 1) / 2);
    const vertical = ' '.repeat(mid) + '│' + ' '.repeat(width - mid - 1);
    const cross = '─'.repeat(mid) + '┼' + '─'.repeat(width - mid - 1);
    const cells = new Array(n).fill('─'.repeat(width));
    const gapCells = new Array(n - 1).fill(' '.repeat(width));
    for (const { op, lo, hi, labels } of entries) {
      for (let q = lo; q <= hi; q++) {
        const at = op.qubits.indexOf(q);
        cells[q] = at >= 0 ? center(labels[at], width, '─') : cross;
        if (q < hi) gapCells[q] = vertical;
      }
    }
    for (let q = 0; q < n; q++) wires[q] += cells[q];
    for (let g = 0; g < n - 1; g++) gaps[g] += gapCells[g];
  }

  const rows = [];
  for (let q = 0; q < n; q++) {
    rows.push(wires[q] + '─');
    if (q < n - 1) rows.push(gaps[q].trimEnd());
  }
  return rows.join('\n');
}
