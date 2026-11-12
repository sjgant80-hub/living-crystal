// app.mjs — the page. Every number it shows is read from the committed records (data/*.json, receipts/*.json) or
// computed in this tab by the same kernels the records were made with. Text from records is set as text, never HTML.
import C from './src/cast.mjs';
import X from './src/crossbar.mjs';
import R from './src/record.mjs';
import K from './src/case.mjs';
import T from './vendor/pattern-libraries/src/triage.mjs';

const $ = (id) => document.getElementById(id);
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
  for (const c of kids.flat()) if (c !== null && c !== undefined) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-GB') : '–');
const pct = (a, b, d = 2) => (b ? ((100 * a) / b).toFixed(d) + '%' : '–');
const chip = (v) => el('span', { class: 'chip ' + (v === 'held' ? 'win' : v === 'failed' ? 'bad' : 'mid') }, v);
const say = (r) => (r ? T.say(r) : 'no team: it goes to a person');
const get = async (p) => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ': HTTP ' + r.status); return r.json(); };
const opt = async (p) => { try { return await get(p); } catch { return null; } };

const KNOB = {
  bits: { name: 'Conductance levels', label: (v) => v + (v === 1 ? ' bit' : ' bits'), plain: (a, b) => (a !== null ? 2 ** a + ' levels per device hold it' : 'no grid value holds') + (b !== null ? '; ' + 2 ** b + ' levels do not' : '') },
  write: { name: 'Write noise', label: (v) => +(v * 100).toFixed(2) + '%', plain: (a, b) => 'programming error up to ' + (a !== null ? +(a * 100).toFixed(2) + '%' : 'none') + ' of a device\'s full range holds' + (b !== null ? '; ' + +(b * 100).toFixed(2) + '% does not' : '') },
  read: { name: 'Read noise', label: (v) => +(v * 100).toFixed(2) + '%', plain: (a, b) => 'noise up to ' + (a !== null ? +(a * 100).toFixed(2) + '%' : 'none') + ' of each device\'s own current, on every read, holds' + (b !== null ? '; ' + +(b * 100).toFixed(2) + '% does not' : '') },
  'drift-raw': { name: 'Drift, uncorrected', label: (v) => TIME[v] || v + ' s', plain: (a, b) => 'the sag after ' + (a !== null ? TIME[a] : 'no time') + ' holds' + (b !== null ? '; after ' + TIME[b] + ' it does not' : '') },
  'drift-comp': { name: 'Drift, compensated', label: (v) => TIME[v] || v + ' s', plain: (a, b) => 'devices drifting apart by about ' + (a !== null ? (100 * K.spreadAt(a)).toFixed(0) + '%' : '0%') + ' (one standard deviation) hold' + (b !== null ? '; about ' + (100 * K.spreadAt(b)).toFixed(0) + '% does not' : '') },
  'stuck-0': { name: 'Dead cells (stuck at zero)', label: (v) => +(v * 100).toFixed(2) + '%', plain: (a, b) => (a !== null ? +(a * 100).toFixed(2) + '% of devices dead holds' : 'no grid value holds') + (b !== null ? '; ' + +(b * 100).toFixed(2) + '% does not' : '') },
  'stuck-1': { name: 'Shorted cells (stuck on)', label: (v) => +(v * 100).toFixed(2) + '%', plain: (a, b) => (a !== null ? +(a * 100).toFixed(2) + '% of devices shorted holds' : 'Even ' + +(b * 100).toFixed(2) + '% of devices shorted on breaks a chip') + (a !== null && b !== null ? '; ' + +(b * 100).toFixed(2) + '% does not' : '') },
};
const TIME = { 60: '1 minute', 3600: '1 hour', 86400: '1 day', 604800: '1 week', 2592000: '30 days', 31536000: '1 year', 315360000: '10 years' };
const SHORT = { 60: '1m', 3600: '1h', 86400: '1d', 604800: '1w', 2592000: '30d', 31536000: '1y', 315360000: '10y' };

let S = null; // the loaded state

async function boot() {
  const [proof, held, inputs, timing, state, prices, dev] = await Promise.all([get('data/proof.json'), get('data/heldout.json'), get('data/heldout-inputs.json'),
    opt('data/timing.json'), get('vendor/pattern-libraries/data/route/state.json'), get('vendor/pattern-libraries/data/prices.json'), opt('data/dev.json')]);
  const gates = {};
  for (const k of ['cast', 'crossbar', 'record', 'held', 'case']) gates[k] = await opt('receipts/gate-' + k + '.json');
  const ci = await opt('data/ci.json');
  const lib = state.library, net = C.cast(lib);
  S = { proof, held, inputs, timing, lib, net, prices, dev, gates, ci, router: R.routerOf(lib, net), masks: inputs.masks.split(',').map((s) => parseInt(s, 36)) };
  for (const f of [verdictLine, resultCards, claimTable, tryInit, edgeInit, rerunInit, traceInit, howSvg, blueprint, findings, business, needs, driftModel, ciLine]) {
    try { f(); } catch (e) { console.error(f.name, e); }
  }
}

// ── the result ────────────────────────────────────────────────────────────────
const V = (rd) => S.held.verdicts[rd];
const pooledProfile = (rd) => R.pooled(S.held.profile.chips, rd);

