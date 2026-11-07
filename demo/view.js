// DOM rendering for the demo page. Receives plain data, writes elements;
// no simulation happens here.

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function percent(x) {
  return `${(x * 100).toFixed(x < 0.001 && x > 0 ? 3 : 1)}%`;
}

/** Ordered list of operations, each with a remove button. */
export function renderOps(list, empty, items, onRemove) {
  list.replaceChildren();
  items.forEach((text, i) => {
    const li = el('li');
    li.append(el('span', {}, text), ' ');
    const button = el('button', { type: 'button', 'aria-label': `Remove step ${i + 1}: ${text}` }, 'Remove');
    button.addEventListener('click', () => onRemove(i));
    li.append(button);
    list.append(li);
  });
  empty.hidden = items.length > 0;
}

/**
 * Bar chart of counts plus the same numbers as a table.
 * @param {HTMLElement} root
 * @param {{bitstring: string, count: number}[]} rows  sorted for display
 * @param {number} shots
 */
export function renderHistogram(root, rows, shots) {
  root.replaceChildren();
  if (!rows.length) {
    root.append(el('p', {}, 'No run yet.'));
    return;
  }
  const max = Math.max(...rows.map((r) => r.count));
  const chart = el('div', { class: 'bars', 'aria-hidden': 'true' });
  for (const { bitstring, count } of rows) {
    const bar = el('div', { class: 'bar' });
    const fill = el('div', { class: 'fill' });
    fill.style.height = `${(count / max) * 100}%`;
    bar.append(el('span', { class: 'value' }, String(count)), fill, el('span', { class: 'label' }, bitstring));
    chart.append(bar);
  }
  const table = el('table');
  table.append(el('caption', {}, `Counts from ${shots} shots`));
  const head = el('tr');
  ['Bitstring', 'Count', 'Frequency'].forEach((h) => head.append(el('th', { scope: 'col' }, h)));
  table.append(head);
  for (const { bitstring, count } of rows) {
    const tr = el('tr');
    tr.append(el('th', { scope: 'row' }, bitstring), el('td', {}, String(count)), el('td', {}, percent(count / shots)));
    table.append(tr);
  }
  root.append(chart, table);
}

/**
 * Table of exact basis-state probabilities.
 * @param {HTMLElement} root
 * @param {{bitstring: string, re: number, im: number, probability: number}[]|null} entries
 * @param {string} [message]  shown instead of the table
 */
export function renderState(root, entries, message) {
  root.replaceChildren();
  if (!entries) {
    root.append(el('p', {}, message ?? ''));
    return;
  }
  const table = el('table');
  table.append(el('caption', {}, 'Final state before measurement (basis states with non-zero probability)'));
  const head = el('tr');
  ['Basis state', 'Amplitude', 'Probability'].forEach((h) => head.append(el('th', { scope: 'col' }, h)));
  table.append(head);
  for (const e of entries) {
    const tr = el('tr');
    const sign = e.im < 0 ? '−' : '+';
    const amp = `${e.re.toFixed(4)} ${sign} ${Math.abs(e.im).toFixed(4)}i`;
    tr.append(el('th', { scope: 'row' }, `|${e.bitstring}⟩`), el('td', {}, amp), el('td', {}, percent(e.probability)));
    table.append(tr);
  }
  root.append(table);
  if (message) root.append(el('p', { class: 'hint' }, message));
}
