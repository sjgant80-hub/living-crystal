# living-crystal · sealed claims (seal 1, before any code of this repository)

The first rung of Simon's spec **THE LIVING CRYSTAL** (2026-11-12): take verified patterns from the estate's pattern
library, cast them as the weights of a settling network, and let the network make the decision by **settling** (relaxing
into a low-energy state), not by stepping through instructions. Prove that the settled decision is the same decision the
library's software makes, on messages the cast never saw, on a faithful emulation of an analogue crossbar with the
non-idealities a real device has; show where it stops being the same; and show that an input that does not fit the
lattice fails to settle and is refused. Every bar is fixed here. A claim that misses its bar is kept and published as
failed.

## What this is not (sealed with the claims)

- **Not a chip.** There is no neuromorphic or memristor hardware in this build. Every device number comes from an
  emulator of a crossbar, written to model a real device's non-idealities (below). A run on a real chip is the next
  step; it is named here and not done.
- **No electrical energy figure.** Nothing here measures joules or watts. The network's "energy" is a number the settle
  lowers (Hopfield's sense), not electricity. Speed is stated only as measured, on the machine that ran it.
- **Not alive, not sentient.** The spec's summit (a lattice whose settling models its own settling) is a direction. Its
  slope (grown or annealed substrates, seeded reproduction, the fourth fold, other geometries) is **parked**: nothing
  here builds it and no page claims it.
- **Not a better router.** The cast makes the library's decisions, no more and no fewer. Whether those decisions are
  right is the library's claim (pattern-libraries, library 3), not this one.

## Sources, pinned before any code

- **The verified patterns:** sjgant80-hub/pattern-libraries at `bd450db4d2e5fa2af19c520f85a9ceededb4e6ff`,
  `data/route/state.json` (sha256 `c51e8ee0f98e87914a8408b4a9fcf690e56cbf974697be5ecdaa526246e735cd`), its `library`
  array: the 20 routing patterns kept on 2026-11-11 (night 0 of library 3; 21 words, 16 routes, 3 patterns of two
  words). Each passed the library's law on an unseen batch and again on a never-used final batch before it was kept.
- **The software form:** that repository's router, `route(rules, routeUnits(doc))` in `src/triage.mjs` (sha256
  `96a6423d…`), with `src/extract.mjs`, `vendor/patlib/patlib.mjs`, the exam order `src/cycle.mjs` and its imports, and
  the message loader `tools/polyai.mjs` + `tools/polyai_fetch.mjs`, copied **byte for byte** into
  `vendor/pattern-libraries/` (every hash in `vendor/SOURCES.json`). The router is the library's own code, not a copy
  written for this test.
- **The messages:** Banking77 and NLU++ (PolyAI; Casanueva et al. 2020, 2022; CC BY 4.0) at commit
  `57ec275d8078af65b7731c2a98be812d844a6d6b`, 45 files, manifest sha256
  `d014c397bfa65560859b7856a4f855fbd738f6e49c71640b7219e3ab5f9549e5`, read only through the library's loader, which
  refuses any other files. No message text is committed; derived inputs are committed only after the held-out read.

## The decision

- **The router's decision** on a message: `route` = the route named by the first kept pattern, in library order, whose
  words are all among the message's first 40 tokens (the library's own tokens), or none; `also` = the set of the other
  routes that some firing pattern names (a conflict).
- **The cast's decision:** *refused* if the network does not settle. Otherwise `route` = the route of the lit
  first-pattern units (g), or none when no g is lit; `also` = the routes of the lit pattern units (h), other than `route`.
- **A match:** not refused, the same route, and the same set `also`.

## The cast (fixed here)

For the 20 patterns in library order, 40 units with states 0 or 1:

- **h<sub>μ</sub>, one per pattern ("it fired"):** +12 from each of its word lines; bias −12·(k − ½) for a pattern of k
  words (−6 or −18). Lit only when all its words are present.
- **g<sub>μ</sub>, one per pattern ("it fired first"):** +12 from h<sub>μ</sub>; −12 from h<sub>ν</sub> of every earlier
  pattern ν with a different route; bias −6. Lit only when its pattern fired and no earlier pattern of another route did.
