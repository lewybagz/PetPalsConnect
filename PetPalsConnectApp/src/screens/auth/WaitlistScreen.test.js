import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import WaitlistScreen from "./WaitlistScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The first thing somebody outside Arizona sees. It has to say why, take one
 * tap to be told when it opens, and let them through to their pets.
 */

const continueAnyway = jest.fn();
const signOut = jest.fn();

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <WaitlistScreen />
      </ToastProvider>
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({
    profile: { _id: "u1", email: "la@example.test", zip: "90210", region: "other" },
    continueAnyway,
    signOut,
  });
  api.get.mockResolvedValue({ data: { joined: false, since: null } });
  api.post.mockResolvedValue({ data: { joined: true, since: "2026-09-10T00:00:00.000Z" } });
});

describe("WaitlistScreen", () => {
  it("says where the app is open and names the ZIP it was given", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("waitlist")).toBeTruthy());
    expect(screen.getByText(/open in Arizona/)).toBeTruthy();
    expect(screen.getByText(/90210 is on the list/)).toBeTruthy();
  });

  it("joins with one tap and nothing typed - the email is on the account", async () => {
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("waitlist-join")));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/waitlist"));
    await waitFor(() => expect(screen.getByText("You're on the list")).toBeTruthy());
  });

  it("does not ask somebody who already joined to join again", async () => {
    api.get.mockResolvedValue({ data: { joined: true, since: "2026-09-01T00:00:00.000Z" } });
    await renderScreen();

    await waitFor(() => expect(screen.getByText("You're on the list")).toBeTruthy());
  });

  it("lets them through to their pets", async () => {
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("waitlist-continue")));

    expect(continueAnyway).toHaveBeenCalled();
  });
});
