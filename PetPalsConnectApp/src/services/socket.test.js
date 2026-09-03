import { io } from "socket.io-client";

import {
  disconnectSocket,
  getSocket,
  joinUserRoom,
  joinedRoom,
  onSocketEvent,
} from "./socket";

const listeners = new Map();
const mockSocket = {
  connected: true,
  emit: jest.fn(),
  on: jest.fn((event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }),
  off: jest.fn((event, handler) => {
    listeners.set(event, (listeners.get(event) ?? []).filter((h) => h !== handler));
  }),
  disconnect: jest.fn(),
};

jest.mock("socket.io-client", () => ({ io: jest.fn(() => mockSocket) }));
jest.mock("../config/env", () => ({ API_URL: "https://api.petpals.test" }));

/**
 * The socket layer used to be two module-scope calls to
 * `io("http://your-server-address.com")` - a placeholder that shipped. These
 * pin the three things that were wrong: the host, the room, and per-listener
 * cleanup.
 */

beforeEach(() => {
  disconnectSocket();
  listeners.clear();
  jest.clearAllMocks();
  mockSocket.connected = true;
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

  it("joins the user's room, which is how the server addresses them", () => {
    joinUserRoom("507f1f77bcf86cd799439011");

    expect(mockSocket.emit).toHaveBeenCalledWith("join", "507f1f77bcf86cd799439011");
  });

  it("rejoins after a reconnect", () => {
    joinUserRoom("user-1");
    mockSocket.emit.mockClear();

    // A reconnect is a new server-side session; without this the socket goes
    // quiet after the first network blip.
    listeners.get("connect")?.forEach((handler) => handler());

    expect(mockSocket.emit).toHaveBeenCalledWith("join", "user-1");
  });

  it("does not re-emit join for the same user", () => {
    joinUserRoom("user-1");
    mockSocket.emit.mockClear();
    joinUserRoom("user-1");

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("leaves the room on sign-out", () => {
    joinUserRoom("user-1");
    joinUserRoom(null);

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

  it("queues the join until the socket connects", () => {
    mockSocket.connected = false;
    joinUserRoom("user-2");

    expect(mockSocket.emit).not.toHaveBeenCalledWith("join", "user-2");

    mockSocket.connected = true;
    listeners.get("connect")?.forEach((handler) => handler());

    expect(mockSocket.emit).toHaveBeenCalledWith("join", "user-2");
  });
});
