// test/case.test.mjs — the buyer's figures (src/case.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import K from '../src/case.mjs';

const PRICES = JSON.parse(readFileSync(new URL('../vendor/pattern-libraries/data/prices.json', import.meta.url), 'utf8'));
const M = { routed: 117, right: 105, of: 1000 };

test('sorting: only right routes take time off', () => {
  const r = K.sorting({ messages: 10000, minutes: 1, rate: 12 }, M);
  assert.deepEqual(r, { ok: true, share: 0.105, routed: 1170, right: 1050, hours: 17.5, cost: 210, why: '' });
  assert.equal(K.sorting({ messages: 0, minutes: 0, rate: 0 }, M).ok, true);
  assert.equal(K.sorting({ messages: 1e9, minutes: 600, rate: 1e5 }, M).ok, true);
  for (const bad of [{ messages: -1, minutes: 1, rate: 1 }, { messages: 1, minutes: 601, rate: 1 }, { messages: 1, minutes: 1, rate: 1e5 + 1 }, { messages: '9', minutes: 1, rate: 1 },
    { messages: 1e9 + 1, minutes: 1, rate: 1 }, { messages: 1, minutes: -1, rate: 1 }, { messages: 1, minutes: 1, rate: -1 }, { messages: Infinity, minutes: 1, rate: 1 }, null]) {
    assert.equal(K.sorting(bad, M).ok, false);
  }
  assert.equal(K.sorting({ messages: 1, minutes: 1, rate: 1 }, { routed: 1, right: 1, of: 1 }).share, 1);
  assert.equal(K.sorting({ messages: 1, minutes: 1, rate: 1 }, { routed: 5, right: 0, of: 5 }).share, 0);
  for (const bad of [{ routed: 117, right: 105, of: 0 }, { routed: 117, right: 1001, of: 1000 }, { routed: 104, right: 105, of: 1000 }, { routed: 1001, right: 105, of: 1000 },
    { routed: 117.5, right: 105, of: 1000 }, { routed: 117, right: 10.5, of: 1000 }, { routed: 117, right: 105, of: 1e3 + 0.5 }, { routed: 117, right: -1, of: 1000 }, null, { routed: 1, right: 1, of: 1e9 + 1 }]) {
    assert.equal(K.sorting({ messages: 1, minutes: 1, rate: 1 }, bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(K.sorting({ messages: 3, minutes: 1, rate: 1 }, { routed: 1, right: 1, of: 1e9 }).ok, true);
  assert.match(K.sorting({ messages: 1 }, M).why, /messages a month/);
  assert.match(K.sorting({ messages: 1, minutes: 1, rate: 1 }, {}).why, /measured counts/);
});

test('cloud: the message alone at the printed price', () => {
  const r = K.cloud({ messages: 10000, model: 'claude-sonnet-5-5', outTokens: 5 }, PRICES, { chars: 600, n: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.tokensIn, 15);
  assert.equal(r.perMessage, (15 * 2 + 5 * 10) / 1e6);
  assert.equal(r.perMonth, 0.8);
  assert.equal(K.cloud({ messages: 1e6, model: 'claude-opus-5-5', outTokens: 0 }, PRICES, { chars: 4, n: 1 }).perMonth, 4);
  assert.equal(K.cloud({ messages: 1, model: 'claude-haiku-5-5', outTokens: 1 }, PRICES, { chars: 4, n: 1 }).why, 'no printed price for that model');
  assert.equal(K.cloud({ messages: 1, model: 7, outTokens: 1 }, PRICES, { chars: 4, n: 1 }).ok, false);
  assert.equal(K.cloud({ messages: 1, model: 'claude-opus-5-5', outTokens: 1 }, null, { chars: 4, n: 1 }).ok, false);
  assert.equal(K.cloud({ messages: 1, model: 'x', outTokens: 1 }, { models: { x: { in: 'a', out: 1 } } }, { chars: 4, n: 1 }).ok, false);
  assert.equal(K.cloud({ messages: 1, model: 'x', outTokens: 1 }, { models: { x: { in: 1, out: -1 } } }, { chars: 4, n: 1 }).ok, false);
  assert.equal(K.cloud({ messages: 1, model: 'x', outTokens: 1 }, { models: { x: { in: 1, out: 1 } } }, { chars: 4, n: 1 }).ok, true);
  for (const [i, m] of [[{ messages: -1, outTokens: 1 }, { chars: 4, n: 1 }], [{ messages: 1, outTokens: -1 }, { chars: 4, n: 1 }], [{ messages: 1, outTokens: 1 }, { chars: -4, n: 1 }],
    [{ messages: 1, outTokens: 1 }, { chars: 4, n: 0 }], [{ messages: 1, outTokens: 1 }, null], [{ messages: 1, outTokens: 1e5 + 1 }, { chars: 4, n: 1 }]]) {
    assert.equal(K.cloud({ ...i, model: 'claude-opus-5-5' }, PRICES, m).ok, false, JSON.stringify([i, m]));
  }
  assert.match(K.cloud({ messages: -1, model: 'claude-opus-5-5', outTokens: 1 }, PRICES, { chars: 4, n: 1 }).why, /in range/);
  assert.equal(K.cloud(null, PRICES, { chars: 4, n: 1 }).ok, false);
});

test('spreadAt: 0.02 · ln t', () => {
  assert.equal(K.spreadAt(1), 0);
  assert.ok(Math.abs(K.spreadAt(60) - 0.02 * Math.log(60)) < 1e-15);
  assert.ok(Math.abs(K.spreadAt(3600) - 0.02 * Math.log(3600)) < 1e-15);
  assert.ok(Math.abs(K.spreadAt(1e12) - 0.02 * Math.log(1e12)) < 1e-14);
  for (const bad of [0.5, 1e12 * 2, 'x', NaN, null]) assert.equal(K.spreadAt(bad), 0);
});
