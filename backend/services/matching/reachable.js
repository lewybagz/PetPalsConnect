const Pet = require("../../models/Pet");
const User = require("../../models/User");
const { withinRange } = require("./distance");
const blocking = require("../blocking");
const { MATCHABLE_SPECIES, matchableQuery } = require("./eligibility");
const settings = require("../settings");
const vaccinations = require("../vaccinations");

/**
 * Who may see whom, in one place.
 *
 * This was a local function inside `PetMatchController`, shared by the two
 * ways of arriving at the deck. It is a service now because a third caller
 * wants it: telling somebody a new dog has appeared in range asks the same
 * question from the other end, and re-deriving "in range, not blocked, not
 * suspended, matchable" at that call site would be a second copy of every
 * safety rule in the app.
 *
 * Moved unchanged. The point of extracting it is that there is still exactly
 * one implementation, so it must behave identically to the one the deck has
 * been using.
 */

/** How many rows to consider before filtering. */
const CANDIDATE_LIMIT = 500;

/**
 * The pets a given account may see, already filtered by distance.
 *
 * Shared by the two ways of arriving at the deck - with a pet of your own, and
 * without one - because the filtering is the part that has to be identical.
 * Blocking, suspension and range are safety and privacy rules; a second code
 * path is a second place for one of them to be forgotten.
 *
 * Returns `[{ pet, distanceMiles }]`. `distanceMiles` is null when either side
 * has not shared a position, and such a pet stays in rather than dropping out:
 * excluding them empties the deck for everyone early on.
 */
const reachableCandidates = async ({
  userId,
  origin,
  maxMiles,
  excludePetIds = [],
  limit = CANDIDATE_LIMIT,
}) => {
  const [blockedIds, suspendedIds, viewer] = await Promise.all([
    blocking.blockedIdsFor(userId),
    User.distinct("_id", { suspended: true }),
    User.findById(userId).select("discovery").lean(),
  ]);
  const excludedOwners = [...new Set([...blockedIds, ...suspendedIds.map(String)])];

  const query = {
    owner: { $ne: userId, $exists: true, $nin: excludedOwners },
    // Playdates are dogs only. This sits with blocking, suspension and range
    // for the same reason they do: one query, so there is one place to forget.
    ...matchableQuery(),
  };
  if (excludePetIds.length > 0) query._id = { $nin: excludePetIds };

  // The owner's own filters, in canonical units. Applied here rather than in
  // each caller because this is the one filter every discovery path shares -
  // the same reason blocking and suspension live here.
  const { discovery } = settings.withDefaults(viewer ?? {});
  const { minWeight, maxWeight, minAge, maxAge, species } = discovery;

  if (minWeight > 0 || maxWeight < 300) {
    query.weight = { $gte: minWeight, $lte: maxWeight };
  }
  if (minAge > 0 || maxAge < 30) {
    query.age = { $gte: minAge, $lte: maxAge };
  }
  /**
   * The owner's species preference can only ever *narrow* what is already
   * matchable - never widen it.
   *
   * This read `query.species = { $in: species }`, which overwrote the
   * dogs-only filter spread in from `matchableQuery()` a few lines above: a
   * preference naming a cat would have put cats in the deck and quietly
   * undone the rule the whole matching path is built on. The two changes were
   * written on separate branches and each was correct alone, which is exactly
   * how an assignment like this survives review.
   *
   * Empty means "no preference", which is not the same as "none of them". A
   * preference that excludes the one matchable species matches nothing, which
   * is what the owner asked for.
   */
  if (species.length > 0 && !species.includes(MATCHABLE_SPECIES)) {
    query.species = { $in: [] };
  }

  const candidates = await Pet.find(query).limit(limit).lean();

  const ownerIds = [...new Set(candidates.map((pet) => String(pet.owner)))];
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("geoLocation")
    .lean();
  const coordsByOwner = new Map(
    owners.map((candidateOwner) => [
      String(candidateOwner._id),
      candidateOwner.geoLocation?.coordinates ?? null,
    ])
  );

  // Without a position of our own we cannot measure anything, so everyone
  // stays in rather than nobody.
  const reachable = origin
    ? withinRange(
        origin,
        candidates.map((pet) => ({
          pet,
          coordinates: coordsByOwner.get(String(pet.owner)),
        })),
        maxMiles
      )
    : candidates.map((pet) => ({ pet, distanceMiles: null }));

  // Somebody who has never shared a position has a null distance. Dropping
  // them empties the deck early on, so it is opt-out rather than the default.
  const inRange = discovery.includeUnknownDistance
    ? reachable
    : reachable.filter((entry) => entry.distanceMiles !== null);

  // Every card carries the pet's vaccination status, and the owner's
  // preference can narrow to pets whose owner has shared current records.
  // A narrowing filter, like the rest: it is applied to the list the rules
  // above already built and can only ever remove from it.
  const statuses = await vaccinations.statusForPets(inRange.map((entry) => entry.pet._id));
  const withStatus = inRange.map((entry) => ({
    ...entry,
    vaccination: statuses.get(String(entry.pet._id)),
  }));

  return discovery.requireVaccinationShared
    ? withStatus.filter((entry) => vaccinations.isShared(entry.vaccination))
    : withStatus;
};

module.exports = { reachableCandidates, CANDIDATE_LIMIT };
