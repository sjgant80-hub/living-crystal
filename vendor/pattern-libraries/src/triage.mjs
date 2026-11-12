// pattern-libraries · src/triage.mjs — LIBRARY 3, TRIAGE AND ROUTING: a customer's message routed to one of 77 teams
// (Banking77) and flagged when it wants a human or something is lost or stolen (NLU++). Everything that turns a message
// into the cases Kar's pattern law (vendor/patlib) gates, and kept patterns back into a route and flags. Sealed first:
// CLAIMS.md (SEAL 3, d6a9001). Pure and total: no clock, no disk, no network, no model; garbage in never throws.
//
//   idOf(name)            an intent name as a task id (lower case, runs of other characters to one '-')
//   routeUnits(doc)       a routing query as one unit per route: right when it is the experts' intent; kw when the
//                         keyword router (every word of the route's own name) would send it there
//   triageUnits(doc)      a triage query as one unit per flag: right when the experts' list holds it; kw = ctrl-F
//   pick(rules, task, u)  the unit a kept rule for the task fires on, and the rule (one unit per task here)
//   route(rules, units)   the router: the first kept route pattern, in library order, that fires; every other route
//                         that also fired is named (a conflict)
//   keywordRoute(units)   the cheap method's route: the first route, in categories.json's order, whose name words it holds
//   routeOn(rules, units, ids)  T5's six counts on some queries: routed, right, conflicts; the keyword router's routed, right
//   read(text, routeRules, flagRules)  a stranger's message: its route (or unknown), the conflicts, the flags raised
import P from '../vendor/patlib/patlib.mjs';
import { asCase, isCaseFor } from './extract.mjs';

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);

// categories.json at commit 57ec275, in its own order (the loader refuses a file that differs)
export const INTENTS = Object.freeze(['card_arrival', 'card_linking', 'exchange_rate', 'card_payment_wrong_exchange_rate', 'extra_charge_on_statement',
  'pending_cash_withdrawal', 'fiat_currency_support', 'card_delivery_estimate', 'automatic_top_up', 'card_not_working', 'exchange_via_app',
  'lost_or_stolen_card', 'age_limit', 'pin_blocked', 'contactless_not_working', 'top_up_by_bank_transfer_charge', 'pending_top_up', 'cancel_transfer',
  'top_up_limits', 'wrong_amount_of_cash_received', 'card_payment_fee_charged', 'transfer_not_received_by_recipient', 'supported_cards_and_currencies',
  'getting_virtual_card', 'card_acceptance', 'top_up_reverted', 'balance_not_updated_after_cheque_or_cash_deposit', 'card_payment_not_recognised',
  'edit_personal_details', 'why_verify_identity', 'unable_to_verify_identity', 'get_physical_card', 'visa_or_mastercard', 'topping_up_by_card',
  'disposable_card_limits', 'compromised_card', 'atm_support', 'direct_debit_payment_not_recognised', 'passcode_forgotten', 'declined_cash_withdrawal',
  'pending_card_payment', 'lost_or_stolen_phone', 'request_refund', 'declined_transfer', 'Refund_not_showing_up', 'declined_card_payment',
  'pending_transfer', 'terminate_account', 'card_swallowed', 'transaction_charged_twice', 'verify_source_of_funds', 'transfer_timing',
  'reverted_card_payment?', 'change_pin', 'beneficiary_not_allowed', 'transfer_fee_charged', 'receiving_money', 'failed_transfer',
  'transfer_into_account', 'verify_top_up', 'getting_spare_card', 'top_up_by_cash_or_cheque', 'order_physical_card', 'virtual_card_not_working',
  'wrong_exchange_rate_for_cash_withdrawal', 'get_disposable_virtual_card', 'top_up_failed', 'balance_not_updated_after_bank_transfer',
  'cash_withdrawal_not_recognised', 'exchange_charge', 'top_up_by_card_charge', 'activate_my_card', 'cash_withdrawal_charge', 'card_about_to_expire',
  'apple_pay_or_google_pay', 'verify_my_identity', 'country_support']);
