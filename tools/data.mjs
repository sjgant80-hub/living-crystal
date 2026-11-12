// tools/data.mjs — the sealed sets (CLAIMS.md, seal 1). The messages come only through the library's own loader
// (vendor/pattern-libraries/tools/polyai.mjs), which refuses files that are not the pinned PolyAI commit. Dev = the
// library's seed slice of its exam order; held-out = every other Banking77 message in exam order, then every NLU++
// message in loader order. This file only names the sets; reading a set's messages is what dev.mjs and heldout.mjs do.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import L from '../vendor/pattern-libraries/tools/polyai.mjs';
import { schedule } from '../vendor/pattern-libraries/src/cycle.mjs';
import T from '../vendor/pattern-libraries/src/triage.mjs';
import C from '../src/cast.mjs';

export const LIBRARY = new URL('../vendor/pattern-libraries/data/route/state.json', import.meta.url);
export const rules = () => JSON.parse(readFileSync(LIBRARY, 'utf8')).library;

/** polyaiDir(argv) → --polyai <dir>, or the local copy the library's night uses */
export function polyaiDir(argv) {
  const i = argv.indexOf('--polyai');
  return i >= 0 ? argv[i + 1] : join(homedir(), '.si-didy', 'patterns', 'sources', 'polyai');
}

/** sets(dir) → { dev: [doc], held: [doc] } — docs as the loader gives them; nothing is computed on them here */
export function sets(dir) {
  const { routes, triage } = L.load(dir);
  const plan = schedule(routes.map((d) => d.id), T.ROUTE_SCHEDULE);
  const byId = new Map(routes.map((d) => [d.id, d]));
  const seed = new Set(plan.seed);
  const dev = plan.seed.map((id) => byId.get(id));
  const held = [...plan.order.filter((id) => !seed.has(id)).map((id) => ({ ...byId.get(id), src: 'banking77' })),
    ...triage.map((d) => ({ id: d.id, text: d.text, intent: '', src: 'nlupp' }))];
  return { dev, held, meter: plan.meter.length };
}

/** read(net, lib, docs) → for each message: its mask over the library's words and the router's decision on its text,
 *  and a check that the router decides the same on the mask's words alone (the cast's whole input) */
export function read(net, lib, docs, routerOfMask) {
  const masks = [], wants = [], right = [];
  for (const doc of docs) {
    const units = T.routeUnits(doc), first = units[T.ROUTES[0]][0];
    const r = T.route(lib, units), want = C.fromRouter(r), mask = C.maskOf(net, first.tokens);
    if (!C.same(want, routerOfMask(mask))) throw new Error('the router decides ' + doc.id + ' differently from its words alone');
    masks.push(mask); wants.push(want); right.push(r && r.right === true ? 1 : 0);
  }
  return { masks, wants, right };
}

export default { LIBRARY, rules, polyaiDir, sets, read };
