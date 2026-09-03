import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";

import useUsernameAvailability from "./useUsernameAvailability";
import api from "../api/axios";

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const DELAY = 10;

/**
 * The hook is driven through a probe component rather than `renderHook`, which
 * does not return a usable result in this React 19 / RTL combination.
 */
const Probe = ({ username }) => {
  const state = useUsernameAvailability(username, { delay: DELAY });
  return (
    <>
      <Text testID="status">{state.status}</Text>
      <Text testID="reason">{state.reason ?? "-"}</Text>
    </>
  );
};

const renderProbe = (username) => {
  render(<Probe username={username} />);
};

const status = () => screen.getByTestId("status").props.children;
const reason = () => screen.getByTestId("reason").props.children;

describe("useUsernameAvailability", () => {
  it("stays idle for an empty username and asks the server nothing", async () => {
    renderProbe("");

    await waitFor(() => expect(status()).toBe("idle"));
    await new Promise((resolve) => setTimeout(resolve, DELAY * 3));
    expect(api.get).not.toHaveBeenCalled();
  });

  it("reports available when the server says so", async () => {
    api.get.mockResolvedValue({ data: { available: true, reason: null } });

    renderProbe("freshname");

    await waitFor(() => expect(status()).toBe("available"));
  });

  it("reports unavailable with the server's reason", async () => {
    api.get.mockResolvedValue({
      data: { available: false, reason: "That username is already taken." },
    });

    renderProbe("taken");

    await waitFor(() => expect(status()).toBe("unavailable"));
    // The server owns the rules, so the app shows its wording rather than
    // duplicating the logic and risking disagreement.
    expect(reason()).toMatch(/already taken/);
  });

  it("shows a checking state while in flight", async () => {
    api.get.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { available: true } }), 50))
    );

    renderProbe("pending");

    await waitFor(() => expect(status()).toBe("checking"));
  });

  it("fires one request per settled input, not one per render", async () => {
    api.get.mockResolvedValue({ data: { available: true } });

    renderProbe("petlover");
    await waitFor(() => expect(status()).toBe("available"));

    // The component re-renders as the status moves idle -> checking ->
    // available; the debounce must not turn that into three requests.
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  // Not covered: debouncing across successive keystrokes, and the request-id
  // guard that stops a slow earlier response overwriting a newer one. Both need
  // to re-render with new props, and neither the value returned by `render` nor
  // `screen.rerender` is usable in this RTL build. The behaviour is exercised by
  // hand; automating it needs the RTL/React 19 interop sorted out first.

  it("does not block the user when the check itself fails", async () => {
    // Offline should not prevent submitting; the unique index is the final word.
    api.get.mockRejectedValue(new Error("offline"));

    renderProbe("whatever");

    await waitFor(() => expect(status()).toBe("unknown"), { timeout: 2000 });
  });

  it("trims whitespace before asking", async () => {
    api.get.mockResolvedValue({ data: { available: true } });

    renderProbe("  spaced  ");

    await waitFor(() => expect(api.get).toHaveBeenCalled(), { timeout: 2000 });
    expect(api.get.mock.calls[0][1].params.username).toBe("spaced");
  });
});