- **Lateral inhibition:** −12 between g<sub>μ</sub> and g<sub>ν</sub> of every pair with different routes. On a clean
  device two such units are never lit together; if noise lights two, they inhibit each other on every step and the
  network cannot settle.
- Every unit-to-unit weight is **symmetric** (the same weight both ways), the energy-network condition (Hopfield 1982);
  the clamped inputs are the 21 word lines.
- **The array:** rows = 21 word lines + 2 bias lines (always on; a bias is split evenly across them) + 40 unit lines =
  63; columns = 40, one per unit; every weight is a **differential pair** of devices (G⁺ − G⁻), including the zeros:
  **5,040 devices**. The largest weight on one device is 12 design units, which maps to the device's full conductance.
- **The settle:** start with every unit at 0. Each step is **one read of the whole array**: every column's current is
  sensed at once. A column's sense amplifier commits 1 if the field is above +τ, 0 if below −τ, and otherwise **does not
  resolve** and holds its last output; τ = 1 design unit. The network has **settled** at the first step at which every
  column resolved and none changed. At most **12 steps**; a network that has not settled by then **refuses** the input.
- **The energy** of a state s with inputs x: E = −½ Σ<sub>i≠j</sub> W<sub>ij</sub> s<sub>i</sub> s<sub>j</sub> −
  Σ<sub>i</sub> (b<sub>i</sub> + Σ<sub>w</sub> W<sub>iw</sub> x<sub>w</sub>) s<sub>i</sub>, computed from the array as
  programmed.

A scratch prototype of this wiring, run on random rule sets of the same size (no pattern of this library, no message of
any set), checked before this seal that the wiring settles; it is not part of the record.

## The emulated device (fixed here)

- **Levels:** a device holds one of 2<sup>bits</sup> conductance levels from 0 to full; a weight is rounded to the
  nearest level (scale: 12 design units = full).
- **Write noise:** every device, including those meant to be 0, is programmed to its level plus σ<sub>w</sub>·n of full
  conductance, clipped to [0, full].
- **Stuck cells:** each device independently is stuck at 0 with probability p<sub>0</sub>, or stuck at full with
  probability p<sub>1</sub>; a stuck device ignores programming and drift.
- **Drift:** at time t after programming (t₀ = 1 s), each device's conductance is multiplied by (t/t₀)<sup>−ν</sup>, with
  ν = 0.05 + 0.02·n per device (not below 0). **Compensated** drift divides every column current by (t/t₀)<sup>−0.05</sup>
  (one global reference); **raw** drift does not.
- **Read noise:** on every read, each device's current carries σ<sub>r</sub>·n of its own conductance; a column's noise is
  drawn as the exact sum of its devices' noises (one normal draw with the summed variance).
- **The noise source:** n is the sum of 12 uniform draws minus 6 (mean 0, variance 1, tails stop at 6), from a seeded
  32-bit generator; no engine-dependent maths (no Math.log/exp/cos), so the record re-derives the same in Node and in a
  browser. A chip is programmed from seed FNV-1a("living-crystal|" + point + "|" + k); each message's reads draw from
  FNV-1a(chip seed + "|" + its index).
- **The ideal device:** exact weights, no noise, no drift, no stuck cells.
- **The assumed device** (an assumption, not a measured chip; the sweep shows where each of its knobs breaks):
  4 bits, σ<sub>w</sub> = 2%, σ<sub>r</sub> = 2%, drift after one day (86,400 s) compensated, no stuck cells.

## Data

- **Dev:** the 3,000 Banking77 messages of the library's own seed slice (positions 1,000–3,999 of its exam order,
  `ROUTE_SCHEDULE`, SHA-256 of "banking77:" + id): the messages the patterns were mined from.
- **Held-out:** every other Banking77 message (train and test, as the loader reads them) in exam order, then every NLU++
  message (banking and hotels) in loader order. The routing patterns never saw an NLU++ message.
