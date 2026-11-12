// test/cast.test.mjs — the cast (src/cast.mjs): the network built from the library, its readout, its energy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import C from '../src/cast.mjs';

const LIB = JSON.parse(readFileSync(new URL('../vendor/pattern-libraries/data/route/state.json', import.meta.url), 'utf8')).library;
const net = C.cast(LIB);
const at = (row, col) => net.W[row * net.cols + col];
const word = (w) => net.words.indexOf(w);
const bias = (k) => net.nw + k;
const unit = (u) => net.nw + C.BIAS_LINES + u;
const H = (m) => m, G = (m) => net.np + m;

test('the sealed constants', () => {
  assert.deepEqual([C.A, C.TAU, C.STEPS, C.BIAS_LINES, C.WMAX], [12, 1, 12, 2, 12]);
});

test('the real library: 21 words, 16 routes, 20 patterns, 63 rows by 40 columns = 5,040 devices', () => {
  assert.equal(net.words.length, 21);
  assert.equal(net.routes.length, 16);
  assert.equal(net.np, 20);
  assert.equal(net.nw, 21);
  assert.deepEqual([net.rows, net.cols], [63, 40]);
  assert.equal(2 * net.W.length, 5040);
  assert.deepEqual(net.words.slice(0, 4), ['rates', 'auto', 'unblock', 'pin']);
  assert.equal(net.routes[0], 'exchange-rate');
  assert.deepEqual(net.patterns[3], { when: ['pin', 'unblock'], then: 'pin-blocked', route: 2, index: 3 });
});

test('word lines into pattern units, and only those', () => {
  assert.equal(at(word('rates'), H(0)), 12);
  assert.equal(at(word('pin'), H(3)), 12);
  assert.equal(at(word('unblock'), H(3)), 12);
  assert.equal(at(word('unblock'), H(2)), 12);
  assert.equal(at(word('rates'), H(1)), 0);
  for (let w = 0; w !== net.nw; w++) for (let m = 0; m !== net.np; m++) assert.equal(at(w, G(m)), 0);
});

test('biases split evenly across the two lines: −6 or −18 for h, −6 for g', () => {
  for (let k = 0; k !== 2; k++) {
    assert.equal(at(bias(k), H(0)), -3);
    assert.equal(at(bias(k), H(3)), -9);
    assert.equal(at(bias(k), H(15)), -9);
    assert.equal(at(bias(k), G(0)), -3);
    assert.equal(at(bias(k), G(19)), -3);
  }
});

test('h and g of one pattern excite each other, symmetrically', () => {
  for (let m = 0; m !== net.np; m++) {
    assert.equal(at(unit(H(m)), G(m)), 12);
    assert.equal(at(unit(G(m)), H(m)), 12);
  }
});

test('an earlier pattern of another route inhibits a later g, and two g of different routes inhibit each other', () => {
  assert.equal(at(unit(H(0)), G(1)), -12);
  assert.equal(at(unit(G(1)), H(0)), -12);
  assert.equal(at(unit(G(0)), G(1)), -12);
  assert.equal(at(unit(G(1)), G(0)), -12);
  assert.equal(at(unit(H(1)), G(0)), 0); // a LATER pattern does not inhibit an earlier g
  assert.equal(at(unit(H(2)), G(3)), 0); // same route (pin-blocked): no inhibition
  assert.equal(at(unit(G(2)), G(3)), 0);
  assert.equal(at(unit(H(16)), G(18)), 0); // apple and apple+pay, the same route
  assert.equal(at(unit(H(6)), G(16)), -12); // visa before apple
  for (let i = 0; i !== net.cols; i++) for (let j = 0; j !== net.cols; j++) assert.equal(at(unit(i), j), at(unit(j), i));
  for (let a = 0; a !== net.np; a++) for (let b = 0; b !== net.np; b++) assert.equal(at(unit(H(a)), H(b)), 0);
  for (let i = 0; i !== net.cols; i++) assert.equal(at(unit(i), i), 0);
});

test('usable keeps the router\'s rules, in order: valid patterns of real routes', () => {
  const rules = [{ when: ['a1x', 'b2y', 'c3z'], then: 'exchange-rate' }, { when: ['rates'], then: 'not-a-route' }, { when: ['zzz'], then: 'exchange-rate' }, { when: ['rates'] }, 7, null];
  assert.deepEqual(C.usable(rules), [{ when: ['zzz'], then: 'exchange-rate' }]);
  assert.deepEqual(C.usable('x'), []);
  assert.equal(C.usable(LIB).length, 20);
  const n2 = C.cast(rules);
  assert.deepEqual([n2.words, n2.routes, n2.np, n2.rows, n2.cols], [['zzz'], ['exchange-rate'], 1, 1 + 2 + 2, 2]);
  const empty = C.cast(null);
  assert.deepEqual([empty.np, empty.rows, empty.cols, empty.W.length], [0, 2, 0, 0]);
});

test('masks and drives', () => {
  assert.equal(C.maskOf(net, ['rates', 'pin', 'hello']), 1 + 8);
  assert.equal(C.maskOf(net, []), 0);
  assert.equal(C.maskOf(net, 'rates'), 0);
  assert.equal(C.maskOf(null, ['rates']), 0);
  assert.deepEqual(Array.from(C.driveOfMask(net, 1 + 8)).slice(0, 5), [1, 0, 0, 1, 0]);
  assert.equal(C.driveOfMask(net, 2 ** 20)[20], 1);
  assert.deepEqual(Array.from(C.driveOfMask(net, -5)), new Array(21).fill(0));
  assert.deepEqual(Array.from(C.driveOfMask(net, 2.5)), new Array(21).fill(0));
  assert.equal(C.driveOfMask(null, 3).length, 0);
  assert.deepEqual(Array.from(C.driveOf(net, ['countries'])), [...new Array(20).fill(0), 1]);
});

