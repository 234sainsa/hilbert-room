// Smoke test of the demo page: load it in a same-origin iframe, press its
// buttons and read the text it writes.

import { test, assert, assertEqual, note } from './harness.js';

function loadDemo() {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width: 800px; height: 600px; position: absolute; left: -10000px;';
    frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', () => resolve(frame));
    frame.addEventListener('error', reject);
    frame.src = '../index.html';
    document.body.append(frame);
  });
}

test('demo page: Bell preset, seeded run, counts and QASM shown as text', async () => {
  const frame = await loadDemo();
  try {
    const doc = frame.contentDocument;
    const $ = (id) => doc.getElementById(id);
    assert($('diagram').textContent.includes('⊕'), 'diagram shows the CX target');
    assert($('qasm').textContent.startsWith('OPENQASM 3.0;'), 'QASM is shown');
    assertEqual($('ops').children.length, 4, 'H, CX and two measurements listed');

    doc.querySelector('input[name="rng"][value="seeded"]').checked = true;
    $('seed').value = 'demo';
    $('run').click();
    const status = $('run-status').textContent;
    assert(status.startsWith('Simulated 1024 shots'), `status: ${status}`);
    const rows = [...$('histogram').querySelectorAll('table th[scope="row"]')].map((th) => th.textContent);
    assertEqual(rows, ['00', '11'], 'only correlated outcomes');

    // Every button has an accessible name (text or aria-label).
    for (const b of doc.querySelectorAll('button')) {
      assert((b.getAttribute('aria-label') || b.textContent).trim().length > 0, 'button without a name');
    }

    $('clear').click();
    assertEqual($('ops').children.length, 0, 'cleared');
    $('gate-name').value = 'ry';
    $('gate-name').dispatchEvent(new Event('change'));
    $('gate-angle').value = '-3*pi/4';
    $('gate-form').requestSubmit();
    assert($('qasm').textContent.includes('ry(-3*pi/4) q[0];'), 'angle parsed and exported');
    note(status);
  } finally {
    frame.remove();
  }
});
