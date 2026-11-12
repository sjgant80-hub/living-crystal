// living-crystal · src/held.mjs — the held-out record's text, built the same way by tools/heldout.mjs (in Node) and by
// the page's worker (in a browser), from the committed inputs: which of the library's words each held-out message holds.
// Pure: the caller supplies the inputs file's SHA-256 (Node's crypto or the browser's WebCrypto).
//
//   HEADER                               → the record's first two fields
//   masksOf(inputs)                      → the masks, in held-out order
//   heldText(lib, inputs, inputsSha, onPoint) → the record, as the exact JSON text committed in data/heldout.json
import C from './cast.mjs';
import R from './record.mjs';

export const HEADER = Object.freeze({ set: 'held-out', what: 'every Banking77 message outside the library\'s seed slice, in its exam order, then every NLU++ message' });

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** masksOf(inputs) → the masks of the inputs file (base 36, comma separated); [] for anything else */
export function masksOf(inputs) {
  if (!isObj(inputs) || typeof inputs.masks !== 'string' || inputs.masks === '') return [];
  return inputs.masks.split(',').map((s) => parseInt(s, 36));
}

/** heldText(lib, inputs, inputsSha, onPoint) → the held-out record's JSON text: the router's decision on each mask, the
 *  whole sealed run (record.runRecord), and the meter's routed and right counts */
export function heldText(lib, inputs, inputsSha, onPoint) {
  const net = C.cast(lib), masks = masksOf(inputs), router = R.routerOf(lib, net);
  const wants = masks.map(router);
  const rec = R.runRecord(net, lib, masks, wants, onPoint);
  const n = isObj(inputs) && Number.isInteger(inputs.meter) ? Math.min(inputs.meter, masks.length) : 0;
  const bits = isObj(inputs) && typeof inputs.meterRight === 'string' ? inputs.meterRight : '';
  const meter = { messages: n, routed: 0, right: 0 };
  for (let i = 0; i !== n; i++) { if (wants[i].route) meter.routed++; if (bits[i] === '1') meter.right++; }
  const i = isObj(inputs) ? inputs : {};
  const out = { ...HEADER, inputs: { file: 'data/heldout-inputs.json', sha256: String(inputsSha) }, banking77: i.banking77, nlupp: i.nlupp, chars: i.chars, meter, ...rec };
  return JSON.stringify(out, null, 1) + '\n';
}

export default { HEADER, masksOf, heldText };
