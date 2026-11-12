// pattern-libraries · src/extract.mjs — LIBRARY 1, DOCUMENT EXTRACTION: everything that turns a contract's text into the
// cases Kar's pattern law (vendor/patlib) can gate, and turns kept patterns back into answers. Sealed first: CLAIMS.md
// (SEAL 1, 1c6108e). Pure and total: no clock, no disk, no network, no model; garbage in gives an empty result, never a throw.
//
//   scan(text)            every candidate a deterministic scanner can find: dates, amounts, durations, jurisdictions,
//                         company names, each with where it sits and its normalised value
//   sentences(text)       the text cut into sentences (the units a clause pattern flags)
//   contextOf(text, u)    the words around a candidate (8 before, 4 after) plus where it sits: zfirst (the first of its
//                         kind), zhead (in the opening 2,500 characters), ztail (in the last tenth)
//   unitsOf(doc)          a document as units per task, each labelled from the experts' annotations
//   baseline(task, units) the cheap baseline: the first candidate of the task's type, or the first sentence holding the
//                         clause's search word (ctrl-F)
//   pick(rules, task, u)  the library's answer: the first unit in document order on which a kept rule fires, else null
//   read(text, rules)     a stranger's own document read by the library: every task answered or left unknown
import P from '../vendor/patlib/patlib.mjs';

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);

export const FIELDS = Object.freeze([
  Object.freeze({ id: 'agreement-date', type: 'date', cuad: 'Agreement Date', say: 'Agreement date' }),
  Object.freeze({ id: 'effective-date', type: 'date', cuad: 'Effective Date', say: 'Effective date' }),
  Object.freeze({ id: 'expiration-date', type: 'date', cuad: 'Expiration Date', say: 'Expiration date' }),
  Object.freeze({ id: 'governing-law', type: 'place', cuad: 'Governing Law', say: 'Governing law' }),
  Object.freeze({ id: 'party', type: 'org', cuad: 'Parties', say: 'A party' }),
  Object.freeze({ id: 'renewal-term', type: 'duration', cuad: 'Renewal Term', say: 'Renewal term' }),
  Object.freeze({ id: 'notice-period', type: 'duration', cuad: 'Notice Period To Terminate Renewal', say: 'Notice period to stop renewal' }),
  Object.freeze({ id: 'liability-cap', type: 'money', cuad: 'Cap On Liability', say: 'Liability cap amount' }),
  Object.freeze({ id: 'minimum-commitment', type: 'money', cuad: 'Minimum Commitment', say: 'Minimum commitment amount' }),
]);
export const CLAUSES = Object.freeze([
  Object.freeze({ id: 'non-compete', cuad: 'Non-Compete', kw: 'compet', say: 'Non-compete' }),
  Object.freeze({ id: 'exclusivity', cuad: 'Exclusivity', kw: 'exclusiv', say: 'Exclusivity' }),
  Object.freeze({ id: 'termination-for-convenience', cuad: 'Termination For Convenience', kw: 'terminat', say: 'Termination for convenience' }),
  Object.freeze({ id: 'change-of-control', cuad: 'Change Of Control', kw: 'control', say: 'Change of control' }),
  Object.freeze({ id: 'anti-assignment', cuad: 'Anti-Assignment', kw: 'assign', say: 'Anti-assignment' }),
  Object.freeze({ id: 'audit-rights', cuad: 'Audit Rights', kw: 'audit', say: 'Audit rights' }),
  Object.freeze({ id: 'insurance', cuad: 'Insurance', kw: 'insurance', say: 'Insurance' }),
  Object.freeze({ id: 'cap-on-liability', cuad: 'Cap On Liability', kw: 'liabilit', say: 'Cap on liability' }),
  Object.freeze({ id: 'warranty-duration', cuad: 'Warranty Duration', kw: 'warrant', say: 'Warranty duration' }),
  Object.freeze({ id: 'post-termination-services', cuad: 'Post-Termination Services', kw: 'termination', say: 'Post-termination services' }),
]);
export const TASKS = Object.freeze([...FIELDS.map((f) => f.id), ...CLAUSES.map((c) => c.id)]);
export const TYPES = Object.freeze(['date', 'money', 'duration', 'place', 'org', 'sentence']);
export const typeOf = (task) => { const f = FIELDS.find((x) => x.id === task); return f ? f.type : CLAUSES.some((c) => c.id === task) ? 'sentence' : null; };
export const isClause = (task) => CLAUSES.some((c) => c.id === task);
export const WINDOW = Object.freeze({ before: 8, after: 4, head: 2500, tail: 0.9, sentenceTokens: 60, overlap: 10 });

