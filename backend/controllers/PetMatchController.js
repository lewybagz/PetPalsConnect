const PetMatch = require("../models/PetMatch");
const PetDecision = require("../models/PetDecision");
const Pet = require("../models/Pet");
const User = require("../models/User");
const { rankMatches, scorePair, MATCH_THRESHOLD } = require("../services/matching/score");
const { createNotification } = require("../services/NotificationService");
const { emitToUser } = require("../services/realtime");

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

  /**
   * Candidate pets for one of the caller's pets to consider.
   *
   * This is the screen the app never had: the matching engine ranked pets and
   * wrote PetMatch rows, but nothing showed them to anyone, so the app's whole
   * reason to exist had no entry point.
   *
   * Candidates exclude the caller's own pets and anything this pet has already
   * decided on - a pass has to stick, or the same dog comes back forever.
   */
  async discover(req, res) {
    try {
      const owner = await User.findById(req.userId).select("pets subscribed").lean();
      if (!owner) {
        return res.status(404).json({ message: "No profile for this account yet" });
      }

      const actingPetId = req.query.petId ?? owner.pets?.[0];
      if (!actingPetId) {
        // Not an error: the add-a-pet step is skippable, so this is a normal
        // state the screen renders an empty state for.
        return res.json({ pet: null, candidates: [], threshold: MATCH_THRESHOLD });
      }

      const actingPet = await Pet.findById(actingPetId).lean();
      if (!actingPet) {
        return res.status(404).json({ message: "Cannot find that pet" });
      }
      if (String(actingPet.owner) !== String(req.userId)) {
        return res.status(403).json({ message: "That isn't your pet" });
      }

      const decided = await PetDecision.find({ fromPet: actingPet._id })
        .select("toPet")
        .lean();

      const candidates = await Pet.find({
        _id: {
          $ne: actingPet._id,
          $nin: decided.map((decision) => decision.toPet),
        },
        owner: { $ne: req.userId, $exists: true },
      })
        .limit(CANDIDATE_LIMIT)
        .lean();

      const ranked = rankMatches(actingPet, candidates, {
        limit: Number(req.query.limit) || 20,
      });

      const byId = new Map(candidates.map((pet) => [String(pet._id), pet]));

      res.json({
        pet: actingPet,
        threshold: MATCH_THRESHOLD,
        candidates: ranked
          .map((match) => ({
            pet: byId.get(String(match.petId)),
            score: match.score,
            breakdown: match.breakdown,
          }))
          .filter((candidate) => candidate.pet),
      });
    } catch (error) {
      console.error("[matching] Discover failed:", error.message);
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Records a like or a pass, and reports a mutual match.
   *
   * A match is mutual when both pets have liked each other. Both sides get a
   * notification and a live event, so neither has to be looking at the screen
   * when it happens.
   */
  async decide(req, res) {
    const { fromPetId, toPetId, decision } = req.body;

    if (!["like", "pass"].includes(decision)) {
      return res.status(400).json({ message: 'decision must be "like" or "pass"' });
    }
    if (!fromPetId || !toPetId) {
      return res.status(400).json({ message: "fromPetId and toPetId are required" });
    }
    if (String(fromPetId) === String(toPetId)) {
      return res.status(400).json({ message: "A pet cannot decide on itself" });
    }

    try {
      const [fromPet, toPet] = await Promise.all([
        Pet.findById(fromPetId).lean(),
        Pet.findById(toPetId).lean(),
      ]);

      if (!fromPet || !toPet) {
        return res.status(404).json({ message: "Cannot find both pets" });
      }
      if (String(fromPet.owner) !== String(req.userId)) {
        return res.status(403).json({ message: "That isn't your pet" });
      }
      if (!toPet.owner) {
        return res.status(409).json({ message: "That pet has no owner" });
      }
      if (String(toPet.owner) === String(req.userId)) {
        return res.status(400).json({ message: "That is your own pet" });
      }

      await PetDecision.findOneAndUpdate(
        { fromPet: fromPet._id, toPet: toPet._id },
        {
          $set: {
            decision,
            fromUser: req.userId,
            toUser: toPet.owner,
            modifiedDate: new Date(),
          },
          $setOnInsert: { createdDate: new Date() },
        },
        { upsert: true, new: true }
      );

      if (decision !== "like") {
        return res.json({ decision, mutual: false });
      }

      const reciprocal = await PetDecision.findOne({
        fromPet: toPet._id,
        toPet: fromPet._id,
        decision: "like",
      }).lean();

      if (!reciprocal) {
        return res.json({ decision, mutual: false });
      }

      // Both liked: record the pair from each side so either owner's match
      // list shows it, and score it so the list can still sort by fit.
      const { score } = scorePair(fromPet, toPet);
      await Promise.all(
        [
          [fromPet, toPet],
          [toPet, fromPet],
        ].map(([a, b]) =>
          PetMatch.findOneAndUpdate(
            { pet1: a._id, pet2: b._id },
            {
              $set: {
                matchScore: score,
                relevantToUser: a.owner,
                creator: a.owner,
                modifiedDate: new Date(),
              },
              $setOnInsert: { createdDate: new Date() },
            },
            { upsert: true, new: true }
          )
        )
      );

      await Promise.all([
        createNotification({
          content: `${toPet.name} liked ${fromPet.name} back - you matched!`,
          recipientId: fromPet.owner,
          type: "PetMatch",
          petName: toPet.name,
        }),
        createNotification({
          content: `${fromPet.name} liked ${toPet.name} back - you matched!`,
          recipientId: toPet.owner,
          type: "PetMatch",
          petName: fromPet.name,
        }),
      ]);

      emitToUser(fromPet.owner, "petMatch", { pet: toPet, score });
      emitToUser(toPet.owner, "petMatch", { pet: fromPet, score });

      res.json({ decision, mutual: true, matchedPet: toPet, score });
    } catch (error) {
      console.error("[matching] Decide failed:", error.message);
      res.status(500).json({ message: error.message });
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
