// test/page.test.mjs — the page holds to the seal and the surface rules: every section a stranger needs, every id the
// script uses, no measured number typed into the HTML, no electrical energy figure anywhere, no pricing of ours, no
// claim of life, the credits, and the imports resolve.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const at = (p) => new URL('../' + p, import.meta.url);
const html = readFileSync(at('index.html'), 'utf8'), app = readFileSync(at('app.mjs'), 'utf8'), worker = readFileSync(at('worker.mjs'), 'utf8');
const prose = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');

test('every section a stranger needs is on the page, and the nav reaches each', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  for (const s of ['result', 'try', 'edge', 'rerun', 'what', 'words', 'start', 'how', 'blueprint', 'found', 'next', 'adoption', 'paper', 'business']) {
    assert.ok(ids.includes(s), 'section ' + s);
    assert.ok(html.includes('href="#' + s + '"'), 'nav to ' + s);
  }
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), 'link target ' + m[1]);
  for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]), 'app.mjs uses #' + m[1]);
});

test('no measured number is typed into the HTML: every figure comes from a record', () => {
  // names and citations, and the device controls (their labels are settings, not results), are taken out first
  const names = /sjgant80-hub|SEAL2|Seal [12]\b|Amendment 1\b|Banking77|SHA-256|v0\.6|CC BY 4\.0|\(1982\)|Hopfield, 1982|PNAS 79\(8\)/g;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<label[\s\S]*?<\/label>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(names, ' ');
  assert.deepEqual([...text.matchAll(/\d+/g)].map((m) => text.slice(m.index - 20, m.index + 10)), []);
});

test('no electrical energy figure anywhere, and the limits are said', () => {
  const unit = /\d\s*(?:pJ|nJ|µJ|uJ|mJ|kJ|J|W|mW|µW|kW|Wh|kWh|TOPS)\b/;
  for (const f of ['index.html', 'app.mjs', 'worker.mjs', 'README.md', ...readdirSync(at('data')).map((d) => 'data/' + d)]) {
    assert.doesNotMatch(readFileSync(at(f), 'utf8'), unit, f);
  }
  assert.match(prose, /An emulator, not a chip/);
  assert.match(prose, /no electrical energy is measured/);
  assert.match(prose, /parked/);
});

test('the surface rules: our pricing never, no internal shorthand, no claim of life, the credits', () => {
  assert.doesNotMatch(html, /[£$€]/);
  for (const f of [html, app, worker]) {
    assert.doesNotMatch(f, /karma-didy|◊|κ|konomif|sididy|claudedidy|prime N\b/i);
    assert.doesNotMatch(f, /sentien/i);
  }
  for (const m of prose.matchAll(/alive/gi)) {
    const around = prose.slice(Math.max(0, m.index - 14), m.index + 15).toLowerCase();
    assert.ok(around.includes('not alive') || around.includes('is alive or aware'), 'alive only as a denial: ' + around);
  }
  assert.match(prose, /Powered by the Konomi architecture, created by Thomas Frumkin/);
  assert.match(prose, /Built by Kar for AI Native Solutions/);
  assert.match(prose, /CC BY 4\.0/);
  assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self';[^"]*connect-src 'self'/);
});

test('every import of the page and its worker resolves to a committed file', () => {
  for (const [file, src] of [['app.mjs', app], ['worker.mjs', worker]]) {
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) assert.ok(existsSync(new URL(m[1], at(file))), file + ' imports ' + m[1]);
  }
  for (const f of ['sw.js', 'manifest.webmanifest', 'data/proof.json', 'data/dev.json', 'vendor/pattern-libraries/data/route/state.json', 'vendor/pattern-libraries/data/prices.json']) assert.ok(existsSync(at(f)), f);
  for (const k of ['cast', 'crossbar', 'record', 'case', 'held']) {
    const r = JSON.parse(readFileSync(at('receipts/gate-' + k + '.json'), 'utf8'));
    assert.deepEqual([r.kernel, r.witness, r.clean, r.ignored, r.survived, r.killed === r.total], ['src/' + k + '.mjs', 'v0.6', true, 0, 0, true]);
  }
});