// ── the scanners ─────────────────────────────────────────────────────────────────────────────────────────────────
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const monthNo = (m) => { const k = str(m).toLowerCase().slice(0, 3); const i = MONTHS.findIndex((x) => x.startsWith(k)); return i < 0 ? 0 : i + 1; };
const pad = (n) => String(n).padStart(2, '0');
function ymd(y, m, d) {
  const Y = Number(y), M = Number(m), D = d === null ? null : Number(d);
  if (!(Y >= 1900 && Y <= 2099) || !(M >= 1 && M <= 12)) return null;
  if (D !== null && !(D >= 1 && D <= 31)) return null;
  return D === null ? Y + '-' + pad(M) : Y + '-' + pad(M) + '-' + pad(D);
}
const DATE_RES = [
  [new RegExp('\\b' + MON + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b', 'gi'), (m) => ymd(m[3], monthNo(m[1]), m[2])],
  [new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:day\\s+of\\s+)?' + MON + '\\.?\\s*,?\\s+(\\d{4})\\b', 'gi'), (m) => ymd(m[3], monthNo(m[2]), m[1])],
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) => ymd(m[3], m[1], m[2])],
  [new RegExp('\\b' + MON + '\\s*,?\\s+(\\d{4})\\b', 'gi'), (m) => ymd(m[2], monthNo(m[1]), null)],
];
const SUFFIXES = ['Inc', 'Incorporated', 'Corp', 'Corporation', 'Company', 'Co', 'LLC', 'L.L.C', 'Ltd', 'Limited', 'LP', 'L.P', 'LLP', 'L.L.P',
  'PLC', 'plc', 'GmbH', 'AG', 'S.A', 'SA', 'N.V', 'B.V', 'S.p.A', 'AB', 'Pty'];
// (not Bank, Trust, Partners or Holdings: they are also ordinary words inside names, and a lazy match would stop at them)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUF = '(?:' + [...new Set(SUFFIXES.flatMap((s) => [s, s.toUpperCase()]))].sort((a, b) => b.length - a.length).map(esc).join('|') + ')';
const ORG_RE = new RegExp('\\b((?:(?:[A-Z][A-Za-z0-9&\'’\\-]*\\.?,?|of|and|&|de|du|la|der)[ \\t]+){1,7}?)' + SUF + '(?![A-Za-z])\\.?', 'g');
const ORG_STOP = new Set(['the', 'this', 'such', 'each', 'any', 'all', 'by', 'and', 'between', 'among', 'of', 'to', 'with', 'for', 'from', 'whereas', 'section', 'article', 'exhibit', 'schedule', 'agreement', 'in', 'on', 'as', 'a', 'an']);
const ABBREV = new Set(['inc', 'corp', 'co', 'ltd', 'llc', 'lp', 'llp', 'plc', 'sa', 'nv', 'bv', 'spa', 'ag', 'ab', 'pty', 'intl', 'mfg', 'assn', 'dept', 'bros']);
// the roles contracts name their parties by: a 'company name' made only of these is a defined term, not a company
const ROLES = new Set(['company', 'companies', 'distributor', 'licensor', 'licensee', 'party', 'parties', 'supplier', 'customer', 'buyer', 'seller', 'vendor',
  'client', 'contractor', 'consultant', 'manufacturer', 'reseller', 'agent', 'provider', 'purchaser', 'owner', 'franchisee', 'franchisor', 'partner', 'member', 'and', 'or', 'of', 'inc', 'corp', 'corporation', 'llc', 'ltd', 'limited']);
