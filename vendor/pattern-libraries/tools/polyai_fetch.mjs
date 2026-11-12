#!/usr/bin/env node
// tools/polyai_fetch.mjs — fetch Banking77 and NLU++ (PolyAI, CC BY 4.0; github.com/PolyAI-LDN/task-specific-datasets)
// at one pinned commit, into <dir>, keeping the repository's paths. Prints every file's sha256 and a manifest hash
// (sha256 over the sorted "path sha256" lines). With --check <manifest sha>, fails unless the files are exactly those.
//   node tools/polyai_fetch.mjs <dir> [--check <sha256>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export const COMMIT = '57ec275d8078af65b7731c2a98be812d844a6d6b';
export const FILES = [
  'LICENSE', 'banking_data/train.csv', 'banking_data/test.csv', 'banking_data/categories.json', 'nlupp/data/ontology.json',
  ...['banking', 'hotels'].flatMap((d) => Array.from({ length: 20 }, (_, i) => 'nlupp/data/' + d + '/fold' + i + '.json')),
];
const sha = (b) => createHash('sha256').update(b).digest('hex');

const [dir] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--check');
const ci = process.argv.indexOf('--check'), want = ci >= 0 ? process.argv[ci + 1] : null;
if (!dir) { console.error('usage: polyai_fetch.mjs <dir> [--check <manifest sha256>]'); process.exit(2); }
const lines = [];
let bytes = 0;
for (const f of FILES) {
  const url = 'https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/' + COMMIT + '/' + f;
  const r = await fetch(url);
  if (!r.ok) { console.error('::error::' + f + ': HTTP ' + r.status); process.exit(1); }
  const b = Buffer.from(await r.arrayBuffer());
  mkdirSync(dirname(join(dir, f)), { recursive: true });
  writeFileSync(join(dir, f), b);
  bytes += b.length;
  lines.push(f + ' ' + sha(b));
}
const manifest = sha(lines.sort().join('\n') + '\n');
console.log(lines.join('\n'));
console.log(FILES.length + ' files, ' + bytes + ' bytes, manifest sha256 ' + manifest);
if (want && want !== manifest) { console.error('::error::the files are not the pinned ones (manifest ' + manifest + ', want ' + want + ')'); process.exit(1); }
