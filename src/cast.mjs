// living-crystal · src/cast.mjs — the cast: a library of verified routing patterns turned into the weights of a
// symmetric settling network (sealed in CLAIMS.md, seal 1), and the decision read off a settled state.
// Pure and total: no clock, no disk, no network; garbage in never throws.
//
//   cast(rules)            → the network: its words, routes, patterns, units and the weight array (design units)
//   driveOf(net, tokens)   → the 21 word lines for a message's tokens (1 where the word is present, else 0)
//   driveOfMask(net, m)    → the word lines for a bit mask over the words (bit i = word i)
//   maskOf(net, tokens)    → that bit mask
//   decide(net, settled)   → { refused: true } or { route, also } from a settle's result
//   fromRouter(r)          → the library router's result as the same kind of decision
//   same(a, b)             → whether two decisions are the same decision
//   energy(net, W, x, s)   → the energy of state s with inputs x, for weights W laid out as net.W
import P from '../vendor/pattern-libraries/vendor/patlib/patlib.mjs';
import T from '../vendor/pattern-libraries/src/triage.mjs';

export const A = 12; // a word line into its pattern unit, and every unit-to-unit weight
export const TAU = 1; // the sense amplifier's dead band, in design units
export const STEPS = 12; // the most array reads a settle may take
export const BIAS_LINES = 2; // biases are split evenly across these always-on lines
export const WMAX = 12; // the largest weight on one device: maps to full conductance

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);

/** the rules the router itself would use: valid patterns whose route is one of its routes, in library order */
export function usable(rules) {
  return arr(rules).filter((r) => P.validRule(r) && T.ROUTES.includes(r.then));
}

/** cast(rules) → the network. Units 0..P-1 are h (it fired), P..2P-1 are g (it fired first). Rows of W: word lines,
 *  then bias lines, then one line per unit; columns: one per unit. W[row * cols + col], design units. */
export function cast(rules) {
  const pats = usable(rules);
  const words = [], routes = [];
  for (const r of pats) {
    for (const w of r.when) if (!words.includes(w)) words.push(w);
    if (!routes.includes(r.then)) routes.push(r.then);
  }
  const np = pats.length, cols = 2 * np, nw = words.length, rows = nw + BIAS_LINES + cols;
  const W = new Float64Array(rows * cols);
  const unitRow = (u) => nw + BIAS_LINES + u;
  const sym = (i, j, w) => { W[unitRow(j) * cols + i] += w; W[unitRow(i) * cols + j] += w; };
  const bias = (u, b) => { for (let k = 0; k !== BIAS_LINES; k++) W[(nw + k) * cols + u] += b / BIAS_LINES; };
  const patterns = pats.map((r, m) => ({ when: [...r.when], then: r.then, route: routes.indexOf(r.then), index: m }));
  for (const p of patterns) {
    const h = p.index, g = np + p.index;
    for (const w of p.when) W[words.indexOf(w) * cols + h] += A;
    bias(h, -A * (p.when.length - 0.5));
    sym(h, g, A);
    bias(g, -A / 2);
    for (const q of patterns.slice(0, p.index)) {
      if (q.route === p.route) continue;
      sym(q.index, g, -A); // an earlier pattern of another route that fired takes the decision
      sym(np + q.index, g, -A); // two first-pattern units of different routes inhibit each other
    }
  }
  return { words, routes, patterns, np, nw, rows, cols, W };
}

/** maskOf(net, tokens) → bit i set when word i is among the tokens */
export function maskOf(net, tokens) {
  const t = arr(tokens);
  let m = 0;
  if (!isObj(net)) return m;
  arr(net.words).forEach((w, i) => { if (t.includes(w)) m += 2 ** i; });
  return m;
}

/** driveOfMask(net, mask) → the word lines, 1 where the bit is set */
export function driveOfMask(net, mask) {
  const nw = isObj(net) ? arr(net.words).length : 0;
  const x = new Float64Array(nw);
  const m = Number.isSafeInteger(mask) ? Math.max(0, mask) : 0;
  for (let i = 0; i !== nw; i++) x[i] = Math.floor(m / 2 ** i) % 2;
  return x;
}

/** driveOf(net, tokens) → the word lines for a message's tokens */
export function driveOf(net, tokens) { return driveOfMask(net, maskOf(net, tokens)); }

const sorted = (xs) => [...new Set(xs)].sort();

/** decide(net, res, opts) → the cast's decision from a settle's result { settled, wavered, s }. With opts.sticky, a
 *  settle in which any column failed to resolve on any read is refused too (a sticky "did not resolve" latch) */
export function decide(net, res, opts) {
  if (!isObj(net) || !isObj(res) || !res.s || !Array.isArray(net.patterns)) return { refused: true, why: 'unsettled' };
  if (res.settled !== true) return { refused: true, why: 'unsettled' };
  if (isObj(opts) && opts.sticky === true && res.wavered !== 0) return { refused: true, why: 'wavered' };
  const np = net.patterns.length;
  const first = [], fired = [];
  for (const p of net.patterns) {
    if (res.s[np + p.index] === 1) first.push(p.then);
    if (res.s[p.index] === 1) fired.push(p.then);
  }
  const won = sorted(first);
  // two routes lit at a settled state: on a clean array two winners inhibit each other and never settle; a damaged
  // array can hold them, and the reader refuses rather than pick one (named in SEAL2.md: seal 1 left this case open)
  if (won.length > 1) return { refused: true, why: 'two' };
  const route = won.length ? won[0] : null;
  return { route, also: sorted(fired).filter((r) => r !== route) };
}

/** fromRouter(r) → the library router's result { route, also } (or null) as a decision */
export function fromRouter(r) {
  if (!isObj(r) || typeof r.route !== 'string') return { route: null, also: [] };
  return { route: r.route, also: sorted(arr(r.also)) };
}

/** same(a, b) → the same decision: neither refused, the same route, the same set of conflicting routes */
export function same(a, b) {
  if (!isObj(a) || !isObj(b) || a.refused === true || b.refused === true) return false;
  if (a.route !== b.route) return false;
  const x = sorted(arr(a.also)), y = sorted(arr(b.also));
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** energy(net, W, x, s) → −½ Σ_{i≠j} W_ij s_i s_j − Σ_i (bias_i + Σ_w W_iw x_w) s_i; W_ij is read as the mean of the
 *  two devices' weights (row j into column i, row i into column j) so a programmed array that is not exactly
 *  symmetric still has one number */
export function energy(net, W, x, s) {
  if (!isObj(net) || !W || !s || !x) return 0;
  const { nw, cols } = net, base = nw + BIAS_LINES;
  let e = 0;
  for (let i = 0; i !== cols; i++) {
    if (s[i] !== 1) continue;
    let ext = 0;
    for (let w = 0; w !== nw; w++) ext += W[w * cols + i] * (Number(x[w]) || 0);
    for (let k = 0; k !== BIAS_LINES; k++) ext += W[(nw + k) * cols + i];
    e -= ext;
    for (let j = 0; j !== cols; j++) if (j !== i && s[j] === 1) e -= 0.25 * (W[(base + j) * cols + i] + W[(base + i) * cols + j]);
  }
  return e;
}

export default { A, TAU, STEPS, BIAS_LINES, WMAX, usable, cast, maskOf, driveOfMask, driveOf, decide, fromRouter, same, energy };