function verdictLine() {
  const s = V('sealed'), k = V('sticky');
  const heldList = [], failList = [];
  (S.proof.verdict === 'held' ? heldList : failList).push('every possible input (LC1)');
  (s.LC2 === 'held' ? heldList : failList).push('every held-out message on the exact device (LC2)');
  (s.LC7 === 'held' ? heldList : failList).push('a glitched line refused, never misread (LC7)');
  (s.LC3 === 'held' ? heldList : failList).push('the assumed device (LC3: ' + s.LC3chips + ' of 10 chips; sticky ' + k.LC3chips + ')');
  (s.LC4 === 'held' ? heldList : failList).push('no silent wrong answers there (LC4)');
  (s.LC8 === 'held' ? heldList : failList).push('a faulty front end read as its rounding (LC8)');
  $('verdictline').replaceChildren(el('b', {}, 'Held: '), heldList.join(', ') + '. ', el('b', {}, 'Failed, and kept: '), (failList.join(', ') || 'none') + '.');
}

function resultCards() {
  const p = S.proof, id = S.held.ideal.sealed, s = V('sealed'), k = V('sticky');
  const pp = pooledProfile('sealed'), pk = pooledProfile('sticky');
  const gl = S.held.glitch, fe = S.held.frontend, od = S.held.overdrive.sealed;
  const card = (key, big, vs, v) => el('div', { class: 'card' }, el('div', { class: 'k' }, key), el('div', { class: 'big' }, big), el('div', { class: 'vs' }, vs), v ? el('div', {}, chip(v)) : null);
  const t = S.timing;
  $('resultcards').replaceChildren(
    card('Every possible input · exact device', fmt(p.match) + ' of ' + fmt(p.inputs), 'every combination of the ' + S.net.words.length + ' words the library reads (the router reads nothing else, so this is its whole input space), each decided exactly as the router decides; ' + fmt(p.refusals) + ' refused; every settle in 3 reads or fewer', p.verdict),
    card('Held-out messages · exact device', fmt(id.match) + ' of ' + fmt(id.n), 'every Banking77 message outside the library\'s seed slice (' + fmt(S.held.banking77) + ', in the library\'s own exam order) and every NLU++ message (' + fmt(S.held.nlupp) + '): none chosen by hand; read once, after the code was frozen', s.LC2),
    card('The assumed device · 10 chips', s.LC3chips + ' of 10 chips', 'matched on at least 99.9% of held-out messages (sealed reading; sticky: ' + k.LC3chips + ' of 10). Each chip programmed from its own sealed seed and run on all ' + fmt(S.held.n) + ' messages: a day of drift, compensated; 4 bits; 2% write and read noise.', s.LC3),
    card('Settled wrong on the assumed device', fmt(pp.wrong) + ' of ' + fmt(pp.n), pct(pp.wrong, pp.n, 3) + ' of decisions, sealed reading; sticky: ' + fmt(pk.wrong) + ' (' + pct(pk.wrong, pk.n, 3) + '). The bar was 0.01%. Why: devices drift apart (see What we found).', s.LC4),
    card('A glitched input line · exact device', fmt(gl.sealed.neither) + ' misread', 'of ' + fmt(gl.sealed.n) + ' half-level glitches; of the ' + fmt(gl.sealed.ambiguous) + ' that could change the decision, ' + pct(gl.sealed.ambiguousRefused, gl.sealed.ambiguous, 1) + ' refused (sticky: ' + pct(gl.sticky.ambiguousRefused, gl.sticky.ambiguous, 1) + ')', s.LC7),
    card('A faulty front end · exact device', pct(fe.sealed.refused, fe.sealed.n, 1) + ' refused', 'each of ' + fmt(fe.sealed.n) + ' drives set every input line to a seeded random level between off and on; ' + fmt(fe.sealed.other) + ' of ' + fmt(fe.sealed.n) + ' random drives settled to a decision other than their rounding (sticky: ' + fmt(fe.sticky.other) + '). The bar was 0.', s.LC8),
    card('Over-drive · the known gap', fmt(od.neither) + ' of ' + fmt(od.n), 'lines driven at twice the rail that forged a decision neither reading gives. Not caught by the settle: input drivers must clip.', null),
    card('Speed, as measured', t ? (t.readsPerDecision.mean).toFixed(2) + ' reads per decision' : '–', t ? 'at most ' + t.readsPerDecision.max + ' reads; the JavaScript emulator took ' + t.microsecondsPerDecision.emulatorIdeal.toFixed(1) + ' µs a decision, the library router ' + t.microsecondsPerDecision.router.toFixed(1) + ' µs (' + t.machine + '). No electrical energy is measured.' : '', null),
  );
}

