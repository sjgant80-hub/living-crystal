// test/record.test.mjs — the sealed runs and their verdicts (src/record.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import C from '../src/cast.mjs';
import X from '../src/crossbar.mjs';
import R from '../src/record.mjs';
import T from '../vendor/pattern-libraries/src/triage.mjs';

const LIB = JSON.parse(readFileSync(new URL('../vendor/pattern-libraries/data/route/state.json', import.meta.url), 'utf8')).library;
const net = C.cast(LIB);
const router = R.routerOf(LIB, net);
const maskOf = (...ws) => ws.reduce((m, w) => m + 2 ** net.words.indexOf(w), 0);
const MASKS = [0, maskOf('visa'), maskOf('visa', 'apple'), maskOf('pay'), maskOf('apple', 'pay'), maskOf('pin'), maskOf('rates', 'countries', 'phone'), maskOf('disposable', 'virtual')];
const WANTS = MASKS.map(router);

test('the sealed device, chips and grid', () => {
  assert.deepEqual(R.READINGS, ['sealed', 'sticky']);
  assert.deepEqual(R.PROFILE, { bits: 4, write: 0.02, read: 0.02, t: 86400, comp: true, p0: 0, p1: 0 });
  assert.deepEqual([R.PROFILE_CHIPS, R.SWEEP_CHIPS], [10, 5]);
  assert.deepEqual(R.KNOBS.map((k) => [k.knob, k.values.length]), [['bits', 7], ['write', 7], ['read', 8], ['drift-raw', 7], ['drift-comp', 7], ['stuck-0', 6], ['stuck-1', 6]]);
  assert.deepEqual(R.KNOBS[0].values, [8, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(R.KNOBS[3].values, [60, 3600, 86400, 604800, 2592000, 31536000, 315360000]);
  assert.deepEqual(R.KNOBS[6].values, [0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03]);
  assert.deepEqual(R.deviceOf(R.KNOBS[4], 3600), X.device({ t: 3600, comp: true }));
  assert.deepEqual(R.deviceOf(R.KNOBS[3], 3600), X.device({ t: 3600 }));
  assert.deepEqual(R.deviceOf(R.KNOBS[5], 0.01), X.device({ p0: 0.01 }));
});

test('the router on a mask is the router on a message of exactly those words', () => {
  assert.deepEqual(router(0), { route: null, also: [] });
  assert.deepEqual(router(maskOf('visa', 'apple')), { route: 'visa-or-mastercard', also: ['apple-pay-or-google-pay'] });
  assert.deepEqual(router(maskOf('pay')), { route: null, also: [] });
  assert.deepEqual(router(maskOf('apple', 'pay')), { route: 'apple-pay-or-google-pay', also: [] });
  assert.deepEqual(router(-3), { route: null, also: [] });
  assert.deepEqual(router(1.5), { route: null, also: [] });
  const text = 'My visa card does not work with apple pay';
  assert.deepEqual(C.fromRouter(T.route(LIB, T.routeUnits({ id: 'x', text, intent: '' }))), router(maskOf('visa', 'apple', 'pay')));
  assert.deepEqual(R.routerOf(LIB, null)(5), { route: null, also: [] });
  assert.deepEqual([R.chipSeed('profile', 0), R.msgSeed(1, 2)], [X.fnv('living-crystal|profile|0'), X.fnv('1|2')]);
});

test('add counts a match, each kind of refusal, and a settled wrong answer', () => {
  const t = R.tally(), w = { route: 'a', also: [] };
  R.add(t, { route: 'a', also: [] }, w, 3);
  R.add(t, { refused: true, why: 'unsettled' }, w, 12);
  R.add(t, { refused: true, why: 'two' }, w, 2);
  R.add(t, { refused: true, why: 'wavered' }, w, 4);
  R.add(t, { route: 'b', also: [] }, w, 1);
  R.add(t, null, w, 0);
  assert.deepEqual(t, { n: 6, match: 1, unsettled: 1, two: 1, wavered: 1, wrong: 2, reads: 22, maxReads: 12 });
  const u = R.tally();
  R.add(u, { refused: 'yes', route: 'b', also: [] }, w, 5);
  assert.deepEqual([u.wrong, u.unsettled, u.maxReads], [1, 0, 5]);
});

test('runChip and runPoint: one settle, two readings', () => {
  const p = R.runChip(X.program(net, X.IDEAL, 0), MASKS, WANTS, 1);
  assert.deepEqual(p.sealed, { n: 8, match: 8, unsettled: 0, two: 0, wavered: 0, wrong: 0, reads: 1 + 3 + 3 + 1 + 3 + 1 + 3 + 3, maxReads: 3 });
  assert.deepEqual(p.sticky, p.sealed);
  const bad = R.runChip(X.program(net, X.IDEAL, 0), MASKS, MASKS.map(() => ({ route: 'nope', also: [] })), 1);
  assert.deepEqual([bad.sealed.match, bad.sealed.wrong], [0, 8]);
  assert.deepEqual(R.runChip(null, MASKS, WANTS, 1), { sealed: R.tally(), sticky: R.tally() });
  const pt = R.runPoint(net, { read: 0.12 }, 'read=0.12', 2, MASKS, WANTS);
  assert.equal(pt.point, 'read=0.12');
  assert.equal(pt.chips.length, 2);
  assert.equal(R.runPoint(net, X.IDEAL, 'x', 2.5, MASKS, WANTS).chips.length, 0);
  assert.equal(R.runPoint(net, X.IDEAL, 'x', -1, MASKS, WANTS).chips.length, 0);
  // the noisy point is reproducible and tells the readings apart (pinned)
  const again = R.runPoint(net, { read: 0.3 }, 'pin', 3, MASKS, WANTS);
  assert.deepEqual(again, R.runPoint(net, { read: 0.3 }, 'pin', 3, MASKS, WANTS));
  assert.deepEqual(again.chips.map((c) => [c.sealed.match, c.sealed.wrong, c.sticky.match, c.sticky.wavered]), PIN_READ);
});
const PIN_READ = [[7, 1, 6, 1], [8, 0, 8, 0], [7, 1, 4, 3]];

test('ideal counts every step whose change did not lower the energy', () => {
  const p = R.ideal(net, MASKS, WANTS);
  assert.deepEqual([p.sealed.match, p.sealed.energyBad, p.sealed.maxReads, p.sticky.match], [8, 0, 3, 8]);
  // a fixture whose two units switch on together at no change of energy: fields +6 each, their bond −12
  const W = new Float64Array(5 * 2);
  W[0 * 2 + 0] = 12; W[0 * 2 + 1] = 12;
  W[1 * 2 + 0] = -3; W[1 * 2 + 1] = -3; W[2 * 2 + 0] = -3; W[2 * 2 + 1] = -3;
  W[3 * 2 + 1] = -12; W[4 * 2 + 0] = -12;
  const flat = { words: ['a'], nw: 1, np: 0, rows: 5, cols: 2, W, patterns: [] };
  assert.equal(R.ideal(flat, [1], [{ route: null, also: [] }]).sealed.energyBad, 12); // it never settles: on, off, on… every step at energy 0
  assert.equal(R.ideal(null, [1], []).sealed.n, 0);
});

test('glitch, overdrive and frontend on a few inputs', () => {
  const g = R.glitch(net, [0, maskOf('visa')], router);
  assert.equal(g.sealed.n, 42);
  assert.equal(g.sealed.neither, 0);
  assert.deepEqual(g.sealed, GL_SEALED);
  assert.deepEqual(g.sticky, GL_STICKY);
  const o = R.overdrive(net, [0], router);
  assert.deepEqual(o.sealed, { n: 21, refused: 0, ambiguous: 17, ambiguousRefused: 0, neither: 4 }); // pin, disposable, virtual, pay forge a two-word pattern
  const f = R.frontend(net, 40, router);
  assert.deepEqual([f.sealed.n, f.sticky.n], [40, 40]);
  assert.deepEqual([f.sealed, f.sticky], FE);
  for (const bad of [R.glitch(null, [0], router), R.glitch(net, [0], null)]) assert.equal(bad.sealed.n, 0);
  assert.equal(R.frontend(net, 2.5, router).sealed.n, 0);
  assert.equal(R.frontend(net, 3, 'r').sealed.n, 0);
  assert.equal(R.frontend(null, 3, router).sealed.n, 0);
  assert.equal(R.frontend(net, -2, router).sealed.n, 0);
});
const GL_SEALED = { n: 42, refused: 29, ambiguous: 34, ambiguousRefused: 29, neither: 0 };
const GL_STICKY = { n: 42, refused: 34, ambiguous: 34, ambiguousRefused: 34, neither: 0 };
const FE = [{ n: 40, refused: 38, other: 1 }, { n: 40, refused: 40, other: 0 }];

const chip = (n, match, extra = {}) => ({ sealed: { ...R.tally(), n, match, ...extra }, sticky: { ...R.tally(), n, match } });

test('holds, edge and loud judge on whole counts', () => {
  assert.equal(R.holds({ n: 1000, match: 999 }), true);
  assert.equal(R.holds({ n: 1000, match: 998 }), false);
  assert.equal(R.holds({ n: 0, match: 0 }), false);
  assert.equal(R.holds(null), false);
  const pts = [{ value: 1, chips: [chip(10, 10), chip(10, 10)] }, { value: 2, chips: [chip(1000, 999)] }, { value: 3, chips: [chip(10, 9)] }, { value: 4, chips: [chip(10, 10)] }];
  assert.deepEqual(R.edge(pts, 'sealed'), { last: 2, first: 3 });
  assert.deepEqual(R.edge(pts.slice(0, 2), 'sealed'), { last: 2, first: null });
  assert.deepEqual(R.edge([{ value: 5, chips: [] }], 'sealed'), { last: null, first: 5 });
  assert.deepEqual(R.edge([7, { value: 1, chips: [chip(10, 10)] }], 'sealed'), { last: 1, first: null });
  assert.deepEqual(R.edge([{ value: 1, chips: [{}] }], 'sealed'), { last: null, first: 1 });
  const lp = [{ value: 1, chips: [chip(100, 90, { unsettled: 5, two: 2, wavered: 2, wrong: 1 })] }];
  assert.deepEqual(R.loud(lp, 'sealed'), { nonmatch: 10, refused: 9, wrong: 1, verdict: 'held' });
  const lq = [{ value: 1, chips: [chip(100, 90, { unsettled: 8, wrong: 2 })] }];
  assert.deepEqual(R.loud(lq, 'sealed'), { nonmatch: 10, refused: 8, wrong: 2, verdict: 'failed' });
  assert.deepEqual(R.loud([{ value: 1, chips: [chip(5, 5)] }], 'sealed').verdict, 'undecided');
  assert.deepEqual(R.loud([null, { chips: [null, {}] }], 'sticky'), { nonmatch: 0, refused: 0, wrong: 0, verdict: 'undecided' });
  assert.deepEqual(R.pooled([chip(3, 2, { wrong: 1 }), chip(4, 4), null], 'sealed'), { n: 7, match: 6, unsettled: 0, two: 0, wavered: 0, wrong: 1 });
});

const good = () => ({
  ideal: { sealed: { ...R.tally(), n: 10, match: 10, maxReads: 3, energyBad: 0 }, sticky: { ...R.tally(), n: 10, match: 10, maxReads: 3 } },
  profile: { chips: [...new Array(9).fill(0).map(() => chip(10000, 10000)), chip(10000, 9000, { wrong: 10 })] }, // pooled: 10 wrong in 100,000 is exactly 0.01%
  sweep: [{ knob: 'k', points: [{ value: 1, chips: [chip(10, 10)] }] }],
  glitch: { sealed: { n: 10, ambiguous: 4, ambiguousRefused: 2, neither: 0 } },
  frontend: { sealed: { n: 10, refused: 5, other: 0 } },
  overdrive: { sealed: { n: 9, neither: 3 } },
});

test('verdicts: each bar at its edge', () => {
  const v = R.verdicts(good(), 'sealed');
  assert.deepEqual([v.LC2, v.LC3, v.LC3chips, v.LC4, v.LC7, v.LC8], ['held', 'held', 9, 'held', 'held', 'held']);
  assert.deepEqual(v.LC9, { reported: 3, of: 9 });
  assert.deepEqual(v.LC5, [{ knob: 'k', last: 1, first: null }]);
  assert.deepEqual(v.LC6[0].verdict, 'undecided');
  const tweak = (f) => { const r = good(); f(r); return R.verdicts(r, 'sealed'); };
  assert.equal(tweak((r) => { r.ideal.sealed.maxReads = 4; }).LC2, 'failed');
  assert.equal(tweak((r) => { r.ideal.sealed.match = 9; }).LC2, 'failed');
  assert.equal(tweak((r) => { r.ideal.sealed.energyBad = 1; }).LC2, 'failed');
  assert.equal(tweak((r) => { r.ideal.sealed.n = 0; r.ideal.sealed.match = 0; }).LC2, 'failed');
  assert.equal(tweak((r) => { r.ideal = {}; }).LC2, 'failed');
  assert.equal(tweak((r) => { r.profile.chips[0] = chip(10000, 9989); }).LC3, 'failed');
  assert.equal(tweak((r) => { r.profile.chips.pop(); }).LC3, 'failed');
  assert.equal(tweak((r) => { r.profile.chips[9].sealed.wrong = 11; }).LC4, 'failed');
  assert.equal(tweak((r) => { r.profile.chips[9].sealed.wrong = 10; }).LC4, 'held');
  assert.equal(tweak((r) => { r.profile.chips = []; }).LC4, 'failed');
  assert.equal(tweak((r) => { r.glitch.sealed.neither = 1; }).LC7, 'failed');
  assert.equal(tweak((r) => { r.glitch.sealed.ambiguousRefused = 1; }).LC7, 'failed');
  assert.equal(tweak((r) => { r.glitch.sealed.n = 0; }).LC7, 'failed');
  assert.equal(tweak((r) => { r.frontend.sealed.other = 1; }).LC8, 'failed');
  assert.equal(tweak((r) => { r.frontend.sealed.refused = 4; }).LC8, 'failed');
  assert.equal(tweak((r) => { r.frontend.sealed.n = 0; r.frontend.sealed.refused = 0; }).LC8, 'failed');
  const sticky = R.verdicts(good(), 'sticky');
  assert.deepEqual([sticky.LC2, sticky.LC7, sticky.LC9.of], ['held', 'failed', 0]);
  const none = R.verdicts(null, 'sealed');
  assert.deepEqual([none.LC2, none.LC3, none.LC4, none.LC7, none.LC8, none.LC5.length], ['failed', 'failed', 'failed', 'failed', 'failed', 0]);
});

test('memo remembers, and runRecord runs every sealed part in order', () => {
  let calls = 0;
  const f = R.memo((k) => { calls++; return k * 2; });
  assert.deepEqual([f(2), f(2), f(3), calls], [4, 4, 6, 2]);
  const told = [];
  const rec = R.runRecord(net, LIB, MASKS.slice(0, 3), WANTS.slice(0, 3), (p) => told.push(p));
  assert.deepEqual([rec.n, rec.routed, rec.conflicts], [3, 2, 1]);
  assert.equal(told[0], 'ideal');
  assert.equal(told[1], 'profile');
  assert.equal(told.length, 2 + 48 + 3);
  assert.equal(rec.profile.chips.length, 10);
  assert.deepEqual(rec.profile.device, R.PROFILE);
  assert.deepEqual(rec.sweep.map((k) => k.points.length), [7, 7, 8, 7, 7, 6, 6]);
  assert.deepEqual(rec.verdicts.sealed, R.verdicts(rec, 'sealed'));
  assert.deepEqual(rec.verdicts.sticky, R.verdicts(rec, 'sticky'));
  assert.equal(rec.frontend.sealed.n, 3);
  assert.equal(rec.glitch.sealed.n, 63);
  assert.equal(R.runRecord(net, LIB, MASKS.slice(0, 1), [null]).routed, 0);
});
