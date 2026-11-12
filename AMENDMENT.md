# Amendment 1 · a second reading of the same settle, before the held-out set is read

Written after the dev run (`data/dev.json`, the library's 3,000 seed messages) and **before any held-out message is
read**. Every bar in `CLAIMS.md` is unchanged. The cast, the device model, the assumed device, the sweep grid, the seeds
and both sets are unchanged. Seal 1's reading stays exactly as sealed and is judged and published as sealed.

## What dev showed (data/dev.json)

- **The ideal device:** 3,000 of 3,000 the router's decision, every settle in at most 3 reads, the energy falling at
  every step that changed a unit. (LC1, run before this amendment on every one of the 2,097,152 possible inputs,
  held: `data/proof.json`.)
- **The assumed device:** 1 of 10 chips matched on at least 99.9%; 96 of 30,000 decisions settled to a wrong answer
  (0.32%) and 287 were refused. On dev, LC3 and LC4 fail.
- **Why, traced on one chip:** after a day of drift with device-to-device spread, the device carrying "visa" into its
  pattern unit held 7.7 of its 12 units against biases of 3.8 and 3.2. The unit's field sat at +0.77, inside the dead
  band, for two reads: the array did not know. Then the first-pattern unit for "apple" lit and its inhibition pushed
  the undecided unit to 0, and the network settled, with full confidence, on the wrong route. **The settle erased the
  uncertainty** — the same lesson as the ladder's Rung 3 (hybrid-gate: settled share AUC 0.68 against 0.83 for the
  margin before the settle).
- **The edges on dev** (last value where all 5 chips hold / first where one does not): bits 2 / 1 · write noise 5% /
  8% · read noise 12% / 20% · raw drift and compensated drift 1 minute / 1 hour · stuck at 0: 0.1% / 0.3% · stuck at
  full: none / 0.01%.
- **LC8(a) fails on dev, and is left as sealed:** 58 of 3,000 random front-end drives settled to a decision other than
  the line-by-line rounding at one half. A two-word pattern adds its two lines: two lines each just above half can sum
  below the pattern's threshold, so the network reads the pair as absent where rounding reads it as present. The claim
  is not reworded.

## The amendment: a second reading, "sticky"

The same settle, read a second way: **also refused when any column failed to resolve on any read along the way**, not
only at the end. In hardware this is one latch per column that sets when its sense amplifier does not resolve, and an
OR of the latches: a few gates beside the array. The settle itself is unchanged; `src/crossbar.mjs` only counts the
reads that did not resolve (`wavered`).

Both readings run on the held-out set, both are judged against **the same bars**, and both are published side by side.
LC3–LC9 were sealed on seal 1's reading; the sticky reading is added here, after dev, and is labelled so everywhere.

What the sticky reading did on dev, both ways:

- It turned read noise's wrong answers into refusals (LC6 for read noise: 5 of 17 non-matches refused under the sealed
  reading, 290 of 298 under the sticky one), refused every glitch whose two readings differ (LC7(b): 94.5% → 100%), and
  cut LC8's other decisions from 58 to 8.
- It does **not** fix drift or stuck cells: their wrong answers are confident (a drifted or stuck device moves a field
  cleanly past the dead band, and no column wavers). Pooled on the assumed device, 77 of 30,000 decisions still settled
  wrong.
- It refuses earlier: the write-noise edge moves from 5% to 3% and the read-noise edge from 12% to 8%.

## A case seal 1 did not name

Two different routes lit at a settled state. On a clean array they inhibit each other and cannot settle; a damaged
array could hold them. The reader refuses rather than pick one (`why: 'two'`), counts it apart, and LC6 counts it as a
refusal. It did not occur on dev.