function claimTable() {
  const s = V('sealed'), k = V('sticky');
  const knobs = (v) => { const h = v.LC6.filter((x) => x.verdict === 'held').length, f = v.LC6.filter((x) => x.verdict === 'failed').length; return h + ' held, ' + f + ' failed of ' + v.LC6.length; };
  const gatesClean = Object.values(S.gates).every((g) => g && g.clean === true && g.ignored === 0);
  const ci = S.ci ? 'run ' + S.ci.run + ' green' : 'see Actions';
  const rows = [
    ['LC1', 'Every possible input, exact device: the cast decides as the router does', '0 mismatches, 0 refusals', 'data/proof.json', chip(S.proof.verdict), chip(S.proof.verdict)],
    ['LC2', 'Every held-out message, exact device; at most 3 reads; the energy falls at every change', '0 mismatches, 0 refusals', 'data/heldout.json', chip(s.LC2), chip(k.LC2)],
    ['LC3', 'Held-out, the assumed device: decisions match the router', 'at least 99.9% on at least 9 of 10 chips', 'data/heldout.json', el('span', {}, chip(s.LC3), ' ' + s.LC3chips + ' of 10'), el('span', {}, chip(k.LC3), ' ' + k.LC3chips + ' of 10')],
    ['LC4', 'No silent wrong answers on the assumed device', 'at most 0.01% settled wrong', 'data/heldout.json', chip(s.LC4), chip(k.LC4)],
    ['LC5', 'The edge of each fault, one at a time', 'reported, no bar', 'data/heldout.json', el('a', { href: '#edge' }, 'seven edges'), el('a', { href: '#edge' }, 'seven edges')],
    ['LC6', 'It fails loud: refusals, not wrong answers, for each fault', 'at least 90% of non-matches refused, per knob', 'data/heldout.json', knobs(s), knobs(k)],
    ['LC7', 'A line glitched to half level is refused, not misread', '0 misread; at least half of the decisive glitches refused', 'data/heldout.json', chip(s.LC7), chip(k.LC7)],
    ['LC8', 'A random front-end fault is refused, or read as its rounding', '0 other decisions; at least half refused', 'data/heldout.json', chip(s.LC8), chip(k.LC8)],
    ['LC9', 'The known gap: a line over-driven to twice the rail', 'reported, no bar', 'data/heldout.json', fmt(s.LC9.reported) + ' of ' + fmt(s.LC9.of) + ' forged', fmt(k.LC9.reported) + ' of ' + fmt(k.LC9.of) + ' forged'],
    ['LC10', 'Speed as measured; no electrical energy figure anywhere', 'reported; checked by a test', 'data/timing.json', 'reported', 'reported'],
    ['LC11', 'Every record re-derives byte for byte, on GitHub\'s runner and in this tab', 're-derived', 'the CI run', ci, el('a', { href: '#rerun' }, 're-run it here')],
    ['LC12', 'Every kernel mutation-gated clean (witness v0.6), nothing baselined; garbage never throws', 'clean', 'receipts/gate-*.json', chip(gatesClean ? 'held' : 'failed'), chip(gatesClean ? 'held' : 'failed')],
  ];
  $('claimtable').tBodies[0].replaceChildren(...rows.map((r) => el('tr', {}, ...r.map((c, i) => el('td', i === 0 ? { class: 'num' } : {}, i === 3 ? el('code', {}, c) : c)))));
}

