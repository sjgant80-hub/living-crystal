// living-crystal · src/record.mjs — the sealed runs and their verdicts (CLAIMS.md, seal 1): the router's decision on a
// bit mask, a chip run over a set of messages, the sweep, the three misfit drives, and every claim's bar judged on
// whole counts. Every settle is read two ways: 'sealed' (seal 1's reading: refused only when it did not settle) and
// 'sticky' (also refused when any column failed to resolve on any read along the way).
// Pure and total: no clock, no disk, no network; garbage in never throws.
//
//   routerOf(rules, net)           → mask → the library router's decision on a message made of exactly those words
//   chipSeed(point, k), msgSeed(cs, i)  → the sealed seeds
//   tally(), add(t, d, want, reads) → the counts a run keeps
//   runChip(chip, masks, wants, cs) → one chip's counts over a set, both readings
//   runPoint(net, dev, point, chips, masks, wants) → { point, chips: [{ sealed, sticky }] }
//   ideal(net, masks, wants)       → LC2's counts (with the energy of every step)
//   glitch / frontend / overdrive(net, …, router)  → LC7, LC8, LC9's counts, both readings
//   holds(t), edge(points, rd), loud(points, rd)    → LC3's chip bar, LC5's edge, LC6's verdict for one knob
//   verdicts(rec, rd)              → every claim's verdict from a record's counts, for one reading
import C from './cast.mjs';
import X from './crossbar.mjs';
import T from '../vendor/pattern-libraries/src/triage.mjs';

export const READINGS = Object.freeze(['sealed', 'sticky']);
export const PROFILE = Object.freeze({ bits: 4, write: 0.02, read: 0.02, t: 86400, comp: true, p0: 0, p1: 0 });
export const PROFILE_CHIPS = 10;
export const SWEEP_CHIPS = 5;
const TIMES = Object.freeze([60, 3600, 86400, 604800, 2592000, 31536000, 315360000]);
const STUCK = Object.freeze([0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03]);
// each knob alone, every other knob ideal; values in order from benign to harsh
export const KNOBS = Object.freeze([
  Object.freeze({ knob: 'bits', values: Object.freeze([8, 6, 5, 4, 3, 2, 1]), key: 'bits' }),
  Object.freeze({ knob: 'write', values: Object.freeze([0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12]), key: 'write' }),
  Object.freeze({ knob: 'read', values: Object.freeze([0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2]), key: 'read' }),
  Object.freeze({ knob: 'drift-raw', values: TIMES, key: 't' }),
  Object.freeze({ knob: 'drift-comp', values: TIMES, key: 't', comp: true }),
  Object.freeze({ knob: 'stuck-0', values: STUCK, key: 'p0' }),
  Object.freeze({ knob: 'stuck-1', values: STUCK, key: 'p1' }),
]);

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const STICKY = Object.freeze({ sticky: true });

/** deviceOf(k, v) → the device for knob k at value v, every other knob ideal */
export function deviceOf(k, v) {
  const d = { [k.key]: v };
  if (k.comp === true) d.comp = true;
  return X.device(d);
}

/** routerOf(rules, net) → mask → the router's decision on a message whose words are exactly the mask's words */
export function routerOf(rules, net) {
  const words = isObj(net) ? arr(net.words) : [];
  return (mask) => {
    const m = Number.isSafeInteger(mask) ? Math.max(0, mask) : 0;
    const text = words.filter((w, i) => Math.floor(m / 2 ** i) % 2 === 1).join(' ');
    return C.fromRouter(T.route(rules, T.routeUnits({ id: 'mask', text, intent: '' })));
  };
}

export const chipSeed = (point, k) => X.fnv('living-crystal|' + point + '|' + k);
export const msgSeed = (cs, i) => X.fnv(cs + '|' + i);

/** tally() → empty counts */
export function tally() { return { n: 0, match: 0, unsettled: 0, two: 0, wavered: 0, wrong: 0, reads: 0, maxReads: 0 }; }

