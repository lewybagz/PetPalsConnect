const Pet = require("../models/Pet");
const User = require("../models/User");
const recommend = require("../services/petCare/recommend");
const { CATEGORIES: PICK_CATEGORIES } = require("../services/petCare/picks");
const { CARE_CATEGORIES } = require("../services/placeCategories");
const { EMERGENCY_CONTACTS } = require("../services/petCare/emergency");

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

      res.json({
        categories: PICK_CATEGORIES,
        // What the hub can offer beyond products, so the screen does not have
        // to know the vocabulary of another module.
        placeCategories: CARE_CATEGORIES,
        emergency: EMERGENCY_CONTACTS,
        pets: recommend.forPets(pets),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = PetCareController;