// ── settle a message ──────────────────────────────────────────────────────────
let frames = [], frame = 0;
function tryInit() {
  const net = S.net;
  $('glitch-line').append(...net.words.map((w, i) => el('option', { value: String(i) }, w)));
  $('preset').addEventListener('change', presetSet);
  for (const id of ['d-bits', 'd-write', 'd-read', 'd-t', 'd-comp', 'd-p0', 'd-p1']) $(id).addEventListener('input', () => { if ($('preset').value !== 'custom') $('preset').value = 'custom'; });
  $('settle').addEventListener('click', settleNow);
  $('step-prev').addEventListener('click', () => { frame = Math.max(0, frame - 1); drawFrame(); });
  $('step-next').addEventListener('click', () => { frame = Math.min(frames.length - 1, frame + 1); drawFrame(); });
  settleNow();
}
function presetSet() {
  const p = $('preset').value;
  const d = p === 'assumed' ? R.PROFILE : X.IDEAL;
  if (p === 'custom') return;
  $('d-bits').value = d.bits; $('d-write').value = d.write * 100; $('d-read').value = d.read * 100;
  $('d-t').value = String(d.t); $('d-comp').checked = d.comp; $('d-p0').value = d.p0 * 100; $('d-p1').value = d.p1 * 100;
  settleNow();
}
function deviceNow() {
  const n = (id) => Number($(id).value);
  return X.device({ bits: Math.round(n('d-bits')), write: n('d-write') / 100, read: n('d-read') / 100, t: n('d-t'), comp: $('d-comp').checked, p0: n('d-p0') / 100, p1: n('d-p1') / 100 });
}
function settleNow() {
  const net = S.net, text = $('msg').value.slice(0, 2000);
  const units = T.routeUnits({ id: 'yours', text, intent: '' }), tokens = units[T.ROUTES[0]][0].tokens;
  const mask = C.maskOf(net, tokens), x = C.driveOfMask(net, mask);
  const gl = $('glitch-line').value, lvl = Number($('glitch-level').value);
  if (gl !== '') x[Number(gl)] = lvl;
  const dev = deviceNow(), k = Math.max(0, Math.min(999, Math.round(Number($('d-chip').value) || 0)));
  const cs = R.chipSeed($('preset').value === 'assumed' ? 'profile' : 'page', k);
  const chipNow = X.program(net, dev, cs), res = X.settle(chipNow, x, R.msgSeed(cs, 0), { trace: true });
  const sealed = C.decide(net, res), sticky = C.decide(net, res, { sticky: true });
  const want = C.fromRouter(T.route(S.lib, units));
  $('lines').replaceChildren(...net.words.map((w, i) => el('span', { class: gl === String(i) ? 'half' : x[i] === 1 ? 'on' : '' }, w)));
  const show = (d) => (d.refused ? 'Refused: ' + (d.why === 'unsettled' ? 'the array did not settle in ' + C.STEPS + ' reads' : d.why === 'wavered' ? 'a column wavered on the way (sticky reading)' : 'two teams lit') : say(d.route) + (d.also.length ? '; conflicts: ' + d.also.map(say).join(', ') : ''));
  const ok = C.same(sealed, want);
  $('decision').replaceChildren(
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'The array decides'), el('p', {}, el('b', {}, show(sealed))), el('p', { class: 'small muted' }, 'Sticky reading: ' + show(sticky)), el('p', { class: 'small muted' }, (res.settled ? 'Settled after ' + res.reads + ' read' + (res.reads === 1 ? '' : 's') : 'Not settled after ' + res.reads + ' reads') + '; ' + res.wavered + ' column read' + (res.wavered === 1 ? '' : 's') + ' did not resolve.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'The library\'s router decides'), el('p', {}, el('b', {}, show(want))), el('p', { class: 'small muted' }, 'The library\'s own code on your message text, not the array.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'Same decision?'), el('p', {}, el('span', { class: 'chip ' + (ok ? 'win' : sealed.refused ? 'mid' : 'bad') }, ok ? 'the same' : sealed.refused ? 'refused' : 'different')), el('p', { class: 'small muted' }, ok ? 'The settled array and the software agree.' : sealed.refused ? 'The array refused: the message would go to a person.' : 'The array settled to a different answer: the dangerous failure.')),
  );
  frames = res.trace; frame = frames.length - 1;
  drawFrame();
}
function drawFrame() {
  const net = S.net, f = frames[frame];
  if (!f) return;
  $('stepnow').textContent = 'read ' + f.step + ' of ' + frames.length;
  $('energy').textContent = 'energy ' + f.energy.toFixed(2) + (f.resolved ? ' · every column resolved' : ' · some column did not resolve') + (f.changed ? '' : ' · nothing changed');
  const np = net.np, cw = 38, left = 64, top = 96, rh = 34, w = left + np * cw + 8, h = top + 2 * rh + 12;
  const svg = sv('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'The array\'s ' + 2 * np + ' units at read ' + f.step });
  svg.append(sv('text', { x: 4, y: top + 22, 'font-size': 12, fill: 'currentColor' }, 'fired'), sv('text', { x: 4, y: top + rh + 22, 'font-size': 12, fill: 'currentColor' }, 'first'));
  net.patterns.forEach((p, m) => {
    const x = left + m * cw;
    svg.append(sv('text', { x: x + 14, y: top - 6, 'font-size': 10.5, fill: 'currentColor', transform: 'rotate(-48 ' + (x + 14) + ' ' + (top - 6) + ')' }, p.when.join('+')));
    for (const [row, u, col] of [[0, m, 'var(--h)'], [1, np + m, 'var(--g)']]) {
      const on = f.s[u] === 1, undecided = Math.abs(f.f[u]) <= C.TAU;
      const r = sv('rect', { x, y: top + row * rh, width: cw - 6, height: rh - 6, rx: 4, style: 'fill:' + (on ? col : 'var(--off)') + (undecided ? ';stroke:var(--tie);stroke-width:3' : '') });
      r.append(sv('title', {}, (row === 0 ? 'fired: ' : 'first: ') + p.when.join(' + ') + ' → ' + T.say(p.then) + ' · field ' + f.f[u].toFixed(2)));
      svg.append(r, sv('text', { x: x + (cw - 6) / 2, y: top + row * rh + 18, 'font-size': 9.5, 'text-anchor': 'middle', style: 'fill:' + (on ? 'var(--bg)' : 'var(--muted)') }, (f.f[u] > 0 ? '+' : '') + f.f[u].toFixed(1)));
    }
  });
  $('arraywrap').replaceChildren(svg);
}

