const PetMatch = require("../models/PetMatch");
const Pet = require("../models/Pet");
const User = require("../models/User");
const { rankMatches, scorePair, MATCH_THRESHOLD } = require("../services/matching/score");

/**
 * Pet matching.
 *
 * The scoring lives in services/matching/score.js as pure functions; this file
 * is only responsible for loading candidates, persisting results and serving
 * them.
 *
 * The previous version could not execute: `matchPets` opened with
 * `const pet = await pet.findById(...)` - referencing `pet` inside its own
 * initialiser - and no model was ever imported. It also called `createPetMatch`
 * (an Express handler expecting req/res) with a plain object, using capitalised
 * field names the schema does not have, and was mounted directly as a route
 * handler despite taking (petId, isSubscribed).
 */

/** How many candidate pets to consider in one run. */
const CANDIDATE_LIMIT = 500;

/**
 * Scores one pet against the field and stores the results.
 *
 * Plain async function, not an Express handler - `createPet` calls it directly.
 */
const runMatching = async (petId, { isSubscribed = false } = {}) => {
  const currentPet = await Pet.findById(petId);
  if (!currentPet) return [];

  // A subscriber gets a wider net and keeps more results; everyone gets the
  // same scoring, so the ranking is never quietly different.
  const candidates = await Pet.find({ _id: { $ne: currentPet._id } })
    .limit(isSubscribed ? CANDIDATE_LIMIT : Math.floor(CANDIDATE_LIMIT / 2))
    .lean();

  const ranked = rankMatches(currentPet, candidates, {
    limit: isSubscribed ? 50 : 20,
  });

  // Upsert rather than insert: matching re-runs whenever a pet changes, and the
  // old code appended a fresh document every time, growing without bound.
  await Promise.all(
    ranked.map((match) =>
      PetMatch.findOneAndUpdate(
        { pet1: currentPet._id, pet2: match.petId },
        {
          $set: {
            matchScore: match.score,
            relevantToUser: currentPet.owner,
            creator: currentPet.owner,
            modifiedDate: new Date(),
          },
          $setOnInsert: { createdDate: new Date() },
        },
        { upsert: true, new: true }
      )
    )
  );

  return ranked.map((match) => ({
    petId: match.petId,
    score: match.score,
    breakdown: match.breakdown,
  }));
};

const PetMatchController = {
  /** Exposed for PetController and tests. */
  runMatching,

  async getAllPetMatches(req, res) {
    try {
      const petMatches = await PetMatch.find({ relevantToUser: req.userId })
        .populate("pet1")
        .populate("pet2")
        .sort({ matchScore: -1 });
      res.json(petMatches);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getPetMatchById(req, res, next) {
    try {
      const petMatch = await PetMatch.findById(req.params.id)
        .populate("pet1")
        .populate("pet2");

      if (!petMatch) {
        return res.status(404).json({ message: "Cannot find pet match" });
      }
      res.petMatch = petMatch;
      return next();
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  /**
   * The caller's current matches, best first.
   *
   * Was mounted for both GET and POST and called `this.matchPets`, which is
   * undefined once Express takes the handler by reference.
   */
  async matchPetsHandler(req, res) {
    try {
      const matches = await PetMatch.find({ relevantToUser: req.userId })
        .populate("pet2")
        .sort({ matchScore: -1 })
        .limit(50);

      res.json(matches);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Re-runs matching for one of the caller's pets.
   *
   * Was `router.post("/match", PetMatchController.matchPets)` - mounting a
   * function that expected (petId, isSubscribed), so it received Express's
   * (req, res, next) instead.
   */
  async runMatchingHandler(req, res) {
    const petId = req.body.petId ?? req.params.petId;
    if (!petId) {
      return res.status(400).json({ message: "petId is required" });
    }

    try {
      const pet = await Pet.findById(petId);
      if (!pet) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      if (String(pet.owner) !== String(req.userId)) {
        return res.status(403).json({ message: "That isn't your pet" });
      }

      const user = await User.findById(req.userId).select("subscribed");
      const matches = await runMatching(petId, {
        isSubscribed: Boolean(user?.subscribed),
      });

      res.json({ matches, threshold: MATCH_THRESHOLD });
    } catch (error) {
      console.error("[matching] Run failed:", error.message);
      res.status(500).json({ message: error.message });
    }
  },

  /** Explains why two specific pets scored the way they did. */
  async explainMatch(req, res) {
    try {
      const [petA, petB] = await Promise.all([
        Pet.findById(req.params.petId).lean(),
        Pet.findById(req.params.otherPetId).lean(),
      ]);

      if (!petA || !petB) {
        return res.status(404).json({ message: "Cannot find both pets" });
      }

      res.json({ ...scorePair(petA, petB), threshold: MATCH_THRESHOLD });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getPetMatchesByUser(req, res) {
    try {
      const petMatches = await PetMatch.find({ relevantToUser: req.params.userId })
        .populate("pet1")
        .populate("pet2")
        .sort({ matchScore: -1 });

      res.json(petMatches);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createPetMatch(req, res) {
    try {
      const petMatch = await PetMatch.create({
        matchScore: req.body.matchScore,
        pet1: req.body.pet1,
        pet2: req.body.pet2,
        relevantToUser: req.userId,
        creator: req.userId,
        slug: req.body.slug,
      });
      res.status(201).json(petMatch);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = PetMatchController;
