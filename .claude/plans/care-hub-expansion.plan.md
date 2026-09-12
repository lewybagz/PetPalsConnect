# Care hub expansion — poison lookup, identification, weight, travel, reading

Status: **all five phases built and verified** (2026-09-11). Written
2026-09-11 against `main` @ `b37f9b4`. Decided with you 2026-09-11 from
research (148 sources, four Exa subagents, plus a repo audit). Another agent is
working in this tree on store readiness (`contentFilter.js`, `retention.js`,
`services/location.js`, `acceptedTerms`, and an uncommitted store feature);
nothing here touches those files.

Three things found while building, each now with a test:

- **The poison search rule was symmetrical**, so the alias "tea" claimed the
  query "tea tree" and answered a question about a cat's liver with one about
  a dog's heart. One-directional now, tested on both sides of the wire.
- **`scripts/importArizona.js` ran its import on `require`** and then closed
  the shared mongoose connection, which is why its city list had been copied
  rather than imported. Behind `require.main === module` now, and the list
  lives in `services/destinations.js` where both callers read it.
- **`accountDeletion.test.js` failed the moment `WeightEntry` existed**, as
  this plan predicted. That is the test working: the cascade was added and it
  passes.

## Why these five

The research said two things that shaped every decision below.

**Recurring non-social utility is what retains.** Replenishment-style
subscriptions run 5-8% monthly churn against 8-12% for discovery products
([Eightx, 2026](https://eightx.co/blog/pet-subscription-churn-rate-benchmark)),
and Wag filed Chapter 11 in July 2025 on $69.5M of cumulative losses with a
marketplace model. The reminders already shipped are the right lane; these
extend it rather than adding a second social surface.

**A content library is dead weight unless it is surfaced contextually.**
Health and fitness sources agree that an undiscoverable library earns nothing,
while contextual surfacing tied to user state does. This app has 60 researched
articles, 49,000 words and 224 citations, reachable only through one card on
Home that is itself inside `{latestArticle ? … : null}` — so a failed
`/api/articles/recent` hides the entire corpus. That is a reachability bug of
exactly the class this repo keeps finding.

And the competitive check: across eleven apps surveyed (Rover, Wag, 11pets,
PetDesk, Dutch, Chewy, Banfield, Red Cross, Pupford, Pawtrack, Waggle),
**nobody pairs lost-pet/microchip tooling with health records**, and only two
offer a poison lookup. This is uncontested ground, not a catch-up feature.

| Phase | Feature | Evidence |
| --- | --- | --- |
| 1 | Poison lookup | 451,000+ ASPCA calls in 2024, +4% YoY; food 16.1%, chocolate 13.6% ([ASPCA](https://www.aspca.org/about-us/press-releases/aspca-sees-increase-number-calls-poison-control-center-2024-including-rise)) |
| 2 | Identification record | 45% of pets microchipped, 60% of those registered; chipped dogs return 52% vs 2% ([2025 survey](https://wreg.com/business/press-releases/cision/20250630CL20298/)) |
| 3 | Reading shelf | Corpus is one failed request away from unreachable; contextual > tab |
| 4 | Weight history | 37% of dogs above ideal weight, only 29% ever scored by a vet ([APOP 2025](https://www.petobesityprevention.org/articlesandnews/dzjvowbhdnq9ec6mkkmq9s39sim0ax)) |
| 5 | Travel search | 78% have travelled with a pet; pet-friendly searches +40% 2023-25 |

## The line this plan does not cross

`CLAUDE.md` forbids a symptom-checker, a diagnosis and any dose a reader could
act on; `content/research/topics.md` excludes triage explicitly. Every feature
here is held to that:

- The poison table **describes published ASPCA and Pet Poison Helpline
  guidance and always ends at a phone number**. It never asks how much was
  eaten, never estimates a threshold by weight, and has no "should I worry"
  branch. There is exactly one call to action and it is the helpline.
- The identification record **stores what an owner already has**. It does not
  register a chip, does not check a registry, and does not claim a pet is
  findable.
- Weight **plots what was entered against the published AAHA body condition
  scale**. It shows a trend and the chart; it never names a target weight, a
  calorie figure or a diet.
- The reading shelf surfaces existing reviewed articles. No new claims.

## Phase 1 — Poison lookup

**`content/toxins/toxins.json`**, reviewed like `articles.json`, seeded and
validated the same way. A table, not a collection, for the same reason
`picks.js` and `emergency.js` are: no runtime writer, no spam surface, and
changing what the app says about chocolate is a reviewed diff. 50-60 entries
drawn from the ASPCA top-ten lists and Pet Poison Helpline.

```json
{
  "slug": "grapes-raisins",
  "name": "Grapes and raisins",
  "aliases": ["grape", "raisin", "sultana", "currant"],
  "species": ["dog", "cat"],
  "severity": "emergency",
  "signs": "Vomiting, lethargy, reduced urination.",
  "guidance": "Toxic to dogs; the toxic dose is not predictable and a small
               amount has caused kidney failure. Call the helpline.",
  "sources": [{ "name": "ASPCA APCC", "url": "…", "year": 2025 }]
}
```

- `severity` is one of `emergency` | `call` | `avoid`, and it drives ordering
  and the colour of the card, never a numeric risk score.
- `aliases` is what makes the search work in a panic: somebody types "grape",
  not "grapes and raisins". Matching is a normalised substring over name and
  aliases — no fuzzy scoring, because a wrong near-match on this screen is
  worse than no match.
- **A miss is a real answer.** "This is not in the list" is followed by the
  helpline number, never by silence or an empty state that implies safety.

Backend: `backend/services/petCare/toxins.js` loads and indexes the JSON,
`GET /api/petcare/toxins` returns the table (small enough to ship whole, so
the app caches it and the screen works offline — the one screen that must).
No key, no quota, no third-party uptime in the emergency path.

App: `ToxinLookupScreen`, entered from a card in the hub's emergency section,
which is the section that already always works. The two poison-control numbers
are on screen before the first keystroke and after every result.

## Phase 2 — Identification record

`microchip` and `licence` join `KIND_CATEGORIES` as a new `identification`
category on the existing `HealthRecord`. This is the lazy correct move: the
model, the routes, the ownership scoping, the screen and the tests all exist.

- `label` carries the chip or tag number, exactly as it does for a medication.
- `notes` carries the registry name.
- These kinds have **no `intervalDays` and no reminder** — a chip does not
  expire. `statusOf()` already filters to vaccine kinds, so vaccination status
  is untouched; `identification` is simply a new group on `PetHealthScreen`.
- A licence *can* expire, so it keeps `expiresAt` and its reminder, raising
  `healthDue` like every non-vaccine kind.

Alongside it, a **lost-pet checklist** in the hub: a static ordered list of
what to do in the first hours, each step citing its source, with the pet's
stored chip number shown at the top if one was entered. No tracking, no alert
broadcast, no map of lost pets — those are a different product and none of the
eleven competitors ship one either.

## Phase 3 — Reading shelf (and the reachability fix)

Two pieces.

**The species vocabulary bridge.** Articles tag `dogs`/`cats`/`small-pets`;
pets are `dog`/`cat`/`smallMammal`. One map in **one place** —
`backend/services/petCare/reading.js`, mirrored into the app the way the
matching weights already are, checked by `types.test.js`. The two vocabularies
stay separate (articles are editorial, species is a schema enum); what is new
is a single declared translation between them.

**The shelf.** `GET /api/petcare/picks` already returns a per-pet block. It
gains `articles`: three article stubs (title, summary, id — no body) chosen by
the pet's species tag, preferring the pet's life stage tag (`puppies`,
`kittens`, `senior`) when one applies. The hub renders "Reading for Buddy"
under that pet's shelves, plus "See all dog articles" which opens
`ArticlesScreen` pre-filtered by tag — a route that already takes one.

**And the bug:** `HomeScreen`'s "View all articles" button moves out of the
`{latestArticle ? … : null}` conditional. A failed `/recent` must not be able
to hide a 60-article library. `navigation.test.js` gets a case for it.

## Phase 4 — Weight history

A new `weighIn` kind on `HealthRecord` would be wrong: weight is a number, not
a date, and `HealthRecord` has no numeric field. Instead `WeightEntry`
(`pet`, `owner`, `pounds`, `takenAt`, `bodyCondition?`, `creator`) — the
smallest model that works, scoped by `owner` like `HealthRecord`.

- Storage is **pounds**, canonical, per the units rule; `src/utils/units.ts`
  converts for display. Matching compares stored numbers, so this cannot drift.
- Saving an entry updates `Pet.weight` to the latest value, because matching
  reads that field and two sources of truth for one number is the bug this
  repo has fixed twice already.
- `bodyCondition` is the 1-9 AAHA/WSAVA scale, optional, entered by the owner,
  displayed beside the published chart. **No target, no recommendation, no
  "your dog is overweight".** The trend line and the chart are the whole
  feature; the conclusion is the vet's.
- Only dog and cat, matching `MEASURED_SPECIES`.

## Phase 5 — Travel search

The importer, the three out-and-about categories and the place cards all
exist. What is missing is searching somewhere you are not.

`GET /api/locations/near` gains an optional `lat`/`lng` pair distinct from the
caller's own position, and the hub's "Out and about" section gains a
destination field. Picking a city imports on demand exactly as the hub already
does for a cold local area — same guard rails: only when genuinely empty, only
once per mount, because an import is billed Google traffic.

Deliberately **not** building a trip planner, an itinerary or a booking
integration. The research supports demand for finding pet-friendly places
somewhere else; everything past that is a travel product.

## Testing

Every phase leaves runnable checks, per the repo's floor:

| Phase | Checks |
| --- | --- |
| 1 | `toxins.test.js`: every entry has sources, a valid severity and species; alias search finds a known term; a miss still returns the helpline. A `--dry-run` content validator like the articles seeder. |
| 2 | `healthRecords.test.js` additions: identification kinds take no interval, raise no reminder, and do not affect `statusOf()`. |
| 3 | `reading.test.js`: every species enum value maps to a real tag with articles behind it. `navigation.test.js`: the articles route survives a null `/recent`. |
| 4 | `weight.test.js`: pounds round-trip, `Pet.weight` follows the newest entry, a non-measured species is refused. `accountDeletion.test.js` must cascade the new model — its existing test fails until it does. |
| 5 | `carePlaces.test.js`: a destination search does not use the caller's position; the import guard still fires only once. |

Plus the standing gates: `lint`, `check:schemas`, `check:auth`, `check:colours`,
`typecheck`, both jest suites, `expo export`, and the gallery boards for each
new screen.

## Risks

- **Scope.** Five phases is more than the last three plans combined. They are
  ordered by evidence strength and each ships independently; if you want to
  stop after two, phases 1 and 2 are the two with the strongest numbers.
- **The poison table is the highest-stakes content in the app.** It is also
  the one screen somebody opens while frightened. Mitigation: severity is
  descriptive, the helpline is on screen at all times, a miss is explicit, and
  every entry cites a named source and year like the rest of `content/`.
- **`accountDeletion` will fail until `WeightEntry` is cascaded.** That is the
  test working as designed and is called out here so it is not a surprise.
- **Another agent is active.** Phase 5 touches `LocationController`, which
  their location-permission work sits near. Worth landing phases 1-4 first.