- The held-out set is read **once**, after seal 2, by `tools/heldout.mjs`, which refuses to run unless `SEAL2.md` names
  every file of code it runs by its hash. Any change to this design between seal 1 and the held-out read is written in
  `AMENDMENT.md` before that read, with every bar unchanged.

## Claims

- **LC1 · every possible input, ideal device.** For all 2<sup>21</sup> = 2,097,152 subsets of the library's 21 words (all
  the router ever reads), the cast's decision equals the router's decision on a message made of exactly those words, and
  every one settles. Bar: **0 mismatches, 0 refusals.**
- **LC2 · held-out, ideal device.** Every held-out message, through the router's own reading of its text: **0
  mismatches, 0 refusals, at most 3 reads** per settle, and the energy **strictly falls at every step that changes a
  unit**.
- **LC3 · held-out, the assumed device.** 10 chips: the decision matches the router on **at least 99.9%** of held-out
  messages on **at least 9 of the 10 chips**.
- **LC4 · no silent wrong answers on the assumed device.** Pooled over the 10 chips, settled decisions that differ from
  the router's are **at most 0.01%** of all decisions.
- **LC5 · the edge, one knob at a time** (every other knob ideal; 5 chips per point; every held-out message):
  bits 1, 2, 3, 4, 5, 6, 8 · σ<sub>w</sub> 0.5, 1, 2, 3, 5, 8, 12% · σ<sub>r</sub> 0.5, 1, 2, 3, 5, 8, 12, 20% · raw
  drift and compensated drift at 1 minute, 1 hour, 1 day, 1 week, 30 days, 365 days, 10 years · p<sub>0</sub> and
  p<sub>1</sub> 0.01, 0.03, 0.1, 0.3, 1, 3%. **Reported**, for each knob: the last grid value at which all 5 chips match
  on at least 99.9% of held-out messages, and the first at which one does not. No bar: a measured finding, kept whatever
  it shows.
- **LC6 · it fails loud.** For each knob of LC5, pooled over its points and chips: of the held-out decisions that do not
  match, **at least 90% are refusals**, not settled answers. One verdict per knob (seven); a knob with no mismatch
  anywhere on its grid is undecided.
- **LC7 · a glitched line is refused, not misread** (ideal device). For every held-out message and each of the 21 word
  lines, that line driven at **half** level: (a) **0** settled decisions that neither reading of the line (fully on,
  off) gives; (b) of the glitches whose two readings disagree, **at least 50% refused**.
- **LC8 · a faulty front end is refused, not misread** (ideal device). For each held-out message, all 21 word lines at
  seeded random levels in [0, 1] (FNV-1a("living-crystal|frontend|" + index)): (a) **0** settled decisions other than
  the router's decision on the same drive rounded at one half; (b) **at least 50% refused**.
- **LC9 · the known gap: over-drive** (ideal device). Each held-out message with each word line at **twice** the rail:
  the number of settled decisions that neither reading gives is **reported**. The settle is not expected to catch this
  (a two-word pattern can be forged by one over-driven line); a real chip's input drivers must clip at the rail. No bar.
- **LC10 · speed as measured, no energy figure.** Reported: array reads per decision on held-out (ideal device), mean
  and largest; the emulator's time per decision and the router's time per decision, on the machine that ran it. No
  electrical energy number for any device appears in the record or on the page (checked by a test).
- **LC11 · the record re-derives.** Every committed record re-derives byte for byte on GitHub's runner from the pinned
  sources, and the page re-derives the held-out record's numbers in the browser from its committed inputs.
- **LC12 · the kernels are gated.** witness v0.6 on every kernel: clean, nothing baselined; garbage in never throws.

## Credits

Hopfield, J. J. (1982), *Neural networks and physical systems with emergent collective computational abilities*, PNAS
79: the energy network. The verified patterns and the router: pattern-libraries (MIT). Banking77 and NLU++: PolyAI, CC BY
4.0. The settling ladder this builds on: settling-cell (Rung 1) to chip-immune (Rung 7). Powered by the Konomi
architecture, created by Thomas Frumkin. Built by Kar for AI Native Solutions.
