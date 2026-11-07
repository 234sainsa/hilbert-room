# HILBERT ROOM

A small, dependency-free quantum circuit simulator for the browser, written as plain ES modules. It keeps the full state vector, so results are exact up to floating-point rounding.

Typical uses:

- try a circuit locally before sending it to a quantum computing service,
- make dry runs that produce counts in the same shape as hardware results (optionally with a simple noise model),
- show a circuit, its exact state and its measurement statistics on a web page.

No build step, no runtime dependencies. Open `index.html` through any static web server for an interactive demo.

> **This is a classical simulation.** Measurement outcomes are drawn from a classical random number generator — by default the platform's `crypto.getRandomValues`, or a seeded pseudo-random generator for reproducible runs. They are **not** quantum randomness and do not come from quantum hardware. Do not present simulated results as hardware results.

## Quick start

```js
import { Circuit, run, toQasm3 } from './src/index.js';

const bell = new Circuit(2).h(0).cx(0, 1).measureAll();

const result = run(bell, { shots: 1000 });
console.log(result.counts);      // e.g. { '00': 507, '11': 493 }

console.log(toQasm3(bell));
// OPENQASM 3.0;
// include "stdgates.inc";
// qubit[2] q;
// bit[2] c;
// h q[0];
// cx q[0], q[1];
// c[0] = measure q[0];
// c[1] = measure q[1];
```

ES modules do not load from `file://` URLs in most browsers, so serve the folder over HTTP, for example:

```sh
python -m http.server 8000
# then open http://localhost:8000/        (demo)
#        or http://localhost:8000/test/   (test suite)
```

## Bit order

Qubit 0 is the **least significant** bit, the same convention as Qiskit:

- In bitstrings (`counts`, `memory`, `entries()`), classical bit 0 is the **rightmost** character. `new Circuit(3).x(0).measureAll()` gives `'001'`.
- In state vectors, basis index `i` has qubit `k` set when bit `k` of `i` is 1.
- In two-qubit gate matrices from `gateMatrix`, the first listed qubit is bit 0 of the row/column index.

## API

Everything is exported from `src/index.js`.

### `new Circuit(numQubits, numClbits = numQubits)`

Builder methods return the circuit, so calls chain. Angles are in radians.

| Method | Gate |
| --- | --- |
| `h(q)` `x(q)` `y(q)` `z(q)` | Hadamard, Pauli X / Y / Z |
| `s(q)` `sdg(q)` `t(q)` `tdg(q)` | S, S†, T, T† |
| `rx(θ, q)` `ry(θ, q)` `rz(θ, q)` | rotations exp(−iθP/2) |
| `cx(control, target)` | controlled X |
| `cz(a, b)` | controlled Z |
| `swap(a, b)` | swap |
| `measure(q, c = q)` / `measure([q…], [c…])` | Z-basis measurement into classical bit(s) |
| `measureAll()` | measure qubit k into classical bit k |
| `append(name, qubits, params)` | any gate by name |

Other members: `operations` (array of `{ name, qubits, params, clbits }`), `hasMeasurements()`, `measurementsAreTerminal()`, `clone()`.

Gate matrices, including global phases, follow the OpenQASM 3 standard library (`stdgates.inc`) and Qiskit; for example `rz(θ) = diag(e^{−iθ/2}, e^{iθ/2})`.

### `run(circuit, options) → { shots, counts, memory }`

