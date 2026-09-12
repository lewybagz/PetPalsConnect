const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * One weigh-in for one pet.
 *
 * Not a `HealthRecord` kind, because a weight is a *number* and every field on
 * that model is a date - there is nowhere on it to put pounds, and adding one
 * would leave it null on every vaccination row. Not a field on `Pet` either:
 * `Pet.weight` is the current number the matcher compares, and a history is a
 * series. So this is the smallest model that holds a series.
 *
 * `owner` sits beside `pet` for the same reason it does on `HealthRecord`:
 * every read here is scoped to the caller, and a query that had to join
 * through `Pet` to find out whose row this is would be the one that eventually
 * forgets to.
 *
 * **Storage is pounds, always.** Matching compares two pets' numbers, so a
 * stored unit would make two pets incomparable if their owners had chosen
 * differently. `src/utils/units.ts` converts for display, and nothing else.
 */
const WeightEntrySchema = new Schema({
  pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  /** Canonical pounds. The ceiling is a typo guard, not a claim about animals. */
  pounds: { type: Number, required: true, min: 0.1, max: 400 },
  takenAt: { type: Date, required: true },
  /**
   * The 1-9 body condition score, as published by AAHA and WSAVA. Optional,
   * and entered by the owner from the published chart rather than derived
   * from the weight: a score is a hands-on assessment of ribs and waist, and
   * computing one from pounds alone would be inventing a clinical finding.
   *
   * The app shows the chart and the trend. It never names a target score, a
   * target weight or a diet - that is the vet's, and 37% of dogs are above
   * their ideal weight while only 29% have ever been scored by one.
   */
  bodyCondition: { type: Number, min: 1, max: 9 },
  notes: { type: String, maxlength: 500 },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdDate: { type: Date, default: Date.now },
});

// The chart reads one pet's series, newest first.
WeightEntrySchema.index({ pet: 1, takenAt: -1 });

const WeightEntry = mongoose.model("WeightEntry", WeightEntrySchema);

module.exports = WeightEntry;