const ORG_INNER = new Set(['the', 'this', 'such', 'each', 'any', 'all', 'by', 'between', 'among', 'to', 'with', 'for', 'from', 'whereas', 'section',
  'article', 'agreement', 'in', 'on', 'as', 'a', 'an', 'is', 'exhibit', 'schedule', 'if', 'when', 'where', 'unless', 'neither', 'nor', 'either', 'both', 'upon', 'under', 'after', 'before', 'that', 'which', 'whether']);
const PLACES = ['England and Wales', 'United States of America', 'United States', 'United Kingdom', 'District of Columbia', 'New York', 'New Jersey',
  'New Hampshire', 'New Mexico', 'North Carolina', 'North Dakota', 'South Carolina', 'South Dakota', 'Rhode Island', 'West Virginia',
  'Hong Kong', 'British Columbia', 'Cayman Islands', 'British Virgin Islands', "People's Republic of China", 'Alabama', 'Alaska', 'Arizona',
  'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
  'Nebraska', 'Nevada', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'Wisconsin', 'Wyoming', 'England', 'Scotland', 'Wales', 'Ireland', 'Canada', 'Ontario', 'Alberta', 'Quebec', 'Germany', 'France',
  'Netherlands', 'Switzerland', 'Singapore', 'China', 'Japan', 'Israel', 'India', 'Australia', 'Bermuda', 'Luxembourg', 'Sweden', 'Italy',
  'Spain', 'Korea', 'Taiwan', 'Mexico', 'Brazil', 'Denmark', 'Norway', 'Finland', 'Belgium', 'Austria'];
const PLACE_RE = new RegExp('\\b(' + PLACES.map(esc).join('|') + ')\\b', 'g');
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90 };
const NUMWORD = '(?:' + Object.keys(NUMW).join('|') + '|hundred)';
const DUR_RE = new RegExp('\\b((?:' + NUMWORD + '[\\s-]*){1,4})?(?:\\(\\s*(\\d{1,4})\\s*\\)|(\\d{1,4}))?\\s*(?:calendar\\s+|business\\s+)?(day|week|month|year)s?\\b', 'gi');
const MONEY_RE = /(US\s?\$|U\.S\.\s?\$|\$|USD\s?|EUR\s?|€|£|GBP\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(million|billion|thousand))?/gi;

/** words → a number ("one hundred eighty" → 180), or null */
export function wordsToNumber(s) {
  const w = str(s).toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (!w.length) return null;
  // every word adds at least one, or multiplies by a hundred, so a list of number words is never zero
  let cur = 0;
  for (const x of w) {
    if (x === 'hundred') { cur = (cur || 1) * 100; continue; }
    if (!(x in NUMW)) return null;
    cur += NUMW[x];
  }
  return cur;
}

function push(out, type, start, end, raw, value) { if (value !== null && value !== undefined && value !== '') out.push({ type, start, end, raw, value }); }

