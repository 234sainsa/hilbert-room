// Small dense complex matrices, stored row-major as separate real and
// imaginary Float64Arrays. Used to describe gates and to check them; the
// state vector itself does not depend on this file.

export class Matrix {
  /**
   * @param {number} size  number of rows (= columns)
   * @param {Float64Array} [re]
   * @param {Float64Array} [im]
   */
  constructor(size, re, im) {
    this.size = size;
    this.re = re ?? new Float64Array(size * size);
    this.im = im ?? new Float64Array(size * size);
  }

  /** Build from nested rows of [re, im] pairs (or plain real numbers). */
  static fromRows(rows) {
    const size = rows.length;
    const m = new Matrix(size);
    for (let r = 0; r < size; r++) {
      if (rows[r].length !== size) throw new Error('Matrix.fromRows: matrix must be square');
      for (let c = 0; c < size; c++) {
        const v = rows[r][c];
        const k = r * size + c;
        if (typeof v === 'number') {
          m.re[k] = v;
        } else {
          m.re[k] = v[0];
          m.im[k] = v[1];
        }
      }
    }
    return m;
  }

  static identity(size) {
    const m = new Matrix(size);
    for (let i = 0; i < size; i++) m.re[i * size + i] = 1;
    return m;
  }

  get(r, c) {
    const k = r * this.size + c;
    return [this.re[k], this.im[k]];
  }

  /** Nested rows of [re, im] pairs, handy for printing and tests. */
  toRows() {
    const rows = [];
    for (let r = 0; r < this.size; r++) {
      const row = [];
      for (let c = 0; c < this.size; c++) row.push(this.get(r, c));
      rows.push(row);
    }
    return rows;
  }

  multiply(other) {
    if (other.size !== this.size) throw new Error('Matrix.multiply: size mismatch');
    const n = this.size;
    const out = new Matrix(n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let sr = 0;
        let si = 0;
        for (let k = 0; k < n; k++) {
          const ar = this.re[r * n + k];
          const ai = this.im[r * n + k];
          const br = other.re[k * n + c];
          const bi = other.im[k * n + c];
          sr += ar * br - ai * bi;
          si += ar * bi + ai * br;
        }
        out.re[r * n + c] = sr;
        out.im[r * n + c] = si;
      }
    }
    return out;
  }

  /** Conjugate transpose. */
  dagger() {
    const n = this.size;
    const out = new Matrix(n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        out.re[c * n + r] = this.re[r * n + c];
        out.im[c * n + r] = -this.im[r * n + c];
      }
    }
    return out;
  }

  /**
   * Kronecker product this ⊗ other. With little-endian qubit order,
   * `high.kron(low)` acts on `low` as qubit 0.
   */
  kron(other) {
    const a = this.size;
    const b = other.size;
    const n = a * b;
    const out = new Matrix(n);
    for (let r1 = 0; r1 < a; r1++) {
      for (let c1 = 0; c1 < a; c1++) {
        const xr = this.re[r1 * a + c1];
        const xi = this.im[r1 * a + c1];
        for (let r2 = 0; r2 < b; r2++) {
          for (let c2 = 0; c2 < b; c2++) {
            const yr = other.re[r2 * b + c2];
            const yi = other.im[r2 * b + c2];
            const k = (r1 * b + r2) * n + (c1 * b + c2);
            out.re[k] = xr * yr - xi * yi;
            out.im[k] = xr * yi + xi * yr;
          }
        }
      }
    }
    return out;
  }

  /** Largest absolute difference of any entry. */
  maxDiff(other) {
    if (other.size !== this.size) return Infinity;
    let d = 0;
    for (let k = 0; k < this.re.length; k++) {
      d = Math.max(d, Math.hypot(this.re[k] - other.re[k], this.im[k] - other.im[k]));
    }
    return d;
  }

  isUnitary(tolerance = 1e-12) {
    return this.dagger().multiply(this).maxDiff(Matrix.identity(this.size)) <= tolerance;
  }

  /**
   * Flat 2×2 form [ar, ai, br, bi, cr, ci, dr, di] for [[a, b], [c, d]],
   * the form the state vector's kernels take.
   */
  toFlat2() {
    if (this.size !== 2) throw new Error('Matrix.toFlat2: matrix is not 2×2');
    return [this.re[0], this.im[0], this.re[1], this.im[1], this.re[2], this.im[2], this.re[3], this.im[3]];
  }
}
