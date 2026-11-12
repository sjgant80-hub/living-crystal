// living-crystal · src/crossbar.mjs — an emulated analogue crossbar that holds a cast network's weights as pairs of
// device conductances and computes by settling: every step is one read of the whole array, every column's sense
// amplifier commits or does not resolve. Modelled non-idealities (sealed in CLAIMS.md): a few conductance levels,
// write noise, stuck cells, drift over time (raw or compensated), read noise on every read, a bounded settle.
// This is an emulator, not a chip. Pure and total: no clock, no disk, no network, no engine-dependent maths (no
// Math.log / exp / cos), so a record re-derives the same in Node and in a browser; garbage in never throws.
//
//   fnv(text)                      → FNV-1a 32-bit of the text's UTF-8 bytes
//   rng(seed)                      → a seeded generator of uniforms in [0, 1)
//   gauss(next)                    → 12 uniforms minus 6: mean 0, variance 1, tails stop at 6
//   lnDet(x), expDet(y), powDet(t, e)   → logarithm, exponential and power from + − × ÷ and the float's own bits
//   device(d)                      → a device description with every knob filled in
//   level(m, bits)                 → a conductance rounded to the device's levels
//   program(net, d, seed)          → a chip: the net's weights written into devices as this device would hold them
//   settle(chip, x, seed, opts)    → { settled, reads, s, f, trace? }: the array settling with word lines x
import C from './cast.mjs';

export const NU = 0.05; // the drift exponent's mean
export const NU_SPREAD = 0.02; // its spread across devices
export const LN2 = 0.6931471805599453;
export const IDEAL = Object.freeze({ bits: 0, write: 0, read: 0, t: 1, comp: false, p0: 0, p1: 0 });

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const clamp = (x, lo, hi, dflt) => (typeof x === 'number' && x === x ? Math.min(hi, Math.max(lo, x)) : dflt);

/** fnv(text) → FNV-1a over the UTF-8 bytes of String(text), unsigned 32-bit */
export function fnv(text) {
  const b = new TextEncoder().encode(String(text));
  let h = 0x811c9dc5;
  for (const c of b) h = Math.imul(h ^ c, 0x01000193) >>> 0;
  return h;
}

