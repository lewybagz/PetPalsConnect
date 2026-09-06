# The topic map

## Where the topics came from

Nothing in this repository has ever defined what the Articles feature should
contain. There is no brief, no backlog, no issue. What there *is* is a very
precise statement of what this app is about, spread across the code:

- **16 activities** a pet can list, in `AddPetScreen` and
  `backend/services/matching/compatibility.js`: walking, fetch, swimming,
  hiking, tug_of_war, agility_training, hide_and_seek, bubbles, frisbee,
  dog_park, playdates, sniffari, digging, chew_toys, puzzles, obstacle_course.
- **6 temperaments**: Calm, Energetic, Friendly, Neuroticism, Motive Driven,
  Extrovert.
- **~70 breeds** with hand-written affinity tables.
- **A scoring function that tells users why they matched** — temperament 30,
  size 25, activities 25, breed 12, age 8 (`services/matching/score.js`).
- **Playdates at real places**, from a seeded catalogue of dog parks, dog
  beaches, pet-friendly restaurants and cabins in Arizona and California.
- **Safety machinery**: blocking, reporting, auto-suspension at three distinct
  reporters.
- **The one article that has ever existed**, as a gallery fixture: *"Six games
  that tire a collie out."*

That is the brief. This app's users are people arranging for two animals who
have never met to meet, in a public place, usually outdoors, often in Arizona
in summer. The content that earns its place answers the questions that
arrangement raises.

The second wave widened that deliberately, on the reasoning that the app's
users own the animal for fifteen years and arrange playdates on a few dozen
afternoons of it. Health, species breadth and the life course are what they
search for the rest of the time, and a corpus that only covers the app's own
feature surface is a corpus nobody opens twice.

## Priority tiers

**Tier 1 — the app makes a promise the article has to keep.** Discovery says
two pets are compatible; the playdate flow puts them in a park. If the app is
going to arrange the meeting, it owes the owner the information that makes the
meeting go well. These are the articles that would be missed if removed.

**Tier 2 — health and safety a pet owner acts on.** Cited, non-prescriptive,
vet-pointing. Highest search value, highest duty of care.

**Tier 3 — species and lifecycle breadth.** Cats, rabbits, guinea pigs, birds,
reptiles; puppies, adoption, ageing.

---

## Written — see `content/articles/articles.json`

60 articles, ~49,000 words, 224 citations. Tier 1 is content the app makes a
promise about; tier 2 is health and safety a reader acts on; tier 3 is species
and lifecycle breadth.

| # | Slug | Tier | Tags |
|---|---|---|---|
| 1 | `reading-dog-play` | 1 | dogs, play, playdates |
| 2 | `first-playdate-introductions` | 1 | dogs, playdates, behaviour |
| 3 | `dog-park-or-playdate` | 1 | dogs, playdates, dog-park |
| 4 | `what-makes-a-good-match` | 1 | dogs, matching, playdates |
| 5 | `play-styles-by-breed` | 1 | dogs, play, playdates |
| 6 | `six-games-for-a-herding-dog` | 1 | dogs, enrichment, play |
| 7 | `the-sniffari` | 1 | dogs, enrichment, walking |
| 8 | `tug-of-war-myth` | 1 | dogs, play, training |
| 9 | `playdates-in-the-heat` | 1 | dogs, safety, heat |
| 10 | `water-safety-for-dogs` | 1 | dogs, safety, swimming |
| 11 | `reading-your-match-score` | 1 | dogs, matching, playdates |
| 12 | `size-mismatch-playdates` | 1 | dogs, playdates, safety |
| 13 | `first-five-minutes` | 1 | dogs, playdates, safety |
| 14 | `small-dogs-big-parks` | 1 | dogs, dog-park, safety |
| 15 | `beyond-the-dog-park` | 1 | dogs, playdates, behaviour |
| 16 | `leash-reactivity` | 1 | dogs, behaviour, training |
| 17 | `resource-guarding-playdates` | 1 | dogs, behaviour, playdates |
| 18 | `hosting-a-playdate-at-home` | 1 | dogs, playdates, safety |
| 19 | `coughing-dogs-and-playdates` | 1 | dogs, health, playdates |
| 20 | `vaccines-before-a-playdate` | 2 | dogs, cats, health |
| 21 | `parasites-at-the-park` | 2 | dogs, health, parasites |
| 22 | `body-condition-honestly` | 2 | dogs, cats, health |
| 23 | `the-poison-list` | 2 | dogs, cats, birds |
| 24 | `microchips-and-registration` | 2 | dogs, cats, safety |
| 25 | `kids-and-dogs` | 2 | dogs, safety, children |
| 26 | `senior-pets-hide-pain` | 2 | dogs, cats, health |
| 27 | `ticks-and-what-to-do` | 2 | dogs, cats, health |
| 28 | `fleas-the-hidden-majority` | 2 | dogs, cats, health |
| 29 | `leptospirosis-is-now-core` | 2 | dogs, health, vaccines |
| 30 | `dental-disease` | 2 | dogs, cats, health |
| 31 | `neutering-timing` | 2 | dogs, health, surgery |
| 32 | `when-it-is-an-emergency` | 2 | dogs, cats, health |
| 33 | `bloat-gdv` | 2 | dogs, health, emergency |
| 34 | `heartworm-the-arithmetic` | 2 | dogs, cats, health |
| 35 | `first-aid-kit-and-plan` | 2 | dogs, cats, small-pets |
| 36 | `introducing-cats` | 3 | cats, introductions, behaviour |
| 37 | `five-pillars-cat-home` | 3 | cats, environment, behaviour |
| 38 | `indoor-cat-hunting` | 3 | cats, play, enrichment |
| 39 | `rabbits-and-guinea-pigs` | 3 | rabbits, guinea-pigs, small-pets |
| 40 | `birds-and-reptiles-hazards` | 3 | birds, reptiles, small-pets |
| 41 | `puppy-exercise-truth` | 3 | dogs, puppies, health |
| 42 | `bringing-a-rescue-home` | 3 | dogs, cats, adoption |
| 43 | `choosing-a-trainer` | 3 | dogs, cats, training |
| 44 | `cat-body-language` | 3 | cats, behaviour, safety |
| 45 | `cat-scratching` | 3 | cats, behaviour, environment |
| 46 | `multi-cat-tension` | 3 | cats, behaviour, multi-cat |
| 47 | `indoor-outdoor-catio` | 3 | cats, environment, welfare |
| 48 | `bonding-rabbits` | 3 | rabbits, small-pets, behaviour |
| 49 | `exotics-vet-care` | 3 | rabbits, guinea-pigs, birds |
| 50 | `reading-a-parrot` | 3 | birds, behaviour, small-pets |
| 51 | `reptile-husbandry-basics` | 3 | reptiles, small-pets, health |
| 52 | `aquarium-nitrogen-cycle` | 3 | fish, small-pets, health |
| 53 | `puppy-first-sixteen-weeks` | 3 | dogs, puppies, behaviour |
| 54 | `kitten-socialisation` | 3 | cats, kittens, behaviour |
| 55 | `adolescent-dogs` | 3 | dogs, behaviour, training |
| 56 | `house-training` | 3 | dogs, puppies, training |
| 57 | `being-left-alone` | 3 | dogs, behaviour, training |
| 58 | `cognitive-dysfunction` | 3 | dogs, cats, senior |
| 59 | `quality-of-life` | 3 | dogs, cats, senior |
| 60 | `pet-loss-and-grief` | 3 | dogs, cats, small-pets |

