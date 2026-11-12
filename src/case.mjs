// living-crystal · src/case.mjs — what the cast is worth to a buyer, from the record's measured counts, sourced prices
// and the buyer's own figures; never from typed numbers. Pure and total; garbage in never throws.
//
//   sorting(inputs, measured)        → the hand-routing time the cast's right routes take off, per month
//   cloud(inputs, prices, measured)  → what sending every message to a frontier model to be routed would cost, per month
//   spreadAt(t)                      → the device-to-device conductance spread the drift model gives after t seconds
import X from './crossbar.mjs';

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x, lo, hi) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
const cents = (x) => Math.round(x * 100) / 100;

/** sorting(inputs, measured) → { ok, share, routed, right, hours, cost, why } per month.
 *  inputs = the buyer's { messages (a month), minutes (to route one by hand), rate (cost of an hour) };
 *  measured = { routed, right, of } on the library's meter, from the record. Only right routes count: a wrong route
 *  still has to be sorted by hand. */
export function sorting(inputs, measured) {
  const i = isObj(inputs) ? inputs : {}, m = isObj(measured) ? measured : {};
  const messages = num(i.messages, 0, 1e9), minutes = num(i.minutes, 0, 600), rate = num(i.rate, 0, 1e5);
  const of = Number.isInteger(m.of) ? num(m.of, 1, 1e9) : null;
  const right = Number.isInteger(m.right) && of !== null ? num(m.right, 0, of) : null;
  const routed = Number.isInteger(m.routed) && right !== null ? num(m.routed, right, of) : null;
  if ([messages, minutes, rate].includes(null)) return { ok: false, why: 'every input must be a number in range: messages a month, minutes to route one by hand, and the cost of an hour' };
  if (routed === null) return { ok: false, why: 'the measured counts are needed: routed and right out of the meter\'s messages' };
  const share = right / of, hours = (messages * share * minutes) / 60;
  return { ok: true, share, routed: cents((messages * routed) / of), right: cents(messages * share), hours: cents(hours), cost: cents(hours * rate), why: '' };
}

/** cloud(inputs, prices, measured) → { ok, perMessage, perMonth, tokensIn, why }: the price of sending each message's
 *  own text (about four characters a token, no instructions: the least such a call could cost) plus outTokens of
 *  answer to the model, at the printed price. inputs = { messages, model, outTokens }; measured = { chars, n } */
export function cloud(inputs, prices, measured) {
  const i = isObj(inputs) ? inputs : {}, m = isObj(measured) ? measured : {};
  const p = isObj(prices) && isObj(prices.models) && typeof i.model === 'string' ? prices.models[i.model] : null;
  const messages = num(i.messages, 0, 1e9), out = num(i.outTokens, 0, 1e5), chars = num(m.chars, 0, 1e12), n = num(m.n, 1, 1e9);
  if (!isObj(p) || num(p.in, 0, 1e4) === null || num(p.out, 0, 1e4) === null) return { ok: false, why: 'no printed price for that model' };
  if ([messages, out, chars, n].includes(null)) return { ok: false, why: 'every input must be a number in range: messages a month and answer tokens; and the measured characters' };
  const tokensIn = chars / n / 4, perMessage = (tokensIn * p.in + out * p.out) / 1e6;
  return { ok: true, tokensIn: Math.round(tokensIn * 100) / 100, perMessage, perMonth: cents(messages * perMessage), why: '' };
}

/** spreadAt(t) → NU_SPREAD · ln t: the standard deviation, on a log scale, of how far two devices have drifted apart
 *  after t seconds (0.08 is about 8%) */
export function spreadAt(t) {
  const s = num(t, 1, 1e12);
  return s === null ? 0 : X.NU_SPREAD * X.lnDet(s);
}

export default { sorting, cloud, spreadAt };
