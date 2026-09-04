import React from "react";
import { Provider } from "react-redux";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import NotificationsScreen from "./NotificationsScreen";
import store from "../../redux/store";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { setNotifications } from "../../redux/actions";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));

/**
 * The notifications list.
 *
 * It fetched `/api/notifications/user/${userId}` - an id in the URL when the
 * caller is already in the token, on a route that did not check the two
 * matched - attached an Authorization header the shared client already sets,
 * kept its own copy of the list so the tab badge could not agree with it, and
 * passed each row only its `content`, so nothing was tappable.
 */

const navigation = { navigate: jest.fn() };

const notification = (id, overrides = {}) => ({
  _id: id,
  content: `Notification ${id}`,
  type: "general",
  readStatus: false,
  timestamp: new Date().toISOString(),
  ...overrides,
});

const renderScreen = () =>
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <NotificationsScreen navigation={navigation} />
      </AppThemeProvider>
    </Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(setNotifications([]));
  api.post.mockResolvedValue({ data: { unread: 0 } });
});

describe("NotificationsScreen", () => {
  it("shows an empty state rather than a bare line of text", async () => {
    api.get.mockResolvedValue({ data: [] });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeTruthy());
  });

  it("asks for the caller's own list, with no id in the URL", async () => {
    api.get.mockResolvedValue({ data: [notification("n1")] });
    await renderScreen();

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/api/notifications")
    );
  });

  it("renders what came back", async () => {
    api.get.mockResolvedValue({
      data: [notification("n1", { content: "Bo liked Ada back" })],
    });
    await renderScreen();

    await waitFor(() => expect(screen.getByText("Bo liked Ada back")).toBeTruthy());
  });

  it("tapping a match opens the pet it is about", async () => {
    api.get.mockResolvedValue({
      data: [notification("n1", { type: "petMatch", petId: "pet-9" })],
    });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("notification-n1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("notification-n1"));

    expect(navigation.navigate).toHaveBeenCalledWith("PetDetails", { petId: "pet-9" });
  });

  it("a general notification does not push a second copy of this screen", async () => {
    api.get.mockResolvedValue({ data: [notification("n1")] });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("notification-n1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("notification-n1"));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("opening one marks it read", async () => {
    api.get.mockResolvedValue({ data: [notification("n1")] });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("notification-n1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("notification-n1"));

    expect(api.post).toHaveBeenCalledWith("/api/notifications/n1/read");
  });

  it("marks everything read, and the store's count follows", async () => {
    api.get.mockResolvedValue({
      data: [notification("n1"), notification("n2")],
    });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("mark-all-read")).toBeTruthy());
    // `readStatus` has been on the schema from the start and nothing has ever
    // set it, so the badge could only ever count up.
    expect(store.getState().notifications.unread).toBe(2);

    await fireEvent.press(screen.getByTestId("mark-all-read"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/notifications/read")
    );
    expect(store.getState().notifications.unread).toBe(0);
  });

  it("a failed load says so instead of showing an empty inbox", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText("Couldn't load notifications")).toBeTruthy()
    );
  });
});
