/**
 * Where the app has launched, and how a ZIP code says whether somebody is
 * there.
 *
 * Every dead competitor in the research launched nationally into an empty
 * deck. This app launches in Arizona - the whole state - and everyone else
 * joins a waitlist that records where the next launch should be. The signal
 * is a ZIP code asked once at profile creation: location sharing is optional
 * by design, so the fence cannot depend on it, and a ZIP is also the only
 * thing that tells the waitlist *where* demand is rather than just that it
 * exists.
 *
 * This is the one place the rule is written. `User` derives `region` from it
 * on save, the session reads `region`, and nothing else looks at a prefix.
 */

/** Regions the app is open in. Add a state code here to launch there. */
const LAUNCH_REGIONS = ["AZ"];

/**
 * USPS three-digit ZIP prefixes by state, for the states this file knows.
 * Arizona is 850-865 with gaps (854, 858, 861 and 862 are unassigned), which
 * is why it is a list of ranges and not a regex. 853 is Yuma.
 */
const PREFIXES = {
  AZ: [
    [850, 853],
    [855, 857],
    [859, 860],
    [863, 865],
  ],
};

const ZIP = /^\d{5}$/;

/** True for a five-digit US ZIP. The app asks for nothing else. */
const isValidZip = (value) => typeof value === "string" && ZIP.test(value);

/** The state a ZIP belongs to, for the states this file knows; else "other". */
const regionForZip = (zip) => {
  if (!isValidZip(zip)) return null;
  const prefix = Number(zip.slice(0, 3));
  for (const [state, ranges] of Object.entries(PREFIXES)) {
    if (ranges.some(([from, to]) => prefix >= from && prefix <= to)) return state;
  }
  return "other";
};

/**
 * Whether a profile is inside the launch area.
 *
 * A profile with no region predates the field and is let in - the same
 * "rows before the field exist" rule as `Pet.species`. Only new profiles are
 * fenced.
 */
const isLaunched = (region) => region == null || LAUNCH_REGIONS.includes(region);

module.exports = { LAUNCH_REGIONS, PREFIXES, isValidZip, regionForZip, isLaunched };