/** add(t, d, want, reads) → t after one decision d against the router's want */
export function add(t, d, want, reads) {
  t.n++;
  t.reads += reads;
  t.maxReads = Math.max(t.maxReads, reads);
  if (C.same(d, want)) t.match++;
  else if (d && d.refused === true) {
    if (d.why === 'two') t.two++;
    else if (d.why === 'wavered') t.wavered++;
    else t.unsettled++;
  } else t.wrong++;
  return t;
}

/** both(net, res, want, pair) → one settle read both ways into pair = { sealed, sticky } */
function both(net, res, want, pair) {
  add(pair.sealed, C.decide(net, res), want, res.reads);
  add(pair.sticky, C.decide(net, res, STICKY), want, res.reads);
  return pair;
}

/** runChip(chip, masks, wants, cs) → { sealed, sticky }: one chip's counts over the set (message i reads from
 *  msgSeed(cs, i)) */
export function runChip(chip, masks, wants, cs) {
  const pair = { sealed: tally(), sticky: tally() }, m = arr(masks), w = arr(wants), net = isObj(chip) ? chip.net : null;
  if (!isObj(net)) return pair;
  for (let i = 0; i !== m.length; i++) both(net, X.settle(chip, C.driveOfMask(net, m[i]), msgSeed(cs, i)), w[i], pair);
  return pair;
}

/** runPoint(net, dev, point, chips, masks, wants) → { point, chips: [{ sealed, sticky } of each chip] } */
export function runPoint(net, dev, point, chips, masks, wants) {
  const out = [];
  const k = Number.isInteger(chips) ? Math.max(0, chips) : 0;
  for (let c = 0; c !== k; c++) {
    const cs = chipSeed(point, c);
    out.push(runChip(X.program(net, dev, cs), masks, wants, cs));
  }
  return { point: String(point), chips: out };
}

/** ideal(net, masks, wants) → LC2's counts on the ideal device ({ sealed, sticky }); sealed also counts every step
 *  whose change did not strictly lower the energy (energyBad) */
export function ideal(net, masks, wants) {
  const pair = { sealed: { ...tally(), energyBad: 0 }, sticky: tally() };
  if (!isObj(net)) return pair;
  const chip = X.program(net, X.IDEAL, 0), m = arr(masks), w = arr(wants);
  for (let i = 0; i !== m.length; i++) {
    const res = X.settle(chip, C.driveOfMask(net, m[i]), 0, { trace: true });
    let prev = 0;
    for (const st of arr(res.trace)) {
      if (st.changed && !(st.energy < prev)) pair.sealed.energyBad++;
      prev = st.energy;
    }
    both(net, res, w[i], pair);
  }
  return pair;
}

const bitOf = (mask, i) => Math.floor(mask / 2 ** i) % 2;
const hits = () => ({ n: 0, refused: 0, ambiguous: 0, ambiguousRefused: 0, neither: 0 });

/** count(t, d, on, off) → one line drive read against its two readings */
function count(t, d, on, off) {
  const amb = !C.same(on, off);
  t.n++;
  if (amb) t.ambiguous++;
  if (d.refused === true) { t.refused++; if (amb) t.ambiguousRefused++; }
  else if (!C.same(d, on) && !C.same(d, off)) t.neither++;
  return t;
}

/** linesHit(net, masks, router, lvl) → for every message and every word line at level lvl, both readings: n, refused,
 *  ambiguous (the two readings of the line differ), ambiguousRefused, neither (settled to a decision neither gives) */