## Backlog — researched enough to brief, not yet written

The first wave's backlog is written. What is left, in rough priority order.

**Tier 1**

- *Daycare: how to choose one and what to ask.* Group size, staff ratio, size
  separation, rest periods, and how they handle a scuffle. Ties directly to the
  predatory-drift and play-style articles.
- *Recall that works around other dogs*, which is the single skill that makes
  every other playdate article easier to follow.
- *Muzzle training as an ordinary skill*, not a mark of a dangerous dog — a
  muzzle-trained dog can be seen by a vet in pain, and the stigma costs dogs
  care.
- *Two dogs in one house*: whether to get a second, and the honest version of
  what changes.

**Tier 2**

- *Obesity, properly*: a weight-loss plan, calorie arithmetic, and why cats
  must lose weight slowly (hepatic lipidosis). Currently one section inside
  `body-condition-honestly` and worth its own piece.
- *Arthritis management in dogs*, now that the feline side is covered.
- *Chronic kidney disease in cats* — the most common serious diagnosis in older
  cats and one owners are handed with almost no orientation.
- *Vaccine reactions and what is actually normal afterwards.*
- *Anaesthesia: what happens, and the pre-anaesthetic bloodwork question.*
- *Pet insurance mechanics*, particularly pre-existing condition definitions,
  which is where most disputes originate.

**Tier 3**

- *Travelling with a pet*: airline rules, car restraint (Center for Pet Safety
  certification is voluntary and there is no federal standard), and the gap
  between "pet-friendly" and "your dog may come inside".
- *Hamsters, gerbils and rats*, which are sold to children and researched by
  almost nobody.
- *Ferrets.*
- *Backyard chickens*, now common and served mostly by folklore.
- *Cat food: wet, dry, and what the evidence supports.*
- *Adopting a senior*, and why they are the best-kept secret in rescue.
- *When a household changes*: a new baby, a move, a bereavement, a breakup.

## What this corpus deliberately does not cover

- **Symptom-checker and triage content.** "My dog is vomiting, what is it" is
  the highest-traffic pet query on the internet and the one this app is least
  equipped to answer responsibly. Emergency signs appear inside articles as
  "this is when you stop reading and call a vet", never as a diagnostic path.
- **Dosing.** No mg/kg for anything a reader could administer. The theobromine
  thresholds in `the-poison-list` are there to convey *how little it takes*,
  attached to an instruction to call the poison line, not to let anyone decide
  a dose is safe.
- **Diet brand or product recommendations.** No affiliate surface, and
  nutrition claims that would need a veterinary nutritionist to stand behind.
- **Breed-specific danger claims.** The AVMA's own position is that breed is a
  poor predictor of bite risk. Breed appears here as a hint about play style
  and body shape, which is what the matching algorithm uses it for too.