// ── where it breaks ───────────────────────────────────────────────────────────
function edgeInit() { $('edge-reading').addEventListener('change', edgeDraw); edgeDraw(); }
function edgeDraw() {
  const rd = $('edge-reading').value, v = V(rd);
  const figs = S.held.sweep.map((k) => {
    const meta = KNOB[k.knob], w = 300, h = 150, l = 30, b = 24, bw = (w - l - 6) / k.points.length;
    const svg = sv('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': meta.name + ': the worst chip at each point' });
    for (const y of [0, 50, 100]) svg.append(sv('line', { x1: l, x2: w - 4, y1: 10 + (h - b - 10) * (1 - y / 100), y2: 10 + (h - b - 10) * (1 - y / 100), stroke: 'currentColor', 'stroke-opacity': 0.15 }), sv('text', { x: l - 4, y: 14 + (h - b - 10) * (1 - y / 100), 'font-size': 9, 'text-anchor': 'end', fill: 'currentColor' }, y + '%'));
    k.points.forEach((p, i) => {
      const chips = p.chips.map((c) => c[rd]), worst = chips.reduce((a, c) => (c.match < a.match ? c : a), chips[0]);
      const ref = worst.unsettled + worst.two + worst.wavered, x = l + i * bw + 3, H = h - b - 10;
      let y = 10;
      for (const [n, col] of [[worst.wrong, 'var(--bad)'], [ref, 'var(--tie)'], [worst.match, 'var(--win)']]) {
        const hh = (H * n) / worst.n;
        if (hh > 0) svg.append(sv('rect', { x, y, width: bw - 6, height: hh, style: 'fill:' + col }));
        y += hh;
      }
      const all = chips.every(R.holds);
      svg.append(sv('text', { x: x + (bw - 6) / 2, y: h - 10, 'font-size': 9, 'text-anchor': 'middle', fill: 'currentColor' }, k.knob.startsWith('drift') ? SHORT[p.value] : meta.label(p.value)));
      svg.append(sv('text', { x: x + (bw - 6) / 2, y: h - 1, 'font-size': 9, 'text-anchor': 'middle', style: 'fill:' + (all ? 'var(--win)' : 'var(--bad)') }, all ? '✓' : '✗'));
      svg.lastChild.append(sv('title', {}, meta.label(p.value) + ': worst chip ' + worst.match + ' of ' + worst.n + ' matched, ' + ref + ' refused, ' + worst.wrong + ' settled wrong'));
    });
    return el('figure', {}, el('figcaption', {}, el('b', {}, meta.name)), svg);
  });
  $('multiples').replaceChildren(...figs);
  $('edgetable').tBodies[0].replaceChildren(...v.LC5.map((e, i) => {
    const meta = KNOB[e.knob], l = v.LC6[i];
    const fails = l.verdict === 'undecided' ? 'never failed on this grid' : (l.verdict === 'held' ? 'fails safe: ' : 'often settles wrong: only ') + fmt(l.refused) + ' of ' + fmt(l.nonmatch) + ' non-matching decisions were refusals';
    return el('tr', {}, el('td', {}, meta.name), el('td', { class: 'num' }, e.last === null ? 'nothing on the grid' : meta.label(e.last)), el('td', { class: 'num' }, e.first === null ? 'beyond the grid' : meta.label(e.first)), el('td', {}, meta.plain(e.last, e.first)), el('td', {}, chip(l.verdict), ' ', fails));
  }));
}

// ── re-run ────────────────────────────────────────────────────────────────────
function rerunInit() {
  const run = (cmd) => {
    const w = new Worker(new URL('worker.mjs', import.meta.url), { type: 'module' });
    for (const b of [$('rerun-held'), $('rerun-all')]) b.disabled = true;
    $('rerun-out').textContent = 'Running…';
    w.onmessage = (e) => {
      const m = e.data;
      if (!m.done) { $('rerun-bar').style.width = (100 * m.progress).toFixed(1) + '%'; $('rerun-out').textContent = 'Running: ' + m.label; return; }
      w.terminate();
      for (const b of [$('rerun-held'), $('rerun-all')]) b.disabled = false;
      $('rerun-bar').style.width = '100%';
      if (m.error) { $('rerun-out').textContent = 'Could not run: ' + m.error; return; }
      if (m.cmd === 'held') $('rerun-out').replaceChildren(chip(m.same ? 'held' : 'failed'), ' ', m.same ? 'Your browser re-computed the held-out record in ' + m.seconds.toFixed(0) + ' s and its SHA-256 equals the committed file\'s: ' + m.mine.slice(0, 16) + '…' : 'The re-computed record differs: ' + m.mine.slice(0, 16) + '… against ' + m.theirs.slice(0, 16) + '…');
      else $('rerun-out').replaceChildren(chip(m.same ? 'held' : 'failed'), ' ', fmt(m.mine.match) + ' of ' + fmt(m.mine.inputs) + ' inputs decided as the router decides, ' + fmt(m.mine.refusals) + ' refused, in ' + m.seconds.toFixed(0) + ' s; ' + (m.same ? 'the same counts as data/proof.json.' : 'NOT the counts in data/proof.json.'));
    };
    w.postMessage({ cmd });
  };
  $('rerun-held').addEventListener('click', () => run('held'));
  $('rerun-all').addEventListener('click', () => run('all'));
}

