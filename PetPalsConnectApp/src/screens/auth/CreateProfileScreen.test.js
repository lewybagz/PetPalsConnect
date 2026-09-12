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
