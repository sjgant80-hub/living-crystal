#!/usr/bin/env node
// tools/proof.mjs — LC1: every possible input on the ideal device. For all 2^21 subsets of the library's 21 words, the
// router's decision on a message made of exactly those words, and the cast's settled decision. No message is read.
//   node tools/proof.mjs           → writes data/proof.json
//   node tools/proof.mjs --check   → CI: re-derives it and fails unless it is byte for byte the committed one
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C from '../src/cast.mjs';
import X from '../src/crossbar.mjs';
import R from '../src/record.mjs';
import D from './data.mjs';

const lib = D.rules(), net = C.cast(lib), router = R.routerOf(lib, net), chip = X.program(net, X.IDEAL, 0);
const total = 2 ** net.words.length;
const hash = createHash('sha256');
const t = { inputs: total, match: 0, mismatches: 0, refusals: 0, routed: 0, conflicts: 0, reads: [0, 0, 0, 0], wavered: 0, firstMismatch: null };
for (let m = 0; m !== total; m++) {
  const want = router(m), res = X.settle(chip, C.driveOfMask(net, m), 0), d = C.decide(net, res);
  hash.update(m + ' ' + want.route + ' ' + want.also.join(',') + '\n');
  if (want.route) t.routed++;
  if (want.also.length) t.conflicts++;
  if (res.reads < t.reads.length) t.reads[res.reads]++;
  t.wavered += res.wavered;
  if (d.refused === true) t.refusals++;
  if (C.same(d, want)) t.match++;
  else { t.mismatches++; if (t.firstMismatch === null) t.firstMismatch = { mask: m, cast: d, router: want }; }
  if (m % 262144 === 0) process.stderr.write('  ' + m + ' of ' + total + '\n');
}
const out = {
  claim: 'LC1', what: 'every subset of the library\'s 21 words, the router against the cast settled on the ideal device',
  library: { patterns: net.np, words: net.words.length, routes: net.routes.length, devices: 2 * net.W.length },
  ...t, readsLabel: 'how many settles took 0, 1, 2, 3 reads (no settle may take more than 3 here)',
  routerDecisions: hash.digest('hex'),
  verdict: t.mismatches === 0 && t.refusals === 0 ? 'held' : 'failed',
};
const text = JSON.stringify(out, null, 1) + '\n';
const at = new URL('../data/proof.json', import.meta.url);
if (process.argv.includes('--check')) {
  const want = readFileSync(at, 'utf8');
  if (want !== text) { console.error('::error::data/proof.json does not re-derive\nwant ' + want + '\ngot  ' + text); process.exit(1); }
  console.log('LC1 re-derived byte for byte: ' + out.match + ' of ' + out.inputs + ' the same, ' + out.refusals + ' refused — ' + out.verdict);
} else {
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  writeFileSync(at, text);
  console.log(text);
}
