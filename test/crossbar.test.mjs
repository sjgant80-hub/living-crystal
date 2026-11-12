// test/crossbar.test.mjs — the emulated crossbar (src/crossbar.mjs): its maths, its device, programming and the settle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C from '../src/cast.mjs';
import X from '../src/crossbar.mjs';

const LIB = JSON.parse(readFileSync(new URL('../vendor/pattern-libraries/data/route/state.json', import.meta.url), 'utf8')).library;
const net = C.cast(LIB);
const h16 = (a) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 16);
const maskOf = (...ws) => ws.reduce((m, w) => m + 2 ** net.words.indexOf(w), 0);
const ideal = X.program(net, X.IDEAL, 0);
const near = (a, b, rel) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), a + ' vs ' + b);

test('FNV-1a, the generator and the noise are the sealed ones', () => {
  assert.equal(X.fnv(''), 2166136261);
  assert.equal(X.fnv('a'), 3826002220);
  assert.equal(X.fnv('living-crystal|x|0'), 2616645363);
  assert.equal(X.fnv(7), X.fnv('7'));
  const r = X.rng(7);
  assert.deepEqual([r(), r(), r()], [0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
  assert.equal(X.rng('x')(), X.rng(0)());
  assert.equal(X.gauss(X.rng(7)), -0.9203642569482327);
  const next = X.rng(3);
  let s = 0, s2 = 0, lo = 0, hi = 0;
  for (let i = 0; i !== 20000; i++) { const g = X.gauss(next); s += g; s2 += g * g; lo = Math.min(lo, g); hi = Math.max(hi, g); }
  assert.ok(Math.abs(s / 20000) < 0.03);
  assert.ok(Math.abs(s2 / 20000 - 1) < 0.04);
  assert.ok(lo >= -6 && hi <= 6);
});

test('lnDet, expDet and powDet: deterministic, and true to Math to 1e-12', () => {
  assert.equal(X.lnDet(2), 0.6931471805599453);
  assert.equal(X.lnDet(1), 0);
  assert.equal(X.lnDet(0.5), -0.6931471805599453);
  assert.equal(X.lnDet(86400), 11.366742954792146);
  assert.equal(X.lnDet(0.3), -1.203972804325936);
  for (const v of [1.5, 3, 60, 3600, 604800, 2592000, 31536000, 315360000, 1e12, 1e-5]) near(X.lnDet(v), Math.log(v), 1e-14);
  assert.ok(Math.abs(X.lnDet(0.999) - Math.log(0.999)) < 1e-15); // near 1 the error is absolute, not relative
  for (const v of [0, -1, Infinity, -Infinity, NaN, '2', null]) assert.equal(X.lnDet(v), 0);
  assert.equal(X.expDet(0), 1);
  assert.equal(X.expDet(-1), 0.36787944117145366);
  assert.equal(X.expDet(-700), 9.859676543756547e-305);
  for (const v of [-0.5, -3, -10, 0.25, 5, 100, -300]) near(X.expDet(v), Math.exp(v), 1e-12);
  assert.ok(X.expDet(700) > 1e303 && X.expDet(700) < Infinity);
  assert.equal(X.expDet(-700.5), 0);
  assert.equal(X.expDet(700.5), Infinity);
  for (const v of [NaN, '1', null, undefined]) assert.equal(X.expDet(v), 0);
  near(X.powDet(86400, -0.05), Math.pow(86400, -0.05), 1e-12);
  assert.equal(X.powDet(1, -0.05), 1);
});

test('a device: ideal by default, every knob clipped to its range', () => {
  assert.deepEqual(X.device(), { bits: 0, write: 0, read: 0, t: 1, comp: false, p0: 0, p1: 0 });
  assert.deepEqual(X.device(X.IDEAL), X.device(null));
  assert.equal(X.device({ bits: 1 }).bits, 1);
  assert.equal(X.device({ bits: 16 }).bits, 16);
  for (const b of [0, 17, 2.5, '4', -1]) assert.equal(X.device({ bits: b }).bits, 0);
  assert.equal(X.device({ write: 0.3 }).write, 0.3);
  assert.equal(X.device({ write: '0.3' }).write, 0);
  assert.equal(X.device({ write: NaN }).write, 0);
  assert.equal(X.device({ write: -1 }).write, 0);
  assert.equal(X.device({ write: 5 }).write, 1);
  assert.equal(X.device({ read: 0.05 }).read, 0.05);
  assert.equal(X.device({ t: 0.5 }).t, 1);
  assert.equal(X.device({ t: 1e13 }).t, 1e12);
  assert.equal(X.device({ t: 86400 }).t, 86400);
  assert.equal(X.device({ comp: 'yes' }).comp, false);
  assert.equal(X.device({ comp: true }).comp, true);
  assert.deepEqual([X.device({ p0: 0.6, p1: 0.6 }).p0, X.device({ p0: 0.6, p1: 0.6 }).p1], [0.6, 0.4]);
  assert.equal(X.device({ p1: 0.25 }).p1, 0.25);
});

test('levels: rounded to the nearest of 2^bits', () => {
  assert.equal(X.level(0.3, 0), 0.3);
  assert.equal(X.level(0.5, 1), 1);
  assert.equal(X.level(0.4, 1), 0);
  assert.equal(X.level(0.5, 2), 2 / 3);
  assert.equal(X.level(0.26, 2), 1 / 3);
  assert.equal(X.level(1, 4), 1);
  assert.equal(X.level(0.25, 4), 4 / 15);
});

test('the ideal chip holds every weight exactly', () => {
  for (let i = 0; i !== net.W.length; i++) {
    assert.equal(ideal.gp[i], Math.max(0, net.W[i]) / 12);
    assert.equal(ideal.gm[i], Math.max(0, -net.W[i]) / 12);
    assert.equal(ideal.weff[i], net.W[i]);
  }
  assert.equal(ideal.comp, 1);
  assert.equal(ideal.net, net);
  assert.deepEqual(ideal.d, X.device());
});

test('programming refuses a net that is not one', () => {
  const nets = [null, 7, { W: [1, 2, 3, 4], rows: 2, cols: 2 }, { W: new Float64Array(5), rows: 2.5, cols: 2 },
    { W: new Float64Array(4), rows: 2, cols: '2' }, { W: new Float64Array(3), rows: 2, cols: 2 }];
  for (const n of nets) {
    const c = X.program(n, X.IDEAL, 0);
    assert.equal(c.net, null);
    assert.equal(c.gp.length, 0);
  }
  assert.equal(X.program({ W: new Float64Array(4), rows: 2, cols: 2 }, X.IDEAL, 0).gp.length, 4);
});

test('levels on the chip: 2 bits hold 0, 1/3, 2/3, 1', () => {
  const c = X.program(net, { bits: 2 }, 42), cols = net.cols, v = net.words.indexOf('visa');
  assert.equal(c.gp[v * cols + 6], 1);
  assert.equal(c.gm[21 * cols + 6], 1 / 3); // bias −3 → 0.25 → level 1 of 3
  assert.equal(c.gm[21 * cols + 3], 2 / 3); // bias −9 → 0.75 → level 2 of 3 (2.25 rounds to 2)
  for (const g of c.gp) assert.ok([0, 1 / 3, 2 / 3, 1].includes(g));
  assert.equal(h16(c.gp), 'bab828f2645d3669');
});

test('write noise, stuck cells and drift: drawn in the sealed order', () => {
  const pins = [
    [{ write: 0.02 }, 'c4e8779e5386bc2d', 'a6c14ccde77193df', 1],
    [{ p0: 0.5 }, '64e2a63881e17724', '93b958eff7c5dedf', 1],
    [{ p1: 0.25, p0: 0.25 }, 'fb24ca6760e2248c', 'd6da42efa7419d6c', 1],
    [{ t: 86400 }, '9ee03675dac3b201', 'e18cc6b4a98b95a4', 1],
    [{ t: 86400, comp: true }, '9ee03675dac3b201', 'e18cc6b4a98b95a4', 0.5664666062480428],
    [{ write: 0.02, p0: 0.1, t: 3600 }, 'a4beaa18e505ad0b', '86b6729719da3148', 1],
  ];
  for (const [d, a, b, comp] of pins) {
    const c = X.program(net, d, 42);
    assert.deepEqual([h16(c.gp), h16(c.gm), c.comp], [a, b, comp], JSON.stringify(d));
    for (const g of c.gp) assert.ok(g >= 0 && g <= 1);
  }
  let ones = 0;
  for (const g of X.program(net, { p1: 0.25 }, 42).gp) if (g === 1) ones++;
  assert.equal(ones, 699);
  for (const g of X.program(net, { p0: 1 }, 1).gp) assert.equal(g, 0);
  for (const g of X.program(net, { p1: 1 }, 1).gm) assert.equal(g, 1);
  const w = X.program(net, { write: 0.02 }, 42);
  let clipped = 0;
  for (const g of w.gp) if (g === 0) clipped++;
  assert.equal(clipped, 1188); // about half the zero cells: noise below 0 is clipped
  const raw = X.program(net, { t: 86400 }, 42), v = net.words.indexOf('visa') * net.cols + 6;
  assert.ok(raw.gp[v] > 0.3 && raw.gp[v] < 0.9);
  const comp = X.program(net, { t: 86400, comp: true }, 42);
  assert.equal(comp.weff[v], (12 * comp.gp[v]) / comp.comp);
  assert.equal(raw.weff[v], 12 * raw.gp[v]);
  assert.equal(X.program(net, { comp: true }, 42).comp, 1);
});

const fixture = (word, bias, self) => {
  // one word line, two bias lines, one unit: W rows = [word, bias0, bias1, unit]
  const W = new Float64Array([word, bias, bias, self]);
  return { words: ['w'], nw: 1, np: 0, rows: 4, cols: 1, W, patterns: [] };
};

test('the settle on the real cast: visa and apple pay', () => {
  const x = C.driveOfMask(net, maskOf('visa', 'apple'));
  const r = X.settle(ideal, x, 0);
  assert.equal(r.settled, true);
  assert.equal(r.reads, 3);
  assert.equal(r.wavered, 0);
  assert.equal(r.trace, null);
  assert.deepEqual(C.decide(net, r), { route: 'visa-or-mastercard', also: ['apple-pay-or-google-pay'] });
  const t = X.settle(ideal, x, 0, { trace: true }).trace;
  assert.deepEqual(t.map((s) => [s.step, s.energy, s.changed, s.resolved]), [[1, -12, true, true], [2, -18, true, true], [3, -18, false, true]]);
  assert.deepEqual(t[0].f.slice(0, 7), [-6, -6, -6, -18, -6, -6, 6]);
  assert.equal(X.settle(ideal, x, 0, { trace: false }).trace, null);
  assert.equal(X.settle(ideal, x, 0, 'trace').trace, null);
});

test('no word settles at once; one word of a two-word pattern does not fire it', () => {
  const none = X.settle(ideal, C.driveOfMask(net, 0), 0);
  assert.deepEqual([none.settled, none.reads, Array.from(none.s).every((v) => v === 0)], [true, 1, true]);
  const pay = X.settle(ideal, C.driveOfMask(net, maskOf('pay')), 0);
  assert.deepEqual([pay.settled, pay.reads, pay.f[18]], [true, 1, -6]);
  assert.deepEqual(C.decide(net, pay), { route: null, also: [] });
});

test('the dead band: a field of exactly +1 or −1 does not resolve, and the settle refuses after 12 reads', () => {
  assert.equal(12 * (1 / 12), 1);
  const up = X.settle(X.program(fixture(12, 0, 0), X.IDEAL, 0), [1 / 12], 0, { trace: true });
  assert.deepEqual([up.settled, up.reads, up.f[0], up.s[0], up.wavered, up.trace.length], [false, 12, 1, 0, 12, 12]);
  const down = X.settle(X.program(fixture(12, 0, 0), X.IDEAL, 0), [-1 / 12], 0);
  assert.deepEqual([down.settled, down.reads, down.f[0], down.s[0]], [false, 12, -1, 0]);
  const on = X.settle(X.program(fixture(12, 0, 0), X.IDEAL, 0), [0.25], 0);
  assert.deepEqual([on.settled, on.reads, on.s[0], on.wavered], [true, 2, 1, 0]);
});

test('two units that inhibit each other and are both driven never settle', () => {
  // words a, b; units u (a), v (b), bias −6 each; u and v −12 to each other
  const W = new Float64Array(6 * 2);
  W[0 * 2 + 0] = 12; W[1 * 2 + 1] = 12;
  for (const r of [2, 3]) { W[r * 2 + 0] = -3; W[r * 2 + 1] = -3; }
  W[4 * 2 + 1] = -12; W[5 * 2 + 0] = -12;
  const pair = { words: ['a', 'b'], nw: 2, np: 0, rows: 6, cols: 2, W, patterns: [] };
  const r = X.settle(X.program(pair, X.IDEAL, 0), [1, 1], 0, { trace: true });
  assert.deepEqual([r.settled, r.reads, r.trace.length], [false, 12, 12]);
  assert.deepEqual(r.trace.slice(0, 3).map((s) => s.s), [[1, 1], [0, 0], [1, 1]]);
  const one = X.settle(X.program(pair, X.IDEAL, 0), [1, 0], 0);
  assert.deepEqual([one.settled, one.reads, Array.from(one.s)], [true, 2, [1, 0]]);
});

test('read noise: drawn per column per read from the message\'s own seed', () => {
  const chip = X.program(net, { read: 0.05 }, 1), x = C.driveOfMask(net, maskOf('visa', 'apple'));
  const r = X.settle(chip, x, 99);
  assert.deepEqual([r.settled, r.reads, h16(r.f)], [true, 3, '285f67d3a5fd6bdd']);
  assert.notEqual(h16(X.settle(chip, x, 98).f), h16(r.f));
  assert.equal(h16(X.settle(ideal, x, 1).f), h16(X.settle(ideal, x, 2).f));
  const comp = X.program(net, { t: 3600, comp: true }, 3);
  assert.deepEqual(C.decide(net, X.settle(comp, x, 0)), { route: 'visa-or-mastercard', also: ['apple-pay-or-google-pay'] });
});

test('the settle takes garbage without throwing', () => {
  const bad = X.settle(null, [1], 0);
  assert.deepEqual([bad.settled, bad.reads, bad.wavered, bad.s.length, bad.trace], [false, 0, 0, 0, null]);
  assert.equal(X.settle({ net, gp: [0] }, [1], 0).reads, 0);
  assert.equal(X.settle({ net: null, gp: new Float64Array(1) }, [1], 0).reads, 0);
  const none = X.settle(ideal, null, 0);
  assert.deepEqual([none.settled, none.reads], [true, 1]);
  const junk = new Array(21).fill('a');
  junk[net.words.indexOf('visa')] = NaN;
  const j = X.settle(ideal, junk, 0);
  assert.deepEqual([j.settled, j.reads], [true, 1]);
  const s = X.settle(ideal, Array.from(C.driveOfMask(net, maskOf('visa'))), 0);
  assert.deepEqual(C.decide(net, s), { route: 'visa-or-mastercard', also: [] });
});
