const { resolveCaller } = require("./callerIdentity");

/**
 * Who a realtime connection is, and which room it may hear.
 *
 * The server addresses rooms named after a Mongo user id, and it used to learn
 * that id from the client:
 *
 *     socket.on("join", (userId) => { if (userId) socket.join(String(userId)); });
 *
 * Nothing verified the connection or the id. A user id is not a secret - it
 * comes back on a pet's `owner`, on chat participants, on a match - so anyone
 * who could open a socket could name somebody else's id and start receiving
 * their `message`, `notification`, `friendRequest` and `petMatch` events as
 * they happened, private message text included. Every REST read in this
 * codebase is filtered by `req.userId`; realtime undid that in one line.
 *
 * The room is now derived from a verified token and never from anything the
 * client says, which is the same rule the HTTP side already follows: a resource
 * id is not an identity.
 */

/**
 * The only thing a rejected connection is ever told.
 *
 * Built fresh each time because socket.io may attach its own properties to the
 * error it is handed.
 */
const refusal = () => new Error("Not authorised");

/** Where a client may present its token on the handshake. */
const tokenFrom = (handshake = {}) => {
  const fromAuth = handshake.auth?.token;
  if (fromAuth) return String(fromAuth);

  // Some clients cannot set handshake auth; the standard header is accepted too.
  const header = handshake.headers?.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
};

/**
 * Socket.IO handshake middleware.
 *
 * Rejects the connection outright rather than admitting it and hoping it
 * behaves - a socket that cannot say who it is has nothing it may subscribe to.
 * A suspended account is refused for the same reason it is refused nearly
 * everything over HTTP: every event it could receive involves somebody else.
 */
const authenticateSocket = async (socket, next) => {
  try {
    const { user, suspended } = await resolveCaller(tokenFrom(socket.handshake));

    // One refusal, whatever the reason. A socket that answered "suspended" for
    // one account and "no such account" for another would be an oracle for
    // which accounts exist and which are in trouble - and the client has the
    // same nothing to do about it either way.
    if (!user || suspended) return next(refusal());

    socket.data.userId = String(user._id);
    return next();
  } catch {
    return next(refusal());
  }
};

/**
 * Puts an authenticated socket in its own room.
 *
 * There is no `join` event any more. The one thing the client used to control
 * is now the one thing it cannot.
 */
const joinOwnRoom = (socket) => {
  const room = socket.data?.userId;
  if (room) socket.join(room);
  return room ?? null;
};

module.exports = { authenticateSocket, joinOwnRoom, tokenFrom };
