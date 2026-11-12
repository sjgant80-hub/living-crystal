# Seal 2 · the frozen code, before the held-out set is read

Committed after seal 1 (`CLAIMS.md`, ea4d8bd, unchanged: sha256 `151389a89cb5a0167ef0f5011ae0292c78caf9ddb29d8d8ad81d665269d342ad`)
and amendment 1 (`AMENDMENT.md`, sha256 `cfc4c90e0e338d9f45134486e91440c992a28b1a5f8fe2f45c3cf1c017ccc390`). At this
commit **no held-out message has been read**: there is no `data/heldout.json`. The next commit runs `tools/heldout.mjs`
once; it refuses to run unless every file below has exactly this hash, and it refuses to run a second time.

## The code that will read the held-out set

| file | sha256 | mutation gate (witness v0.6) |
|---|---|---|
| `src/cast.mjs` | b75d3bdfa927548e543d757cbe3e6c2c0e7dc1e740406f874cf7810e76afac5a | 45 of 45 caught, 0 baselined |
| `src/crossbar.mjs` | 33d95935e7a6a8c76498f8d7451408c0e9a010799dbe9a9b5da6536abd4eb7a3 | 67 of 67 caught, 0 baselined |
| `src/record.mjs` | 741ca3f5307a6c927354d480a5711e668ae0dd7a8575f3f1cfbb3ad504bdb032 | 71 of 71 caught, 0 baselined |
| `src/held.mjs` | b983d6d0b04cecfcf71628cef01f12cb44f3bbfc34ffd11c82e93044325bc9e6 | 13 of 13 caught, 0 baselined |
| `tools/data.mjs` | 56a299b8a29f8eb660ca0f712efadb81bf88334b47c3aca2923560bb2228a13d | a tool (the sets, through the library's loader) |
| `tools/heldout.mjs` | 6d341069761c155f6155dce2c5f86d0bfd20852c97b99a1572671b851b4e0fb7 | a tool (the read itself) |
| `vendor/SOURCES.json` | 55240d18a612f2f9f51430a4098e133effb8487407b2e638f1bcd200d63598f8 | pins every vendored file |

`vendor/SOURCES.json` now also pins `data/prices.json` from the same pattern-libraries commit (claude.com/pricing as
read on 2026-11-09), added after seal 1 for the page's cost case only; no claim reads it. `src/case.mjs` (the page's
cost case, sha256 574a47187d3be11b41b889e2ea4b4bc7293c9b987ca03fcaa7b09b3d435543ca, 23 of 23 caught) does not read the
held-out set.

## What is already measured, frozen here

- `data/proof.json` (LC1, every possible input), sha256 `ea71424ed9716756f1f2a3057cc9988e124a08b740974588d84fbdc3bdbc84f4`:
  2,097,152 of 2,097,152 the router's decision, 0 refused. **LC1 held.**
- `data/dev.json` (the dev run, the library's 3,000 seed messages), sha256
  `8ec2d6d81b6048b00838c9169f1d9032ae1c76b838f5c1319369ddcf585bdf96`, summarised in `AMENDMENT.md`.

Both re-derive byte for byte from the frozen code (`node tools/proof.mjs --check`, `node tools/dev.mjs --check`). The
bars are the ones `CLAIMS.md` fixed before any code; none has moved.
