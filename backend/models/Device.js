const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * A tracking collar, claimed by its serial and attached to one pet.
 *
 * `owner` comes from `req.userId` when the device is claimed, never from the
 * body, and every read of a device or its positions is scoped by it - the
 * same rule as a pet. `pet` is the animal the collar is on; moving it to
 * another of the owner's pets is an update, not a new row.
 *
 * `ingestSecretHash` is the SHA-256 of a secret handed to the owner exactly
 * once, at claim time, for vendors whose devices (or cloud) POST positions to
 * this server. The plaintext is never stored. `vendor` records which adapter
 * in `services/tracking/vendor/` the device speaks through, so a deployment
 * that changes vendor does not misread rows from the old one.
 */
const STATUSES = ["active", "inactive"];

const DeviceSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
  serial: { type: String, required: true, unique: true, uppercase: true, trim: true },
  vendor: { type: String, required: true },
  ingestSecretHash: { type: String },
  status: { type: String, enum: STATUSES, default: "active" },
  batteryPercent: { type: Number, min: 0, max: 100 },
  lastSeenAt: { type: Date },
  createdDate: { type: Date, default: Date.now },
  modifiedDate: { type: Date, default: Date.now },
});

const Device = mongoose.model("Device", DeviceSchema);

module.exports = Device;
module.exports.STATUSES = STATUSES;
