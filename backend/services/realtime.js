/**
 * The socket.io instance, reachable from services.
 *
 * Controllers can get at it through `req.app.get("io")`, but the code that
 * knows a notification was created is a service with no request in scope. This
 * holds the instance the server built so both can push to the same rooms.
 *
 * Clients join a room named after their Mongo user id (see the "join" handler
 * in Server.js), so `emitToUser` is how anything reaches one person.
 */
let io = null;

const setIO = (instance) => {
  io = instance;
};

const getIO = () => io;

/**
 * Emits an event to one user's room. A no-op when there is no server (tests,
 * scripts) or no user - a failed push must never take down the write that
 * caused it.
 */
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;
  io.to(String(userId)).emit(event, payload);
  return true;
};

/** Emits to several users at once. */
const emitToUsers = (userIds, event, payload) => {
  for (const userId of userIds ?? []) emitToUser(userId, event, payload);
};

module.exports = { setIO, getIO, emitToUser, emitToUsers };
