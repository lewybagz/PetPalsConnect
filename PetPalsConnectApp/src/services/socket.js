import { io } from "socket.io-client";
import { getAuth } from "@react-native-firebase/auth";

import { API_URL } from "../config/env";

/**
 * The app's one socket connection.
 *
 * Both socket hooks previously did `io("http://your-server-address.com")` at
 * module scope - a placeholder domain that was never replaced. So the app
 * opened two connections, to a host that is not ours, and no message,
 * notification or friend request ever arrived. Four screens depend on this.
 *
 * Two things beyond the URL were also missing:
 *
 * - the server targets rooms named after the Mongo user id (`socket.on("join")`
 *   in Server.js), and nothing ever emitted "join", so even a correct URL would
 *   have delivered nothing;
 * - connecting at module scope means connecting before sign-in, and never
 *   re-joining when the account changes.
 *
 * One lazily-created socket, authenticated on the handshake, fixes all three.
 *
 * It used to announce itself instead: `socket.emit("join", userId)`, with the
 * server trusting whatever id arrived. A user id is not a secret - it comes
 * back on a pet's owner and on chat participants - so any connection could name
 * somebody else and receive their messages and notifications live. The token
 * goes on the handshake now and the server derives the room from it; there is
 * nothing left for this file to claim.
 */

let socket = null;
let joinedUserId = null;

/**
 * The shared socket, created on first use.
 *
 * `auth` is a function rather than a value because socket.io calls it again on
 * every reconnect. A dropped connection can outlive the ID token's hour, and a
 * stale token would reconnect into a rejection loop; asking Firebase each time
 * gets a fresh one, which it refreshes silently when needed.
 */
export const getSocket = () => {
  if (!socket) {
    socket = io(API_URL, {
      // The default is a long-poll upgrade dance that React Native does not
      // need; websockets connect faster and reconnect more predictably.
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      auth: async (cb) => {
        const user = getAuth().currentUser;
        cb({ token: user ? await user.getIdToken() : null });
      },
    });
  }
  return socket;
};

/**
 * Connects this device's socket, now that somebody is signed in.
 *
 * Keeps the old name and shape so the hooks did not change, but there is no
 * room to ask for any more: the server reads it off the verified token. Passing
 * null (sign-out) disconnects, which is what stops delivery.
 */
export const joinUserRoom = (userId) => {
  if (userId === joinedUserId) return;

  joinedUserId = userId ?? null;

  if (!joinedUserId) {
    if (socket) socket.disconnect();
    return;
  }

  const active = getSocket();
  // A reconnect re-runs `auth`, so switching accounts has to start a new
  // handshake rather than reuse the one belonging to the previous token.
  if (active.connected) active.disconnect();
  active.connect();
};

/**
 * Subscribes to an event. Returns an unsubscribe function, so callers cannot
 * accidentally remove another listener for the same event - which
 * `socket.off("notification")` did, since it removes *all* handlers.
 */
export const onSocketEvent = (event, handler) => {
  const active = getSocket();
  active.on(event, handler);
  return () => active.off(event, handler);
};

/** Closes the connection. Used on sign-out and by tests. */
export const disconnectSocket = () => {
  joinedUserId = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/** Test seam: the id whose room this connection has joined. */
export const joinedRoom = () => joinedUserId;