/** scan(text) → every candidate, in document order; where two overlap, the longer (then the earlier) wins */
export function scan(text) {
  const t = str(text), found = [];
  try {
    for (const [re, val] of DATE_RES) { re.lastIndex = 0; let m; while ((m = re.exec(t))) push(found, 'date', m.index, m.index + m[0].length, m[0], val(m)); }
    MONEY_RE.lastIndex = 0;
    for (let m; (m = MONEY_RE.exec(t));) {
      const cur = /€|EUR/i.test(m[1]) ? 'EUR' : /£|GBP/i.test(m[1]) ? 'GBP' : 'USD';
      const mult = { thousand: 1e3, million: 1e6, billion: 1e9 }[str(m[4]).toLowerCase()] || 1;
      const v = Math.round((Number(m[2].replace(/,/g, '')) + Number('0.' + (m[3] || '0'))) * mult * 100);
      push(found, 'money', m.index, m.index + m[0].length, m[0], Number.isFinite(v) && v > 0 ? cur + ' ' + (v / 100).toFixed(2) : null);
    }
    DUR_RE.lastIndex = 0;
    for (let m; (m = DUR_RE.exec(t));) {
      const n = m[2] || m[3] ? Number(m[2] || m[3]) : wordsToNumber(m[1]);
      if (!m[1] && !m[2] && !m[3]) continue;
      push(found, 'duration', m.index + (m[0].length - m[0].trimStart().length), m.index + m[0].length, m[0].trim(), n >= 1 && n <= 9999 ? n + ' ' + m[4].toLowerCase() : null);
    }
    PLACE_RE.lastIndex = 0;
    for (let m; (m = PLACE_RE.exec(t));) push(found, 'place', m.index, m.index + m[0].length, m[0], m[1].toLowerCase());
    ORG_RE.lastIndex = 0;
    for (let m; (m = ORG_RE.exec(t));) {
      let words = m[0].replace(/[\s,]+/g, ' ').trim().split(' ');
      // a name never runs across a sentence end ("Business. The Company") or past an article inside it ("D. The Company")
      for (let i = words.length - 2; i >= 0; i--) {
        const w = words[i], bare = w.replace(/[^A-Za-z]/g, '');
        if ((w.endsWith('.') && bare.length >= 4 && !ABBREV.has(bare.toLowerCase())) || ORG_INNER.has(bare.toLowerCase())) { words = words.slice(i + 1); break; }
      }
      while (words.length && ORG_STOP.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))) words.shift();
      const name = words.join(' ').replace(/[.,]+$/, '');
      if (words.length < 2 || name.length < 4 || words.every((w) => ROLES.has(w.toLowerCase().replace(/[^a-z]/g, '')))) continue;
      const lead = m[0].indexOf(words[0]);
      push(found, 'org', m.index + Math.max(0, lead), m.index + m[0].length, name, name.toLowerCase().replace(/[^a-z0-9& ]/g, '').replace(/\s+/g, ' ').trim());
    }
  } catch { return []; }
  return dedupe(found);
}

/** dedupe(cands) → where two candidates of one type overlap, the longer is kept, then the earlier; then document order
 *  (by start, then end; the scanners never give two types the very same span) */
