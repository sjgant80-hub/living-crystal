// tools/polyai.mjs — read Banking77 and NLU++ (PolyAI, CC BY 4.0; github.com/PolyAI-LDN/task-specific-datasets at
// 57ec275) into queries: routing { id, text, intent } and triage { id, text, intents }. It reads only the files
// tools/polyai_fetch.mjs fetched, refuses them unless their manifest hash is the pinned one, and refuses a
// categories.json that is not the kernel's list. This repository commits no query. Sealed: CLAIMS.md (SEAL 3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import T from '../src/triage.mjs';

export const SOURCE = Object.freeze({
  name: 'Banking77 and NLU++', by: 'PolyAI (Casanueva et al., 2020; Casanueva et al., 2022)', licence: 'CC BY 4.0',
  repo: 'https://github.com/PolyAI-LDN/task-specific-datasets', commit: '57ec275d8078af65b7731c2a98be812d844a6d6b',
  files: 45, bytes: 1925654, manifest: 'd014c397bfa65560859b7856a4f855fbd738f6e49c71640b7219e3ab5f9549e5',
});
export const FILES = Object.freeze(['LICENSE', 'banking_data/train.csv', 'banking_data/test.csv', 'banking_data/categories.json', 'nlupp/data/ontology.json',
  ...['banking', 'hotels'].flatMap((d) => Array.from({ length: 20 }, (_, i) => 'nlupp/data/' + d + '/fold' + i + '.json'))]);
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** csv(text) → rows of fields (quoted fields may hold commas, quotes and newlines) */
export function csv(s) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/** load(dir) → { routes, triage } after checking every file against the pinned manifest */
export function load(dir) {
  const bufs = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(dir, f))]));
  const manifest = sha(FILES.map((f) => f + ' ' + sha(bufs[f])).sort().join('\n') + '\n');
  if (manifest !== SOURCE.manifest) throw new Error(dir + ' does not hold the pinned PolyAI files (manifest ' + manifest.slice(0, 12) + '…)');
  if (JSON.stringify(JSON.parse(bufs['banking_data/categories.json'].toString('utf8'))) !== JSON.stringify(T.INTENTS)) throw new Error('categories.json is not the kernel\'s list of intents');
  const routes = [];
  for (const split of ['train', 'test']) {
    const rows = csv(bufs['banking_data/' + split + '.csv'].toString('utf8'));
    rows.slice(1).forEach((r, i) => { if (r.length === 2) routes.push({ id: 'b77-' + split + '-' + String(i).padStart(5, '0'), text: r[0], intent: r[1] }); });
  }
  const triage = [];
  for (const d of ['banking', 'hotels']) for (let k = 0; k < 20; k++) {
    JSON.parse(bufs['nlupp/data/' + d + '/fold' + k + '.json'].toString('utf8')).forEach((e, i) => triage.push({ id: 'nlu-' + d + '-f' + k + '-' + String(i).padStart(3, '0'), text: String(e.text || ''), intents: Array.isArray(e.intents) ? e.intents : [] }));
  }
  return { routes, triage };
}

export const routeUnits = (docs) => { const u = {}; for (const d of docs) u[d.id] = T.routeUnits(d); return u; };
export const triageUnits = (docs) => { const u = {}; for (const d of docs) u[d.id] = T.triageUnits(d); return u; };
export default { SOURCE, FILES, csv, load, routeUnits, triageUnits };
