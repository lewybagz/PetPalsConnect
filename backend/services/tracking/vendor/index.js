const simulator = require("./simulator");
const generic = require("./generic");

/**
 * The hardware boundary.
 *
 * No collar vendor has been chosen, and the software half is built anyway,
 * so the one thing that changes when a vendor is chosen is isolated here: a
 * vendor is a module with `name`, `acceptsIngest`, and either `tick()` (it
 * produces positions on its own) or `authenticate()`/`parse()` (its devices
 * or cloud POST them to `/api/tracking/ingest`). A real OEM is a third file
 * and one line in `VENDORS`.
 *
 * What is deliberately *not* here is a protocol guess. No MQTT client, no
 * LoRa decoder, no BLE pairing: each is a bet on hardware that does not
 * exist, and `generic` is HTTP because every vendor cloud speaks it.
 *
 * `TRACKING_VENDOR` is read at call time, the way `MODERATOR_EMAILS` is, so
 * the suite can turn tracking on and off without reloading the app. Unset
 * means tracking is off: the routes answer 503 and the app shows nothing.
 */
const VENDORS = { simulator, generic };

const current = () => {
  const name = String(process.env.TRACKING_VENDOR ?? "").trim();
  return VENDORS[name] ?? null;
};

const enabled = () => current() !== null;

module.exports = { VENDORS, current, enabled };
