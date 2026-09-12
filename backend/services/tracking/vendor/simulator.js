/**
 * A collar that does not exist, walking a slow loop.
 *
 * Lets the whole tracking half be developed, tested and screenshotted with
 * no hardware and no vendor account. Deterministic on purpose: the position
 * is a function of the serial and the clock, so a test can say what it will
 * be, and two reads a minute apart differ the way a real device's would.
 *
 * The loop is centred on the owner's last shared position when there is one
 * - so a developer's simulated dog is in their own neighbourhood - and on
 * central Phoenix otherwise, which is where the app launches.
 */

const PHOENIX = { latitude: 33.4484, longitude: -112.074 };

/** Roughly 300 m, in degrees of latitude. */
const RADIUS_DEG = 0.003;

/** One lap every twenty minutes. */
const LAP_MS = 20 * 60 * 1000;

/** How stale the last row may be before a read writes a fresh one. */
const TICK_MS = 30 * 1000;

/** A small stable number from a serial, so two collars do not overlap. */
const hashOf = (text) => {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
};

/** Where the simulated collar is at `now`. Pure. */
const positionAt = (device, origin, now = Date.now()) => {
  const seed = hashOf(device.serial);
  const phase = (seed % 360) * (Math.PI / 180);
  const angle = phase + ((now % LAP_MS) / LAP_MS) * 2 * Math.PI;
  const centre = origin ?? PHOENIX;
  const latitude = centre.latitude + RADIUS_DEG * Math.sin(angle);
  const longitude =
    centre.longitude +
    (RADIUS_DEG * Math.cos(angle)) / Math.cos((centre.latitude * Math.PI) / 180);

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    accuracyMeters: 8,
    // Drains one percent an hour from wherever the serial starts it.
    batteryPercent: 100 - ((Math.floor(now / 3_600_000) + seed) % 100),
    recordedAt: new Date(now),
  };
};

module.exports = {
  name: "simulator",
  acceptsIngest: false,
  TICK_MS,
  PHOENIX,
  positionAt,
};
