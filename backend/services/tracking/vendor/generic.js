const crypto = require("node:crypto");

/**
 * Any device or vendor cloud that can make an HTTP request.
 *
 * `POST /api/tracking/ingest` with two headers - `x-device-serial` and
 * `x-device-secret` - and a JSON body naming a position. The secret is the
 * one handed to the owner when the collar was claimed; only its hash is
 * stored, and the comparison is constant-time on the hashes.
 *
 * Every refusal is the same 401 with the same words: an unknown serial and a
 * wrong secret must not be distinguishable from outside, or the endpoint is
 * an oracle for which serials exist.
 */

const hashSecret = (secret) => crypto.createHash("sha256").update(String(secret)).digest("hex");

const newSecret = () => crypto.randomBytes(24).toString("base64url");

const secretMatches = (secret, storedHash) => {
  if (typeof secret !== "string" || typeof storedHash !== "string") return false;
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * A sample from whatever the device sent, or null when it is not a position.
 * Accepts `latitude`/`longitude` or `lat`/`lng`, and `recordedAt` as ISO or
 * epoch milliseconds; a missing time is "now", because a device without a
 * clock is still telling us where it is.
 */
const parse = (body = {}) => {
  const latitude = finite(body.latitude ?? body.lat);
  const longitude = finite(body.longitude ?? body.lng ?? body.lon);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  let recordedAt = new Date();
  if (body.recordedAt != null) {
    const parsed = new Date(
      typeof body.recordedAt === "number" ? body.recordedAt : String(body.recordedAt)
    );
    if (Number.isNaN(parsed.getTime())) return null;
    // A clock in the future is a clock that is wrong; clamp rather than store.
    recordedAt = parsed > new Date() ? new Date() : parsed;
  }

  const accuracyMeters = finite(body.accuracyMeters ?? body.accuracy);
  const batteryPercent = finite(body.batteryPercent ?? body.battery);

  return {
    latitude,
    longitude,
    accuracyMeters: accuracyMeters !== null && accuracyMeters >= 0 ? accuracyMeters : undefined,
    batteryPercent:
      batteryPercent !== null ? Math.min(100, Math.max(0, Math.round(batteryPercent))) : undefined,
    recordedAt,
  };
};

module.exports = {
  name: "generic",
  acceptsIngest: true,
  hashSecret,
  newSecret,
  secretMatches,
  parse,
};
