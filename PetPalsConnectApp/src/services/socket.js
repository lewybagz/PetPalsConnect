import { io } from "socket.io-client";

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
 * One lazily-created socket, joined to the current user's room and re-joined on
 * reconnect, fixes all three.
 */

let socket = null;
let joinedUserId = null;

/** The shared socket, created on first use. */
export const getSocket = () => {
  if (!socket) {
    socket = io(API_URL, {
      // The default is a long-poll upgrade dance that React Native does not
      // need; websockets connect faster and reconnect more predictably.
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });

    // A reconnect starts a new session server-side, so the room must be
    // re-joined or the socket goes quiet after the first network blip.
    socket.on("connect", () => {
      if (joinedUserId) socket.emit("join", joinedUserId);
    });
  }
  return socket;
};

/**
 * Puts this connection in a user's room so the server can reach them.
 * Passing null (sign-out) leaves the room and stops further delivery.
 */
export const joinUserRoom = (userId) => {
  if (userId === joinedUserId) return;

  joinedUserId = userId ?? null;
  if (!joinedUserId) return;

  const active = getSocket();
  if (active.connected) active.emit("join", joinedUserId);
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