export function dedupe(cands) {
  const byType = new Map();
  for (const c of arr(cands)) { if (!isObj(c)) continue; if (!byType.has(c.type)) byType.set(c.type, []); byType.get(c.type).push(c); }
  const out = [];
  for (const list of byType.values()) {
    list.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const kept = [];
    for (const c of list) if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
    out.push(...kept);
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** sentences(text) → [{ start, end, text }]: cut after . ; : before a capital or bracket, and at blank lines */
export function sentences(text) {
  const t = str(text), out = [];
  const cut = /(?<=[.;:])\s+(?=[A-Z("“])|\n[ \t]*\n/g;
  let at = 0;
  try {
    for (let m; (m = cut.exec(t));) { const s = t.slice(at, m.index); if (s.trim().length >= 20) out.push({ start: at, end: m.index, text: s }); at = m.index + m[0].length; }
    const s = t.slice(at); if (s.trim().length >= 20) out.push({ start: at, end: t.length, text: s });
  } catch { return []; }
  return out;
}

/** contextOf(text, unit, first) → the words around a candidate plus where it sits */
export function contextOf(text, u, first) {
  const t = str(text);
  if (!isObj(u) || !Number.isInteger(u.start) || !Number.isInteger(u.end)) return [];
  const before = P.tokensOf(t.slice(Math.max(0, u.start - 160), u.start)).slice(-WINDOW.before);
  const after = P.tokensOf(t.slice(u.end, u.end + 80)).slice(0, WINDOW.after);
  const where = [];
  if (first === true) where.push('zfirst');
  if (u.start < WINDOW.head) where.push('zhead');
  if (t.length && u.start > t.length * WINDOW.tail) where.push('ztail');
  return [...new Set([...before, ...after, ...where])];
}

const overlaps = (a, b, min) => Math.min(a.end, b.end) - Math.max(a.start, b.start) >= min;

/** goldOf(doc) → { [cuad category]: [{ start, end }] } from the experts' annotations */
export function goldOf(doc) {
  const g = {};
  for (const a of arr(isObj(doc) ? doc.gold : null)) {
    if (!isObj(a) || typeof a.cat !== 'string' || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.end <= a.start) continue;
    (g[a.cat] = g[a.cat] || []).push({ start: a.start, end: a.end });
  }
  return g;
}

/** unitsOf(doc) → { [task]: [unit] }: every candidate (or sentence) of the task's type, with its words and whether the
 *  experts' annotation makes it right for that task (inside the annotation, or equal in value to one that is) */
export function unitsOf(doc) {
  const out = {};
  if (!isObj(doc) || typeof doc.id !== 'string' || typeof doc.text !== 'string') return out;
  // a short, stable id per unit: the document's own FNV-1a, the unit's kind, its place; unique within each task's cases
  const text = doc.text, gold = goldOf(doc), cands = scan(text), seen = new Set(), key = P.fnv('doc:' + doc.id).toString(36);
  const typed = {};
  for (const c of cands) {
    const u = { ...c, tokens: contextOf(text, c, !seen.has(c.type)) };
    seen.add(c.type);
    (typed[c.type] = typed[c.type] || []).push(u);
  }
  for (const f of FIELDS) {
    const spans = gold[f.cuad] || [], list = typed[f.type] || [];
    const inside = list.filter((u) => spans.some((s) => overlaps(u, s, 1)));
    const values = new Set(inside.map((u) => u.value));
    out[f.id] = list.map((u, i) => { const right = values.has(u.value); return { id: key + '.' + f.type + '.' + i, doc: doc.id, start: u.start, end: u.end, raw: u.raw, value: u.value, tokens: u.tokens, right, label: right ? f.id : 'other' }; });
  }
  // each sentence is read once; its words are shared by the ten clause tasks
  const sents = sentences(text).map((s) => ({ ...s, raw: s.text.replace(/\s+/g, ' ').trim().slice(0, 240), low: s.text.toLowerCase(), tokens: P.tokensOf(s.text).slice(0, WINDOW.sentenceTokens) }));
  for (const c of CLAUSES) {
    const spans = gold[c.cuad] || [];
    out[c.id] = sents.map((s, i) => { const right = spans.some((g) => overlaps(s, g, WINDOW.overlap)); return { id: key + '.s.' + i, doc: doc.id, start: s.start, end: s.end, raw: s.raw,
      value: null, tokens: s.tokens, kw: s.low.includes(c.kw), right, label: right ? c.id : 'other' }; });
  }
  return out;
}

/** asCase(unit, task) → the law's case shape: the label is the task when the unit is right, 'other' when it is not */
export function asCase(u, task, slice) {
  return { id: str(u && u.id), tokens: arr(u && u.tokens), label: u && u.right === true ? task : 'other', slice };
}
/** a unit already carries the law's case fields (id, tokens, label) for its own task, so it can be gated as it is */
export const isCaseFor = (u, task) => isObj(u) && typeof u.id === 'string' && Array.isArray(u.tokens) && u.label === (u.right === true ? task : 'other');

/** baseline(task, units) → the cheap baseline's unit for one document, or null when it finds none */
export function baseline(task, units) {
  const list = arr(units);
  if (isClause(task)) return list.find((u) => isObj(u) && u.kw === true) || null;
  return list.find(isObj) || null;
}

/** pick(rules, task, units) → the first unit in document order on which a kept rule for the task fires, and the rule */
export function pick(rules, task, units) {
  const mine = arr(rules).filter((r) => P.validRule(r) && r.then === task);
  if (!mine.length) return null;
  for (const u of arr(units)) {
    if (!isObj(u)) continue;
    const r = mine.find((x) => P.fires(x, u));
    if (r) return { unit: u, rule: r };
  }
  return null;
}

/** read(text, rules) → a document read by the library: for each task, the answer and the pattern that gave it, or unknown */
export function read(text, rules) {
  const units = unitsOf({ id: 'yours', text: str(text), gold: [] });
  return TASKS.map((task) => {
    const p = pick(rules, task, units[task]);
    return p ? { task, answer: isClause(task) ? p.unit.raw : p.unit.raw, value: p.unit.value, start: p.unit.start, end: p.unit.end, rule: P.ruleKey(p.rule), receipt: str(p.rule.receipt) }
      : { task, answer: 'unknown', value: null, start: null, end: null, rule: null, receipt: null };
  });
}

export default { FIELDS, CLAUSES, TASKS, TYPES, WINDOW, typeOf, isClause, wordsToNumber, scan, dedupe, sentences, contextOf, goldOf, unitsOf, asCase, isCaseFor, baseline, pick, read };
