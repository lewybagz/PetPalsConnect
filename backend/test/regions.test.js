const test = require("node:test");
const assert = require("node:assert/strict");

const { regionForZip, isValidZip, isLaunched, LAUNCH_REGIONS } = require("../services/regions");

/**
 * The launch fence, as a pure function. A wrong prefix here waitlists a real
 * Arizonan, which is the one thing the fence exists not to do.
 */
test("Arizona ZIPs resolve to AZ across every assigned prefix", () => {
  // One from each USPS range: Phoenix, Mesa, Tucson, Flagstaff, Yuma, Kingman.
  for (const zip of ["85001", "85201", "85701", "86001", "85364", "86401"]) {
    assert.equal(regionForZip(zip), "AZ", zip);
  }
});

test("a ZIP outside the known states is 'other', not an error", () => {
  assert.equal(regionForZip("90210"), "other");
  assert.equal(regionForZip("10001"), "other");
  // 854 is unassigned inside Arizona's range; it must not read as AZ by accident.
  assert.equal(regionForZip("85400"), "other");
});

test("anything that is not five digits is refused", () => {
  for (const bad of ["8500", "850011", "ABCDE", "", null, undefined, 85001]) {
    assert.equal(isValidZip(bad), false, String(bad));
    assert.equal(regionForZip(bad), null, String(bad));
  }
});

test("the app mirrors the launch regions exactly", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/api/waitlist.js"),
    "utf8"
  );
  const match = source.match(/export const LAUNCH_REGIONS = \[([^\]]*)\]/);
  assert.ok(match, "the app declares LAUNCH_REGIONS");
  const declared = [...match[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  // The session decides `waitlisted` from this list; a copy that drifts fences
  // the wrong people on one side of the wire.
  assert.deepEqual(declared, LAUNCH_REGIONS);
});

test("the launch area is Arizona, and a profile from before the field is let in", () => {
  assert.deepEqual(LAUNCH_REGIONS, ["AZ"]);
  assert.equal(isLaunched("AZ"), true);
  assert.equal(isLaunched("other"), false);
  assert.equal(isLaunched(undefined), true);
  assert.equal(isLaunched(null), true);
});
