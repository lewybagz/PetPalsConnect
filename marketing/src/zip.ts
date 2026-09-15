/**
 * What the waitlist form checks before it sends, and which sentence it shows
 * after.
 *
 * Both checks run again on the server, which is the one that decides; this
 * is so a mistyped address is answered instantly rather than after a round
 * trip. Deliberately loose: the real proof an address exists is mail
 * arriving at it.
 */

export const ZIP = /^\d{5}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Arizona's assigned USPS prefixes: 850-865 with gaps (854, 858, 861 and
 * 862 were never assigned).
 *
 * A copy of the backend's `PREFIXES.AZ`, and deliberately a copy - the site
 * imports nothing from `backend/`, which is the same hard rule the app and
 * the backend hold to each other. It only ever chooses which encouraging
 * sentence to show; the row is already written by then, and the server's
 * answer is the one that counts.
 */
const AZ_PREFIXES: ReadonlyArray<readonly [number, number]> = [
  [850, 853],
  [855, 857],
  [859, 860],
  [863, 865],
];

export const isArizonaZip = (zip: string): boolean => {
  if (!ZIP.test(zip)) return false;
  const prefix = Number(zip.slice(0, 3));
  return AZ_PREFIXES.some(([from, to]) => prefix >= from && prefix <= to);
};
