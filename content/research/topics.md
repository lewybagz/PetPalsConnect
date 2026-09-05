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

## Batch 1 (written — see `content/articles/articles.json`)

| # | Slug | Tier | Ties to |
|---|---|---|---|
| 1 | `reading-dog-play` | 1 | Playdates, `dog_park`, `playdates` activities |
| 2 | `first-playdate-introductions` | 1 | `SchedulePlaydateScreen`, PetMatch |
| 3 | `dog-park-or-playdate` | 1 | Location catalogue, `dog_park` activity |
| 4 | `what-makes-a-good-match` | 1 | `matching/score.js` weights, `explainMatch` |
| 5 | `play-styles-by-breed` | 1 | `BREED_AFFINITY`, `TEMPERAMENT_AFFINITY` |
| 6 | `six-games-for-a-herding-dog` | 1 | `sniffari`, `puzzles`, `obstacle_course`, `frisbee` |
| 7 | `the-sniffari` | 1 | `sniffari`, `walking` activities |
| 8 | `tug-of-war-myth` | 1 | `tug_of_war` activity |
| 9 | `playdates-in-the-heat` | 1 | AZ/CA locations, brachycephalic breeds |
| 10 | `water-safety-for-dogs` | 1 | `swimming` activity, dog beaches |
| 11 | `vaccines-before-a-playdate` | 2 | Playdate safety |
| 12 | `parasites-at-the-park` | 2 | `dog_park` activity |
| 13 | `body-condition-honestly` | 2 | Pet `weight` field, size scoring |
| 14 | `the-poison-list` | 2 | All species |
| 15 | `microchips-and-registration` | 2 | Lost pets, map |
| 16 | `introducing-cats` | 3 | Multi-pet households |
| 17 | `five-pillars-cat-home` | 3 | Cats |
| 18 | `indoor-cat-hunting` | 3 | Cats, enrichment |
| 19 | `rabbits-and-guinea-pigs` | 3 | Small pets |
| 20 | `birds-and-reptiles-hazards` | 3 | Birds, reptiles |
| 21 | `puppy-exercise-truth` | 3 | Puppies, `hiking`/`walking` |
| 22 | `bringing-a-rescue-home` | 3 | New pets, onboarding |
| 23 | `choosing-a-trainer` | 3 | Behaviour problems |
| 24 | `kids-and-dogs` | 2 | Safety |
| 25 | `senior-pets-hide-pain` | 2 | Ageing pets |

---

## Backlog — researched enough to brief, not yet written

**Tier 1**

- *When a match is not a match*: reading the app's own breakdown, and why a
  62 with great temperament fit beats an 80 that is all breed and age. Needs
  the weighted-points caveat from `src/api/discovery.js`.
- *The first five minutes of a playdate*: arrival, leash management, gates,
  and the decision to leave early. Nothing to research; needs writing.
- *Playing with a size mismatch*: predatory drift, why `sizeScore` reaches
  zero at a 1:3 weight ratio, and how to run a 15lb/45lb playdate safely.
- *Small dogs at a big-dog park*, and why "small dog area" is not decoration.
- *Playdates for a dog who does not like dog parks*: one-to-one, sniffari
  walks, parallel hikes, private rentals.

**Tier 2**

- *Ticks, and what to do about the one you found*: needs CAPC regional
  prevalence and current removal guidance.
- *Leptospirosis in the city*: the 2024 core reclassification is a genuine
  news hook; needs ACVIM consensus statement read directly.
- *Fleas: the 95% you cannot see*, life-cycle and environmental treatment.
- *Spay/neuter timing by breed and size*: contested; needs the UC Davis breed
  studies (Hart et al.) read in full before writing, because the guidance
  genuinely differs by breed and the popular summaries are wrong.
- *Pet first-aid kit and an emergency plan*, incl. having the APCC number and
  the nearest 24-hour hospital saved before you need them.
- *Dental disease*: the most common diagnosis in adult dogs and cats and the
  one owners most consistently ignore.

**Tier 3**

- *Cat body language*, tail, ears, pupils, and the difference between "I am
  done" and "I am about to bite you".
- *The indoor/outdoor question*, honestly, including catios.
- *Old dogs: arthritis, cognitive dysfunction, and what "slowing down" hides.*
- *Pet loss and grief.*
- *What pet insurance actually covers*, and pre-existing condition mechanics.
- *Travelling with a pet*: airline rules, car restraint, and the difference
  between pet-friendly and dog-welcome.
- *Rabbit and guinea pig vet care*: why an exotics vet, and the cost of not.

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
