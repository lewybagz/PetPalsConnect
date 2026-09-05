import { io } from "socket.io-client";
import { getAuth } from "@react-native-firebase/auth";

import {
  disconnectSocket,
  getSocket,
  joinUserRoom,
  joinedRoom,
  onSocketEvent,
} from "./socket";

const listeners = new Map();
const mockSocket = {
  connected: false,
  emit: jest.fn(),
  connect: jest.fn(() => {
    mockSocket.connected = true;
  }),
  on: jest.fn((event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }),
  off: jest.fn((event, handler) => {
    listeners.set(event, (listeners.get(event) ?? []).filter((h) => h !== handler));
  }),
  disconnect: jest.fn(() => {
    mockSocket.connected = false;
  }),
};

jest.mock("socket.io-client", () => ({ io: jest.fn(() => mockSocket) }));
jest.mock("../config/env", () => ({ API_URL: "https://api.petpals.test" }));

/**
 * The socket layer.
 *
 * It used to be two module-scope calls to `io("http://your-server-address.com")`
 * - a placeholder that shipped - and then, once pointed at the real server, it
 * announced who it was: `emit("join", userId)`, with the server trusting the id.
 * A user id is not a secret, so any connection could name somebody else and
 * receive their messages live.
 *
 * These pin the host, the handshake, and per-listener cleanup. What is *not*
 * here is any assertion that the client picks a room: it no longer can, which
 * is the point.
 */

/** The options object socket.io was constructed with. */
const options = () => io.mock.calls[0][1];

beforeEach(() => {
  disconnectSocket();
  listeners.clear();
  jest.clearAllMocks();
  mockSocket.connected = false;
  getAuth().__setToken("id-token-abc");
});

describe("socket", () => {
  it("connects to the configured API, not a placeholder host", () => {
    getSocket();

    expect(io).toHaveBeenCalledWith("https://api.petpals.test", expect.any(Object));
  });

  it("is created once and shared", () => {
    expect(getSocket()).toBe(getSocket());
    expect(io).toHaveBeenCalledTimes(1);
  });

  it("does not connect before anybody has signed in", () => {
    getSocket();

    // Connecting at module scope means connecting without a token, which the
    // server now refuses outright.
    expect(options().autoConnect).toBe(false);
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("presents a Firebase ID token on the handshake", async () => {
    getSocket();
    const auth = options().auth;

    const sent = await new Promise((resolve) => auth(resolve));

    expect(sent).toEqual({ token: "id-token-abc" });
  });

  it("asks for the token again on every reconnect, not once at startup", async () => {
    getSocket();
    const auth = options().auth;

    await new Promise((resolve) => auth(resolve));
    // A dropped connection can outlive the token's hour; reusing the first one
    // would reconnect into a rejection loop.
    getAuth().__setToken("id-token-refreshed");
    const second = await new Promise((resolve) => auth(resolve));

    expect(second).toEqual({ token: "id-token-refreshed" });
  });

  it("sends no token when nobody is signed in", async () => {
    getAuth().__setToken(null);
    getSocket();

    const sent = await new Promise((resolve) => options().auth(resolve));

    expect(sent).toEqual({ token: null });
  });

  it("connects once somebody is signed in", () => {
    joinUserRoom("507f1f77bcf86cd799439011");

    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it("never tells the server which room to use", () => {
    joinUserRoom("507f1f77bcf86cd799439011");

    // The server derives the room from the verified token. Emitting an id would
    // be the hole this replaced.
    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      "join",
      expect.anything()
    );
  });

  it("does not reconnect for the same user", () => {
    joinUserRoom("user-1");
    mockSocket.connect.mockClear();
    joinUserRoom("user-1");

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("starts a new handshake when the account changes", () => {
    joinUserRoom("user-1");
    mockSocket.disconnect.mockClear();
    mockSocket.connect.mockClear();

    joinUserRoom("user-2");

    // The live connection was authenticated as user-1; it has to be torn down
    // so `auth` runs again with the new account's token.
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it("disconnects on sign-out", () => {
    joinUserRoom("user-1");
    joinUserRoom(null);

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(joinedRoom()).toBeNull();
  });

  it("removes only its own listener", () => {
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = onSocketEvent("message", first);
    onSocketEvent("message", second);
    unsubscribeFirst();

    // `socket.off("message")` with no handler - what the old hooks called -
    // would have taken the second screen's listener with it.
    expect(mockSocket.off).toHaveBeenCalledWith("message", first);
    expect(listeners.get("message")).toEqual([second]);
  });
});
