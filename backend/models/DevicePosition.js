const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * One position a collar reported.
 *
 * The most sensitive data this app holds: a continuous record of where an
 * animal - and so usually its owner - has been. Two things follow. Every read
 * goes through `services/tracking/visibility.js`, which is the one place that
 * answers who may see it. And the rows expire: a TTL index on `recordedAt`
 * removes anything older than `RETENTION_DAYS`, because the honest amount of
 * history to keep is the least that makes the feature work.
 *
 * `owner` is denormalised beside `pet` and `device` so account deletion and
 * every scoped read need no join, the same reason `HealthRecord` carries it.
 *
 * `point` is a GeoJSON sub-schema with `default: undefined`, the pattern
 * `Location` uses: written inline, the `type: "Point"` default materialises
 * on every document and a 2dsphere index rejects a Point with no coordinates.
 */
const RETENTION_DAYS = 30;

const PointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    // GeoJSON order: [longitude, latitude].
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const DevicePositionSchema = new Schema({
  device: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
  pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  point: { type: PointSchema, required: true, default: undefined },
  accuracyMeters: { type: Number, min: 0 },
  batteryPercent: { type: Number, min: 0, max: 100 },
  recordedAt: {
    type: Date,
    required: true,
    default: Date.now,
    // Mongo removes the row itself once it is this old.
    expires: RETENTION_DAYS * 24 * 60 * 60,
  },
});

DevicePositionSchema.index({ device: 1, recordedAt: -1 });
DevicePositionSchema.index({ point: "2dsphere" });

const DevicePosition = mongoose.model("DevicePosition", DevicePositionSchema);

module.exports = DevicePosition;
module.exports.RETENTION_DAYS = RETENTION_DAYS;
