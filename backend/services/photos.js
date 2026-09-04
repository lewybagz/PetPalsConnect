/**
 * What may be stored in a `photos` array.
 *
 * Nothing validated these. `photos` is written straight from the request body
 * and rendered by every screen in the app, so a client could put any URL in
 * there - an arbitrary host, a `javascript:` string, a thousand entries - and
 * every other user's device would fetch it.
 *
 * A photo we serve has to be one we stored.
 */

/** Firebase's own hosts. Anything else did not come from our upload path. */
const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

/** A pet is not a photo album; the app caps at this too. */
const PHOTO_LIMIT = 6;

/** True when a value is a URL to a file in our own storage bucket. */
const isStoredPhoto = (value) => {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.length > 2048) return false;

  try {
    const url = new URL(value);
    // `https:` only - `javascript:` and `data:` URLs have no business here.
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.host);
  } catch {
    return false;
  }
};

/**
 * The photos worth storing from whatever a client sent: ours, unique, capped,
 * order preserved because the first one is the pet's face everywhere.
 */
const sanitisePhotos = (photos) => {
  if (!Array.isArray(photos)) return [];

  const seen = new Set();
  const clean = [];

  for (const photo of photos) {
    if (!isStoredPhoto(photo) || seen.has(photo)) continue;
    seen.add(photo);
    clean.push(photo);
    if (clean.length === PHOTO_LIMIT) break;
  }

  return clean;
};

/** A single photo field (a user's `userPhoto`), or undefined if unusable. */
const sanitisePhoto = (photo) => (isStoredPhoto(photo) ? photo : undefined);

module.exports = { PHOTO_LIMIT, isStoredPhoto, sanitisePhotos, sanitisePhoto };
