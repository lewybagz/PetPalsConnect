const Device = require("../../models/Device");
const DevicePosition = require("../../models/DevicePosition");
const User = require("../../models/User");
const vendors = require("./vendor");

/**
 * Where a collar is and has been.
 *
 * One read path whichever vendor is configured: positions are rows in
 * `DevicePosition`, written by the ingest route for a vendor that POSTs and
 * by `tick()` for the simulator, which invents one when the last is stale.
 * Reads never care which.
 *
 * Nothing here decides who may look - that is `visibility.canView`, and the
 * controller asks it first.
 */

/** How many points make a trail on the map. */
const TRAIL_LIMIT = 60;

/** Writes one sample and stamps the device as seen. */
const record = async (device, sample) => {
  const row = await DevicePosition.create({
    device: device._id,
    pet: device.pet,
    owner: device.owner,
    point: { type: "Point", coordinates: [sample.longitude, sample.latitude] },
    accuracyMeters: sample.accuracyMeters,
    batteryPercent: sample.batteryPercent,
    recordedAt: sample.recordedAt ?? new Date(),
  });

  const seen = {
    lastSeenAt: row.recordedAt,
    modifiedDate: new Date(),
    ...(sample.batteryPercent != null ? { batteryPercent: sample.batteryPercent } : {}),
  };
  // Only move `lastSeenAt` forward: a late-arriving old sample is history, not news.
  await Device.updateOne(
    { _id: device._id, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lte: row.recordedAt } }] },
    { $set: seen }
  );
  return row;
};

/**
 * For the simulator: makes sure each device has a recent row.
 *
 * A no-op for any vendor that reports its own positions. The owner's last
 * shared position centres the loop when there is one.
 */
const tick = async (devices, { now = Date.now() } = {}) => {
  const vendor = vendors.current();
  if (!vendor || vendor.acceptsIngest) return 0;

  let written = 0;
  for (const device of devices) {
    const latest = await DevicePosition.findOne({ device: device._id })
      .sort({ recordedAt: -1 })
      .select("recordedAt")
      .lean();
    if (latest && now - latest.recordedAt.getTime() < vendor.TICK_MS) continue;

    const owner = await User.findById(device.owner).select("geoLocation").lean();
    const coords = owner?.geoLocation?.coordinates;
    const origin =
      Array.isArray(coords) && coords.length === 2
        ? { longitude: coords[0], latitude: coords[1] }
        : null;

    await record(device, vendor.positionAt(device, origin, now));
    written += 1;
  }
  return written;
};

/** A row as the app reads it: named fields, not GeoJSON order. */
const toSample = (row) =>
  row
    ? {
        latitude: row.point.coordinates[1],
        longitude: row.point.coordinates[0],
        accuracyMeters: row.accuracyMeters ?? null,
        batteryPercent: row.batteryPercent ?? null,
        recordedAt: row.recordedAt,
      }
    : null;

/** The newest position per device, keyed by device id. */
const latestFor = async (devices) => {
  const latest = new Map();
  // ponytail: one query per device. An owner has a handful of pets; switch to
  // an aggregate with $group if a fleet ever reads this.
  for (const device of devices) {
    const row = await DevicePosition.findOne({ device: device._id }).sort({ recordedAt: -1 }).lean();
    latest.set(String(device._id), toSample(row));
  }
  return latest;
};

/** The last hour or so of a device's movement, oldest first. */
const trailFor = async (deviceId, { limit = TRAIL_LIMIT } = {}) => {
  const rows = await DevicePosition.find({ device: deviceId })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .lean();
  return rows.reverse().map(toSample);
};

module.exports = { record, tick, latestFor, trailFor, toSample, TRAIL_LIMIT };
