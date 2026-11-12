// worker.mjs — the page's re-runs, off the main thread, with the same kernels the record was made with.
//   { cmd: 'held' }  → re-computes data/heldout.json from data/heldout-inputs.json and compares its SHA-256
//   { cmd: 'all' }   → settles every possible input on the exact device and compares each with the router
import C from './src/cast.mjs';
import X from './src/crossbar.mjs';
import R from './src/record.mjs';
import H from './src/held.mjs';

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
const get = async (p) => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ': HTTP ' + r.status); return r.text(); };

self.onmessage = async (e) => {
  const t0 = Date.now();
  try {
    const lib = JSON.parse(await get('vendor/pattern-libraries/data/route/state.json')).library;
    if (e.data && e.data.cmd === 'held') {
      const inputsText = await get('data/heldout-inputs.json'), committed = await get('data/heldout.json');
      const parts = 2 + R.KNOBS.reduce((a, k) => a + k.values.length, 0) + 3;
      let done = 0;
      const text = H.heldText(lib, JSON.parse(inputsText), await sha(inputsText), (p) => { done++; self.postMessage({ progress: done / parts, label: p }); });
      const mine = await sha(text), theirs = await sha(committed);
      self.postMessage({ done: true, cmd: 'held', same: mine === theirs, mine, theirs, seconds: (Date.now() - t0) / 1000 });
    } else if (e.data && e.data.cmd === 'all') {
      const net = C.cast(lib), router = R.routerOf(lib, net), chip = X.program(net, X.IDEAL, 0), total = 2 ** net.words.length;
      const t = { inputs: total, match: 0, refusals: 0, routed: 0, conflicts: 0 };
      for (let m = 0; m !== total; m++) {
        const want = router(m), d = C.decide(net, X.settle(chip, C.driveOfMask(net, m), 0));
        if (want.route) t.routed++;
        if (want.also.length) t.conflicts++;
        if (d.refused === true) t.refusals++;
        if (C.same(d, want)) t.match++;
        if (m % 32768 === 0) self.postMessage({ progress: m / total, label: m + ' of ' + total });
      }
      const proof = JSON.parse(await get('data/proof.json'));
      const same = ['inputs', 'match', 'refusals', 'routed', 'conflicts'].every((k) => proof[k] === t[k]);
      self.postMessage({ done: true, cmd: 'all', same, mine: t, seconds: (Date.now() - t0) / 1000 });
    }
  } catch (err) {
    self.postMessage({ done: true, error: String(err && err.message ? err.message : err) });
  }
};
