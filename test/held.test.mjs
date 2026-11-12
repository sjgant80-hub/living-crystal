// test/held.test.mjs — the held-out record's text (src/held.mjs), as the tool and the page both build it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import C from '../src/cast.mjs';
import R from '../src/record.mjs';
import H from '../src/held.mjs';

const LIB = JSON.parse(readFileSync(new URL('../vendor/pattern-libraries/data/route/state.json', import.meta.url), 'utf8')).library;
const net = C.cast(LIB);
const maskOf = (...ws) => ws.reduce((m, w) => m + 2 ** net.words.indexOf(w), 0);

test('masks come back from base 36, in order', () => {
  assert.deepEqual(H.masksOf({ masks: '0,1,z,' + maskOf('visa', 'apple').toString(36) }), [0, 1, 35, maskOf('visa', 'apple')]);
  for (const bad of [null, {}, { masks: 7 }, { masks: '' }, 'x']) assert.deepEqual(H.masksOf(bad), []);
});

test('the record text: header, inputs hash, counts, meter, and the whole sealed run', () => {
  const masks = [maskOf('visa', 'apple'), 0, maskOf('rates')];
  const inputs = { masks: masks.map((m) => m.toString(36)).join(','), banking77: 2, nlupp: 1, chars: 99, meter: 2, meterRight: '10' };
  const text = H.heldText(LIB, inputs, 'abc', null);
  assert.ok(text.endsWith('}\n'));
  const r = JSON.parse(text);
  assert.deepEqual(Object.keys(r).slice(0, 8), ['set', 'what', 'inputs', 'banking77', 'nlupp', 'chars', 'meter', 'n']);
  assert.deepEqual([r.set, r.inputs, r.banking77, r.nlupp, r.chars], ['held-out', { file: 'data/heldout-inputs.json', sha256: 'abc' }, 2, 1, 99]);
  assert.deepEqual(r.meter, { messages: 2, routed: 1, right: 1 });
  const wants = masks.map(R.routerOf(LIB, net));
  assert.deepEqual(JSON.parse(JSON.stringify(R.runRecord(net, LIB, masks, wants))), Object.fromEntries(Object.entries(r).slice(7)));
  assert.equal(text, JSON.stringify(r, null, 1) + '\n');
  assert.deepEqual(JSON.parse(H.heldText(LIB, { ...inputs, meter: 9 }, 'x')).meter, { messages: 3, routed: 2, right: 1 });
  assert.deepEqual(JSON.parse(H.heldText(LIB, { ...inputs, meter: 'two' }, 'x')).meter, { messages: 0, routed: 0, right: 0 });
  assert.deepEqual(JSON.parse(H.heldText(LIB, { ...inputs, meterRight: 7 }, 'x')).meter, { messages: 2, routed: 1, right: 0 });
  const empty = JSON.parse(H.heldText(LIB, null, 7));
  assert.deepEqual([empty.n, empty.inputs.sha256, empty.meter.messages], [0, '7', 0]);
});