const settledWith = (lit) => { const s = new Uint8Array(net.cols); for (const u of lit) s[u] = 1; return { settled: true, s }; };

test('decide reads the route of the lit g and the routes of the lit h', () => {
  assert.deepEqual(C.decide(net, settledWith([])), { route: null, also: [] });
  assert.deepEqual(C.decide(net, settledWith([H(6), H(16), G(6)])), { route: 'visa-or-mastercard', also: ['apple-pay-or-google-pay'] });
  assert.deepEqual(C.decide(net, settledWith([H(16), H(17), H(18), G(16), G(17), G(18)])), { route: 'apple-pay-or-google-pay', also: [] });
  assert.deepEqual(C.decide(net, settledWith([H(19), H(0), H(10), G(0)])), { route: 'exchange-rate', also: ['country-support', 'lost-or-stolen-phone'] });
  assert.deepEqual(C.decide(net, settledWith([H(5)])), { route: null, also: ['balance-not-updated-after-cheque-or-cash-deposit'] });
});

test('decide refuses what did not settle, two winners, and garbage', () => {
  assert.deepEqual(C.decide(net, { settled: false, s: new Uint8Array(40) }), { refused: true, why: 'unsettled' });
  assert.deepEqual(C.decide(net, { settled: 'yes', s: new Uint8Array(40) }), { refused: true, why: 'unsettled' });
  assert.deepEqual(C.decide(net, settledWith([G(0), G(1)])), { refused: true, why: 'two' });
  assert.deepEqual(C.decide(net, { settled: true }), { refused: true, why: 'unsettled' });
  assert.deepEqual(C.decide(null, settledWith([])), { refused: true, why: 'unsettled' });
  assert.deepEqual(C.decide(net, null), { refused: true, why: 'unsettled' });
  assert.deepEqual(C.decide({ words: [] }, settledWith([])), { refused: true, why: 'unsettled' });
});

test('fromRouter and same', () => {
  assert.deepEqual(C.fromRouter(null), { route: null, also: [] });
  assert.deepEqual(C.fromRouter({ route: 7 }), { route: null, also: [] });
  assert.deepEqual(C.fromRouter({ route: 'x', also: ['b', 'a', 'b'] }), { route: 'x', also: ['a', 'b'] });
  assert.deepEqual(C.fromRouter({ route: 'x' }), { route: 'x', also: [] });
  const a = { route: 'x', also: ['p', 'q'] };
  assert.equal(C.same(a, { route: 'x', also: ['q', 'p'] }), true);
  assert.equal(C.same(a, { route: 'x', also: ['p', 'r'] }), false);
  assert.equal(C.same(a, { route: 'x', also: ['p'] }), false);
  assert.equal(C.same(a, { route: 'y', also: ['p', 'q'] }), false);
  assert.equal(C.same({ route: null, also: [] }, { route: null, also: [] }), true);
  assert.equal(C.same({ route: null, also: [] }, { refused: true }), false);
  assert.equal(C.same({ refused: true }, { route: null, also: [] }), false);
  assert.equal(C.same({ refused: true, route: null, also: [] }, { route: null, also: [] }), false);
  assert.equal(C.same({ route: null, also: [] }, { refused: true, route: null, also: [] }), false);
  assert.equal(C.same(null, a), false);
  assert.equal(C.same(a, null), false);
  assert.equal(C.same({ route: 'x', also: 'pq' }, { route: 'x', also: [] }), true);
});

test('energy: −½ Σ W s s − Σ (bias + input) s, read from the array', () => {
  const x = C.driveOfMask(net, 2 ** word('visa'));
  const s = new Uint8Array(net.cols);
  assert.equal(C.energy(net, net.W, x, s), 0);
  s[H(6)] = 1;
  assert.equal(C.energy(net, net.W, x, s), -6); // field of h6: 12 − 6
  s[G(6)] = 1;
  assert.equal(C.energy(net, net.W, x, s), -6 + 6 - 12); // g6 adds its bias (−6) and the h6–g6 bond (12)
  const asym = new Float64Array(net.W);
  asym[unit(H(6)) * net.cols + G(6)] = 4; // one of the two devices of that bond weakened
  assert.equal(C.energy(net, asym, x, s), -6 + 6 - 8); // the bond is read as the mean, (12 + 4) / 2
  const y = C.driveOfMask(net, 0);
  assert.equal(C.energy(net, net.W, y, s), 6 + 6 - 12); // without the word, h6 lit costs +6
  assert.equal(C.energy(net, net.W, ['1'], new Uint8Array(net.cols).fill(0)), 0);
  assert.equal(C.energy(null, net.W, x, s), 0);
  assert.equal(C.energy(net, null, x, s), 0);
  assert.equal(C.energy(net, net.W, x, null), 0);
  assert.equal(C.energy(net, net.W, null, s), 0);
  const xs = Array.from(x).map(String);
  assert.equal(C.energy(net, net.W, xs, s), -12);
  const xn = Array.from(x); xn[word('visa')] = 'no';
  assert.equal(C.energy(net, net.W, xn, s), 0);
});
