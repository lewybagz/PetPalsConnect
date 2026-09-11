const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { KINDS, VERIFICATIONS } = require("../services/vaccinations");

/**
 * One vaccination an owner has recorded for one pet.
 *
 * Its own model rather than an array on `Pet`. `Pet` is a `Content`
 * discriminator that every deck query reads whole, and a growing list of
 * dated rows inside it is the wrong shape for that - the reminder sweep wants
 * an index on `expiresAt`, and the deck wants a status per pet without pulling
 * every certificate along with the breed.
 *
 * `owner` is stored as well as `pet`, because every read here is scoped to the
 * caller and a query that has to join through `Pet` to find out whose row this
 * is would be the one that eventually forgets to. Same rule as `Favorite.user`.
 *
 * `verification` names three states and only two can be written today.
 * `selfReported` is what the owner typed; `documented` means a certificate
 * photo is attached; `verified` means a person checked it, and nothing does
 * that yet. Naming it now means the UI never has to pretend `documented` is
 * stronger than it is, and adding real verification later is not a migration.
 */
const HealthRecordSchema = new Schema({
  pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: KINDS, required: true },
  administeredAt: { type: Date, required: true },
  /** When the next dose is due, from the certificate. Optional: not every vaccine has one the owner knows. */
  expiresAt: { type: Date },
  verification: { type: String, enum: VERIFICATIONS, default: "selfReported" },
  /** A photo of the certificate, from our own storage bucket. */
  certificatePhoto: { type: String },
  notes: { type: String, maxlength: 500 },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdDate: { type: Date, default: Date.now },
});

// The reminder sweep and "is this pet current" both ask by pet and kind.
HealthRecordSchema.index({ pet: 1, kind: 1, administeredAt: -1 });

const HealthRecord = mongoose.model("HealthRecord", HealthRecordSchema);

module.exports = HealthRecord;
