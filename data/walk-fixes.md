# Buyer walk: what each persona raised, and what changed on the page

The walk (`data/walk-7b.md`) ran on the local qwen2.5:7b only, against the live page as rendered
(`data/walk-page.json`). Three of five first attempts failed (Node's fetch gave up after 300 s waiting for the CPU
model); they were asked again over `node:http` and both attempts are kept. A frontier adversarial read of the same
rendered page against the record ran beside it. Every item is answered on the page.

## From the adversarial read of the page against the record

| raised | change |
|---|---|
| "proven to compute exactly the same on settling hardware" — it was proven on an emulated array | "proven … in an emulated settling array as in software on every possible input"; the CEO card and the board case say "in emulation" |
| "it refuses rather than guesses when its hardware degrades" — false for drift and shorted cells (LC6 failed for both) | Edge card and security list name the faults that fail silently: drift spread and shorted cells |
| "nothing is silently dropped" — a drifted array can misroute without warning | the Operations card says so and points at the risks |
| "Energy … which every change made by the settle lowers here" — shown only for the exact device (LC2) | "on the exact device"; the same for the margins in the white paper |

## Chief financial officer

| raised | change |
|---|---|
| no evidence of a real-chip run | the hero line links to Next: a real-chip run is the named next step |
| no electrical energy figure | unchanged by design (LC10); Next says the first energy figure is what a real-chip run measures |
| "the exact method of calculation is unclear" | the case note now prints the formula, with the meter counts, beside the sources |
| no breakdown of how many messages still go to a person | the Operations card gives the share; the case note gives the messages a month a person still routes |
| no evidence of how often real devices have stuck-on cells | the risk row says plainly the page cannot know it: read it off the datasheet or a test of the array and place it on the edge map |

## Head of risk and compliance

| raised | change |
|---|---|
| how the rules are verified, and by whom | the hero says how the pattern library keeps a rule (an unseen batch and a never-used batch) and links its page, which shows every exam |
| "emulator, not a chip" not explained | the card says what an emulator is |
| how each claim is verified | the claims table has a "Judged from" column naming the committed file, and a note that every claim was sealed before code and re-derived on every push |
| sealed / sticky not explained in detail | a worked example in Words |
| drift not explained | Words gives the emulator's drift model, read from its own constants |
| how stuck cells are detected or handled | Words says the emulator measures them and does not remap; a deployment tests and remaps |

## Chief technology officer

| raised | change |
|---|---|
| "every possible input" ambiguous | the card says it is every combination of the library's 21 words, the router's whole input space |
| how the held-out messages were chosen | the card says: every Banking77 message outside the seed slice in the library's own exam order, every NLU++ message, none chosen by hand |
| the 1-of-10 chips result lacks a test description | the card says each chip was programmed from its own sealed seed and run on every held-out message |
| the wrong-answer rate is not explained | the card names the cause (drift spread) and points at What we found |
| the front-end result has no method | the card says each drive set every line to a seeded random level |

## Chief information security officer

| raised | change |
|---|---|
| no threshold for acceptable drift | the risk row gives the acceptance line, read from the edge map |
| no method for testing and remapping shorted cells | Next names the method (read back every device, mark the ones that ignore programming, move that weight to a spare) and says it is not built here |
| no detail on how the fit-check works or was tested | What we found says how it works (the dead band) and how it was tested (every line at half level on every held-out message) |
| emulator / energy / hardware performance | answered by design: What this is, Next |

## Procurement lead

| raised | change |
|---|---|
| early stage is a risk | a new risk row says it plainly: a first rung, proven in emulation, not a chip you can buy today |
| the hardware for a real run is not detailed | Next now states it for this library: rows, columns and devices, levels, column read-out |
| no energy figure to compare | answered by design: the first energy figure is the real-chip run's output |
