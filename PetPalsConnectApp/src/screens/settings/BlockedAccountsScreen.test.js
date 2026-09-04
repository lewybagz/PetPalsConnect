import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import BlockedAccountsScreen from "./BlockedAccountsScreen";
import { fetchBlocked, unblockUser } from "../../api/safety";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/safety", () => ({
  fetchBlocked: jest.fn(),
  unblockUser: jest.fn(),
}));

/**
 * Seeing and undoing a block.
 *
 * There was no screen for this. Blocking was a menu item with no record and no
 * reverse - which is also the half of it both app stores check for.
 */

const tapById = async (id) => {
  const element = await waitFor(() => screen.getByTestId(id));
  await fireEvent.press(element);
};

const pressAlertButton = (label) => {
  const [, , buttons] = Alert.alert.mock.calls.at(-1);
  return buttons.find((entry) => entry.text === label).onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  fetchBlocked.mockResolvedValue([]);
  unblockUser.mockResolvedValue({});
});

describe("BlockedAccountsScreen", () => {
  it("says so plainly when nobody is blocked", async () => {
    await render(
      <AppThemeProvider>
        <ToastProvider>
          <BlockedAccountsScreen />
        </ToastProvider>
      </AppThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("blocked-empty")).toBeTruthy());
  });

  it("lists who is blocked", async () => {
    fetchBlocked.mockResolvedValue([
      { _id: "b1", blockedUser: { _id: "u1", username: "nuisance" } },
    ]);

    await render(
      <AppThemeProvider>
        <ToastProvider>
          <BlockedAccountsScreen />
        </ToastProvider>
      </AppThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("blocked-u1")).toBeTruthy());
    expect(screen.getByText("nuisance")).toBeTruthy();
  });

  it("unblocks after confirming, and removes the row", async () => {
    fetchBlocked.mockResolvedValue([
      { _id: "b1", blockedUser: { _id: "u1", username: "nuisance" } },
    ]);

    await render(
      <AppThemeProvider>
        <ToastProvider>
          <BlockedAccountsScreen />
        </ToastProvider>
      </AppThemeProvider>
    );
    await tapById("unblock-u1");

    expect(unblockUser).not.toHaveBeenCalled();

    await pressAlertButton("Unblock");

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith("u1"));
    await waitFor(() => expect(screen.queryByTestId("blocked-u1")).toBeNull());
  });

  it("puts the row back when unblocking fails", async () => {
    fetchBlocked.mockResolvedValue([
      { _id: "b1", blockedUser: { _id: "u1", username: "nuisance" } },
    ]);
    unblockUser.mockRejectedValue({ response: { data: { message: "Nope" } } });

    await render(
      <AppThemeProvider>
        <ToastProvider>
          <BlockedAccountsScreen />
        </ToastProvider>
      </AppThemeProvider>
    );
    await tapById("unblock-u1");
    await pressAlertButton("Unblock");

    // Otherwise the list says they are unblocked and the server disagrees.
    await waitFor(() => expect(screen.getByTestId("blocked-u1")).toBeTruthy());
  });

  it("survives a block whose user was deleted", async () => {
    fetchBlocked.mockResolvedValue([{ _id: "b1", blockedUser: null }]);

    await render(
      <AppThemeProvider>
        <ToastProvider>
          <BlockedAccountsScreen />
        </ToastProvider>
      </AppThemeProvider>
    );

    await waitFor(() => expect(screen.getByText("Someone")).toBeTruthy());
  });
});