export const idOf = (name) => str(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const ROUTES = Object.freeze(INTENTS.map(idOf));
// the keyword router's words for each route: the law's own tokens of the intent name
export const NAMEWORDS = Object.freeze(Object.fromEntries(INTENTS.map((n) => [idOf(n), Object.freeze(P.tokensOf(n))])));
export const FLAGS = Object.freeze([
  Object.freeze({ id: 'handoff', nlu: 'handoff', words: Object.freeze(['human']), say: 'Wants a human' }),
  Object.freeze({ id: 'lost-stolen', nlu: 'lost_stolen', words: Object.freeze(['lost', 'stol']), say: 'Something lost or stolen' }),
]);
export const FLAG_IDS = Object.freeze(FLAGS.map((f) => f.id));
export const WINDOW = Object.freeze({ tokens: 40, raw: 240 });
// hash 'sha256': seal 4 (FNV-1a did not shuffle these consecutive row ids); sizes and salts as seal 3
export const ROUTE_SCHEDULE = Object.freeze({ meter: 1000, seed: 3000, batch: 1000, salt: 'banking77:', hash: 'sha256' });
export const TRIAGE_SCHEDULE = Object.freeze({ meter: 500, seed: 580, batch: 500, salt: 'nlupp:', hash: 'sha256' });
export const METER_BAR = 0.8;

/** say(task) → a route's name as a person reads it, or a flag's */
export function say(task) {
  const f = FLAGS.find((x) => x.id === task);
  if (f) return f.say;
  const i = ROUTES.indexOf(task);
  if (i < 0) return str(task);
  const s = INTENTS[i].replace(/[_?]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// a query's words: the law's tokens of its text; the patterns read the first 40, ctrl-F and the keyword router read all
function base(doc, key) {
  const text = str(doc.text), all = P.tokensOf(text);
  return { text, all, tokens: all.slice(0, WINDOW.tokens), raw: text.replace(/\s+/g, ' ').trim().slice(0, WINDOW.raw), id: P.fnv(key + doc.id).toString(36) };
}

/** routeUnits(doc) → { [route]: [unit] }: doc = { id, text, intent } */
export function routeUnits(doc) {
  const out = {};
  if (!isObj(doc) || typeof doc.id !== 'string' || typeof doc.text !== 'string') return out;
  const b = base(doc, 'b77:'), gold = idOf(doc.intent);
  for (const r of ROUTES) {
    const right = gold === r;
    out[r] = [{ id: b.id + '.q', doc: doc.id, raw: b.raw, tokens: b.tokens, kw: NAMEWORDS[r].every((w) => b.all.includes(w)), right, label: right ? r : 'other' }];
  }
  return out;
}

/** triageUnits(doc) → { [flag]: [unit] }: doc = { id, text, intents: [module] } */
export function triageUnits(doc) {
  const out = {};
  if (!isObj(doc) || typeof doc.id !== 'string' || typeof doc.text !== 'string') return out;
  const b = base(doc, 'nlu:'), mods = arr(doc.intents), low = b.text.toLowerCase();
  for (const f of FLAGS) {
    const right = mods.includes(f.nlu);
    out[f.id] = [{ id: b.id + '.q', doc: doc.id, raw: b.raw, tokens: b.tokens, kw: f.words.some((w) => low.includes(w)), right, label: right ? f.id : 'other' }];
  }
  return out;
}

export { asCase, isCaseFor };

/** baseline(task, units) → the cheap method's unit (it would answer the task here) or null */
export function baseline(task, units) {
  return arr(units).find((u) => isObj(u) && u.kw === true) || null;
}

/** pick(rules, task, units) → { unit, rule }: the first unit a kept rule for the task fires on, or null */
export function pick(rules, task, units) {
  const mine = arr(rules).filter((r) => P.validRule(r) && r.then === task);
  for (const u of arr(units)) {
    if (!isObj(u)) continue;
    const r = mine.find((x) => P.fires(x, u));
    if (r) return { unit: u, rule: r };
  }
  return null;
}

const unitOf = (units, task) => (isObj(units) ? arr(units[task]).find(isObj) || null : null);

/** route(rules, units) → { route, rule, also } for the first kept route pattern (library order) that fires, or null */
export function route(rules, units) {
  const fired = [];
  for (const r of arr(rules)) {
    if (!P.validRule(r) || !ROUTES.includes(r.then)) continue;
    const u = unitOf(units, r.then);
    if (u && P.fires(r, u)) fired.push(r);
  }
  if (!fired.length) return null;
  const also = [...new Set(fired.map((r) => r.then))].filter((t) => t !== fired[0].then);
  return { route: fired[0].then, rule: fired[0], also, right: unitOf(units, fired[0].then).right === true };
}

/** keywordRoute(units) → the cheap method's route: the first route (categories.json's order) whose name words it holds */
export function keywordRoute(units) {
  for (const r of ROUTES) { const u = unitOf(units, r); if (u && u.kw === true) return { route: r, right: u.right === true }; }
  return null;
}

/** routeOn(rules, units, ids) → T5's counts on some queries */
export function routeOn(rules, units, ids) {
  const t = { queries: 0, routed: 0, right: 0, conflicts: 0, baseRouted: 0, baseRight: 0 };
  for (const id of arr(ids)) {
    const u = isObj(units) ? units[id] : null;
    t.queries++;
    const a = route(rules, u), k = keywordRoute(u);
    if (a) { t.routed++; if (a.right) t.right++; if (a.also.length) t.conflicts++; }
    if (k) { t.baseRouted++; if (k.right) t.baseRight++; }
  }
  return t;
}

/** read(text, routeRules, flagRules) → a stranger's message: the route (or unknown) with its conflicts, the keyword
 *  router's route, and every flag raised */
export function read(text, routeRules, flagRules) {
  const ru = routeUnits({ id: 'yours', text: str(text), intent: '' }), tu = triageUnits({ id: 'yours', text: str(text), intents: [] });
  const a = route(routeRules, ru), k = keywordRoute(ru);
  const flags = FLAGS.map((f) => { const p = pick(flagRules, f.id, tu[f.id]); return p ? { flag: f.id, rule: P.ruleKey(p.rule), receipt: str(p.rule.receipt) } : null; }).filter(Boolean);
  const cheapFlags = FLAGS.filter((f) => unitOf(tu, f.id) && unitOf(tu, f.id).kw === true).map((f) => f.id);
  return {
    route: a ? a.route : 'unknown', rule: a ? P.ruleKey(a.rule) : null, receipt: a ? str(a.rule.receipt) : null, also: a ? a.also : [],
    keyword: k ? k.route : 'unknown', flags, cheapFlags,
  };
}

// the two parts' places in the cycle (SEAL 3)
const common = { many: () => false, baseline, pick, asCase, isCaseFor };
export const ROUTE_DOMAIN = Object.freeze({
  ...common, TASKS: ROUTES, typeOf: (t) => (ROUTES.includes(t) ? 'route' : null),
  job: 'routing', data: 'Banking77 (CC BY 4.0)', currentTool: 'the keyword router: every word of the route\'s own name',
  what: () => 'the words of one customer message to an online bank',
});
export const TRIAGE_DOMAIN = Object.freeze({
  ...common, TASKS: FLAG_IDS, typeOf: (t) => (FLAG_IDS.includes(t) ? 'flag' : null),
  job: 'triage', data: 'NLU++ (CC BY 4.0)', currentTool: 'ctrl-F: human; lost or stol',
  what: () => 'the words of one customer message to a bank or a hotel',
});

export default { INTENTS, ROUTES, NAMEWORDS, FLAGS, FLAG_IDS, WINDOW, ROUTE_SCHEDULE, TRIAGE_SCHEDULE, METER_BAR, ROUTE_DOMAIN, TRIAGE_DOMAIN,
  idOf, say, routeUnits, triageUnits, asCase, isCaseFor, baseline, pick, route, keywordRoute, routeOn, read };
