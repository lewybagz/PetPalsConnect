# Editorial and sourcing standards

## The posture

**The app is not a veterinarian and never speaks like one.** Articles describe
what published guidance says, what studies found, and what to observe. They do
not diagnose, do not dose, and do not tell somebody to withhold or delay
veterinary care. Every health article ends by pointing at a vet.

This is not squeamishness. It is the only posture that survives contact with a
reader whose dog is actually unwell: a guide that says "this is what heatstroke
looks like, cool first and drive second" is useful and honest, and a guide that
says "give 5mg/kg of X" is practising medicine badly at a distance.

**Non-prescriptive does not mean vague.** "Ask your vet" as the answer to
everything is a way of saying nothing. Where a professional body has published
a number — 16 weeks for the final puppy vaccine, one litter box per cat plus
one, 10mg/kg of vitamin C — the article gives the number and names the body.
The vet decides the individual case; the article makes sure the reader knows
what the case is.

## What counts as a source

In rough order of preference:

1. **Guidelines from a veterinary professional body.** AAHA, AAFP, AVSAB,
   AVMA, WSAVA, ACVIM, the American Heartworm Society, CAPC. These are
   consensus documents with named task forces and a revision history.
2. **Peer-reviewed primary research**, cited by author, year and journal.
3. **Government and public-health bodies** for zoonoses and food safety: CDC,
   FDA, state health departments.
4. **Veterinary school and teaching-hospital resources**: Cornell, UC Davis,
   Ohio State's Indoor Pet Initiative, the RVC, the Merck Veterinary Manual.
5. **Established welfare organisations** with published positions: ASPCA,
   International Cat Care / iCatCare, RWAF, PDSA, Best Friends.

**Not sources:** content marketing on a retailer's blog, a trainer's site
with no citations, AI-written listicles, and anything that reports a number
without saying where it came from. Several of those turned up while
researching this corpus; where one is the only place a claim appears, the
claim does not go in.

## Rules that produced the corpus

**A number gets a name attached.** Not "studies show most pets are
overweight" but "59% of dogs and 61% of cats, in the 2022 APOP survey". A
number with no owner cannot be checked and cannot be updated.

**Where the evidence is thin, say so in the article.** Two of the most
repeated pieces of advice in the pet world — the puppy "five-minute rule" and
the shelter "3-3-3 rule" — have no research behind them. Both are in this
corpus, flagged, with the actual evidence next to them. An article that
quietly repeats folklore is worse than no article, because the reader has no
way to know which half they are reading.

**Prefer the mechanism over the rule.** "Stairs before three months raised hip
dysplasia risk, off-leash exercise on varied ground lowered it" tells a reader
what to do with a puppy on a Tuesday. "Five minutes per month of age" does
not, and is not supported anyway.

**Guidance changes; date it.** Leptospirosis moved from noncore to core for
dogs in the 2024 update to AAHA's 2022 guidelines. Anything citing a guideline
names the year, so a stale article is visibly stale.

**Cite what is load-bearing.** A citation on every sentence is unreadable. A
citation on every number, every "guidelines say", and every claim a reader
might act on.

## House style

- **Second person, plain sentences.** "Your dog", not "the canine companion".
- **Both units.** Pounds and kilograms, Fahrenheit and Celsius. The app stores
  weight in pounds; the readership is not only American.
- **No breed defamation.** Breed predicts play style loosely and bite risk
  barely; the AVMA's own position is that breed is a poor predictor. Articles
  talk about individual dogs, size, and play style.
- **The article body is plain text.** `ArticleDetailScreen` renders `content`
  into a single `<Text>`. Markdown syntax renders literally, so paragraphs are
  separated by blank lines and there are no `#`, `*` or `[]()` characters
  doing structural work. Section headings are a short line of prose.
- **Length: 600–1,200 words.** Long enough to be worth opening, short enough
  to read on a phone between two other things.

## Review cadence

`lastReviewedDate` on each article is the date a human last checked its claims
against the sources. Vaccination, parasite and toxicology guidance should be
re-checked annually; behaviour and enrichment content ages more slowly.
