import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import CreateProfileScreen from "./CreateProfileScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));

/**
 * Every new profile passes through this screen - email, phone, Apple and
 * Google alike - so it is where the app asks the one question the Terms
 * depend on: that the person is 18 or older and agrees. The server refuses a
 * profile without the answer; this checks the app never sends one.
 */
const session = {
  firebaseUser: { displayName: "Sam", email: "sam@example.test" },
  createProfile: jest.fn(async () => ({})),
  signOut: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue(session);
  api.get.mockResolvedValue({ data: { available: true } });
});

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <CreateProfileScreen />
    </AppThemeProvider>
  );

const fillIn = async () => {
  await fireEvent.changeText(screen.getByPlaceholderText("username"), "sammy");
  await fireEvent.changeText(screen.getByPlaceholderText(/zip/i), "85004");
  // The availability check is debounced, and Continue waits on it.
  await waitFor(() => expect(api.get).toHaveBeenCalled(), { timeout: 3000 });
};

describe("CreateProfileScreen", () => {
  it("will not create a profile until the person confirms they are 18 and agree", async () => {
    await renderScreen();
    await fillIn();

    await fireEvent.press(screen.getByText("Continue"));
    expect(session.createProfile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("accept-terms"));
    await waitFor(() =>
      expect(screen.getByTestId("accept-terms").props.accessibilityState.checked).toBe(true)
    );
    await fireEvent.press(screen.getByText("Continue"));

    await waitFor(() => expect(session.createProfile).toHaveBeenCalledTimes(1));
    expect(session.createProfile).toHaveBeenCalledWith({
      username: "sammy",
      zip: "85004",
      acceptedTerms: true,
    });
  });

  it("names the age and both documents in the confirmation", async () => {
    await renderScreen();
    expect(screen.getByText(/18 or older/i)).toBeTruthy();
    expect(screen.getByText("Terms of Service")).toBeTruthy();
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
  });
});

/**
 * The suggested username.
 *
 * Google and email both give the screen something to suggest, and where it is
 * free there is no question left to ask - so the field arrives answered. The
 * risk is the two ways that can go wrong: accepting a name that is actually
 * taken (which moves the failure to submit), and taking the choice away from
 * somebody who wanted to make it.
 */
describe("the suggested username", () => {
  it("is accepted for the user when it is free", async () => {
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId("profile-username-suggested")).toBeTruthy()
    );
    expect(screen.getByText("@Sam")).toBeTruthy();
    // One field fewer on the screen that decides whether they ever finish.
    expect(screen.queryByTestId("profile-username")).toBeNull();
  });

  it("can still be changed", async () => {
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId("profile-username-suggested")).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId("profile-username-edit"));

    expect(screen.getByTestId("profile-username")).toBeTruthy();
    expect(screen.queryByTestId("profile-username-suggested")).toBeNull();
  });

  it("is not accepted when the name is taken", async () => {
    api.get.mockResolvedValue({ data: { available: false, reason: "Already taken." } });

    await renderScreen();

    // Accepting a taken name silently would move the failure to submit,
    // which is worse than asking.
    await waitFor(() => expect(screen.getByTestId("profile-username")).toBeTruthy());
    expect(screen.queryByTestId("profile-username-suggested")).toBeNull();
  });

  it("is not accepted when there is nothing to suggest", async () => {
    useAuthSession.mockReturnValue({ ...session, firebaseUser: { email: "a@b.test" } });

    await renderScreen();

    // "a" is under the three-character minimum, so there is a real question.
    await waitFor(() => expect(screen.getByTestId("profile-username")).toBeTruthy());
  });
});
