// Random number sources for sampling measurements. Every source is a
// function returning a float in [0, 1). These are classical pseudo-random
// or OS-entropy numbers, not quantum randomness.

const TWO_POW_32 = 4294967296;
const TWO_POW_53 = 9007199254740992;

/** Combine two 32-bit words into a double in [0, 1) with 53 random bits. */
function toUnit(hi, lo) {
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) / TWO_POW_53;
}

/**
 * Default source: the platform's cryptographic generator
 * (`crypto.getRandomValues`), buffered to keep calls cheap.
 * Not reproducible.
 */
export function createCryptoRng(bufferWords = 2048) {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('createCryptoRng: crypto.getRandomValues is not available in this environment');
  }
  // getRandomValues fills at most 65536 bytes (16384 words) per call; two words make one number.
  if (!Number.isInteger(bufferWords) || bufferWords < 2 || bufferWords > 16384) {
    throw new RangeError('createCryptoRng: bufferWords must be an integer from 2 to 16384');
  }
  const buffer = new Uint32Array(bufferWords - (bufferWords % 2));
  let pos = buffer.length;
  return function cryptoRng() {
    if (pos >= buffer.length) {
      c.getRandomValues(buffer);
      pos = 0;
    }
    const hi = buffer[pos++];
    const lo = buffer[pos++];
    return toUnit(hi, lo);
  };
}

/** 32-bit FNV-1a hash, used to turn string seeds into numbers. */
function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic source for tests and reproducible dry runs: the same seed
 * always gives the same sequence. Uses sfc32 seeded through splitmix32.
 * @param {number|string} seed
 */
export function createSeededRng(seed) {
  let s;
  if (typeof seed === 'string') s = hashString(seed);
  else if (typeof seed === 'number' && Number.isFinite(seed)) s = Math.floor(seed) % TWO_POW_32 >>> 0;
  else throw new TypeError('createSeededRng: seed must be a finite number or a string');

  const splitmix32 = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = splitmix32();
  let b = splitmix32();
  let c = splitmix32();
  let d = splitmix32();

  const next32 = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) next32();

  return function seededRng() {
    const hi = next32();
    const lo = next32();
    return toUnit(hi, lo);
  };
}