function linesHit(net, masks, router, lvl) {
  const pair = { sealed: hits(), sticky: hits() };
  if (!isObj(net) || typeof router !== 'function') return pair;
  const chip = X.program(net, X.IDEAL, 0), nw = net.words.length;
  for (const mask of arr(masks)) {
    for (let w = 0; w !== nw; w++) {
      const has = bitOf(mask, w), on = router(has ? mask : mask + 2 ** w), off = router(has ? mask - 2 ** w : mask);
      const x = C.driveOfMask(net, mask);
      x[w] = lvl;
      const res = X.settle(chip, x, 0);
      count(pair.sealed, C.decide(net, res), on, off);
      count(pair.sticky, C.decide(net, res, STICKY), on, off);
    }
  }
  return pair;
}

/** glitch(net, masks, router) → LC7: each word line at half level */
export function glitch(net, masks, router) { return linesHit(net, masks, router, 0.5); }
/** overdrive(net, masks, router) → LC9: each word line at twice the rail */
export function overdrive(net, masks, router) { return linesHit(net, masks, router, 2); }

/** frontend(net, count, router) → LC8: drive i has every word line at a seeded uniform level; both readings count
 *  refusals and settled decisions other than the router's on the drive rounded at one half */
export function frontend(net, n, router) {
  const pair = { sealed: { n: 0, refused: 0, other: 0 }, sticky: { n: 0, refused: 0, other: 0 } };
  if (!isObj(net) || typeof router !== 'function' || !Number.isInteger(n)) return pair;
  const chip = X.program(net, X.IDEAL, 0), nw = net.words.length;
  for (let i = 0; i < n; i++) {
    const next = X.rng(X.fnv('living-crystal|frontend|' + i)), x = new Float64Array(nw);
    let rounded = 0;
    for (let w = 0; w !== nw; w++) { x[w] = next(); rounded += Math.round(x[w]) * 2 ** w; }
    const res = X.settle(chip, x, 0), want = router(rounded);
    for (const [t, d] of [[pair.sealed, C.decide(net, res)], [pair.sticky, C.decide(net, res, STICKY)]]) {
      t.n++;
      if (d.refused === true) t.refused++;
      else if (!C.same(d, want)) t.other++;
    }
  }
  return pair;
}

/** holds(t) → a chip held a point: it matched on at least 99.9% of the set (whole counts) */
export const holds = (t) => isObj(t) && t.n > 0 && 1000 * t.match >= 999 * t.n;

const pick = (c, rd) => (isObj(c) && isObj(c[rd]) ? c[rd] : null);

/** edge(points, rd) → LC5 for one knob, points in benign-to-harsh order: the last value where every chip holds before
 *  the first where one does not ({ last, first }: null where there is none) */
export function edge(points, rd) {
  let last = null;
  for (const p of arr(points)) {
    if (!isObj(p)) continue;
    const chips = arr(p.chips).map((c) => pick(c, rd));
    if (!(chips.length > 0 && chips.every(holds))) return { last, first: p.value };
    last = p.value;
  }
  return { last, first: null };
}

/** loud(points, rd) → LC6 for one knob: of its non-matching decisions, the refusals; held when 10·refused ≥ 9·nonmatch */
export function loud(points, rd) {
  let nonmatch = 0, refused = 0, wrong = 0;
  for (const p of arr(points)) for (const c of arr(isObj(p) ? p.chips : [])) {
    const t = pick(c, rd);
    if (!t) continue;
    nonmatch += t.n - t.match;
    refused += t.unsettled + t.two + t.wavered;
    wrong += t.wrong;
  }
  return { nonmatch, refused, wrong, verdict: nonmatch === 0 ? 'undecided' : 10 * refused >= 9 * nonmatch ? 'held' : 'failed' };
}

/** pooled(chips, rd) → one reading's counts summed over chips */
export function pooled(chips, rd) {
  const s = { n: 0, match: 0, unsettled: 0, two: 0, wavered: 0, wrong: 0 };
  for (const c of arr(chips)) {
    const t = pick(c, rd);
    if (t) for (const k of Object.keys(s)) s[k] += Number(t[k]) || 0;
  }
  return s;
}

