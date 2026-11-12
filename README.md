# living-crystal

**Live page: https://sjgant80-hub.github.io/living-crystal/**

The first rung of **the Living Crystal**: twenty verified routing rules from the estate's pattern library, cast as the
weights of a symmetric settling network, run on an emulated analogue crossbar (levels, write noise, read noise, drift,
stuck cells, a dead band in every sense amplifier, a bounded settle). The decision is made by settling, not by stepping
through instructions. **An emulator, not a chip; no electrical energy is measured; nothing here is alive or aware.**

## The result (read from the records)

- **Held — LC1:** every one of the 2,097,152 possible inputs to the library settles to the library router's own decision
  on the exact device, none refused (`data/proof.json`).
- **Held — LC2:** every one of 13,163 held-out messages (10,083 Banking77 outside the library's seed slice + 3,080 NLU++),
  read once after the code was frozen by hash, in at most 3 reads, the energy falling at every change.
- **Held — LC7:** 0 of 276,423 half-level glitches on an input line settled to a decision neither reading gives; 95.1% of
  the decisive ones refused (100% with the sticky reading).
- **Failed, kept — LC3, LC4:** the assumed device (4 bits, 2% write and read noise, a day of drift, compensated) kept
  1 of 10 chips at 99.9%; 532 of 131,630 decisions settled wrong (0.40%; sticky 0.30%; the bar was 0.01%). Drift spread
  between devices breaks the cast first.
- **Failed, kept — LC8:** 261 of 13,163 random front-end drives settled to a decision other than their rounding (sticky 48).
- **The edges (LC5):** exact down to 2 bits, 5% write noise, 12% read noise, 1 minute of drift (about 8% spread between
  devices), 0.1% dead cells; shorted cells break it at 0.01%. It fails loud for levels and write noise (and read noise
  with the sticky reading), not for drift or stuck cells (LC6).
- **The known gap (LC9):** a line over-driven to twice the rail forged 51,973 of 276,423 decisions; input drivers must clip.

## How it was done

[CLAIMS.md](CLAIMS.md) (seal 1, before any code) → kernels, tests, witness v0.6 (cast 45/45, crossbar 67/67, record 71/71,
held 13/13, case 23/23, nothing baselined) → LC1 on every input → dev on the library's seed messages →
[AMENDMENT.md](AMENDMENT.md) (a second, sticky reading; every bar unchanged) → [SEAL2.md](SEAL2.md) (the code frozen by
SHA-256) → the held-out read, once. CI re-derives every record byte for byte from the pinned sources and re-runs witness
on every push; the page re-computes the held-out record in the browser and checks its SHA-256.

```bash
node --test test/*.test.mjs
node vendor/pattern-libraries/tools/polyai_fetch.mjs /tmp/polyai --check d014c397bfa65560859b7856a4f855fbd738f6e49c71640b7219e3ab5f9549e5
node tools/proof.mjs --check
node tools/heldout.mjs --polyai /tmp/polyai --check
```

Sources: the patterns and router from [pattern-libraries](https://github.com/sjgant80-hub/pattern-libraries) (MIT),
byte for byte; messages from Banking77 and NLU++ (PolyAI, CC BY 4.0), fetched and checked against a pinned manifest;
the energy network after Hopfield (1982). Built on the settling ladder ([geometric-ladder](https://sjgant80-hub.github.io/geometric-ladder/)).

Powered by the Konomi architecture, created by Thomas Frumkin. Built by Kar for AI Native Solutions. MIT licence.
