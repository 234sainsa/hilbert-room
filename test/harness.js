// Minimal in-browser test runner. Results are written as plain text so a
// headless browser (or a screen reader) can read them from the page.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export class AssertionError extends Error {}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new AssertionError(message);
}

export function assertEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new AssertionError(`${message} expected ${e}, got ${a}`.trim());
}

export function assertClose(actual, expected, tolerance, message = '') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new AssertionError(`${message} expected ${expected} ± ${tolerance}, got ${actual}`.trim());
  }
}

export function assertThrows(fn, message = 'expected an error') {
  try {
    fn();
  } catch {
    return;
  }
  throw new AssertionError(message);
}

/** Notes shown next to a passing test (measured values). */
let notes = [];
export function note(text) {
  notes.push(text);
}

/** Run every registered test and write the report into `output`. */
export async function runAll(output) {
  const lines = [];
  let passed = 0;
  for (const { name, fn } of tests) {
    notes = [];
    const started = performance.now();
    try {
      await fn();
      passed++;
      const ms = (performance.now() - started).toFixed(0);
      lines.push(`PASS  ${name} (${ms} ms)${notes.length ? ` — ${notes.join('; ')}` : ''}`);
    } catch (err) {
      lines.push(`FAIL  ${name} — ${err && err.message ? err.message : err}`);
    }
  }
  const failed = tests.length - passed;
  const summary = failed === 0 ? `ALL PASSED: ${passed}/${tests.length}` : `FAILED: ${failed} of ${tests.length}`;
  output.textContent = `${summary}\n\n${lines.join('\n')}\n`;
  output.dataset.status = failed === 0 ? 'pass' : 'fail';
  document.title = summary;
  return { passed, failed };
}
