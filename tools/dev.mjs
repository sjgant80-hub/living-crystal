#!/usr/bin/env node
// tools/dev.mjs — the dev run (CLAIMS.md, seal 1): every sealed measurement, on the 3,000 messages of the library's
// own seed slice only (the messages its patterns were mined from). The held-out set is not touched.
//   node tools/dev.mjs [--polyai <dir>]           → writes data/dev.json
//   node tools/dev.mjs [--polyai <dir>] --check   → CI: re-derives it and fails unless it is byte for byte the same
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import C from '../src/cast.mjs';
import R from '../src/record.mjs';
import D from './data.mjs';

const lib = D.rules(), net = C.cast(lib);
const { dev } = D.sets(D.polyaiDir(process.argv));
const { masks, wants } = D.read(net, lib, dev, R.routerOf(lib, net));
const t0 = Date.now();
const rec = R.runRecord(net, lib, masks, wants, (p) => process.stderr.write('  ' + p + '  ' + Math.round((Date.now() - t0) / 1000) + ' s\n'));
const out = { set: 'dev', what: 'the library\'s seed slice: the 3,000 Banking77 messages its patterns were mined from', ...rec };
const text = JSON.stringify(out, null, 1) + '\n';
const at = new URL('../data/dev.json', import.meta.url);
if (process.argv.includes('--check')) {
  const want = readFileSync(at, 'utf8');
  if (want !== text) { console.error('::error::data/dev.json does not re-derive'); process.exit(1); }
  console.log('dev re-derived byte for byte (' + out.n + ' messages)');
} else {
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  writeFileSync(at, text);
  console.log(JSON.stringify(out.verdicts, null, 1));
}
