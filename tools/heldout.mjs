#!/usr/bin/env node
// tools/heldout.mjs — THE held-out read (CLAIMS.md, seal 1): every sealed measurement on the 13,163 held-out messages.
// It refuses to run unless SEAL2.md names every file of code it runs by its SHA-256, and refuses to run a second time
// (the record is written once; after that only --check re-derives it).
//   node tools/heldout.mjs [--polyai <dir>]           → THE read: data/heldout.json, data/heldout-inputs.json, data/timing.json
//   node tools/heldout.mjs [--polyai <dir>] --check   → CI: re-reads the texts and re-derives both records byte for byte
//   node tools/heldout.mjs --inputs                   → re-derives data/heldout.json from data/heldout-inputs.json alone
//                                                       (what the page does in the browser)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C from '../src/cast.mjs';
import X from '../src/crossbar.mjs';
import R from '../src/record.mjs';
import D from './data.mjs';
import H from '../src/held.mjs';

const here = (p) => new URL('../' + p, import.meta.url);
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const CODE = ['src/cast.mjs', 'src/crossbar.mjs', 'src/record.mjs', 'src/held.mjs', 'tools/data.mjs', 'tools/heldout.mjs', 'vendor/SOURCES.json'];
const check = process.argv.includes('--check'), fromInputs = process.argv.includes('--inputs');

// seal 2: every file of code named by its hash, and the vendored files as SOURCES.json pins them
const seal = existsSync(here('SEAL2.md')) ? readFileSync(here('SEAL2.md'), 'utf8') : '';
for (const f of CODE) {
  const h = sha(readFileSync(here(f)));
  if (!seal.includes('`' + f + '` | ' + h)) { console.error('::error::SEAL2.md does not name ' + f + ' by its hash ' + h + ' — refusing to read the held-out set'); process.exit(1); }
}
const pins = JSON.parse(readFileSync(here('vendor/SOURCES.json'), 'utf8')).files;
for (const [f, h] of Object.entries(pins)) if (sha(readFileSync(here('vendor/pattern-libraries/' + f))) !== h) { console.error('::error::vendor/pattern-libraries/' + f + ' is not the pinned file'); process.exit(1); }
if (!check && !fromInputs && existsSync(here('data/heldout.json'))) { console.error('::error::the held-out set has been read once already (data/heldout.json); only --check or --inputs may re-derive it'); process.exit(1); }

const lib = D.rules(), net = C.cast(lib), routerOfMask = R.routerOf(lib, net);
const recordText = (inputs, inputsText) => H.heldText(lib, inputs, sha(inputsText), (p) => process.stderr.write('  ' + p + '\n'));

if (fromInputs) {
  const inputsText = readFileSync(here('data/heldout-inputs.json'), 'utf8');
  const text = recordText(JSON.parse(inputsText), inputsText);
  if (text !== readFileSync(here('data/heldout.json'), 'utf8')) { console.error('::error::data/heldout.json does not re-derive from its inputs'); process.exit(1); }
  console.log('data/heldout.json re-derived byte for byte from data/heldout-inputs.json alone');
  process.exit(0);
}

const { held, meter } = D.sets(D.polyaiDir(process.argv));
const nb = held.filter((d) => d.src === 'banking77').length, nn = held.length - nb;
const { masks, wants, right } = D.read(net, lib, held, routerOfMask);
const inputs = { ...H.HEADER, licence: 'derived from Banking77 and NLU++ (PolyAI, CC BY 4.0): which of the library\'s 21 words each message holds', words: net.words,
  banking77: nb, nlupp: nn, chars: held.reduce((a, d) => a + d.text.length, 0), meter, masks: masks.map((m) => m.toString(36)).join(','), meterRight: right.slice(0, meter).join('') };
const inputsText = JSON.stringify(inputs, null, 1) + '\n';
const text = recordText(inputs, inputsText);
if (check) {
  if (inputsText !== readFileSync(here('data/heldout-inputs.json'), 'utf8')) { console.error('::error::data/heldout-inputs.json does not re-derive from the texts'); process.exit(1); }
  if (text !== readFileSync(here('data/heldout.json'), 'utf8')) { console.error('::error::data/heldout.json does not re-derive'); process.exit(1); }
  console.log('held-out re-derived byte for byte from the PolyAI texts: ' + held.length + ' messages');
  process.exit(0);
}
writeFileSync(here('data/heldout-inputs.json'), inputsText);
writeFileSync(here('data/heldout.json'), text);

// LC10 — speed as measured on this machine (not re-derived: a clock is not a record)
const chip = X.program(net, X.IDEAL, 0), prof = X.program(net, R.PROFILE, R.chipSeed('profile', 0));
const time = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e3 / held.length; };
const T = (await import('../vendor/pattern-libraries/src/triage.mjs')).default;
const router = time(() => { for (const d of held) T.route(lib, T.routeUnits(d)); });
const settleIdeal = time(() => { for (const m of masks) C.decide(net, X.settle(chip, C.driveOfMask(net, m), 0)); });
const settleProfile = time(() => { masks.forEach((m, i) => C.decide(net, X.settle(prof, C.driveOfMask(net, m), R.msgSeed(1, i)))); });
const rec = JSON.parse(text);
const timing = {
  claim: 'LC10', machine: process.platform + ' ' + process.arch + ', Node ' + process.version, measuredAt: new Date().toISOString(),
  readsPerDecision: { mean: rec.ideal.sealed.reads / rec.ideal.sealed.n, max: rec.ideal.sealed.maxReads },
  microsecondsPerDecision: { router: router, emulatorIdeal: settleIdeal, emulatorAssumedDevice: settleProfile },
  note: 'wall-clock time of the JavaScript emulator and the library router on this machine; not a chip, and no electrical energy is measured',
};
writeFileSync(here('data/timing.json'), JSON.stringify(timing, null, 1) + '\n');
console.log(JSON.stringify({ verdicts: rec.verdicts, timing }, null, 1));
