import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import AccountSuspendedScreen from "./AccountSuspendedScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * What a suspended account sees instead of the app.
 *
 * The API refuses it nearly every route, so the alternative to this screen is
 * the normal tree turning every request into a toast that explains nothing.
 * These pin the three things somebody in this position needs: to know what has
 * happened, to be able to answer it, and to be able to leave.
 */

const session = {
  profile: {
    _id: "me",
    email: "sam@example.test",
    suspended: true,
    suspendedAt: "2026-09-01T10:00:00.000Z",
  },
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  refresh: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue(session);
  api.post.mockResolvedValue({ data: {} });
});

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <AccountSuspendedScreen />
      </ToastProvider>
    </AppThemeProvider>
  );

describe("AccountSuspendedScreen", () => {
  it("says what has happened without saying what they did", async () => {
    await renderScreen();

    expect(screen.getByText("Your account is under review")).toBeTruthy();
  });

  it("never mentions how many people reported the account", async () => {
    await renderScreen();

    // The threshold is three distinct reporters, and three people can be wrong
    // or coordinated. A count is a nudge towards working out who.
    const shown = screen.root ? JSON.stringify(screen.toJSON()) : "";
    expect(shown).not.toMatch(/report(ed|s|ers)/i);
    expect(shown).not.toMatch(/\bthree\b|\b3 people\b/i);
  });

  it("tells them where the answer will arrive", async () => {
    await renderScreen();

    expect(screen.getByText(/sam@example.test/)).toBeTruthy();
  });

  it("offers a way to ask for a review", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-appeal"));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/api/supportmessages");
    // The name and email come from the verified token; sending them from here
    // is how the old support endpoint became a mail relay.
    expect(Object.keys(body)).toEqual(["message"]);
  });

  it("does not let the appeal be sent twice by tapping again", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-appeal"));
    await waitFor(() =>
      expect(screen.getByText("Review requested")).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId("suspended-appeal"));

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("survives the appeal failing, rather than looking sent", async () => {
    api.post.mockRejectedValue(new Error("offline"));
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-appeal"));

    await waitFor(() =>
      expect(screen.getByText("Ask for a review")).toBeTruthy()
    );
  });

  it("lets them re-check without signing out", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-refresh"));

    expect(session.refresh).toHaveBeenCalled();
  });

  it("lets them sign out", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-sign-out"));

    expect(session.signOut).toHaveBeenCalled();
  });

  it("confirms before deleting, and deletes when confirmed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByTestId("suspended-delete"));

    // Permanent and irreversible, so it is one of the few things in the app
    // that still uses a blocking confirmation - and it offers a way out.
    const [, , buttons] = alert.mock.calls[0];
    expect(buttons.some((button) => button.style === "cancel")).toBe(true);

    await buttons.find((button) => button.style === "destructive").onPress();
    expect(session.deleteAccount).toHaveBeenCalled();

    alert.mockRestore();
  });

  it("renders when the suspension has no date on it", async () => {
    useAuthSession.mockReturnValue({
      ...session,
      profile: { _id: "me", email: "sam@example.test", suspended: true },
    });

    await renderScreen();

    expect(screen.getByTestId("account-suspended")).toBeTruthy();
  });
});