| Option | Default | Meaning |
| --- | --- | --- |
| `shots` | `1024` | number of samples |
| `rng` | `createCryptoRng()` | function returning a float in [0, 1) |
| `noise` | none | see [Noise model](#noise-model) |
| `memory` | `true` | keep one bitstring per shot in `memory` |

`counts` maps bitstrings to how often they occurred. Classical bits that no measurement writes read `0`. Measurements may appear mid-circuit; later gates then act on the collapsed state. Classically controlled gates and resets are not supported.

When there is no gate noise and no gate follows a measurement on the same qubit, the circuit is simulated once and every shot is drawn from the final distribution. Otherwise each shot is a separate simulation (Monte Carlo trajectory).

### Exact results

- `statevector(circuit) → StateVector` — final state of the gates, measurements ignored. Throws if a gate follows a measurement on the same qubit.
- `probabilities(circuit) → Float64Array` — probability of every basis state.
- `StateVector`: `re`, `im` (Float64Array), `numQubits`, `amplitude(i)`, `probabilities()`, `probabilityOfOne(q)`, `entries(threshold)` (non-zero basis states with bitstrings, for display), `measure(q, r)`, `apply1`, `applyControlled1`, `swap`, `clone()`, `norm2()`.

### Random numbers

- `createCryptoRng()` — default. Uses `crypto.getRandomValues` with 53 random bits per number. Not reproducible.
- `createSeededRng(seed)` — deterministic (sfc32 seeded through splitmix32); `seed` is a number or a string. The same seed and the same circuit give the same shots, which is what the tests use.

Any function returning uniform floats in [0, 1) can be passed as `rng`.

### Noise model

```js
run(circuit, {
  shots: 4000,
  noise: {
    depolarizing1: 0.001, // after every single-qubit gate
    depolarizing2: 0.01,  // after every two-qubit gate
    readout: 0.02,        // or { p01: 0.02, p10: 0.04 }
  },
});
```

- **Depolarizing**: after each gate, with probability `p` a uniformly random Pauli (identity included) is applied to the gate's qubits. On average this is ρ → (1 − p) ρ + p I/d, the same definition as Qiskit's `depolarizing_error`.
- **Readout**: each measured bit is flipped when it is recorded. `p01` is P(read 1 | true 0), `p10` is P(read 0 | true 1).

This is a deliberately simple model for dry runs. It does not model T1/T2 relaxation, crosstalk, gate-specific errors or a device's connectivity.

### OpenQASM 3

`toQasm3(circuit, { qubitName = 'q', bitName = 'c', measurements = true })` returns an OpenQASM 3 program. Every supported gate exists under the same name in `stdgates.inc`, and measurements are written as `c[i] = measure q[j];`. Angles that are multiples of π are written as `pi/2`, `-3*pi/4` and so on; others as float literals. `formatAngle(θ)` is exported on its own.

The output follows the [OpenQASM 3 specification](https://openqasm.com). A hardware service may still transpile the circuit to its native gates and qubit layout.

### Diagrams and matrices

- `drawCircuit(circuit) → string` — plain-text diagram, qubit 0 on top.
- `gateMatrix(name, params) → Matrix`, `GATE_NAMES`, `gateInfo(name)`, `applyGate(state, name, qubits, params)`.
- `Matrix` — small dense complex matrices (`multiply`, `dagger`, `kron`, `isUnitary`, `maxDiff`).

## Limits: qubits, memory and speed

A state of n qubits holds 2ⁿ complex numbers of 16 bytes. The hard limit is 24 qubits; around 20 is the practical ceiling in a browser tab.

| Qubits | State vector | One H gate | One CX gate | 2n−1 gates + 1000 shots | Same with gate noise |
| --- | --- | --- | --- | --- | --- |
| 10 | 16 KiB | 0.003 ms | 0.002 ms | 2 ms | 105 ms |
| 14 | 256 KiB | — | — | — | 1.5 s |
| 16 | 1 MiB | 0.11 ms | 0.13 ms | 8 ms | — |
| 20 | 16 MiB | 3.4 ms | 2.3 ms | 96 ms | — |
| 22 | 64 MiB | 20 ms | 9 ms | 444 ms | — |

Measured with `test/bench.html` in headless Chrome on a desktop PC; treat them as orders of magnitude. `run` also allocates a cumulative probability table of 8 · 2ⁿ bytes on the fast path. With gate noise or mid-circuit measurements every shot is a full simulation, so the cost is roughly (time per gate) × (gates) × (shots).

## Tests

Open `test/index.html` through a web server. The page runs every test and writes `ALL PASSED: n/n` or the failures as plain text (also in the page title), so it can be read by a headless browser:

```sh
chrome --headless=new --user-data-dir=<temp dir> --virtual-time-budget=60000 \
  --dump-dom http://localhost:8000/test/index.html
```

The suite checks gate matrices (unitarity and known values), the state-vector kernels against full-matrix multiplication, Bell and GHZ statistics, RY(θ) against sin²(θ/2), a CHSH value of about 2√2 (above the classical bound of 2), seeded reproducibility, mid-circuit measurement, both noise channels, OpenQASM output and the demo page.

## Trademarks

IBM Quantum and Qiskit are trademarks of International Business Machines Corporation. HILBERT ROOM is an independent project; it is not affiliated with, endorsed by or sponsored by IBM. Qiskit is mentioned only to describe conventions this library follows.

## License

[MIT](LICENSE)