// ── how it works ──────────────────────────────────────────────────────────────
function howSvg() {
  const boxes = [['The library', 'kept patterns, each proven', 'on unseen messages'], ['The cast', 'a pattern unit and a', 'first-pattern unit each'], ['The array', 'every weight a pair of', 'devices; one read = all'], ['The settle', 'read, switch, repeat', 'until nothing changes'], ['The decision', 'the lit team, its', 'conflicts, or refuse']];
  const w = 900, h = 130, bw = 150, gap = (w - 20 - 5 * bw) / 4;
  const svg = sv('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'From the library to the decision in five steps' });
  svg.append(sv('defs', {}, sv('marker', { id: 'ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, sv('path', { d: 'M0 0L10 5L0 10z', fill: 'currentColor' }))));
  boxes.forEach(([t, a, b], i) => {
    const x = 10 + i * (bw + gap);
    svg.append(sv('rect', { x, y: 20, width: bw, height: 90, rx: 8, style: 'fill:var(--accent-dim);stroke:var(--accent)' }),
      sv('text', { x: x + bw / 2, y: 48, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: 'currentColor' }, t),
      sv('text', { x: x + bw / 2, y: 72, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'currentColor' }, a),
      sv('text', { x: x + bw / 2, y: 88, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'currentColor' }, b));
    if (i !== 4) svg.append(sv('line', { x1: x + bw + 4, x2: x + bw + gap - 4, y1: 65, y2: 65, stroke: 'currentColor', 'marker-end': 'url(#ar)' }));
  });
  $('howsvg').replaceChildren(svg);
}
function traceInit() {
  const net = S.net, wants = S.masks.map(S.router);
  let i = wants.findIndex((d) => d.also.length > 0);
  if (i < 0) i = wants.findIndex((d) => d.route);
  if (i < 0) { $('tracetext').textContent = 'No held-out message was routed.'; return; }
  const mask = S.masks[i], words = net.words.filter((w, j) => Math.floor(mask / 2 ** j) % 2 === 1), want = wants[i];
  const res = X.settle(X.program(net, X.IDEAL, 0), C.driveOfMask(net, mask), 0, { trace: true });
  const src = i < S.held.banking77 ? 'Banking77' : 'NLU++';
  $('tracetext').textContent = 'Held-out message ' + fmt(i + 1) + ' of ' + fmt(S.masks.length) + ' (' + src + ') holds the library\'s words ' + words.join(', ') + '. The router sends it to "' + say(want.route) + '"' + (want.also.length ? ' and names "' + want.also.map(say).join('", "') + '" as a conflict' : '') + '. On the exact device the array settles in ' + res.reads + ' reads, to ' + (C.same(C.decide(net, res), want) ? 'the same decision' : 'a different decision') + ':';
  const lit = (s, from) => net.patterns.filter((p) => s[from + p.index] === 1).map((p) => p.when.join('+')).join(', ') || '—';
  $('tracetable').tBodies[0].replaceChildren(...res.trace.map((f) => el('tr', {}, el('td', { class: 'num' }, f.step), el('td', {}, lit(f.s, 0)), el('td', {}, lit(f.s, net.np)), el('td', { class: 'num' }, f.energy.toFixed(0)), el('td', {}, f.changed ? 'yes' : 'no: settled'))));
}

// ── blueprint ─────────────────────────────────────────────────────────────────
function blueprint() {
  const g = (k) => { const r = S.gates[k]; return r ? el('span', {}, chip(r.clean && r.ignored === 0 ? 'held' : 'failed'), ' ' + r.killed + ' of ' + r.total + ' caught, ' + r.ignored + ' baselined') : '–'; };
  const rows = [
    ['vendor/pattern-libraries/', 'The kept patterns, the router, the exam order and the message loader, copied byte for byte from pattern-libraries at a pinned commit.', 'pinned by SHA-256'],
    ['src/cast.mjs', 'The cast: each pattern into a pattern unit and a first-pattern unit with their weights; the decision read off a settled state; the energy.', g('cast')],
    ['src/crossbar.mjs', 'The emulated crossbar: levels, write noise, stuck cells, drift, read noise; the settle with its dead band; maths with no engine-dependent functions.', g('crossbar')],
    ['src/record.mjs', 'The sealed runs: a chip over a set read two ways, the sweep, the three misfit drives, every bar judged on whole counts.', g('record')],
    ['src/held.mjs', 'The held-out record\'s text, built the same way in Node and in this page.', g('held')],
    ['src/case.mjs', 'The buyer\'s figures: hand-routing time, the printed cloud price, the drift spread.', g('case')],
    ['tools/proof.mjs · dev.mjs · heldout.mjs', 'Every possible input; the dev run; the held-out read (refuses without seal 2, refuses a second time).', 're-derived on GitHub\'s runner'],
    ['index.html · app.mjs · worker.mjs', 'This page: reads the records, settles your message, re-runs the record in your browser.', 'test/page.test.mjs'],
  ];
  $('blueprinttable').tBodies[0].replaceChildren(...rows.map(([a, b, c]) => el('tr', {}, el('td', {}, el('code', {}, a)), el('td', {}, b), el('td', {}, c))));
}

// ── what we found, the paper's results ───────────────────────────────────────
function findings() {
  const p = S.proof, id = S.held.ideal.sealed, s = V('sealed'), k = V('sticky'), pp = pooledProfile('sealed'), pk = pooledProfile('sticky');
  const e = Object.fromEntries(s.LC5.map((x) => [x.knob, x])), ek = Object.fromEntries(k.LC5.map((x) => [x.knob, x]));
  const l6 = Object.fromEntries(s.LC6.map((x) => [x.knob, x])), l6k = Object.fromEntries(k.LC6.map((x) => [x.knob, x]));
  const gl = S.held.glitch, fe = S.held.frontend, od = S.held.overdrive.sealed;
  const lab = (kn, v) => (v === null ? 'nothing on the grid' : KNOB[kn].label(v));
  const items = [
    ['Exact where it should be.', 'Every one of ' + fmt(p.inputs) + ' possible inputs and every one of ' + fmt(id.n) + ' held-out messages settle to the router\'s decision on the exact device, in ' + id.maxReads + ' reads or fewer, with the energy falling at every change.'],
    ['A modest device keeps it exact.', 'With every other fault off, every chip still matched on at least 99.9% of held-out messages down to ' + lab('bits', e.bits.last) + ' of conductance levels, with write noise up to ' + lab('write', e.write.last) + ' of full range and read noise up to ' + lab('read', e.read.last) + ' (sealed reading).'],
    ['Drift spread breaks it first.', 'On the assumed device (a day of drift, compensated) ' + s.LC3chips + ' of 10 chips held, and ' + fmt(pp.wrong) + ' of ' + fmt(pp.n) + ' decisions settled wrong (sticky: ' + fmt(pk.wrong) + '). Compensated drift held up to ' + lab('drift-comp', e['drift-comp'].last) + ' and broke at ' + lab('drift-comp', e['drift-comp'].first) + ': ' + KNOB['drift-comp'].plain(e['drift-comp'].last, e['drift-comp'].first) + '.'],
    ['Shorted cells break it at once, and silently.', KNOB['stuck-1'].plain(e['stuck-1'].last, e['stuck-1'].first) + '. Of its non-matching decisions, only ' + fmt(l6['stuck-1'].refused) + ' of ' + fmt(l6['stuck-1'].nonmatch) + ' were refusals.'],
    ['The fit-check works on a glitched line.', 'How it works: a sense amplifier whose field is within one unit of zero does not resolve, so the array cannot settle. How it was tested: each of the ' + S.net.words.length + ' input lines driven at half level on every held-out message. Of ' + fmt(gl.sealed.n) + ' half-level glitches, ' + fmt(gl.sealed.neither) + ' settled to a decision neither reading of the line gives; ' + pct(gl.sealed.ambiguousRefused, gl.sealed.ambiguous, 1) + ' of the decisive ones were refused, and ' + pct(gl.sticky.ambiguousRefused, gl.sticky.ambiguous, 1) + ' with the sticky latch.'],
    ['It does not round a faulty front end line by line.', fmt(fe.sealed.other) + ' of ' + fmt(fe.sealed.n) + ' random front-end drives settled to a decision other than their rounding (sticky: ' + fmt(fe.sticky.other) + '): a two-word rule adds its two lines, so two lines just above half can sum below its threshold. LC8 failed, kept.'],
    ['Over-drive is not caught.', fmt(od.neither) + ' of ' + fmt(od.n) + ' lines driven to twice the rail forged a decision neither reading gives: one over-driven word can stand in for a two-word rule. Input drivers must clip.'],
    ['The settle erased the uncertainty, again.', 'Under drift, a unit can sit undecided for a read or two and then be pushed off by a later unit\'s inhibition, so the array settles confidently on the wrong team: the ladder\'s Rung 3 lesson. The sticky latch turned read noise\'s errors into refusals (' + fmt(l6k.read.refused) + ' of ' + fmt(l6k.read.nonmatch) + ', against ' + fmt(l6.read.refused) + ' of ' + fmt(l6.read.nonmatch) + ' sealed), at the cost of refusing earlier (read-noise edge ' + lab('read', ek.read.last) + ' against ' + lab('read', e.read.last) + '). It does not catch drift or shorted cells: their wrong answers never waver.'],
  ];
  $('findings').replaceChildren(el('ul', {}, ...items.map(([h, t]) => el('li', {}, el('b', {}, h), ' ', t))));
  $('paperresults').replaceChildren(el('p', {}, 'The cast matched the library\'s software on all ' + fmt(p.inputs) + ' possible inputs and all ' + fmt(id.n) + ' held-out messages on an exact device. On an emulated device it stayed exact through coarse levels and several percent of write and read noise, and broke first, often silently, on drift spread between devices and on shorted cells. A dead band in the sense amplifiers made glitched inputs fail safe; a latch that remembers a wavering column made read noise fail safe as well. The full record, both readings and every failure, is above.'));
}

// ── for business ──────────────────────────────────────────────────────────────
function business() {
  const id = S.held.ideal.sealed, s = V('sealed'), e = Object.fromEntries(s.LC5.map((x) => [x.knob, x])), m = S.held.meter;
  const roles = [
    ['Chief executive', 'A decision engine you can check end to end: the rules were tested on data they never saw, and an emulated array was checked against them on every possible input. Real silicon is the next step.'],
    ['Finance', 'On the library\'s meter the cast routes ' + pct(m.right, m.messages, 1) + ' of messages correctly, with no per-message fee; the calculator below prices that against hand-routing and against a frontier model, on your own figures.'],
    ['Operations', 'A message the rules cannot place, or that the array refuses, goes to a person. Today that is most messages: on its meter the library routes ' + pct(m.routed, m.messages, 1) + ', so ' + pct(m.messages - m.routed, m.messages, 1) + ' go to a person. A drifted or damaged array can also misroute without warning: see the risks.'],
    ['Technology', 'One library becomes ' + fmt(2 * S.net.W.length) + ' devices on a crossbar; a decision takes at most ' + id.maxReads + ' array reads. The device must hold at least ' + (e.bits.last !== null ? 2 ** e.bits.last : '–') + ' conductance levels and keep drift spread small: see the edge map.'],
    ['Security', 'Glitched inputs are refused, not misread. Over-driven inputs and shorted cells are the named gaps: clip input drivers, and test and remap cells after programming.'],
    ['Risk and compliance', 'Each weight is a named rule with an exam record; each decision names the rule that made it. The record is re-derivable by anyone, byte for byte.'],
    ['The team', 'Fewer messages to sort by hand, and every hard one still arrives with a person, flagged.'],
  ];
  $('roles').replaceChildren(...roles.map(([k, t]) => el('div', { class: 'card' }, el('div', { class: 'k' }, k), el('p', {}, t))));
  const models = Object.keys(S.prices.models);
  $('c-model').replaceChildren(...models.map((k) => el('option', { value: k }, k)));
  $('c-msgs').value = '10000'; $('c-min').value = String(+(10 / 60).toFixed(2)); $('c-rate').placeholder = 'your figure';
  for (const id2 of ['c-msgs', 'c-min', 'c-rate', 'c-model']) $(id2).addEventListener('input', caseDraw);
  caseDraw();
  const risks = [
    ['This is an emulator.', 'Yes, and every page and record says so. The edge map says what a real device must meet; a real-chip run is the named next step.'],
    ['Devices drift apart.', 'They do, and it is the first fault that breaks this cast: ' + KNOB['drift-comp'].plain(e['drift-comp'].last, e['drift-comp'].first) + '. The acceptance line: keep the spread between devices below about ' + (100 * K.spreadAt(e['drift-comp'].last)).toFixed(0) + '% (one standard deviation) between refreshes; measure it on your device.'],
    ['Shorted cells.', KNOB['stuck-1'].plain(e['stuck-1'].last, e['stuck-1'].first) + ', and the answer can be confidently wrong. This page cannot know your device\'s rate of shorted cells: read it off the datasheet or a test of the programmed array, place it on the edge map, and remap around bad cells.'],
    ['The rules can be wrong.', 'The cast inherits the library exactly: on the library\'s meter it routed ' + fmt(m.routed) + ' of ' + fmt(m.messages) + ' messages, ' + fmt(m.right) + ' of them to the team the experts chose.'],
    ['Most messages are not routed yet.', 'True: the library is young and grows nightly; every message it cannot place goes to a person. Re-cast and re-check as it grows.'],
    ['It is an early step.', 'Yes: a first rung, proven in emulation, not a chip you can buy today. What it gives now is the method, the proof against the software, and the device requirements; the real-chip pilot is the next step.'],
    ['Lock-in.', 'None: MIT licence, your copy, no licence fee; the record and the code are public.'],
  ];
  $('risks').tBodies[0].replaceChildren(...risks.map(([a, b]) => el('tr', {}, el('td', {}, el('b', {}, a)), el('td', {}, b))));
  $('board').replaceChildren(
    el('p', {}, 'Every AI system asks the board to trust two things it cannot see: what the model will decide, and whether the hardware does what the model says. This work removes the first: the rules are proven on unseen data and readable one by one. It measures the second, in emulation: the array was checked against the rules on all ' + fmt(S.proof.inputs) + ' possible inputs, and swept fault by fault until it broke.'),
    el('p', {}, 'What failed is published as loudly as what held: on the assumed device only ' + s.LC3chips + ' of 10 chips stayed exact, because devices drift apart. The ask is a pilot on real silicon, with the edge map as the acceptance test and the first measured energy figure as its output.'),
  );
}
function caseDraw() {
  const m = S.held.meter;
  const inputs = { messages: Number($('c-msgs').value), minutes: Number($('c-min').value), rate: $('c-rate').value === '' ? 0 : Number($('c-rate').value) };
  const r = K.sorting(inputs, { routed: m.routed, right: m.right, of: m.messages });
  const c = K.cloud({ messages: inputs.messages, model: $('c-model').value, outTokens: 5 }, S.prices, { chars: S.held.chars, n: S.held.n });
  const card = (k, big, vs) => el('div', { class: 'card' }, el('div', { class: 'k' }, k), el('div', { class: 'big' }, big), el('div', { class: 'vs' }, vs));
  $('casecards').replaceChildren(
    card('Hand-routing taken off', r.ok ? fmt(r.hours) + ' hours a month' : '–', r.ok ? fmt(r.right) + ' messages routed right a month' + ($('c-rate').value === '' ? '; enter your cost of an hour to see the money' : ', worth ' + fmt(r.cost) + ' in your currency') : r.why),
    card('A frontier model routing every message', c.ok ? '$' + fmt(c.perMonth) + ' a month' : '–', c.ok ? 'about ' + c.tokensIn + ' tokens in and 5 out per message at the printed price; instructions not counted' : c.why),
    card('The cast', 'no per-message fee', 'decided on the device, from words it reads; electricity per decision is not measured here'),
  );
  $('casenote').textContent = 'How: hours a month = messages × (' + fmt(m.right) + ' right ÷ ' + fmt(m.messages) + ' on the meter) × minutes ÷ 60; money = hours × your cost of an hour; the model line = messages × (message tokens × input price + 5 answer tokens × output price). ' + fmt(Math.round((inputs.messages * (m.messages - m.routed)) / m.messages)) + ' messages a month would still be routed by a person. Sources: the share routed right is the library\'s own meter (' + fmt(m.right) + ' right of ' + fmt(m.messages) + ' messages), re-derived by this repository\'s record; the model prices are ' + S.prices.source + ' as read on ' + S.prices.read + '; the message length is the held-out messages\' own average. Your figures stay in this tab.';
}

function needs() {
  $('needs').textContent = 'For this library: ' + S.net.rows + ' rows by ' + S.net.cols + ' columns of differential pairs (' + fmt(2 * S.net.W.length) + ' devices), at least ' + (2 ** V('sealed').LC5.find((x) => x.knob === 'bits').last) + ' conductance levels per device, and a current read-out on every column with a comparator per column.';
}
function driftModel() {
  $('driftmodel').textContent = 'In this emulator each device\'s conductance falls as (time since programming) to the power −ν, with ν averaging ' + X.NU + ' and varying by ' + X.NU_SPREAD + ' (one standard deviation) between devices: an assumption shaped like phase-change memory, not a measured device.';
}
function ciLine() {
  if (!S.ci) return;
  $('ciline').replaceChildren('CI: ', el('a', { href: S.ci.url }, 'run ' + S.ci.run), ' green on commit ' + S.ci.commit.slice(0, 7) + ', read once by its run id.');
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot().catch((e) => { $('verdictline').textContent = 'The records could not be loaded: ' + e.message; });
