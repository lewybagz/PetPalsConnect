const Pet = require("../models/Pet");
const scheduler = require("./scheduler");
const { notify } = require("./NotificationService");

/**
 * A reminder to finish the bits of a pet's profile that onboarding skipped.
 *
 * `AddFirstPetScreen` deliberately asks for the minimum - species, name,
 * breed, age, weight - and defers temperament, activity level and
 * socialisation, with a footnote saying they "help us find even better
 * matches". Nothing ever asked again, so that footnote was a promise the app
 * did not keep, and three fields the matcher scores on stayed empty for
 * everybody who came through onboarding.
 *
 * Two days later rather than immediately: the point is to catch somebody once
 * they have used the app and seen what a match looks like, not to append a
 * fourth form to signup.
 *
 * It re-reads the pet rather than trusting the payload - the same rule as the
 * health reminder. A pet deleted after the job was queued raises nothing, and
 * neither does one whose owner has since filled the fields in.
 */

const PROFILE_NUDGE_JOB = "pet:profile-incomplete";

/** Two days. Judgement, not a sourced number, and marked as such. */
const NUDGE_DELAY_MS = 48 * 60 * 60 * 1000;

/**
 * The fields the short form defers and the matcher scores on.
 *
 * `temperament` is free text; the other two are enums. All three are on
 * `Content`, which `Pet` discriminates.
 */
const DEFERRED_FIELDS = ["temperament", "activityLevel", "socialisation"];

/** Which of them are still empty. */
const missingFields = (pet) =>
  DEFERRED_FIELDS.filter((field) => {
    const value = pet?.[field];
    return value == null || String(value).trim() === "";
  });

scheduler.registerHandler(PROFILE_NUDGE_JOB, async ({ petId }) => {
  const pet = await Pet.findById(petId).select("name owner temperament activityLevel socialisation").lean();
  // Deleted since, or the pet has no owner to tell.
  if (!pet?.owner) return;

  const missing = missingFields(pet);
  // Filled in already, which is the outcome this job exists to produce. The
  // nudge is not a nag: having nothing to ask is a reason to say nothing.
  if (missing.length === 0) return;

  await notify({
    content: `Add ${pet.name}'s temperament and favourite activities - it helps us find better matches.`,
    recipientId: pet.owner,
    type: "petProfileIncomplete",
    petName: pet.name,
    data: { petId: String(pet._id) },
  });
});

/**
 * Queues the nudge for a newly created pet.
 *
 * Called from `createPet` and deliberately not awaited there for its result:
 * a scheduler write must never fail the pet creation that caused it, which is
 * the same rule `notify()`'s push half follows.
 *
 * ponytail: one job per pet, no dedupe. Somebody who adds three pets in a
 * sitting gets three nudges two days later - which is correct, since each one
 * names a different animal and each profile is separately incomplete.
 */
const scheduleNudge = async (pet) => {
  if (!pet?._id) return null;
  // Nothing to ask about: a pet created with the full form already has them.
  if (missingFields(pet).length === 0) return null;

  return scheduler.scheduleIn(
    PROFILE_NUDGE_JOB,
    { petId: String(pet._id) },
    NUDGE_DELAY_MS
  );
};

module.exports = {
  PROFILE_NUDGE_JOB,
  NUDGE_DELAY_MS,
  DEFERRED_FIELDS,
  missingFields,
  scheduleNudge,
};
