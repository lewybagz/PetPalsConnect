import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import FirstRunScreen from "./FirstRunScreen";
import { AuthSessionContext } from "../../context/AuthSessionContext";
import { requestPushPermission } from "../../services/pushPermission";

jest.mock("../../services/pushPermission", () => ({
  requestPushPermission: jest.fn(),
}));

/**
 * The screen between finishing setup and the app.
 *
 * What matters here is that the permission is asked from a button press
 * rather than a mount effect - asking on mount is the bug this screen was
 * built to fix, and it would be an easy one to reintroduce - and that the
 * intro ends however the person answered.
 */
const session = (overrides = {}) => ({
  status: "needsIntro",
  profile: { _id: "u1", pets: [{ _id: "p1", name: "Rex", species: "dog" }] },
  hasPet: true,
  hasDog: true,
  finishIntro: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderScreen = (value) =>
  render(
    <AuthSessionContext.Provider value={value}>
      <FirstRunScreen />
    </AuthSessionContext.Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  requestPushPermission.mockResolvedValue("granted");
});

describe("FirstRunScreen", () => {
  it("does not ask for notifications on mount", async () => {
    const value = session();
    await renderScreen(value);

    // The whole point. `usePushNotifications` used to prompt from an effect
    // the instant the session went ready, and on iOS that prompt is spent
    // permanently the first time it is shown.
    expect(requestPushPermission).not.toHaveBeenCalled();
    expect(value.finishIntro).not.toHaveBeenCalled();
  });

  it("names the pet and offers the deck to a dog owner", async () => {
    await renderScreen(session());

    expect(await screen.findByText(/Rex is all set/)).toBeTruthy();
    expect(screen.getByText("Find a playmate")).toBeTruthy();
    expect(screen.getByText("Start swiping")).toBeTruthy();
  });

  it("offers the care hub instead when there is no dog", async () => {
    await renderScreen(
      session({
        hasDog: false,
        profile: { _id: "u2", pets: [{ _id: "p2", name: "Mittens", species: "cat" }] },
      })
    );

    // Sending a cat owner to a deck they cannot swipe is the empty state this
    // screen exists to avoid.
    expect(screen.getByText("Everything for your pets")).toBeTruthy();
    expect(screen.getByText("Go to my pets")).toBeTruthy();
    expect(screen.queryByText("Find a playmate")).toBeNull();
  });

  it("asks for notifications on the button, then ends the intro", async () => {
    const value = session();
    await renderScreen(value);

    await fireEvent.press(screen.getByTestId("first-run-continue"));

    await waitFor(() => expect(requestPushPermission).toHaveBeenCalledTimes(1));
    expect(requestPushPermission).toHaveBeenCalledWith({ petName: "Rex" });
    await waitFor(() => expect(value.finishIntro).toHaveBeenCalledTimes(1));
  });

  it("ends the intro even when the permission is refused", async () => {
    requestPushPermission.mockResolvedValue("postponed");
    const value = session();
    await renderScreen(value);

    await fireEvent.press(screen.getByTestId("first-run-continue"));

    // A refusal is an answer. Re-showing this screen would make it a nag.
    await waitFor(() => expect(value.finishIntro).toHaveBeenCalledTimes(1));
  });

  it("ends the intro even when asking throws", async () => {
    requestPushPermission.mockRejectedValue(new Error("no native module"));
    const value = session();
    await renderScreen(value);

    await fireEvent.press(screen.getByTestId("first-run-continue"));

    // Trapping somebody on the welcome screen because a permission call blew
    // up would be the worst possible failure here.
    await waitFor(() => expect(value.finishIntro).toHaveBeenCalledTimes(1));
  });

  it("works for somebody who skipped adding a pet", async () => {
    await renderScreen(session({ hasPet: false, hasDog: false, profile: { _id: "u3", pets: [] } }));

    expect(screen.getByText(/You’re all set/)).toBeTruthy();
    expect(screen.getByText("Go to my pets")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("first-run-continue"));
    await waitFor(() =>
      expect(requestPushPermission).toHaveBeenCalledWith({ petName: null })
    );
  });
});
