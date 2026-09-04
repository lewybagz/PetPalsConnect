import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import SafetyMenu from "./SafetyMenu";
import { blockUser } from "../api/safety";
import { AppThemeProvider } from "../context/AppThemeContext";
import { ToastProvider } from "./ui";

jest.mock("../api/safety", () => ({ blockUser: jest.fn() }));

/**
 * The overflow menu that puts block and report on the screens where people
 * actually meet strangers.
 *
 * Before this, both lived only on a card component nothing rendered and on a
 * swipe card, and neither Discover nor Chat had either one.
 */

const navigation = { navigate: jest.fn() };

/** With the toast host, because failures report through it now. */
const renderMenu = (ui) =>
  render(
    <AppThemeProvider>
      <ToastProvider>{ui}</ToastProvider>
    </AppThemeProvider>
  );

const tapById = async (id) => {
  const element = await waitFor(() => screen.getByTestId(id));
  await fireEvent.press(element);
};

/** Presses the button with `label` in the last Alert shown. */
const pressAlertButton = (label) => {
  const [, , buttons] = Alert.alert.mock.calls.at(-1);
  const button = buttons.find((entry) => entry.text === label);
  return button.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  blockUser.mockResolvedValue({});
});

describe("SafetyMenu", () => {
  it("renders nothing without somebody to act on", async () => {
    await renderMenu(<SafetyMenu userId={null} navigation={navigation} />);

    expect(screen.queryByTestId("safety-menu")).toBeNull();
  });

  it("offers block and report", async () => {
    await renderMenu(<SafetyMenu userId="u1" name="Bo's owner" navigation={navigation} />);

    await tapById("safety-menu");

    expect(screen.getByTestId("safety-menu-block")).toBeTruthy();
    expect(screen.getByTestId("safety-menu-report")).toBeTruthy();
  });

  it("takes the report route to the report screen with the person's id", async () => {
    await renderMenu(<SafetyMenu userId="u1" name="Bo's owner" navigation={navigation} />);

    await tapById("safety-menu");
    await tapById("safety-menu-report");

    expect(navigation.navigate).toHaveBeenCalledWith("ReportUser", {
      userId: "u1",
      name: "Bo's owner",
    });
  });

  it("confirms before blocking, and blocks the user not the pet", async () => {
    const onBlocked = jest.fn();
    await renderMenu(
      <SafetyMenu userId="owner-1" name="Bo's owner" navigation={navigation} onBlocked={onBlocked} />
    );

    await tapById("safety-menu");
    await tapById("safety-menu-block");

    // Nothing has happened yet - blocking is destructive and confirms first.
    expect(blockUser).not.toHaveBeenCalled();

    await pressAlertButton("Block");

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith("owner-1"));
    await waitFor(() => expect(onBlocked).toHaveBeenCalledWith("owner-1"));
  });

  it("does not block when the confirmation is cancelled", async () => {
    await renderMenu(<SafetyMenu userId="owner-1" navigation={navigation} />);

    await tapById("safety-menu");
    await tapById("safety-menu-block");

    const [, , buttons] = Alert.alert.mock.calls.at(-1);
    expect(buttons.find((entry) => entry.text === "Cancel").onPress).toBeUndefined();
    expect(blockUser).not.toHaveBeenCalled();
  });

  it("reports a failed block instead of pretending it worked", async () => {
    const onBlocked = jest.fn();
    blockUser.mockRejectedValue({ response: { data: { message: "Nope" } } });

    await renderMenu(<SafetyMenu userId="owner-1" navigation={navigation} onBlocked={onBlocked} />);

    await tapById("safety-menu");
    await tapById("safety-menu-block");
    await pressAlertButton("Block");

    await waitFor(() => expect(screen.getByText("Nope")).toBeTruthy());
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("carries a host screen's own options alongside the safety ones", async () => {
    const onPress = jest.fn();
    await renderMenu(
      <SafetyMenu
        userId="u1"
        navigation={navigation}
        extraOptions={[{ label: "Chat options", testID: "chat-options", onPress }]}
      />
    );

    await tapById("safety-menu");
    await tapById("chat-options");

    expect(onPress).toHaveBeenCalled();
  });
});
