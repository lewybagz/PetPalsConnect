const mongoose = require("mongoose");

/**
 * Refuses a route parameter that cannot possibly be a Mongo id.
 *
 * Controllers here catch their own errors and answer `res.status(500).json({
 * message: err.message })`. So a malformed id in a URL produced a 500 carrying
 * Mongoose's own words - `Cast to ObjectId failed for value "search" (type
 * string) at path "_id" for model "User"` - which names the model and the
 * schema path to anyone who asks. The generic error handler masks 500s in
 * production; a controller answering directly walks straight past it.
 *
 * Catching it as a parameter is better than catching it as an error: it never
 * reaches the database, every route gets it without twenty catch blocks being
 * rewritten, and the answer is the honest one. A URL that cannot name a row is
 * a 404, not a server fault.
 *
 * This also quietly removes a way to tell routes apart: `/api/users/search`
 * used to fall through to `GET /:id` and report a cast failure against the User
 * model, which is a map of the schema for the price of a typo.
 */

/**
 * Parameters that name a Mongo document.
 *
 * `placeId` (a Google Places id) and `paymentMethodId` (a Stripe `pm_…`) are
 * deliberately absent - they are ids, but not ours, and validating them as
 * ObjectIds would reject every legitimate value.
 */
const OBJECT_ID_PARAMS = [
  "id",
  "chatId",
  "groupId",
  "locationId",
  "messageId",
  "otherPetId",
  "petId",
  "playdateId",
  "userId",
];

const looksLikeObjectId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value);

/**
 * `router.param` handler. Answers 404 rather than continuing, so nothing
 * downstream has to consider the case.
 */
const rejectMalformed = (req, res, next, value) => {
  if (looksLikeObjectId(value)) return next();

  return res.status(404).json({ message: "Not found", code: "NOT_FOUND" });
};

/** Registers the guard for every id-shaped parameter a router might declare. */
const guardObjectIdParams = (router) => {
  for (const name of OBJECT_ID_PARAMS) router.param(name, rejectMalformed);
  return router;
};

module.exports = {
  guardObjectIdParams,
  rejectMalformed,
  looksLikeObjectId,
  OBJECT_ID_PARAMS,
};
