// State vector of n qubits: 2^n complex amplitudes in two Float64Arrays.
// Basis index i has qubit k set when bit k of i is 1 (qubit 0 is the least
// significant bit, as in Qiskit).

/** Hard limit; 24 qubits already needs 256 MiB for one state. */
export const MAX_QUBITS = 24;

export class StateVector {
  /** @param {number} numQubits  starts in |0…0⟩ */
  constructor(numQubits) {
    if (!Number.isInteger(numQubits) || numQubits < 1 || numQubits > MAX_QUBITS) {
      throw new RangeError(`StateVector: number of qubits must be an integer from 1 to ${MAX_QUBITS}`);
    }
    this.numQubits = numQubits;
    this.size = 2 ** numQubits;
    this.re = new Float64Array(this.size);
    this.im = new Float64Array(this.size);
    this.re[0] = 1;
  }

  /** Return to |0…0⟩ without reallocating. */
  reset() {
    this.re.fill(0);
    this.im.fill(0);
    this.re[0] = 1;
    return this;
  }

  clone() {
    const s = new StateVector(this.numQubits);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }

  /** Overwrite this state with the amplitudes of another of the same size. */
  copyFrom(other) {
    if (other.size !== this.size) throw new Error('StateVector.copyFrom: size mismatch');
    this.re.set(other.re);
    this.im.set(other.im);
    return this;
  }

  /** Amplitude of basis state `index` as [re, im]. */
  amplitude(index) {
    return [this.re[index], this.im[index]];
  }

  /**
   * Apply a 2×2 matrix given flat as [ar, ai, br, bi, cr, ci, dr, di]
   * (rows [[a, b], [c, d]]) to one qubit.
   */
  apply1(qubit, m) {
    this.#checkQubit(qubit);
    const [ar, ai, br, bi, cr, ci, dr, di] = m;
    const re = this.re;
    const im = this.im;
    const bit = 1 << qubit;
    const step = bit << 1;
    for (let base = 0; base < this.size; base += step) {
      const end = base + bit;
      for (let i = base; i < end; i++) {
        const j = i | bit;
        const x0r = re[i];
        const x0i = im[i];
        const x1r = re[j];
        const x1i = im[j];
        re[i] = ar * x0r - ai * x0i + br * x1r - bi * x1i;
        im[i] = ar * x0i + ai * x0r + br * x1i + bi * x1r;
        re[j] = cr * x0r - ci * x0i + dr * x1r - di * x1i;
        im[j] = cr * x0i + ci * x0r + dr * x1i + di * x1r;
      }
    }
    return this;
  }

  /** Apply a 2×2 matrix to `target` on the part of the state where `control` is 1. */
  applyControlled1(control, target, m) {
    this.#checkQubit(control);
    this.#checkQubit(target);
    if (control === target) throw new Error('StateVector: control and target must differ');
    const [ar, ai, br, bi, cr, ci, dr, di] = m;
    const re = this.re;
    const im = this.im;
    const cbit = 1 << control;
    const tbit = 1 << target;
    for (let i = 0; i < this.size; i++) {
      if ((i & cbit) === 0 || (i & tbit) !== 0) continue;
      const j = i | tbit;
      const x0r = re[i];
      const x0i = im[i];
      const x1r = re[j];
      const x1i = im[j];
      re[i] = ar * x0r - ai * x0i + br * x1r - bi * x1i;
      im[i] = ar * x0i + ai * x0r + br * x1i + bi * x1r;
      re[j] = cr * x0r - ci * x0i + dr * x1r - di * x1i;
      im[j] = cr * x0i + ci * x0r + dr * x1i + di * x1r;
    }
    return this;
  }

  /** Exchange two qubits. */
  swap(a, b) {
    this.#checkQubit(a);
    this.#checkQubit(b);
    if (a === b) throw new Error('StateVector: swap needs two different qubits');
    const re = this.re;
    const im = this.im;
    const abit = 1 << a;
    const bbit = 1 << b;
    for (let i = 0; i < this.size; i++) {
      if ((i & abit) === 0 || (i & bbit) !== 0) continue;
      const j = (i ^ abit) | bbit;
      const tr = re[i];
      const ti = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = tr;
      im[j] = ti;
    }
    return this;
  }

  /** Squared norm; 1 for a valid state up to rounding. */
  norm2() {
    let s = 0;
    for (let i = 0; i < this.size; i++) s += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    return s;
  }

  /** Probability of every basis state, indexed like the amplitudes. */
  probabilities() {
    const p = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) p[i] = this.re[i] * this.re[i] + this.im[i] * this.im[i];
    return p;
  }

  /** Probability that measuring `qubit` gives 1. */
  probabilityOfOne(qubit) {
    this.#checkQubit(qubit);
    const bit = 1 << qubit;
    let p = 0;
    for (let i = 0; i < this.size; i++) {
      if (i & bit) p += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    }
    return p;
  }

  /**
   * Measure one qubit in the Z basis and collapse the state.
   * @param {number} qubit
   * @param {number} r  a uniform random number in [0, 1)
   * @returns {0|1}
   */
  measure(qubit, r) {
    const p1 = this.probabilityOfOne(qubit);
    const outcome = r < p1 ? 1 : 0;
    const keep = outcome ? p1 : 1 - p1;
    const scale = keep > 0 ? 1 / Math.sqrt(keep) : 0;
    const bit = 1 << qubit;
    for (let i = 0; i < this.size; i++) {
      if (((i & bit) !== 0) === (outcome === 1)) {
        this.re[i] *= scale;
        this.im[i] *= scale;
      } else {
        this.re[i] = 0;
        this.im[i] = 0;
      }
    }
    return outcome;
  }

  /**
   * Basis states with probability above `threshold`, for display.
   * Bitstrings put qubit 0 on the right.
   */
  entries(threshold = 1e-12) {
    const out = [];
    for (let i = 0; i < this.size; i++) {
      const re = this.re[i];
      const im = this.im[i];
      const probability = re * re + im * im;
      if (probability > threshold) {
        out.push({ index: i, bitstring: indexToBitstring(i, this.numQubits), re, im, probability });
      }
    }
    return out;
  }

  #checkQubit(q) {
    if (!Number.isInteger(q) || q < 0 || q >= this.numQubits) {
      throw new RangeError(`StateVector: qubit ${q} is out of range 0..${this.numQubits - 1}`);
    }
  }
}

/** Basis index → bitstring of `width` characters, bit 0 on the right. */
export function indexToBitstring(index, width) {
  return index.toString(2).padStart(width, '0');
}
