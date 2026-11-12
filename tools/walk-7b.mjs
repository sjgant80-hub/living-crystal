#!/usr/bin/env node
// tools/walk-7b.mjs — the buyer walk's first pass on the LOCAL model (qwen2.5:7b on 127.0.0.1, no cloud call). Five
// buyer personas read the LIVE page cold, as rendered: data/walk-page.json holds each section's text as the browser
// showed it (words and every figure the page fills in from the records), captured from the live URL. Each persona
// lists confusions, dead ends, unanswered objections and unbacked claims. Writes data/walk-7b.md. Run by hand.
//   node tools/walk-7b.mjs [--dry]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { request } from 'node:http';

const page = JSON.parse(readFileSync(new URL('../data/walk-page.json', import.meta.url), 'utf8'));
const take = (ids, max) => ids.map((id) => '## ' + id + '\n' + String(page.sections[id] || '').replace(/\s*\n\s*/g, '\n')).join('\n\n').slice(0, max);
const PERSONAS = [
  ['the chief technology officer of a company that makes edge devices and is evaluating analogue in-memory chips', 'whether the claims are believable, what device a real run needs, what is not proven, what is confusing', ['hero', 'result', 'edge', 'next']],
  ['a chief financial officer', 'the money: what it saves, whether the numbers are believable and traceable, what it costs to adopt', ['hero', 'what', 'business']],
  ['a chief information security officer', 'what can go wrong, what fails silently, what runs where, what an auditor would ask', ['hero', 'what', 'found', 'business']],
  ['a head of risk and compliance at a bank', 'whether a decision is explainable and evidenced, what a wrong route costs, what is confusing', ['hero', 'words', 'how', 'adoption']],
  ['a procurement lead comparing it with other AI and chip vendors', 'what is missing for a purchase decision: support, roll-out, proof, risks, who supplies it', ['hero', 'what', 'next', 'business']],
];
const prompt = (who, focus, text) => `You are ${who}. You have just opened this product page for the first time (${page.url}, read ${page.at}). Focus on ${focus}.\n\nTHE PAGE, AS SHOWN (its words and the figures it fills in from its records):\n${text}\n\nList up to 6 specific problems a buyer like you would have with this page: confusions, dead ends, unanswered objections, claims with no evidence, numbers you cannot trace. Quote the words each one is about. One problem per line, starting with "- ". No praise, no summary.`;

if (process.argv.includes('--dry')) { for (const [who, , ids] of PERSONAS) console.log(who + ': ' + take(ids, 9000).length + ' characters'); process.exit(0); }

// node:http, not fetch: fetch gives up after 300 s waiting for headers, and the 7B on a CPU can take longer
function ask(text) {
  const body = JSON.stringify({ model: 'qwen2.5:7b', prompt: text, stream: false, keep_alive: '10m', options: { temperature: 0.2, seed: 7, num_ctx: 4096, num_predict: 420 } });
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let s = ''; res.on('data', (d) => (s += d)); res.on('end', () => { if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode)); try { resolve(JSON.parse(s).response || ''); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.end(body);
  });
}

// --retry re-asks only the personas whose answer in data/walk-7b.md is an ERROR, and keeps the error beside the answer
const RETRY = process.argv.includes('--retry');
const OUTF = new URL('../data/walk-7b.md', import.meta.url);
if (RETRY && existsSync(OUTF)) {
  let md = readFileSync(OUTF, 'utf8');
  for (const [who, focus, ids] of PERSONAS) {
    const head = '## ' + who + '\n\nRead: ' + ids.join(', ') + '\n\nERROR: ';
    const i = md.indexOf(head);
    if (i < 0) continue;
    const j = md.indexOf('\n', i + head.length), err = md.slice(i + head.length, j);
    let a;
    try { a = await ask(prompt(who, focus, take(ids, 9000))); } catch (e) { a = 'ERROR again: ' + String(e && e.message); }
    md = md.slice(0, i) + '## ' + who + '\n\nRead: ' + ids.join(', ') + '\n\n(First attempt: ERROR ' + err + ' — Node fetch gave up after 300 s waiting for the local 7B; asked again over node:http at ' + new Date().toISOString() + '.)\n\n' + a.trim() + md.slice(j);
    writeFileSync(OUTF, md);
    console.log('re-walked: ' + who);
  }
  process.exit(0);
}

const out = ['# Buyer walk, first pass (local qwen2.5:7b on 127.0.0.1), ' + new Date().toISOString(), '', 'Five personas read the live page cold, as the browser rendered it (data/walk-page.json, captured from ' + page.url + ' at ' + page.at + '). No cloud model was called. Every item is answered on the page; the fixes are listed in data/walk-fixes.md.', ''];
for (const [who, focus, ids] of PERSONAS) {
  let a;
  try { a = await ask(prompt(who, focus, take(ids, 9000))); } catch (e) { a = 'ERROR: ' + String(e && e.message); }
  out.push('## ' + who, '', 'Read: ' + ids.join(', '), '', a.trim(), '');
  console.log('walked: ' + who);
}
writeFileSync(new URL('../data/walk-7b.md', import.meta.url), out.join('\n') + '\n');
console.log('wrote data/walk-7b.md');