/** rng(seed) → next(): uniforms in [0, 1), mulberry32 */
export function rng(seed) {
  let a = (Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** gauss(next) → the sum of 12 uniforms minus 6 */
export function gauss(next) {
  let s = -6;
  for (let k = 0; k !== 12; k++) s += next();
  return s;
}

const bits64 = new DataView(new ArrayBuffer(8));

/** lnDet(x) → ln x for a positive normal number (0 otherwise): the float's exponent, and the atanh series on its
 *  mantissa in [1, 2) */
export function lnDet(x) {
  if (!(typeof x === 'number' && x > 0 && x < Infinity)) return 0;
  bits64.setFloat64(0, x);
  const hi = bits64.getUint32(0), k = ((hi >>> 20) & 0x7ff) - 1023;
  bits64.setUint32(0, (hi & 0x000fffff) | 0x3ff00000);
  const m = bits64.getFloat64(0), z = (m - 1) / (m + 1), z2 = z * z;
  let term = z, sum = 0;
  for (let n = 1; n !== 61; n += 2) { sum += term / n; term *= z2; }
  return 2 * sum + k * LN2;
}

/** expDet(y) → e^y for |y| ≤ 700 (0 below, Infinity above, 0 for anything not a number): a Taylor series on y/1024,
 *  then ten squarings */
export function expDet(y) {
  if (!(typeof y === 'number' && y === y)) return 0;
  if (y < -700) return 0;
  if (y > 700) return Infinity;
  const r = y / 1024;
  let term = 1, sum = 1;
  for (let n = 1; n !== 16; n++) { term *= r / n; sum += term; }
  for (let k = 0; k !== 10; k++) sum *= sum;
  return sum;
}

/** powDet(t, e) → t^e for t > 0 */
export function powDet(t, e) { return expDet(e * lnDet(t)); }

/** device(d) → every knob of a device, defaults ideal: bits (1-16; 0 = exact), write and read (fractions, clipped to
 *  [0, 1]), t (seconds since programming, clipped to [1, 1e12]), comp (compensated drift), p0 and p1 (stuck at 0,
 *  stuck at full; p1 clipped so p0 + p1 ≤ 1) */
export function device(d) {
  const o = isObj(d) ? d : {};
  const bits = Number.isInteger(o.bits) && o.bits >= 1 && o.bits <= 16 ? o.bits : 0;
  const p0 = clamp(o.p0, 0, 1, 0), p1 = clamp(o.p1, 0, 1 - p0, 0);
  return { bits, write: clamp(o.write, 0, 1, 0), read: clamp(o.read, 0, 1, 0), t: clamp(o.t, 1, 1e12, 1), comp: o.comp === true, p0, p1 };
}

/** level(m, bits) → m in [0, 1] rounded to the nearest of 2^bits levels (unchanged when bits is 0) */
export function level(m, bits) {
  if (bits === 0) return m;
  const top = 2 ** bits - 1;
  return Math.round(m * top) / top;
}

/** program(net, d, seed) → { net, d, gp, gm, comp, weff }: each weight's pair of devices as written, stuck and
 *  drifted; comp is the column divisor (1 unless drift is compensated); weff the weights the array now holds.
 *  Draws, device by device in row order (G⁺ then G⁻): write noise when σw is not 0, one uniform when any cell can be
 *  stuck, the drift exponent when t is not 1. */
export function program(net, d, seed) {
  const dv = device(d);
  const ok = isObj(net) && net.W instanceof Float64Array && Number.isInteger(net.rows) && Number.isInteger(net.cols) && net.W.length === net.rows * net.cols;
  const n = ok ? net.W.length : 0;
  const gp = new Float64Array(n), gm = new Float64Array(n), weff = new Float64Array(n);
  const next = rng(seed);
  const drifting = dv.t !== 1, lt = lnDet(dv.t), stuckable = dv.p0 + dv.p1 > 0;
  const one = (target) => {
    let g = dv.write !== 0 ? Math.min(1, Math.max(0, target + dv.write * gauss(next))) : target;
    if (stuckable) {
      const u = next();
      if (Math.floor(u / dv.p0) === 0) return 0; // u below p0 (never when p0 is 0: u / 0 is not 0)
      if (Math.floor((u - dv.p0) / dv.p1) === 0) return 1; // u in [p0, p0 + p1)
    }
    if (drifting) g *= expDet(-Math.max(0, NU + NU_SPREAD * gauss(next)) * lt);
    return g;
  };
  for (let i = 0; i !== n; i++) {
    const w = net.W[i], m = level(Math.min(1, Math.abs(w) / C.WMAX), dv.bits), sg = Math.sign(w);
    gp[i] = one(Math.max(0, sg) * m);
    gm[i] = one(Math.max(0, -sg) * m);
  }
  const comp = dv.comp && drifting ? expDet(-NU * lt) : 1;
  for (let i = 0; i !== n; i++) weff[i] = (C.WMAX * (gp[i] - gm[i])) / comp;
  return { net: ok ? net : null, d: dv, gp, gm, comp, weff };
}

/** settle(chip, x, seed, opts) → { settled, reads, wavered, s, f, trace }. All units start at 0. Each step reads every
 *  column at once: f = WMAX·(Σ x_r (G⁺ − G⁻) + read noise) / comp; a unit commits 1 above +TAU, 0 below −TAU, and
 *  otherwise holds. Settled at the first step where every column resolved and none changed; refused after STEPS.
 *  wavered counts the column reads that did not resolve along the way. opts.trace = true records each step's states,
 *  fields and energy (trace is null otherwise). */
export function settle(chip, x, seed, opts) {
  const net = isObj(chip) ? chip.net : null;
  if (!isObj(net) || !(chip.gp instanceof Float64Array)) return { settled: false, reads: 0, wavered: 0, s: new Uint8Array(0), f: new Float64Array(0), trace: null };
  const { nw, cols } = net, base = nw + C.BIAS_LINES;
  const drive = new Float64Array(nw);
  for (let w = 0; w !== nw; w++) drive[w] = x && typeof x[w] === 'number' && x[w] === x[w] ? x[w] : 0;
  const read = chip.d.read, next = read !== 0 ? rng(seed) : null, comp = chip.comp;
  const { gp, gm } = chip;
  let s = new Uint8Array(cols);
  const f = new Float64Array(cols), I = new Float64Array(cols), V = new Float64Array(cols);
  const trace = isObj(opts) && opts.trace === true ? [] : null;
  const rowsOn = [], weights = [];
  for (let w = 0; w !== nw; w++) if (drive[w] !== 0) { rowsOn.push(w); weights.push(drive[w]); }
  for (let k = 0; k !== C.BIAS_LINES; k++) { rowsOn.push(nw + k); weights.push(1); }
  const fixed = rowsOn.length;
  let step = 0, wavered = 0;
  while (step !== C.STEPS) {
    step++;
    rowsOn.length = fixed; weights.length = fixed;
    for (let u = 0; u !== cols; u++) if (s[u] === 1) { rowsOn.push(base + u); weights.push(1); }
    I.fill(0); V.fill(0);
    for (let k = 0; k !== rowsOn.length; k++) {
      const o = rowsOn[k] * cols, a = weights[k], a2 = a * a;
      for (let c = 0; c !== cols; c++) I[c] += a * (gp[o + c] - gm[o + c]);
      if (next) for (let c = 0; c !== cols; c++) { const p = gp[o + c], m = gm[o + c]; V[c] += a2 * (p * p + m * m); }
    }
    const ns = new Uint8Array(cols);
    let all = true, changed = false;
    for (let c = 0; c !== cols; c++) {
      const noise = next ? read * Math.sqrt(V[c]) * gauss(next) : 0;
      f[c] = (C.WMAX * (I[c] + noise)) / comp;
      if (f[c] > C.TAU) ns[c] = 1;
      else if (f[c] < -C.TAU) ns[c] = 0;
      else { ns[c] = s[c]; all = false; wavered++; }
      if (ns[c] !== s[c]) changed = true;
    }
    s = ns;
    if (trace) trace.push({ step, s: Array.from(s), f: Array.from(f), energy: C.energy(net, chip.weff, drive, s), resolved: all, changed });
    if (all && !changed) return { settled: true, reads: step, wavered, s, f, trace };
  }
  return { settled: false, reads: step, wavered, s, f, trace };
}

export default { NU, NU_SPREAD, LN2, IDEAL, fnv, rng, gauss, lnDet, expDet, powDet, device, level, program, settle };
