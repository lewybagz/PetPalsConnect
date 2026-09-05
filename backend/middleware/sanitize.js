/**
 * Strips MongoDB query operators out of anything the client sends.
 *
 * Mongoose casts values against the schema, which stops most of this - a `$ne`
 * object where a string is expected fails to cast. It is not a guarantee
 * though: a field typed loosely, a `Mixed` path, or a query built by spreading
 * request data all take the object as written. `{"username": {"$ne": null}}` in
 * a body is a filter, not a username.
 *
 * The rule is narrow on purpose. A key starting with `$` is an operator, and a
 * key containing `.` is a path traversal into a nested document; neither is
 * ever a legitimate field name in this API. Values are untouched - a message
 * that happens to contain a dollar sign is just a message.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** `$` starts an operator; `.` reaches into a subdocument. */
const isDangerousKey = (key) => key.startsWith("$") || key.includes(".");

/**
 * Removes dangerous keys in place, depth-first.
 *
 * In place because the objects are already attached to the request, and
 * rebuilding them would drop anything else Express has hung off them. Returns
 * the number of keys removed so the caller can log an attempt rather than
 * swallow it silently.
 */
const scrub = (value, depth = 0) => {
  // A body can nest arbitrarily; a bounded walk cannot be turned into a stack
  // overflow by a hostile payload.
  if (depth > 12 || !isPlainObject(value)) {
    if (Array.isArray(value) && depth <= 12) {
      return value.reduce((n, entry) => n + scrub(entry, depth + 1), 0);
    }
    return 0;
  }

  let removed = 0;
  for (const key of Object.keys(value)) {
    if (isDangerousKey(key)) {
      delete value[key];
      removed += 1;
      continue;
    }
    removed += scrub(value[key], depth + 1);
  }
  return removed;
};

/**
 * Express 5 exposes `req.query` through a getter, so it cannot simply be
 * assigned. Scrubbing the object it hands back works when that object is
 * cached; defining an own property over the top covers the case where it is
 * not, and keeps every later reader on the cleaned copy.
 */
const sanitizeQuery = (req) => {
  const query = req.query;
  if (!isPlainObject(query)) return 0;

  const removed = scrub(query);
  if (removed > 0) {
    Object.defineProperty(req, "query", {
      value: query,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  return removed;
};

const sanitize = (req, res, next) => {
  const removed = scrub(req.body) + sanitizeQuery(req);

  if (removed > 0) {
    // Worth a line in the log: legitimate clients never send these, so this is
    // somebody probing rather than a mistake.
    console.warn(
      `[sanitize] Dropped ${removed} operator key(s) from ${req.method} ${req.originalUrl}`
    );
  }

  return next();
};

module.exports = sanitize;
module.exports.scrub = scrub;
module.exports.isDangerousKey = isDangerousKey;
