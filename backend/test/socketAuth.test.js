const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let User;
let authenticateSocket;
let joinOwnRoom;
let tokenFrom;

/**
 * Who a realtime connection is allowed to be.
 *
 * The server addressed rooms named after a Mongo user id and learned that id
 * from the client:
 *
 *     socket.on("join", (userId) => { if (userId) socket.join(String(userId)); });
 *
 * Nothing verified the connection. A user id is not a secret - it comes back on
 * a pet's `owner` and on chat participants - so anybody who could open a socket
 * could name somebody else and start receiving their `message`,
 * `notification`, `friendRequest` and `petMatch` events as they happened,
 * private message text included. Every REST read here is filtered by
 * `req.userId`; one line of realtime code handed the same data out for free.
 *
 * These are the rules that replaced it: prove who you are on the handshake, and
 * the room is derived from that and never from anything you say.
 */
test.before(async () => {
  await harness.start();
  User = require("../models/User");
  ({ authenticateSocket, joinOwnRoom, tokenFrom } = require("../services/socketRooms"));
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const makeUser = (uid) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });

/** A stand-in for the socket.io socket the middleware is handed. */
const fakeSocket = (handshake) => ({ handshake, data: {}, joined: [],
  join(room) { this.joined.push(room); } });

/** Runs the handshake middleware and reports what happened. */
const handshake = (socket) =>
  new Promise((resolve) => {
    authenticateSocket(socket, (error) => resolve(error ?? null));
  });

test("a connection with no token is refused", async () => {
  const socket = fakeSocket({ auth: {} });

  const error = await handshake(socket);

  assert.ok(error, "an unauthenticated socket must not be admitted");
  assert.equal(socket.data.userId, undefined);
});

test("a connection with a junk token is refused", async () => {
  const error = await handshake(fakeSocket({ auth: { token: "not-a-real-token" } }));

  assert.ok(error);
});

test("a valid token is admitted and carries its own identity", async () => {
  const user = await makeUser("owner");
  const socket = fakeSocket({ auth: { token: harness.issueToken("owner") } });

  const error = await handshake(socket);

  assert.equal(error, null);
  assert.equal(socket.data.userId, String(user._id));
});

test("the room comes from the token, not from anything the client sends", async () => {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");

  const socket = fakeSocket({ auth: { token: harness.issueToken("stranger") } });
  await handshake(socket);

  // The old `join` handler would have put this connection in the owner's room
  // for the asking. There is no longer anything to ask with.
  joinOwnRoom(socket);

  assert.deepEqual(socket.joined, [String(stranger._id)]);
  assert.ok(
    !socket.joined.includes(String(owner._id)),
    "a socket must never reach a room it did not authenticate as"
  );
});

test("an account with no profile yet cannot subscribe to anything", async () => {
  // Signed in with Firebase but no Mongo profile: there is no room to be in,
  // and admitting the connection would only give it somewhere to guess from.
  const error = await handshake(
    fakeSocket({ auth: { token: harness.issueToken("newcomer") } })
  );

  assert.ok(error);
});

test("a suspended account is refused the socket entirely", async () => {
  const user = await makeUser("nuisance");
  await User.findByIdAndUpdate(user._id, { suspended: true });

  const error = await handshake(
    fakeSocket({ auth: { token: harness.issueToken("nuisance") } })
  );

  // Everything a socket delivers involves somebody else, so unlike HTTP there
  // is no subset worth keeping open.
  assert.ok(error);
});

test("a revoked session cannot open a socket", async () => {
  await makeUser("compromised");
  harness.revokeTokens("compromised");

  const error = await handshake(
    fakeSocket({ auth: { token: harness.issueToken("compromised") } })
  );

  assert.ok(error);
});

test("the refusal says the same thing however it failed", async () => {
  await makeUser("real");
  await User.findByIdAndUpdate((await User.findOne({ firebaseUid: "real" }))._id, {
    suspended: true,
  });

  const suspended = await handshake(
    fakeSocket({ auth: { token: harness.issueToken("real") } })
  );
  const nonsense = await handshake(fakeSocket({ auth: { token: "garbage" } }));

  // "Suspended" and "no such account" must not be distinguishable from
  // outside, or the socket becomes an oracle for which accounts exist.
  assert.equal(suspended.message, nonsense.message);
});

test("a token may arrive as a header as well as handshake auth", async () => {
  const user = await makeUser("owner");

  const socket = fakeSocket({
    headers: { authorization: `Bearer ${harness.issueToken("owner")}` },
  });
  const error = await handshake(socket);

  assert.equal(error, null);
  assert.equal(socket.data.userId, String(user._id));
});

test("tokenFrom ignores a header that is not a bearer token", () => {
  assert.equal(tokenFrom({ headers: { authorization: "Basic abc123" } }), null);
  assert.equal(tokenFrom({}), null);
});
