const Pet = require("../models/Pet");
const User = require("../models/User");
const recommend = require("../services/petCare/recommend");
const { CATEGORIES: PICK_CATEGORIES } = require("../services/petCare/picks");
const { CARE_CATEGORIES, OUT_CATEGORIES } = require("../services/placeCategories");
const { EMERGENCY_CONTACTS } = require("../services/petCare/emergency");
const toxins = require("../services/petCare/toxins");
const { LOST_PET_STEPS } = require("../services/petCare/lostPet");
const reading = require("../services/petCare/reading");
const { DESTINATIONS } = require("../services/destinations");
const HealthRecord = require("../models/HealthRecord");
const env = require("../config/env");

/**
 * The pet owner's hub.
 *
 * Everything an owner needs for the pets they actually have, as opposed to the
 * social half of the app. It reads the caller's own pets and nobody else's -
 * `req.userId`, always, and scoped through the profile's `pets` array, which
 * is the link that makes a pet somebody's.
 *
 * The recommendations themselves are pure functions over a source-controlled
 * table (`services/petCare/`), so this controller does no thinking of its own:
 * it resolves the caller's pets and hands them over.
 */
const PetCareController = {
  /**
   * Picks for each of the caller's pets.
   *
   * Returns a shelf per pet rather than one merged list, because "food" means
   * a different thing for the cat than for the dog and merging them would
   * produce a list an owner has to sort out themselves.
   *
   * An owner with no pets gets an empty list and the vocabulary, not an error:
   * the add-a-pet step is skippable, so this is an ordinary state.
   */
  async getPicks(req, res) {
    try {
      const owner = await User.findById(req.userId).select("pets").lean();
      if (!owner) {
        return res.status(404).json({ message: "No profile for this account yet" });
      }

      // Scoped through the profile's own `pets` array rather than by `owner`,
      // the same authority the onboarding gate and the deck use.
      const pets = await Pet.find({ _id: { $in: owner.pets ?? [] } })
        .select("name species age weight specialNeeds photos")
        .lean();

      const articlesByPet = await reading.forPets(pets);

      res.json({
        categories: PICK_CATEGORIES,
        // What the hub can offer beyond products, so the screen does not have
        // to know the vocabulary of another module.
        placeCategories: CARE_CATEGORIES,
        // Where a dog goes with its owner: reported dog-friendly, from keyword
        // searches, so the hub labels them as such.
        outCategories: OUT_CATEGORIES,
        // Where an owner can look besides where they are standing. A bounded
        // list of places that genuinely have imported rows, not a geocoder
        // that would happily name a city with nothing in it.
        destinations: DESTINATIONS,
        emergency: EMERGENCY_CONTACTS,
        // Null until there is a partner. The name travels with the URL so the
        // card can say who it opens - the disclosure is the feature.
        insurance: env.insurance.enabled
          ? { url: env.insurance.url, partner: env.insurance.partner }
          : null,
        // Three articles per pet, from the corpus that is otherwise one
        // failed request away from being unreachable. Stubs only - no bodies.
        pets: recommend.forPets(pets).map((entry) => ({
          ...entry,
          articles: articlesByPet.get(String(entry.petId)) ?? [],
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * The poison table, whole.
   *
   * Served in one response rather than as a search endpoint on purpose. It is
   * a few tens of kB, it changes about never, and the app caches it so the
   * lookup works with no signal - this is the screen somebody opens in a
   * garage at midnight, and a spinner is the wrong answer to "my dog ate a
   * bulb". Searching happens on the device against the cached copy.
   *
   * The emergency numbers ride along because every answer this feature gives,
   * including a miss, has to end at one. The screen must never be able to
   * render a result with no way to ring anybody.
   *
   * No user data is touched, so there is nothing to scope: it is the same
   * table for everybody, like the articles.
   */
  getToxins: async (_req, res) => {
    try {
      res.json({
        toxins: toxins.all(),
        severities: toxins.SEVERITIES,
        contacts: EMERGENCY_CONTACTS,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * The lost-pet checklist, and any chip numbers the caller has recorded.
   *
   * The steps are a table in the source and never change; the chip numbers are
   * the caller's own `identification` records, scoped by `owner` like every
   * other read here. Shipping them together is the point: the first step is
   * "check the microchip registration", and answering it means having the
   * number to hand rather than asking somebody to go and find it.
   */
  getLostPet: async (req, res) => {
    try {
      const pets = await Pet.find({ owner: req.userId }).select("_id name").lean();

      const records = await HealthRecord.find({
        owner: req.userId,
        kind: { $in: ["microchip", "licence"] },
      })
        .select("pet kind label")
        .lean();

      const names = new Map(pets.map((pet) => [String(pet._id), pet.name]));

      res.json({
        steps: LOST_PET_STEPS,
        contacts: EMERGENCY_CONTACTS,
        identification: records.map((row) => ({
          petId: String(row.pet),
          petName: names.get(String(row.pet)) ?? null,
          kind: row.kind,
          label: row.label,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = PetCareController;