/** verdicts(rec, rd) → each claim's verdict from a held-out record's counts, for reading rd */
export function verdicts(rec, rd) {
  const r = isObj(rec) ? rec : {};
  const id = pick(r.ideal, rd) || tally();
  const prof = isObj(r.profile) ? arr(r.profile.chips) : [];
  const pp = pooled(prof, rd), ok = prof.map((c) => pick(c, rd)).filter(holds).length;
  const gl = pick(r.glitch, rd) || {}, fe = pick(r.frontend, rd) || {}, od = pick(r.overdrive, rd) || {};
  const energyBad = isObj(r.ideal) && isObj(r.ideal.sealed) ? r.ideal.sealed.energyBad : 1;
  const knobs = arr(r.sweep).filter(isObj);
  return {
    LC2: id.n > 0 && id.match === id.n && id.maxReads <= 3 && energyBad === 0 ? 'held' : 'failed',
    LC3: prof.length === PROFILE_CHIPS && ok >= 9 ? 'held' : 'failed',
    LC3chips: ok,
    LC4: pp.n > 0 && 10000 * pp.wrong <= pp.n ? 'held' : 'failed',
    LC5: knobs.map((k) => ({ knob: k.knob, ...edge(k.points, rd) })),
    LC6: knobs.map((k) => ({ knob: k.knob, ...loud(k.points, rd) })),
    LC7: gl.n > 0 && gl.neither === 0 && 2 * gl.ambiguousRefused >= gl.ambiguous ? 'held' : 'failed',
    LC8: fe.n > 0 && fe.other === 0 && 2 * fe.refused >= fe.n ? 'held' : 'failed',
    LC9: { reported: Number(od.neither) || 0, of: Number(od.n) || 0 },
  };
}

/** memo(f) → f remembered by its argument */
export function memo(f) {
  const m = new Map();
  return (k) => { if (!m.has(k)) m.set(k, f(k)); return m.get(k); };
}

/** runRecord(net, rules, masks, wants, onPoint) → the whole sealed run over one set: the router's own counts, the
 *  ideal device, the assumed device (10 chips), the sweep (5 chips a point), the three misfit drives, and both
 *  readings' verdicts. onPoint(label) is told as each part starts (it may be omitted). */
export function runRecord(net, rules, masks, wants, onPoint) {
  const tell = typeof onPoint === 'function' ? onPoint : () => {};
  const m = arr(masks), w = arr(wants), router = memo(routerOf(rules, net));
  const rec = { n: m.length, routed: w.filter((d) => isObj(d) && typeof d.route === 'string').length, conflicts: w.filter((d) => isObj(d) && arr(d.also).length > 0).length };
  tell('ideal');
  rec.ideal = ideal(net, m, w);
  tell('profile');
  rec.profile = { device: { ...PROFILE }, chips: runPoint(net, PROFILE, 'profile', PROFILE_CHIPS, m, w).chips };
  rec.sweep = KNOBS.map((k) => ({ knob: k.knob, points: k.values.map((v) => {
    tell(k.knob + '=' + v);
    return { value: v, chips: runPoint(net, deviceOf(k, v), k.knob + '=' + v, SWEEP_CHIPS, m, w).chips };
  }) }));
  tell('glitch');
  rec.glitch = glitch(net, m, router);
  tell('frontend');
  rec.frontend = frontend(net, m.length, router);
  tell('overdrive');
  rec.overdrive = overdrive(net, m, router);
  rec.verdicts = { sealed: verdicts(rec, 'sealed'), sticky: verdicts(rec, 'sticky') };
  return rec;
}

export default { READINGS, PROFILE, PROFILE_CHIPS, SWEEP_CHIPS, KNOBS, deviceOf, routerOf, chipSeed, msgSeed, tally, add, runChip, runPoint, ideal, glitch, overdrive, frontend, holds, edge, loud, pooled, verdicts, memo, runRecord };
